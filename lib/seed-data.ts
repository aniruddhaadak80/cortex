import type {
  Person,
  Project,
  Document,
  Decision,
  System,
  Team,
  Technology,
} from "./types";

export const teams: Team[] = [
  { id: "t1", name: "Platform", description: "Core infrastructure and shared services" },
  { id: "t2", name: "Product", description: "Customer-facing features and APIs" },
  { id: "t3", name: "Data", description: "Data pipelines, analytics, and ML" },
  { id: "t4", name: "DevOps", description: "CI/CD, observability, and reliability" },
];

export const people: Person[] = [
  { id: "p1", name: "Sarah Chen", role: "CTO", team: "Platform", email: "sarah@cortex.dev" },
  { id: "p2", name: "Marcus Johnson", role: "Staff Engineer", team: "Platform", email: "marcus@cortex.dev" },
  { id: "p3", name: "Priya Patel", role: "Engineering Manager", team: "Product", email: "priya@cortex.dev" },
  { id: "p4", name: "Alex Rivera", role: "Senior Engineer", team: "Product", email: "alex@cortex.dev" },
  { id: "p5", name: "David Kim", role: "ML Engineer", team: "Data", email: "david@cortex.dev" },
  { id: "p6", name: "Elena Volkov", role: "Data Engineer", team: "Data", email: "elena@cortex.dev" },
  { id: "p7", name: "James O'Brien", role: "SRE", team: "DevOps", email: "james@cortex.dev" },
  { id: "p8", name: "Aisha Rahman", role: "Product Manager", team: "Product", email: "aisha@cortex.dev" },
  { id: "p9", name: "Tom Mueller", role: "Frontend Lead", team: "Product", email: "tom@cortex.dev" },
  { id: "p10", name: "Lisa Zhang", role: "Backend Engineer", team: "Platform", email: "lisa@cortex.dev" },
  { id: "p11", name: "Raj Gupta", role: "DevOps Engineer", team: "DevOps", email: "raj@cortex.dev" },
  { id: "p12", name: "Nina Kowalski", role: "QA Lead", team: "Product", email: "nina@cortex.dev" },
];

export const technologies: Technology[] = [
  { id: "tech1", name: "Next.js", category: "Frontend" },
  { id: "tech2", name: "React", category: "Frontend" },
  { id: "tech3", name: "TypeScript", category: "Language" },
  { id: "tech4", name: "Node.js", category: "Backend" },
  { id: "tech5", name: "Python", category: "Language" },
  { id: "tech6", name: "PostgreSQL", category: "Database" },
  { id: "tech7", name: "Redis", category: "Cache" },
  { id: "tech8", name: "Kafka", category: "Queue" },
  { id: "tech9", name: "Docker", category: "Infra" },
  { id: "tech10", name: "Kubernetes", category: "Infra" },
  { id: "tech11", name: "FalkorDB", category: "Database" },
  { id: "tech12", name: "Terraform", category: "Infra" },
  { id: "tech13", name: "GraphQL", category: "API" },
  { id: "tech14", name: "REST", category: "API" },
  { id: "tech15", name: "gRPC", category: "API" },
];

export const systems: System[] = [
  { id: "s1", name: "auth-service", type: "microservice", status: "production" },
  { id: "s2", name: "api-gateway", type: "microservice", status: "production" },
  { id: "s3", name: "payment-service", type: "microservice", status: "production" },
  { id: "s4", name: "notification-service", type: "microservice", status: "production" },
  { id: "s5", name: "search-service", type: "microservice", status: "staging" },
  { id: "s6", name: "ml-inference", type: "microservice", status: "production" },
  { id: "s7", name: "main-db", type: "database", status: "production" },
  { id: "s8", name: "cache-cluster", type: "cache", status: "production" },
  { id: "s9", name: "event-bus", type: "queue", status: "production" },
  { id: "s10", name: "web-frontend", type: "frontend", status: "production" },
  { id: "s11", name: "admin-dashboard", type: "frontend", status: "production" },
  { id: "s12", name: "k8s-cluster", type: "infra", status: "production" },
  { id: "s13", name: "ci-pipeline", type: "infra", status: "production" },
];

