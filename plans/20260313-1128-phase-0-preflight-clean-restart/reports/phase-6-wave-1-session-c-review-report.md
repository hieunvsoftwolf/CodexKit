# Phase 6 Wave 1 Session C Review Report

- Date: 2026-03-23
- Status: completed
- Role/Modal: code-reviewer / Default
- Scope reviewed: `P6-S0 + P6-S1 + P6-S2 + P6-S3 + P6-S4`
- Base: `cfdac9eecc918672082ab4d460b8236e2aea9566`

## CRITICAL

- `cdx review` is not reviewing repo state at all; it emits canned findings from `buildFindings(...)`, so even a clean codebase review returns fabricated `CRITICAL`/`IMPORTANT`/`MODERATE` findings instead of explicit `no findings`. This breaks the core Phase 6 review outcome and the findings contract. Evidence:
  - `packages/codexkit-daemon/src/workflows/review-workflow.ts:46`
  - `packages/codexkit-daemon/src/workflows/review-workflow.ts:190`
  - `tests/runtime/runtime-workflow-phase6-review.integration.test.ts:35`

- `cdx test` never runs preflight or test commands. Outcome is synthesized from the request text via `buildFailedTests(...)`, then fake totals/durations are published. On a repo with no runnable test prerequisites it can still report success with no blocking diagnostic, violating `no success claim without fresh verification evidence`, `NFR-3.3`, and the Phase 6 test contract. Evidence:
  - `packages/codexkit-daemon/src/workflows/test-workflow.ts:38`
  - `packages/codexkit-daemon/src/workflows/test-workflow.ts:124`
  - `packages/codexkit-daemon/src/workflows/test-workflow.ts:188`
  - `tests/runtime/runtime-workflow-phase6-test.integration.test.ts:32`

## IMPORTANT

- Bare `cdx review` is a contract regression. Spec requires a scope chooser before execution starts, but CLI currently hard-fails with `WF_REVIEW_OPERATION_REQUIRED`. The verification-owned review test fails on this exact path. Evidence:
  - `packages/codexkit-cli/src/workflow-command-handler.ts:161`
  - `tests/runtime/runtime-workflow-phase6-review.integration.test.ts:52`

- Bare `cdx test` is the same class of regression. Spec requires a mode chooser between default and `ui`, but CLI hard-fails with `WF_TEST_OPERATION_REQUIRED`. This is not covered by the shared smoke test, so current verification misses it. Evidence:
  - `packages/codexkit-cli/src/workflow-command-handler.ts:201`
  - `docs/workflow-extended-and-release-spec.md` section `6.2`

- Generic approval continuation is not actually implemented for non-cook workflows. `resumeWorkflowFromApproval(...)` dispatch exists, but review/test/debug continuations are stubs that always return `null`. That leaves the shared runtime contract incomplete and will break as soon as non-cook approvals are introduced or restored. Evidence:
  - `packages/codexkit-daemon/src/workflows/approval-continuation.ts:10`
  - `packages/codexkit-daemon/src/workflows/review-workflow.ts:243`
  - `packages/codexkit-daemon/src/workflows/test-workflow.ts:250`
  - `packages/codexkit-daemon/src/workflows/debug-workflow.ts:242`

## MODERATE

- Debug branch routing is less inspectable than the current verification contract expects. The workflow records `debug-route` as `no-file` and returns `branches`, but does not expose a stable primary `route` field in the result. The verification-owned database-route test fails on that missing surface. Evidence:
  - `packages/codexkit-daemon/src/workflows/debug-workflow.ts:146`
  - `packages/codexkit-daemon/src/workflows/debug-workflow.ts:229`
  - `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts:39`

## Verification

Ran:

```bash
TMPDIR=.tmp npx vitest run \
  tests/runtime/runtime-workflow-phase6-cli.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-review.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-test.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-debug.integration.test.ts \
  --no-file-parallelism
```

Result:

- pass: `tests/runtime/runtime-workflow-phase6-cli.integration.test.ts`
- fail: `tests/runtime/runtime-workflow-phase6-review.integration.test.ts`
- fail: `tests/runtime/runtime-workflow-phase6-test.integration.test.ts`
- fail: `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`

Observed failing expectations:

- review codebase clean repo expected `no findings`
- bare review expected chooser/pending approval
- default test expected typed blocked/degraded diagnostic
- debug expected surfaced database route

## Residual Risk

- current Phase 6 workflows are mostly contract-shaped scaffolds, not behavior-shaped implementations
- shared runtime smoke in `tests/runtime/runtime-cli.integration.test.ts` is too weak to catch the failing Phase 6 verification-owned contracts above

## Unresolved Questions

- none
