import { planResearch } from "./planner";
import { executeResearch } from "./researcher";
import { synthesizeAnswer } from "./synthesizer";
import {
  recallMemories,
  storeEpisodicMemory,
  storeSemanticMemory,
  storeProceduralMemory,
} from "./memory";
import type { AgentResponse, AgentPlan, SubQuery } from "@/lib/types";
import { nanoid } from "nanoid";

export async function runAgent(
  question: string,
  sessionId: string
): Promise<AgentResponse> {
  const startTime = Date.now();

  // Step 1: Recall memories from past sessions (Track 2: Memory)
  console.log(`[Agent] Recalling memories for session ${sessionId}...`);
  const memories = await recallMemories(question, sessionId);

  // Step 2: Plan the research (decompose into sub-queries)
  console.log(`[Agent] Planning research for: "${question}"`);
  const plan = await planResearch(question, memories);

  // Step 3: Execute research in parallel (Track 1: Acts on connected data)
  const subQueries: SubQuery[] = plan.subQueries.map((sq, i) => ({
    id: nanoid(),
    question: sq.question,
    reasoning: sq.reasoning,
    status: "pending" as const,
  }));

  console.log(`[Agent] Executing ${subQueries.length} research tasks in parallel...`);
  const results = await Promise.all(
    subQueries.map(async (sq) => {
      const result = await executeResearch(sq);
      console.log(
        `[Agent] Research ${result.status}: ${result.question.substring(0, 60)}`
      );
      return result;
    })
  );

  const fullPlan: AgentPlan = {
    originalQuestion: question,
    decomposed: plan.decomposed,
    subQueries: results,
    memoryContext: memories,
  };

  // Step 4: Synthesize the final answer (Track 3: Company Brain)
  console.log(`[Agent] Synthesizing answer...`);
  const answer = await synthesizeAnswer(question, results, memories);

  // Step 5: Store memories for future sessions (Track 2: Memory persists)
  await storeEpisodicMemory(sessionId, question, answer);

  // Extract and store semantic facts from the answer
  const facts = extractFacts(answer, results);
  for (const fact of facts.slice(0, 3)) {
    await storeSemanticMemory(sessionId, fact);
  }

  // Store procedural memory (successful query patterns)
  const successfulQueries = results
    .filter((r) => r.status === "done" && r.cypherQuery)
    .map((r) => `${r.question} => ${r.cypherQuery}`);
  for (const pattern of successfulQueries.slice(0, 2)) {
    await storeProceduralMemory(sessionId, pattern);
  }

  const processingTimeMs = Date.now() - startTime;
  console.log(`[Agent] Done in ${processingTimeMs}ms`);

  return {
    answer,
    plan: fullPlan,
    cypherQueries: results
      .filter((r) => r.cypherQuery)
      .map((r) => r.cypherQuery!),
    graphPaths: extractGraphPaths(results),
    processingTimeMs,
  };
}

function extractFacts(answer: string, results: SubQuery[]): string[] {
  const facts: string[] = [];
  for (const r of results) {
    if (r.status === "done" && r.results && r.results.length > 0) {
      facts.push(`${r.question} — ${r.evidence?.substring(0, 200)}`);
    }
  }
  return facts;
}

function extractGraphPaths(results: SubQuery[]): any[] {
  const paths: any[] = [];
  for (const r of results) {
    if (r.status === "done" && r.results && r.results.length > 0) {
      for (const row of r.results.slice(0, 3)) {
        const pathNodes: any[] = [];
        const pathEdges: any[] = [];
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === "object" && value !== null) {
            pathNodes.push({ id: key, label: JSON.stringify(value).substring(0, 50), type: key });
          }
        }
        if (pathNodes.length > 0) {
          paths.push({ nodes: pathNodes, edges: pathEdges });
        }
      }
    }
  }
  return paths;
}
