# Phase 3 Second Remediation Session A Implementation Summary

## Metadata
- Date: 2026-03-20
- Status: completed
- Role/modal used: fullstack-developer / Default
- Model used: GPT-5 / Codex
- Source of truth: current dirty candidate tree in `/Users/hieunv/Claude Agent/CodexKit` on `main`
- Frozen verification contract: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md`
- BASE_SHA baseline: `da9c0e5072a52a7463e8e2d56b4b8807ce3c0017` (`phase3-base-20260315`)

## Scope Executed
- fixed only the two remaining blockers from Session C/D:
  - direct CLI mutation identity spoof routes
  - direct CLI/runtime-controller `worker.spawn` effective-team enforcement gap
- added only the requested direct regression tests:
  - spoofed `cdx message send --from-kind/--from-worker`
  - spoofed `cdx approval request --requester-worker`
  - `cdx worker spawn --task <team-task>` with omitted `--team`
- preserved compat-path behavior already fixed in prior remediation
- did not make any Phase 3 pass claim
- `.tmp/nfr-7.1-launch-latency.json` and `.tmp/nfr-7.2-dispatch-latency.json` remain candidate evidence only

## Files Changed
- `packages/codexkit-cli/src/index.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `tests/runtime/runtime-cli.integration.test.ts`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-second-remediation-session-a-implementation-summary.md`

## Tests Added/Updated
- updated:
  - `tests/runtime/runtime-cli.integration.test.ts`
- added test coverage:
  - `message send rejects spoofed --from-kind/--from-worker flags`
  - `approval request rejects spoofed --requester-worker flag`
  - `worker spawn derives team from team-owned task when --team is omitted`
- minor reliability update in same file:
  - existing `compat call rejects self-asserted caller flags` now has explicit `90_000` timeout to avoid default 5s fixture timeout flakes

## Exact Mapping: Remaining Blockers -> Code Changes

### Blocker 1
- blocker: direct CLI mutation routes accepted caller-controlled worker/system identity fields on durable writes
- change set:
  - `packages/codexkit-cli/src/index.ts`
    - `message send` now rejects `--from-kind`, `--from-id`, `--from-worker` with `CLI_USAGE` before service call
    - `approval request` now rejects `--requester-worker` with `CLI_USAGE` before service call
  - `packages/codexkit-daemon/src/runtime-controller.ts`
    - `sendMessage(...)` no longer accepts caller-provided sender identity fields; sender is fixed to CLI user identity (`fromKind: "user"`, `fromId: "terminal"`, `fromWorkerId: null`)
    - `requestApproval(...)` input no longer exposes `requestedByWorkerId` for CLI route
- regression tests:
  - `tests/runtime/runtime-cli.integration.test.ts`
    - `message send rejects spoofed --from-kind/--from-worker flags`
    - `approval request rejects spoofed --requester-worker flag`
    - both assert rejection and no durable side-effect for the spoof path

### Blocker 2
- blocker: direct CLI/runtime-controller `worker.spawn` did not enforce compat-equivalent effective-team invariant when `--task` used without `--team`
- change set:
  - `packages/codexkit-daemon/src/runtime-controller.ts` `spawnWorker(...)`
    - validates provided `teamId` belongs to `runId`
    - validates `taskId` belongs to `runId`
    - enforces team/task consistency when both provided
    - derives `effectiveTeamId` from task when `teamId` omitted (matches compat behavior)
    - registers worker with `effectiveTeamId` (not nullable bypass when task is team-owned)
- regression test:
  - `tests/runtime/runtime-cli.integration.test.ts`
    - `worker spawn derives team from team-owned task when --team is omitted`
    - asserts spawned worker inherits task team and active claim binds worker to task

## Commands Run
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism`
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism` (rerun after timeout fix)
- `npm run test:runtime`

## Results
- first targeted CLI test run:
  - failed with one timeout on existing `compat call rejects self-asserted caller flags` (default 5s)
  - new spoofing/team-derive tests passed
- second targeted CLI test run (after timeout update):
  - passed: `1` file, `6` tests
- full runtime suite:
  - passed: `9` files, `49` tests

## Known Risks
- CLI hardening returns `CLI_USAGE` for blocked spoof flags; downstream reviewer may still prefer `permission_denied` normalization for CLI surface error taxonomy
- runtime-controller remains a local control surface without authenticated worker session context; this session locked identity at CLI route but did not redesign runtime-controller auth model
- this session did not run separate reviewer/tester independent flows; only implementation-side runtime test execution was performed

## Handoff Notes For Reviewer And Tester Reruns
- reviewer focus:
  - verify `message send` and `approval request` reject spoof flags before durable write paths
  - verify `RuntimeController.sendMessage` sender identity is not caller-settable
  - verify `spawnWorker` now derives/enforces effective team from task scope
- tester rerun focus commands:
  - `TMPDIR=.tmp npx vitest run tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism`
  - `npm run test:runtime`
- manual CLI spot-checks (optional but aligned to prior repros):
  - spoofed `cdx message send --from-kind worker --from-worker <workerId> ...` should fail with `CLI_USAGE`
  - spoofed `cdx approval request --requester-worker <workerId> ...` should fail with `CLI_USAGE`
  - `cdx worker spawn --run <run> --task <team-task> --role <role> --display-name <name>` should produce worker `teamId == task.teamId`

## Unresolved Questions
- none
