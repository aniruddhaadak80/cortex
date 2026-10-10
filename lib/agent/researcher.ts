import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { runCypher } from "@/lib/falkordb";
import { GRAPH_SCHEMA, EXAMPLE_QUERIES } from "@/lib/cypher";
import { runAlgorithm, describeAlgorithmsForPrompt } from "./algorithms";
import type { AlgorithmName } from "./algorithms";
import type { SubQuery } from "@/lib/types";

const researchSchema = z.object({
  useAlgorithm: z
    .boolean()
    .describe(
      "Set true if a graph algorithm answers this better than raw Cypher."
    ),
  algorithm: z
    .string()
    .optional()
    .describe(
      "Algorithm name if useAlgorithm is true: shortest_path | impact_analysis | page_rank | degree_centrality | community_detection | bottleneck_finder"
    ),
  algorithmParams: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional()
    .describe("Parameters for the algorithm, e.g. {from, to} or {label, limit}"),
  cypherQuery: z
    .string()
    .describe("Cypher query to execute when useAlgorithm is false"),
  reasoning: z.string().describe("Why this answers the sub-question"),
});

const ALGORITHMS = new Set([
  "shortest_path",
  "impact_analysis",
  "page_rank",
  "degree_centrality",
  "community_detection",
  "bottleneck_finder",
]);

export async function executeResearch(
  subQuery: SubQuery,
  onEvent?: (event: ResearcherEvent) => void
): Promise<SubQuery> {
  try {
    onEvent?.({ type: "generating", subQueryId: subQuery.id });

    const { object: research } = await generateObject({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
      schema: researchSchema,
      prompt: `You are the Researcher agent. Decide how to answer this sub-question using a FalkorDB knowledge graph.

## Graph Schema
${GRAPH_SCHEMA}

## Graph Algorithms available as tools
${describeAlgorithmsForPrompt()}

Prefer a graph algorithm when the question is about connectivity, importance, clustering, or blast radius. Use raw Cypher otherwise.

## Example Queries
${EXAMPLE_QUERIES}

## Sub-question
"${subQuery.question}"

## Reasoning for this sub-query
"${subQuery.reasoning}"

Return the tool choice, its parameters, and brief reasoning.`,
      temperature: 0.1,
    });

    // Dispatch: algorithm tool or raw Cypher
    let rows: Record<string, any>[] = [];
    let error: string | undefined;
    let cypherQuery: string | undefined;

    if (
      research.useAlgorithm &&
      research.algorithm &&
      ALGORITHMS.has(research.algorithm)
    ) {
      onEvent?.({
        type: "algorithm",
        subQueryId: subQuery.id,
        algorithm: research.algorithm,
      });
      try {
        const result = await runAlgorithm(
          research.algorithm as AlgorithmName,
          research.algorithmParams || {}
        );
        rows = result.rows;
        cypherQuery = result.query;
      } catch (err: any) {
        error = err.message;
      }
    } else {
      onEvent?.({
        type: "querying",
        subQueryId: subQuery.id,
        cypher: research.cypherQuery,
      });
      try {
        rows = await runCypher(research.cypherQuery);
        cypherQuery = research.cypherQuery;
      } catch (err: any) {
        error = err.message;
        // Auto-repair pass
        try {
          const { object: fix } = await generateObject({
            model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
            schema: researchSchema,
            prompt: `The following Cypher failed with: ${error}

Query:
${research.cypherQuery}

Sub-question: "${subQuery.question}"

Schema:
${GRAPH_SCHEMA}

Examples:
${EXAMPLE_QUERIES}

Generate a corrected, conservative query (simple MATCH patterns only).`,
            temperature: 0.1,
          });
          rows = await runCypher(fix.cypherQuery);
          cypherQuery = fix.cypherQuery;
          error = undefined;
        } catch (retryErr: any) {
          error = retryErr.message;
        }
      }
    }

    const evidence = formatEvidence(rows, error);

    return {
      ...subQuery,
      cypherQuery,
      algorithm:
        research.useAlgorithm && research.algorithm
          ? research.algorithm
          : undefined,
      results: rows.slice(0, 20),
      status: error ? "failed" : "done",
      error,
      evidence,
    };
  } catch (err: any) {
    return {
      ...subQuery,
      status: "failed",
      error: err.message,
      evidence: "Research failed — could not generate or execute query.",
    };
  }
}

export type ResearcherEvent =
  | { type: "generating"; subQueryId: string }
  | { type: "algorithm"; subQueryId: string; algorithm: string }
  | { type: "querying"; subQueryId: string; cypher: string };

function formatEvidence(results: any[], error?: string): string {
  if (error) return `Query failed: ${error}`;
  if (!results || results.length === 0) return "No results found in the graph.";

  const lines = results.slice(0, 10).map((row) => {
    const entries = Object.entries(row)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(", ");
    return `{ ${entries} }`;
  });

  return `Found ${results.length} result(s):\n${lines.join("\n")}`;
}
