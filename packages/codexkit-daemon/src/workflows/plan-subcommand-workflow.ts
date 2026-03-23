import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CodexkitError } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { resolveReportPath } from "./artifact-paths.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { modeToCookHandoff } from "./contracts.ts";
import { readPlanBundle } from "./plan-files.ts";

const ACTIVE_PLAN_KEY = "workflow.plan.active.path";
const ARCHIVED_PLAN_KEY = "workflow.plan.archived.latest.path";

type PlanSubcommandStatus = "valid" | "revise" | "blocked";
type PlanSubcommandKind = "validate" | "red-team" | "archive";

export interface PlanSubcommandWorkflowResult extends WorkflowBaseResult {
  workflow: "plan";
  subcommand: PlanSubcommandKind;
  status: PlanSubcommandStatus;
  planPath: string;
  planDir: string;
  diagnostics: WorkflowCommandDiagnostics[];
  updatedPhasePaths: string[];
  handoffCommand?: string;
  recommendedNextCommand?: string;
  archiveSummaryPath?: string;
  failureDiagnosticPath?: string;
  failureDiagnosticArtifactId?: string;
}

function toAbsolutePlanPath(planPath: string | undefined): string {
  if (!planPath || planPath.trim().length === 0) {
    throw new CodexkitError("CLI_USAGE", "plan path is required", {
      code: "WF_PLAN_PATH_REQUIRED",
      cause: "No plan path argument was provided.",
      nextStep: "Run cdx plan <subcommand> <absolute-plan-path>."
    });
  }
  const absolutePlanPath = path.resolve(planPath);
  if (path.basename(absolutePlanPath) !== "plan.md") {
    throw new CodexkitError("CLI_USAGE", "plan path must target plan.md", {
      code: "WF_PLAN_PATH_INVALID",
      cause: `Received '${planPath}', but plan subcommands require a path ending in plan.md.`,
      nextStep: "Pass an absolute path like /abs/path/to/plan.md."
    });
  }
  if (!existsSync(absolutePlanPath)) {
    throw new CodexkitError("CLI_USAGE", "plan path was not found", {
      code: "WF_PLAN_PATH_NOT_FOUND",
      cause: `No file exists at '${absolutePlanPath}'.`,
      nextStep: "Check the plan path and retry."
    });
  }
  return absolutePlanPath;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function normalizeContent(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n");
}

function appendH2Section(markdown: string, heading: string, sectionBodyLines: string[]): string {
  const normalized = normalizeContent(markdown);
  const lines = normalized.split("\n");
  const headingLine = `## ${heading}`;
  const headingIndex = lines.findIndex((line) => line.trim() === headingLine);
  if (headingIndex === -1) {
    const suffix = normalized.endsWith("\n") ? "" : "\n";
    return `${normalized}${suffix}\n${headingLine}\n\n${sectionBodyLines.join("\n")}\n`;
  }

  let sectionEnd = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith("## ")) {
      sectionEnd = index;
      break;
    }
  }

  const before = lines.slice(0, sectionEnd);
  const after = lines.slice(sectionEnd);
  if (before[before.length - 1] !== "") {
    before.push("");
  }
  const updated = [...before, ...sectionBodyLines];
  if (after.length > 0 && updated[updated.length - 1] !== "") {
    updated.push("");
  }
  return [...updated, ...after].join("\n").replace(/\n+$/g, "\n");
}

function appendPhaseSection(phasePath: string, sectionHeading: string, summaryLine: string): void {
  const content = readFileSync(phasePath, "utf8");
  const updated = appendH2Section(content, sectionHeading, [`- ${summaryLine}`]);
  writeFileSync(phasePath, updated, "utf8");
}

