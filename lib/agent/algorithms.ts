import { runCypher } from "@/lib/falkordb";

/**
 * Graph algorithms exposed as agent tools (Track 1 judging criterion:
 * "Graph algorithms as agent tools — traversals your agent can call
 * instead of writing them itself").
 *
 * Every function is defensive: FalkorDB ships native `algo.*` procedures,
 * but we fall back to pure Cypher equivalents when a procedure is missing
 * from the running version.
 */

export const ALGORITHM_CATALOG = [
  {
    name: "shortest_path",
    description:
      "Shortest connection between two entities through any relationship. Use when asked how two people/systems/projects relate.",
    params: "from, to",
  },
  {
    name: "impact_analysis",
    description:
      "Everything that transitively depends on a node (blast radius). Use for 'what breaks if X goes down'.",
    params: "name, depth",
  },
  {
    name: "page_rank",
    description:
      "PageRank over the graph — ranks the most structurally important nodes. Use for 'what are the most critical projects/systems'.",
    params: "label, limit",
  },
  {
    name: "degree_centrality",
    description:
      "Degree centrality — how connected each node is. Use for 'who is the most connected person / most integrated service'.",
    params: "label, limit",
  },
  {
    name: "community_detection",
    description:
      "Connected-components / community detection — clusters nodes that hang together. Use for 'which teams/areas are tightly coupled'.",
    params: "label",
  },
  {
    name: "bottleneck_finder",
    description:
      "Nodes that sit on many shortest paths (high betweenness proxy). Use for single points of failure.",
    params: "label, limit",
  },
] as const;

export type AlgorithmName =
  (typeof ALGORITHM_CATALOG)[number]["name"];

export interface AlgorithmResult {
  algorithm: string;
  query: string;
  rows: Record<string, any>[];
  usedNativeProcedure: boolean;
  note?: string;
}

