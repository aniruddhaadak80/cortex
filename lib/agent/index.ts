import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { planResearch } from "./planner";
import { executeResearch } from "./researcher";
import {
  recallMemories,
  storeEpisodicMemory,
  storeSemanticMemory,
  storeProceduralMemory,
} from "./memory";
import { extractSubgraphForAnswer, findPathBetween } from "./subgraph";
import { extractDiscoveries, applyDiscoveries, type AppliedDiscovery } from "./writeback";
import { listTenantGraphs } from "@/lib/falkordb";
import type { AgentResponse, AgentPlan, SubQuery, MemoryEntry } from "@/lib/types";
import { nanoid } from "nanoid";

/** One prior exchange, oldest first. Powers follow-up questions. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Events emitted while the pipeline runs — consumed as SSE by the UI. */
export type AgentEvent =
  | { type: "phase"; phase: AgentPhase; status: "start" | "done" | "error"; detail?: string }
  | { type: "memories"; memories: MemoryEntry[] }
  | { type: "plan"; decomposed: string; subQueries: { id: string; question: string; reasoning: string }[] }
  | { type: "research_start"; subQueryId: string; question: string }
  | { type: "research_update"; subQueryId: string; action: string }
  | { type: "research_done"; subQuery: SubQuery }
  | { type: "answer_chunk"; chunk: string }
  | { type: "subgraph"; nodes: any[]; edges: any[]; truncated: boolean }
  | { type: "writeback"; learned: { from: string; relation: string; to: string; createdNode: boolean }[] }
  | { type: "tenants"; graphs: string[] }
  | { type: "done"; response: AgentResponse }
  | { type: "error"; message: string };

export type AgentPhase =
  | "memory"
  | "plan"
  | "research"
  | "subgraph"
  | "synthesize"
  | "learn"
  | "store";

/**
 * Streaming agent pipeline.
 *
 * Memory → Plan → Research (parallel) → Subgraph → Synthesize → Learn
 * (write-back) → Store. Every step yields an event so the UI shows live
 * reasoning instead of a spinner.
 */
export async function* runAgentStream(
  question: string,
  tenantId: string,
  history: ChatTurn[] = []
): AsyncGenerator<AgentEvent> {
  const startTime = Date.now();

  try {
    // ── Phase 1: Memory recall (per-tenant FalkorDB graph) ──
    yield { type: "phase", phase: "memory", status: "start" };
    const memories = await recallMemories(question, tenantId);
    yield { type: "phase", phase: "memory", status: "done", detail: `${memories.length} memories` };
    yield { type: "memories", memories };

    // ── Phase 2: Plan ──
    yield { type: "phase", phase: "plan", status: "start" };
    const plan = await planResearch(question, memories, history);
    const subQueries: SubQuery[] = plan.subQueries.map((sq) => ({
      id: nanoid(),
      question: sq.question,
      reasoning: sq.reasoning,
      status: "pending" as const,
    }));
    yield {
      type: "plan",
      decomposed: plan.decomposed,
      subQueries: subQueries.map((sq) => ({
        id: sq.id,
        question: sq.question,
        reasoning: sq.reasoning,
      })),
    };
    yield { type: "phase", phase: "plan", status: "done", detail: `${subQueries.length} sub-queries` };

    // ── Phase 3: Research in parallel ──
    yield { type: "phase", phase: "research", status: "start", detail: `${subQueries.length} researchers` };

    const pending = subQueries.map(async (sq): Promise<{ sq: SubQuery; events: AgentEvent[] }> => {
      const events: AgentEvent[] = [
        { type: "research_start", subQueryId: sq.id, question: sq.question },
      ];
      const result = await executeResearch(sq, (e) => {
        events.push({
          type: "research_update",
          subQueryId: sq.id,
          action: e.type === "algorithm" ? `algorithm:${e.algorithm}` : e.type,
        });
      });
      events.push({ type: "research_done", subQuery: result });
      return { sq: result, events };
    });

    const results: SubQuery[] = [];
    const batches = await Promise.all(pending);
    for (const batch of batches) {
      for (const ev of batch.events) yield ev;
      results.push(batch.sq);
    }

    yield { type: "phase", phase: "research", status: "done", detail: `${results.filter((r) => r.status === "done").length}/${results.length} succeeded` };

    const fullPlan: AgentPlan = {
      originalQuestion: question,
      decomposed: plan.decomposed,
      subQueries: results,
      memoryContext: memories,
    };

    // ── Phase 4: Subgraph extraction (the "path behind the answer") ──
    yield { type: "phase", phase: "subgraph", status: "start" };
    const allRows: Record<string, any>[] = [];
    for (const r of results) {
      if (r.status === "done" && r.results) allRows.push(...r.results.slice(0, 10));
    }
    let subgraph = { nodes: [] as any[], edges: [] as any[], truncated: false };
    try {
      subgraph = await extractSubgraphForAnswer(allRows);
    } catch {
      /* non-fatal */
    }
    yield { type: "subgraph", ...subgraph };
    yield { type: "phase", phase: "subgraph", status: "done", detail: `${subgraph.nodes.length} nodes in answer path` };

    // ── Phase 5: Synthesize (streamed) ──
    yield { type: "phase", phase: "synthesize", status: "start" };
    let answer = "";
    const synthStream = streamAnswer(question, results, memories, history);
    for await (const chunk of synthStream) {
      answer += chunk;
      yield { type: "answer_chunk", chunk };
    }
    yield { type: "phase", phase: "synthesize", status: "done" };

    // ── Phase 6: Learn — write new structural facts back to the graph ──
    yield { type: "phase", phase: "learn", status: "start" };
    let learned: AppliedDiscovery[] = [];
    try {
      const evidenceBlob = results
        .filter((r) => r.status === "done")
        .map((r) => `${r.question}\n${r.evidence || ""}`)
        .join("\n\n");
      const discoveries = await extractDiscoveries(question, evidenceBlob);
      if (discoveries.length > 0) {
        learned = await applyDiscoveries(discoveries, tenantId);
      }
    } catch (err) {
      console.error("[Agent] Write-back failed (non-fatal):", err);
    }
    yield {
      type: "writeback",
      learned: learned.map((l) => ({
        from: l.from,
        relation: l.relation,
        to: l.to,
        createdNode: l.createdNode,
      })),
    };
    yield {
      type: "phase",
      phase: "learn",
      status: "done",
      detail: learned.length > 0 ? `${learned.length} new facts merged` : "nothing new",
    };

    // ── Phase 7: Store memories + show multigraph isolation ──
    yield { type: "phase", phase: "store", status: "start" };
    await storeEpisodicMemory(tenantId, question, answer);
    for (const fact of extractFacts(answer, results).slice(0, 3)) {
      await storeSemanticMemory(tenantId, fact);
    }
    for (const pattern of results
      .filter((r) => r.status === "done" && r.cypherQuery)
      .slice(0, 2)
      .map((r) => `${r.question} => ${r.cypherQuery}`)) {
      await storeProceduralMemory(tenantId, pattern);
    }
    yield { type: "phase", phase: "store", status: "done" };

    const graphs = await listTenantGraphs();
    yield { type: "tenants", graphs };

    const response: AgentResponse = {
      answer,
      plan: fullPlan,
      cypherQueries: results.filter((r) => r.cypherQuery).map((r) => r.cypherQuery!),
      graphPaths: [],
      processingTimeMs: Date.now() - startTime,
      learned: learned.map((l) => ({
        from: l.from,
        relation: l.relation,
        to: l.to,
        createdNode: l.createdNode,
      })),
    };
    yield { type: "done", response };
  } catch (err: any) {
    yield { type: "error", message: err.message || "Agent pipeline failed" };
  }
}

