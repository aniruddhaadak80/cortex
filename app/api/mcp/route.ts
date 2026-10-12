import { NextRequest, NextResponse } from "next/server";
import { runCypher, isFalkorDBAvailable, listTenantGraphs } from "@/lib/falkordb";
import { ALGORITHM_CATALOG, runAlgorithm } from "@/lib/agent/algorithms";
import { runAgent } from "@/lib/agent";
import { memoryStats } from "@/lib/agent/memory";
import { assertReadOnlyCypher } from "@/lib/cypher-guard";

/**
 * MCP-style HTTP bridge.
 *
 * Exposes Cortex's capabilities as a tool-callable interface so any MCP
 * client (Claude Desktop, OpenCode, Cursor) can drive the agent without
 * the UI. Track 1 criterion: "tool selection through MCP".
 *
 * POST /api/mcp  { tool, arguments }
 */
export async function POST(request: NextRequest) {
  if (!(await isFalkorDBAvailable())) {
    return NextResponse.json(
      { error: "FalkorDB is not reachable" },
      { status: 503 }
    );
  }

  let payload: { tool?: string; arguments?: Record<string, any> };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tool, arguments: args = {} } = payload;

  try {
    switch (tool) {
      case "cortex_list_tools":
        return NextResponse.json({
          tools: [
            {
              name: "cortex_ask",
              description: "Run the full multi-agent pipeline over the company knowledge graph.",
              inputSchema: { message: "string", tenant: "string (optional)" },
            },
            {
              name: "cortex_query",
              description: "Run raw Cypher against the shared company knowledge graph.",
              inputSchema: { cypher: "string", params: "object (optional)" },
            },
            {
              name: "cortex_algorithm",
              description: "Run a graph algorithm on the knowledge graph.",
              inputSchema: {
                algorithm: ALGORITHM_CATALOG.map((a) => a.name),
                params: "object (optional)",
              },
            },
            {
              name: "cortex_algorithms",
              description: "List available graph algorithms.",
              inputSchema: {},
            },
            {
              name: "cortex_memory",
              description: "Inspect what a tenant has remembered.",
              inputSchema: { tenant: "string" },
            },
            {
              name: "cortex_tenants",
              description: "List per-tenant isolated FalkorDB graphs.",
              inputSchema: {},
            },
          ],
        });

      case "cortex_ask": {
        if (!args.message) {
          return NextResponse.json({ error: "message is required" }, { status: 400 });
        }
        const response = await runAgent(
          String(args.message),
          String(args.tenant || "default")
        );
        return NextResponse.json({ response });
      }

      case "cortex_query": {
        if (!args.cypher) {
          return NextResponse.json({ error: "cypher is required" }, { status: 400 });
        }
        // External input — enforce read-only before touching the graph.
        assertReadOnlyCypher(String(args.cypher));
        const rows = await runCypher(
          String(args.cypher),
          (args.params as Record<string, string | number>) || undefined
        );
        return NextResponse.json({ rows: rows.slice(0, 100) });
      }

      case "cortex_algorithm": {
        if (!args.algorithm) {
          return NextResponse.json({ error: "algorithm is required" }, { status: 400 });
        }
        const result = await runAlgorithm(
          args.algorithm as any,
          (args.params as Record<string, string | number>) || {}
        );
        return NextResponse.json({
          result: { ...result, rows: result.rows.slice(0, 100) },
        });
      }

      case "cortex_algorithms":
        return NextResponse.json({ algorithms: ALGORITHM_CATALOG });

      case "cortex_memory":
        return NextResponse.json({
          stats: await memoryStats(String(args.tenant || "default")),
        });

      case "cortex_tenants":
        return NextResponse.json({ graphs: await listTenantGraphs() });

      default:
        return NextResponse.json(
          { error: `Unknown tool: ${tool}. Use cortex_list_tools to discover tools.` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Tool execution failed" },
      { status: 500 }
    );
  }
}
