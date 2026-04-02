import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  loadRuntimeConfig,
  openRuntimeContext,
  RuntimeController,
  runPlanArchiveWorkflow,
  runPlanWorkflow,
  runPreviewWorkflow
} from "../../packages/codexkit-daemon/src/index.ts";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 12 phase 3 archive and preview runtime", () => {
  test("archive requires confirmation before mutating plan state and publishes durable summary plus journal artifacts after approval", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase12-archive-runtime");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const plan = runPlanWorkflow(context, { task: "Phase 12 archive confirmation contract", mode: "hard" });
    const planBeforeArchive = readFileSync(plan.planPath, "utf8");

    const archive = runPlanArchiveWorkflow(context, { planPath: plan.planPath }) as {
      runId: string;
      subcommand: string;
      status: string;
      pendingApproval?: { approvalId?: string; checkpoint?: string; nextStep?: string };
      archiveSummaryPath?: string;
      archiveJournalPath?: string;
      archiveJournalArtifactId?: string;
      checkpointIds?: string[];
    };

    expect(archive.subcommand).toBe("archive");
    expect(archive.status).toBe("pending");
    expect(archive.pendingApproval?.checkpoint).toBe("plan-archive-confirmation");
    expect(typeof archive.pendingApproval?.approvalId).toBe("string");
    expect(String(archive.pendingApproval?.nextStep ?? "")).toContain("cdx approval respond");
    expect(archive.archiveSummaryPath).toBeUndefined();
    expect(archive.archiveJournalPath).toBeUndefined();
    expect(archive.archiveJournalArtifactId).toBeUndefined();
    expect(readFileSync(plan.planPath, "utf8")).toBe(planBeforeArchive);

    const shownBeforeApproval = context.runService.getRun(archive.runId);
    const metadataBeforeApproval = shownBeforeApproval?.metadata as { workflow?: { currentCheckpoint?: string } } | undefined;
    expect(metadataBeforeApproval?.workflow?.currentCheckpoint).toBe("plan-archive-confirmation");
    expect(context.artifactService.listArtifacts({ runId: archive.runId })).toHaveLength(0);

    const approved = new RuntimeController(fixture.rootDir).respondApproval({
      approvalId: String(archive.pendingApproval?.approvalId),
      status: "approved"
    }) as {
      continuation?: {
        status: string;
        checkpointIds?: string[];
        archiveSummaryPath?: string;
        archiveJournalPath?: string;
        archiveJournalArtifactId?: string;
      };
    };

    expect(approved.continuation?.status).toBe("valid");
    expect(approved.continuation?.checkpointIds).toContain("plan-archive-confirmation");
    expect(typeof approved.continuation?.archiveSummaryPath).toBe("string");
    expect(typeof approved.continuation?.archiveJournalPath).toBe("string");
    expect(typeof approved.continuation?.archiveJournalArtifactId).toBe("string");
    expect(existsSync(String(approved.continuation?.archiveSummaryPath))).toBe(true);
    expect(existsSync(String(approved.continuation?.archiveJournalPath))).toBe(true);

    const planAfterApproval = readFileSync(plan.planPath, "utf8");
    expect(planAfterApproval).toContain('status: "archived"');

    const archiveSummary = readFileSync(String(approved.continuation?.archiveSummaryPath), "utf8");
    expect(archiveSummary.toLowerCase()).toContain("archive");

    const archiveJournal = readFileSync(String(approved.continuation?.archiveJournalPath), "utf8");
    expect(archiveJournal.toLowerCase()).toContain("journal");
    expect(archiveJournal.toLowerCase()).toContain("archive");

    const artifacts = context.artifactService.listArtifacts({ runId: archive.runId });
    expect(artifacts.some((artifact) => artifact.path === approved.continuation?.archiveSummaryPath)).toBe(true);
    expect(artifacts.some((artifact) => artifact.path === approved.continuation?.archiveJournalPath)).toBe(true);
    expect(artifacts.some((artifact) => artifact.id === approved.continuation?.archiveJournalArtifactId)).toBe(true);
  });

  test("preview emits markdown and view-url artifacts and publishes both through durable artifact listings", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase12-preview-runtime");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const preview = runPreviewWorkflow(context, {
      target: path.join(fixture.rootDir, "docs", "preview-target.md"),
      mode: "explain"
    }) as {
      runId: string;
      workflow: string;
      checkpointIds?: string[];
      previewOutputPath?: string;
      previewOutputArtifactId?: string;
      previewViewUrl?: string;
      previewViewUrlPath?: string;
      previewViewUrlArtifactId?: string;
    };

    expect(preview.workflow).toBe("preview");
    expect(preview.checkpointIds).toContain("preview-render");
    expect(typeof preview.previewOutputPath).toBe("string");
    expect(typeof preview.previewOutputArtifactId).toBe("string");
    expect(typeof preview.previewViewUrl).toBe("string");
    expect(typeof preview.previewViewUrlPath).toBe("string");
    expect(typeof preview.previewViewUrlArtifactId).toBe("string");
    expect(existsSync(String(preview.previewOutputPath))).toBe(true);
    expect(existsSync(String(preview.previewViewUrlPath))).toBe(true);
    expect(String(preview.previewViewUrl)).toMatch(/^file:\/\//);

    const previewOutput = readFileSync(String(preview.previewOutputPath), "utf8");
    expect(previewOutput.toLowerCase()).toContain("preview");

    const previewView = readFileSync(String(preview.previewViewUrlPath), "utf8");
    expect(previewView).toContain(String(preview.previewViewUrl));

    const artifacts = context.artifactService.listArtifacts({ runId: preview.runId });
    expect(artifacts.some((artifact) => artifact.path === preview.previewOutputPath)).toBe(true);
    expect(artifacts.some((artifact) => artifact.id === preview.previewOutputArtifactId)).toBe(true);
    expect(artifacts.some((artifact) => artifact.path === preview.previewViewUrlPath)).toBe(true);
    expect(artifacts.some((artifact) => artifact.id === preview.previewViewUrlArtifactId)).toBe(true);
  });
});
