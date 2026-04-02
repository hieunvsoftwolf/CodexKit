import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CodexkitError, type WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type {
  PreviewMode,
  PreviewWorkflowInput,
  PreviewWorkflowResult,
  WorkflowCommandDiagnostics
} from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";

const PREVIEW_MODES: PreviewMode[] = ["explain", "slides", "diagram", "ascii"];

function resolvePreviewMode(mode: string | undefined): PreviewMode {
  if (!mode) {
    return "explain";
  }
  if ((PREVIEW_MODES as string[]).includes(mode)) {
    return mode as PreviewMode;
  }
  throw new CodexkitError("CLI_USAGE", "unsupported preview mode", {
    code: "WF_PREVIEW_MODE_INVALID",
    cause: `Unsupported preview mode '${mode}'.`,
    nextStep: "Use preview modes: explain, slides, diagram, ascii."
  });
}

function resolveTarget(context: RuntimeContext, target: string | undefined): {
  displayTarget: string;
  sourceKind: "repo-root" | "file" | "directory" | "topic";
  resolvedPath?: string;
} {
  const trimmed = target?.trim() ?? "";
  if (trimmed.length === 0) {
    return {
      displayTarget: context.config.paths.rootDir,
      sourceKind: "repo-root",
      resolvedPath: context.config.paths.rootDir
    };
  }

  const resolvedPath = path.resolve(context.config.paths.rootDir, trimmed);
  if (!existsSync(resolvedPath)) {
    return {
      displayTarget: trimmed,
      sourceKind: "topic"
    };
  }

  const stats = statSync(resolvedPath);
  return {
    displayTarget: resolvedPath,
    sourceKind: stats.isDirectory() ? "directory" : "file",
    resolvedPath
  };
}

function renderPreviewMarkdown(input: {
  timestamp: string;
  mode: PreviewMode;
  target: ReturnType<typeof resolveTarget>;
  stopRequested: boolean;
}): string {
  const lines = [
    "# Preview Output",
    "",
    `- Timestamp: ${input.timestamp}`,
    `- Mode: ${input.mode}`,
    `- Target: ${input.target.displayTarget}`,
    `- Source kind: ${input.target.sourceKind}`,
    `- Stop requested: ${input.stopRequested ? "yes" : "no"}`,
    "",
    "## Summary",
    input.stopRequested
      ? "- No preview server is currently managed in this phase, so --stop is a safe no-op."
      : "- Preview generated in terminal/file-first mode for this phase.",
    input.target.sourceKind === "topic"
      ? "- Target was interpreted as a topic hint rather than an existing path."
      : "- Target resolved to an existing workspace path.",
    "",
    "## Next Steps",
    "- Open the emitted markdown artifact directly, or use the emitted file:// view URL.",
    "",
    "## Unresolved Questions",
    "- none",
    ""
  ];
  return lines.join("\n");
}

export function runPreviewWorkflow(
  context: RuntimeContext,
  input: PreviewWorkflowInput = {}
): PreviewWorkflowResult {
  const mode = resolvePreviewMode(input.mode);
  const target = resolveTarget(context, input.target);
  const stopRequested = input.stop === true;
  const promptTarget = input.target?.trim() ? input.target.trim() : context.config.paths.rootDir;
  const run = context.runService.createRun({
    workflow: "preview",
    mode: "interactive",
    prompt: `preview ${promptTarget}`
  });

  const diagnostics: WorkflowCommandDiagnostics[] = [];
  if (stopRequested) {
    diagnostics.push({
      code: "PREVIEW_STOP_NOOP",
      cause: "No managed preview server is active in this phase, so stop completed as a no-op.",
      nextStep: "Run cdx preview <target> to generate a fresh preview output artifact."
    });
  } else {
    diagnostics.push({
      code: "PREVIEW_OUTPUT_READY",
      cause: "Preview output markdown and view URL artifacts were published.",
      nextStep: "Open the preview-output.md artifact via the emitted file:// URL or path."
    });
  }

  const previewOutput = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "preview-render",
    fileName: "preview-output.md",
    summary: "preview output markdown",
    markdown: renderPreviewMarkdown({
      timestamp: context.clock.now().toISOString(),
      mode,
      target,
      stopRequested
    }),
    metadata: {
      workflow: "preview",
      artifact: "preview_output_md",
      mode,
      targetKind: target.sourceKind,
      ...(target.resolvedPath ? { targetPath: target.resolvedPath } : {})
    }
  });
  const previewViewUrl = pathToFileURL(previewOutput.artifactPath).toString();
  const previewView = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "preview-render",
    fileName: "preview-view-url.md",
    summary: "preview view url",
    markdown: `# Preview View URL\n\n- URL: ${previewViewUrl}\n`,
    metadata: {
      workflow: "preview",
      artifact: "preview_view_url",
      previewOutputPath: previewOutput.artifactPath
    }
  });

  const checkpointIds: WorkflowCheckpointId[] = ["preview-render"];
  context.runService.recordWorkflowCheckpoint(run.id, "preview-render", {
    artifactPath: previewOutput.artifactPath,
    artifactId: previewOutput.artifactId
  });

  return {
    runId: run.id,
    workflow: "preview",
    checkpointIds,
    mode,
    target: target.displayTarget,
    stopRequested,
    previewOutputPath: previewOutput.artifactPath,
    previewOutputArtifactId: previewOutput.artifactId,
    previewViewUrl,
    previewViewUrlPath: previewView.artifactPath,
    previewViewUrlArtifactId: previewView.artifactId,
    diagnostics
  };
}
