import { nanoid } from "nanoid";
import { getGraph } from "@/lib/falkordb";
import type { MemoryEntry } from "@/lib/types";

export async function recallMemories(
  question: string,
  sessionId: string
): Promise<MemoryEntry[]> {
  try {
    const graph = await getGraph();
    // Extract keywords from the question for matching
    const keywords = extractKeywords(question);

    if (keywords.length === 0) {
      // No useful keywords — return recent memories
      const fallbackQuery = `
        MATCH (m:Memory)
        WHERE m.session_id = $sessionId
        RETURN m.type AS type, m.content AS content, m.relevance AS relevance, m.timestamp AS timestamp
        ORDER BY m.timestamp DESC
        LIMIT 3
      `;
      const fallback = await graph.query(fallbackQuery, { params: { sessionId } });
      return (fallback.data || []).map((row: any) => ({
        type: row.type || "semantic",
        content: row.content || "",
        relevance: parseFloat(row.relevance) || 0.5,
        sessionId,
        timestamp: row.timestamp || new Date().toISOString(),
      }));
    }

    // Build OR clause: content CONTAINS keyword for each keyword
    const conditions = keywords.map((_, i) => `toLower(m.content) contains $kw${i}`).join("\n        OR ");
    const keywordParams: Record<string, string> = {};
    keywords.forEach((kw, i) => {
      keywordParams[`kw${i}`] = kw.toLowerCase();
    });

    const query = `
      MATCH (m:Memory)
      WHERE m.session_id = $sessionId
        AND (${conditions})
      RETURN m.type AS type, m.content AS content, m.relevance AS relevance, m.timestamp AS timestamp
      ORDER BY m.relevance DESC, m.timestamp DESC
      LIMIT 5
    `;

    const result = await graph.query(query, {
      params: { sessionId, ...keywordParams },
    });

    if (!result.data || result.data.length === 0) {
      // Fallback: return recent memories from this session
      const fallbackQuery = `
        MATCH (m:Memory)
        WHERE m.session_id = $sessionId
        RETURN m.type AS type, m.content AS content, m.relevance AS relevance, m.timestamp AS timestamp
        ORDER BY m.timestamp DESC
        LIMIT 3
      `;
      const fallback = await graph.query(fallbackQuery, { params: { sessionId } });
      return (fallback.data || []).map((row: any) => ({
        type: row.type || "semantic",
        content: row.content || "",
        relevance: parseFloat(row.relevance) || 0.5,
        sessionId,
        timestamp: row.timestamp || new Date().toISOString(),
      }));
    }

    return (result.data || []).map((row: any) => ({
      type: row.type || "semantic",
      content: row.content || "",
      relevance: parseFloat(row.relevance) || 0.5,
      sessionId,
      timestamp: row.timestamp || new Date().toISOString(),
    }));
  } catch (err) {
    console.error("[Memory] Recall failed:", err);
    return [];
  }
}

export async function storeEpisodicMemory(
  sessionId: string,
  question: string,
  answer: string
): Promise<void> {
  try {
    const graph = await getGraph();
    const memoryId = nanoid();
    const timestamp = new Date().toISOString();
    const content = `Q: ${question}\nA: ${answer.substring(0, 500)}`;

    await graph.query(
      `CREATE (m:Memory {
        id: $id, type: 'episodic', content: $content,
        session_id: $sessionId, relevance: 0.9, timestamp: $timestamp
      })`,
      { params: { id: memoryId, content, sessionId, timestamp } }
    );
  } catch (err) {
    console.error("[Memory] Store episodic failed:", err);
  }
}

export async function storeSemanticMemory(
  sessionId: string,
  fact: string
): Promise<void> {
  try {
    const graph = await getGraph();
    const memoryId = nanoid();
    const timestamp = new Date().toISOString();

    await graph.query(
      `CREATE (m:Memory {
        id: $id, type: 'semantic', content: $content,
        session_id: $sessionId, relevance: 0.8, timestamp: $timestamp
      })`,
      { params: { id: memoryId, content: fact, sessionId, timestamp } }
    );
  } catch (err) {
    console.error("[Memory] Store semantic failed:", err);
  }
}

export async function storeProceduralMemory(
  sessionId: string,
  pattern: string
): Promise<void> {
  try {
    const graph = await getGraph();
    const memoryId = nanoid();
    const timestamp = new Date().toISOString();

    await graph.query(
      `CREATE (m:Memory {
        id: $id, type: 'procedural', content: $content,
        session_id: $sessionId, relevance: 0.7, timestamp: $timestamp
      })`,
      { params: { id: memoryId, content: pattern, sessionId, timestamp } }
    );
  } catch (err) {
    console.error("[Memory] Store procedural failed:", err);
  }
}

function extractKeywords(question: string): string[] {
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
    "little", "other", "old", "right", "big", "high", "different", "small",
    "large", "next", "early", "young", "important", "few", "public",
    "bad", "same", "able",
  ]);

  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .slice(0, 8);
}
