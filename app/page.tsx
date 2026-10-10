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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphKey, setGraphKey] = useState(0);

  const handleSendMessage = useCallback(
    async (message: string) => {
      setIsLoading(true);
      setError(null);
      setResponse(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, sessionId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to get response");
        }

        setResponse(data);
        setGraphKey((k) => k + 1);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  const handleSeed = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGraphKey((k) => k + 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <Header onSeed={handleSeed} isSeeding={isLoading} />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex w-[42%] flex-col border-r border-border">
          <Chat
            onSend={handleSendMessage}
            isLoading={isLoading}
            error={error}
            response={response}
          />
        </div>
        {/* Right: Graph + Reasoning */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <GraphView graphKey={graphKey} />
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
