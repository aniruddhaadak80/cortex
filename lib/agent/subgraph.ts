import { runCypher } from "@/lib/falkordb";

/**
 * Subgraph extraction — Track 1 criterion: "show the path behind an answer".
 *
 * After the researchers finish, we ask the graph for the actual nodes and
 * edges those queries touched, so the UI can light them up instead of just
 * showing a generic graph.
 */
export interface SubgraphNode {
  id: string;
  label: string;
  type: string;
  status?: string;
}

export interface SubgraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface Subgraph {
  nodes: SubgraphNode[];
  edges: SubgraphEdge[];
  truncated: boolean;
}

export async function extractSubgraphForAnswer(
  resultValues: Record<string, any>[]
): Promise<Subgraph> {
  const names = new Set<string>();
  const kinds = new Set<string>();

  for (const row of resultValues) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string" && value.length > 1 && value.length < 80) {
        // Skip obvious non-entity values
        if (/^[a-z0-9-]+$/i.test(value) || value.includes(" ")) {
          names.add(value);
        }
      }
      if (key === "label" || key === "kind" || key === "type") {
        if (typeof value === "string") kinds.add(value);
      }
    }
  }

  if (names.size === 0) return { nodes: [], edges: [], truncated: false };

  const nameList = Array.from(names).slice(0, 15);

  // Pull the induced subgraph: nodes matching the names, plus edges
  // between any two of them.
  const query = `
    MATCH (a)
    WHERE coalesce(a.name, a.title) IN $names
    OPTIONAL MATCH (a)-[r]-(b)
    WHERE coalesce(b.name, b.title) IN $names
    RETURN DISTINCT id(a) AS aId,
           coalesce(a.name, a.title) AS aName,
           labels(a)[0] AS aType,
           a.status AS aStatus,
           type(r) AS rel,
           id(b) AS bId,
           coalesce(b.name, b.title) AS bName,
           labels(b)[0] AS bType
    LIMIT 120
  `;

  const rows = await runCypher(query, { names: nameList });

  const nodeMap = new Map<string, SubgraphNode>();
  const edgeMap = new Map<string, SubgraphEdge>();

  for (const row of rows) {
    if (row.aId != null) {
      nodeMap.set(String(row.aId), {
        id: String(row.aId),
        label: row.aName || String(row.aId),
        type: row.aType || "Node",
        status: row.aStatus || undefined,
      });
    }
    if (row.bId != null) {
      nodeMap.set(String(row.bId), {
        id: String(row.bId),
        label: row.bName || String(row.bId),
        type: row.bType || "Node",
      });
    }
    if (row.rel && row.aId != null && row.bId != null) {
      const key = `${row.aId}-${row.rel}-${row.bId}`;
      const revKey = `${row.bId}-${row.rel}-${row.aId}`;
      if (!edgeMap.has(key) && !edgeMap.has(revKey)) {
        edgeMap.set(key, {
          source: String(row.aId),
          target: String(row.bId),
          type: row.rel,
        });
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
    truncated: nodeMap.size >= 120,
  };
}

/**
 * Direct lookup for "the path between X and Y" style questions —
 * used when the answer mentions two specific entities.
 */
export async function findPathBetween(
  fromName: string,
  toName: string,
  maxDepth = 6
): Promise<Subgraph> {
  const query = `
    MATCH (a), (b)
    WHERE coalesce(a.name, a.title) = $from AND coalesce(b.name, b.title) = $to
    MATCH path = shortestPath((a)-[*${maxDepth}]-(b))
    UNWIND nodes(path) AS n
    WITH collect(DISTINCT n) AS ns, path
    UNWIND relationships(path) AS r
    RETURN ns, collect(DISTINCT r) AS rs, length(path) AS hops
    LIMIT 1
  `;

  try {
    const rows = await runCypher(query, { from: fromName, to: toName });
    if (!rows.length || !rows[0].ns) {
      return { nodes: [], edges: [], truncated: false };
    }

    const nodes: SubgraphNode[] = [];
    const edges: SubgraphEdge[] = [];
    const nodeIds = new Set<string>();

    for (const n of rows[0].ns as any[]) {
      if (!n || !n.identity) continue;
      const id = String(n.identity);
      nodeIds.add(id);
      const props = n.properties || {};
      nodes.push({
        id,
        label: props.name || props.title || id,
        type: n.labels?.[0] || "Node",
        status: props.status,
      });
    }

    for (const r of rows[0].rs as any[]) {
      if (!r) continue;
      const src = String(r.start?.identity ?? r.start_vertex?.identity ?? "");
      const dst = String(r.end?.identity ?? r.end_vertex?.identity ?? "");
      if (src && dst) {
        edges.push({ source: src, target: dst, type: r.relation || r.type || "REL" });
      }
    }

    return { nodes, edges, truncated: false };
  } catch {
    return { nodes: [], edges: [], truncated: false };
  }
}