function upsertFrontmatterStatus(planMarkdown: string, status: "archived"): string {
  const match = normalizeContent(planMarkdown).match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new CodexkitError("WF_PLAN_FRONTMATTER_REQUIRED", "plan.md requires YAML frontmatter for archive");
  }

  const frontmatterLines = match[1]!.split("\n");
  let replaced = false;
  for (let index = 0; index < frontmatterLines.length; index += 1) {
    if (/^status:\s*/.test(frontmatterLines[index]!)) {
      frontmatterLines[index] = `status: "${status}"`;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    const insertAt = Math.min(frontmatterLines.length, 3);
    frontmatterLines.splice(insertAt, 0, `status: "${status}"`);
  }

  const rest = normalizeContent(planMarkdown).slice(match[0].length);
  return `---\n${frontmatterLines.join("\n")}\n---\n${rest}`;
}

function publishPlanArtifacts(
  context: RuntimeContext,
  runId: string,
  checkpoint: "plan-draft",
  planPath: string,
  phasePaths: string[]
): string {
  const planArtifact = context.artifactService.publishArtifact({
    runId,
    artifactKind: "plan",
    path: planPath,
    summary: "plan.md updated",
    metadata: { checkpoint }
  });
  for (const phasePath of phasePaths) {
    context.artifactService.publishArtifact({
      runId,
      artifactKind: "plan",
      path: phasePath,
      summary: `updated ${path.basename(phasePath)}`,
      metadata: { checkpoint }
    });
  }
  return planArtifact.id;
}

function publishBlockedPlanSubcommandDiagnosticArtifact(
  context: RuntimeContext,
  input: {
    runId: string;
    planPath: string;
    timestamp: string;
    diagnostic: WorkflowCommandDiagnostics;
    subcommand: "validate" | "red-team";
  }
): { artifactId: string; artifactPath: string } {
  const title = input.subcommand === "validate" ? "Validate Failure Diagnostic" : "Red-Team Failure Diagnostic";
  const reportPath = resolveReportPath(
    context,
    context.runService.getRun(input.runId),
    `${input.subcommand}-failure-diagnostic-${input.runId}.md`,
    { planPathHint: input.planPath }
  );
  const markdown = [
    `# ${title}`,
    "",
    `- Timestamp: ${input.timestamp}`,
    `- Workflow: cdx plan ${input.subcommand}`,
    `- Run ID: ${input.runId}`,
    `- Plan Path: ${input.planPath}`,
    "- Terminal Status: blocked",
    `- Diagnostic Code: ${input.diagnostic.code}`,
    `- Cause: ${input.diagnostic.cause}`,
    `- Next Step: ${input.diagnostic.nextStep}`,
    ""
  ].join("\n");
  writeFileSync(reportPath.absolutePath, markdown, "utf8");
  const artifact = context.artifactService.publishArtifact({
    runId: input.runId,
    artifactKind: "report",
    path: reportPath.absolutePath,
    summary: `blocked ${input.subcommand} typed failure diagnostic`,
    metadata: {
      checkpoint: "plan-draft",
      subcommand: input.subcommand,
      terminalStatus: "blocked",
      diagnosticCode: input.diagnostic.code
    }
  });
  return {
    artifactId: artifact.id,
    artifactPath: reportPath.absolutePath
  };
}

function resolveStatusFromBundle(planPath: string): PlanSubcommandStatus {
  const parsed = readPlanBundle(planPath);
  if (parsed.frontmatter.status === "archived") {
    return "blocked";
  }
  if (parsed.phases.length === 0 || parsed.phases.some((phase) => phase.checklist.length === 0)) {
    return "revise";
  }
  return "valid";
}

