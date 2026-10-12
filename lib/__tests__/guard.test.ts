import { test, expect, describe } from "bun:test";
import {
  assertReadOnlyCypher,
  isReadOnlyCypher,
  stripCypherLiterals,
  CypherSafetyError,
  isValidEntityName,
  ALLOWED_WRITE_RELATIONS,
  MAX_CYPHER_LENGTH,
} from "@/lib/cypher-guard";
import { dedupeDiscoveries, MIN_WRITE_CONFIDENCE } from "@/lib/agent/writeback";
import type { Discovery } from "@/lib/agent/writeback";

describe("Cypher guardrail", () => {
  test("allows normal read queries", () => {
    expect(() =>
      assertReadOnlyCypher("MATCH (n:Person) RETURN n.name LIMIT 10")
    ).not.toThrow();
    expect(() =>
      assertReadOnlyCypher(
        "MATCH (a)-[:DEPENDS_ON*1..3]-(b) RETURN a, b"
      )
    ).not.toThrow();
    expect(() =>
      assertReadOnlyCypher("OPTIONAL MATCH (n) RETURN n")
    ).not.toThrow();
  });

  test("blocks DETACH DELETE", () => {
    expect(() =>
      assertReadOnlyCypher("MATCH (n) DETACH DELETE n")
    ).toThrow(CypherSafetyError);
  });

  test("blocks plain DELETE", () => {
    expect(() => assertReadOnlyCypher("MATCH (n) DELETE n")).toThrow();
  });

  test("blocks CREATE", () => {
    expect(() =>
      assertReadOnlyCypher("CREATE (n:Person {name: 'x'})")
    ).toThrow();
  });

  test("blocks MERGE", () => {
    expect(() =>
      assertReadOnlyCypher("MERGE (n:Person {name: 'x'})")
    ).toThrow();
  });

  test("blocks SET", () => {
    expect(() =>
      assertReadOnlyCypher("MATCH (n) SET n.hacked = true")
    ).toThrow();
  });

  test("blocks DROP", () => {
    expect(() => assertReadOnlyCypher("DROP ALL")).toThrow();
  });

  test("blocks statement chaining via semicolons", () => {
    expect(() =>
      assertReadOnlyCypher("MATCH (n) RETURN n; MATCH (m) DETACH DELETE m")
    ).toThrow();
  });

  test("allows trailing semicolon but not chained statements", () => {
    expect(() => assertReadOnlyCypher("MATCH (n) RETURN n;")).not.toThrow();
  });

  test("does not false-positive on property names containing clause words", () => {
    // `created_at` contains "create" as a substring but is NOT the CREATE clause
    expect(() =>
      assertReadOnlyCypher(
        "MATCH (n) WHERE n.created_at > '2020' RETURN n"
      )
    ).not.toThrow();
  });

  test("does not false-positive on strings containing destructive words", () => {
    expect(() =>
      assertReadOnlyCypher(
        "MATCH (n) WHERE n.note = 'please DELETE this file' RETURN n"
      )
    ).not.toThrow();
  });

  test("rejects queries that do not start with a read clause", () => {
    expect(() => assertReadOnlyCypher("RETURN 1 AS x WHERE")).not.toThrow(); // starts with RETURN — ok
    expect(() => assertReadOnlyCypher("foo MATCH (n) RETURN n")).toThrow();
  });

  test("rejects oversized queries", () => {
    const big = "MATCH (n) RETURN n // " + "x".repeat(MAX_CYPHER_LENGTH);
    expect(() => assertReadOnlyCypher(big)).toThrow(/exceeds/);
  });

  test("rejects empty / non-string input", () => {
    expect(() => assertReadOnlyCypher("")).toThrow();
    expect(() => assertReadOnlyCypher(null as any)).toThrow();
  });

  test("isReadOnlyCypher is non-throwing", () => {
    expect(isReadOnlyCypher("MATCH (n) RETURN n")).toBe(true);
    expect(isReadOnlyCypher("MATCH (n) DELETE n")).toBe(false);
  });

  test("stripCypherLiterals removes strings and comments", () => {
    const stripped = stripCypherLiterals(
      "MATCH (n) // DELETE everything\nWHERE n.x = 'DELETE' RETURN n"
    );
    expect(stripped).not.toContain("DELETE");
  });
});

describe("write-back validation", () => {
  test("relation whitelist contains graph-meaningful types", () => {
    expect(ALLOWED_WRITE_RELATIONS).toContain("WORKS_ON");
    expect(ALLOWED_WRITE_RELATIONS).toContain("DEPENDS_ON");
    expect(ALLOWED_WRITE_RELATIONS).toContain("OWNS");
    // No destructive types
    expect(ALLOWED_WRITE_RELATIONS as readonly string[]).not.toContain("DELETE");
  });

  test("isValidEntityName enforces bounds", () => {
    expect(isValidEntityName("auth-service")).toBe(true);
    expect(isValidEntityName("Sarah Chen")).toBe(true);
    expect(isValidEntityName("a")).toBe(false); // too short
    expect(isValidEntityName("x".repeat(100))).toBe(false); // too long
    expect(isValidEntityName("bad`name")).toBe(false); // backtick injection
    expect(isValidEntityName("bad\nname")).toBe(false); // newline injection
    expect(isValidEntityName(42)).toBe(false);
  });

  test("dedupeDiscoveries collapses duplicate triples", () => {
    const d: Discovery = {
      from: "Alice",
      relation: "WORKS_ON",
      to: "Project X",
      toType: "Project",
      confidence: 0.9,
      evidence: "docs",
    };
    const dup = { ...d, from: "alice", confidence: 0.8 }; // case-insensitive dup
    const result = dedupeDiscoveries([d, dup, { ...d, to: "Project Y" }]);
    expect(result.length).toBe(2);
  });

  test("confidence threshold is conservative", () => {
    expect(MIN_WRITE_CONFIDENCE).toBeGreaterThanOrEqual(0.7);
  });
});
