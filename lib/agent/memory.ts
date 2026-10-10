import { nanoid } from "nanoid";
import { runTenantCypher } from "@/lib/falkordb";
import type { MemoryEntry } from "@/lib/types";

/**
 * Memory lives in a PER-TENANT FalkorDB graph (`memory_{tenantId}`).
 * Track 2 criterion: "separate memory per user or tenant" — enabled by
 * FalkorDB multigraph topology, no extra database deployment required.
 */
export async function recallMemories(
  question: string,
  tenantId: string
): Promise<MemoryEntry[]> {
  try {
    const keywords = extractKeywords(question);

    if (keywords.length === 0) {
      const rows = await runTenantCypher(
        tenantId,
        `MATCH (m:Memory)
         RETURN m.type AS type, m.content AS content, m.relevance AS relevance, m.timestamp AS timestamp
         ORDER BY m.timestamp DESC
         LIMIT 3`
      );
      return toEntries(rows, tenantId);
    }

    const conditions = keywords
      .map((_, i) => `toLower(m.content) contains $kw${i}`)
      .join("\n        OR ");
    const keywordParams: Record<string, string> = {};
    keywords.forEach((kw, i) => {
      keywordParams[`kw${i}`] = kw.toLowerCase();
    });

    const query = `
      MATCH (m:Memory)
      WHERE (${conditions})
      RETURN m.type AS type, m.content AS content, m.relevance AS relevance, m.timestamp AS timestamp
      ORDER BY m.relevance DESC, m.timestamp DESC
      LIMIT 5
    `;

    const rows = await runTenantCypher(tenantId, query, keywordParams);
    if (rows.length > 0) return toEntries(rows, tenantId);

    // Fallback: most recent memories for this tenant
    const fallback = await runTenantCypher(
      tenantId,
      `MATCH (m:Memory)
       RETURN m.type AS type, m.content AS content, m.relevance AS relevance, m.timestamp AS timestamp
       ORDER BY m.timestamp DESC
       LIMIT 3`
    );
    return toEntries(fallback, tenantId);
  } catch (err) {
    console.error("[Memory] Recall failed:", err);
    return [];
  }
}

function toEntries(rows: Record<string, any>[], tenantId: string): MemoryEntry[] {
  return rows.map((row) => ({
    type: (row.type as MemoryEntry["type"]) || "semantic",
    content: row.content || "",
    relevance: parseFloat(row.relevance) || 0.5,
    sessionId: tenantId,
    timestamp: row.timestamp || new Date().toISOString(),
  }));
}

export async function storeEpisodicMemory(
  tenantId: string,
  question: string,
  answer: string
): Promise<void> {
  await safeStore(
    tenantId,
    "episodic",
    `Q: ${question}\nA: ${answer.substring(0, 500)}`,
    0.9
  );
}

export async function storeSemanticMemory(
  tenantId: string,
  fact: string
): Promise<void> {
  await safeStore(tenantId, "semantic", fact, 0.8);
}

export async function storeProceduralMemory(
  tenantId: string,
  pattern: string
): Promise<void> {
  await safeStore(tenantId, "procedural", pattern, 0.7);
}

async function safeStore(
  tenantId: string,
  type: MemoryEntry["type"],
  content: string,
  relevance: number
): Promise<void> {
  try {
    await runTenantCypher(
      tenantId,
      `CREATE (m:Memory {
        id: $id, type: $type, content: $content,
        relevance: $relevance, timestamp: $timestamp
      })`,
      {
        id: nanoid(),
        type,
        content,
        relevance,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (err) {
    console.error(`[Memory] Store ${type} failed:`, err);
  }
}

/** Inspect what a tenant has remembered — useful for the debug panel. */
export async function memoryStats(
  tenantId: string
): Promise<{ type: string; count: number }[]> {
  try {
    const rows = await runTenantCypher(
      tenantId,
      `MATCH (m:Memory) RETURN m.type AS type, count(m) AS count`
    );
    return rows.map((r) => ({ type: r.type, count: Number(r.count) }));
  } catch {
    return [];
  }
}

/** Forget everything for a tenant — for GDPR/demo resets. */
export async function forgetTenant(tenantId: string): Promise<void> {
  try {
    await runTenantCypher(tenantId, `MATCH (m:Memory) DETACH DELETE m`);
  } catch (err) {
    console.error("[Memory] Forget failed:", err);
  }
}

export function extractKeywords(question: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "what", "who", "which", "when",
    "where", "why", "how", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "because", "as", "of",
    "at", "by", "for", "with", "about", "against", "between", "into",
    "through", "during", "before", "after", "above", "below", "to",
    "from", "up", "down", "in", "out", "on", "off", "over", "under",
    "again", "further", "then", "once", "here", "there", "tell", "me",
    "show", "find", "get", "give", "know", "see", "think", "take", "use",
    "want", "look", "come", "ask", "work", "seem", "feel", "try",
    "leave", "call", "good", "new", "first", "last", "long", "great",
    "little", "other", "old", "right", "big", "high", "different",
    "small", "large", "next", "early", "young", "important", "public",
    "bad", "able", "does",
  ]);

  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .slice(0, 8);
}
