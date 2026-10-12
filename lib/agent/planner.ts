import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { GRAPH_SCHEMA, EXAMPLE_QUERIES } from "@/lib/cypher";
import type { MemoryEntry } from "@/lib/types";
import type { ChatTurn } from "@/lib/agent";

const planSchema = z.object({
  decomposed: z.string().describe("Breakdown of the question into parts"),
  subQueries: z.array(
    z.object({
      question: z.string().describe("The sub-question to research"),
      reasoning: z.string().describe("Why this sub-question matters"),
    })
  ),
});

export async function planResearch(
  question: string,
  memories: MemoryEntry[],
  history: ChatTurn[] = []
) {
  const memoryContext = memories
    .map((m) => `[${m.type}] ${m.content}`)
    .join("\n");

  const historyBlock = history
    .slice(-4)
    .map((t) => `${t.role === "user" ? "Human" : "Cortex"}: ${t.content}`)
    .join("\n");

  const { object: plan } = await generateObject({
    model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
    schema: planSchema,
    prompt: `You are the Planner agent in a multi-agent system. Your job is to decompose a user's question into focused sub-queries that can be answered by querying a knowledge graph in FalkorDB.

## Graph Schema
${GRAPH_SCHEMA}

## Example Queries
${EXAMPLE_QUERIES}

## Memory Context (from past sessions)
${memoryContext || "No prior memories found."}

## Conversation So Far
${historyBlock || "This is the start of the conversation."}

## User Question
"${question}"

Decompose this into 2-5 focused sub-queries. Each sub-query should be specific enough to translate into a single Cypher query. Consider:
- Multi-hop relationships (e.g., person → project → system → dependency)
- Temporal aspects (recent decisions, current project status)
- Connections between people, projects, documents, and decisions

Return the decomposition plan as structured data.`,
    temperature: 0.3,
  });

  return plan;
}
