---
title: "Graph Algorithms as Agent Tools: how I built an AI Company Brain on FalkorDB"
published: false
tags: hackathon, aiagents, falkordb, nextjs, typescript, mcp
canonical_url:
---

Last week I found out about the [Graph Hacks hackathon](https://www.wemakedevs.org/hackathons/falkordb) from WeMakeDevs and FalkorDB. The challenge was simple to state and hard to do well:

> Build an agent where the graph database is the context layer. Not a database you query on the side — the thing that *shapes* what the agent does.

So I built [Cortex](https://github.com/aniruddhaadak80/cortex). It's a multi-agent system that answers questions about a company by reasoning over a knowledge graph, remembers what it learned between sessions, streams its reasoning as it works, and shows you the exact Cypher and subgraph behind every answer.

Here's what I built, how it works, and the parts that actually matter.

## The problem with agent context

Most AI agents I've built have the same flaw: they see fragments. Ask "who on my team has worked on auth?" and a naive RAG agent retrieves the 5 most similar chunks and hopes the answer is in there.

But that question isn't about similarity. It's about *relationships*:

```
Person → WORKS_ON → Project → USES → System
```

That's a two-hop traversal across three entity types. A vector store can't express it without you pre-baking every possible path. A graph expresses it in one query.

## The architecture: six phases, streamed live

Cortex runs a pipeline where every stage reads and writes the same FalkorDB knowledge graph. And because waiting on a spinner for eight seconds feels like an eternity, every phase emits an SSE event — the UI shows the agent working in real time:

```
Phase 1: MEMORY     → recall past sessions from the tenant's graph
Phase 2: PLAN       → decompose the question into focused sub-queries
Phase 3: RESEARCH   → agents run IN PARALLEL, each picking its own tool
Phase 4: SUBGRAPH   → extract the induced subgraph the agents touched
Phase 5: SYNTHESIZE → stream the answer token-by-token
Phase 6: STORE      → write memory back, prove multigraph isolation
```

Phase 3 is where things get interesting. Each researcher doesn't just generate Cypher — it picks *how* to answer. That brings me to the part I'm most proud of.

## Graph algorithms as agent tools

Every researcher gets a tool catalog and decides which one fits its sub-question:

| Tool | When it's picked |
|---|---|
| `shortest_path(from, to)` | "How are X and Y connected?" |
| `impact_analysis(name, depth)` | "What breaks if X goes down?" |
| `page_rank(label, limit)` | "What are the most critical projects?" |
| `degree_centrality(label, limit)` | "Who is the most connected person?" |
| `community_detection(label)` | "Which areas are tightly coupled?" |
| `bottleneck_finder(label, limit)` | "Where are the single points of failure?" |

FalkorDB ships native `algo.*` procedures (`algo.pageRank`, `algo.WCC`), and Cortex calls them directly — but every algorithm has a pure-Cypher fallback so a missing procedure never breaks the agent. The LLM chooses; the graph executes.

Ask *"what breaks if auth-service goes down?"* and one researcher triggers `impact_analysis`, which runs a reverse dependency traversal three levels deep in one round trip:

```cypher
MATCH (target {name: $name})
MATCH path = (target)<-[:DEPENDS_ON|USES*1..3]-(dependent)
RETURN labels(dependent)[0] AS kind,
       coalesce(dependent.name, dependent.title) AS affected,
       length(path) AS distance
ORDER BY distance ASC
```

A second agent correlates who owns each affected service via `WORKS_ON`, and the synthesizer writes it all up with names attached.

## Memory isn't a side table

Episodic (past Q&A), semantic (extracted facts), and procedural (successful query patterns) are all just `:Memory` nodes — but here's the twist: they don't live in the shared knowledge graph. They live in **per-tenant graphs** via FalkorDB's multigraph topology.

```
company          ← shared knowledge graph (read by every agent)
memory_alice     ← Alice's memories, isolated
memory_bob       ← Bob's memories, isolated
```

One FalkorDB instance. Thousands of isolated graphs. No per-user database deployment. That's the "separate memory per user or tenant" requirement solved with a graph name instead of infrastructure.

## Showing the path behind the answer

After the researchers finish, Cortex extracts the *induced subgraph* — the actual nodes and edges those queries touched — and sends it to the frontend. The visualization lights those nodes up in gold. You're not looking at a generic company graph; you're looking at the specific path that produced the answer.

## It's also an MCP server

Cortex doesn't just live in a browser. It exposes itself as MCP tools (`cortex_ask`, `cortex_query`, `cortex_algorithm`, `cortex_memory`, `cortex_tenants`, `cortex_forget`) so any MCP client — Claude Desktop, OpenCode, Cursor — can drive the agent:

```bash
bun run mcp   # stdio transport
```

There's also an HTTP bridge at `POST /api/mcp { "tool": "cortex_list_tools" }` for quick testing.

## The graph learns as you talk

Here's the part that surprised me during the build. After every answer, a
seventh phase — **Learn** — extracts the *new structural facts* the
research uncovered and merges them back into the knowledge graph:

```
(:Engineer {name: 'X'})-[:OWNS]->(:Service {name: 'auth-service', learned: true, source: 'agent'})
```

So the Company Brain genuinely grows with every conversation. Ask a good
question, and next time the graph knows something it didn't before —
with provenance stamped on every node it creates.

Which meant I had to take safety seriously. Every LLM-generated Cypher
query passes through a guardrail before it touches FalkorDB: string
literals and comments are stripped first (so `created_at` or a string
containing "DELETE" can't produce false alarms), then destructive clauses
— `CREATE`, `MERGE`, `SET`, `DELETE`, `DROP` — are rejected outright.
Semicolon-smuggling is blocked. Researchers may only read; writes happen
through trusted, whitelisted code paths. It's ~80 lines and it's the
first thing I'd add to any text-to-Cypher agent.

## Stack

Next.js 15 + React 19 + TypeScript strict. FalkorDB for everything — graph, memory, algorithm execution. Vercel AI SDK for the model calls (streaming synthesizer via `streamText`). react-force-graph-2d for the visualization. Bun for tests (`bun test`, 10 passing) and the MCP server. Runs locally with one `docker compose up -d`.

## What I'd do next

1. **GraphRAG hybrid retrieval** — combine embedding similarity with graph structure, so the planner can start from a fuzzy entity match instead of exact names.
2. **Agent write-back** — let the agent *add* knowledge nodes as it discovers them, not just memory.
3. **Community-aware planning** — run `community_detection` first and hand each researcher the subgraph of its community, cutting token cost on large graphs.

The source is [on GitHub](https://github.com/aniruddhaadak80/cortex), MIT licensed. If you're in the hackathon, feel free to steal the planner/researcher split — that's where most of the leverage is. And the algorithm-tool dispatch pattern generalizes to any graph database with procedure calls.

Questions welcome in the comments, or in the [FalkorDB Discord](https://discord.com/invite/Y2mMT9VdMy).
