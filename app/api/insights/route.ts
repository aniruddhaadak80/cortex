import { NextResponse } from "next/server";
import { runCypher, isFalkorDBAvailable } from "@/lib/falkordb";
import { runAlgorithm } from "@/lib/agent/algorithms";

/**
 * GET /api/insights
 *
 * Live graph analytics computed with the same algorithm tools the agents
 * use — Track 1 criterion: "graph algorithms as agent tools". The panel
 * shows what the algorithms see without the user having to ask.
 */
export async function GET() {
  if (!(await isFalkorDBAvailable())) {
    return NextResponse.json({ error: "FalkorDB is not reachable" }, { status: 503 });
  }

  try {
    // Node counts by label
    const countRows = await runCypher(
      `MATCH (n)
       WITH labels(n)[0] AS label, count(n) AS cnt
       RETURN label, cnt ORDER BY cnt DESC`
    );
    const counts = countRows.map((r) => ({ label: r.label, count: Number(r.count ?? r.cnt) }));

    const edgeRows = await runCypher(
      `MATCH ()-[r]->() RETURN count(r) AS edges`
    );
    const edges = Number(edgeRows[0]?.edges ?? 0);

    // Algorithms (native procedures with Cypher fallbacks inside)
    const [central, bottlenecks, rank] = await Promise.all([
      runAlgorithm("degree_centrality", { limit: 8 }).catch(() => null),
      runAlgorithm("bottleneck_finder", { limit: 5 }).catch(() => null),
      runAlgorithm("page_rank", { limit: 8 }).catch(() => null),
    ]);

    return NextResponse.json({
      counts,
      edges,
      topConnected: (central?.rows ?? []).map((r) => ({
        name: r.name,
        label: r.label,
        degree: Number(r.degree ?? 0),
      })),
      bottlenecks: (bottlenecks?.rows ?? []).map((r) => ({
        name: r.name,
        label: r.label,
        degree: Number(r.degree ?? 0),
        bridges: Number(r.bridges ?? 0),
      })),
      pageRank: (rank?.rows ?? []).map((r) => ({
        name: r.name,
        label: r.label,
        score: Number(r.score ?? 0),
      })),
      algorithmSource: {
        degree_centrality: central?.usedNativeProcedure ? "native algo.*" : "pure Cypher",
        bottleneck_finder: bottlenecks?.usedNativeProcedure
          ? "native algo.*"
          : "pure Cypher",
        page_rank: rank?.usedNativeProcedure ? "native algo.*" : "pure Cypher (in-degree approx)",
      },
    });
  } catch (err: any) {
    console.error("[API] Insights error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to compute insights" },
      { status: 500 }
    );
  }
}
