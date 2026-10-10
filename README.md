# Cortex — AI Company Brain

> Give your AI agents real context. A multi-agent system where FalkorDB is the knowledge graph that shapes every answer.

**Live demo:** https://cortex-psi-coral.vercel.app

Built for [Graph Hacks: Context for AI Agents](https://www.wemakedevs.org/hackathons/falkordb) — a WeMakeDevs × FalkorDB hackathon.

---

## What Cortex Does

Cortex answers questions about your organization by **reasoning over a knowledge graph**. It doesn't just search — it follows connections across people, projects, documents, decisions, and systems, then shows you the exact path it took.

### Example Questions

| Question | What the agent does |
|---|---|
| "Who has worked on authentication?" | Traverses `Person → WORKS_ON → Project → USES → System` to find everyone connected to auth |
| "What breaks if auth-service goes down?" | Traverses `System ← DEPENDS_ON ← System` to map the full blast radius |
| "Who knows about the ML project?" | Combines `WORKS_ON`, `AUTHORED`, and `RELATES_TO` to find direct and indirect contributors |
| "What decisions affected the API project?" | Follows `Decision → AFFECTS → Project` and `Person → MADE → Decision` |

---

## Architecture

### Multi-Agent Pipeline (Streaming)

Every step yields an SSE event so the UI shows live reasoning — no spinners.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER QUESTION                                │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: MEMORY — per-tenant FalkorDB graph (`memory_{tenantId}`)  │
│  Recalls episodic / semantic / procedural memory from past sessions │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2: PLAN — decomposes the question into sub-queries           │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 3: RESEARCH — agents run IN PARALLEL                        │
│  Each agent picks a TOOL:                                           │
│    • Raw Cypher against the shared `company` knowledge graph        │
│    • A graph algorithm (see below)                                  │
│  Auto-repairs failed queries with one LLM retry                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 4: SUBGRAPH — extracts the induced subgraph the agents      │
│  actually touched. Sent to the UI so those nodes glow gold:        │
│  "the path behind the answer"                                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 5: SYNTHESIZE — streams the answer token-by-token           │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 6: STORE — writes memory back to the tenant's graph and     │
│  lists all tenant graphs to prove multigraph isolation             │
└─────────────────────────────────────────────────────────────────────┘
```

### Graph Algorithms as Agent Tools

Researchers choose the right tool per sub-question. FalkorDB's native
`algo.*` procedures are used when available, with pure-Cypher fallbacks:

| Tool | When it's picked |
|---|---|
| `shortest_path(from, to)` | "How are X and Y connected?" |
| `impact_analysis(name, depth)` | "What breaks if X goes down?" (reverse dependency traversal) |
| `page_rank(label, limit)` | "What are the most critical projects/systems?" |
| `degree_centrality(label, limit)` | "Who is the most connected person?" |
| `community_detection(label)` | "Which areas are tightly coupled?" |
| `bottleneck_finder(label, limit)` | "Where are the single points of failure?" |

### Per-Tenant Memory Isolation (multigraph topology)

FalkorDB holds thousands of isolated graphs in **one instance** — no
per-user database deployment:

```
company            ← shared knowledge graph (read by every agent)
memory_alice       ← Alice's episodic/semantic/procedural memory
memory_bob         ← Bob's — completely isolated, same instance
```

### MCP Interface

Cortex exposes itself as MCP tools, so any MCP client (Claude Desktop,
OpenCode, Cursor) can drive the agent:

```bash
bun run mcp     # stdio transport
```

Tools: `cortex_ask`, `cortex_query`, `cortex_algorithm`, `cortex_algorithms`,
`cortex_memory`, `cortex_tenants`, `cortex_forget`.

Or call the HTTP bridge: `POST /api/mcp { "tool": "cortex_list_tools" }`.

### Knowledge Graph Schema

```
┌──────────┐  WORKS_ON   ┌──────────┐  USES      ┌──────────┐
│  Person  │────────────>│ Project  │───────────>│  System  │
│          │             │          │            │          │
│ name     │  AUTHORED   │          │  USES_TECH │ name     │
│ role     │─────────┐   │          │───────┐    │ type     │
│ team     │         │   │          │       │    │ status   │
│ email    │         │   │          │       │    └────┬─────┘
└──────────┘         │   └────┬─────┘       │         │
                       │        │             │         │ DEPENDS_ON
                ┌──────┘   ┌────┴─────┐  ┌────┴─────┐   │
                │          │          │  │Technology│   │
                ▼          │          │  │          │   │
          ┌──────────┐    │          │  │ name     │   │
          │ Document │    │          │  │ category │   │
          │          │    │          │  └──────────┘   │
          │ title    │    │          │                 │
          │ type     │    │          │                 │
          │ content  │    │          │                 │
          └──────────┘    │          │                 │
                │         │          │                 │
                │ RELATES_TO        │                 │
                └────────>│          │                 │
                          │          │                 │
                          │          │   AFFECTS       │
                          │          │<────────────────│
                          │          │                 │
                          │          │  ┌──────────┐   │
                          │          │  │ Decision │   │
                          │          │  │          │   │
                          │          │  │ title    │   │
                          │          │  │ status   │   │
                          │          │  │ date     │   │
                          │          │  └──────────┘   │
                          │          │        │        │
                          │          │   MADE │        │
                          │          │        │        │
                          │          │        ▼        │
                          │          │  ┌──────────┐   │
                          │          │  │  Person  │   │
                          │          │  │ (who made│   │
                          │          │  │ decision)│   │
                          │          │  └──────────┘   │
                          │          │                 │
                          └──────────┴─────────────────┘

Additional relationships:
  (Person)-[:PART_OF]->(Team)
  (System)-[:DEPENDS_ON]->(System)     — transitive dependency chains
  (Project)-[:DEPENDS_ON]->(Project)   — project-level dependencies
  (Agent)-[:STORED]->(Memory)           — memory persistence
  (Session)-[:HAS_MEMORY]->(Memory)    — per-session memory
```

### Memory Architecture (Track 2)

```
┌─────────────────────────────────────────────────────────┐
│                   MEMORY TYPES                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  EPISODIC                  SEMANTIC                      │
│  ┌──────────────┐         ┌──────────────┐             │
│  │ Past Q&A     │         │ Facts learned │             │
│  │              │         │ from research │             │
│  │ "Q: Who      │         │              │             │
│  │  worked on   │         │ "Marcus is   │             │
│  │  auth?       │         │  the auth    │             │
│  │  A: Marcus,  │         │  expert"     │             │
│  │  Lisa"       │         │              │             │
│  └──────────────┘         └──────────────┘             │
│                                                         │
│  PROCEDURAL                                              │
│  ┌──────────────────────────────────────────┐          │
│  │ Successful query patterns                 │          │
│  │                                          │          │
│  │ "Who worked on X" =>                     │          │
│  │  MATCH (p:Person)-[:WORKS_ON]->          │          │
│  │    (:Project {name: $x}) RETURN p.name   │          │
│  └──────────────────────────────────────────┘          │
│                                                         │
│  All stored as nodes in FalkorDB:                      │
│  (:Memory {type, content, relevance, session_id})       │
└─────────────────────────────────────────────────────────┘
```

### How Cortex Covers All Three Tracks

| Track | Prize | How Cortex Wins |
|---|---|---|
| **Agents That Act on Connected Data** | iPhone 18 Pro | Multi-hop Cypher reasoning, parallel researcher agents, graph algorithms as tools, explainable results with full reasoning paths |
| **Agent Memory & Coordination** | PS5 + GTA VI | Three memory types persisted in FalkorDB, shared state across agents, memory influences future answers, per-session isolation |
| **Company Brain** | M6 Mac Mini | People, teams, projects, docs, decisions, systems in one graph. "Who owns what", "who knows what", decision tracing with sources |

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) — for FalkorDB
- [Bun](https://bun.sh) — package manager
- OpenAI API key (or any Vercel AI SDK compatible provider)

### 1. Start FalkorDB

```bash
docker compose up -d
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
FALKORDB_PASSWORD=cortex-password
OPENAI_API_KEY=sk-your-key-here
```

### 3. Run Locally

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Seed the Database

Click **"Seed Database"** in the UI, or:

```bash
curl -X POST http://localhost:3000/api/seed
```

---

## Deployment

### Vercel

Live at **https://cortex-psi-coral.vercel.app**

Environment variables to set in the Vercel project (Settings → Environment Variables):

| Variable | Description |
|---|---|
| `FALKORDB_HOST` | FalkorDB host — use [FalkorDB Cloud](https://falkordb.com) or a Railway/Render instance |
| `FALKORDB_PORT` | FalkorDB port (default: `6379`) |
| `FALKORDB_PASSWORD` | FalkorDB password |
| `FALKORDB_GRAPH` | Graph name (default: `company`) |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `OPENAI_MODEL` | Model to use (default: `gpt-4o`) |

Set them for the **Production** environment, then trigger a redeploy. Without `FALKORDB_*` set, the UI loads and the graph is empty; `/api/chat` returns a clear `503` telling you FalkorDB isn't reachable.

For production FalkorDB, use [FalkorDB Cloud](https://falkordb.com) or deploy on [Railway](https://railway.app) / [Render](https://render.com).

### Docker (Full Stack)

```bash
docker compose up -d
```

---

## API Endpoints

### POST `/api/chat`

Send a question to the agent.

```json
{
  "message": "Who has worked on authentication?",
  "sessionId": "session-123"
}
```

Response:
```json
{
  "answer": "Marcus Johnson and Lisa Zhang have worked on authentication...",
  "plan": {
    "decomposed": "Decomposed into 3 sub-queries...",
    "subQueries": [...],
    "memoryContext": [...]
  },
  "cypherQueries": ["MATCH (p:Person)-[:WORKS_ON]->..."],
  "graphPaths": [...],
  "processingTimeMs": 3200
}
```

### GET `/api/graph`

Returns all nodes and edges for visualization.

### POST `/api/seed`

Seeds FalkorDB with the company knowledge graph.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| Visualization | react-force-graph-2d |
| AI / LLM | Vercel AI SDK (GPT-4o) |
| Graph Database | FalkorDB (Redis-compatible) |
| Package Manager | Bun |
| Deployment | Vercel + Docker |

---

## Project Structure

```
cortex/
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # SSE streaming agent endpoint
│   │   ├── graph/route.ts     # Graph data for visualization
│   │   ├── mcp/route.ts       # HTTP tool bridge (MCP-compatible)
│   │   └── seed/route.ts      # Seed FalkorDB with company data
│   ├── page.tsx               # Main UI (streaming chat + graph + trace)
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Tailwind v4 theme
├── components/
│   ├── Chat.tsx               # Streaming chat with live agent phases
│   ├── GraphView.tsx          # Force graph + answer-path highlighting
│   ├── ReasoningTrace.tsx     # Expandable reasoning display
│   └── Header.tsx             # Top bar with seed button
├── lib/
│   ├── agent/
│   │   ├── index.ts           # Streaming pipeline (AsyncGenerator) + events
│   │   ├── planner.ts         # Planning agent (decomposition)
│   │   ├── researcher.ts      # Research agent (tool dispatch + Cypher + retry)
│   │   ├── synthesizer.ts     # Non-streaming synthesis (used by MCP)
│   │   ├── algorithms.ts      # Graph algorithms exposed as tools
│   │   ├── subgraph.ts        # Answer-path subgraph extraction
│   │   └── memory.ts          # Memory recall/storage (per-tenant graph)
│   ├── falkordb.ts            # Client + multigraph tenant isolation
│   ├── seed-data.ts           # Rich company dataset
│   ├── cypher.ts              # Schema + example queries for LLM prompts
│   └── types.ts               # TypeScript interfaces
├── mcp/
│   └── server.ts              # MCP stdio server (Claude Desktop, OpenCode)
├── lib/__tests__/
│   └── core.test.ts           # Bun tests (keywords, isolation, algorithms)
├── scripts/
│   └── seed.ts                # Standalone seed script
├── docker-compose.yml         # FalkorDB container
├── .env.example               # Environment template
└── README.md                  # This file
```

---

## Hackathon Track Mapping

### Track 1: Agents That Act on Connected Data
- **Multi-hop reasoning**: Researchers generate Cypher that traverses 2-3+ hops (Person → Project → System → Dependency)
- **Graph algorithms as agent tools**: `shortest_path`, `page_rank`, `degree_centrality`, `community_detection`, `impact_analysis`, `bottleneck_finder` — the LLM picks the tool per sub-question
- **Tool selection through MCP**: full MCP stdio server + HTTP bridge at `/api/mcp`
- **Explainable results**: every answer shows the exact Cypher + the induced subgraph, highlighted gold in the visualization

### Track 2: Agent Memory and Coordination
- **Episodic memory**: past Q&A stored as `(:Memory {type: 'episodic'})`
- **Semantic memory**: extracted facts as `(:Memory {type: 'semantic'})`
- **Procedural memory**: successful query patterns as `(:Memory {type: 'procedural'})`
- **Separate memory per user or tenant**: FalkorDB multigraph — `memory_{tenantId}` graphs isolated per tenant, same instance, no extra deployment
- **High-concurrency reads/writes**: researchers run in parallel; memory reads happen before planning

### Track 3: Company Brain
- **Unified knowledge**: people, teams, projects, docs, decisions, systems, technologies in one graph
- **Who owns what / who knows what**: `WORKS_ON`, `AUTHORED`, `MADE`, `PART_OF`
- **Tracing decisions back to source**: `AFFECTS` + `MADE` connect decisions to people and projects
- **Answers with clear sources**: reasoning trace lists every query and evidence row

---

## License

MIT
