"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertCircle, Loader2 } from "lucide-react";
import type { AgentResponse } from "@/lib/types";

interface ChatProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  error: string | null;
  response: AgentResponse | null;
}

const SUGGESTED_QUESTIONS = [
  "Who on the team has worked on authentication systems?",
  "What breaks if the auth-service goes down?",
  "Who knows about the ML Recommendations project?",
  "What decisions were made about GraphQL and who made them?",
  "Show me the connection between Sarah Chen and the payment service",
];

export function Chat({ onSend, isLoading, error, response }: ChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [response, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome message */}
        <div className="flex gap-3 animate-fade-in">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
            <Bot className="h-4 w-4 text-accent" />
          </div>
          <div className="rounded-xl rounded-tl-sm bg-surface-2 p-4 max-w-[85%]">
            <p className="text-sm leading-relaxed">
              Hey! I&apos;m <strong>Cortex</strong>, your AI company brain. I use a
              FalkorDB knowledge graph to reason over your company&apos;s people,
              projects, documents, and decisions.
            </p>
            <p className="mt-2 text-sm text-text-muted">
              I remember past conversations, coordinate multiple research agents,
              and show you exactly how I reached each answer. Try asking:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => !isLoading && onSend(q)}
                  disabled={isLoading}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-error/20">
              <AlertCircle className="h-4 w-4 text-error" />
            </div>
            <div className="rounded-xl rounded-tl-sm bg-error/10 border border-error/20 p-4 max-w-[85%]">
              <p className="text-sm text-error">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            </div>
            <div className="rounded-xl rounded-tl-sm bg-surface-2 p-4">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <div className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
                <div className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" style={{ animationDelay: "0.2s" }} />
                <div className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" style={{ animationDelay: "0.4s" }} />
                <span className="ml-2">Agents are reasoning...</span>
              </div>
            </div>
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
              <Bot className="h-4 w-4 text-accent" />
            </div>
            <div className="rounded-xl rounded-tl-sm bg-surface-2 p-4 max-w-[85%]">
              <div
                className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed
                  [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:text-text
                  [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-text
                  [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-text-muted
                  [&_p]:mb-2 [&_p]:text-text/90
                  [&_ul]:mb-2 [&_ul]:pl-4 [&_ul]:space-y-1
                  [&_li]:text-text/80
                  [&_strong]:text-text [&_strong]:font-semibold
                  [&_code]:rounded [&_code]:bg-bg [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-accent
                  [&_pre]:rounded-lg [&_pre]:bg-bg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:my-2"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(response.answer),
                }}
              />
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-text-muted">
                <span>Processed in {(response.processingTimeMs / 1000).toFixed(1)}s</span>
                <span>&middot;</span>
                <span>{response.cypherQueries.length} Cypher queries executed</span>
                <span>&middot;</span>
                <span>{response.plan.memoryContext.length} memories recalled</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your company..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder-text-muted outline-none transition-colors focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
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
