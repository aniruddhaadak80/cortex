import { FalkorDB } from "falkordb";

let client: FalkorDB | null = null;

export function getFalkorClient(): FalkorDB {
  if (!client) {
    const password = process.env.FALKORDB_PASSWORD
      ? `:${process.env.FALKORDB_PASSWORD}`
      : "";
    client = new FalkorDB(
      `redis://${password}@${process.env.FALKORDB_HOST || "localhost"}:${process.env.FALKORDB_PORT || "6379"}`
    );
  }
  return client;
}

export function getGraph() {
  return getFalkorClient().selectGraph(
    process.env.FALKORDB_GRAPH || "company"
  );
}

export async function runCypher(
  query: string,
  params?: Record<string, string | number>
): Promise<any[]> {
  const graph = getGraph();
  try {
    const result = await graph.query(query, { params });
    return result.data ?? [];
  } catch (err) {
    console.error("[FalkorDB] Query failed:", query, err);
    throw err;
  }
}

export async function isFalkorDBAvailable(): Promise<boolean> {
  try {
    await runCypher("RETURN 1");
    return true;
  } catch {
    return false;
  }
}
