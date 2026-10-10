import { FalkorDB } from "falkordb";

let clientPromise: Promise<FalkorDB> | null = null;

/**
 * Returns a cached FalkorDB client connection.
 * Uses `FalkorDB.connect()` — the official async factory — so the
 * connection is only established once per server process.
 */
function connectFalkorDB(): Promise<FalkorDB> {
  if (!clientPromise) {
    const options: Record<string, string | number | undefined> = {
      host: process.env.FALKORDB_HOST || "localhost",
      port: parseInt(process.env.FALKORDB_PORT || "6379", 10),
    };
    if (process.env.FALKORDB_PASSWORD) {
      options.password = process.env.FALKORDB_PASSWORD;
    }
    if (process.env.FALKORDB_USERNAME) {
      options.username = process.env.FALKORDB_USERNAME;
    }

    clientPromise = FalkorDB.connect(options as any);

    // Allow a retry if the first connection attempt fails
    clientPromise.catch(() => {
      clientPromise = null;
    });
  }
  return clientPromise;
}

export async function getGraph() {
  const client = await connectFalkorDB();
  return client.selectGraph(process.env.FALKORDB_GRAPH || "company");
}

export async function runCypher(
  query: string,
  params?: Record<string, string | number>
): Promise<Record<string, any>[]> {
  const graph = await getGraph();
  try {
    const result = await graph.query(query, { params });
    return (result.data ?? []) as Record<string, any>[];
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
