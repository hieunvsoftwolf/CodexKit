import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void>> = [];

function runCli(rootDir: string, args: string[]) {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8"
  });
  return JSON.parse(output) as Record<string, unknown>;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 12 phase 3 archive and preview CLI", () => {
  test(
    "real cdx archive flow gates plan mutation until approval resolves and publishes summary plus journal artifacts",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-phase12-archive-cli");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const plan = runCli(fixture.rootDir, ["plan", "Phase", "12", "archive", "cli", "--hard"]);
      const planPath = String(plan.planPath);
      const planBeforeArchive = readFileSync(planPath, "utf8");

      const archive = runCli(fixture.rootDir, ["plan", "archive", planPath]) as {
        runId?: string;
        subcommand?: string;
        status?: string;
        pendingApproval?: { approvalId?: string; checkpoint?: string; nextStep?: string };
        archiveSummaryPath?: string;
        archiveJournalPath?: string;
      };

      expect(archive.subcommand).toBe("archive");
      expect(archive.status).toBe("pending");
      expect(archive.pendingApproval?.checkpoint).toBe("plan-archive-confirmation");
      expect(typeof archive.pendingApproval?.approvalId).toBe("string");
      expect(String(archive.pendingApproval?.nextStep ?? "")).toContain("cdx approval respond");
      expect(archive.archiveSummaryPath).toBeUndefined();
      expect(archive.archiveJournalPath).toBeUndefined();
      expect(readFileSync(planPath, "utf8")).toBe(planBeforeArchive);

      const approved = runCli(fixture.rootDir, [
        "approval",
        "respond",
        String(archive.pendingApproval?.approvalId),
        "--response",
        "approve"
      ]) as {
        continuation?: {
          status?: string;
          archiveSummaryPath?: string;
          archiveJournalPath?: string;
          archiveJournalArtifactId?: string;
        };
      };

      expect(approved.continuation?.status).toBe("valid");
      expect(typeof approved.continuation?.archiveSummaryPath).toBe("string");
      expect(typeof approved.continuation?.archiveJournalPath).toBe("string");
      expect(typeof approved.continuation?.archiveJournalArtifactId).toBe("string");
      expect(existsSync(String(approved.continuation?.archiveSummaryPath))).toBe(true);
      expect(existsSync(String(approved.continuation?.archiveJournalPath))).toBe(true);
      expect(readFileSync(planPath, "utf8")).toContain('status: "archived"');

      const shownRun = runCli(fixture.rootDir, ["run", "show", String(archive.runId)]);
      const artifacts = (shownRun.artifacts ?? []) as Array<{ id?: string; path?: string }>;
      expect(artifacts.some((artifact) => artifact.path === approved.continuation?.archiveSummaryPath)).toBe(true);
      expect(artifacts.some((artifact) => artifact.path === approved.continuation?.archiveJournalPath)).toBe(true);
      expect(artifacts.some((artifact) => artifact.id === approved.continuation?.archiveJournalArtifactId)).toBe(true);
    }
  );

  test(
    "real cdx preview flow emits markdown and view-url artifacts through the public CLI entrypoint",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-phase12-preview-cli");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const preview = runCli(fixture.rootDir, ["preview", "Phase", "12", "archive", "preview", "--explain"]) as {
        runId?: string;
        workflow?: string;
        previewOutputPath?: string;
        previewOutputArtifactId?: string;
        previewViewUrl?: string;
        previewViewUrlPath?: string;
        previewViewUrlArtifactId?: string;
      };

      expect(preview.workflow).toBe("preview");
      expect(typeof preview.previewOutputPath).toBe("string");
      expect(typeof preview.previewOutputArtifactId).toBe("string");
      expect(typeof preview.previewViewUrl).toBe("string");
      expect(typeof preview.previewViewUrlPath).toBe("string");
      expect(typeof preview.previewViewUrlArtifactId).toBe("string");
      expect(existsSync(String(preview.previewOutputPath))).toBe(true);
      expect(existsSync(String(preview.previewViewUrlPath))).toBe(true);
      expect(String(preview.previewViewUrl)).toMatch(/^file:\/\//);
      expect(readFileSync(String(preview.previewViewUrlPath), "utf8")).toContain(String(preview.previewViewUrl));

      const shownRun = runCli(fixture.rootDir, ["run", "show", String(preview.runId)]);
      const artifacts = (shownRun.artifacts ?? []) as Array<{ id?: string; path?: string }>;
      expect(artifacts.some((artifact) => artifact.path === preview.previewOutputPath)).toBe(true);
      expect(artifacts.some((artifact) => artifact.id === preview.previewOutputArtifactId)).toBe(true);
      expect(artifacts.some((artifact) => artifact.path === preview.previewViewUrlPath)).toBe(true);
      expect(artifacts.some((artifact) => artifact.id === preview.previewViewUrlArtifactId)).toBe(true);
    }
  );
});
