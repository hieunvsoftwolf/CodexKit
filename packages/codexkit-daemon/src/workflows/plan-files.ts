import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invariant } from "../../../codexkit-core/src/index.ts";
import type { PlanMode } from "./contracts.ts";

export interface PlanFrontmatter {
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "archived";
  priority: string;
  effort: string;
  branch: string;
  created: string;
  progress?: string;
  issue?: string;
  tags?: string;
}

export interface PlanPhaseDraft {
  phaseNumber: number;
  fileName: string;
  title: string;
  markdown: string;
}

export interface PlanBundleDraft {
  frontmatter: PlanFrontmatter;
  planMarkdown: string;
  phases: PlanPhaseDraft[];
}

export interface ParsedPhase {
  absolutePath: string;
  phaseNumber: number;
  markdown: string;
  checklist: Array<{ checked: boolean; text: string }>;
}

export interface ChecklistLine {
  lineIndex: number;
  checked: boolean;
  text: string;
}

export interface PlanPhaseProgressSnapshot {
  phasePath: string;
  checked: number;
  total: number;
  percent: number;
  status: "pending" | "in_progress" | "completed";
}

export interface PlanProgressSnapshot {
  checked: number;
  total: number;
  percent: number;
  status: "pending" | "in_progress" | "completed";
  phases: PlanPhaseProgressSnapshot[];
}

export interface ParsedPlanBundle {
  planPath: string;
  planDir: string;
  frontmatter: PlanFrontmatter;
  planMarkdown: string;
  phases: ParsedPhase[];
}

type PlanTemplateKind = "feature_implementation" | "bug_fix" | "refactor";

interface PlanTemplateDefinition {
  fileName: string;
  publicId: string;
  signatureHeading: string;
}

interface TemplatePhaseSpec {
  phase: number;
  title: string;
  todos: string[];
}

interface ParsedPlanTemplate {
  kind: PlanTemplateKind;
  title: string;
  publicId: string;
  sourceFile: string;
  signatureHeading: string;
  taskSignals: string[];
  phases: TemplatePhaseSpec[];
}

const TEMPLATE_DEFINITION_BY_KIND: Record<PlanTemplateKind, PlanTemplateDefinition> = {
  feature_implementation: {
    fileName: "feature-implementation-template.md",
    publicId: "feature-implementation",
    signatureHeading: "## Deliverable"
  },
  bug_fix: {
    fileName: "bug-fix-template.md",
    publicId: "bug-fix",
    signatureHeading: "## Reproduction"
  },
  refactor: {
    fileName: "refactor-template.md",
    publicId: "refactor",
    signatureHeading: "## Safety Checks"
  }
};

const TRACKED_TEMPLATE_FILE_NAMES = [
  ...new Set([...Object.values(TEMPLATE_DEFINITION_BY_KIND).map((definition) => definition.fileName), "template-usage-guide.md"])
];

const DEFAULT_PHASE_SPECS: TemplatePhaseSpec[] = [
  {
    phase: 1,
    title: "Discovery",
    todos: ["Collect baseline context [critical]", "Confirm constraints", "Define acceptance criteria"]
  },
  {
    phase: 2,
    title: "Implementation",
    todos: ["Implement workflow changes [critical]", "Add integration coverage", "Validate runtime contracts"]
  },
  {
    phase: 3,
    title: "Verification",
    todos: ["Run typecheck and tests", "Prepare implementation summary", "Record unresolved questions"]
  }
];

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "plan";
}

function yamlLine(key: string, value: string): string {
  const escaped = value.replace(/"/g, '\\"');
  return `${key}: \"${escaped}\"`;
}

function parseFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  invariant(match, "PLAN_FRONTMATTER_REQUIRED", "plan.md requires YAML frontmatter");
  const parsed: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const pair = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.+)$/);
    if (!pair) {
      continue;
    }
    const rawValue = pair[2]!.trim().replace(/^"|"$/g, "");
    parsed[pair[1]!] = rawValue;
  }
  return parsed;
}

