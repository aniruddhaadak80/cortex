"use client";

import { useState, useCallback } from "react";
import { Chat } from "@/components/Chat";
import { GraphView } from "@/components/GraphView";
import { ReasoningTrace } from "@/components/ReasoningTrace";
import { Header } from "@/components/Header";
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
      <Header onSeed={handleSeed} isSeeding={busy} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-[42%] flex-col border-r border-border">
          <Chat onSubgraph={handleSubgraph} onResponse={handleResponse} />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <GraphView graphKey={graphKey} highlight={highlight} />
          </div>
          <div className="h-[40%] overflow-y-auto border-t border-border">
            {response ? (
              <ReasoningTrace response={response} />
            ) : (
              <div className="flex h-full items-center justify-center text-text-muted">
                <p className="text-sm">
                  Ask a question to see the agent&apos;s reasoning trace
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
