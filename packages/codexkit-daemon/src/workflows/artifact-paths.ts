import { mkdirSync } from "node:fs";
import path from "node:path";
import type { RunRecord, ValidationSuiteId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { readWorkflowState } from "./workflow-state.ts";
import {
  PHASE9_VALIDATION_EVIDENCE_FILE_NAMES,
  PHASE9_VALIDATION_REPORT_FILE_NAMES,
  type FinalizeArtifactNames
} from "./contracts.ts";

export const FINALIZE_ARTIFACT_NAMES: FinalizeArtifactNames = {
  unresolvedMapping: "unresolved-mapping-report.md",
  docsImpact: "docs-impact-report.md",
  gitHandoff: "git-handoff-report.md",
  finalize: "finalize-report.md"
};

export type Phase9ReportKind = ValidationSuiteId | "migration-checklist" | "release-readiness";

export const PHASE9_REPORT_FILE_NAMES = {
  ...PHASE9_VALIDATION_EVIDENCE_FILE_NAMES,
  "migration-checklist": PHASE9_VALIDATION_REPORT_FILE_NAMES.migrationChecklist,
  "release-readiness": PHASE9_VALIDATION_REPORT_FILE_NAMES.releaseReadiness
} as const;

export interface ResolvedReportPath {
  absolutePath: string;
  rootDir: string;
  scope: "plan" | "run";
}

function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

function runArtifactDir(context: RuntimeContext, runId: string): string {
  return ensureDir(path.join(context.config.paths.artifactsDir, runId));
}

function activePlanDir(run: RunRecord): string | null {
  if (run.planDir) {
    return path.resolve(run.planDir);
  }
  const state = readWorkflowState(run);
  return state.activePlanPath ? path.dirname(path.resolve(state.activePlanPath)) : null;
}

export function resolveReportPath(
  context: RuntimeContext,
  run: RunRecord,
  fileName: string,
  options?: { planPathHint?: string; creatingPlan?: boolean }
): ResolvedReportPath {
  const hint = options?.planPathHint ? path.resolve(options.planPathHint) : null;
  const effectivePlanDir = hint ? path.dirname(hint) : activePlanDir(run);
  const shouldUseRunArtifacts = options?.creatingPlan === true && !effectivePlanDir;

  if (!shouldUseRunArtifacts && effectivePlanDir) {
    const reportsDir = ensureDir(path.join(effectivePlanDir, "reports"));
    return {
      absolutePath: path.join(reportsDir, fileName),
      rootDir: reportsDir,
      scope: "plan"
    };
  }

  const runDir = runArtifactDir(context, run.id);
  return {
    absolutePath: path.join(runDir, fileName),
    rootDir: runDir,
    scope: "run"
  };
}

export function resolvePhase9ReportPath(
  context: RuntimeContext,
  run: RunRecord,
  kind: Phase9ReportKind,
  options?: { planPathHint?: string }
): ResolvedReportPath {
  return resolveReportPath(context, run, PHASE9_REPORT_FILE_NAMES[kind], options);
}
