---
title: "I Built an AI Company Brain That Thinks in Graphs — here's the architecture"
published: false
tags: hackathon, aiagents, falkordb, nextjs, typescript
canonical_url:
---

Last week I found out about the [Graph Hacks hackathon](https://www.wemakedevs.org/hackathons/falkordb) from WeMakeDevs and FalkorDB. The challenge was simple to state and hard to do well:

> Build an agent where the graph database is the context layer. Not a database you query on the side — the thing that *shapes* what the agent does.

So I built [Cortex](https://github.com/aniruddhaadak80/cortex). It's a multi-agent system that answers questions about a company by reasoning over a knowledge graph, remembers what it learned last session, and shows you the exact Cypher it ran to get there.

Here's what I built, how it works, and the parts that actually matter.

## The problem with agent context

Most AI agents I've built have the same flaw: they see fragments. Ask "who on my team has worked on auth?" and a naive RAG agent retrieves the 5 most similar chunks and hopes the answer is in there.

But that question isn't about similarity. It's about *relationships*:

```
Person → WORKS_ON → Project → USES → System
```

That's a two-hop traversal across three entity types. A vector store can't express it without you pre-baking every possible path. A graph expresses it in one query.

## The architecture: four agents, one graph

Cortex runs a pipeline where every stage reads and writes the same FalkorDB graph:

```
User Question
    → Memory Agent      (recall past sessions from the graph)
    → Planner Agent     (decompose into sub-questions)
    → Researcher Agents (parallel: generate Cypher → execute → gather evidence)
    → Synthesizer Agent (combine evidence into an answer)
    → Memory Agent      (store learnings back)
```

The bit I'm most happy with: **memory isn't a side table.** Episodic (past Q&A), semantic (facts learned), and procedural (successful query patterns) are all just `:Memory` nodes in the same graph. Recall is a Cypher query. Storage is a Cypher write. Same database your knowledge lives in.

```cypher
MATCH (m:Memory)
WHERE m.session_id = $sessionId
  AND (toLower(m.content) contains $kw0 OR toLower(m.content) contains $kw1)
RETURN m.type, m.content, m.relevance
ORDER BY m.relevance DESC
LIMIT 5
```

## A query that actually does work

Here's a real one. Ask Cortex *"what breaks if auth-service goes down?"* and one of its researchers generates:

```cypher
MATCH (s:System {name: $system})<-[:DEPENDS_ON*1..3]-(dependent:System)
RETURN dependent.name, dependent.status
```

The variable-length traversal `*1..3` walks the whole dependency chain — three levels deep — in one round trip. Then a second agent correlates who owns each affected service via `WORKS_ON`, and the synthesizer writes it up with names attached.

That's the "acts on connected data" track in one example: multi-hop reasoning, graph algorithms as tools, explainable results.

## The UI shows its work

Judges (and users, honestly) can't trust a black box. So the right panel shows:

- every sub-query the planner produced and whether it succeeded
- the exact Cypher each researcher ran
- the raw rows returned
- what memory was recalled, and its relevance score

That trace is also what made debugging this thing tractable — when the LLM generates bad Cypher, you see the failure immediately.

## Stack

Next.js 15 + React 19 + TypeScript strict, FalkorDB for the graph, Vercel AI SDK for the model calls, react-force-graph-2d to visualize the actual graph. Bun for everything else. Runs locally with one `docker compose up -d`.

## What I'd do next

Three things, if I keep going:

1. **GraphRAG hybrid retrieval** — combine embedding similarity with graph structure, so the planner can start from a fuzzy entity match instead of exact names.
2. **Write-back from the agent loop** — let the agent *add* nodes as it learns, not just read. Right now only memory writes go back in.
3. **Per-tenant isolation** — FalkorDB's multigraph topology means each tenant gets its own graph in one instance. Cortex has `session_id` but not real graph-level isolation yet.

The source is [on GitHub](https://github.com/aniruddhaadak80/cortex), MIT licensed. If you're in the hackathon, feel free to steal the planner/researcher pattern — that split is where most of the leverage is.

Questions welcome in the comments, or in the [FalkorDB Discord](https://discord.com/invite/Y2mMT9VdMy).
