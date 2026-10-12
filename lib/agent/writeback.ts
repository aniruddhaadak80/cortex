import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { runCypher, runTenantCypher } from "@/lib/falkordb";
import {
  ALLOWED_ENTITY_LABELS,
  ALLOWED_WRITE_RELATIONS,
  isValidEntityName,
} from "@/lib/cypher-guard";

/**
 * Agent write-back — Track 3 criterion: "current knowledge".
 *
 * After synthesis, a dedicated extraction step asks the LLM what NEW facts
 * the research uncovered that the graph doesn't express yet. Validated
 * discoveries are MERGEd back into the shared knowledge graph with
 * provenance properties (`learned: true`, `source: 'agent'`), so the company
 * brain genuinely grows with every conversation.
 *
 * Safety: relationship types and node labels are interpolated only from
 * fixed whitelists; names travel as Cypher parameters. Nothing the model
 * emits can become executable syntax.
 */

const discoverySchema = z.object({
  discoveries: z.array(
    z.object({
      from: z
        .string()
        .describe("Name of an EXISTING entity mentioned in the evidence"),
      relation: z
        .enum(ALLOWED_WRITE_RELATIONS)
        .describe("Relationship type (must be from the allowed list)"),
      to: z.string().describe("Name of the entity on the other end"),
      toType: z
        .enum(ALLOWED_ENTITY_LABELS)
        .describe("Label for the 'to' entity if it needs to be created"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("How confident are you this fact is true (0-1)"),
      evidence: z.string().describe("Which research finding supports this"),
    })
  ),
});

export interface Discovery {
  from: string;
  relation: string;
  to: string;
  toType: string;
  confidence: number;
  evidence: string;
}

export const MIN_WRITE_CONFIDENCE = 0.75;

/**
 * Extract candidate new facts from the finished research. Pure extraction —
 * nothing is written here; {@link applyDiscoveries} does that.
 */
export async function extractDiscoveries(
  question: string,
  evidence: string
): Promise<Discovery[]> {
  try {
    const { object } = await generateObject({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
      schema: discoverySchema,
      prompt: `You are the Learning agent. The research below uncovered facts about a company.
List only facts that are NEW structural knowledge — relationships between named entities
that a knowledge graph should store. Do NOT restate facts already implied by common sense,
and do NOT invent entities that were not mentioned in the evidence.

## Question
"${question}"

## Research evidence
${evidence || "No evidence."}

Rules:
- "from" must be an entity name that plausibly already exists in the graph
- relation must come from the allowed list: ${ALLOWED_WRITE_RELATIONS.join(", ")}
- only include facts with confidence >= ${MIN_WRITE_CONFIDENCE}
- return [] if nothing new and structural was learned`,
      temperature: 0.1,
    });

    return (object.discoveries || []).filter(
      (d) =>
        d.confidence >= MIN_WRITE_CONFIDENCE &&
        isValidEntityName(d.from) &&
        isValidEntityName(d.to)
    );
  } catch (err) {
    console.error("[WriteBack] Extraction failed:", err);
    return [];
  }
}

/** Deduplicate by from+relation+to (case-insensitive). */
export function dedupeDiscoveries(discoveries: Discovery[]): Discovery[] {
  const seen = new Set<string>();
  const out: Discovery[] = [];
  for (const d of discoveries) {
    const key = `${d.from.toLowerCase()}|${d.relation}|${d.to.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

export interface AppliedDiscovery extends Discovery {
  createdNode: boolean;
  linked: boolean;
}

/**
 * Merge validated discoveries into the shared knowledge graph. Labels and
 * relationship types come from whitelists (validated again here — the
 * caller may not have validated); names are bound as parameters.
 */
export async function applyDiscoveries(
  discoveries: Discovery[],
  tenantId: string
): Promise<AppliedDiscovery[]> {
  const applied: AppliedDiscovery[] = [];

  for (const d of dedupeDiscoveries(discoveries)) {
    // Re-validate — defense in depth.
    if (
      !isValidEntityName(d.from) ||
      !isValidEntityName(d.to) ||
      !(ALLOWED_WRITE_RELATIONS as readonly string[]).includes(d.relation) ||
      !(ALLOWED_ENTITY_LABELS as readonly string[]).includes(d.toType)
    ) {
      continue;
    }

    try {
      // 1. Ensure the target node exists (idempotent MERGE with provenance).
      const mergeRows = await runCypher(
        `MERGE (b:\`${d.toType}\` {name: $to})
         ON CREATE SET b.learned = true, b.source = 'agent', b.learnedAt = $ts, b.learnedBy = $tenant
         RETURN count(b) AS ok`,
        { to: d.to, ts: new Date().toISOString(), tenant: tenantId }
      );
      const createdNode = Number(mergeRows[0]?.ok ?? 0) > 0;

      // 2. Link from the existing source entity.
      const linkRows = await runCypher(
        `MATCH (a) WHERE coalesce(a.name, a.title) = $from
         MATCH (b:\`${d.toType}\` {name: $to})
         MERGE (a)-[r:\`${d.relation}\`]->(b)
         RETURN count(r) AS linked`,
        { from: d.from, to: d.to }
      );
      const linked = Number(linkRows[0]?.linked ?? 0) > 0;

      applied.push({ ...d, createdNode, linked });
    } catch (err) {
      console.error("[WriteBack] Apply failed for", d, err);
    }
  }

  // Record the learning event in the tenant's memory graph too.
  if (applied.length > 0) {
    try {
      await runTenantCypher(
        tenantId,
        `CREATE (m:Memory {
          id: $id, type: 'semantic',
          content: $content, relevance: 0.85, timestamp: $ts
        })`,
        {
          id: `wb-${Date.now()}`,
          content: `Learned ${applied.length} new fact(s): ${applied
            .map((a) => `${a.from} -[${a.relation}]-> ${a.to}`)
            .join("; ")}`,
          ts: new Date().toISOString(),
        }
      );
    } catch {
      /* non-fatal */
    }
  }

  return applied;
}