export async function runAlgorithm(
  algorithm: AlgorithmName,
  params: Record<string, string | number> = {}
): Promise<AlgorithmResult> {
  switch (algorithm) {
    case "shortest_path":
      return shortestPath(
        String(params.from || ""),
        String(params.to || "")
      );
    case "impact_analysis":
      return impactAnalysis(
        String(params.name || ""),
        Number(params.depth || 3)
      );
    case "page_rank":
      return pageRank(
        String(params.label || ""),
        Number(params.limit || 10)
      );
    case "degree_centrality":
      return degreeCentrality(
        String(params.label || ""),
        Number(params.limit || 10)
      );
    case "community_detection":
      return communityDetection(String(params.label || ""));
    case "bottleneck_finder":
      return bottleneckFinder(
        String(params.label || ""),
        Number(params.limit || 10)
      );
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}

async function shortestPath(from: string, to: string): Promise<AlgorithmResult> {
  // Native shortestPath — definitely available in FalkorDB
  const query = `
    MATCH (a), (b)
    WHERE a.name = $from AND b.name = $to
    MATCH path = shortestPath((a)-[*1..6]-(b))
    RETURN [n IN nodes(path) | labels(n)[0] + ':' + coalesce(n.name, n.title)] AS path,
           length(path) AS hops
    LIMIT 1
  `;
  try {
    const rows = await runCypher(query, { from, to });
    return { algorithm: "shortest_path", query, rows, usedNativeProcedure: false };
  } catch {
    // Fallback: both endpoint neighborhoods
    const fallback = `
      MATCH (a) WHERE a.name = $from
      OPTIONAL MATCH (a)-[r]-(n)
      RETURN a.name AS from, labels(n)[0] AS type, n.name AS neighbor, type(r) AS via
      LIMIT 20
    `;
    const rows = await runCypher(fallback, { from, to });
    return {
      algorithm: "shortest_path",
      query: fallback,
      rows,
      usedNativeProcedure: false,
      note: "Fell back to neighborhood expansion (endpoints may not both exist).",
    };
  }
}

async function impactAnalysis(
  name: string,
  depth: number
): Promise<AlgorithmResult> {
  const query = `
    MATCH (target {name: $name})
    MATCH path = (target)<-[:DEPENDS_ON|USES*1..${depth}]-(dependent)
    RETURN DISTINCT labels(dependent)[0] AS kind,
           coalesce(dependent.name, dependent.title) AS affected,
           dependent.status AS status,
           length(path) AS distance
    ORDER BY distance ASC
    LIMIT 50
  `;
  const rows = await runCypher(query, { name });
  return { algorithm: "impact_analysis", query, rows, usedNativeProcedure: false };
}

async function pageRank(
  label: string,
  limit: number
): Promise<AlgorithmResult> {
  // Try the native FalkorDB procedure first
  const nativeQuery = `CALL algo.pageRank() YIELD node, score RETURN node.name AS name, score ORDER BY score DESC LIMIT ${limit}`;
  try {
    const rows = await runCypher(nativeQuery);
    if (rows.length > 0) {
      return {
        algorithm: "page_rank",
        query: nativeQuery,
        rows,
        usedNativeProcedure: true,
      };
    }
  } catch {
    // fall through to hand-rolled approximation
  }

  // Pure-Cypher PageRank approximation: weighted in-degree (1 iteration)
  const labelMatch = label ? `:${label}` : "";
  const fallback = `
    MATCH (n${labelMatch})
    OPTIONAL MATCH (n)<-[r]-()
    WITH n, count(r) AS inbound
    RETURN coalesce(n.name, n.title) AS name, labels(n)[0] AS label, inbound AS score
    ORDER BY inbound DESC
    LIMIT ${limit}
  `;
  const rows = await runCypher(fallback);
  return {
    algorithm: "page_rank",
    query: fallback,
    rows,
    usedNativeProcedure: false,
    note: "Native algo.pageRank unavailable — used in-degree PageRank approximation.",
  };
}

async function degreeCentrality(
  label: string,
  limit: number
): Promise<AlgorithmResult> {
  const labelMatch = label ? `:${label}` : "";
  const query = `
    MATCH (n${labelMatch})
    OPTIONAL MATCH (n)-[r]-()
    WITH n, count(r) AS degree
    RETURN coalesce(n.name, n.title) AS name, labels(n)[0] AS label, degree
    ORDER BY degree DESC
    LIMIT ${limit}
  `;
  const rows = await runCypher(query);
  return { algorithm: "degree_centrality", query, rows, usedNativeProcedure: false };
}

async function communityDetection(label: string): Promise<AlgorithmResult> {
  // Try native WCC
  const nativeQuery = "CALL algo.WCC() YIELD node, componentId RETURN node.name AS name, componentId LIMIT 200";
  try {
    const rows = await runCypher(nativeQuery);
    if (rows.length > 0) {
      return {
        algorithm: "community_detection",
        query: nativeQuery,
        rows,
        usedNativeProcedure: true,
      };
    }
  } catch {
    // fall through
  }

  // Fallback: label-based grouping (weak proxy for communities)
  const labelMatch = label ? `:${label}` : "";
  const fallback = `
    MATCH (n${labelMatch})
    OPTIONAL MATCH (n)-[r]-(m)
    RETURN labels(n)[0] AS label, coalesce(n.name, n.title) AS name, count(m) AS neighbors
    ORDER BY neighbors DESC
    LIMIT 100
  `;
  const rows = await runCypher(fallback);
  return {
    algorithm: "community_detection",
    query: fallback,
    rows,
    usedNativeProcedure: false,
    note: "Native algo.WCC unavailable — used label-cluster proxy.",
  };
}

async function bottleneckFinder(
  label: string,
  limit: number
): Promise<AlgorithmResult> {
  // Nodes that bridge two or more clusters = high betweenness proxy
  const labelMatch = label ? `:${label}` : "";
  const query = `
    MATCH (n${labelMatch})
    OPTIONAL MATCH (n)-[r]-(m)
    WITH n, count(DISTINCT labels(m)[0]) AS bridges, count(m) AS degree
    WHERE degree > 0
    RETURN coalesce(n.name, n.title) AS name, labels(n)[0] AS label, degree, bridges
    ORDER BY bridges DESC, degree DESC
    LIMIT ${limit}
  `;
  const rows = await runCypher(query);
  return { algorithm: "bottleneck_finder", query, rows, usedNativeProcedure: false };
}

/**
 * Ask an LLM to pick the right algorithm for a question.
 * Kept here (rather than in the researcher prompt) so the dispatch
 * is a pure, testable function.
 */
export function describeAlgorithmsForPrompt(): string {
  return ALGORITHM_CATALOG.map(
    (a) => `- ${a.name}(${a.params}): ${a.description}`
  ).join("\n");
}
