import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  PHASE10_DEFAULT_RUNNER_COMMAND,
  PHASE10_PUBLIC_BETA_SMOKE_MATRIX,
  PHASE10_PUBLIC_PACKAGE_BIN_CONTRACT,
  PHASE10_PUBLIC_CLI_BIN_NAME,
  PHASE10_PUBLIC_COMMAND_CONTRACT,
  PHASE10_PUBLIC_NPM_PACKAGE_NAME,
  PHASE10_RUNNER_ENV_OVERRIDE,
  PHASE10_RUNNER_RESOLUTION_ORDER,
  loadRuntimeConfig,
  openRuntimeContext,
  resolveWorkerRunnerConfig,
  WorkerRuntime
} from "../../packages/codexkit-daemon/src/index.ts";
import { createGitRuntimeFixture, createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

function runCli(rootDir: string, args: string[], env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8",
    env
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function command(script: string): string[] {
  return [process.execPath, "-e", script];
}

describe("phase 10 shared contract freeze", () => {
  test("freezes one authoritative package and bin seam across runtime, manifests, and docs", () => {
    expect(PHASE10_PUBLIC_PACKAGE_BIN_CONTRACT).toEqual({
      packageName: "@codexkit/cli",
      binName: "cdx"
    });
    expect(PHASE10_PUBLIC_NPM_PACKAGE_NAME).toBe("@codexkit/cli");
    expect(PHASE10_PUBLIC_CLI_BIN_NAME).toBe("cdx");
    expect(PHASE10_RUNNER_ENV_OVERRIDE).toBe("CODEXKIT_RUNNER");
    expect(PHASE10_RUNNER_RESOLUTION_ORDER).toEqual(["env-override", "config-file", "default"]);
    expect(PHASE10_PUBLIC_COMMAND_CONTRACT).toEqual({
      installNpx: "npx @codexkit/cli init",
      installGlobal: "npm install -g @codexkit/cli",
      initNpx: "npx @codexkit/cli init",
      doctorNpx: "npx @codexkit/cli doctor",
      initGlobal: "cdx init",
      doctorGlobal: "cdx doctor"
    });
    expect(PHASE10_PUBLIC_BETA_SMOKE_MATRIX.map((item) => item.id)).toEqual([
      "fresh-repo",
      "git-backed-repo",
      "install-only-repo",
      "wrapped-runner"
    ]);

    const workspacePackage = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      bin?: Record<string, string>;
      codexkitPhase10Contract?: unknown;
    };
    expect(workspacePackage.bin).toBeUndefined();
    expect(workspacePackage.codexkitPhase10Contract).toBeUndefined();

    const cliPackage = JSON.parse(readFileSync(path.join(process.cwd(), "packages", "codexkit-cli", "package.json"), "utf8")) as {
      name: string;
      bin: Record<string, string>;
      codexkitPhase10Contract?: unknown;
    };
    expect(cliPackage.name).toBe(PHASE10_PUBLIC_NPM_PACKAGE_NAME);
    expect(cliPackage.bin).toEqual({
      [PHASE10_PUBLIC_CLI_BIN_NAME]: "./dist/index.js"
    });
    expect(cliPackage.codexkitPhase10Contract).toBeUndefined();

    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    const architecture = readFileSync(path.join(process.cwd(), "docs", "system-architecture.md"), "utf8");
    const workflowSpec = readFileSync(path.join(process.cwd(), "docs", "workflow-extended-and-release-spec.md"), "utf8");
    for (const command of Object.values(PHASE10_PUBLIC_COMMAND_CONTRACT)) {
      expect(readme).toContain(command);
      expect(architecture).toContain(command);
      expect(workflowSpec).toContain(command);
    }
  });

  test("resolves runner in order with quoted command-safe parsing", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase10-runner-resolution");
    cleanups.push(() => fixture.cleanup());
    const configDir = path.join(fixture.rootDir, ".codexkit");
    const configPath = path.join(configDir, "config.toml");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      configPath,
      [
        "schema_version = 1",
        "managed_by = \"codexkit\"",
        "",
        "[runner]",
        "command = \"codex-safe exec --profile beta\"",
        ""
      ].join("\n"),
      "utf8"
    );

    const fromConfig = resolveWorkerRunnerConfig(fixture.rootDir, {});
    expect(fromConfig.source).toBe("config-file");
    expect(fromConfig.command).toEqual(["codex-safe", "exec", "--profile", "beta"]);

    const fromEnv = resolveWorkerRunnerConfig(fixture.rootDir, {
      [PHASE10_RUNNER_ENV_OVERRIDE]: "codex exec --approval-mode auto"
    });
    expect(fromEnv.source).toBe("env-override");
    expect(fromEnv.command).toEqual(["codex", "exec", "--approval-mode", "auto"]);

    const fromDefault = resolveWorkerRunnerConfig(fixture.rootDir, {
      [PHASE10_RUNNER_ENV_OVERRIDE]: ""
    });
    expect(fromDefault.source).toBe("config-file");
    expect(fromDefault.command).toEqual(["codex-safe", "exec", "--profile", "beta"]);

    writeFileSync(configPath, "schema_version = 1\nmanaged_by = \"codexkit\"\n", "utf8");
    const fallback = resolveWorkerRunnerConfig(fixture.rootDir, {});
    expect(fallback.source).toBe("default");
    expect(fallback.command).toEqual([...PHASE10_DEFAULT_RUNNER_COMMAND]);

    writeFileSync(
      configPath,
      [
        "schema_version = 1",
        "managed_by = \"codexkit\"",
        "",
        "[runner]",
        "command = \"'/tmp/codex safe' exec --label 'beta team'\"",
        ""
      ].join("\n"),
      "utf8"
    );
    const quotedConfig = resolveWorkerRunnerConfig(fixture.rootDir, {});
    expect(quotedConfig.source).toBe("config-file");
    expect(quotedConfig.command).toEqual(["/tmp/codex safe", "exec", "--label", "beta team"]);

    const quotedEnv = resolveWorkerRunnerConfig(fixture.rootDir, {
      [PHASE10_RUNNER_ENV_OVERRIDE]: "\"/opt/codex safe\" exec --profile \"safety lane\""
    });
    expect(quotedEnv.source).toBe("env-override");
    expect(quotedEnv.command).toEqual(["/opt/codex safe", "exec", "--profile", "safety lane"]);

    const malformedEnv = resolveWorkerRunnerConfig(fixture.rootDir, {
      [PHASE10_RUNNER_ENV_OVERRIDE]: "\"/broken path exec"
    });
    expect(malformedEnv.source).toBe("env-override");
    expect(malformedEnv.selectionState).toBe("invalid");
    expect(malformedEnv.commandText).toBe("\"/broken path exec");
    expect(malformedEnv.command).toEqual([]);

    writeFileSync(
      configPath,
      [
        "schema_version = 1",
        "managed_by = \"codexkit\"",
        "",
        "[runner]",
        "command = \"'/broken path exec\"",
        ""
      ].join("\n"),
      "utf8"
    );
    const malformedConfig = resolveWorkerRunnerConfig(fixture.rootDir, {});
    expect(malformedConfig.source).toBe("config-file");
    expect(malformedConfig.selectionState).toBe("invalid");
    expect(malformedConfig.commandText).toBe("'/broken path exec");
    expect(malformedConfig.command).toEqual([]);
  });

  test("treats explicit empty config runner selection as invalid instead of default fallback", async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase10-empty-config-runner-invalid");
    cleanups.push(() => fixture.cleanup());
    const configDir = path.join(fixture.rootDir, ".codexkit");
    const configPath = path.join(configDir, "config.toml");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      configPath,
      [
        "schema_version = 1",
        "managed_by = \"codexkit\"",
        "",
        "[runner]",
        "command = \"\"",
        ""
      ].join("\n"),
      "utf8"
    );
    const doctorEnv = { ...process.env };
    delete doctorEnv[PHASE10_RUNNER_ENV_OVERRIDE];

    const selectedRunner = resolveWorkerRunnerConfig(fixture.rootDir, doctorEnv);
    expect(selectedRunner.source).toBe("config-file");
    expect(selectedRunner.selectionState).toBe("invalid");
    expect(selectedRunner.commandText).toBe("");

    const doctor = runCli(fixture.rootDir, ["doctor"], doctorEnv);
    expect(doctor.runnerSource).toBe("config-file");
    expect(doctor.runnerCommand).toBe("");
    expect(doctor.runnerAvailable).toBe(false);
    expect(doctor.status).toBe("blocked");
    expect(
      (doctor.findings as Array<{ code: string }>).some(
        (finding) => finding.code === "DOCTOR_SELECTED_RUNNER_INVALID"
      )
    ).toBe(true);
  });

  test("loadRuntimeConfig exposes frozen runner metadata for runtime consumers", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase10-runtime-config");
    cleanups.push(() => fixture.cleanup());
    const previous = process.env[PHASE10_RUNNER_ENV_OVERRIDE];
    process.env[PHASE10_RUNNER_ENV_OVERRIDE] = "codex-safe exec --read-only";
    try {
      const config = loadRuntimeConfig(fixture.rootDir);
      expect(config.workerRunner.source).toBe("env-override");
      expect(config.workerRunner.command).toEqual(["codex-safe", "exec", "--read-only"]);
      expect(config.workerRunner.commandText).toBe("codex-safe exec --read-only");
    } finally {
      if (typeof previous === "string") {
        process.env[PHASE10_RUNNER_ENV_OVERRIDE] = previous;
      } else {
      delete process.env[PHASE10_RUNNER_ENV_OVERRIDE];
      }
    }
  });

  test("blocks worker launch before spawn when env/config selected runner states are invalid", async () => {
    const envFixture = await createGitRuntimeFixture("codexkit-phase10-invalid-env-runner-spawn-block");
    const configFixture = await createGitRuntimeFixture("codexkit-phase10-invalid-config-runner-spawn-block");
    cleanups.push(() => envFixture.cleanup());
    cleanups.push(() => configFixture.cleanup());
    const previous = process.env[PHASE10_RUNNER_ENV_OVERRIDE];
    try {
      process.env[PHASE10_RUNNER_ENV_OVERRIDE] = "\"/broken path exec";
      const envContext = openRuntimeContext(loadRuntimeConfig(envFixture.rootDir));
      cleanups.push(() => envContext.close());
      const envRuntime = new WorkerRuntime(envContext, { heartbeatMs: 50, gracefulTimeoutMs: 200 });
      cleanups.push(() => envRuntime.shutdownAll());
      const envRun = envContext.runService.createRun({ workflow: "cook" });
      const envTask = envContext.taskService.createTask({ runId: envRun.id, role: "developer", subject: "invalid env runner" });
      let envError: unknown = null;
      try {
        envRuntime.spawnWorker({
          runId: envRun.id,
          taskId: envTask.id,
          role: "developer",
          displayName: "Invalid Env Runner Worker",
          prompt: "should block before spawn",
          context: {},
          ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: ["reports"] },
          command: command("process.exit(0)")
        });
      } catch (error) {
        envError = error;
      }
      expect(envError).toMatchObject({
        code: "WORKFLOW_BLOCKED",
        details: expect.objectContaining({
          code: "WF_SELECTED_RUNNER_INVALID",
          source: "env-override",
          commandText: "\"/broken path exec"
        })
      });
      expect(envContext.workerService.listWorkers({ runId: envRun.id })).toHaveLength(0);
      expect(envContext.claimService.listClaims({ runId: envRun.id })).toHaveLength(0);

      delete process.env[PHASE10_RUNNER_ENV_OVERRIDE];
      const configDir = path.join(configFixture.rootDir, ".codexkit");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        path.join(configDir, "config.toml"),
        [
          "schema_version = 1",
          "managed_by = \"codexkit\"",
          "",
          "[runner]",
          "command = \"'/broken path exec\"",
          ""
        ].join("\n"),
        "utf8"
      );

      const configContext = openRuntimeContext(loadRuntimeConfig(configFixture.rootDir));
      cleanups.push(() => configContext.close());
      const configRuntime = new WorkerRuntime(configContext, { heartbeatMs: 50, gracefulTimeoutMs: 200 });
      cleanups.push(() => configRuntime.shutdownAll());
      const configRun = configContext.runService.createRun({ workflow: "cook" });
      const configTask = configContext.taskService.createTask({
        runId: configRun.id,
        role: "developer",
        subject: "invalid config runner"
      });
      let configError: unknown = null;
      try {
        configRuntime.spawnWorker({
          runId: configRun.id,
          taskId: configTask.id,
          role: "developer",
          displayName: "Invalid Config Runner Worker",
          prompt: "should block before spawn",
          context: {},
          ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: ["reports"] },
          command: command("process.exit(0)")
        });
      } catch (error) {
        configError = error;
      }
      expect(configError).toMatchObject({
        code: "WORKFLOW_BLOCKED",
        details: expect.objectContaining({
          code: "WF_SELECTED_RUNNER_INVALID",
          source: "config-file",
          commandText: "'/broken path exec"
        })
      });
      expect(configContext.workerService.listWorkers({ runId: configRun.id })).toHaveLength(0);
      expect(configContext.claimService.listClaims({ runId: configRun.id })).toHaveLength(0);
    } finally {
      if (typeof previous === "string") {
        process.env[PHASE10_RUNNER_ENV_OVERRIDE] = previous;
      } else {
        delete process.env[PHASE10_RUNNER_ENV_OVERRIDE];
      }
    }
  });

  test("doctor and init surface runner source and command; doctor blocks unavailable selected runner", { timeout: 60_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase10-doctor-init-runner-surface");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);

    const initPreview = runCli(fixture.rootDir, ["init"], {
      ...process.env,
      [PHASE10_RUNNER_ENV_OVERRIDE]: "codex-safe exec --profile \"beta lane\""
    });
    expect(initPreview.runnerSource).toBe("env-override");
    expect(initPreview.runnerCommand).toBe("codex-safe exec --profile 'beta lane'");

    const doctorBlocked = runCli(fixture.rootDir, ["doctor"], {
      ...process.env,
      [PHASE10_RUNNER_ENV_OVERRIDE]: "definitely-not-a-real-runner --version"
    });
    expect(doctorBlocked.runnerSource).toBe("env-override");
    expect(doctorBlocked.runnerCommand).toBe("definitely-not-a-real-runner --version");
    expect(doctorBlocked.runnerAvailable).toBe(false);
    expect(doctorBlocked.status).toBe("blocked");
    expect(
      (doctorBlocked.findings as Array<{ code: string }>).some(
        (finding) => finding.code === "DOCTOR_SELECTED_RUNNER_UNAVAILABLE"
      )
    ).toBe(true);

    const doctorInvalid = runCli(fixture.rootDir, ["doctor"], {
      ...process.env,
      [PHASE10_RUNNER_ENV_OVERRIDE]: "\"/broken path exec"
    });
    expect(doctorInvalid.runnerSource).toBe("env-override");
    expect(doctorInvalid.runnerCommand).toBe("\"/broken path exec");
    expect(doctorInvalid.runnerAvailable).toBe(false);
    expect(doctorInvalid.status).toBe("blocked");
    expect(
      (doctorInvalid.findings as Array<{ code: string }>).some(
        (finding) => finding.code === "DOCTOR_SELECTED_RUNNER_INVALID"
      )
    ).toBe(true);

    let wrappedPath = process.env.PATH ?? "";
    try {
      const codexBinary = execFileSync("which", ["codex"], { encoding: "utf8" }).trim();
      const codexDir = path.dirname(codexBinary);
      wrappedPath = wrappedPath
        .split(path.delimiter)
        .filter((segment) => path.resolve(segment) !== path.resolve(codexDir))
        .join(path.delimiter);
    } catch {
      wrappedPath = process.env.PATH ?? "";
    }
    const doctorWrapped = runCli(fixture.rootDir, ["doctor"], {
      ...process.env,
      PATH: wrappedPath,
      [PHASE10_RUNNER_ENV_OVERRIDE]: "\"/bin/cat\" /dev/null"
    });
    expect(doctorWrapped.runnerSource).toBe("env-override");
    expect(String(doctorWrapped.runnerCommand)).toContain("/bin/cat");
    expect(String(doctorWrapped.runnerCommand)).toContain("/dev/null");
    expect(doctorWrapped.runnerAvailable).toBe(true);
    expect(
      (doctorWrapped.findings as Array<{ code: string }>).some(
        (finding) => finding.code === "DOCTOR_SELECTED_RUNNER_UNAVAILABLE"
      )
    ).toBe(false);
    expect(
      (doctorWrapped.findings as Array<{ code: string }>).some(
        (finding) => finding.code === "DOCTOR_SELECTED_RUNNER_INCOMPATIBLE"
      )
    ).toBe(false);
  });

  test("requires a fresh preview before apply can proceed after runner drift", { timeout: 60_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase10-init-runner-drift-preview-apply");
    cleanups.push(() => fixture.cleanup());
    const previewEnv = { ...process.env };
    delete previewEnv[PHASE10_RUNNER_ENV_OVERRIDE];
    const driftedRunnerEnv = {
      ...previewEnv,
      [PHASE10_RUNNER_ENV_OVERRIDE]: "\"/bin/cat\" /dev/null"
    };
    runCli(fixture.rootDir, ["daemon", "start", "--once"], previewEnv);

    const preview = runCli(
      fixture.rootDir,
      ["init", "--approve-protected", "--approve-managed-overwrite"],
      previewEnv
    );
    expect(preview.runnerSource).toBe("default");
    expect(preview.runnerCommand).toBe("codex exec");

    const firstDriftedApply = runCli(
      fixture.rootDir,
      ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"],
      driftedRunnerEnv
    );
    expect(firstDriftedApply.runnerSource).toBe("env-override");
    expect(String(firstDriftedApply.runnerCommand)).toContain("/bin/cat");
    expect(String(firstDriftedApply.runnerCommand)).toContain("/dev/null");
    expect(firstDriftedApply.applyExecuted).toBe(false);
    expect(
      (firstDriftedApply.blockedActions as Array<{ code: string }>).some(
        (action) => action.code === "INIT_APPLY_REQUIRES_PREVIEW"
      )
    ).toBe(true);

    const secondDriftedApply = runCli(
      fixture.rootDir,
      ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"],
      driftedRunnerEnv
    );
    expect(secondDriftedApply.runnerSource).toBe("env-override");
    expect(secondDriftedApply.applyExecuted).toBe(false);
    expect(
      (secondDriftedApply.blockedActions as Array<{ code: string }>).some(
        (action) => action.code === "INIT_APPLY_REQUIRES_PREVIEW"
      )
    ).toBe(true);

    const driftedRunnerPreview = runCli(
      fixture.rootDir,
      ["init", "--approve-protected", "--approve-managed-overwrite"],
      driftedRunnerEnv
    );
    expect(driftedRunnerPreview.runnerSource).toBe("env-override");
    expect(String(driftedRunnerPreview.runnerCommand)).toContain("/bin/cat");
    expect(String(driftedRunnerPreview.runnerCommand)).toContain("/dev/null");
    expect(driftedRunnerPreview.applyExecuted).toBe(false);

    const driftedRunnerApplyAfterPreview = runCli(
      fixture.rootDir,
      ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"],
      driftedRunnerEnv
    );
    expect(driftedRunnerApplyAfterPreview.runnerSource).toBe("env-override");
    expect(String(driftedRunnerApplyAfterPreview.runnerCommand)).toContain("/bin/cat");
    expect(String(driftedRunnerApplyAfterPreview.runnerCommand)).toContain("/dev/null");
    expect(driftedRunnerApplyAfterPreview.applyExecuted).toBe(true);
    expect(
      (driftedRunnerApplyAfterPreview.blockedActions as Array<{ code: string }>).some(
        (action) => action.code === "INIT_APPLY_REQUIRES_PREVIEW"
      )
    ).toBe(false);
  });
});