function parseCommaList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function parseTemplatePhaseSpecs(markdown: string): TemplatePhaseSpec[] {
  const phases: TemplatePhaseSpec[] = [];
  let active: TemplatePhaseSpec | null = null;
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const phaseMatch = line.match(/^##\s+Phase\s+(\d+):\s+(.+)$/i);
    if (phaseMatch) {
      active = {
        phase: Number(phaseMatch[1] ?? "0"),
        title: phaseMatch[2]?.trim() ?? "Untitled",
        todos: []
      };
      phases.push(active);
      continue;
    }
    if (!active) {
      continue;
    }
    const todoMatch = line.match(/^\s*-\s*\[\s*[xX ]\s*\]\s+(.+)$/);
    if (!todoMatch) {
      continue;
    }
    active.todos.push(todoMatch[1]!.trim());
  }
  return phases.filter((phase) => Number.isFinite(phase.phase) && phase.phase > 0 && phase.title.length > 0 && phase.todos.length > 0);
}

function fallbackSignalsForKind(kind: PlanTemplateKind): string[] {
  if (kind === "bug_fix") {
    return ["bug", "fix", "hotfix", "regression", "defect", "incident", "issue"];
  }
  if (kind === "refactor") {
    return ["refactor", "cleanup", "restructure", "tech debt", "technical debt"];
  }
  return ["feature", "implement", "implementation", "add", "build", "create", "new"];
}

function trackedTemplateRoot(): string {
  const workflowDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(workflowDir, "../../../../plans/templates");
}

function ensureDurablePlanTemplates(rootDir: string): void {
  const sourceRoot = trackedTemplateRoot();
  if (!existsSync(sourceRoot)) {
    return;
  }
  const targetRoot = path.join(rootDir, "plans", "templates");
  if (path.resolve(targetRoot) === path.resolve(sourceRoot)) {
    return;
  }
  mkdirSync(targetRoot, { recursive: true });
  for (const fileName of TRACKED_TEMPLATE_FILE_NAMES) {
    const sourcePath = path.join(sourceRoot, fileName);
    const targetPath = path.join(targetRoot, fileName);
    if (!existsSync(sourcePath) || existsSync(targetPath)) {
      continue;
    }
    writeFileSync(targetPath, readFileSync(sourcePath, "utf8"), "utf8");
  }
}

function resolveTemplatePath(rootDir: string, fileName: string): string | null {
  const templatePath = path.join(rootDir, "plans", "templates", fileName);
  if (existsSync(templatePath)) {
    return templatePath;
  }
  return null;
}

function readPlanTemplate(rootDir: string, kind: PlanTemplateKind): ParsedPlanTemplate | null {
  const definition = TEMPLATE_DEFINITION_BY_KIND[kind];
  const templatePath = resolveTemplatePath(rootDir, definition.fileName);
  if (!templatePath) {
    return null;
  }
  try {
    const markdown = readFileSync(templatePath, "utf8");
    const frontmatter = parseFrontmatter(markdown);
    const phases = parseTemplatePhaseSpecs(markdown);
    if (phases.length === 0) {
      return null;
    }
    const signals = parseCommaList(frontmatter.task_match);
    return {
      kind,
      title: frontmatter.title?.trim() || kind,
      publicId: definition.publicId,
      sourceFile: definition.fileName,
      signatureHeading: definition.signatureHeading,
      taskSignals: signals.length > 0 ? signals : fallbackSignalsForKind(kind),
      phases
    };
  } catch {
    return null;
  }
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function taskMatchesSignals(task: string, signals: string[]): boolean {
  const normalizedTask = task.toLowerCase();
  return signals.some((signal) => {
    const normalized = signal.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (normalized.includes(" ")) {
      return normalizedTask.includes(normalized);
    }
    const pattern = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i");
    return pattern.test(normalizedTask);
  });
}

function resolveTemplatePhaseSpecs(task: string, rootDir?: string): ParsedPlanTemplate | null {
  if (!rootDir) {
    return null;
  }
  // Seed fixed-name tracked templates into the target root before citing them in generated plans.
  ensureDurablePlanTemplates(rootDir);
  const priority: PlanTemplateKind[] = ["bug_fix", "refactor", "feature_implementation"];
  const templates = priority
    .map((kind) => readPlanTemplate(rootDir, kind))
    .filter((entry): entry is ParsedPlanTemplate => entry !== null);
  const matched = templates.find((entry) => taskMatchesSignals(task, entry.taskSignals));
  if (!matched) {
    return null;
  }
  return matched;
}

function checklist(markdown: string): Array<{ checked: boolean; text: string }> {
  const result: Array<{ checked: boolean; text: string }> = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\s*-\s*\[([ xX])\]\s+(.+)$/);
    if (!match) {
      continue;
    }
    result.push({ checked: match[1]!.toLowerCase() === "x", text: match[2]!.trim() });
  }
  return result;
}

