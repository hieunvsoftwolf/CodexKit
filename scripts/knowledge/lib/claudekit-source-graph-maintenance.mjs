import path from "node:path";

function sortValues(values) {
  return Array.from(new Set(values)).sort();
}

function containsAll(actual, expected) {
  return expected.every((value) => actual.includes(value));
}

function normalizeSourcePath(sourcePath, repoRoot) {
  const absolutePath = path.resolve(sourcePath);
  const relativePath = path.relative(repoRoot, absolutePath);

  if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    return relativePath.replace(/\\/g, "/");
  }

  return sourcePath.replace(/\\/g, "/");
}

function collectTargets(graph, kind, from) {
  return sortValues(
    graph.edges
      .filter((edge) => edge.kind === kind && edge.from === from)
      .map((edge) => edge.to)
  );
}

function collectSources(graph, kind, to) {
  return sortValues(
    graph.edges
      .filter((edge) => edge.kind === kind && edge.to === to)
      .map((edge) => edge.from)
  );
}

export function analyzeSourceImpact(graph, sourcePaths) {
  const requestedSourcePaths = sortValues(
    sourcePaths
      .map((sourcePath) => normalizeSourcePath(sourcePath, graph.repoRoot))
      .filter(Boolean)
  );
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  const evidenceBySourcePath = new Map();

  for (const evidence of graph.evidence) {
    const bucket = evidenceBySourcePath.get(evidence.sourcePath) ?? [];
    bucket.push(evidence);
    evidenceBySourcePath.set(evidence.sourcePath, bucket);
  }

  const matchedEvidence = [];
  const matchedSourcePaths = [];
  const unmatchedSourcePaths = [];

  for (const sourcePath of requestedSourcePaths) {
    const evidenceRows = evidenceBySourcePath.get(sourcePath) ?? [];

    if (evidenceRows.length === 0) {
      unmatchedSourcePaths.push(sourcePath);
      continue;
    }

    matchedSourcePaths.push(sourcePath);
    matchedEvidence.push(...evidenceRows);
  }

  const matchedEvidenceIds = new Set(matchedEvidence.map((evidence) => evidence.id));
  const impactedNodeIds = new Set();
  const impactedEdgeIds = new Set();

  for (const evidence of matchedEvidence) {
    if ((evidence.subjectType === "node" || evidence.subjectType === "mixed") && nodeIds.has(evidence.subjectId)) {
      impactedNodeIds.add(evidence.subjectId);
    }
    if ((evidence.subjectType === "edge" || evidence.subjectType === "mixed") && edgeIds.has(evidence.subjectId)) {
      impactedEdgeIds.add(evidence.subjectId);
    }
  }

  for (const node of graph.nodes) {
    if (node.sourceRefs.some((ref) => matchedEvidenceIds.has(ref))) {
      impactedNodeIds.add(node.id);
    }
  }

  for (const edge of graph.edges) {
    if (edge.sourceRefs.some((ref) => matchedEvidenceIds.has(ref))) {
      impactedEdgeIds.add(edge.id);
    }
  }

  const adjacentEdgeIds = sortValues(
    graph.edges
      .filter(
        (edge) =>
          !impactedEdgeIds.has(edge.id) &&
          (impactedNodeIds.has(edge.from) || impactedNodeIds.has(edge.to))
      )
      .map((edge) => edge.id)
  );

  return {
    requestedSourcePaths,
    matchedSourcePaths: sortValues(matchedSourcePaths),
    unmatchedSourcePaths: sortValues(unmatchedSourcePaths),
    evidenceIds: sortValues(matchedEvidence.map((evidence) => evidence.id)),
    nodeIds: sortValues(impactedNodeIds),
    edgeIds: sortValues(impactedEdgeIds),
    adjacentEdgeIds
  };
}

export function runWave1SmokeQueries(graph) {
  const queries = [
    {
      id: "handoff.brainstorm_to_plan",
      actual: collectTargets(graph, "hands_off_to", "workflow.brainstorm"),
      expected: ["workflow.plan"]
    },
    {
      id: "handoff.plan_to_cook",
      actual: collectTargets(graph, "hands_off_to", "workflow.plan"),
      expected: ["workflow.cook"]
    },
    {
      id: "handoff.debug_to_fix",
      actual: collectTargets(graph, "hands_off_to", "workflow.debug"),
      expected: ["workflow.fix"]
    },
    {
      id: "handoff.review_to_fix",
      actual: collectTargets(graph, "hands_off_to", "workflow.review"),
      expected: ["workflow.fix"]
    },
    {
      id: "handoff.finalize_to_git",
      actual: collectTargets(graph, "hands_off_to", "gate.finalize_required"),
      expected: ["artifact.git_handoff_report"]
    },
    {
      id: "produces.workflow_brainstorm",
      actual: collectTargets(graph, "produces", "workflow.brainstorm"),
      expected: ["artifact.decision_report_md"]
    },
    {
      id: "produces.workflow_plan",
      actual: collectTargets(graph, "produces", "workflow.plan"),
      expected: ["artifact.plan_md", "artifact.phase_file_md"]
    },
    {
      id: "produces.workflow_review",
      actual: collectTargets(graph, "produces", "workflow.review"),
      expected: ["artifact.review_report_md"]
    },
    {
      id: "produces.workflow_debug",
      actual: collectTargets(graph, "produces", "workflow.debug"),
      expected: ["artifact.debug_report_md"]
    },
    {
      id: "produces.workflow_test",
      actual: collectTargets(graph, "produces", "workflow.test"),
      expected: ["artifact.test_report_md"]
    },
    {
      id: "uses.ask_user_question",
      actual: collectSources(graph, "uses", "tool_ref.ask_user_question"),
      expected: [
        "workflow.brainstorm",
        "workflow.fix",
        "workflow.plan",
        "workflow.review",
        "workflow.test"
      ]
    },
    {
      id: "uses.workflow_cook.task_tools",
      actual: collectTargets(graph, "uses", "workflow.cook"),
      expected: [
        "tool_ref.task_create",
        "tool_ref.task_get",
        "tool_ref.task_list",
        "tool_ref.task_subagent",
        "tool_ref.task_update"
      ]
    },
    {
      id: "uses.workflow_team.team_tools",
      actual: collectTargets(graph, "uses", "workflow.team"),
      expected: [
        "tool_ref.send_message",
        "tool_ref.task_create",
        "tool_ref.task_subagent",
        "tool_ref.team_create",
        "tool_ref.team_delete"
      ]
    },
    {
      id: "requires.hook_injected_context",
      actual: collectSources(graph, "requires", "runtime_primitive.hook_injected_context"),
      expected: ["workflow.plan", "workflow.team"]
    }
  ];

  return queries.map((query) => ({
    ...query,
    operator: "contains_all",
    ok: containsAll(query.actual, query.expected)
  }));
}
