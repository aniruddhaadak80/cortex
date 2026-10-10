import { NextResponse } from "next/server";
import { getGraph } from "@/lib/falkordb";
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
} from "@/lib/seed-data";

export async function POST() {
  try {
    const graph = await getGraph();

    // Clear existing data
    await graph.query("MATCH (n) DETACH DELETE n");

    // Seed all nodes
    for (const t of teams) {
      await graph.query("CREATE (t:Team {id: $id, name: $name, description: $description})", { params: { ...t } });
    }
    for (const p of people) {
      await graph.query("CREATE (p:Person {id: $id, name: $name, role: $role, team: $team, email: $email})", { params: { ...p } });
    }
    for (const t of technologies) {
      await graph.query("CREATE (t:Technology {id: $id, name: $name, category: $category})", { params: { ...t } });
    }
    for (const s of systems) {
      await graph.query("CREATE (s:System {id: $id, name: $name, type: $type, status: $status})", { params: { ...s } });
    }
    for (const p of projects) {
      await graph.query("CREATE (p:Project {id: $id, name: $name, description: $description, status: $status})", { params: { id: p.id, name: p.name, description: p.description, status: p.status } });
    }
    for (const d of documents) {
      await graph.query("CREATE (d:Document {id: $id, title: $title, type: $type, content: $content})", { params: { ...d } });
    }
    for (const d of decisions) {
      await graph.query("CREATE (d:Decision {id: $id, title: $title, description: $description, date: $date, status: $status})", { params: { ...d } });
    }

    // Seed all relationships
    for (const [personId, projectId] of worksOn) {
      await graph.query("MATCH (p:Person {id: $personId}), (pr:Project {id: $projectId}) CREATE (p)-[:WORKS_ON]->(pr)", { params: { personId, projectId } });
    }
    for (const [personId, docId] of authored) {
      await graph.query("MATCH (p:Person {id: $personId}), (d:Document {id: $docId}) CREATE (p)-[:AUTHORED]->(d)", { params: { personId, docId } });
    }
    for (const [personId, decId] of made) {
      await graph.query("MATCH (p:Person {id: $personId}), (d:Decision {id: $decId}) CREATE (p)-[:MADE]->(d)", { params: { personId, decId } });
    }
    for (const [projectId, systemId] of projectUsesSystem) {
      await graph.query("MATCH (pr:Project {id: $projectId}), (s:System {id: $systemId}) CREATE (pr)-[:USES]->(s)", { params: { projectId, systemId } });
    }
    for (const [projectId, techId] of projectUsesTech) {
      await graph.query("MATCH (pr:Project {id: $projectId}), (t:Technology {id: $techId}) CREATE (pr)-[:USES_TECH]->(t)", { params: { projectId, techId } });
    }
    for (const [docId, projectId] of docRelatesToProject) {
      await graph.query("MATCH (d:Document {id: $docId}), (pr:Project {id: $projectId}) CREATE (d)-[:RELATES_TO]->(pr)", { params: { docId, projectId } });
    }
    for (const [decId, projectId] of decisionAffectsProject) {
      await graph.query("MATCH (d:Decision {id: $decId}), (pr:Project {id: $projectId}) CREATE (d)-[:AFFECTS]->(pr)", { params: { decId, projectId } });
    }
    for (const [personId, teamId] of personPartOfTeam) {
      await graph.query("MATCH (p:Person {id: $personId}), (t:Team {id: $teamId}) CREATE (p)-[:PART_OF]->(t)", { params: { personId, teamId } });
    }
    for (const [fromId, toId] of systemDependsOn) {
      await graph.query("MATCH (a:System {id: $fromId}), (b:System {id: $toId}) CREATE (a)-[:DEPENDS_ON]->(b)", { params: { fromId, toId } });
    }
    for (const [fromId, toId] of projectDependsOn) {
      await graph.query("MATCH (a:Project {id: $fromId}), (b:Project {id: $toId}) CREATE (a)-[:DEPENDS_ON]->(b)", { params: { fromId, toId } });
    }

    return NextResponse.json({ success: true, message: "Database seeded successfully" });
  } catch (err: any) {
    console.error("[API] Seed error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to seed database" },
      { status: 500 }
    );
  }
}
