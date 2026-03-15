export interface ParsedArgs {
  positionals: string[];
  options: Record<string, string | boolean | string[]>;
  json: boolean;
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

    const key = token.slice(2);
    if (key === "json") {
      json = true;
      continue;
    }

    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (value !== true) {
      index += 1;
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