export function parseChecklistLines(markdown: string): ChecklistLine[] {
  const lines = markdown.split("\n");
  const result: ChecklistLine[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    const match = line.match(/^(\s*-\s*\[)([ xX])(\]\s+)(.+)$/);
    if (!match) {
      continue;
    }
    result.push({
      lineIndex: index,
      checked: match[2]!.toLowerCase() === "x",
      text: match[4]!.trim()
    });
  }
  return result;
}

export function markChecklistLinesChecked(markdown: string, lineIndexes: number[]): { markdown: string; changedCount: number } {
  if (lineIndexes.length === 0) {
    return { markdown, changedCount: 0 };
  }
  const lines = markdown.split("\n");
  const indexes = new Set(lineIndexes);
  let changedCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (!indexes.has(index)) {
      continue;
    }
    const line = lines[index];
    if (!line) {
      continue;
    }
    const match = line.match(/^(\s*-\s*\[)([ xX])(\]\s+)(.+)$/);
    if (!match) {
      continue;
    }
    if (match[2]!.toLowerCase() === "x") {
      continue;
    }
    lines[index] = `${match[1]}x${match[3]}${match[4]}`;
    changedCount += 1;
  }
  return { markdown: lines.join("\n"), changedCount };
}

function deriveStatus(checked: number, total: number): PlanProgressSnapshot["status"] {
  if (checked === 0) {
    return "pending";
  }
  if (checked >= total) {
    return "completed";
  }
  return "in_progress";
}

export function derivePlanProgressFromChecklists(input: Array<{ phasePath: string; checklist: Array<{ checked: boolean }> }>): PlanProgressSnapshot {
  const phases = input.map((entry) => {
    const total = entry.checklist.length;
    const checked = entry.checklist.filter((item) => item.checked).length;
    const percent = total === 0 ? 0 : Math.round((checked / total) * 100);
    return {
      phasePath: entry.phasePath,
      checked,
      total,
      percent,
      status: deriveStatus(checked, total)
    };
  });
  const total = phases.reduce((sum, phase) => sum + phase.total, 0);
  const checked = phases.reduce((sum, phase) => sum + phase.checked, 0);
  const percent = total === 0 ? 0 : Math.round((checked / total) * 100);
  const status = deriveStatus(checked, total);
  return { checked, total, percent, status, phases };
}

function toStatusLabel(status: PlanProgressSnapshot["status"]): string {
  if (status === "completed") {
    return "Completed";
  }
  if (status === "in_progress") {
    return "In Progress";
  }
  return "Pending";
}

function upsertFrontmatterValue(frontmatterLines: string[], key: string, value: string): void {
  const keyPattern = new RegExp(`^${key}:\\s*`);
  for (let index = 0; index < frontmatterLines.length; index += 1) {
    if (keyPattern.test(frontmatterLines[index]!)) {
      frontmatterLines[index] = `${key}: "${value}"`;
      return;
    }
  }
  frontmatterLines.push(`${key}: "${value}"`);
}

const MANAGED_PROGRESS_START = "<!-- codexkit:managed-progress:start -->";
const MANAGED_PROGRESS_END = "<!-- codexkit:managed-progress:end -->";

function phaseStatusLabel(status: PlanPhaseProgressSnapshot["status"]): string {
  return toStatusLabel(status);
}

function renderManagedProgressBlock(snapshot: PlanProgressSnapshot): string[] {
  const phaseRows = snapshot.phases.length > 0
    ? snapshot.phases.map((phase) => `| ${path.basename(phase.phasePath)} | ${phase.checked} | ${phase.total} | ${phase.percent}% | ${phaseStatusLabel(phase.status)} |`)
    : ["| none | 0 | 0 | 0% | Pending |"];
  return [
    MANAGED_PROGRESS_START,
    `- Status: ${toStatusLabel(snapshot.status)}`,
    `- Completion: ${snapshot.checked}/${snapshot.total} (${snapshot.percent}%)`,
    "",
    "| Phase | Checked | Total | Percent | Status |",
    "| --- | ---: | ---: | ---: | --- |",
    ...phaseRows,
    MANAGED_PROGRESS_END
  ];
}

