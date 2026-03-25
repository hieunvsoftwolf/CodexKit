import type { RuntimeContext } from "../runtime-context.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";
import { PHASE8_ARTIFACT_FILE_NAMES, type MigrationAssistantSummary, type SharedRepoScanResult } from "./packaging-contracts.ts";

function recommendedCommands(scan: SharedRepoScanResult, workflowName: "init" | "doctor" | "update"): string[] {
  if (scan.repoClass === "fresh") {
    return ["cdx init", "cdx init --apply", "cdx doctor"];
  }
  if (scan.repoClass === "claudekit-style") {
    return ["cdx init", "cdx init --apply --approve-protected", "cdx doctor"];
  }
  if (scan.repoClass === "install-only-no-initial-commit") {
    return ["git add . && git commit -m 'bootstrap codexkit install'", "cdx doctor", "cdx resume"];
  }
  if (scan.repoClass === "existing-codexkit") {
    if (workflowName === "update") {
      return ["cdx update", "cdx update --apply", "cdx doctor"];
    }
    return ["cdx doctor", "cdx update", "cdx resume"];
  }
  return ["cdx doctor", "repair .codexkit install metadata", "cdx init --apply once repo state is fixed"];
}

export function createMigrationAssistantSummary(
  scan: SharedRepoScanResult,
  workflowName: "init" | "doctor" | "update"
): MigrationAssistantSummary {
  return {
    repoClass: scan.repoClass,
    markers: scan.markers,
    requiredActions: scan.requiredActions,
    riskyCustomizations: scan.riskyCustomizations,
    recommendedNextCommands: recommendedCommands(scan, workflowName)
  };
}

function renderMigrationAssistantReport(summary: MigrationAssistantSummary): string {
  const lines = [
    "# Migration Assistant Report",
    "",
    `- Repo class: ${summary.repoClass}`,
    "",
    "## Detected Source Kit Markers"
  ];
  if (summary.markers.length === 0) {
    lines.push("- none");
  } else {
    for (const marker of summary.markers) {
      lines.push(`- ${marker}`);
    }
  }
  lines.push("", "## Required Install Or Upgrade Actions");
  if (summary.requiredActions.length === 0) {
    lines.push("- none");
  } else {
    for (const action of summary.requiredActions) {
      lines.push(`- ${action}`);
    }
  }
  lines.push("", "## Risky Customizations Needing Manual Review");
  if (summary.riskyCustomizations.length === 0) {
    lines.push("- none");
  } else {
    for (const risky of summary.riskyCustomizations) {
      lines.push(`- ${risky}`);
    }
  }
  lines.push("", "## Recommended Next Command Sequence");
  if (summary.recommendedNextCommands.length === 0) {
    lines.push("- none");
  } else {
    for (const command of summary.recommendedNextCommands) {
      lines.push(`- ${command}`);
    }
  }
  lines.push("", "## Unresolved Questions", "- none", "");
  return lines.join("\n");
}

export function publishMigrationAssistantReport(input: {
  context: RuntimeContext;
  runId: string;
  checkpoint: "package-scan" | "doctor-scan" | "update-scan";
  scan: SharedRepoScanResult;
  workflowName: "init" | "doctor" | "update";
  planPathHint?: string;
}): { summary: MigrationAssistantSummary; artifactPath: string; artifactId: string } {
  const summary = createMigrationAssistantSummary(input.scan, input.workflowName);
  const published = publishWorkflowReport(input.context, {
    runId: input.runId,
    checkpoint: input.checkpoint,
    fileName: PHASE8_ARTIFACT_FILE_NAMES.migrationAssistant,
    summary: "migration assistant report",
    markdown: renderMigrationAssistantReport(summary),
    ...(input.planPathHint ? { planPathHint: input.planPathHint } : {}),
    metadata: {
      migrationAssistant: true,
      repoClass: summary.repoClass
    }
  });
  return {
    summary,
    artifactPath: published.artifactPath,
    artifactId: published.artifactId
  };
}
