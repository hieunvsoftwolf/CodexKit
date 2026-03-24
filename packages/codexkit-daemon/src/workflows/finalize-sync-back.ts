import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TaskRecord } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { FINALIZE_ARTIFACT_NAMES } from "./artifact-paths.ts";
import type { FinalizeSyncResult, FinalizeUnresolvedMapping, FinalizeWorkflowInput } from "./contracts.ts";
import {
  derivePlanProgressFromChecklists,
  listPhasePlanFiles,
  markChecklistLinesChecked,
  parseChecklistLines,
  upsertPlanStatusProgress
} from "./plan-files.ts";
import { publishFinalizeContractReport } from "./workflow-reporting.ts";
import { readWorkflowState } from "./workflow-state.ts";

interface ChecklistScore {
  lineIndex: number;
  score: number;
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreChecklistMatch(taskText: string, checklistText: string): number {
  const normalizedTask = normalizeText(taskText);
  const normalizedChecklist = normalizeText(checklistText);
  if (!normalizedTask || !normalizedChecklist) {
    return 0;
  }
  if (normalizedTask.includes(normalizedChecklist)) {
    return 6 + normalizedChecklist.length;
  }
  const taskTokens = new Set(normalizedTask.split(" ").filter(Boolean));
  const checklistTokens = normalizedChecklist.split(" ").filter(Boolean);
  let overlap = 0;
  for (const token of checklistTokens) {
    if (taskTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
}

function canonicalDurablePlanPath(planPath: string): string | null {
  const absolutePath = path.resolve(planPath);
  if (!existsSync(absolutePath) || path.basename(absolutePath).toLowerCase() !== "plan.md") {
    return null;
  }
  try {
    const canonicalPath = realpathSync.native(absolutePath);
    if (path.basename(canonicalPath).toLowerCase() !== "plan.md") {
      return null;
    }
    return path.resolve(canonicalPath);
  } catch {
    return null;
  }
}

function resolveActivePlanPath(context: RuntimeContext, input: FinalizeWorkflowInput): string | null {
  const run = context.runService.getRun(input.runId);
  if (run.planDir) {
    const candidate = canonicalDurablePlanPath(path.join(path.resolve(run.planDir), "plan.md"));
    if (candidate) {
      return candidate;
    }
  }
  const workflowState = readWorkflowState(run);
  if (workflowState.activePlanPath) {
    const candidate = canonicalDurablePlanPath(workflowState.activePlanPath);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function resolvePlanPath(context: RuntimeContext, input: FinalizeWorkflowInput): string | null {
  const activePlanPath = resolveActivePlanPath(context, input);
  if (!activePlanPath) {
    return null;
  }
  if (!input.planPathHint) {
    return activePlanPath;
  }
  const hintedPath = canonicalDurablePlanPath(input.planPathHint);
  if (hintedPath === activePlanPath) {
    return activePlanPath;
  }
  return activePlanPath;
}

function unresolved(task: TaskRecord, reason: string): FinalizeUnresolvedMapping {
  return {
    taskId: task.id,
    subject: task.subject,
    phaseFile: task.phaseFile ? path.resolve(task.phaseFile) : "unknown",
    reason
  };
}

function scoreCandidates(task: TaskRecord, checklistTexts: string[]): ChecklistScore[] {
  const taskCorpus = [task.subject, task.description, task.stepRef ?? ""].join(" | ");
  const scored: ChecklistScore[] = [];
  for (let index = 0; index < checklistTexts.length; index += 1) {
    const text = checklistTexts[index];
    if (!text) {
      continue;
    }
    const score = scoreChecklistMatch(taskCorpus, text);
    if (score <= 0) {
      continue;
    }
    scored.push({ lineIndex: index, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function buildUnresolvedMappingMarkdown(input: {
  runId: string;
  planPath: string;
  unresolvedMappings: FinalizeUnresolvedMapping[];
}): string {
  const lines = [
    "# Unresolved Mapping Report",
    "",
    `- Run ID: ${input.runId}`,
    `- Plan: ${input.planPath}`,
    `- Unresolved completed tasks: ${input.unresolvedMappings.length}`,
    "",
    "## Items",
    ...input.unresolvedMappings.map(
      (item) => `- ${item.taskId} | ${item.subject} | ${item.phaseFile} | ${item.reason}`
    ),
    ""
  ];
  return lines.join("\n");
}

export function runFinalizeSyncBack(context: RuntimeContext, input: FinalizeWorkflowInput): FinalizeSyncResult {
  const planPath = resolvePlanPath(context, input);
  if (!planPath) {
    return {
      status: "no-active-plan",
      note: "no active plan",
      updatedPhasePaths: [],
      checkedBefore: 0,
      checkedAfter: 0,
      totalChecklistItems: 0,
      unresolvedMappings: []
    };
  }

  const absolutePlanPath = path.resolve(planPath);
  const planDir = path.dirname(absolutePlanPath);
  const phasePaths = listPhasePlanFiles(planDir).map((phasePath) => path.resolve(phasePath));
  const completedPhaseTasks = context.taskService
    .listTasks()
    .filter(
      (task) => task.status === "completed"
        && typeof task.phaseFile === "string"
        && task.phaseFile.trim().length > 0
        && typeof task.planDir === "string"
        && path.resolve(task.planDir) === planDir
    )
    .map((task) => ({ ...task, phaseFile: path.resolve(task.phaseFile ?? "") }));

  const unresolvedMappings: FinalizeUnresolvedMapping[] = [];
  const updatedPhasePaths: string[] = [];
  const beforeChecklists: Array<{ phasePath: string; checklist: Array<{ checked: boolean }> }> = [];
  const afterChecklists: Array<{ phasePath: string; checklist: Array<{ checked: boolean }> }> = [];

  for (const phasePath of phasePaths) {
    const phaseMarkdown = readFileSync(phasePath, "utf8");
    const checklistLines = parseChecklistLines(phaseMarkdown);
    beforeChecklists.push({
      phasePath,
      checklist: checklistLines.map((line) => ({ checked: line.checked }))
    });

    const checklistTexts = checklistLines.map((line) => line.text);
    const usedLineIndexes = new Set<number>();
    const lineIndexesToCheck: number[] = [];
    const phaseTasks = completedPhaseTasks.filter((task) => task.phaseFile === phasePath);

    for (const task of phaseTasks) {
      if (task.parentTaskId === null && typeof task.stepRef === "string" && task.stepRef.startsWith("phase-")) {
        unresolvedMappings.push(unresolved(task, "phase-level completion cannot be mapped to a checklist item safely"));
        continue;
      }
      const scored = scoreCandidates(task, checklistTexts);
      if (scored.length === 0) {
        unresolvedMappings.push(unresolved(task, "no safe checklist match"));
        continue;
      }
      let selectedLineIndex: number | null = null;
      for (const candidate of scored) {
        const checklistLine = checklistLines[candidate.lineIndex];
        if (!checklistLine) {
          continue;
        }
        if (checklistLine.checked) {
          selectedLineIndex = candidate.lineIndex;
          break;
        }
        if (!usedLineIndexes.has(candidate.lineIndex)) {
          selectedLineIndex = candidate.lineIndex;
          break;
        }
      }
      if (selectedLineIndex === null) {
        unresolvedMappings.push(unresolved(task, "multiple tasks map to the same unchecked item"));
        continue;
      }
      const selectedChecklist = checklistLines[selectedLineIndex];
      if (!selectedChecklist) {
        unresolvedMappings.push(unresolved(task, "selected checklist entry was unavailable"));
        continue;
      }
      if (selectedChecklist.checked) {
        continue;
      }
      usedLineIndexes.add(selectedLineIndex);
      lineIndexesToCheck.push(selectedChecklist.lineIndex);
    }

    const updated = markChecklistLinesChecked(phaseMarkdown, lineIndexesToCheck);
    if (updated.changedCount > 0) {
      writeFileSync(phasePath, updated.markdown, "utf8");
      updatedPhasePaths.push(phasePath);
    }
    afterChecklists.push({
      phasePath,
      checklist: parseChecklistLines(updated.markdown).map((line) => ({ checked: line.checked }))
    });
  }

  const beforeProgress = derivePlanProgressFromChecklists(beforeChecklists);
  const afterProgress = derivePlanProgressFromChecklists(afterChecklists);
  const planMarkdown = readFileSync(absolutePlanPath, "utf8");
  const updatedPlanMarkdown = upsertPlanStatusProgress(planMarkdown, afterProgress);
  let updatedPlanPath: string | undefined;
  if (updatedPlanMarkdown !== planMarkdown) {
    writeFileSync(absolutePlanPath, updatedPlanMarkdown, "utf8");
    updatedPlanPath = absolutePlanPath;
  }

  let unresolvedMappingReportPath: string | undefined;
  let unresolvedMappingReportArtifactId: string | undefined;
  if (unresolvedMappings.length > 0) {
    const unresolvedReport = publishFinalizeContractReport(context, {
      runId: input.runId,
      checkpoint: "finalize-sync",
      fileName: FINALIZE_ARTIFACT_NAMES.unresolvedMapping,
      markdown: buildUnresolvedMappingMarkdown({
        runId: input.runId,
        planPath: absolutePlanPath,
        unresolvedMappings
      }),
      summary: "finalize unresolved task-to-checkbox mappings",
      planPathHint: absolutePlanPath,
      metadata: { unresolvedCount: unresolvedMappings.length }
    });
    unresolvedMappingReportPath = unresolvedReport.artifactPath;
    unresolvedMappingReportArtifactId = unresolvedReport.artifactId;
  }

  return {
    status: "synced",
    note: "sync-back completed",
    planPath: absolutePlanPath,
    planDir,
    ...(updatedPlanPath ? { updatedPlanPath } : {}),
    updatedPhasePaths,
    checkedBefore: beforeProgress.checked,
    checkedAfter: afterProgress.checked,
    totalChecklistItems: afterProgress.total,
    unresolvedMappings,
    ...(unresolvedMappingReportPath ? { unresolvedMappingReportPath } : {}),
    ...(unresolvedMappingReportArtifactId ? { unresolvedMappingReportArtifactId } : {})
  };
}
