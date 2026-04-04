import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { RuntimeController } from "../../packages/codexkit-daemon/src/index.ts";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

const repoRoot = process.cwd();
const templateRoot = path.join(repoRoot, "plans", "templates");

function readRepoTemplate(fileName: string): string {
  return readFileSync(path.join(templateRoot, fileName), "utf8");
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 12 plan template parity", () => {
  test(
    "template assets exist with durable titles and plan generation records the selected real template source",
    { timeout: 90_000 },
    async () => {
      const requiredTemplates = [
        {
          fileName: "feature-implementation-template.md",
          title: "# Feature Implementation Template",
          signature: "## Deliverable"
        },
        {
          fileName: "bug-fix-template.md",
          title: "# Bug Fix Template",
          signature: "## Reproduction"
        },
        {
          fileName: "refactor-template.md",
          title: "# Refactor Template",
          signature: "## Safety Checks"
        },
        {
          fileName: "template-usage-guide.md",
          title: "# Template Usage Guide",
          signature: "feature-implementation-template.md"
        }
      ];

      for (const template of requiredTemplates) {
        const absolutePath = path.join(templateRoot, template.fileName);
        expect(existsSync(absolutePath)).toBe(true);
        const markdown = readRepoTemplate(template.fileName);
        expect(markdown).toContain(template.title);
        expect(markdown).toContain(template.signature);
      }

      const fixture = await createRuntimeFixture("codexkit-phase12-plan-templates");
      cleanups.push(() => fixture.cleanup());
      const controller = new RuntimeController(fixture.rootDir);
      cleanups.push(() => controller.close());

      const featurePlan = controller.plan({ task: "Implement release dashboard export", mode: "hard", noTasks: true }) as {
        planPath: string;
        phasePaths: string[];
      };
      const bugFixPlan = controller.plan({ task: "Fix checkout redirect bug", mode: "hard", noTasks: true }) as {
        planPath: string;
        phasePaths: string[];
      };
      const refactorPlan = controller.plan({ task: "Refactor plan bundle rendering", mode: "hard", noTasks: true }) as {
        planPath: string;
        phasePaths: string[];
      };

      const featurePlanMarkdown = readFileSync(featurePlan.planPath, "utf8");
      const bugFixPlanMarkdown = readFileSync(bugFixPlan.planPath, "utf8");
      const refactorPlanMarkdown = readFileSync(refactorPlan.planPath, "utf8");

      expect(featurePlanMarkdown).toContain('template: "feature-implementation"');
      expect(featurePlanMarkdown).toContain("Template source: plans/templates/feature-implementation-template.md");
      expect(readFileSync(featurePlan.phasePaths[0]!, "utf8")).toContain("## Deliverable");

      expect(bugFixPlanMarkdown).toContain('template: "bug-fix"');
      expect(bugFixPlanMarkdown).toContain("Template source: plans/templates/bug-fix-template.md");
      expect(readFileSync(bugFixPlan.phasePaths[0]!, "utf8")).toContain("## Reproduction");

      expect(refactorPlanMarkdown).toContain('template: "refactor"');
      expect(refactorPlanMarkdown).toContain("Template source: plans/templates/refactor-template.md");
      expect(readFileSync(refactorPlan.phasePaths[0]!, "utf8")).toContain("## Safety Checks");
    }
  );
});
