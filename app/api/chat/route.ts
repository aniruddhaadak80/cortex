import { NextRequest } from "next/server";
import { runAgentStream, type ChatTurn } from "@/lib/agent";
import { isFalkorDBAvailable } from "@/lib/falkordb";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: { message?: string; sessionId?: string; tenant?: string; history?: ChatTurn[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { message, sessionId, tenant, history } = body;
  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!(await isFalkorDBAvailable())) {
    return new Response(
      JSON.stringify({
        error:
          "FalkorDB is not reachable. Set FALKORDB_HOST/PORT/PASSWORD and make sure a FalkorDB instance is running.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Tenant isolation: memory is scoped per tenant (multigraph topology)
  const tenantId = tenant || sessionId || "default";

  // Multi-turn: only accept well-formed turns, cap at the last 6
  const safeHistory: ChatTurn[] = Array.isArray(history)
    ? history
        .filter(
          (t) =>
            t &&
            (t.role === "user" || t.role === "assistant") &&
            typeof t.content === "string"
        )
        .slice(-6)
    : [];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        for await (const event of runAgentStream(message, tenantId, safeHistory)) {
          send(event.type, event);
        }
      } catch (err: any) {
        send("error", { type: "error", message: err.message || "Stream failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
