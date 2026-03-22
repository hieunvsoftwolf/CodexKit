import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ImporterError, importClaudekitWave1 } from "../../packages/codexkit-importer/src/index.ts";
import { sha256 } from "../../packages/codexkit-importer/src/path-utils.ts";
import { createImporterFixture } from "./helpers/importer-fixture.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("codexkit importer wave 1", () => {
  it("imports agents, skills, and rules with template deferral and skip auditing", async () => {
    const fixture = await createImporterFixture({
      ".claude/.ck.json": "{}\n",
      ".claude/metadata.json": "{\"kits\":{}}\n",
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner role\ntools: Read, TaskCreate\n---\nUse TaskCreate.\n",
      ".claude/skills/plan/SKILL.md": "---\nname: ck:plan\ndescription: Plan\nargument-hint: [task]\n---\nUse AskUserQuestion and TaskCreate.\nLoad: references/workflow-modes.md\n",
      ".claude/skills/plan/references/workflow-modes.md": "# modes\n",
      ".claude/rules/development-rules.md": "# Development Rules\n- Follow YAGNI\n",
      ".claude/command-archive/legacy.md": "# legacy\n",
      ".claude/settings.json": "{}\n",
      ".claude/hooks/hook.cjs": "console.log('hook')\n"
    });
    cleanups.push(fixture.cleanup);

    const result = await importClaudekitWave1({
      rootDir: fixture.rootDir,
      importedAt: "2026-03-22T00:00:00.000Z",
      emit: false
    });

    const workflow = result.manifests.find((manifest) => manifest.manifestType === "workflow");
    expect(result.registry.summary.roles).toBe(1);
    expect(result.registry.summary.coreWorkflows).toBe(1);
    expect(result.registry.summary.policies).toBe(1);
    expect(result.registry.summary.legacySkipped).toBe(1);
    expect(result.registry.summary.templatesDeferred).toBe(1);
    expect(workflow?.normalized.command).toBe("cdx plan");
    expect((workflow?.normalized.compatRewrites as string[]).sort()).toEqual(["approval.request", "task.create"]);
    expect(result.registry.sourceKit.ckConfig).toEqual({});
    expect(result.registry.sourceKit.metadata).toEqual({ kits: {} });
    expect(result.registry.skipped.some((entry) => entry.kind === "unsupported-source" && entry.sourcePath === ".claude/settings.json")).toBe(true);
  });

  it("quarantines malformed helper skills without failing core import", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/plan/SKILL.md": "---\nname: ck:plan\ndescription: Plan\nargument-hint: [task]\n---\nUse TaskCreate.\n",
      ".claude/skills/helper/SKILL.md": "---\nname helper-without-colon\n---\nbroken\n",
      ".claude/rules/development-rules.md": "# Rules\n"
    });
    cleanups.push(fixture.cleanup);

    const result = await importClaudekitWave1({ rootDir: fixture.rootDir, emit: false });
    expect(result.registry.summary.coreWorkflows).toBe(1);
    expect(result.registry.summary.quarantined).toBe(1);
    expect(result.registry.skipped.some((entry) => entry.kind === "quarantined-source")).toBe(true);
  });

  it("fails when a core workflow has malformed frontmatter", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/plan/SKILL.md": "---\nname ck:plan\n---\nbroken\n",
      ".claude/rules/development-rules.md": "# Rules\n"
    });
    cleanups.push(fixture.cleanup);

    await expect(importClaudekitWave1({ rootDir: fixture.rootDir, emit: false })).rejects.toMatchObject<ImporterError>({
      code: "parse-failed"
    });
  });

  it("emits only under .codexkit/manifests and leaves source files unchanged", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/plan/SKILL.md": "---\nname: ck:plan\ndescription: Plan\nargument-hint: [task]\n---\nUse AskUserQuestion.\n",
      ".claude/rules/development-rules.md": "# Rules\n- Always verify\n"
    });
    cleanups.push(fixture.cleanup);

    const agentPath = path.join(fixture.rootDir, ".claude/agents/planner.md");
    const before = await readFile(agentPath, "utf8");
    const beforeChecksum = sha256(before);

    await importClaudekitWave1({ rootDir: fixture.rootDir, importedAt: "2026-03-22T00:00:00.000Z" });

    const manifestPath = path.join(fixture.rootDir, ".codexkit/manifests/roles/planner.role.json");
    const registryPath = path.join(fixture.rootDir, ".codexkit/manifests/import-registry.json");
    await stat(manifestPath);
    await stat(registryPath);

    const after = await readFile(agentPath, "utf8");
    expect(sha256(after)).toBe(beforeChecksum);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { source: { path: string } };
    expect(manifest.source.path).toBe(".claude/agents/planner.md");
  });

  it("uses a deterministic default importedAt when caller does not provide one", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/plan/SKILL.md": "---\nname: ck:plan\ndescription: Plan\nargument-hint: [task]\n---\nUse AskUserQuestion.\n",
      ".claude/rules/development-rules.md": "# Rules\n"
    });
    cleanups.push(fixture.cleanup);

    const first = await importClaudekitWave1({ rootDir: fixture.rootDir, emit: false });
    const second = await importClaudekitWave1({ rootDir: fixture.rootDir, emit: false });

    expect(first.registry.importedAt).toBe("1970-01-01T00:00:00.000Z");
    expect(second.registry.importedAt).toBe("1970-01-01T00:00:00.000Z");
    expect(JSON.stringify(first.registry)).toBe(JSON.stringify(second.registry));
  });

  it("blocks replacement of existing managed tree unless explicitly allowed", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/plan/SKILL.md": "---\nname: ck:plan\ndescription: Plan\nargument-hint: [task]\n---\nUse AskUserQuestion.\n",
      ".claude/rules/development-rules.md": "# Rules\n"
    });
    cleanups.push(fixture.cleanup);

    const stalePath = path.join(fixture.rootDir, ".codexkit/manifests/roles/planner.role.json");
    await mkdir(path.dirname(stalePath), { recursive: true });
    await writeFile(stalePath, "{\"stale\":true}\n", "utf8");

    await expect(importClaudekitWave1({ rootDir: fixture.rootDir })).rejects.toMatchObject<ImporterError>({
      code: "emit-preflight-conflict"
    });
    expect(await readFile(stalePath, "utf8")).toBe("{\"stale\":true}\n");
  });

  it("replaces existing managed tree only when explicit replacement opt-in is provided", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/plan/SKILL.md": "---\nname: ck:plan\ndescription: Plan\nargument-hint: [task]\n---\nUse AskUserQuestion.\n",
      ".claude/rules/development-rules.md": "# Rules\n"
    });
    cleanups.push(fixture.cleanup);

    const stalePath = path.join(fixture.rootDir, ".codexkit/manifests/roles/planner.role.json");
    await mkdir(path.dirname(stalePath), { recursive: true });
    await writeFile(stalePath, "{\"stale\":true}\n", "utf8");

    await importClaudekitWave1({
      rootDir: fixture.rootDir,
      allowManagedTreeReplace: true
    });

    const replaced = JSON.parse(await readFile(stalePath, "utf8")) as { schemaVersion: number };
    expect(replaced.schemaVersion).toBe(1);
  });

  it("supports nested and list YAML frontmatter in skills", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/ai-multimodal/SKILL.md":
        "---\nname: ck:ai-multimodal\ndescription: Analyze media\nallowed-tools:\n  - Bash\n  - Read\nargument-hint: \"[file]\"\n---\nbody\n",
      ".claude/skills/remotion/SKILL.md":
        "---\nname: ck:remotion\ndescription: Remotion best practices\nmetadata:\n  tags: remotion, video, react\nargument-hint: \"[component]\"\n---\nbody\n",
      ".claude/skills/plan/SKILL.md": "---\nname: ck:plan\ndescription: Plan\nargument-hint: [task]\n---\nUse TaskCreate.\n",
      ".claude/rules/development-rules.md": "# Rules\n"
    });
    cleanups.push(fixture.cleanup);

    const result = await importClaudekitWave1({ rootDir: fixture.rootDir, emit: false });
    expect(result.registry.summary.quarantined).toBe(0);

    const aiWorkflow = result.manifests.find((manifest) => manifest.source.path === ".claude/skills/ai-multimodal/SKILL.md");
    const remotionWorkflow = result.manifests.find((manifest) => manifest.source.path === ".claude/skills/remotion/SKILL.md");
    expect(aiWorkflow?.raw.frontmatter).toMatchObject({ "allowed-tools": ["Bash", "Read"] });
    expect(remotionWorkflow?.raw.frontmatter).toMatchObject({ metadata: { tags: "remotion, video, react" } });
  });

  it("extracts spec-required normalized workflow frontmatter fields", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/plan/SKILL.md":
        "---\nname: ck:plan\ndescription: Plan\nversion: 2\nlicense: MIT\nallowed-tools:\n  - Bash\n  - Read\nmetadata:\n  owner: docs\n  tags:\n    - plan\nargument-hint: [task]\n---\nUse TaskCreate.\n",
      ".claude/skills/docs/SKILL.md":
        "---\nname: ck:docs\ndescription: Docs\nargument-hint: init|update|summarize\n---\nUse AskUserQuestion.\n",
      ".claude/rules/development-rules.md": "# Rules\n"
    });
    cleanups.push(fixture.cleanup);

    const result = await importClaudekitWave1({ rootDir: fixture.rootDir, emit: false });
    const planWorkflow = result.manifests.find((manifest) => manifest.source.path === ".claude/skills/plan/SKILL.md");
    const docsWorkflow = result.manifests.find((manifest) => manifest.source.path === ".claude/skills/docs/SKILL.md");

    const normalizedPlan = (planWorkflow?.normalized ?? {}) as Record<string, unknown>;
    expect(normalizedPlan.version).toBe("2");
    expect(normalizedPlan.license).toBe("MIT");
    expect(normalizedPlan["allowed-tools"]).toEqual(["Bash", "Read"]);
    expect(normalizedPlan.metadata).toEqual({ owner: "docs", tags: ["plan"] });

    const normalizedDocs = (docsWorkflow?.normalized ?? {}) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(normalizedDocs, "version")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(normalizedDocs, "license")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(normalizedDocs, "allowed-tools")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(normalizedDocs, "metadata")).toBe(true);
    expect(normalizedDocs.version).toBeNull();
    expect(normalizedDocs.license).toBeNull();
    expect(normalizedDocs["allowed-tools"]).toEqual([]);
    expect(normalizedDocs.metadata).toBeNull();
  });

  it("audits unreferenced top-level .claude/scripts files as skipped", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/plan/SKILL.md":
        "---\nname: ck:plan\ndescription: Plan\nargument-hint: [task]\n---\nAfter creating plan: `node .claude/scripts/set-active-plan.cjs {plan-dir}`\n",
      ".claude/rules/development-rules.md": "# Rules\n",
      ".claude/scripts/set-active-plan.cjs": "console.log('set')\n",
      ".claude/scripts/unreferenced.cjs": "console.log('unused')\n"
    });
    cleanups.push(fixture.cleanup);

    const result = await importClaudekitWave1({ rootDir: fixture.rootDir, emit: false });
    const workflow = result.manifests.find((manifest) => manifest.manifestType === "workflow" && manifest.id === "plan");

    expect(workflow?.resources.some((resource) => resource.path === ".claude/scripts/set-active-plan.cjs")).toBe(true);
    expect(result.registry.skipped.some((entry) => entry.sourcePath === ".claude/scripts/unreferenced.cjs")).toBe(true);
    expect(result.registry.skipped.some((entry) => entry.sourcePath === ".claude/scripts/set-active-plan.cjs")).toBe(false);
  });

  it("indexes top-level scripts referenced from companion references markdown", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/docs/SKILL.md":
        "---\nname: ck:docs\ndescription: Docs\nargument-hint: init|update|summarize\n---\nLoad references/update-workflow.md.\n",
      ".claude/skills/docs/references/update-workflow.md":
        "# Update\nRun `node .claude/scripts/validate-docs.cjs docs/` after docs updates.\n",
      ".claude/rules/development-rules.md": "# Rules\n",
      ".claude/scripts/validate-docs.cjs": "console.log('validate')\n",
      ".claude/scripts/unreferenced.cjs": "console.log('unused')\n"
    });
    cleanups.push(fixture.cleanup);

    const result = await importClaudekitWave1({ rootDir: fixture.rootDir, emit: false });
    const docsWorkflow = result.manifests.find((manifest) => manifest.source.path === ".claude/skills/docs/SKILL.md");

    expect(docsWorkflow?.resources.some((resource) => resource.path === ".claude/scripts/validate-docs.cjs")).toBe(true);
    expect(result.registry.skipped.some((entry) => entry.sourcePath === ".claude/scripts/validate-docs.cjs")).toBe(false);
    expect(result.registry.skipped.some((entry) => entry.sourcePath === ".claude/scripts/unreferenced.cjs")).toBe(true);
  });

  it("does not treat markdown table separator rows as workflow modes", async () => {
    const fixture = await createImporterFixture({
      ".claude/agents/planner.md": "---\nname: planner\ndescription: Planner\ntools: Read\n---\nrole body\n",
      ".claude/skills/plan/SKILL.md":
        "---\nname: ck:plan\ndescription: Plan\nargument-hint: [task]\n---\n| Flag | Mode |\n|------|------|\n| --auto | Auto |\n| --fast | Fast |\n",
      ".claude/rules/development-rules.md": "# Rules\n"
    });
    cleanups.push(fixture.cleanup);

    const result = await importClaudekitWave1({ rootDir: fixture.rootDir, emit: false });
    const workflow = result.manifests.find((manifest) => manifest.manifestType === "workflow" && manifest.id === "plan");
    const modes = (workflow?.normalized.modes as string[]) ?? [];
    expect(modes).toContain("auto");
    expect(modes).toContain("fast");
    expect(modes).not.toContain("-----");
  });

  it("imports all 68 workflows from the live repo wave 1 surface", async () => {
    const result = await importClaudekitWave1({ rootDir: process.cwd(), emit: false });
    expect(result.registry.summary.coreWorkflows + result.registry.summary.helperWorkflows).toBe(68);
    expect(result.registry.summary.quarantined).toBe(0);
  }, 20_000);
});
