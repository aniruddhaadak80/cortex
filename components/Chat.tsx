"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, AlertCircle, Loader2, Brain, Network, Zap } from "lucide-react";
import type { AgentResponse, SubQuery, MemoryEntry } from "@/lib/types";

export interface LivePhase {
  phase: string;
  status: "start" | "done" | "error";
  detail?: string;
}

interface ChatProps {
  onSubgraph: (nodes: any[], edges: any[]) => void;
  onResponse?: (r: AgentResponse) => void;
}

const PHASE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  memory: { label: "Recalling memory", icon: <Brain className="h-3 w-3" /> },
  plan: { label: "Planning research", icon: <Network className="h-3 w-3" /> },
  research: { label: "Researchers querying graph", icon: <Zap className="h-3 w-3" /> },
  subgraph: { label: "Extracting answer path", icon: <Network className="h-3 w-3" /> },
  synthesize: { label: "Synthesizing answer", icon: <Brain className="h-3 w-3" /> },
  store: { label: "Storing memory", icon: <Brain className="h-3 w-3" /> },
};

const SUGGESTIONS = [
  "Who on the team has worked on authentication systems?",
  "What breaks if the auth-service goes down?",
  "Who knows about the ML Recommendations project?",
  "What decisions were made about GraphQL and who made them?",
  "Show me the connection between Sarah Chen and the payment service",
  "Which projects are the most critical in the graph?",
];

interface Msg {
  id: string;
  role: "user" | "agent";
  content?: string;
  phases?: LivePhase[];
  subQueries?: { id: string; question: string; action?: string; result?: SubQuery }[];
  memories?: MemoryEntry[];
  answer?: string;
  response?: AgentResponse;
  error?: string;
}

