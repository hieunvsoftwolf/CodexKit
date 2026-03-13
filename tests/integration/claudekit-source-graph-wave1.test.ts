import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { loadClaudekitSourceGraph } from "../../scripts/knowledge/lib/claudekit-source-graph-io.mjs";

function hasEdge(graph, kind: string, from: string, to: string) {
  return graph.edges.some((edge) => edge.kind === kind && edge.from === from && edge.to === to);
}

function outgoing(graph, from: string, kind: string) {
  return graph.edges
    .filter((edge) => edge.kind === kind && edge.from === from)
    .map((edge) => edge.to)
    .sort();
}

describe("claudekit source graph wave1 query contract", () => {
  let graph: Awaited<ReturnType<typeof loadClaudekitSourceGraph>>;

  beforeAll(async () => {
    graph = await loadClaudekitSourceGraph(
      path.join(process.cwd(), "knowledge/claudekit-source")
    );
  });

  it("resolves the canonical workflow handoff chain", () => {
    expect(hasEdge(graph, "hands_off_to", "workflow.brainstorm", "workflow.plan")).toBe(true);
    expect(hasEdge(graph, "hands_off_to", "workflow.plan", "workflow.cook")).toBe(true);
    expect(hasEdge(graph, "hands_off_to", "workflow.debug", "workflow.fix")).toBe(true);
    expect(hasEdge(graph, "hands_off_to", "workflow.review", "workflow.fix")).toBe(true);
    expect(hasEdge(graph, "hands_off_to", "gate.finalize_required", "artifact.git_handoff_report")).toBe(true);
  });

  it("resolves core workflow outputs", () => {
    expect(outgoing(graph, "workflow.brainstorm", "produces")).toContain("artifact.decision_report_md");
    expect(outgoing(graph, "workflow.plan", "produces")).toEqual(
      expect.arrayContaining(["artifact.plan_md", "artifact.phase_file_md"])
    );
    expect(outgoing(graph, "workflow.review", "produces")).toContain("artifact.review_report_md");
    expect(outgoing(graph, "workflow.debug", "produces")).toContain("artifact.debug_report_md");
    expect(outgoing(graph, "workflow.test", "produces")).toContain("artifact.test_report_md");
  });

  it("resolves interactive entrypoints and task/runtime dependencies", () => {
    expect(outgoing(graph, "workflow.brainstorm", "uses")).toContain("tool_ref.ask_user_question");
    expect(outgoing(graph, "workflow.plan", "uses")).toContain("tool_ref.ask_user_question");
    expect(outgoing(graph, "workflow.review", "uses")).toContain("tool_ref.ask_user_question");
    expect(outgoing(graph, "workflow.fix", "uses")).toContain("tool_ref.ask_user_question");
    expect(outgoing(graph, "workflow.test", "uses")).toContain("tool_ref.ask_user_question");

    expect(outgoing(graph, "workflow.cook", "uses")).toEqual(
      expect.arrayContaining([
        "tool_ref.task_create",
        "tool_ref.task_get",
        "tool_ref.task_list",
        "tool_ref.task_subagent",
        "tool_ref.task_update"
      ])
    );

    expect(outgoing(graph, "workflow.team", "uses")).toEqual(
      expect.arrayContaining([
        "tool_ref.team_create",
        "tool_ref.team_delete",
        "tool_ref.task_create",
        "tool_ref.task_subagent",
        "tool_ref.send_message"
      ])
    );
    expect(outgoing(graph, "workflow.team", "requires")).toContain("runtime_primitive.hook_injected_context");
  });

  it("resolves finalize and approval gates", () => {
    expect(outgoing(graph, "workflow.cook", "gated_by")).toEqual(
      expect.arrayContaining([
        "gate.finalize_required",
        "gate.plan_approval",
        "gate.review_approval",
        "gate.test_pass_required"
      ])
    );
    expect(outgoing(graph, "workflow.fix", "gated_by")).toContain("gate.finalize_required");
  });
});
