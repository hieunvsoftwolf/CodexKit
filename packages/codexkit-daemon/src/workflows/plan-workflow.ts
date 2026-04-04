import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RunMode } from "../../../codexkit-core/src/index.ts";
import { resolveReportPath } from "./artifact-paths.ts";
import type { PlanMode, WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { modeToCookHandoff, planModeToRunMode } from "./contracts.ts";
import { hydratePlanTasks, renderHydrationReport } from "./hydration-engine.ts";
import { createPlanBundle, writePlanBundle } from "./plan-files.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { readWorkflowState, writeWorkflowState } from "./workflow-state.ts";

const ACTIVE_PLAN_KEY = "workflow.plan.active.path";

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "plan";
}

function timestampParts(iso: string): { compactDate: string; compactTime: string } {
  const normalized = iso.replace(/[-:]/g, "");
  return { compactDate: normalized.slice(0, 8), compactTime: normalized.slice(9, 13) };
}

function readBranch(rootDir: string): string {
  const headPath = path.join(rootDir, ".git", "HEAD");
  try {
    const content = readFileSync(headPath, "utf8").trim();
    const refMatch = content.match(/^ref:\s+refs\/heads\/(.+)$/);
    return refMatch?.[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

function findSuggestedPlanPath(rootDir: string, activePlanPath: string | null): string | null {
  const plansDir = path.join(rootDir, "plans");
  try {
    const entries = readdirSync(plansDir, { withFileTypes: true });
    const candidates = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(plansDir, entry.name, "plan.md"))
      .filter((candidate) => {
        try {
          return readFileSync(candidate, "utf8").includes("# Plan");
        } catch {
          return false;
        }
      })
      .sort()
      .reverse();
    const active = activePlanPath ? path.resolve(activePlanPath) : null;
    return candidates.find((candidate) => path.resolve(candidate) !== active) ?? null;
  } catch {
    return null;
  }
}

function resolvePlanMode(mode?: PlanMode): PlanMode {
  return mode ?? "hard";
}

export interface PlanWorkflowInput {
  task: string;
  mode?: PlanMode;
  noTasks?: boolean;
}

export interface PlanWorkflowResult extends WorkflowBaseResult {
  workflow: "plan";
  planPath: string;
  planDir: string;
  phasePaths: string[];
  handoffCommand: string;
  diagnostics: WorkflowCommandDiagnostics[];
  mode: PlanMode;
  runMode: RunMode;
  hydration: ReturnType<typeof hydratePlanTasks>;
}

export function runPlanWorkflow(context: RuntimeContext, input: PlanWorkflowInput): PlanWorkflowResult {
  const mode = resolvePlanMode(input.mode);
  const runMode = planModeToRunMode(mode);
  const run = context.runService.createRun({
    workflow: "plan",
    mode: runMode,
    prompt: input.task
  });

  const activePlanPath = context.store.settings.get(ACTIVE_PLAN_KEY);
  const suggestedPlanPath = findSuggestedPlanPath(context.config.paths.rootDir, activePlanPath);
  writeWorkflowState(context.runService, run.id, {
    ...readWorkflowState(run),
    checkpoints: {},
    ...(activePlanPath ? { activePlanPath: path.resolve(activePlanPath) } : {}),
    ...(suggestedPlanPath ? { suggestedPlanPath } : {})
  });
  context.runService.recordWorkflowCheckpoint(run.id, "plan-context", { noFile: true });

  const now = context.clock.now().toISOString();
  const stamp = timestampParts(now);
  const planSlug = slugify(input.task);
  const planDir = path.join(context.config.paths.rootDir, "plans", `${stamp.compactDate}-${stamp.compactTime}-${planSlug}`);
  mkdirSync(planDir, { recursive: true });
  const planBundle = createPlanBundle({
    task: input.task,
    branch: readBranch(context.config.paths.rootDir),
    createdAt: now,
    mode,
    rootDir: context.config.paths.rootDir
  });
  const written = writePlanBundle(planDir, planBundle);
  context.runService.setPlanDir(run.id, planDir);
  context.store.settings.set(ACTIVE_PLAN_KEY, written.planPath);
  writeWorkflowState(context.runService, run.id, {
    ...readWorkflowState(context.runService.getRun(run.id)),
    activePlanPath: written.planPath,
    ...(suggestedPlanPath ? { suggestedPlanPath } : {})
  });

  const planArtifact = context.artifactService.publishArtifact({
    runId: run.id,
    artifactKind: "plan",
    path: written.planPath,
    summary: "plan.md generated",
    metadata: { checkpoint: "plan-draft" }
  });
  for (const phasePath of written.phasePaths) {
    context.artifactService.publishArtifact({
      runId: run.id,
      artifactKind: "plan",
      path: phasePath,
      summary: `phase plan file ${path.basename(phasePath)}`
    });
  }
  context.runService.recordWorkflowCheckpoint(run.id, "plan-draft", {
    artifactPath: written.planPath,
    artifactId: planArtifact.id
  });

  const hydration = hydratePlanTasks(context, {
    runId: run.id,
    planPath: written.planPath,
    ...(input.noTasks !== undefined ? { noTasks: input.noTasks } : {})
  });
  const hydrationReport = renderHydrationReport(hydration, written.planPath);
  const hydrationReportPath = resolveReportPath(context, context.runService.getRun(run.id), "task-hydration-report.md", {
    planPathHint: written.planPath
  });
  writeFileSync(hydrationReportPath.absolutePath, hydrationReport, "utf8");
  const hydrationArtifact = context.artifactService.publishArtifact({
    runId: run.id,
    artifactKind: "report",
    path: hydrationReportPath.absolutePath,
    summary: "task hydration report",
    metadata: { checkpoint: "plan-hydration", skipped: hydration.skipped }
  });
  context.runService.recordWorkflowCheckpoint(run.id, "plan-hydration", {
    artifactPath: hydrationArtifact.path,
    artifactId: hydrationArtifact.id
  });

  return {
    runId: run.id,
    workflow: "plan",
    checkpointIds: ["plan-context", "plan-draft", "plan-hydration"],
    planPath: written.planPath,
    planDir,
    phasePaths: written.phasePaths,
    handoffCommand: modeToCookHandoff(mode, written.planPath),
    diagnostics: [
      {
        code: "PLAN_SUGGESTED_HINT_ISOLATED",
        cause: suggestedPlanPath ? "Suggested plan is stored as hint only until explicit activation" : "No suggested plan hint found",
        nextStep: "Use the returned absolute plan path for continuation."
      }
    ],
    mode,
    runMode,
    hydration
  };
}
