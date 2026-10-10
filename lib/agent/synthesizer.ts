import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { SubQuery, MemoryEntry } from "@/lib/types";

export async function synthesizeAnswer(
  originalQuestion: string,
  subQueries: SubQuery[],
  memories: MemoryEntry[]
): Promise<string> {
  const evidenceBlocks = subQueries
    .filter((sq) => sq.status === "done")
    .map((sq) => {
      return `### Research: ${sq.question}
**Reasoning:** ${sq.reasoning}
**Cypher Query:** \`${sq.cypherQuery}\`
**Evidence:** ${sq.evidence}
`;
    })
    .join("\n");

  const memoryContext = memories
    .map((m) => `[${m.type}] ${m.content}`)
    .join("\n");

  const failedQueries = subQueries.filter((sq) => sq.status === "failed");

  const { text: answer } = await generateText({
    model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
    prompt: `You are the Synthesizer agent. Combine all research evidence into a clear, comprehensive answer to the user's original question.

## Original Question
"${originalQuestion}"

## Memory Context (from past sessions)
${memoryContext || "No prior memories."}

## Research Evidence
${evidenceBlocks || "No evidence was successfully gathered."}

${failedQueries.length > 0 ? `## Failed Research Attempts\n${failedQueries.map((fq) => `- ${fq.question}: ${fq.error}`).join("\n")}` : ""}

## Instructions
1. Answer the original question directly and comprehensively
2. Reference specific people, projects, documents, and decisions by name
3. Show the connections and reasoning paths that led to the answer
4. If there are gaps in the evidence, acknowledge them honestly
5. Format with markdown headers, bullet points, and **bold** for key terms
6. Include a "Reasoning Path" section at the end showing how the answer was derived
7. Keep it concise but thorough — aim for 200-400 words`,
    temperature: 0.4,
  });

  return answer;
}
