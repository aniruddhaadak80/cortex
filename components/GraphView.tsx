"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  type: string;
  status?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface GraphViewProps {
  graphKey: number;
}

const TYPE_COLORS: Record<string, string> = {
  Person: "#6366f1",
  Project: "#22c55e",
  Document: "#f59e0b",
  Decision: "#ef4444",
  System: "#06b6d4",
  Team: "#a855f7",
  Technology: "#ec4899",
  Memory: "#84cc16",
};

export function GraphView({ graphKey }: GraphViewProps) {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/graph");
      if (!res.ok) throw new Error("Failed to fetch graph");
      const data = await res.json();

      const nodes: GraphNode[] = data.nodes.map((n: any) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        status: n.status,
      }));

      const edges: GraphEdge[] = data.edges.map((e: any) => ({
        source: e.source,
        target: e.target,
        type: e.type,
      }));

      setGraphData({ nodes, edges });
    } catch (err) {
      console.error("Failed to fetch graph:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph, graphKey]);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth * 0.58,
        height: window.innerHeight * 0.6,
      });
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Render the force graph via the component
  const renderGraph = useCallback(() => {
    if (graphData.nodes.length === 0) return null;

    return (
      <ForceGraph2D
        graphData={{
          nodes: graphData.nodes.map((n) => ({ ...n })),
          links: graphData.edges.map((e) => ({ ...e })),
        }}
        nodeLabel={(n: any) => `${n.type}: ${n.label}${n.status ? ` (${n.status})` : ""}`}
        nodeColor={(n: any) => TYPE_COLORS[n.type] || "#888"}
        nodeVal={(n: any) => (n.type === "Person" ? 8 : 6)}
        linkColor={() => "rgba(255,255,255,0.15)"}
        linkWidth={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        onNodeHover={(n: any) => setHoveredNode(n || null)}
        width={dimensions.width}
        height={dimensions.height}
      />
    );
  }, [graphData]);

  return (
    <div className="relative h-full w-full">
      {/* Legend */}
      <div className="absolute left-4 top-4 z-10 rounded-lg border border-border bg-surface/90 p-3 backdrop-blur-sm">
        <p className="mb-2 text-xs font-semibold text-text-muted">Graph Legend</p>
        <div className="space-y-1">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              <span className="text-text-muted">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute right-4 top-4 z-10 rounded-lg border border-border bg-surface/90 px-3 py-2 backdrop-blur-sm">
        <p className="text-xs text-text-muted">
          <span className="font-semibold text-text">{graphData.nodes.length}</span> nodes
          <span className="mx-1.5">|</span>
          <span className="font-semibold text-text">{graphData.edges.length}</span> edges
        </p>
      </div>

      {/* Hovered node info */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-border bg-surface/90 px-3 py-2 backdrop-blur-sm">
          <p className="text-xs">
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ background: TYPE_COLORS[hoveredNode.type] || "#888" }}
            />
            <span className="font-medium text-text">{hoveredNode.label}</span>
            <span className="ml-2 text-text-muted">{hoveredNode.type}</span>
            {hoveredNode.status && (
              <span className="ml-1 text-text-muted">({hoveredNode.status})</span>
            )}
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/50">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <div className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
            Loading graph...
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-text-muted">No data in the graph</p>
            <p className="mt-1 text-xs text-text-muted">
              Click &quot;Seed Database&quot; above to populate FalkorDB
            </p>
          </div>
        </div>
      )}

      {/* Force graph canvas */}
      <div className="h-full w-full">
        {renderGraph()}
      </div>
    </div>
  );
}