/** Streaming synthesizer — chunks come out as the LLM writes. */
async function* streamAnswer(
  question: string,
  results: SubQuery[],
  memories: MemoryEntry[],
  history: ChatTurn[]
): AsyncGenerator<string> {
  const evidenceBlocks = results
    .filter((sq) => sq.status === "done")
    .map(
      (sq) => `### Research: ${sq.question}
**Reasoning:** ${sq.reasoning}
**Cypher:** \`${sq.cypherQuery || "n/a"}\`
**Evidence:** ${sq.evidence}`
    )
    .join("\n\n");

  const memoryContext = memories.map((m) => `[${m.type}] ${m.content}`).join("\n");
  const failed = results.filter((r) => r.status === "failed");
  const historyBlock = history
    .slice(-4)
    .map((t) => `${t.role === "user" ? "Human" : "Cortex"}: ${t.content}`)
    .join("\n");

  const { textStream } = streamText({
    model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
    prompt: `You are the Synthesizer agent. Combine all research evidence into a clear, comprehensive answer.

## Original Question
"${question}"

## Conversation So Far
${historyBlock || "This is the start of the conversation."}

## Memory Context
${memoryContext || "No prior memories."}

## Research Evidence
${evidenceBlocks || "No evidence gathered."}

${failed.length ? `## Failed Research\n${failed.map((f) => `- ${f.question}: ${f.error}`).join("\n")}` : ""}

## Instructions
1. Answer directly and comprehensively
2. If the question is a follow-up ("what about X?", "and them?"), resolve it using the conversation above
3. Reference specific people, projects, documents, decisions by name
4. Show the connections that led to the answer
5. Acknowledge evidence gaps honestly
6. Markdown with headers, bullets, **bold** for key terms
7. End with a "Reasoning Path" section showing how you got there
8. 200-400 words`,
    temperature: 0.4,
  });

  yield* textStream;
}

function extractFacts(answer: string, results: SubQuery[]): string[] {
  return results
    .filter((r) => r.status === "done" && r.results && r.results.length > 0)
    .map((r) => `${r.question} — ${(r.evidence || "").substring(0, 200)}`);
}

/** Non-streaming wrapper for the MCP server and tests. */
export async function runAgent(
  question: string,
  tenantId: string,
  history: ChatTurn[] = []
): Promise<AgentResponse> {
  let response: AgentResponse | null = null;
  for await (const event of runAgentStream(question, tenantId, history)) {
    if (event.type === "done") response = event.response;
  }
  if (!response) throw new Error("Agent produced no response");
  return response;
}

/** Convenience: "the path between X and Y" as a first-class call. */
export { findPathBetween };