function upsertProgressSection(markdown: string, snapshot: PlanProgressSnapshot): string {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const heading = "## Progress";
  const managedBlock = renderManagedProgressBlock(snapshot);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) {
    const suffix = normalized.endsWith("\n") ? "" : "\n";
    return `${normalized}${suffix}\n${heading}\n\n${managedBlock.join("\n")}\n`;
  }

  let sectionEnd = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith("## ")) {
      sectionEnd = index;
      break;
    }
  }

  const sectionBody = lines.slice(headingIndex + 1, sectionEnd);
  const markerStartIndex = sectionBody.findIndex((line) => line.trim() === MANAGED_PROGRESS_START);
  const markerEndIndex = sectionBody.findIndex((line) => line.trim() === MANAGED_PROGRESS_END);
  let updatedSectionBody: string[];
  if (markerStartIndex !== -1 && markerEndIndex >= markerStartIndex) {
    updatedSectionBody = [
      ...sectionBody.slice(0, markerStartIndex),
      ...managedBlock,
      ...sectionBody.slice(markerEndIndex + 1)
    ];
  } else {
    const preserved = [...sectionBody];
    while (preserved.length > 0 && preserved[preserved.length - 1] === "") {
      preserved.pop();
    }
    if (preserved.length > 0) {
      preserved.push("");
    }
    updatedSectionBody = [...preserved, ...managedBlock];
  }

  const before = lines.slice(0, headingIndex + 1);
  if (before[before.length - 1] !== "") {
    before.push("");
  }
  const after = lines.slice(sectionEnd);
  const updated = [...before, ...updatedSectionBody];
  if (after.length > 0 && updated[updated.length - 1] !== "") {
    updated.push("");
  }
  return [...updated, ...after].join("\n");
}

export function upsertPlanStatusProgress(planMarkdown: string, snapshot: PlanProgressSnapshot): string {
  const normalized = planMarkdown.replace(/\r\n/g, "\n");
  const progressValue = `${snapshot.checked}/${snapshot.total} (${snapshot.percent}%)`;
  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (frontmatterMatch) {
    const frontmatterLines = frontmatterMatch[1]!.split("\n");
    upsertFrontmatterValue(frontmatterLines, "status", snapshot.status);
    upsertFrontmatterValue(frontmatterLines, "progress", progressValue);
    const rest = normalized.slice(frontmatterMatch[0].length);
    return `---\n${frontmatterLines.join("\n")}\n---\n${upsertProgressSection(rest, snapshot)}`;
  }

  let updated = normalized;
  const statusLinePattern = /^\*\*Status\*\*:\s*.+$/m;
  if (statusLinePattern.test(updated)) {
    updated = updated.replace(statusLinePattern, `**Status**: ${toStatusLabel(snapshot.status)}`);
  }
  const progressLinePattern = /^\*\*Progress\*\*:\s*.+$/m;
  if (progressLinePattern.test(updated)) {
    updated = updated.replace(progressLinePattern, `**Progress**: ${progressValue}`);
  } else if (statusLinePattern.test(updated)) {
    updated = updated.replace(
      /^\*\*Status\*\*:\s*.+$/m,
      `**Status**: ${toStatusLabel(snapshot.status)}\n**Progress**: ${progressValue}`
    );
  }
  return upsertProgressSection(updated, snapshot);
}

export function listPhasePlanFiles(planDir: string): string[] {
  return readdirSync(planDir)
    .filter((entry) => /^phase-\d{2}-.+\.md$/i.test(entry))
    .sort()
    .map((entry) => path.join(planDir, entry));
}