export const projects: Project[] = [
  { id: "pr1", name: "Nexus API", description: "Core REST/GraphQL API for all client applications", status: "active", techStack: ["Node.js", "TypeScript", "PostgreSQL", "GraphQL"] },
  { id: "pr2", name: "Auth Overhaul", description: "Migrate to OAuth 2.0 + OIDC with PKCE flow", status: "active", techStack: ["Node.js", "TypeScript", "Redis"] },
  { id: "pr3", name: "ML Recommendations", description: "Real-time product recommendations using collaborative filtering", status: "active", techStack: ["Python", "FalkorDB", "Kafka"] },
  { id: "pr4", name: "Search V2", description: "Replace Elasticsearch with vector search using pgvector", status: "paused", techStack: ["Python", "PostgreSQL", "Docker"] },
  { id: "pr5", name: "Mobile App", description: "React Native app for iOS and Android", status: "active", techStack: ["React", "TypeScript", "Node.js"] },
  { id: "pr6", name: "Observability Suite", description: "Unified logging, metrics, and tracing across all services", status: "completed", techStack: ["Terraform", "Kubernetes", "Docker"] },
  { id: "pr7", name: "Data Pipeline", description: "ETL pipeline for warehouse analytics and ML training data", status: "active", techStack: ["Python", "Kafka", "PostgreSQL"] },
  { id: "pr8", name: "Design System", description: "Component library and design tokens for all frontends", status: "completed", techStack: ["React", "TypeScript"] },
];

export const documents: Document[] = [
  { id: "d1", title: "RFC: Authentication Service Migration", type: "RFC", content: "Proposal to migrate from session-based auth to OAuth 2.0 with OIDC. Phase 1: Add OIDC provider. Phase 2: Migrate existing sessions. Phase 3: Deprecate legacy auth. Estimated effort: 3 sprints." },
  { id: "d2", title: "ADR: GraphQL Federation for Public API", type: "ADR", content: "We will use Apollo Gateway to federate GraphQL schemas across services. Each service owns its subgraph. Gateway handles composition and routing. Decision made Jan 2026 by Sarah and Marcus." },
  { id: "d3", title: "Spec: ML Recommendation Engine v2", type: "spec", content: "V2 uses graph-based collaborative filtering with FalkorDB. User-item interactions stored as edges. Real-time inference via pre-computed embeddings. Target latency: sub-50ms p99." },
  { id: "d4", title: "Meeting Notes: Q3 Architecture Review", type: "meeting-notes", content: "Attendees: Sarah, Marcus, Priya, Alex. Key decisions: 1) Adopt FalkorDB for all graph workloads. 2) Standardize on Kubernetes. 3) Sunset legacy monolith by Q4. Action items: Marcus to evaluate FalkorDB performance." },
  { id: "d5", title: "Runbook: Database Failover Procedure", type: "runbook", content: "1. Identify failed node via health checks. 2. Promote replica using pg_autoctl. 3. Update connection strings in Consul. 4. Verify application connectivity. 5. Notify incidents channel. Contact: James (primary), Raj (backup)." },
  { id: "d6", title: "Incident Report: API Outage March 2026", type: "incident-report", content: "Root cause: Connection pool exhaustion on auth-service under peak load. Impact: 15min full API outage. Fix: Increased pool size from 50 to 200, added circuit breaker. Follow-up: Add load testing to the pipeline. Owner: Marcus." },
  { id: "d7", title: "ADR: Event-Driven Architecture with Kafka", type: "ADR", content: "All inter-service async communication via Kafka. Schema registry with Avro. Dead-letter queues for failed messages. Retention: 7 days for events, 30 days for analytics." },
  { id: "d8", title: "RFC: Micro-Frontend Migration", type: "RFC", content: "Migrate web-frontend to micro-frontend architecture. Each team owns a shell plus their remotes. Shared: auth, design system, API client. Estimated 2 months. Owner: Tom." },
  { id: "d9", title: "Spec: Real-Time Notifications", type: "spec", content: "WebSocket-based notification delivery. Fallback to SSE for restricted environments. Topics: mentions, assignments, system alerts. Delivery guarantee: at-least-once." },
  { id: "d10", title: "Meeting Notes: Design System Kickoff", type: "meeting-notes", content: "Tom to lead design system initiative. Aisha to define brand tokens. Nina to audit accessibility. Timeline: 6 weeks to MVP. Tech: React + Tailwind + Storybook." },
  { id: "d11", title: "Runbook: Kubernetes Node Drain", type: "runbook", content: "1. cordon node. 2. drain with eviction timeout 5min. 3. Verify pods rescheduled. 4. Perform maintenance. 5. uncordon node. Automated via Terraform + Kubernetes provider." },
  { id: "d12", title: "ADR: Multi-Region Deployment Strategy", type: "ADR", content: "Active-passive multi-region. Primary region us-east-1, secondary eu-west-1. Data replication via Kafka maker-checker. RPO: 5min. RTO: 15min. Owned by DevOps team." },
];

