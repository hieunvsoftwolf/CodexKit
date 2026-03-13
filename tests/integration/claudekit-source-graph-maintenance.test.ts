import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { loadClaudekitSourceGraph } from "../../scripts/knowledge/lib/claudekit-source-graph-io.mjs";
import {
  analyzeSourceImpact,
  runWave1SmokeQueries
} from "../../scripts/knowledge/lib/claudekit-source-graph-maintenance.mjs";

describe("claudekit source graph maintenance tooling", () => {
  let graph: Awaited<ReturnType<typeof loadClaudekitSourceGraph>>;

  beforeAll(async () => {
    graph = await loadClaudekitSourceGraph(
      path.join(process.cwd(), "knowledge/claudekit-source")
    );
  });

  it("maps changed source files to impacted records", () => {
    const impact = analyzeSourceImpact(graph, [
      ".claude/skills/cook/SKILL.md",
      ".claude/skills/team/SKILL.md",
      "missing/file.md"
    ]);

    expect(impact.matchedSourcePaths).toEqual([
      ".claude/skills/cook/SKILL.md",
      ".claude/skills/team/SKILL.md"
    ]);
    expect(impact.unmatchedSourcePaths).toEqual(["missing/file.md"]);
    expect(impact.nodeIds).toEqual(
      expect.arrayContaining([
        "workflow.cook",
        "workflow.team",
        "artifact.docs_impact_report",
        "artifact.git_handoff_report",
        "gate.finalize_required"
      ])
    );
    expect(impact.edgeIds).toEqual(
      expect.arrayContaining([
        "edge.workflow.cook.gated_by.gate.finalize_required",
        "edge.workflow.team.requires.runtime_primitive.hook_injected_context",
        "edge.gate.finalize_required.hands_off_to.artifact.git_handoff_report"
      ])
    );
  });

  it("passes the wave1 smoke query set", () => {
    const results = runWave1SmokeQueries(graph);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.find((result) => result.id === "produces.workflow_plan")?.actual).toEqual(
      expect.arrayContaining(["artifact.plan_md", "artifact.phase_file_md"])
    );
    expect(results.find((result) => result.id === "uses.ask_user_question")?.actual).toEqual(
      expect.arrayContaining([
        "workflow.brainstorm",
        "workflow.fix",
        "workflow.plan",
        "workflow.review",
        "workflow.test"
      ])
    );
  });
});
