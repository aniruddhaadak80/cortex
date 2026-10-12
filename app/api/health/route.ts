import { NextResponse } from "next/server";
import { isFalkorDBAvailable, listTenantGraphs, runCypher } from "@/lib/falkordb";

/**
 * GET /api/health
 *
 * Quick diagnostic for judges and CI: is FalkorDB reachable, what graphs
 * exist (multigraph isolation visible at a glance), and how big is each.
 */
export async function GET() {
  const dbUp = await isFalkorDBAvailable();

  if (!dbUp) {
    return NextResponse.json(
      {
        status: "degraded",
        falkordb: false,
        hint: "Set FALKORDB_HOST / FALKORDB_PORT / FALKORDB_PASSWORD and ensure a FalkorDB instance is publicly reachable.",
      },
      { status: 200 } // 200 with status field — this is a diagnostic, not an error
    );
  }

  const graphs = await listTenantGraphs();

  let knowledgeNodes = 0;
  try {
    const rows = await runCypher("MATCH (n) RETURN count(n) AS c");
    knowledgeNodes = Number(rows[0]?.c ?? 0);
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    status: "ok",
    falkordb: true,
    graphs,
    knowledgeGraphNodes: knowledgeNodes,
  });
}
