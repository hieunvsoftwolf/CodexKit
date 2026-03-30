export function parseCliJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("expected JSON payload but received empty output");
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error(`expected JSON payload but received: ${trimmed}`);
  }
}

export function parseCliFailure(error: unknown): Record<string, unknown> {
  const stderr = (error as { stderr?: string | Buffer }).stderr;
  const raw = typeof stderr === "string"
    ? stderr
    : Buffer.isBuffer(stderr)
      ? stderr.toString("utf8")
      : "";
  return parseCliJsonObject(raw);
}
