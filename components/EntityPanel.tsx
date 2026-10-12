"use client";

import { useState, useEffect } from "react";
import { X, User, GitBranch, FileText, Gavel, Server, Sparkles } from "lucide-react";

/**
 * Entity detail panel — click a node in the graph to see everything the
 * Company Brain knows about it: properties, owners, dependents, related
 * decisions and documents. Track 3: "who owns what / who knows what".
 */

interface EntityDetail {
  entity: { id: string; name: string; type: string; properties: Record<string, any> };
  degree: number;
  outgoing: { relation: string; target: string; targetType: string; targetStatus?: string; learned?: boolean }[];
  incoming: { relation: string; source: string; sourceType: string; sourceStatus?: string; learned?: boolean }[];
  owners: string[];
  relatedDecisions: { title: string; relation: string; status?: string }[];
  relatedDocuments: { title: string; relation: string; docType?: string }[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  Person: <User className="h-4 w-4" />,
  Project: <GitBranch className="h-4 w-4" />,
  Document: <FileText className="h-4 w-4" />,
  Decision: <Gavel className="h-4 w-4" />,
  System: <Server className="h-4 w-4" />,
};

interface EntityPanelProps {
  entityName: string | null;
  onClose: () => void;
}

export function EntityPanel({ entityName, onClose }: EntityPanelProps) {
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entityName) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    fetch(`/api/entity?name=${encodeURIComponent(entityName)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityName]);

  if (!entityName) return null;

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[340px] flex-col border-l border-border bg-surface/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-accent">{TYPE_ICONS[detail?.entity.type || ""]}</span>
          <div>
            <p className="text-sm font-semibold">{detail?.entity.name || entityName}</p>
            <p className="text-xs text-text-muted">
              {detail ? `${detail.entity.type} · ${detail.degree} connections` : "Loading..."}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <p className="text-xs text-text-muted animate-pulse">Querying FalkorDB...</p>
        )}
        {error && (
          <div className="rounded-lg border border-error/20 bg-error/10 p-3">
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        {detail && (
          <>
            {/* Owners */}
            {detail.owners.length > 0 && (
              <Section title="Owners & People">
                {detail.owners.map((o) => (
                  <Chip key={o} icon={<User className="h-3 w-3" />} label={o} />
                ))}
              </Section>
            )}

            {/* Properties */}
            <Section title="Properties">
              <div className="space-y-1">
                {Object.entries(detail.entity.properties)
                  .filter(([k]) => !["id", "name", "title"].includes(k))
                  .slice(0, 10)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 text-xs">
                      <span className="text-text-muted">{k}</span>
                      <span className="truncate text-right text-text/90">
                        {Array.isArray(v) ? v.join(", ") : String(v).slice(0, 60)}
                      </span>
                    </div>
                  ))}
              </div>
            </Section>

            {/* Outgoing relationships */}
            {detail.outgoing.length > 0 && (
              <Section title={`Depends on / Connects to (${detail.outgoing.length})`}>
                {detail.outgoing.slice(0, 12).map((r, i) => (
                  <RelRow
                    key={i}
                    relation={r.relation}
                    target={r.target}
                    targetType={r.targetType}
                    learned={r.learned}
                  />
                ))}
              </Section>
            )}

            {/* Incoming relationships */}
            {detail.incoming.length > 0 && (
              <Section title={`Connected from (${detail.incoming.length})`}>
                {detail.incoming.slice(0, 12).map((r, i) => (
                  <RelRow
                    key={i}
                    relation={r.relation}
                    target={r.source}
                    targetType={r.sourceType}
                    learned={r.learned}
                  />
                ))}
              </Section>
            )}

            {/* Related decisions */}
            {detail.relatedDecisions.length > 0 && (
              <Section title={`Decisions (${detail.relatedDecisions.length})`}>
                {detail.relatedDecisions.slice(0, 6).map((d, i) => (
                  <div key={i} className="rounded-lg bg-bg p-2 text-xs">
                    <p className="text-text/90">{d.title}</p>
                    <p className="mt-0.5 text-text-muted">
                      {d.relation.replace(/_/g, " ").toLowerCase()}
                      {d.status ? ` · ${d.status}` : ""}
                    </p>
                  </div>
                ))}
              </Section>
            )}

            {/* Related documents */}
            {detail.relatedDocuments.length > 0 && (
              <Section title={`Documents (${detail.relatedDocuments.length})`}>
                {detail.relatedDocuments.slice(0, 6).map((d, i) => (
                  <div key={i} className="rounded-lg bg-bg p-2 text-xs">
                    <p className="text-text/90">{d.title}</p>
                    <p className="mt-0.5 text-text-muted">
                      {d.docType || d.relation.toLowerCase()}
                    </p>
                  </div>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-text/90">
      <span className="text-accent">{icon}</span>
      {label}
    </span>
  );
}

function RelRow({
  relation,
  target,
  targetType,
  learned,
}: {
  relation: string;
  target: string;
  targetType: string;
  learned?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-bg px-2.5 py-1.5 text-xs">
      <span className="font-mono text-[10px] text-accent">
        {relation.replace(/_/g, " ").toLowerCase()}
      </span>
      <span className="text-text/90">{target}</span>
      <span className="ml-auto text-text-muted">{targetType}</span>
      {learned && (
        <span title="Learned by the agent" className="text-warning">
          <Sparkles className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}
