export const GRAPH_SCHEMA = `
NODE LABELS:
- Person {id, name, role, team, email}
- Project {id, name, description, status}
- Document {id, title, type, content}
- Decision {id, title, description, date, status}
- System {id, name, type, status}
- Team {id, name, description}
- Technology {id, name, category}
- Memory {id, type, content, relevance, timestamp}

RELATIONSHIP TYPES:
- (Person)-[:WORKS_ON]->(Project)
- (Person)-[:AUTHORED]->(Document)
- (Person)-[:MADE]->(Decision)
- (Person)-[:PART_OF]->(Team)
- (Project)-[:USES]->(System)
- (Project)-[:USES_TECH]->(Technology)
- (Project)-[:DEPENDS_ON]->(Project)
- (Document)-[:RELATES_TO]->(Project)
- (Decision)-[:AFFECTS]->(Project)
- (System)-[:DEPENDS_ON]->(System)
- (Agent)-[:STORED]->(Memory)
- (Session)-[:HAS_MEMORY]->(Memory)
`;

export const EXAMPLE_QUERIES = `
EXAMPLE QUERIES:

-- Who worked on a project that uses a specific system?
MATCH (p:Person)-[:WORKS_ON]->(pr:Project)-[:USES]->(s:System {name: $system})
RETURN p.name, p.role, pr.name

-- What systems does a project depend on (transitively)?
MATCH path = (pr:Project {name: $project})-[:USES|DEPENDS_ON*]->(s:System)
RETURN [n IN nodes(path) | labels(n)[0] + ': ' + coalesce(n.name, n.title)] AS path

-- Who knows about a topic (authored related docs or worked on related projects)?
MATCH (p:Person) WHERE (p)-[:AUTHORED]->(:Document)-[:RELATES_TO]->(:Project {name: $project})
   OR (p)-[:WORKS_ON]->(:Project {name: $project})
RETURN DISTINCT p.name, p.role, p.team

-- What decisions affect a project and who made them?
MATCH (d:Decision)-[:AFFECTS]->(pr:Project {name: $project})<-[:MADE]-(p:Person)
RETURN d.title, d.status, p.name, d.date

-- Find the shortest connection between two people through projects
MATCH path = shortestPath((a:Person {name: $person1})-[:WORKS_ON|AUTHORED*]-(b:Person {name: $person2}))
RETURN [n IN nodes(path) | coalesce(n.name, n.title)] AS connection_path

-- What breaks if a service goes down (impact analysis)?
MATCH (s:System {name: $system})<-[:DEPENDS_ON*1..3]-(dependent:System)
RETURN dependent.name, dependent.status

-- Team expertise: who has the most project experience?
MATCH (p:Person)-[:WORKS_ON]->(pr:Project)
WITH p, count(pr) AS projects
RETURN p.name, p.role, p.team, projects ORDER BY projects DESC

-- Knowledge graph: docs and decisions for a project
MATCH (pr:Project {name: $project})
OPTIONAL MATCH (d:Document)-[:RELATES_TO]->(pr)
OPTIONAL MATCH (dec:Decision)-[:AFFECTS]->(pr)
RETURN pr.name, collect(DISTINCT d.title) AS docs, collect(DISTINCT dec.title) AS decisions

-- Graph algorithms: PageRank on project collaboration
CALL gds.pageRank.stream('collaboration')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS project, score
ORDER BY score DESC
`;
