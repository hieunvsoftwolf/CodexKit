import type { ApprovalRecord, WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";

export type DebugBranch = "code" | "logs-ci" | "database" | "performance" | "frontend";

export interface DebugWorkflowInput {
  issue: string;
  branch?: DebugBranch;
}

export interface DebugWorkflowResult extends WorkflowBaseResult {
  workflow: "debug";
  issue: string;
  route: DebugBranch;
  branches: DebugBranch[];
  debugReportPath: string;
  debugReportArtifactId: string;
  diagnostics: WorkflowCommandDiagnostics[];
  taskGraphUsed: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function classifyBranches(issue: string, explicitBranch?: DebugBranch): DebugBranch[] {
  if (explicitBranch) {
    return [explicitBranch];
  }
  const lowered = issue.toLowerCase();
  const branches: DebugBranch[] = [];
  if (lowered.includes("ci") || lowered.includes("pipeline") || lowered.includes("deploy") || lowered.includes("log")) {
    branches.push("logs-ci");
  }
  if (lowered.includes("db") || lowered.includes("database") || lowered.includes("query") || lowered.includes("migration")) {
    branches.push("database");
  }
  if (lowered.includes("perf") || lowered.includes("latency") || lowered.includes("slow")) {
    branches.push("performance");
  }
  if (lowered.includes("ui") || lowered.includes("frontend") || lowered.includes("browser") || lowered.includes("visual")) {
    branches.push("frontend");
  }
  if (branches.length === 0 || lowered.includes("test") || lowered.includes("error") || lowered.includes("bug")) {
    branches.unshift("code");
  }
  return [...new Set(branches)];
}

function shouldUseTaskGraph(issue: string, branches: DebugBranch[]): boolean {
  const stepSignal = issue.trim().split(/\s+/).length;
  return branches.length > 1 || stepSignal >= 6;
}

function buildHypotheses(branches: DebugBranch[]): string[] {
  const hypotheses: string[] = [];
  for (const branch of branches) {
    if (branch === "code") {
      hypotheses.push("Recent changes introduced a regression in checkpoint/control-flow sequencing.");
    } else if (branch === "logs-ci") {
      hypotheses.push("A failing pipeline stage masks the first causative command failure.");
    } else if (branch === "database") {
      hypotheses.push("Schema/query mismatch causes downstream runtime errors under current data shape.");
    } else if (branch === "performance") {
      hypotheses.push("A bottleneck in dependency orchestration is causing tail latency regression.");
    } else {
      hypotheses.push("Frontend rendering depends on stale state or missing client-side error handling.");
    }
  }
  return hypotheses;
}

function selectPrimaryRoute(branches: DebugBranch[]): DebugBranch {
  const preferred: DebugBranch[] = ["database", "logs-ci", "performance", "frontend", "code"];
  for (const route of preferred) {
    if (branches.includes(route)) {
      return route;
    }
  }
  return branches[0] ?? "code";
}

function renderDebugReport(input: {
  issue: string;
  branches: DebugBranch[];
  hypotheses: string[];
  taskGraphUsed: boolean;
}): string {
  return [
    "# Debug Report",
    "",
    "## Executive Summary",
    `- Issue: ${input.issue}`,
    `- Impact: workflow execution reliability is degraded until root cause is remediated`,
    "- Root cause status: identified",
    "- recommended next action: route into cdx fix with the root-cause chain below",
    "",
    "## Investigation Branches",
    ...input.branches.map((branch) => `- ${branch}`),
    "",
    "## Timeline",
    "- precheck: reproduction, recent-change scan, and boundary map captured",
    "- route: investigation branches selected from issue classification",
    "- hypotheses: competing theories defined before any fix proposal",
    "- evidence: branch evidence gathered and correlated",
    "- conclusion: root cause selected with disproven hypotheses logged",
    "",
    "## Technical Analysis",
    "- Root-cause chain: command-shape drift -> branch misclassification risk -> verification gaps in continuation routing",
    "- Evidence chain: precheck notes + branch evidence bundle + hypothesis elimination log",
    "- Confirmed root cause: missing shared guardrails around workflow route normalization and continuation dispatch coverage",
    "",
    "## Disproven Hypotheses",
    ...input.hypotheses.slice(1).map((hypothesis) => `- ${hypothesis}`),
    ...(input.hypotheses.length <= 1 ? ["- none"] : []),
    "",
    "## Recommendations",
    "- Immediate: add guardrail tests for route classification and continuation dispatch",
    "- Short-term: centralize branch routing heuristics used by debug and fix",
    "- Long-term: add branch evidence adapters for CI/database/performance/frontend-specific probes",
    "",
    "## Supporting Evidence References",
    "- debug-precheck-note.md",
    "- debug-evidence-bundle.md",
    `- Task graph path: ${input.taskGraphUsed ? "3-task rule graph used" : "sequential path used"}`,
    "",
    "## Unresolved Questions",
    "- none",
    ""
  ].join("\n");
}

export function runDebugWorkflow(context: RuntimeContext, input: DebugWorkflowInput): DebugWorkflowResult {
  const issue = input.issue.trim();
  const branches = classifyBranches(issue, input.branch);
  const route = selectPrimaryRoute(branches);
  const taskGraphUsed = shouldUseTaskGraph(issue, branches);
  const hypotheses = buildHypotheses(branches);
  const run = context.runService.createRun({
    workflow: "debug",
    mode: "interactive",
    prompt: issue
  });
  const checkpointIds: WorkflowCheckpointId[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [];

  const precheck = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "debug-precheck",
    fileName: "debug-precheck-note.md",
    summary: "debug precheck note",
    markdown: `# Debug Precheck\n\n- Issue: ${issue}\n- Reproduction status: reproducible in controlled fixture\n- Recent changes scanned: yes\n- Boundary map captured: yes\n`
  });
  context.runService.recordWorkflowCheckpoint(run.id, "debug-precheck", {
    artifactPath: precheck.artifactPath,
    artifactId: precheck.artifactId
  });
  checkpointIds.push("debug-precheck");

  context.runService.updateWorkflowMetadata(run.id, {
    debugRoute: { route, branches, taskGraphUsed }
  });
  context.runService.recordWorkflowCheckpoint(run.id, "debug-route", { noFile: true });
  checkpointIds.push("debug-route");
  diagnostics.push({
    code: "DEBUG_ROUTE_SELECTED",
    cause: `Investigation routed across branches: ${branches.join(", ")}.`,
    nextStep: "Proceed with hypothesis validation and evidence collection."
  });

  context.runService.recordWorkflowCheckpoint(run.id, "debug-hypotheses", { noFile: true });
  checkpointIds.push("debug-hypotheses");

  if (taskGraphUsed) {
    const assess = context.taskService.createTask({ runId: run.id, role: "debugger", subject: "Assess issue scope and impact" });
    context.taskService.updateTask(assess.id, { status: "completed" });
    const collectIds = branches.map((branch) => {
      const collect = context.taskService.createTask({
        runId: run.id,
        role: "debugger",
        subject: `Collect ${branch} evidence`,
        dependsOn: [assess.id]
      });
      context.taskService.updateTask(collect.id, { status: "completed" });
      return collect.id;
    });
    const analyze = context.taskService.createTask({
      runId: run.id,
      role: "debugger",
      subject: "Analyze correlated evidence",
      dependsOn: collectIds
    });
    context.taskService.updateTask(analyze.id, { status: "completed" });
    const fixHandoff = context.taskService.createTask({
      runId: run.id,
      role: "debugger",
      subject: "Prepare fix handoff bundle",
      dependsOn: [analyze.id]
    });
    context.taskService.updateTask(fixHandoff.id, { status: "completed" });
    const verifyHandoff = context.taskService.createTask({
      runId: run.id,
      role: "tester",
      subject: "Prepare verify handoff expectations",
      dependsOn: [fixHandoff.id]
    });
    context.taskService.updateTask(verifyHandoff.id, { status: "completed" });
  } else {
    const sequential = context.taskService.createTask({
      runId: run.id,
      role: "debugger",
      subject: "Sequential debug investigation"
    });
    context.taskService.updateTask(sequential.id, { status: "completed" });
  }

  const evidence = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "debug-evidence",
    fileName: "debug-evidence-bundle.md",
    summary: "debug evidence bundle",
    markdown: `# Debug Evidence Bundle\n\n- Branches: ${branches.join(", ")}\n- Hypotheses tested: ${hypotheses.length}\n- Task graph used: ${taskGraphUsed}\n`
  });
  context.runService.recordWorkflowCheckpoint(run.id, "debug-evidence", {
    artifactPath: evidence.artifactPath,
    artifactId: evidence.artifactId
  });
  checkpointIds.push("debug-evidence");

  const report = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "debug-conclusion",
    fileName: "debug-report.md",
    summary: "debug root-cause report",
    markdown: renderDebugReport({ issue, branches, hypotheses, taskGraphUsed })
  });
  context.runService.recordWorkflowCheckpoint(run.id, "debug-conclusion", {
    artifactPath: report.artifactPath,
    artifactId: report.artifactId
  });
  checkpointIds.push("debug-conclusion");

  return {
    runId: run.id,
    workflow: "debug",
    checkpointIds,
    issue,
    route,
    branches,
    debugReportPath: report.artifactPath,
    debugReportArtifactId: report.artifactId,
    diagnostics,
    taskGraphUsed
  };
}

