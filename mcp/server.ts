#!/usr/bin/env bun
/**
 * Cortex MCP Server
 *
 * Exposes the Cortex agent pipeline as MCP tools so any MCP client
 * (Claude Desktop, OpenCode, Cursor, etc.) can query the company
 * knowledge graph. Track 1 criterion: "tool selection through MCP".
 *
 * Run:  bun run mcp/server.ts
 * Add to your MCP client config:
 *   { "command": "bun", "args": ["run", "mcp/server.ts"] }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runCypher, listTenantGraphs } from "../lib/falkordb";
import { runAgent } from "../lib/agent";
import { runAlgorithm, ALGORITHM_CATALOG } from "../lib/agent/algorithms";
import { memoryStats, forgetTenant } from "../lib/agent/memory";
import { assertReadOnlyCypher } from "../lib/cypher-guard";

const server = new McpServer({ name: "cortex", version: "1.0.0" });

server.tool(
  "cortex_ask",
  "Ask Cortex a natural-language question. Runs the full multi-agent pipeline (memory → plan → parallel research → subgraph → synthesis) over the company knowledge graph and returns an explainable answer with the Cypher queries used.",
  {
    message: z.string().describe("The question to ask"),
    tenant: z
      .string()
      .optional()
      .describe("Tenant ID for isolated memory (defaults to 'default')"),
  },
  async ({ message, tenant }) => {
    const response = await runAgent(message, tenant || "default");
    return {
      content: [
        {
          type: "text",
          text: [
            "## Answer",
            response.answer,
            "",
            "## Cypher queries executed",
            ...response.cypherQueries.map((q, i) => `${i + 1}. ${q}`),
            "",
            `Processed in ${(response.processingTimeMs / 1000).toFixed(1)}s`,
          ].join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "cortex_query",
  "Run raw Cypher against the shared company knowledge graph (Person, Project, Document, Decision, System, Team, Technology).",
  { cypher: z.string(), params: z.record(z.any()).optional() },
  async ({ cypher, params }) => {
    assertReadOnlyCypher(cypher);
    const rows = await runCypher(cypher, params as any);
    return {
      content: [{ type: "text", text: JSON.stringify(rows.slice(0, 100), null, 2) }],
    };
  }
);

server.tool(
  "cortex_algorithm",
  "Run a graph algorithm. Available: " +
    ALGORITHM_CATALOG.map((a) => `${a.name} (${a.params})`).join(", "),
  {
    algorithm: z.string(),
    params: z.record(z.any()).optional(),
  },
  async ({ algorithm, params }) => {
    const result = await runAlgorithm(algorithm as any, (params as any) || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ...result, rows: result.rows.slice(0, 100) }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "cortex_algorithms",
  "List the graph algorithms available as tools, with their params and when to use them.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(ALGORITHM_CATALOG, null, 2) }],
  })
);

server.tool(
  "cortex_tenants",
  "List every per-tenant FalkorDB graph in the instance (multigraph isolation — one graph per user/tenant, no extra deployment).",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await listTenantGraphs(), null, 2) }],
  })
);

server.tool(
  "cortex_memory",
  "Inspect what a tenant has remembered (episodic/semantic/procedural counts).",
  { tenant: z.string() },
  async ({ tenant }) => ({
    content: [{ type: "text", text: JSON.stringify(await memoryStats(tenant), null, 2) }],
  })
);

server.tool(
  "cortex_forget",
  "Delete all memory for a tenant (GDPR / reset).",
  { tenant: z.string() },
  async ({ tenant }) => {
    await forgetTenant(tenant);
    return { content: [{ type: "text", text: `Cleared memory for ${tenant}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[Cortex MCP] server running on stdio");
