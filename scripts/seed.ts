import { getGraph } from "../lib/falkordb";
import {
  teams,
  people,
  technologies,
  systems,
  projects,
  documents,
  decisions,
  worksOn,
  authored,
  made,
  projectUsesSystem,
  projectUsesTech,
  docRelatesToProject,
  decisionAffectsProject,
  personPartOfTeam,
  systemDependsOn,
  projectDependsOn,
} from "../lib/seed-data";

async function seed() {
  const graph = await getGraph();
  console.log("Clearing existing data...");
  await graph.query("MATCH (n) DETACH DELETE n");

  console.log("Seeding teams...");
  for (const t of teams) {
    await graph.query(
      "CREATE (t:Team {id: $id, name: $name, description: $description})",
      { params: { ...t } }
    );
  }

  console.log("Seeding people...");
  for (const p of people) {
    await graph.query(
      "CREATE (p:Person {id: $id, name: $name, role: $role, team: $team, email: $email})",
      { params: { ...p } }
    );
  }

  console.log("Seeding technologies...");
  for (const t of technologies) {
    await graph.query(
      "CREATE (t:Technology {id: $id, name: $name, category: $category})",
      { params: { ...t } }
    );
  }

  console.log("Seeding systems...");
  for (const s of systems) {
    await graph.query(
      "CREATE (s:System {id: $id, name: $name, type: $type, status: $status})",
      { params: { ...s } }
    );
  }

  console.log("Seeding projects...");
  for (const p of projects) {
    await graph.query(
      "CREATE (p:Project {id: $id, name: $name, description: $description, status: $status})",
      { params: { id: p.id, name: p.name, description: p.description, status: p.status } as Record<string, string> }
    );
  }

  console.log("Seeding documents...");
  for (const d of documents) {
    await graph.query(
      "CREATE (d:Document {id: $id, title: $title, type: $type, content: $content})",
      { params: { ...d } }
    );
  }

  console.log("Seeding decisions...");
  for (const d of decisions) {
    await graph.query(
      "CREATE (d:Decision {id: $id, title: $title, description: $description, date: $date, status: $status})",
      { params: { ...d } }
    );
  }

  console.log("Creating WORKS_ON relationships...");
  for (const [personId, projectId] of worksOn) {
    await graph.query(
      "MATCH (p:Person {id: $personId}), (pr:Project {id: $projectId}) CREATE (p)-[:WORKS_ON]->(pr)",
      { params: { personId, projectId } }
    );
  }

  console.log("Creating AUTHORED relationships...");
  for (const [personId, docId] of authored) {
    await graph.query(
      "MATCH (p:Person {id: $personId}), (d:Document {id: $docId}) CREATE (p)-[:AUTHORED]->(d)",
      { params: { personId, docId } }
    );
  }

  console.log("Creating MADE relationships...");
  for (const [personId, decId] of made) {
    await graph.query(
      "MATCH (p:Person {id: $personId}), (d:Decision {id: $decId}) CREATE (p)-[:MADE]->(d)",
      { params: { personId, decId } }
    );
  }

  console.log("Creating USES (project->system) relationships...");
  for (const [projectId, systemId] of projectUsesSystem) {
    await graph.query(
      "MATCH (pr:Project {id: $projectId}), (s:System {id: $systemId}) CREATE (pr)-[:USES]->(s)",
      { params: { projectId, systemId } }
    );
  }

  console.log("Creating USES_TECH relationships...");
  for (const [projectId, techId] of projectUsesTech) {
    await graph.query(
      "MATCH (pr:Project {id: $projectId}), (t:Technology {id: $techId}) CREATE (pr)-[:USES_TECH]->(t)",
      { params: { projectId, techId } }
    );
  }

  console.log("Creating RELATES_TO relationships...");
  for (const [docId, projectId] of docRelatesToProject) {
    await graph.query(
      "MATCH (d:Document {id: $docId}), (pr:Project {id: $projectId}) CREATE (d)-[:RELATES_TO]->(pr)",
      { params: { docId, projectId } }
    );
  }

  console.log("Creating AFFECTS relationships...");
  for (const [decId, projectId] of decisionAffectsProject) {
    await graph.query(
      "MATCH (d:Decision {id: $decId}), (pr:Project {id: $projectId}) CREATE (d)-[:AFFECTS]->(pr)",
      { params: { decId, projectId } }
    );
  }

  console.log("Creating PART_OF relationships...");
  for (const [personId, teamId] of personPartOfTeam) {
    await graph.query(
      "MATCH (p:Person {id: $personId}), (t:Team {id: $teamId}) CREATE (p)-[:PART_OF]->(t)",
      { params: { personId, teamId } }
    );
  }

  console.log("Creating DEPENDS_ON (system) relationships...");
  for (const [fromId, toId] of systemDependsOn) {
    await graph.query(
      "MATCH (a:System {id: $fromId}), (b:System {id: $toId}) CREATE (a)-[:DEPENDS_ON]->(b)",
      { params: { fromId, toId } }
    );
  }

  console.log("Creating DEPENDS_ON (project) relationships...");
  for (const [fromId, toId] of projectDependsOn) {
    await graph.query(
      "MATCH (a:Project {id: $fromId}), (b:Project {id: $toId}) CREATE (a)-[:DEPENDS_ON]->(b)",
      { params: { fromId, toId } }
    );
  }

  // Verify counts
  const counts = await graph.query(
    "MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC"
  );
  console.log("\nSeed complete! Node counts:");
  for (const row of counts.data!) {
    const r = row as Record<string, any>;
    console.log(`  ${r.label}: ${r.count}`);
  }

  const relCounts = await graph.query(
    "MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC"
  );
  console.log("\nRelationship counts:");
  for (const row of relCounts.data!) {
    const r = row as Record<string, any>;
    console.log(`  ${r.type}: ${r.count}`);
  }
}

seed().catch(console.error);