export function Chat({ onSubgraph, onResponse }: ChatProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setInput("");

    const userId = `u-${Date.now()}`;
    const agentId = `a-${Date.now()}`;

    setMessages((m) => [
      ...m,
      { id: userId, role: "user", content: question },
      { id: agentId, role: "agent", phases: [], subQueries: [], answer: "" },
    ]);

    const patch = (updates: Partial<Msg>) =>
      setMessages((m) =>
        m.map((msg) => (msg.id === agentId ? { ...msg, ...updates } : msg))
      );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          sessionId: new URLSearchParams(location.search).get("t") || "demo",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const phases: LivePhase[] = [];
      const subQueries: Msg["subQueries"] = [];
      let memories: MemoryEntry[] = [];
      let answer = "";
      let finalResponse: AgentResponse | undefined;

      const handleEvent = (event: string, data: any) => {
        switch (event) {
          case "phase":
            phases.push({ phase: data.phase, status: data.status, detail: data.detail });
            patch({ phases: [...phases] });
            break;
          case "memories":
            memories = data.memories;
            patch({ memories });
            break;
          case "plan":
            subQueries.push(
              ...data.subQueries.map((sq: any) => ({
                id: sq.id,
                question: sq.question,
              }))
            );
            patch({ subQueries: [...subQueries] });
            break;
          case "research_update": {
            const sq = subQueries.find((s) => s.id === data.subQueryId);
            if (sq) sq.action = data.action;
            patch({ subQueries: [...subQueries] });
            break;
          }
          case "research_done": {
            const sq = subQueries.find((s) => s.id === data.subQuery.id);
            if (sq) sq.result = data.subQuery;
            patch({ subQueries: [...subQueries] });
            break;
          }
          case "subgraph":
            if (data.nodes?.length) onSubgraph(data.nodes, data.edges);
            break;
          case "answer_chunk":
            answer += data.chunk;
            patch({ answer });
            break;
          case "tenants":
            break;
          case "done":
            finalResponse = data.response;
            patch({ response: data.response, answer: data.response.answer });
            onResponse?.(data.response);
            break;
          case "error":
            patch({ error: data.message });
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          if (!raw.trim()) continue;
          let event = "message";
          let dataLine = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataLine += line.slice(6);
          }
          if (dataLine) {
            try {
              handleEvent(event, JSON.parse(dataLine));
            } catch {
              /* skip malformed */
            }
          }
        }
      }
    } catch (err: any) {
      patch({ error: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
              <Bot className="h-4 w-4 text-accent" />
            </div>
            <div className="rounded-xl rounded-tl-sm bg-surface-2 p-4 max-w-[85%]">
              <p className="text-sm leading-relaxed">
                Hey, I&apos;m <strong>Cortex</strong> — your AI company brain. I reason
                over a FalkorDB knowledge graph of people, projects, documents, and
                decisions.
              </p>
              <p className="mt-2 text-sm text-text-muted">
                I run four agents in parallel, remember what I learn between
                sessions, and show every Cypher query behind each answer. Try one:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q)}
                    disabled={busy}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="flex justify-end animate-fade-in">
              <div className="rounded-xl rounded-tr-sm bg-accent/20 px-4 py-3 max-w-[80%]">
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex gap-3 animate-fade-in">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
                <Bot className="h-4 w-4 text-accent" />
              </div>
              <div className="rounded-xl rounded-tl-sm bg-surface-2 p-4 max-w-[90%] flex-1">
                <LiveTrace msg={msg} />
                {msg.error && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-error/10 border border-error/20 p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-error mt-0.5" />
                    <p className="text-xs text-error">{msg.error}</p>
                  </div>
                )}
                {msg.answer && (
                  <>
                    <div
                      className="mt-3 text-sm leading-relaxed
                        [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
                        [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4
                        [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-text-muted
                        [&_p]:mb-2 [&_p]:text-text/90
                        [&_ul]:mb-2 [&_ul]:pl-4 [&_ul]:space-y-1
                        [&_strong]:text-text [&_strong]:font-semibold
                        [&_code]:rounded [&_code]:bg-bg [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-accent
                        [&_pre]:rounded-lg [&_pre]:bg-bg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:text-xs"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.answer) }}
                    />
                    {msg.response && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-text-muted">
                        <span>{(msg.response.processingTimeMs / 1000).toFixed(1)}s</span>
                        <span>&middot;</span>
                        <span>{msg.response.cypherQueries.length} Cypher queries</span>
                        <span>&middot;</span>
                        <span>{msg.response.plan.memoryContext.length} memories recalled</span>
                      </div>
                    )}
                  </>
                )}
                {!msg.answer && !msg.error && (
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Loader2 className="h-3 w-3 animate-spin text-accent" />
                    <span className="animate-pulse-glow">Working&hellip;</span>
                  </div>
                )}
              </div>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your company..."
            disabled={busy}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder-text-muted outline-none transition-colors focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

function LiveTrace({ msg }: { msg: Msg }) {
  if (!msg.phases?.length) return null;

  return (
    <div className="space-y-1.5">
      {msg.phases.map((p, i) => {
        const meta = PHASE_LABELS[p.phase] || { label: p.phase, icon: null };
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                p.status === "start"
                  ? "bg-accent animate-pulse-glow"
                  : p.status === "done"
                  ? "bg-success"
                  : "bg-error"
              }`}
            />
            {meta.icon && <span className="text-text-muted">{meta.icon}</span>}
            <span className={p.status === "done" ? "text-text-muted" : "text-text"}>
              {meta.label}
            </span>
            {p.status === "start" && (
              <span className="text-text-muted animate-pulse">running&hellip;</span>
            )}
            {p.status === "done" && p.detail && (
              <span className="text-text-muted">&mdash; {p.detail}</span>
            )}
          </div>
        );
      })}

      {msg.subQueries && msg.subQueries.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg bg-bg p-2.5">
          {msg.subQueries.map((sq) => (
            <div key={sq.id} className="flex items-start gap-2 text-xs">
              {sq.result ? (
                sq.result.status === "done" ? (
                  <span className="text-success mt-0.5">&#10003;</span>
                ) : (
                  <span className="text-error mt-0.5">&#10007;</span>
                )
              ) : (
                <span className="h-2 w-2 mt-1 animate-pulse-glow rounded-full bg-accent" />
              )}
              <div className="flex-1">
                <p className="text-text/80">{sq.question}</p>
                {sq.action && (
                  <p className="mt-0.5 text-[10px] text-text-muted font-mono">
                    {sq.action}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {msg.memories && msg.memories.length > 0 && (
        <div className="mt-1 text-[10px] text-text-muted">
          {msg.memories.length} memories recalled:{" "}
          {msg.memories.map((m) => m.type).join(", ")}
        </div>
      )}
    </div>
  );
}

function renderMarkdown(text: string): string {
  return text
    .replace(/### (.*)/g, "<h3>$1</h3>")
    .replace(/## (.*)/g, "<h2>$1</h2>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/^- (.*)/gm, "<li>$1</li>")
    .replace(/\n/g, "<br/>");
}
