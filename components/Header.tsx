"use client";

import { Brain, Database, Zap } from "lucide-react";

interface HeaderProps {
  onSeed: () => void;
  isSeeding: boolean;
}

export function Header({ onSeed, isSeeding }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
          <Brain className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Cortex</h1>
          <p className="text-xs text-text-muted">AI Company Brain &mdash; Powered by FalkorDB</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-4 text-xs text-text-muted md:flex">
          <span className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-accent" />
            FalkorDB Graph
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-warning" />
            Multi-Agent
          </span>
        </div>

        <button
          onClick={onSeed}
          disabled={isSeeding}
          className="rounded-lg bg-accent/20 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/30 disabled:opacity-50"
        >
          {isSeeding ? "Seeding..." : "Seed Database"}
        </button>
      </div>
    </header>
  );
}
