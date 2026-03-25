import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { readDaemonStatus } from "../daemon-state.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";
import { PHASE8_ARTIFACT_FILE_NAMES, type PackagingRepoClass } from "./packaging-contracts.ts";
import { publishMigrationAssistantReport } from "./migration-assistant.ts";
import { readInstallState, readReleaseManifest } from "./phase8-install-state.ts";
import { runSharedRepoScan } from "./repo-scan-engine.ts";

export type DoctorSeverity = "error" | "warn" | "info";

export interface DoctorFinding {
  severity: DoctorSeverity;
  code: string;
  cause: string;
  nextStep: string;
}

export interface DoctorWorkflowResult extends WorkflowBaseResult {
  workflow: "doctor";
  repoClass: PackagingRepoClass;
  status: "healthy" | "degraded" | "blocked";
  findings: DoctorFinding[];
  diagnostics: WorkflowCommandDiagnostics[];
  doctorReportPath: string;
  doctorReportArtifactId: string;
  migrationAssistantReportPath: string;
  migrationAssistantReportArtifactId: string;
}

function toolAvailable(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

function addFinding(
  findings: DoctorFinding[],
  severity: DoctorSeverity,
  code: string,
  cause: string,
  nextStep: string
): void {
  findings.push({ severity, code, cause, nextStep });
}

function summarizeDoctorStatus(findings: DoctorFinding[]): "healthy" | "degraded" | "blocked" {
  if (findings.some((finding) => finding.severity === "error")) {
    return "blocked";
  }
  if (findings.some((finding) => finding.severity === "warn")) {
    return "degraded";
  }
  return "healthy";
}

function renderFindingList(findings: DoctorFinding[]): string[] {
  if (findings.length === 0) {
    return ["- none"];
  }
  return findings.map((finding) => `${finding.severity.toUpperCase()} | ${finding.code} | ${finding.cause} | ${finding.nextStep}`);
}

interface JsonFileInspection {
  exists: boolean;
  valid: boolean;
}

function inspectJsonFile(filePath: string): JsonFileInspection {
  if (!existsSync(filePath)) {
    return { exists: false, valid: false };
  }
  try {
    JSON.parse(readFileSync(filePath, "utf8"));
    return { exists: true, valid: true };
  } catch {
    return { exists: true, valid: false };
  }
}

function normalizeRelativePath(rawPath: string): string {
  return path.normalize(rawPath).replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function renderDoctorReport(input: {
  repoClass: PackagingRepoClass;
  status: "healthy" | "degraded" | "blocked";
  findings: DoctorFinding[];
  diagnostics: WorkflowCommandDiagnostics[];
}): string {
  return [
    "# Doctor Report",
    "",
    `- Repo class: ${input.repoClass}`,
    `- Status: ${input.status}`,
    "",
    "## Findings",
    ...renderFindingList(input.findings),
    "",
    "## Diagnostics",
    ...renderFindingList(
      input.diagnostics.map((item) => ({
        severity: "info",
        code: item.code,
        cause: item.cause,
        nextStep: item.nextStep
      }))
    ),
    "",
    "## Unresolved Questions",
    "- none",
    ""
  ].join("\n");
}

export function runDoctorWorkflow(context: RuntimeContext): DoctorWorkflowResult {
  const run = context.runService.createRun({
    workflow: "doctor",
    mode: "interactive",
    prompt: "cdx doctor"
  });
  const checkpointIds: WorkflowCheckpointId[] = [];
  const scan = runSharedRepoScan(context.config.paths.rootDir);
  const findings: DoctorFinding[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [...scan.diagnostics];

  const migrationAssistant = publishMigrationAssistantReport({
    context,
    runId: run.id,
    checkpoint: "doctor-scan",
    scan,
    workflowName: "doctor"
  });

  const codexCliFound = toolAvailable("codex", ["--version"]);
  if (!codexCliFound) {
    addFinding(
      findings,
      "error",
      "DOCTOR_CODEX_CLI_MISSING",
      "Codex CLI is not available in PATH.",
      "Install Codex CLI and rerun cdx doctor."
    );
  }
  const nodeFound = toolAvailable("node", ["--version"]);
  if (!nodeFound) {
    addFinding(findings, "error", "DOCTOR_NODE_MISSING", "Node runtime is missing.", "Install Node and rerun cdx doctor.");
  }
  const gitFound = toolAvailable("git", ["--version"]);
  if (!gitFound) {
    addFinding(findings, "error", "DOCTOR_GIT_MISSING", "git is not available in PATH.", "Install git and rerun cdx doctor.");
  } else {
    if (scan.hasGitRepo) {
      if (!toolAvailable("git", ["worktree", "list"])) {
        addFinding(
          findings,
          "error",
          "DOCTOR_GIT_WORKTREE_UNAVAILABLE",
          "git worktree capability is unavailable.",
          "Upgrade git to a version with worktree support."
        );
      }
      if (!scan.hasInitialCommit) {
        addFinding(
          findings,
          "warn",
          "DOCTOR_INSTALL_ONLY_REPO",
          "Repo has no initial commit; worker-backed workflows remain blocked.",
          "Create first commit, then rerun cdx doctor."
        );
      }
    } else {
      addFinding(
        findings,
        "warn",
        "DOCTOR_REPO_NOT_GIT",
        "Repo is not git-backed.",
        "Run cdx init --apply --init-git --approve-git-init or initialize git manually."
      );
    }
  }

  const installState = readInstallState(context.config.paths.rootDir);
  const releaseManifest = readReleaseManifest(context.config.paths.rootDir);
  if (!installState) {
    addFinding(
      findings,
      "warn",
      "DOCTOR_INSTALL_STATE_MISSING",
      "Install-state metadata is missing.",
      "Run cdx init --apply to establish managed install metadata."
    );
  }
  if (!releaseManifest) {
    addFinding(
      findings,
      "warn",
      "DOCTOR_RELEASE_MANIFEST_MISSING",
      "Release-manifest metadata is missing.",
      "Run cdx init --apply or cdx update --apply to regenerate release manifest."
    );
  }
  if (installState) {
    const canonicalImportRegistryRelative = path.relative(
      context.config.paths.rootDir,
      path.join(context.config.paths.rootDir, ".codexkit", "manifests", "import-registry.json")
    ).replace(/\\/g, "/");
    const declaredImportRegistryRelative = installState.sourceRegistryPath
      ? normalizeRelativePath(installState.sourceRegistryPath)
      : null;
    const expectedImportRegistryRelative = declaredImportRegistryRelative ?? canonicalImportRegistryRelative;
    const expectedImportRegistryPath = path.join(context.config.paths.rootDir, expectedImportRegistryRelative);
    const importRegistry = inspectJsonFile(expectedImportRegistryPath);

    if (!declaredImportRegistryRelative) {
      addFinding(
        findings,
        "error",
        "DOCTOR_IMPORT_REGISTRY_POINTER_MISSING",
        "Install-state metadata does not declare a source import-registry path.",
        "Run cdx init --apply or cdx update --apply to restore managed install metadata."
      );
    } else if (declaredImportRegistryRelative !== canonicalImportRegistryRelative) {
      addFinding(
        findings,
        "warn",
        "DOCTOR_IMPORT_REGISTRY_PATH_DRIFT",
        `Install-state points to '${declaredImportRegistryRelative}' instead of '${canonicalImportRegistryRelative}'.`,
        "Run cdx update --apply to realign install metadata with the canonical import-registry path."
      );
    }
    if (!importRegistry.exists) {
      addFinding(
        findings,
        "error",
        "DOCTOR_IMPORT_REGISTRY_MISSING",
        `Import-registry metadata is missing at '${expectedImportRegistryRelative}'.`,
        "Run cdx init --apply or cdx update --apply to regenerate import-registry metadata."
      );
    } else if (!importRegistry.valid) {
      addFinding(
        findings,
        "error",
        "DOCTOR_IMPORT_REGISTRY_INVALID",
        `Import-registry metadata at '${expectedImportRegistryRelative}' is invalid JSON.`,
        "Restore a valid import-registry file, then rerun cdx doctor."
      );
    }
  }
  if (!existsSync(path.join(context.config.paths.rootDir, "README.md"))) {
    addFinding(
      findings,
      "warn",
      "DOCTOR_README_MISSING",
      "Root README.md is missing.",
      "Run cdx init --apply to generate managed README.md or add one manually."
    );
  }

  const daemonStatus = readDaemonStatus(context.config.paths);
  if (existsSync(context.config.paths.daemonLockPath) && !(daemonStatus?.live ?? false)) {
    addFinding(
      findings,
      "warn",
      "DOCTOR_DAEMON_LOCK_STALE",
      "Daemon lock exists but daemon is not live.",
      "Clear stale lock by restarting daemon or removing stale lock file if confirmed safe."
    );
  }

  const resumableRuns = context.runService.resumeCandidates(20);
  if (resumableRuns.length > 0) {
    addFinding(
      findings,
      "info",
      "DOCTOR_RESUMABLE_RUNS_PRESENT",
      `Found ${resumableRuns.length} resumable run(s).`,
      "Run cdx resume to inspect and recover interrupted workflows."
    );
  }

  const worktreeDir = context.config.paths.worktreesDir;
  if (existsSync(worktreeDir)) {
    const retained = readdirSync(worktreeDir).filter((entry) => entry.length > 0);
    if (retained.length > 0) {
      addFinding(
        findings,
        "info",
        "DOCTOR_RETAINED_WORKTREES_PRESENT",
        `Found ${retained.length} retained runtime worktree(s).`,
        "Inspect retained worktrees before cleanup if recovery evidence is needed."
      );
    }
  }

  if (scan.repoClass === "unsupported-or-broken") {
    addFinding(
      findings,
      "error",
      "DOCTOR_REPO_STATE_UNSUPPORTED",
      "Repo state is unsupported or broken for managed workflows.",
      "Repair install metadata and rerun cdx doctor."
    );
  }

  const status = summarizeDoctorStatus(findings);
  const doctorReport = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "doctor-scan",
    fileName: PHASE8_ARTIFACT_FILE_NAMES.doctor,
    summary: "doctor workflow report",
    markdown: renderDoctorReport({
      repoClass: scan.repoClass,
      status,
      findings,
      diagnostics
    }),
    metadata: {
      workflow: "doctor",
      status
    }
  });
  context.runService.recordWorkflowCheckpoint(run.id, "doctor-scan", {
    artifactPath: doctorReport.artifactPath,
    artifactId: doctorReport.artifactId
  });
  checkpointIds.push("doctor-scan");

  return {
    runId: run.id,
    workflow: "doctor",
    checkpointIds,
    repoClass: scan.repoClass,
    status,
    findings,
    diagnostics,
    doctorReportPath: doctorReport.artifactPath,
    doctorReportArtifactId: doctorReport.artifactId,
    migrationAssistantReportPath: migrationAssistant.artifactPath,
    migrationAssistantReportArtifactId: migrationAssistant.artifactId
  };
}