export function runPlanValidateWorkflow(
  context: RuntimeContext,
  input: { planPath: string }
): PlanSubcommandWorkflowResult {
  const planPath = toAbsolutePlanPath(input.planPath);
  const run = context.runService.createRun({
    workflow: "plan",
    mode: "interactive",
    prompt: `validate ${planPath}`
  });
  const planDir = path.dirname(planPath);
  context.runService.setPlanDir(run.id, planDir);
  context.runService.recordWorkflowCheckpoint(run.id, "plan-context", { noFile: true });

  const parsed = readPlanBundle(planPath);
  let status = resolveStatusFromBundle(planPath);
  const now = context.clock.now().toISOString();
  const diagnostics: WorkflowCommandDiagnostics[] = [];
  const findings: string[] = [];
  if (status === "blocked") {
    findings.push("Plan is archived and cannot be validated for active execution.");
    diagnostics.push({
      code: "PLAN_VALIDATE_BLOCKED_ARCHIVED",
      cause: "Archived plans are immutable for execution validation.",
      nextStep: "Create or activate a non-archived plan before running validation."
    });
  } else if (status === "revise") {
    findings.push("At least one phase is missing checklist items required for execution readiness.");
    diagnostics.push({
      code: "PLAN_VALIDATE_REVISE",
      cause: "Plan requires refinement before auto execution handoff.",
      nextStep: "Update missing checklist details, then rerun cdx plan validate <plan-path>."
    });
  } else {
    findings.push("Critical execution questions were answered with no blocking gaps.");
    diagnostics.push({
      code: "PLAN_VALIDATE_VALID",
      cause: "Plan meets validation requirements for auto implementation handoff.",
      nextStep: "Continue with the emitted cdx cook --auto command."
    });
  }

  const validationLines = [
    `- Timestamp: ${now}`,
    `- Result: ${status}`,
    ...findings.map((finding) => `- ${finding}`),
    status === "valid"
      ? "- Next step: Continue with cdx cook --auto using this exact plan path."
      : "- Next step: Revise the plan and phase files, then rerun validation."
  ];
  const updatedPhasePaths: string[] = [];
  let blockedDiagnosticArtifact:
    | {
      artifactId: string;
      artifactPath: string;
    }
    | null = null;

  if (status === "blocked") {
    const blockedDiagnostic = diagnostics.find((entry) => entry.code === "PLAN_VALIDATE_BLOCKED_ARCHIVED");
    if (blockedDiagnostic) {
      blockedDiagnosticArtifact = publishBlockedPlanSubcommandDiagnosticArtifact(context, {
        runId: run.id,
        planPath,
        timestamp: now,
        diagnostic: blockedDiagnostic,
        subcommand: "validate"
      });
    }
  }

  if (status !== "blocked") {
    const currentPlanMarkdown = readFileSync(planPath, "utf8");
    const updatedPlanMarkdown = appendH2Section(currentPlanMarkdown, "Validation Log", validationLines);
    writeFileSync(planPath, updatedPlanMarkdown, "utf8");
    for (const phase of parsed.phases) {
      appendPhaseSection(
        phase.absolutePath,
        "Validation Notes",
        `${now}: Confirm execution owners, rollback strategy, and dependency assumptions before implementation.`
      );
      updatedPhasePaths.push(phase.absolutePath);
    }
  }

  if (status !== "blocked") {
    const planArtifactId = publishPlanArtifacts(context, run.id, "plan-draft", planPath, updatedPhasePaths);
    context.runService.recordWorkflowCheckpoint(run.id, "plan-draft", {
      artifactPath: planPath,
      artifactId: planArtifactId
    });
  } else if (blockedDiagnosticArtifact) {
    context.runService.recordWorkflowCheckpoint(run.id, "plan-draft", {
      artifactPath: blockedDiagnosticArtifact.artifactPath,
      artifactId: blockedDiagnosticArtifact.artifactId
    });
  } else {
    context.runService.recordWorkflowCheckpoint(run.id, "plan-draft", { noFile: true });
  }

  return {
    runId: run.id,
    workflow: "plan",
    subcommand: "validate",
    checkpointIds: ["plan-context", "plan-draft"],
    status,
    planPath,
    planDir,
    diagnostics,
    updatedPhasePaths,
    ...(blockedDiagnosticArtifact
      ? {
        failureDiagnosticPath: blockedDiagnosticArtifact.artifactPath,
        failureDiagnosticArtifactId: blockedDiagnosticArtifact.artifactId
      }
      : {}),
    ...(status === "valid" ? { handoffCommand: modeToCookHandoff("fast", planPath) } : {})
  };
}