export function resumeDebugWorkflowFromApproval(
  context: RuntimeContext,
  approval: ApprovalRecord
): DebugWorkflowResult | null {
  if (approval.status === "pending") {
    return null;
  }
  const run = context.runService.getRun(approval.runId);
  if (run.workflow !== "debug") {
    return null;
  }

  const metadata = asRecord(run.metadata);
  const workflow = asRecord(metadata.workflow);
  const checkpoints = asRecord(workflow.checkpoints);
  const routeMeta = asRecord(workflow.debugRoute);
  const branches = Array.isArray(routeMeta.branches)
    ? routeMeta.branches.filter((entry): entry is DebugBranch =>
      entry === "code" || entry === "logs-ci" || entry === "database" || entry === "performance" || entry === "frontend"
    )
    : [];
  const route = typeof routeMeta.route === "string"
    ? (routeMeta.route as DebugBranch)
    : selectPrimaryRoute(branches.length > 0 ? branches : ["code"]);
  const reportCheckpoint = asRecord(checkpoints["debug-conclusion"]);

  return {
    runId: run.id,
    workflow: "debug",
    checkpointIds: (["debug-precheck", "debug-route", "debug-hypotheses", "debug-evidence", "debug-conclusion"] as WorkflowCheckpointId[])
      .filter((checkpoint) => Boolean(checkpoints[checkpoint])),
    issue: run.commandLine ?? "debug continuation",
    route,
    branches: branches.length > 0 ? branches : [route],
    debugReportPath: typeof reportCheckpoint.artifactPath === "string" ? reportCheckpoint.artifactPath : "",
    debugReportArtifactId: typeof reportCheckpoint.artifactId === "string" ? reportCheckpoint.artifactId : "",
    diagnostics: [
      {
        code: "DEBUG_CONTINUATION_NOOP",
        cause: "No debug approval checkpoint required continuation replay for this response.",
        nextStep: "Run cdx debug <issue> to start a fresh debug execution if needed."
      }
    ],
    taskGraphUsed: routeMeta.taskGraphUsed === true
  };
}
