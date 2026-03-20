# Phase 3 Second Remediation Session C Review Report

## Metadata
- Date: 2026-03-20
- Status: completed
- Role/modal used: code-reviewer / Default
- Model used: GPT-5 / Codex
- Source of truth: current dirty candidate tree in `/Users/hieunv/Claude Agent/CodexKit` on `main`
- Frozen verification contract: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md`
- Evidence inputs read:
  - `README.md`
  - `docs/compatibility-primitives-and-mcp-spec.md`
  - `docs/compatibility-matrix.md`
  - `docs/project-roadmap.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-remediation-session-d-verdict.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-second-remediation-session-a-implementation-summary.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-3-second-remediation-wave-2-ready-after-s28.md`
  - `packages/codexkit-cli/src/index.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `tests/runtime/runtime-cli.integration.test.ts`
  - `tests/runtime/runtime-compat-primitives.integration.test.ts`
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`

## Findings
- No findings.

## Review Focus Verdict
- direct `cdx message send` now rejects spoofed `--from-kind/--from-id/--from-worker` before any service call or durable write
- direct `cdx approval request` now rejects spoofed `--requester-worker` before any approval record can be persisted
- direct `cdx worker spawn --task <team-task>` without `--team` now derives the effective team from the task and persists the worker under that team instead of `teamId: null`
- reviewed compat-path behavior remains intact on the already-fixed message, approval, and worker/team-scope paths

## Code Evidence
- `packages/codexkit-cli/src/index.ts:276-293`
  - `message send` rejects `--from-kind/--from-id/--from-worker` with `CLI_USAGE` before `RuntimeController.sendMessage(...)`
- `packages/codexkit-daemon/src/runtime-controller.ts:158-183`
  - CLI message route now fixes sender identity to `fromKind: "user"`, `fromId: "terminal"`, `fromWorkerId: null`
- `packages/codexkit-cli/src/index.ts:307-329`
  - `approval request` rejects `--requester-worker` with `CLI_USAGE` before `RuntimeController.requestApproval(...)`
- `packages/codexkit-daemon/src/runtime-controller.ts:215-225`
  - CLI approval route no longer exposes caller-supplied worker identity
- `packages/codexkit-daemon/src/runtime-controller.ts:102-156`
  - `spawnWorker(...)` validates run scope, checks task/team consistency, derives `effectiveTeamId` from `task.teamId` when `teamId` is omitted, and persists worker registration with that effective team
- `packages/codexkit-compat-mcp/src/invoke-tool.ts:408-546`
  - compat `worker.spawn`, `message.send`, and `approval.request` still retain prior identity and team-scope enforcement logic

## Test Evidence
- focused verification command:
  - `TMPDIR=.tmp npx vitest run tests/runtime/runtime-cli.integration.test.ts tests/runtime/runtime-compat-primitives.integration.test.ts tests/runtime/runtime-compat-primitives-gap.integration.test.ts --no-file-parallelism`
- result:
  - passed: `3` files, `18` tests
  - includes explicit coverage for:
    - `message send rejects spoofed --from-kind/--from-worker flags`
    - `approval request rejects spoofed --requester-worker flag`
    - `worker spawn derives team from team-owned task when --team is omitted`
    - compat sender/authz checks
    - compat team-mailbox authz and worker.spawn team-scope enforcement
    - compat approval auto-approve transaction coupling and mailbox authz regressions
- broader runtime command:
  - `npm run test:runtime`
- broader runtime result:
  - target review suites passed, including `tests/runtime/runtime-cli.integration.test.ts`, `tests/runtime/runtime-compat-primitives.integration.test.ts`, and `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`
  - overall suite not fully green because unrelated benchmark `tests/runtime/runtime-worker-latency.integration.test.ts` failed `NFR-7.1` with p95 `9552ms > 8000ms`

## Assessment
- the two Session C/D blockers are fixed on the public direct CLI/runtime-controller paths under review
- no regression found on the already-fixed compat-path behavior reviewed here
- the current tree clears the requested reviewer re-check scope

## Residual Risks / Testing Gaps
- full `npm run test:runtime` is not fully green because the unrelated Phase 2 latency benchmark still fails in this environment
- `.tmp/nfr-7.1-launch-latency.json` and `.tmp/nfr-7.2-dispatch-latency.json` were not used as proof for this review

## Unresolved Questions
- none
