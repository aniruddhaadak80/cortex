import { NextRequest, NextResponse } from "next/server";
import { runCypher, isFalkorDBAvailable } from "@/lib/falkordb";

/**
 * GET /api/entity?name=<entity>
 *
 * Entity detail for the "Company Brain" panel — Track 3 criterion:
 * "who owns what / who knows what" and "tracing decisions back to source".
 * Click any node in the visualization to see its properties, owner,
 * dependents, related decisions and documents.
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name query param is required" }, { status: 400 });
  }
  if (!(await isFalkorDBAvailable())) {
    return NextResponse.json({ error: "FalkorDB is not reachable" }, { status: 503 });
  }

  try {
    // 1. The entity itself
    const entityRows = await runCypher(
      `MATCH (e) WHERE coalesce(e.name, e.title) = $name
       RETURN properties(e) AS props, labels(e)[0] AS type, id(e) AS id
       LIMIT 1`,
      { name }
    );

    if (entityRows.length === 0) {
      return NextResponse.json({ error: `No entity named "${name}" in the graph` }, {
        status: 404,
      });
    }

    const props = (entityRows[0].props || {}) as Record<string, any>;
    const type = entityRows[0].type as string;

    // 2. Relationships in both directions — two explicit queries so we
    // never depend on startNode()/endNode() support in the server version.
    const outRows = await runCypher(
      `MATCH (e)-[r]->(m) WHERE coalesce(e.name, e.title) = $name
       RETURN type(r) AS rel,
              properties(m) AS mProps,
              labels(m)[0] AS mType,
              coalesce(m.name, m.title) AS mName
       LIMIT 100`,
      { name }
    );

    const inRows = await runCypher(
      `MATCH (m)-[r]->(e) WHERE coalesce(e.name, e.title) = $name
       RETURN type(r) AS rel,
              properties(m) AS mProps,
              labels(m)[0] AS mType,
              coalesce(m.name, m.title) AS mName
       LIMIT 100`,
      { name }
    );

    const relRows: Record<string, any>[] = [
      ...outRows.map((r): Record<string, any> => ({ ...r, outgoing: true })),
      ...inRows.map((r): Record<string, any> => ({ ...r, outgoing: false })),
    ];

    const outgoing = relRows
      .filter((r) => r.outgoing)
      .map((r) => ({
        relation: r.rel,
        target: r.mName,
        targetType: r.mType,
        targetStatus: r.mProps?.status,
        learned: r.mProps?.learned === true,
      }));

    const incoming = relRows
      .filter((r) => !r.outgoing)
      .map((r) => ({
        relation: r.rel,
        source: r.mName,
        sourceType: r.mType,
        sourceStatus: r.mProps?.status,
        learned: r.mProps?.learned === true,
      }));

    // 3. Convenience groupings the UI renders directly
    const owners = relRows
      .filter(
        (r) =>
          r.mType === "Person" &&
          ["OWNS", "WORKS_ON", "LEADS", "MADE", "AUTHORED", "RESPONSIBLE_FOR"].includes(
            r.rel
          )
      )
      .map((r) => r.mName);

    const relatedDecisions = relRows
      .filter((r) => r.mType === "Decision")
      .map((r) => ({ title: r.mName, relation: r.rel, status: r.mProps?.status }));

    const relatedDocuments = relRows
      .filter((r) => r.mType === "Document")
      .map((r) => ({ title: r.mName, relation: r.rel, docType: r.mProps?.type }));

    const dependencies = relRows
      .filter((r) => r.rel === "DEPENDS_ON" || r.rel === "USES")
      .map((r) => ({
        direction: r.outgoing ? "depends-on" : "depended-by",
        target: r.outgoing ? r.mName : null,
        source: r.outgoing ? null : r.mName,
        targetType: r.mType,
      }));

    return NextResponse.json({
      entity: {
        id: String(entityRows[0].id),
        name: props.name || props.title || name,
        type,
        properties: props,
      },
      degree: relRows.length,
      outgoing,
      incoming,
      owners: Array.from(new Set(owners)),
      relatedDecisions,
      relatedDocuments,
      dependencies,
    });
  } catch (err: any) {
    console.error("[API] Entity error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load entity" },
      { status: 500 }
    );
  }
}
