import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveRuntimePaths, type RuntimePaths } from "../../codexkit-db/src/index.ts";
import {
  PHASE10_DEFAULT_RUNNER_COMMAND,
  PHASE10_RUNNER_CONFIG_PATH,
  PHASE10_RUNNER_ENV_OVERRIDE,
  type Phase10RunnerSource
} from "./workflows/packaging-contracts.ts";

export interface WorkerRunnerConfig {
  source: Phase10RunnerSource;
  command: string[];
  commandText: string;
  selectionState: "resolved" | "invalid";
  invalidReason: string | null;
  envVar: string;
  configPath: string;
}

export interface RuntimeConfig {
  paths: RuntimePaths;
  sweepIntervalMs: number;
  workerStaleMs: number;
  eventBatchSize: number;
  workerRunner: WorkerRunnerConfig;
}

interface ParsedRunnerCommand {
  tokens: string[] | null;
  invalidReason: string | null;
}

function parseRunnerCommandText(raw: string): ParsedRunnerCommand {
  const input = raw.trim();
  if (input.length === 0) {
    return {
      tokens: null,
      invalidReason: null
    };
  }
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaping = false;
  let tokenStarted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (escaping) {
      current += char;
      escaping = false;
      tokenStarted = true;
      continue;
    }
    if (char === "\\") {
      if (inSingle) {
        current += char;
        tokenStarted = true;
      } else {
        escaping = true;
      }
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      tokenStarted = true;
      continue;
    }
    if (char === "\"" && !inSingle) {
      inDouble = !inDouble;
      tokenStarted = true;
      continue;
    }
    if (!inSingle && !inDouble && /\s/.test(char)) {
      if (tokenStarted) {
        tokens.push(current);
        current = "";
        tokenStarted = false;
      }
      continue;
    }
    current += char;
    tokenStarted = true;
  }

  if (escaping) {
    return {
      tokens: null,
      invalidReason: "runner command has a dangling escape sequence."
    };
  }
  if (inSingle || inDouble) {
    return {
      tokens: null,
      invalidReason: "runner command has an unterminated quoted segment."
    };
  }
  if (tokenStarted) {
    tokens.push(current);
  }
  return {
    tokens: tokens.length > 0 ? tokens : null,
    invalidReason: null
  };
}

function stripInlineComment(raw: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === "\"" && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "#" && !inSingle && !inDouble) {
      return raw.slice(0, index);
    }
  }
  return raw;
}

function parseTomlScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }
  const quote = trimmed[0];
  if ((quote === "\"" || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

interface RunnerCommandConfigValue {
  commandText: string;
}

function readRunnerCommandFromConfig(rootDir: string): RunnerCommandConfigValue | null {
  const configPath = path.join(rootDir, PHASE10_RUNNER_CONFIG_PATH);
  if (!existsSync(configPath)) {
    return null;
  }
  const lines = readFileSync(configPath, "utf8").split(/\r?\n/);
  let section = "";
  for (const line of lines) {
    const withoutComment = stripInlineComment(line).trim();
    if (withoutComment.length === 0) {
      continue;
    }
    const sectionMatch = withoutComment.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1]!.trim();
      continue;
    }
    if (section !== "runner") {
      continue;
    }
    const eqIndex = withoutComment.indexOf("=");
    if (eqIndex < 0) {
      continue;
    }
    const key = withoutComment.slice(0, eqIndex).trim();
    if (key !== "command") {
      continue;
    }
    return {
      commandText: parseTomlScalar(withoutComment.slice(eqIndex + 1))
    };
  }
  return null;
}

export function resolveWorkerRunnerConfig(rootDir: string, env: NodeJS.ProcessEnv = process.env): WorkerRunnerConfig {
  const envOverrideRaw = env[PHASE10_RUNNER_ENV_OVERRIDE]?.trim();
  const configPath = path.join(rootDir, PHASE10_RUNNER_CONFIG_PATH);
  if (envOverrideRaw) {
    const parsed = parseRunnerCommandText(envOverrideRaw);
    if (parsed.tokens) {
      return {
        source: "env-override",
        command: parsed.tokens,
        commandText: envOverrideRaw,
        selectionState: "resolved",
        invalidReason: null,
        envVar: PHASE10_RUNNER_ENV_OVERRIDE,
        configPath
      };
    }
    if (parsed.invalidReason) {
      return {
        source: "env-override",
        command: [],
        commandText: envOverrideRaw,
        selectionState: "invalid",
        invalidReason: parsed.invalidReason,
        envVar: PHASE10_RUNNER_ENV_OVERRIDE,
        configPath
      };
    }
  }

  const configSelection = readRunnerCommandFromConfig(rootDir);
  if (configSelection) {
    const configRaw = configSelection.commandText.trim();
    if (configRaw.length === 0) {
      return {
        source: "config-file",
        command: [],
        commandText: configSelection.commandText,
        selectionState: "invalid",
        invalidReason: "runner command is empty.",
        envVar: PHASE10_RUNNER_ENV_OVERRIDE,
        configPath
      };
    }
    const parsed = parseRunnerCommandText(configRaw);
    if (parsed.tokens) {
      return {
        source: "config-file",
        command: parsed.tokens,
        commandText: configRaw,
        selectionState: "resolved",
        invalidReason: null,
        envVar: PHASE10_RUNNER_ENV_OVERRIDE,
        configPath
      };
    }
    if (parsed.invalidReason) {
      return {
        source: "config-file",
        command: [],
        commandText: configRaw,
        selectionState: "invalid",
        invalidReason: parsed.invalidReason,
        envVar: PHASE10_RUNNER_ENV_OVERRIDE,
        configPath
      };
    }
  }

  const fallback = [...PHASE10_DEFAULT_RUNNER_COMMAND];
  return {
    source: "default",
    command: fallback,
    commandText: fallback.join(" "),
    selectionState: "resolved",
    invalidReason: null,
    envVar: PHASE10_RUNNER_ENV_OVERRIDE,
    configPath
  };
}

export function loadRuntimeConfig(rootDir = process.cwd()): RuntimeConfig {
  const resolvedRoot = path.resolve(rootDir);
  return {
    paths: resolveRuntimePaths(resolvedRoot),
    sweepIntervalMs: Number(process.env.CODEXKIT_SWEEP_INTERVAL_MS ?? 5_000),
    workerStaleMs: Number(process.env.CODEXKIT_WORKER_STALE_MS ?? 60_000),
    eventBatchSize: Number(process.env.CODEXKIT_EVENT_BATCH_SIZE ?? 100),
    workerRunner: resolveWorkerRunnerConfig(resolvedRoot, process.env)
  };
}