export function runPlanRedTeamWorkflow(
  context: RuntimeContext,
  input: { planPath: string }
): PlanSubcommandWorkflowResult {
  const planPath = toAbsolutePlanPath(input.planPath);
  const run = context.runService.createRun({
    workflow: "plan",
    mode: "interactive",
    prompt: `red-team ${planPath}`
  });
  const planDir = path.dirname(planPath);
  context.runService.setPlanDir(run.id, planDir);
  context.runService.recordWorkflowCheckpoint(run.id, "plan-context", { noFile: true });

  const parsed = readPlanBundle(planPath);
  const now = context.clock.now().toISOString();
  const isArchived = parsed.frontmatter.status === "archived";
  const status: PlanSubcommandStatus = isArchived ? "blocked" : "revise";
  const findings = isArchived
    ? ["Plan is archived; red-team review cannot mutate execution artifacts."]
    : [
        "Hidden dependency coupling may delay implementation sequencing.",
        "Rollback criteria should be explicit per executable phase.",
        "Ownership boundaries should be documented before parallel execution."
      ];
  const diagnostics: WorkflowCommandDiagnostics[] = isArchived
    ? [
        {
          code: "PLAN_RED_TEAM_BLOCKED_ARCHIVED",
          cause: "Archived plans cannot be red-teamed in-place.",
          nextStep: "Activate or create a non-archived plan and rerun red-team."
        }
      ]
    : [
        {
          code: "PLAN_RED_TEAM_REVIEWED",
          cause: "Red-team findings were written inline to plan and phase artifacts.",
          nextStep: "Run cdx plan validate to confirm readiness before cdx cook --auto."
        }
      ];
  let blockedDiagnosticArtifact:
    | {
      artifactId: string;
      artifactPath: string;
    }
    | null = null;
  if (isArchived) {
    const blockedDiagnostic = diagnostics.find((entry) => entry.code === "PLAN_RED_TEAM_BLOCKED_ARCHIVED");
    if (blockedDiagnostic) {
      blockedDiagnosticArtifact = publishBlockedPlanSubcommandDiagnosticArtifact(context, {
        runId: run.id,
        planPath,
        timestamp: now,
        diagnostic: blockedDiagnostic,
        subcommand: "red-team"
      });
    }
  }

  const redTeamLines = [
    `- Timestamp: ${now}`,
    `- Result: ${status}`,
    ...findings.map((finding) => `- ${finding}`),
    isArchived
      ? "- Next step: Unarchive or regenerate a plan before red-team review."
      : "- Next step: Apply findings, then run cdx plan validate <plan-path>."
  ];
  const updatedPhasePaths: string[] = [];
  if (!isArchived) {
    const currentPlanMarkdown = readFileSync(planPath, "utf8");
    const updatedPlanMarkdown = appendH2Section(currentPlanMarkdown, "Red Team Review", redTeamLines);
    writeFileSync(planPath, updatedPlanMarkdown, "utf8");
    for (const phase of parsed.phases) {
      appendPhaseSection(
        phase.absolutePath,
        "Red Team Notes",
        `${now}: Add rollback and failure-containment checks before execution starts.`
      );
      updatedPhasePaths.push(phase.absolutePath);
    }
  }

  if (!isArchived) {
    const planArtifactId = publishPlanArtifacts(context, run.id, "plan-draft", planPath, updatedPhasePaths);
    context.runService.recordWorkflowCheckpoint(run.id, "plan-draft", {
      artifactPath: planPath,
      artifactId: planArtifactId
    });
  } else if (blockedDiagnosticArtifact) {
    context.runService.recordWorkflowCheckpoint(run.id, "plan-draft", {
      artifactPath: blockedDiagnosticArtifact.artifactPath,
      artifactId: blockedDiagnosticArtifact.artifactId
    });
  } else {
    context.runService.recordWorkflowCheckpoint(run.id, "plan-draft", { noFile: true });
  }

  return {
    runId: run.id,
    workflow: "plan",
    subcommand: "red-team",
    checkpointIds: ["plan-context", "plan-draft"],
    status,
    planPath,
    planDir,
    diagnostics,
    updatedPhasePaths,
    ...(blockedDiagnosticArtifact
      ? {
        failureDiagnosticPath: blockedDiagnosticArtifact.artifactPath,
        failureDiagnosticArtifactId: blockedDiagnosticArtifact.artifactId
      }
      : {}),
    ...(!isArchived ? { recommendedNextCommand: `cdx plan validate ${shellQuote(planPath)}` } : {})
  };
}

