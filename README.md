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

### Multi-Agent Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER QUESTION                                │
│                  "What breaks if auth goes down?"                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AGENT 1: MEMORY AGENT                                               │
│                                                                     │
│  • Recalls past conversations from FalkorDB (episodic memory)       │
│  • Finds relevant facts (semantic memory)                           │
│  • Loads known query patterns (procedural memory)                   │
│                                                                     │
│  Cypher:  MATCH (m:Memory) WHERE m.session_id = $sid               │
│           AND (toLower(m.content) contains $kw0 OR ...)             │
│           RETURN m.type, m.content, m.relevance                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AGENT 2: PLANNER AGENT                                              │
│                                                                     │
│  Decomposes the question into focused sub-queries:                  │
│                                                                     │
│  Sub-query A: "What systems directly depend on auth-service?"       │
│  Sub-query B: "What services transitively depend on those?"         │
│  Sub-query C: "Who is responsible for each affected service?"       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AGENT 3: RESEARCHER AGENTS (Parallel)                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Researcher A │  │ Researcher B │  │ Researcher C │              │
│  │              │  │              │  │              │              │
│  │ LLM generates│  │ LLM generates│  │ LLM generates│              │
│  │ Cypher query │  │ Cypher query │  │ Cypher query │              │
│  │      │       │  │      │       │  │      │       │              │
│  │      ▼       │  │      ▼       │  │      ▼       │              │
│  │ Executes on  │  │ Executes on  │  │ Executes on  │              │
│  │ FalkorDB     │  │ FalkorDB     │  │ FalkorDB     │              │
│  │      │       │  │      │       │  │      │       │              │
│  │      ▼       │  │      ▼       │  │      ▼       │              │
│  │ Returns      │  │ Returns      │  │ Returns      │              │
│  │ evidence     │  │ evidence     │  │ evidence     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AGENT 4: SYNTHESIZER AGENT                                          │
│                                                                     │
│  • Combines all evidence into one coherent answer                   │
│  • Shows the reasoning path (graph traversals used)                │
│  • Cites specific people, projects, and decisions                   │
│  • Stores the Q&A in memory for future sessions                     │
└─────────────────────────────────────────────────────────────────────┘
```

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
│   │   ├── chat/route.ts      # Multi-agent chat endpoint
│   │   ├── graph/route.ts     # Graph data for visualization
│   │   └── seed/route.ts      # Seed FalkorDB with company data
│   ├── page.tsx               # Main UI (chat + graph + reasoning)
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Tailwind v4 theme
├── components/
│   ├── Chat.tsx               # Chat interface with suggested questions
│   ├── GraphView.tsx          # Force-directed graph visualization
│   ├── ReasoningTrace.tsx     # Expandable agent reasoning display
│   └── Header.tsx             # Top bar with seed button
├── lib/
│   ├── agent/
│   │   ├── index.ts           # Agent orchestrator (main pipeline)
│   │   ├── planner.ts         # Planning agent (decomposition)
│   │   ├── researcher.ts      # Research agent (Cypher gen + execution)
│   │   ├── synthesizer.ts     # Answer synthesis agent
│   │   └── memory.ts          # Memory recall/storage (3 types)
│   ├── falkordb.ts            # FalkorDB client singleton
│   ├── seed-data.ts           # Rich company dataset (12 people, 8 projects, 13 systems, 12 docs, 8 decisions)
│   ├── cypher.ts              # Schema + example queries for LLM prompts
│   └── types.ts               # TypeScript interfaces
├── scripts/
│   └── seed.ts                # Standalone seed script
├── docker-compose.yml         # FalkorDB container
├── .env.example               # Environment template
└── README.md                  # This file
```

---

## Hackathon Track Mapping

### Track 1: Agents That Act on Connected Data
- **Multi-hop reasoning**: Researcher agents generate Cypher that traverses 2-3+ hops (Person → Project → System → Dependency)
- **Graph queries as tools**: Each researcher generates and executes its own Cypher
- **Tool selection**: LLM chooses the right graph pattern based on sub-question
- **Explainable results**: Every answer includes the exact Cypher queries and graph paths used

### Track 2: Agent Memory and Coordination
- **Episodic memory**: Past Q&A stored as `(:Memory {type: 'episodic'})` nodes
- **Semantic memory**: Facts extracted and stored as `(:Memory {type: 'semantic'})` nodes
- **Procedural memory**: Successful query patterns stored as `(:Memory {type: 'procedural'})` nodes
- **Shared state**: All agents read/write to the same FalkorDB graph
- **Per-session isolation**: `session_id` property on memory nodes

### Track 3: Company Brain
- **Unified knowledge**: People, teams, projects, docs, decisions, systems, technologies — all in one graph
- **Who owns what**: `WORKS_ON`, `AUTHORED`, `MADE`, `PART_OF` relationships
- **Decision tracing**: `AFFECTS` and `MADE` relationships connect decisions to people and projects
- **Current knowledge**: Status properties on projects, systems, and decisions

---

## License

MIT
