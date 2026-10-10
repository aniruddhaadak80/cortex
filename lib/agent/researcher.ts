import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { runCypher } from "@/lib/falkordb";
import { GRAPH_SCHEMA, EXAMPLE_QUERIES } from "@/lib/cypher";
import type { SubQuery } from "@/lib/types";

const researchSchema = z.object({
  cypherQuery: z.string().describe("The Cypher query to execute"),
  reasoning: z.string().describe("Why this query answers the sub-question"),
});

export async function executeResearch(
  subQuery: SubQuery
): Promise<SubQuery> {
  try {
    // Step 1: Generate Cypher query from the sub-question
    const { object: research } = await generateObject({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
      schema: researchSchema,
      prompt: `You are the Researcher agent. Generate a FalkorDB Cypher query to answer this sub-question.

## Graph Schema
${GRAPH_SCHEMA}

## Example Queries
${EXAMPLE_QUERIES}

## Sub-question
"${subQuery.question}"

## Reasoning for this sub-query
"${subQuery.reasoning}"

Generate a single, correct Cypher query. Return ONLY the query and brief reasoning. The query must be valid FalkorDB Cypher syntax.`,
      temperature: 0.1,
    });

    // Step 2: Execute the query against FalkorDB
    let results: any[] = [];
    let error: string | undefined;

    try {
      results = await runCypher(research.cypherQuery);
    } catch (err: any) {
      error = err.message;
      // Try to fix the query with a retry
      try {
        const { object: fixAttempt } = await generateObject({
          model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
          schema: researchSchema,
          prompt: `The following Cypher query failed with error: ${error}

Failed query:
${research.cypherQuery}

Sub-question: "${subQuery.question}"

Graph Schema:
${GRAPH_SCHEMA}

Example Queries:
${EXAMPLE_QUERIES}

Generate a corrected Cypher query that works with FalkorDB. Be conservative - use simple MATCH patterns.`,
          temperature: 0.1,
        });
        results = await runCypher(fixAttempt.cypherQuery);
        error = undefined;
      } catch (retryErr: any) {
        error = retryErr.message;
      }
    }

    // Step 3: Format results as evidence
    const evidence = formatEvidence(results, error);

    return {
      ...subQuery,
      cypherQuery: research.cypherQuery,
      results: results.slice(0, 20),
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
