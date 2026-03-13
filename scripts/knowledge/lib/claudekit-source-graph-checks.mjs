import path from "node:path";

import { sha256ForFile } from "./claudekit-source-graph-io.mjs";
import { validateJsonSchemaValue } from "./json-schema-lite.mjs";

const wave1NodeIds = [
  "agent.brainstormer", "agent.code_reviewer", "agent.debugger", "agent.docs_manager", "agent.git_manager",
  "agent.planner", "agent.project_manager", "agent.researcher", "agent.tester",
  "skill.ck_brainstorm", "skill.ck_code_review", "skill.ck_cook", "skill.ck_debug", "skill.ck_docs",
  "skill.ck_fix", "skill.ck_plan", "skill.ck_preview", "skill.ck_scout", "skill.ck_team", "skill.ck_test",
  "workflow.brainstorm", "workflow.cook", "workflow.debug", "workflow.fix", "workflow.plan",
  "workflow.review", "workflow.team", "workflow.test",
  "rule.development_rules", "rule.documentation_management", "rule.orchestration_protocol", "rule.primary_workflow",
  "tool_ref.ask_user_question", "tool_ref.send_message", "tool_ref.task_create", "tool_ref.task_get",
  "tool_ref.task_list", "tool_ref.task_subagent", "tool_ref.task_update", "tool_ref.team_create",
  "tool_ref.team_delete", "runtime_primitive.hook_injected_context",
  "artifact.decision_report_md", "artifact.debug_report_md", "artifact.docs_impact_report",
  "artifact.git_handoff_report", "artifact.phase_file_md", "artifact.plan_md",
  "artifact.review_report_md", "artifact.scout_report_md", "artifact.test_report_md",
  "gate.finalize_required", "gate.plan_approval", "gate.review_approval", "gate.test_pass_required"
];

const wave1Edges = [
  ["hands_off_to", "workflow.brainstorm", "workflow.plan"],
  ["hands_off_to", "workflow.plan", "workflow.cook"],
  ["hands_off_to", "workflow.debug", "workflow.fix"],
  ["hands_off_to", "workflow.review", "workflow.fix"],
  ["produces", "workflow.brainstorm", "artifact.decision_report_md"],
  ["produces", "workflow.plan", "artifact.plan_md"],
  ["produces", "workflow.plan", "artifact.phase_file_md"],
  ["produces", "workflow.review", "artifact.review_report_md"],
  ["produces", "workflow.debug", "artifact.debug_report_md"],
  ["produces", "workflow.test", "artifact.test_report_md"],
  ["gated_by", "workflow.cook", "gate.finalize_required"],
  ["gated_by", "workflow.fix", "gate.finalize_required"],
  ["hands_off_to", "gate.finalize_required", "artifact.git_handoff_report"]
];

function addError(errors, message) {
  errors.push(message);
}

function collectDuplicates(records, label, errors) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.id)) {
      addError(errors, `${label}: duplicate id "${record.id}"`);
      continue;
    }
    seen.add(record.id);
  }
  return seen;
}

function validateSourceRefs(records, label, evidenceIds, errors) {
  for (const record of records) {
    for (const ref of record.sourceRefs ?? []) {
      if (!evidenceIds.has(ref)) {
        addError(errors, `${label} ${record.id}: missing evidence ref "${ref}"`);
      }
    }
  }
}

function validateWave1Coverage(nodeIds, edges, errors) {
  for (const requiredId of wave1NodeIds) {
    if (!nodeIds.has(requiredId)) {
      addError(errors, `wave1: missing required node "${requiredId}"`);
    }
  }

  for (const [kind, from, to] of wave1Edges) {
    const found = edges.some((edge) => edge.kind === kind && edge.from === from && edge.to === to);
    if (!found) {
      addError(errors, `wave1: missing required edge ${from} ${kind} ${to}`);
    }
  }
}

export async function validateClaudekitSourceGraph(graph, { profile = "base" } = {}) {
  const errors = [];
  const warnings = [];

  validateJsonSchemaValue(graph.manifest, graph.schemas.manifest, "manifest", errors);
  graph.nodes.forEach((node, index) => validateJsonSchemaValue(node, graph.schemas.node, `nodes[${index}]`, errors));
  graph.edges.forEach((edge, index) => validateJsonSchemaValue(edge, graph.schemas.edge, `edges[${index}]`, errors));
  graph.evidence.forEach((item, index) => validateJsonSchemaValue(item, graph.schemas.evidence, `evidence[${index}]`, errors));

  const nodeIds = collectDuplicates(graph.nodes, "nodes", errors);
  const edgeIds = collectDuplicates(graph.edges, "edges", errors);
  const evidenceIds = collectDuplicates(graph.evidence, "evidence", errors);

  validateSourceRefs(graph.nodes, "node", evidenceIds, errors);
  validateSourceRefs(graph.edges, "edge", evidenceIds, errors);

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      addError(errors, `edge ${edge.id}: missing from node "${edge.from}"`);
    }
    if (!nodeIds.has(edge.to)) {
      addError(errors, `edge ${edge.id}: missing to node "${edge.to}"`);
    }
  }

  for (const item of graph.evidence) {
    const sourcePath = path.join(graph.repoRoot, item.sourcePath);
    const subjectExists = item.subjectType === "node"
      ? nodeIds.has(item.subjectId)
      : item.subjectType === "edge"
        ? edgeIds.has(item.subjectId)
        : nodeIds.has(item.subjectId) || edgeIds.has(item.subjectId);

    if (!subjectExists) {
      addError(errors, `evidence ${item.id}: missing subject "${item.subjectId}"`);
    }
    if (typeof item.lineStart !== "number" || typeof item.lineEnd !== "number") {
      addError(errors, `evidence ${item.id}: lineStart and lineEnd are required`);
    } else {
      if (item.lineStart > item.lineEnd) {
        addError(errors, `evidence ${item.id}: lineStart must be <= lineEnd`);
      }
      if (item.lineStart === 1 && item.lineEnd === 999) {
        addError(errors, `evidence ${item.id}: reserved placeholder span 1-999 is forbidden`);
      }
    }
    if (item.checksum === "seed-pending") {
      addError(errors, `evidence ${item.id}: placeholder checksum is forbidden`);
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(item.checksum)) {
      addError(errors, `evidence ${item.id}: checksum must match sha256:<64 hex>`);
      continue;
    }

    try {
      const actualChecksum = await sha256ForFile(sourcePath);
      if (actualChecksum !== item.checksum) {
        addError(errors, `evidence ${item.id}: checksum mismatch for ${item.sourcePath}`);
      }
    } catch (error) {
      addError(errors, `evidence ${item.id}: source path missing or unreadable (${item.sourcePath})`);
      warnings.push(error.message);
    }
  }

  if (profile === "wave1") {
    validateWave1Coverage(nodeIds, graph.edges, errors);
  }

  return {
    errors,
    warnings,
    summary: {
      profile,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      evidence: graph.evidence.length
    }
  };
}
