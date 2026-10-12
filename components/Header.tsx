"use client";

import { Brain, Database, Zap, Users } from "lucide-react";

interface HeaderProps {
  onSeed: () => void;
  isSeeding: boolean;
  tenant: string;
  onTenantChange: (t: string) => void;
}

const PRESET_TENANTS = ["demo", "acme-corp", "globex", "initech"];

export function Header({ onSeed, isSeeding, tenant, onTenantChange }: HeaderProps) {
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
        <div className="hidden items-center gap-4 text-xs text-text-muted lg:flex">
          <span className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-accent" />
            FalkorDB Graph
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-warning" />
            Multi-Agent
          </span>
        </div>

        {/* Tenant switcher — one FalkorDB instance, isolated memory per tenant */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-1.5">
          <Users className="h-3.5 w-3.5 text-accent" />
          <label htmlFor="tenant" className="sr-only">
            Tenant
          </label>
          <input
            id="tenant"
            list="tenant-presets"
            value={tenant}
            onChange={(e) => onTenantChange(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "_"))}
            className="w-28 bg-transparent text-xs text-text outline-none placeholder:text-text-muted"
            placeholder="tenant-id"
          />
          <datalist id="tenant-presets">
            {PRESET_TENANTS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <span
            title="Memory graphs are isolated per tenant via FalkorDB multigraph"
            className="h-1.5 w-1.5 rounded-full bg-success"
          />
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
