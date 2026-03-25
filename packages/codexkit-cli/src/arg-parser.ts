export interface ParsedArgs {
  positionals: string[];
  options: Record<string, string | boolean | string[]>;
  json: boolean;
}

const BOOLEAN_OPTIONS = new Set([
  "apply",
  "approve-git-init",
  "approve-managed-overwrite",
  "approve-protected",
  "auto",
  "coverage",
  "delegate",
  "fast",
  "foreground",
  "hard",
  "help",
  "continue-plan",
  "inherit-auto",
  "json",
  "no-tasks",
  "no-plan-approval",
  "no-test",
  "once",
  "parallel",
  "plan-approval",
  "quick",
  "read-only",
  "review",
  "two",
  "init-git"
]);

function splitOptionToken(token: string): { key: string; inlineValue?: string } {
  const equalIndex = token.indexOf("=");
  if (equalIndex === -1) {
    return { key: token };
  }
  return {
    key: token.slice(0, equalIndex),
    inlineValue: token.slice(equalIndex + 1)
  };
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string | boolean | string[]> = {};
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const { key, inlineValue } = splitOptionToken(token.slice(2));
    if (key === "json") {
      json = true;
      continue;
    }

    let value: string | boolean = true;
    if (inlineValue !== undefined) {
      value = inlineValue;
    } else if (!BOOLEAN_OPTIONS.has(key)) {
      const next = argv[index + 1];
      value = !next || next.startsWith("--") ? true : next;
      if (value !== true) {
        index += 1;
      }
    }

    const current = options[key];
    if (current === undefined) {
      options[key] = value;
    } else if (Array.isArray(current)) {
      current.push(String(value));
    } else {
      options[key] = [String(current), String(value)];
    }
  }

  return { positionals, options, json };
}

export function optionValue(options: ParsedArgs["options"], key: string): string | undefined {
  const value = options[key];
  if (Array.isArray(value)) {
    return value.at(-1);
  }
  return typeof value === "string" ? value : undefined;
}

export function optionValues(options: ParsedArgs["options"], key: string): string[] {
  const value = options[key];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => entry.split(",").map((part) => part.trim()).filter(Boolean));
  }
  if (typeof value === "string") {
    return value.split(",").map((part) => part.trim()).filter(Boolean);
  }
  return [];
}

export function hasFlag(options: ParsedArgs["options"], key: string): boolean {
  return options[key] === true;
}
