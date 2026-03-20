import { CodexkitError } from "../../codexkit-core/src/index.ts";

export type CompatErrorCode =
  | "validation_error"
  | "not_found"
  | "permission_denied"
  | "state_conflict"
  | "lease_expired"
  | "not_supported"
  | "transient_unavailable"
  | "internal_error";

export class CompatToolError extends CodexkitError {
  readonly retryable: boolean;

  constructor(code: CompatErrorCode, message: string, retryable = false, details?: Record<string, unknown>) {
    super(code, message, { ...(details ?? {}), retryable });
    this.retryable = retryable;
  }
}

export function compatInvariant(
  condition: unknown,
  code: CompatErrorCode,
  message: string,
  retryable = false,
  details?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    throw new CompatToolError(code, message, retryable, details);
  }
}
