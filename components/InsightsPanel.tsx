"use client";

import { useState, useEffect } from "react";
import { Activity, Award, AlertTriangle, Hash } from "lucide-react";

/**
 * Graph insights panel — live analytics computed by the same graph
 * algorithms the agents use as tools (degree centrality, PageRank,
 * bottleneck detection). Track 1: "graph algorithms as agent tools".
 */

interface Insights {
  counts: { label: string; count: number }[];
  edges: number;
  topConnected: { name: string; label: string; degree: number }[];
  bottlenecks: { name: string; label: string; degree: number; bridges: number }[];
  pageRank: { name: string; label: string; score: number }[];
  algorithmSource: Record<string, string>;
}

export function InsightsPanel({ refreshKey }: { refreshKey?: number }) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"topology" | "central" | "risk">("topology");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/insights")
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setInsights(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-xs text-text-muted">{error}</p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="animate-pulse text-xs text-text-muted">Computing graph analytics...</p>
      </div>
    );
  }

  const totalNodes = insights.counts.reduce((s, c) => s + c.count, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        <TabButton
          active={tab === "topology"}
          onClick={() => setTab("topology")}
          icon={<Hash className="h-3 w-3" />}
          label="Topology"
        />
        <TabButton
          active={tab === "central"}
          onClick={() => setTab("central")}
          icon={<Award className="h-3 w-3" />}
          label="Centrality"
        />
        <TabButton
          active={tab === "risk"}
          onClick={() => setTab("risk")}
          icon={<AlertTriangle className="h-3 w-3" />}
          label="Risk"
        />
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-text-muted">
          <Activity className="h-3 w-3 text-success" />
          {totalNodes} nodes · {insights.edges} edges
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "topology" && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {insights.counts.map((c) => (
              <div key={c.label} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-lg font-bold text-text">{c.count}</p>
                <p className="text-xs text-text-muted">{c.label || "Unlabeled"}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "central" && (
          <div className="space-y-3">
            <RankingList
              title="Most connected (degree centrality)"
              items={insights.topConnected.map((t) => ({
                name: t.name,
                subtitle: t.label,
                value: `${t.degree}`,
              }))}
            />
            <RankingList
              title="Structural importance (PageRank)"
              items={insights.pageRank.map((t) => ({
                name: t.name,
                subtitle: t.label,
                value: t.score.toFixed(3),
              }))}
              muted
            />
          </div>
        )}

        {tab === "risk" && (
          <RankingList
            title="Potential single points of failure"
            items={insights.bottlenecks.map((t) => ({
              name: t.name,
              subtitle: `${t.label} · bridges ${t.bridges} clusters`,
              value: `${t.degree} links`,
              warn: true,
            }))}
            emptyText="No bottlenecks detected — the graph is well-connected."
          />
        )}
      </div>

      {/* Algorithm provenance */}
      <div className="border-t border-border px-4 py-2">
        <p className="text-[10px] text-text-muted">
          Source: {Object.entries(insights.algorithmSource).map(([k, v]) => `${k} → ${v}`).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
        active ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function RankingList({
  title,
  items,
  emptyText,
  muted,
}: {
  title: string;
  items: { name: string; subtitle: string; value: string; warn?: boolean }[];
  emptyText?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-text-muted">{emptyText || "No data."}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              className="flex items-center gap-3 rounded-lg bg-surface px-3 py-1.5 text-xs"
            >
              <span className="w-4 text-right font-mono text-text-muted">{i + 1}</span>
              <div className="flex-1">
                <p className={item.warn ? "text-warning" : muted ? "text-text/80" : "text-text/90"}>
                  {item.name}
                </p>
                <p className="text-[10px] text-text-muted">{item.subtitle}</p>
              </div>
              <span className="font-mono text-text-muted">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
