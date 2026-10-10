import { NextResponse } from "next/server";
import { runCypher } from "@/lib/falkordb";

export async function GET() {
  try {
    // Get all nodes with their labels and key properties
    const nodesResult = await runCypher(`
      MATCH (n)
      RETURN id(n) AS nodeId, labels(n)[0] AS label,
             coalesce(n.name, n.title, n.id) AS name,
             n.status AS status, n.type AS type
      LIMIT 100
    `);

    // Get all relationships
    const edgesResult = await runCypher(`
      MATCH (a)-[r]->(b)
      RETURN id(a) AS source, id(b) AS target, type(r) AS type
      LIMIT 200
    `);

    const nodes = nodesResult.map((row) => ({
      id: String(row.nodeId),
      label: row.name || row.nodeId,
      type: row.label,
      status: row.status,
      nodeType: row.type,
    }));

    const edges = edgesResult.map((row) => ({
      source: String(row.source),
      target: String(row.target),
      type: row.type,
    }));

    return NextResponse.json({ nodes, edges });
  } catch (err: any) {
    console.error("[API] Graph error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch graph" },
      { status: 500 }
    );
  }
}
