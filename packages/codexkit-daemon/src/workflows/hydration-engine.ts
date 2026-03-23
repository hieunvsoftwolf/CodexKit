import path from "node:path";
import type { TaskRecord } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { readPlanBundle } from "./plan-files.ts";

function isTerminal(task: TaskRecord): boolean {
  return task.status === "completed" || task.status === "failed" || task.status === "cancelled";
}

function parsePhaseTitle(markdown: string, fallback: string): string {
  const firstHeader = markdown.split("\n").find((line) => line.startsWith("# "));
  if (!firstHeader) {
    return fallback;
  }
  return firstHeader.replace(/^#\s+/, "").trim();
}

function hasCriticalMarker(text: string): boolean {
  return /\[critical\]|critical:/i.test(text);
}

export interface HydrationResult {
  hydrationRan: boolean;
  skipped: boolean;
  skipReason?: string;
  createdTaskIds: string[];
  reusedTaskIds: string[];
  createdChildTaskIds: string[];
  executablePhaseCount: number;
}

export function renderHydrationReport(result: HydrationResult, planPath: string): string {
  const lines = [
    "# Task Hydration Report",
    "",
    `Plan: ${path.resolve(planPath)}`,
    `Hydration ran: ${result.hydrationRan ? "yes" : "no"}`,
    `Executable phases: ${result.executablePhaseCount}`,
    `Created phase tasks: ${result.createdTaskIds.length}`,
    `Reused phase tasks: ${result.reusedTaskIds.length}`,
    `Created critical child tasks: ${result.createdChildTaskIds.length}`,
    ""
  ];
  if (result.skipped) {
    lines.push(`Skip reason: ${result.skipReason ?? "not provided"}`, "");
  }
  if (result.createdTaskIds.length > 0) {
    lines.push("## Created Phase Tasks", ...result.createdTaskIds.map((taskId) => `- ${taskId}`), "");
  }
  if (result.reusedTaskIds.length > 0) {
    lines.push("## Reused Phase Tasks", ...result.reusedTaskIds.map((taskId) => `- ${taskId}`), "");
  }
  if (result.createdChildTaskIds.length > 0) {
    lines.push("## Created Critical Child Tasks", ...result.createdChildTaskIds.map((taskId) => `- ${taskId}`), "");
  }
  return lines.join("\n");
}

export function hydratePlanTasks(
  context: RuntimeContext,
  input: { runId: string; planPath: string; noTasks?: boolean }
): HydrationResult {
  const parsedPlan = readPlanBundle(input.planPath);
  const allPlanTasks = context.taskService
    .listTasks({ runId: input.runId })
    .filter((task) => !isTerminal(task) && task.planDir === parsedPlan.planDir);
  const executablePhases = parsedPlan.phases.filter((phase) => phase.checklist.some((item) => !item.checked));

  if (input.noTasks) {
    return {
      hydrationRan: false,
      skipped: true,
      skipReason: "disabled via --no-tasks",
      createdTaskIds: [],
      reusedTaskIds: [],
      createdChildTaskIds: [],
      executablePhaseCount: executablePhases.length
    };
  }
  if (executablePhases.length < 3) {
    return {
      hydrationRan: false,
      skipped: true,
      skipReason: "plan has fewer than 3 executable phases",
      createdTaskIds: [],
      reusedTaskIds: [],
      createdChildTaskIds: [],
      executablePhaseCount: executablePhases.length
    };
  }

  const createdTaskIds: string[] = [];
  const reusedTaskIds: string[] = [];
  const createdChildTaskIds: string[] = [];
  let previousPhaseTaskId: string | undefined;
  for (const phase of executablePhases) {
    const phasePath = path.resolve(phase.absolutePath);
    const existing = allPlanTasks.find((task) => task.phaseFile === phasePath && !task.parentTaskId);
    const phaseTitle = parsePhaseTitle(phase.markdown, path.basename(phasePath));
    const phaseSubject = `Phase ${String(phase.phaseNumber).padStart(2, "0")}: ${phaseTitle}`;
    const dependsOn = previousPhaseTaskId ? [previousPhaseTaskId] : [];
    const phaseTask = existing
      ?? context.taskService.createTask({
        runId: input.runId,
        role: "fullstack-developer",
        subject: phaseSubject,
        description: `Execute ${phaseTitle}`,
        planDir: parsedPlan.planDir,
        phaseFile: phasePath,
        stepRef: `phase-${String(phase.phaseNumber).padStart(2, "0")}`,
        dependsOn,
        metadata: {
          phase: phase.phaseNumber,
          priority: parsedPlan.frontmatter.priority,
          effort: parsedPlan.frontmatter.effort,
          planDir: parsedPlan.planDir,
          phaseFile: phasePath
        }
      });
    if (existing) {
      reusedTaskIds.push(existing.id);
    } else {
      createdTaskIds.push(phaseTask.id);
    }

    for (const item of phase.checklist.filter((checklistItem) => !checklistItem.checked && hasCriticalMarker(checklistItem.text))) {
      const child = context.taskService.createTask({
        runId: input.runId,
        parentTaskId: phaseTask.id,
        role: "fullstack-developer",
        subject: `Critical: ${item.text}`,
        description: `Critical step from ${phaseTitle}`,
        planDir: parsedPlan.planDir,
        phaseFile: phasePath,
        stepRef: `${phaseTask.stepRef ?? "phase"}:critical:${createdChildTaskIds.length + 1}`,
        metadata: {
          phase: phase.phaseNumber,
          priority: parsedPlan.frontmatter.priority,
          effort: parsedPlan.frontmatter.effort,
          planDir: parsedPlan.planDir,
          phaseFile: phasePath,
          critical: true
        }
      });
      createdChildTaskIds.push(child.id);
    }
    previousPhaseTaskId = phaseTask.id;
  }

  return {
    hydrationRan: true,
    skipped: false,
    createdTaskIds,
    reusedTaskIds,
    createdChildTaskIds,
    executablePhaseCount: executablePhases.length
  };
}
