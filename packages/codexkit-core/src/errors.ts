export class CodexkitError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CodexkitError";
    this.code = code;
    this.details = details;
  }
}

export function invariant(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) {
    throw new CodexkitError(code, message);
  }
}