export const decisions: Decision[] = [
  { id: "dec1", title: "Adopt FalkorDB for all graph workloads", description: "Use FalkorDB as the primary graph database for recommendations, knowledge graphs, and fraud detection. Replaces Neo4j for new projects.", date: "2026-01-10", status: "accepted" },
  { id: "dec2", title: "Migrate to OAuth 2.0 + OIDC", description: "Replace legacy session auth with standard OAuth 2.0. Use PKCE for public clients. Roll out over 3 phases.", date: "2026-02-01", status: "accepted" },
  { id: "dec3", title: "Sunset legacy monolith by Q4 2026", description: "Decompose the legacy Rails monolith into microservices. Last milestone: billing module migration by Oct 15.", date: "2026-03-15", status: "accepted" },
  { id: "dec4", title: "Standardize on Kubernetes for all deployments", description: "All services deployed to K8s. Docker Compose only for local dev. Terraform for infra provisioning.", date: "2026-01-20", status: "accepted" },
  { id: "dec5", title: "Adopt event-driven architecture", description: "Kafka for all async inter-service communication. Avro schemas with schema registry.", date: "2026-02-10", status: "accepted" },
  { id: "dec6", title: "Replace Elasticsearch with pgvector", description: "Consolidate search into PostgreSQL using pgvector extension. Reduces operational overhead.", date: "2026-04-01", status: "proposed" },
  { id: "dec7", title: "Multi-region active-passive setup", description: "Deploy to us-east-1 (active) and eu-west-1 (passive). 5min RPO, 15min RTO.", date: "2026-03-20", status: "accepted" },
  { id: "dec8", title: "GraphQL Federation for public API", description: "Apollo Gateway composition. Each service owns its subgraph schema.", date: "2026-01-05", status: "accepted" },
];

export const worksOn: [string, string][] = [
  ["p1", "pr1"], ["p1", "pr2"], ["p2", "pr1"], ["p2", "pr2"], ["p2", "pr6"],
  ["p3", "pr1"], ["p3", "pr5"], ["p4", "pr1"], ["p4", "pr5"], ["p4", "pr8"],
  ["p5", "pr3"], ["p5", "pr7"], ["p6", "pr7"], ["p6", "pr4"],
  ["p7", "pr6"], ["p7", "pr2"], ["p8", "pr5"], ["p8", "pr8"],
  ["p9", "pr5"], ["p9", "pr8"], ["p10", "pr1"], ["p10", "pr2"],
  ["p11", "pr6"], ["p11", "pr7"], ["p12", "pr5"], ["p12", "pr8"],
];

