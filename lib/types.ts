export interface Person {
  id: string;
  name: string;
  role: string;
  team: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed" | "archived";
  techStack: string[];
}

export interface Document {
  id: string;
  title: string;
  type: "RFC" | "spec" | "meeting-notes" | "ADR" | "runbook" | "incident-report";
  content: string;
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  date: string;
  status: "proposed" | "accepted" | "superseded" | "deprecated";
}

export interface System {
  id: string;
  name: string;
  type: "microservice" | "database" | "queue" | "cache" | "frontend" | "infra";
  status: "production" | "staging" | "development" | "retired";
}

export interface Team {
  id: string;
  name: string;
  description: string;
}

export interface Technology {
  id: string;
  name: string;
  category: string;
}

export interface SubQuery {
  id: string;
  question: string;
  reasoning: string;
  cypherQuery?: string;
  /** Which graph algorithm (if any) the researcher chose as its tool. */
  algorithm?: string;
  results?: any[];
  status: "pending" | "running" | "done" | "failed";
  error?: string;
  evidence?: string;
}

export interface AgentPlan {
  originalQuestion: string;
  decomposed: string;
  subQueries: SubQuery[];
  memoryContext: MemoryEntry[];
}

export interface MemoryEntry {
  type: "episodic" | "semantic" | "procedural";
  content: string;
  relevance: number;
  sessionId: string;
  timestamp: string;
}

export interface AgentResponse {
  answer: string;
  plan: AgentPlan;
  cypherQueries: string[];
  graphPaths: GraphPath[];
  processingTimeMs: number;
}

export interface GraphPath {
  nodes: { id: string; label: string; type: string }[];
  edges: { from: string; to: string; type: string }[];
}