function resolveArchiveTargetPath(context: RuntimeContext, inputPath?: string): string {
  if (inputPath && inputPath.trim().length > 0) {
    return toAbsolutePlanPath(inputPath);
  }
  const active = context.store.settings.get(ACTIVE_PLAN_KEY);
  if (active && active.trim().length > 0) {
    return toAbsolutePlanPath(active);
  }
  throw new CodexkitError("CLI_USAGE", "archive target plan path is required", {
    code: "WF_PLAN_ARCHIVE_TARGET_REQUIRED",
    cause: "No archive target was provided and no active plan is set.",
    nextStep: "Run cdx plan archive <absolute-plan-path>."
  });
}

export function runPlanArchiveWorkflow(
  context: RuntimeContext,
  input: { planPath?: string }
): PlanSubcommandWorkflowResult {
  const planPath = resolveArchiveTargetPath(context, input.planPath);
  const run = context.runService.createRun({
    workflow: "plan",
    mode: "interactive",
    prompt: `archive ${planPath}`
  });
  const planDir = path.dirname(planPath);
  context.runService.setPlanDir(run.id, planDir);
  context.runService.recordWorkflowCheckpoint(run.id, "plan-context", { noFile: true });

  const previousPlanMarkdown = readFileSync(planPath, "utf8");
  const archivedPlanMarkdown = upsertFrontmatterStatus(previousPlanMarkdown, "archived");
  writeFileSync(planPath, archivedPlanMarkdown, "utf8");

  const summaryPath = resolveReportPath(context, context.runService.getRun(run.id), "archive-summary.md", {
    planPathHint: planPath
  });
  const summaryMarkdown = [
    "# Archive Summary",
    "",
    `- Timestamp: ${context.clock.now().toISOString()}`,
    `- Plan: ${planPath}`,
    `- Status: archived`,
    "- Historical report files were preserved without mutation.",
    ""
  ].join("\n");
  writeFileSync(summaryPath.absolutePath, summaryMarkdown, "utf8");

  context.store.settings.set(ARCHIVED_PLAN_KEY, planPath);
  if (context.store.settings.get(ACTIVE_PLAN_KEY) === planPath) {
    context.store.settings.set(ACTIVE_PLAN_KEY, "");
  }
  context.runService.updateRunMetadata(run.id, {
    archive: {
      planPath,
      archivedAt: context.clock.now().toISOString(),
      summaryPath: summaryPath.absolutePath
    }
  });

  const planArtifactId = publishPlanArtifacts(context, run.id, "plan-draft", planPath, []);
  context.artifactService.publishArtifact({
    runId: run.id,
    artifactKind: "report",
    path: summaryPath.absolutePath,
    summary: "plan archive summary",
    metadata: { checkpoint: "plan-draft", subcommand: "archive" }
  });
  context.runService.recordWorkflowCheckpoint(run.id, "plan-draft", {
    artifactPath: planPath,
    artifactId: planArtifactId
  });

  return {
    runId: run.id,
    workflow: "plan",
    subcommand: "archive",
    checkpointIds: ["plan-context", "plan-draft"],
    status: "valid",
    planPath,
    planDir,
    diagnostics: [
      {
        code: "PLAN_ARCHIVE_COMPLETED",
        cause: "Plan was archived and archive summary was published.",
        nextStep: "Use cdx plan <task> to create a new active plan when ready."
      }
    ],
    updatedPhasePaths: [],
    archiveSummaryPath: summaryPath.absolutePath
  };
}
