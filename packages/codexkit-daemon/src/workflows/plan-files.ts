import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { invariant } from "../../../codexkit-core/src/index.ts";
import type { PlanMode } from "./contracts.ts";

export interface PlanFrontmatter {
  title: string;
  description: string;
  status: "pending" | "archived";
  priority: string;
  effort: string;
  branch: string;
  created: string;
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

export interface ParsedPlanBundle {
  planPath: string;
  planDir: string;
  frontmatter: PlanFrontmatter;
  planMarkdown: string;
  phases: ParsedPhase[];
}

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

export function createPlanBundle(input: {
  task: string;
  branch: string;
  createdAt: string;
  mode: PlanMode;
  priority?: string;
  effort?: string;
}): PlanBundleDraft {
  const slug = slugify(input.task);
  const frontmatter: PlanFrontmatter = {
    title: input.task,
    description: `Execution plan for ${input.task}`,
    status: "pending",
    priority: input.priority ?? "medium",
    effort: input.effort ?? "medium",
    branch: input.branch,
    created: input.createdAt
  };
  const header = [
    "---",
    yamlLine("title", frontmatter.title),
    yamlLine("description", frontmatter.description),
    yamlLine("status", frontmatter.status),
    yamlLine("priority", frontmatter.priority),
    yamlLine("effort", frontmatter.effort),
    yamlLine("branch", frontmatter.branch),
    yamlLine("created", frontmatter.created),
    "---",
    "",
    "# Plan",
    "",
    `Mode: ${input.mode}`,
    "",
    "## Scope",
    `- ${input.task}`,
    "",
    "## Phases",
    "- phase-01-discovery.md",
    "- phase-02-implementation.md",
    "- phase-03-verification.md",
    ""
  ].join("\n");
  const phaseSpecs: Array<{ phase: number; title: string; todos: string[] }> = [
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
  const frontmatter: PlanFrontmatter = {
    title: frontmatterRaw.title ?? "Untitled plan",
    description: frontmatterRaw.description ?? "",
    status: frontmatterRaw.status === "archived" ? "archived" : "pending",
    priority: frontmatterRaw.priority ?? "medium",
    effort: frontmatterRaw.effort ?? "medium",
    branch: frontmatterRaw.branch ?? "unknown",
    created: frontmatterRaw.created ?? new Date().toISOString()
  };
  const phases = readdirSync(planDir)
    .filter((entry) => /^phase-\d{2}-.+\.md$/i.test(entry))
    .sort()
    .map((entry) => {
      const absolutePath = path.join(planDir, entry);
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