export function createPlanBundle(input: {
  task: string;
  branch: string;
  createdAt: string;
  mode: PlanMode;
  rootDir?: string;
  priority?: string;
  effort?: string;
}): PlanBundleDraft {
  const templateSelection = resolveTemplatePhaseSpecs(input.task, input.rootDir);
  const phaseSpecs = templateSelection?.phases ?? DEFAULT_PHASE_SPECS;
  const frontmatter: PlanFrontmatter = {
    title: input.task,
    description: templateSelection ? `${templateSelection.title} execution plan for ${input.task}` : `Execution plan for ${input.task}`,
    status: "pending",
    priority: input.priority ?? "medium",
    effort: input.effort ?? "medium",
    branch: input.branch,
    created: input.createdAt
  };
  const phaseFileList = phaseSpecs.map(
    (phaseSpec) => `- phase-${String(phaseSpec.phase).padStart(2, "0")}-${slugify(phaseSpec.title)}.md`
  );
  const header = [
    "---",
    yamlLine("title", frontmatter.title),
    yamlLine("description", frontmatter.description),
    yamlLine("status", frontmatter.status),
    yamlLine("priority", frontmatter.priority),
    yamlLine("effort", frontmatter.effort),
    yamlLine("branch", frontmatter.branch),
    yamlLine("created", frontmatter.created),
    ...(templateSelection ? [yamlLine("template", templateSelection.publicId)] : []),
    "---",
    "",
    "# Plan",
    "",
    `Mode: ${input.mode}`,
    "",
    ...(templateSelection ? [`Template source: plans/templates/${templateSelection.sourceFile}`, ""] : []),
    "## Scope",
    `- ${input.task}`,
    "",
    "## Phases",
    ...phaseFileList,
    ""
  ].join("\n");
  const totalTodos = phaseSpecs.reduce((sum, phaseSpec) => sum + phaseSpec.todos.length, 0);
  frontmatter.progress = `0/${totalTodos} (0%)`;
  const phases: PlanPhaseDraft[] = phaseSpecs.map((phaseSpec) => {
    const fileName = `phase-${String(phaseSpec.phase).padStart(2, "0")}-${slugify(phaseSpec.title)}.md`;
    const markdown = [
      `# Phase ${phaseSpec.phase}: ${phaseSpec.title}`,
      "",
      "## Overview",
      `${phaseSpec.title} for ${input.task}.`,
      "",
      "## Requirements",
      "- Keep scope aligned with the active phase spec",
      "",
      ...(templateSelection && phaseSpec.phase === phaseSpecs[0]?.phase
        ? [templateSelection.signatureHeading, "- Template-selected durable section marker", ""]
        : []),
      "## Related Code Files",
      "- TBD",
      "",
      "## Implementation Steps",
      "- Follow checklist in order",
      "",
      "## Todo Checklist",
      ...phaseSpec.todos.map((todo) => `- [ ] ${todo}`),
      "",
      "## Success Criteria",
      "- Phase artifacts are complete and reviewable",
      "",
      "## Risk Notes",
      "- Call out blockers early",
      ""
    ].join("\n");
    return { phaseNumber: phaseSpec.phase, fileName, title: phaseSpec.title, markdown };
  });
  return { frontmatter, planMarkdown: header, phases };
}

export function writePlanBundle(planDir: string, bundle: PlanBundleDraft): { planPath: string; phasePaths: string[] } {
  mkdirSync(planDir, { recursive: true });
  const planPath = path.join(planDir, "plan.md");
  writeFileSync(planPath, bundle.planMarkdown, "utf8");
  const phasePaths: string[] = [];
  for (const phase of bundle.phases) {
    const phasePath = path.join(planDir, phase.fileName);
    writeFileSync(phasePath, phase.markdown, "utf8");
    phasePaths.push(phasePath);
  }
  return { planPath, phasePaths };
}

export function readPlanBundle(planPath: string): ParsedPlanBundle {
  const absolutePlanPath = path.resolve(planPath);
  const planDir = path.dirname(absolutePlanPath);
  const planMarkdown = readFileSync(absolutePlanPath, "utf8");
  const frontmatterRaw = parseFrontmatter(planMarkdown);
  const rawStatus = (frontmatterRaw.status ?? "pending").toLowerCase();
  const status: PlanFrontmatter["status"] = rawStatus === "archived"
    ? "archived"
    : rawStatus === "completed"
      ? "completed"
      : rawStatus === "in_progress"
        ? "in_progress"
        : "pending";
  const frontmatter: PlanFrontmatter = {
    title: frontmatterRaw.title ?? "Untitled plan",
    description: frontmatterRaw.description ?? "",
    status,
    priority: frontmatterRaw.priority ?? "medium",
    effort: frontmatterRaw.effort ?? "medium",
    branch: frontmatterRaw.branch ?? "unknown",
    created: frontmatterRaw.created ?? new Date().toISOString(),
    ...(frontmatterRaw.progress ? { progress: frontmatterRaw.progress } : {})
  };
  const phases = listPhasePlanFiles(planDir)
    .map((absolutePath) => {
      const entry = path.basename(absolutePath);
      const markdown = readFileSync(absolutePath, "utf8");
      const numberMatch = entry.match(/^phase-(\d{2})-/i);
      return {
        absolutePath,
        phaseNumber: Number(numberMatch?.[1] ?? "0"),
        markdown,
        checklist: checklist(markdown)
      };
    });
  return { planPath: absolutePlanPath, planDir, frontmatter, planMarkdown, phases };
}
