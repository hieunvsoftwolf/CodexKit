import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  approvalStatusToCheckpointResponse,
  type ApprovalRecord,
  type WorkflowCheckpointId
} from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishTypedFailureDiagnostic, publishWorkflowReport } from "./workflow-reporting.ts";

type TestMode = "default" | "ui" | "coverage";
type TestWorkflowMode = TestMode | "chooser";

const TEST_CONTINUATION_METADATA_KEY = "testContinuation";
const TEST_CHECKPOINT_ORDER: WorkflowCheckpointId[] = ["test-preflight", "test-execution", "test-report"];

interface CommandEvidence {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

interface TestContinuationState {
  stage: "test-mode";
  context: string;
  url?: string;
}

interface TestScripts {
  test?: string;
  testCoverage?: string;
  testUi?: string;
  testE2e?: string;
}

interface ExecutionPlan {
  command?: string[];
  blockedDiagnostic?: WorkflowCommandDiagnostics;
}

type MetricValue = number | "unavailable";

interface ReportTotals {
  passed: MetricValue;
  failed: MetricValue;
  skipped: MetricValue;
  durationSeconds: MetricValue;
}

interface ReportCoverage {
  line: MetricValue;
  branch: MetricValue;
}

interface RunnerTotals {
  passed: number;
  failed: number;
  skipped: number;
  durationSeconds?: number;
}

interface RunnerCoverage {
  line: number;
  branch: number;
}

interface ParsedRunnerMetrics {
  totals?: RunnerTotals;
  coverage?: RunnerCoverage;
}

type ReportBuildStatus = "passed" | "failed" | "degraded" | "blocked";

export interface TestWorkflowInput {
  context?: string;
  mode?: TestWorkflowMode;
  url?: string;
}

export interface TestWorkflowResult extends WorkflowBaseResult {
  workflow: "test";
  mode: TestWorkflowMode;
  executionStatus: "passed" | "failed" | "degraded";
  testReportPath?: string;
  testReportArtifactId?: string;
  diagnostics: WorkflowCommandDiagnostics[];
  retryRecommended: boolean;
  retryCommand?: string;
  pendingApproval?: {
    approvalId: string;
    checkpoint: string;
    nextStep: string;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function hasUiTestPrerequisites(rootDir: string): boolean {
  return existsSync(path.join(rootDir, "node_modules", "playwright"))
    || existsSync(path.join(rootDir, "node_modules", "@playwright"));
}

function runCommand(rootDir: string, command: string[]): CommandEvidence {
  if (command.length === 0) {
    return {
      command: "(empty command)",
      exitCode: 127,
      stdout: "",
      stderr: "No command provided",
      durationMs: 0
    };
  }
  const startedAt = Date.now();
  const result = spawnSync(command[0]!, command.slice(1), {
    cwd: rootDir,
    encoding: "utf8",
    timeout: 120_000
  });
  const durationMs = Date.now() - startedAt;
  const exitCode = typeof result.status === "number"
    ? result.status
    : result.error
      ? 127
      : 1;
  const errorText = result.error ? `${result.error.name}: ${result.error.message}` : "";
  return {
    command: command.join(" "),
    exitCode,
    stdout: `${result.stdout ?? ""}`.trim(),
    stderr: `${result.stderr ?? ""}`.trim() || errorText,
    durationMs
  };
}

function readTestScripts(rootDir: string): TestScripts | null {
  const packagePath = path.join(rootDir, "package.json");
  if (!existsSync(packagePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, unknown> };
    const scripts = parsed.scripts ?? {};
    return {
      ...(typeof scripts.test === "string" ? { test: scripts.test } : {}),
      ...(typeof scripts["test:coverage"] === "string" ? { testCoverage: scripts["test:coverage"] } : {}),
      ...(typeof scripts["test:ui"] === "string" ? { testUi: scripts["test:ui"] } : {}),
      ...(typeof scripts["test:e2e"] === "string" ? { testE2e: scripts["test:e2e"] } : {})
    };
  } catch {
    return null;
  }
}

function renderCommandEvidenceSection(title: string, evidence: CommandEvidence[]): string[] {
  const lines: string[] = [title];
  if (evidence.length === 0) {
    lines.push("- none");
    return lines;
  }
  for (const entry of evidence) {
    lines.push(`- ${entry.command}`);
    lines.push(`  Exit: ${entry.exitCode} | Duration: ${(entry.durationMs / 1000).toFixed(2)}s`);
    lines.push(`  Stdout: ${entry.stdout.length > 0 ? entry.stdout.slice(0, 400) : "(empty)"}`);
    lines.push(`  Stderr: ${entry.stderr.length > 0 ? entry.stderr.slice(0, 400) : "(empty)"}`);
  }
  return lines;
}

function formatMetricValue(value: MetricValue): string {
  return typeof value === "number" ? String(value) : "unavailable";
}

function formatDurationMetric(value: MetricValue): string {
  return typeof value === "number" ? `${value.toFixed(1)}s` : "unavailable";
}

function formatCoverageMetric(value: MetricValue): string {
  return typeof value === "number" ? `${value}%` : "unavailable";
}

function parseDurationSeconds(value: string, unit: string): number {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return Number.NaN;
  }
  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit === "ms") {
    return numeric / 1000;
  }
  if (normalizedUnit === "m") {
    return numeric * 60;
  }
  return numeric;
}

function parseRunnerDurationSeconds(output: string): number | undefined {
  const patterns = [
    /(?:\bDuration\b[^0-9]*)([0-9]+(?:\.[0-9]+)?)\s*(ms|s|m)\b/gi,
    /(?:\bTime\b[^0-9]*)([0-9]+(?:\.[0-9]+)?)\s*(ms|s|m)\b/gi,
    /\(([0-9]+(?:\.[0-9]+)?)\s*(ms|s|m)\)/gi
  ];
  const durations: number[] = [];
  for (const pattern of patterns) {
    for (const match of output.matchAll(pattern)) {
      const seconds = parseDurationSeconds(match[1] ?? "", match[2] ?? "s");
      if (Number.isFinite(seconds)) {
        durations.push(seconds);
      }
    }
  }
  if (durations.length === 0) {
    return undefined;
  }
  return Math.max(...durations);
}

function parseRunnerTotals(output: string): RunnerTotals | undefined {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  let bestCounts: { passed?: number; failed?: number; skipped?: number; total?: number } | null = null;
  let bestScore = -1;
  for (const line of lines) {
    const includesTotals = /\btests?\b/i.test(line)
      || /\bpassing\b/i.test(line)
      || /\bfailing\b/i.test(line)
      || /\bskipped\b/i.test(line)
      || /\bpending\b/i.test(line)
      || /\btodo\b/i.test(line);
    if (!includesTotals) {
      continue;
    }
    const counts: { passed?: number; failed?: number; skipped?: number; total?: number } = {};
    for (const match of line.matchAll(/([0-9]+)\s+(passed|passing|failed|failing|skipped|pending|todo|total)\b/gi)) {
      const value = Number.parseInt(match[1] ?? "", 10);
      if (!Number.isFinite(value)) {
        continue;
      }
      const keyword = (match[2] ?? "").toLowerCase();
      if (keyword === "passed" || keyword === "passing") {
        counts.passed = value;
      } else if (keyword === "failed" || keyword === "failing") {
        counts.failed = value;
      } else if (keyword === "skipped" || keyword === "pending" || keyword === "todo") {
        counts.skipped = value;
      } else if (keyword === "total") {
        counts.total = value;
      }
    }
    if (counts.total === undefined) {
      const parenthesizedTotal = line.match(/\(([0-9]+)\)/);
      if (parenthesizedTotal) {
        const value = Number.parseInt(parenthesizedTotal[1] ?? "", 10);
        if (Number.isFinite(value)) {
          counts.total = value;
        }
      }
    }
    const score = Number(counts.passed !== undefined)
      + Number(counts.failed !== undefined)
      + Number(counts.skipped !== undefined)
      + Number(counts.total !== undefined);
    if (score > bestScore) {
      bestCounts = counts;
      bestScore = score;
    }
  }
  if (!bestCounts) {
    return undefined;
  }
  let passed = bestCounts.passed;
  let failed = bestCounts.failed;
  let skipped = bestCounts.skipped;
  const total = bestCounts.total;
  if (typeof total === "number") {
    const knownSum = (passed ?? 0) + (failed ?? 0) + (skipped ?? 0);
    const unknownKeys = [
      ...(passed === undefined ? ["passed"] : []),
      ...(failed === undefined ? ["failed"] : []),
      ...(skipped === undefined ? ["skipped"] : [])
    ];
    if (unknownKeys.length === 1) {
      const remainder = total - knownSum;
      if (remainder >= 0) {
        if (unknownKeys[0] === "passed") {
          passed = remainder;
        } else if (unknownKeys[0] === "failed") {
          failed = remainder;
        } else if (unknownKeys[0] === "skipped") {
          skipped = remainder;
        }
      }
    } else if (unknownKeys.length === 2 && knownSum === total) {
      if (passed === undefined) {
        passed = 0;
      }
      if (failed === undefined) {
        failed = 0;
      }
      if (skipped === undefined) {
        skipped = 0;
      }
    }
  }
  if (typeof passed !== "number" || typeof failed !== "number" || typeof skipped !== "number") {
    return undefined;
  }
  const durationSeconds = parseRunnerDurationSeconds(output);
  return {
    passed,
    failed,
    skipped,
    ...(typeof durationSeconds === "number" ? { durationSeconds } : {})
  };
}

function parseRunnerCoverage(output: string): RunnerCoverage | undefined {
  const allFilesLine = output.split(/\r?\n/).find((line) => /\ball files\b/i.test(line) && /[0-9]/.test(line));
  if (allFilesLine) {
    const percentages = Array.from(allFilesLine.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*%?/g))
      .map((match) => Number.parseFloat(match[1] ?? ""))
      .filter((value) => Number.isFinite(value));
    if (percentages.length >= 4) {
      return { line: percentages[3]!, branch: percentages[1]! };
    }
  }
  const lineMatch = output.match(/\blines?\b\s*[:|]\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  const branchMatch = output.match(/\bbranches?\b\s*[:|]\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (!lineMatch || !branchMatch) {
    return undefined;
  }
  const line = Number.parseFloat(lineMatch[1] ?? "");
  const branch = Number.parseFloat(branchMatch[1] ?? "");
  if (!Number.isFinite(line) || !Number.isFinite(branch)) {
    return undefined;
  }
  return { line, branch };
}

function parseRunnerMetrics(evidence: CommandEvidence[]): ParsedRunnerMetrics {
  const output = evidence
    .map((entry) => [entry.stdout, entry.stderr].filter((value) => value.length > 0).join("\n"))
    .filter((chunk) => chunk.length > 0)
    .join("\n");
  if (output.length === 0) {
    return {};
  }
  const totals = parseRunnerTotals(output);
  const coverage = parseRunnerCoverage(output);
  return {
    ...(totals ? { totals } : {}),
    ...(coverage ? { coverage } : {})
  };
}

function unavailableTotals(): ReportTotals {
  return {
    passed: "unavailable",
    failed: "unavailable",
    skipped: "unavailable",
    durationSeconds: "unavailable"
  };
}

function unavailableCoverage(): ReportCoverage {
  return {
    line: "unavailable",
    branch: "unavailable"
  };
}

function toReportTotals(metrics: ParsedRunnerMetrics): ReportTotals {
  if (!metrics.totals) {
    return unavailableTotals();
  }
  return {
    passed: metrics.totals.passed,
    failed: metrics.totals.failed,
    skipped: metrics.totals.skipped,
    durationSeconds: typeof metrics.totals.durationSeconds === "number"
      ? metrics.totals.durationSeconds
      : "unavailable"
  };
}

function toReportCoverage(mode: TestMode, metrics: ParsedRunnerMetrics): ReportCoverage | undefined {
  if (metrics.coverage) {
    return metrics.coverage;
  }
  return mode === "coverage" ? unavailableCoverage() : undefined;
}

function renderTestReport(input: {
  mode: TestMode;
  context: string;
  status: "passed" | "failed" | "degraded";
  buildStatus: ReportBuildStatus;
  totals: ReportTotals;
  coverage?: ReportCoverage;
  warnings: string[];
  diagnostics: WorkflowCommandDiagnostics[];
  unresolvedQuestions: string[];
}): string {
  const lines = [
    "# Test Report",
    "",
    `- Mode: ${input.mode}`,
    `- Context: ${input.context}`,
    `- Status: ${input.status}`,
    "",
    "## Totals",
    `- Passed: ${formatMetricValue(input.totals.passed)}`,
    `- Failed: ${formatMetricValue(input.totals.failed)}`,
    `- Skipped: ${formatMetricValue(input.totals.skipped)}`,
    `- Duration: ${formatDurationMetric(input.totals.durationSeconds)}`,
    ""
  ];
  if (input.coverage) {
    lines.push(
      "## Coverage",
      `- Line: ${formatCoverageMetric(input.coverage.line)}`,
      `- Branch: ${formatCoverageMetric(input.coverage.branch)}`,
      ""
    );
  }
  lines.push("## Failed Tests");
  if (input.diagnostics.length === 0 || input.status === "passed") {
    lines.push("- none");
  } else {
    for (const diagnostic of input.diagnostics) {
      lines.push(`- ${diagnostic.code}`, `  Cause: ${diagnostic.cause}`, `  Suggested fix: ${diagnostic.nextStep}`);
    }
  }
  lines.push("", "## Build Status And Warnings", `- Build status: ${input.buildStatus}`);
  if (input.warnings.length === 0) {
    lines.push("- Warnings: none");
  } else {
    for (const warning of input.warnings) {
      lines.push(`- Warning: ${warning}`);
    }
  }
  lines.push("", "## Unresolved Questions");
  if (input.unresolvedQuestions.length === 0) {
    lines.push("- none");
  } else {
    for (const question of input.unresolvedQuestions) {
      lines.push(`- ${question}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function chooseExecutionCommand(mode: TestMode, scripts: TestScripts | null): ExecutionPlan {
  if (!scripts) {
    return {
      blockedDiagnostic: {
        code: "TEST_BLOCKED_NO_PACKAGE_JSON",
        cause: "No package.json was found, so runnable test scripts are unavailable.",
        nextStep: "Create package.json with a test script, then rerun cdx test."
      }
    };
  }
  if (mode === "coverage") {
    if (scripts.testCoverage) {
      return { command: ["npm", "run", "--silent", "test:coverage"] };
    }
    if (scripts.test) {
      return { command: ["npm", "test", "--", "--coverage"] };
    }
    return {
      blockedDiagnostic: {
        code: "TEST_BLOCKED_NO_COVERAGE_SCRIPT",
        cause: "Coverage mode requires test:coverage or test script support.",
        nextStep: "Add test:coverage or test script to package.json, then rerun cdx test --coverage."
      }
    };
  }
  if (mode === "ui") {
    if (scripts.testUi) {
      return { command: ["npm", "run", "--silent", "test:ui"] };
    }
    if (scripts.testE2e) {
      return { command: ["npm", "run", "--silent", "test:e2e"] };
    }
    return {
      blockedDiagnostic: {
        code: "TEST_UI_BLOCKED_NO_SCRIPT",
        cause: "UI verification requires a UI-specific script, but test:ui/test:e2e is missing.",
        nextStep: "Add test:ui or test:e2e to package.json, then rerun cdx test ui <url>."
      }
    };
  }
  if (scripts.test) {
    return { command: ["npm", "test"] };
  }
  return {
    blockedDiagnostic: {
      code: "TEST_BLOCKED_NO_TEST_SCRIPT",
      cause: "No test script was found in package.json.",
      nextStep: "Add a test script to package.json, then rerun cdx test <context>."
    }
  };
}

function writeTestContinuationState(context: RuntimeContext, runId: string, state: TestContinuationState | null): void {
  context.runService.updateRunMetadata(runId, {
    [TEST_CONTINUATION_METADATA_KEY]: state
  });
}

function readTestContinuationState(context: RuntimeContext, runId: string): TestContinuationState | null {
  const run = context.runService.getRun(runId);
  const metadata = asRecord(run.metadata);
  const continuation = asRecord(metadata[TEST_CONTINUATION_METADATA_KEY]);
  if (continuation.stage !== "test-mode") {
    return null;
  }
  return {
    stage: "test-mode",
    context: typeof continuation.context === "string" ? continuation.context : "",
    ...(typeof continuation.url === "string" ? { url: continuation.url } : {})
  };
}

function readCheckpointIdsFromRun(run: { metadata: unknown }): WorkflowCheckpointId[] {
  const metadata = asRecord(run.metadata);
  const workflow = asRecord(metadata.workflow);
  const checkpoints = asRecord(workflow.checkpoints);
  return TEST_CHECKPOINT_ORDER.filter((checkpoint) => Boolean(checkpoints[checkpoint]));
}

function readTestResultFromRun(
  context: RuntimeContext,
  runId: string,
  diagnostics: WorkflowCommandDiagnostics[]
): TestWorkflowResult {
  const run = context.runService.getRun(runId);
  const metadata = asRecord(run.metadata);
  const workflow = asRecord(metadata.workflow);
  const checkpoints = asRecord(workflow.checkpoints);
  const reportCheckpoint = asRecord(checkpoints["test-report"]);
  return {
    runId,
    workflow: "test",
    checkpointIds: readCheckpointIdsFromRun(run),
    mode: "default",
    executionStatus: "degraded",
    ...(typeof reportCheckpoint.artifactPath === "string" ? { testReportPath: reportCheckpoint.artifactPath } : {}),
    diagnostics,
    retryRecommended: false
  };
}

function createModeSelectionGate(context: RuntimeContext, runId: string): TestWorkflowResult {
  const approval = context.approvalService.requestApproval({
    runId,
    checkpoint: "test-mode",
    question: "Choose test mode before execution starts: default or ui.",
    options: [
      { code: "default", label: "Default mode", description: "Run default unit/integration/e2e/build verification path." },
      { code: "ui", label: "UI mode", description: "Run browser-oriented UI verification path." }
    ]
  });
  writeTestContinuationState(context, runId, {
    stage: "test-mode",
    context: ""
  });
  return {
    runId,
    workflow: "test",
    checkpointIds: [],
    mode: "chooser",
    executionStatus: "degraded",
    diagnostics: [
      {
        code: "TEST_MODE_SELECTION_REQUIRED",
        cause: "Bare cdx test requires mode selection before checkpoint execution.",
        nextStep: `Run cdx approval respond ${approval.id} --response approve --text default|ui.`
      }
    ],
    retryRecommended: false,
    pendingApproval: {
      approvalId: approval.id,
      checkpoint: "test-mode",
      nextStep: `cdx approval respond ${approval.id} --response approve --text default`
    }
  };
}

function pickModeFromApproval(approval: ApprovalRecord): TestMode {
  const selection = (approval.responseText ?? "").toLowerCase();
  if (selection.includes("ui")) {
    return "ui";
  }
  return "default";
}

function runTestExecution(
  context: RuntimeContext,
  runId: string,
  mode: TestMode,
  testContext: string,
  url?: string
): TestWorkflowResult {
  const checkpointIds: WorkflowCheckpointId[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [];
  const warnings: string[] = [];
  const unresolvedQuestions: string[] = [];
  const preflightEvidence: CommandEvidence[] = [];
  const executionEvidence: CommandEvidence[] = [];

  context.runService.updateWorkflowMetadata(runId, {
    testMode: mode,
    context: testContext
  });

  const preflightTask = context.taskService.createTask({
    runId,
    role: "tester",
    subject: "Test preflight verification",
    description: "Collect runnable test prerequisites and preflight command evidence."
  });
  preflightEvidence.push(runCommand(context.config.paths.rootDir, ["git", "status", "--porcelain"]));
  context.taskService.updateTask(preflightTask.id, { status: "completed" });

  let executionStatus: "passed" | "failed" | "degraded" = "passed";
  let executionBlockedDiagnostic: WorkflowCommandDiagnostics | null = null;
  const scripts = readTestScripts(context.config.paths.rootDir);
  if (mode === "ui") {
    if (!hasUiTestPrerequisites(context.config.paths.rootDir)) {
      executionStatus = "degraded";
      diagnostics.push({
        code: "TEST_UI_DEGRADED_NO_BROWSER",
        cause: "Playwright/browser helper is not available in this workspace.",
        nextStep: "Install browser test prerequisites to enable full UI execution."
      });
      warnings.push("UI browser prerequisites unavailable; evidence path is degraded.");
    }
    if (!url) {
      warnings.push("No URL provided for ui mode; using script-driven UI checks only.");
      unresolvedQuestions.push("Which target URL should UI verification validate?");
    }
  }

  const preflight = publishWorkflowReport(context, {
    runId,
    checkpoint: "test-preflight",
    fileName: "test-preflight-output.md",
    summary: "test preflight output",
    markdown: [
      "# Test Preflight",
      "",
      `- Mode: ${mode}`,
      `- Context: ${testContext}`,
      `- Scripts detected: ${scripts ? "yes" : "no"}`,
      "",
      ...renderCommandEvidenceSection("## Preflight Command Evidence", preflightEvidence),
      ""
    ].join("\n")
  });
  context.runService.recordWorkflowCheckpoint(runId, "test-preflight", {
    artifactPath: preflight.artifactPath,
    artifactId: preflight.artifactId
  });
  checkpointIds.push("test-preflight");

  const executionPlan = chooseExecutionCommand(mode, scripts);
  if (executionPlan.blockedDiagnostic) {
    executionStatus = "degraded";
    executionBlockedDiagnostic = executionPlan.blockedDiagnostic;
    diagnostics.push(executionPlan.blockedDiagnostic);
  }

  const executionTask = context.taskService.createTask({
    runId,
    role: "tester",
    subject: "Test execution",
    description: "Run selected test suite and capture execution evidence.",
    dependsOn: [preflightTask.id]
  });

  if (executionPlan.command) {
    const evidence = runCommand(context.config.paths.rootDir, executionPlan.command);
    executionEvidence.push(evidence);
    if (evidence.exitCode !== 0) {
      executionStatus = "failed";
      diagnostics.push({
        code: "TEST_EXECUTION_FAILED",
        cause: `Test command '${evidence.command}' exited with code ${evidence.exitCode}.`,
        nextStep: "Inspect test-execution-output.md and resolve failing tests before retrying."
      });
    }
  }

  context.taskService.updateTask(executionTask.id, {
    status: executionStatus === "failed" ? "failed" : "completed"
  });

  const execution = publishWorkflowReport(context, {
    runId,
    checkpoint: "test-execution",
    fileName: "test-execution-output.md",
    summary: "test execution output",
    markdown: [
      "# Test Execution",
      "",
      `- Mode: ${mode}`,
      `- Context: ${testContext}`,
      `- Status: ${executionStatus}`,
      "",
      ...renderCommandEvidenceSection("## Execution Command Evidence", executionEvidence),
      ""
    ].join("\n")
  });
  context.runService.recordWorkflowCheckpoint(runId, "test-execution", {
    artifactPath: execution.artifactPath,
    artifactId: execution.artifactId
  });
  checkpointIds.push("test-execution");

  const runnerMetrics = parseRunnerMetrics(executionEvidence);
  const totals = toReportTotals(runnerMetrics);
  const coverage = toReportCoverage(mode, runnerMetrics);
  const buildStatus: ReportBuildStatus = executionStatus === "failed"
    ? "failed"
    : executionBlockedDiagnostic
      ? "blocked"
      : executionStatus;

  const report = publishWorkflowReport(context, {
    runId,
    checkpoint: "test-report",
    fileName: "test-report.md",
    summary: "test report",
    markdown: renderTestReport({
      mode,
      context: testContext,
      status: executionStatus,
      buildStatus,
      totals,
      ...(coverage ? { coverage } : {}),
      warnings,
      diagnostics,
      unresolvedQuestions
    })
  });
  context.runService.recordWorkflowCheckpoint(runId, "test-report", {
    artifactPath: report.artifactPath,
    artifactId: report.artifactId
  });
  checkpointIds.push("test-report");

  const retryRecommended = executionStatus === "failed";
  if (retryRecommended) {
    const retryDiagnostic: WorkflowCommandDiagnostics = {
      code: "TEST_RETRY_AFTER_FIX_REQUIRED",
      cause: "Failed tests were detected and must be re-run after remediation.",
      nextStep: "Run cdx fix <issue> followed by cdx test with the same context."
    };
    diagnostics.push(retryDiagnostic);
    publishTypedFailureDiagnostic(context, {
      runId,
      checkpoint: "test-report",
      workflowLabel: "cdx test",
      fileName: "test-failure-diagnostic.md",
      terminalStatus: "failed",
      diagnostic: retryDiagnostic,
      summary: "test workflow failure diagnostic"
    });
  } else if (executionStatus === "degraded" && diagnostics.length > 0) {
    const blockedDiagnostic = executionBlockedDiagnostic ?? (diagnostics[0] as WorkflowCommandDiagnostics);
    publishTypedFailureDiagnostic(context, {
      runId,
      checkpoint: "test-report",
      workflowLabel: "cdx test",
      fileName: "test-blocked-diagnostic.md",
      terminalStatus: "blocked",
      diagnostic: blockedDiagnostic,
      summary: "test workflow blocked diagnostic"
    });
  }

  return {
    runId,
    workflow: "test",
    checkpointIds,
    mode,
    executionStatus,
    testReportPath: report.artifactPath,
    testReportArtifactId: report.artifactId,
    diagnostics,
    retryRecommended,
    ...(retryRecommended ? { retryCommand: `cdx test ${testContext}` } : {})
  };
}

export function runTestWorkflow(context: RuntimeContext, input: TestWorkflowInput): TestWorkflowResult {
  const mode = input.mode ?? "default";
  const testContext = input.context?.trim() ?? "";
  const run = context.runService.createRun({
    workflow: "test",
    mode: "interactive",
    prompt: mode === "chooser" ? "test mode selection" : testContext
  });

  if (mode === "chooser") {
    return createModeSelectionGate(context, run.id);
  }

  return runTestExecution(context, run.id, mode, testContext || "default test context", input.url);
}

export function runTestWorkflowInRun(
  context: RuntimeContext,
  input: { runId: string; context?: string; mode?: "default" | "ui" | "coverage"; url?: string }
): TestWorkflowResult {
  const mode = input.mode ?? "default";
  const testContext = input.context?.trim() || "default test context";
  return runTestExecution(context, input.runId, mode, testContext, input.url);
}

export function resumeTestWorkflowFromApproval(
  context: RuntimeContext,
  approval: ApprovalRecord
): TestWorkflowResult | null {
  if (approval.status === "pending") {
    return null;
  }
  const run = context.runService.getRun(approval.runId);
  if (run.workflow !== "test") {
    return null;
  }

  const continuation = readTestContinuationState(context, run.id);
  if (!continuation || continuation.stage !== "test-mode" || approval.checkpoint !== "test-mode") {
    return readTestResultFromRun(context, run.id, [
      {
        code: "TEST_CONTINUATION_NOT_APPLICABLE",
        cause: "No test-mode continuation state matched this approval response.",
        nextStep: "Run cdx test with an explicit mode if a new test run is needed."
      }
    ]);
  }

  const checkpointResponse = approvalStatusToCheckpointResponse(approval.status);
  if (checkpointResponse && checkpointResponse !== "approved") {
    writeTestContinuationState(context, run.id, null);
    return {
      runId: run.id,
      workflow: "test",
      checkpointIds: [],
      mode: "chooser",
      executionStatus: "degraded",
      diagnostics: [
        {
          code: "TEST_MODE_SELECTION_STOPPED",
          cause: `Test mode selection ended with '${approval.status}'.`,
          nextStep: "Run cdx test and choose a mode to start a new execution."
        }
      ],
      retryRecommended: false
    };
  }

  const selectedMode = pickModeFromApproval(approval);
  const selectedContext = continuation.context.trim() || (selectedMode === "ui" ? "ui" : "default test context");
  writeTestContinuationState(context, run.id, null);
  return runTestExecution(context, run.id, selectedMode, selectedContext, continuation.url);
}