export const authored: [string, string][] = [
  ["p2", "d1"], ["p2", "d6"], ["p1", "d2"], ["p1", "d4"],
  ["p5", "d3"], ["p3", "d4"], ["p7", "d5"], ["p7", "d11"],
  ["p6", "d7"], ["p9", "d8"], ["p8", "d10"], ["p1", "d12"],
];

export const made: [string, string][] = [
  ["p1", "dec1"], ["p1", "dec3"], ["p2", "dec2"], ["p3", "dec8"],
  ["p7", "dec4"], ["p6", "dec5"], ["p5", "dec6"], ["p7", "dec7"],
  ["p1", "dec8"],
];

export const projectUsesSystem: [string, string][] = [
  ["pr1", "s1"], ["pr1", "s2"], ["pr1", "s7"], ["pr1", "s8"],
  ["pr2", "s1"], ["pr2", "s2"], ["pr2", "s8"],
  ["pr3", "s6"], ["pr3", "s9"], ["pr3", "s7"],
  ["pr4", "s5"], ["pr4", "s7"],
  ["pr5", "s2"], ["pr5", "s10"], ["pr5", "s1"],
  ["pr6", "s12"], ["pr6", "s13"],
  ["pr7", "s9"], ["pr7", "s7"],
  ["pr8", "s10"], ["pr8", "s11"],
];

export const projectUsesTech: [string, string][] = [
  ["pr1", "tech4"], ["pr1", "tech3"], ["pr1", "tech6"], ["pr1", "tech13"],
  ["pr2", "tech4"], ["pr2", "tech3"], ["pr2", "tech7"],
  ["pr3", "tech5"], ["pr3", "tech11"], ["pr3", "tech8"],
  ["pr4", "tech5"], ["pr4", "tech6"], ["pr4", "tech9"],
  ["pr5", "tech2"], ["pr5", "tech3"], ["pr5", "tech4"],
  ["pr6", "tech12"], ["pr6", "tech10"], ["pr6", "tech9"],
  ["pr7", "tech5"], ["pr7", "tech8"], ["pr7", "tech6"],
  ["pr8", "tech2"], ["pr8", "tech3"],
];

export const docRelatesToProject: [string, string][] = [
  ["d1", "pr2"], ["d2", "pr1"], ["d3", "pr3"], ["d4", "pr1"],
  ["d5", "pr6"], ["d6", "pr2"], ["d7", "pr1"], ["d8", "pr5"],
  ["d9", "pr4"], ["d10", "pr8"], ["d11", "pr6"], ["d12", "pr1"],
];

export const decisionAffectsProject: [string, string][] = [
  ["dec1", "pr3"], ["dec2", "pr2"], ["dec3", "pr1"], ["dec4", "pr6"],
  ["dec5", "pr7"], ["dec6", "pr4"], ["dec7", "pr6"], ["dec8", "pr1"],
];

export const personPartOfTeam: [string, string][] = [
  ["p1", "t1"], ["p2", "t1"], ["p10", "t1"],
  ["p3", "t2"], ["p4", "t2"], ["p8", "t2"], ["p9", "t2"], ["p12", "t2"],
  ["p5", "t3"], ["p6", "t3"],
  ["p7", "t4"], ["p11", "t4"],
];

export const systemDependsOn: [string, string][] = [
  ["s1", "s7"], ["s1", "s8"], ["s2", "s1"], ["s2", "s7"],
  ["s3", "s7"], ["s3", "s8"], ["s4", "s9"], ["s5", "s7"],
  ["s6", "s7"], ["s6", "s8"], ["s10", "s2"], ["s11", "s2"],
];

export const projectDependsOn: [string, string][] = [
  ["pr3", "pr7"], ["pr5", "pr1"], ["pr4", "pr7"],
];
