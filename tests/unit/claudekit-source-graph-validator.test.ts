import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadClaudekitSourceGraph, sha256ForFile } from "../../scripts/knowledge/lib/claudekit-source-graph-io.mjs";
import { validateClaudekitSourceGraph } from "../../scripts/knowledge/lib/claudekit-source-graph-checks.mjs";
import { validateJsonSchemaValue } from "../../scripts/knowledge/lib/json-schema-lite.mjs";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createFixture(options: { checksum?: string; lineStart?: number; lineEnd?: number } = {}) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "claudekit-source-graph-"));
  tempDirs.push(rootDir);

  const graphDir = path.join(rootDir, "knowledge/claudekit-source");
  await mkdir(path.join(graphDir, "schemas"), { recursive: true });
  await mkdir(path.join(rootDir, ".claude/agents"), { recursive: true });

  const sourcePath = path.join(rootDir, ".claude/agents/planner.md");
  await writeFile(sourcePath, "# Planner\n\nSeed content.\n", "utf8");

  for (const schemaName of [
    "graph-manifest.schema.json",
    "node.schema.json",
    "edge.schema.json",
    "evidence.schema.json"
  ]) {
    await cp(
      path.join(process.cwd(), "knowledge/claudekit-source/schemas", schemaName),
      path.join(graphDir, "schemas", schemaName)
    );
  }

  const checksum = options.checksum ?? await sha256ForFile(sourcePath);
  const manifest = {
    graphId: "claudekit-source",
    version: "0.1.0",
    status: "seed",
    updatedAt: "2026-03-12T00:00:00Z",
    scope: {
      sourceRoots: [".claude/agents"],
      hostNeutral: true,
      outsideCodexKitRoadmap: true
    },
    files: {
      nodes: "nodes.jsonl",
      edges: "edges.jsonl",
      evidence: "evidence.jsonl"
    },
    schemas: {
      manifest: "schemas/graph-manifest.schema.json",
      node: "schemas/node.schema.json",
      edge: "schemas/edge.schema.json",
      evidence: "schemas/evidence.schema.json"
    }
  };

  const nodes = [
    {
      id: "agent.planner",
      kind: "agent",
      name: "planner",
      title: "Planner",
      status: "active",
      sourceRefs: ["evidence.agent.planner.role"]
    }
  ];
  const evidence = [
    {
      id: "evidence.agent.planner.role",
      subjectType: "node",
      subjectId: "agent.planner",
      sourcePath: ".claude/agents/planner.md",
      lineStart: options.lineStart ?? 1,
      lineEnd: options.lineEnd ?? 2,
      checksum,
      extractionMethod: "manual-scout",
      confidence: "high"
    }
  ];

  await writeFile(path.join(graphDir, "graph-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(graphDir, "nodes.jsonl"), `${JSON.stringify(nodes[0])}\n`, "utf8");
  await writeFile(path.join(graphDir, "edges.jsonl"), "", "utf8");
  await writeFile(path.join(graphDir, "evidence.jsonl"), `${JSON.stringify(evidence[0])}\n`, "utf8");

  return graphDir;
}

describe("claudekit source graph validator", () => {
  it("passes base validation for a structurally valid graph", async () => {
    const graphDir = await createFixture();
    const graph = await loadClaudekitSourceGraph(graphDir);
    const result = await validateClaudekitSourceGraph(graph, { profile: "base" });

    expect(result.errors).toEqual([]);
  });

  it("rejects placeholder checksum and reserved placeholder span", async () => {
    const graphDir = await createFixture({
      checksum: "seed-pending",
      lineStart: 1,
      lineEnd: 999
    });
    const graph = await loadClaudekitSourceGraph(graphDir);
    const result = await validateClaudekitSourceGraph(graph, { profile: "base" });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("reserved placeholder span 1-999"),
        expect.stringContaining("placeholder checksum is forbidden")
      ])
    );
  });

  it("enforces Wave 1 completeness in wave1 profile", async () => {
    const graphDir = await createFixture();
    const graph = await loadClaudekitSourceGraph(graphDir);
    const result = await validateClaudekitSourceGraph(graph, { profile: "wave1" });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('wave1: missing required node "workflow.plan"'),
        expect.stringContaining("wave1: missing required edge workflow.brainstorm hands_off_to workflow.plan")
      ])
    );
  });

  it("accepts node ids with tool_ref and runtime_primitive prefixes", async () => {
    const schema = JSON.parse(
      await readFile(path.join(process.cwd(), "knowledge/claudekit-source/schemas/node.schema.json"), "utf8")
    );

    const toolRefErrors = validateJsonSchemaValue(
      {
        id: "tool_ref.task_create",
        kind: "tool_ref",
        name: "TaskCreate",
        title: "TaskCreate",
        status: "active",
        sourceRefs: ["evidence.tool_ref.task_create.definition"]
      },
      schema,
      "$"
    );
    const runtimeErrors = validateJsonSchemaValue(
      {
        id: "runtime_primitive.hook_injected_context",
        kind: "runtime_primitive",
        name: "hook-injected context",
        title: "Hook-Injected Context",
        status: "active",
        sourceRefs: ["evidence.runtime_primitive.hook_injected_context.definition"]
      },
      schema,
      "$"
    );

    expect(toolRefErrors).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
});
