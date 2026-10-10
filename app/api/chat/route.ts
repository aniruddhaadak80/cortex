import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { isFalkorDBAvailable } from "@/lib/falkordb";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = body;

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: "Message and sessionId are required" },
        { status: 400 }
      );
    }

    const dbAvailable = await isFalkorDBAvailable();
    if (!dbAvailable) {
      return NextResponse.json(
        { error: "FalkorDB is not available. Make sure Docker is running: docker compose up -d" },
        { status: 503 }
      );
    }

    const response = await runAgent(message, sessionId);
    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[API] Chat error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
