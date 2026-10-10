"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Search,
  Database,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import type { AgentResponse, SubQuery } from "@/lib/types";

interface ReasoningTraceProps {
  response: AgentResponse;
}

export function ReasoningTrace({ response }: ReasoningTraceProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["plan", "queries", "memory"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const { plan, cypherQueries, processingTimeMs } = response;
  const doneCount = plan.subQueries.filter((q) => q.status === "done").length;
  const failedCount = plan.subQueries.filter((q) => q.status === "failed").length;

  return (
    <div className="p-4 space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Brain className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Reasoning Trace</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {(processingTimeMs / 1000).toFixed(1)}s
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-success" />
            {doneCount} succeeded
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-error" />
              {failedCount} failed
            </span>
          )}
        </div>
      </div>

      {/* Plan section */}
      <Section
        title="Research Plan"
        icon={<Search className="h-3.5 w-3.5" />}
        isOpen={expandedSections.has("plan")}
        onToggle={() => toggleSection("plan")}
      >
        <div className="space-y-2">
          <p className="text-xs text-text-muted italic">{plan.decomposed}</p>
          {plan.subQueries.map((sq) => (
            <SubQueryCard key={sq.id} subQuery={sq} />
          ))}
        </div>
      </Section>

      {/* Cypher Queries section */}
      <Section
        title="Cypher Queries"
        icon={<Database className="h-3.5 w-3.5" />}
        isOpen={expandedSections.has("queries")}
        onToggle={() => toggleSection("queries")}
      >
        <div className="space-y-2">
          {cypherQueries.map((query, i) => (
            <div key={i} className="rounded-lg bg-bg p-3">
              <p className="mb-1 text-xs font-medium text-text-muted">Query {i + 1}</p>
              <pre className="overflow-x-auto text-xs text-accent">{query}</pre>
            </div>
          ))}
        </div>
      </Section>

      {/* Memory section */}
      <Section
        title="Memory Recalled"
        icon={<Brain className="h-3.5 w-3.5" />}
        isOpen={expandedSections.has("memory")}
        onToggle={() => toggleSection("memory")}
      >
        <div className="space-y-2">
          {plan.memoryContext.length === 0 ? (
            <p className="text-xs text-text-muted italic">
              No relevant memories found from past sessions.
            </p>
          ) : (
            plan.memoryContext.map((mem, i) => (
              <div key={i} className="rounded-lg bg-bg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      mem.type === "episodic"
                        ? "bg-accent/20 text-accent"
                        : mem.type === "semantic"
                        ? "bg-success/20 text-success"
                        : "bg-warning/20 text-warning"
                    }`}
                  >
                    {mem.type}
                  </span>
                  <span className="text-xs text-text-muted">
                    relevance: {(mem.relevance * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-text/80">{mem.content}</p>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
        )}
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </button>
      {isOpen && <div className="border-t border-border px-4 py-3">{children}</div>}
    </div>
  );
}

function SubQueryCard({ subQuery }: { subQuery: SubQuery }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg bg-bg border border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {subQuery.status === "done" ? (
          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
        ) : subQuery.status === "failed" ? (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-error" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
        )}
        <span className="flex-1 text-xs">{subQuery.question}</span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-text-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 text-text-muted" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          <p className="text-xs text-text-muted">{subQuery.reasoning}</p>
          {subQuery.cypherQuery && (
            <pre className="overflow-x-auto rounded bg-surface p-2 text-xs text-accent">
              {subQuery.cypherQuery}
            </pre>
          )}
          {subQuery.evidence && (
            <pre className="overflow-x-auto rounded bg-surface p-2 text-xs text-text-muted whitespace-pre-wrap">
              {subQuery.evidence}
            </pre>
          )}
          {subQuery.error && (
            <p className="text-xs text-error">{subQuery.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
