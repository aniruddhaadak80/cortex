"use client";

import { useState, useCallback, useEffect } from "react";
import { Chat } from "@/components/Chat";
import { GraphView } from "@/components/GraphView";
import { ReasoningTrace } from "@/components/ReasoningTrace";
import { InsightsPanel } from "@/components/InsightsPanel";
import { EntityPanel } from "@/components/EntityPanel";
import { Header } from "@/components/Header";
import { Activity, Lightbulb } from "lucide-react";
import type { AgentResponse } from "@/lib/types";

export default function Home() {
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [graphKey, setGraphKey] = useState(0);
  const [highlight, setHighlight] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: [],
  });
  const [busy, setBusy] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"trace" | "insights">("trace");
  const [tenant, setTenant] = useState("demo");

  // Persist tenant across reloads — memory isolation demo
  useEffect(() => {
    const saved = localStorage.getItem("cortex-tenant");
    if (saved) setTenant(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("cortex-tenant", tenant);
  }, [tenant]);

  const handleSubgraph = useCallback((nodes: any[], edges: any[]) => {
    setHighlight({ nodes, edges });
  }, []);

  const handleResponse = useCallback((r: AgentResponse) => {
    setResponse(r);
    setGraphKey((k) => k + 1);
  }, []);

  const handleSeed = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      setGraphKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <Header
        onSeed={handleSeed}
        isSeeding={busy}
        tenant={tenant}
        onTenantChange={setTenant}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-[42%] flex-col border-r border-border">
          <Chat
            onSubgraph={handleSubgraph}
            onResponse={handleResponse}
            tenant={tenant}
          />
        </div>
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <GraphView
              graphKey={graphKey}
              highlight={highlight}
              onNodeSelect={setSelectedEntity}
            />
          </div>

          {/* Entity detail overlay — click any node in the graph */}
          <EntityPanel
            entityName={selectedEntity}
            onClose={() => setSelectedEntity(null)}
          />

          {/* Bottom panel: reasoning trace / live graph insights */}
          <div className="h-[38%] overflow-hidden border-t border-border">
            <div className="flex items-center gap-1 border-b border-border px-4 py-1.5">
              <button
                onClick={() => setBottomTab("trace")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs transition-colors ${
                  bottomTab === "trace"
                    ? "bg-accent/20 text-accent"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <Activity className="h-3 w-3" />
                Reasoning Trace
              </button>
              <button
                onClick={() => setBottomTab("insights")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs transition-colors ${
                  bottomTab === "insights"
                    ? "bg-accent/20 text-accent"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <Lightbulb className="h-3 w-3" />
                Graph Insights
              </button>
            </div>
            <div className="h-[calc(100%-30px)] overflow-y-auto">
              {bottomTab === "trace" ? (
                response ? (
                  <ReasoningTrace response={response} />
                ) : (
                  <div className="flex h-full items-center justify-center text-text-muted">
                    <p className="text-sm">
                      Ask a question to see the agent&apos;s reasoning trace
                    </p>
                  </div>
                )
              ) : (
                <InsightsPanel refreshKey={graphKey} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
