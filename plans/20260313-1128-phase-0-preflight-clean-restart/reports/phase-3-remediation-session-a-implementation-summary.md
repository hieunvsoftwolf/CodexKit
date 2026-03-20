# Phase 3 Remediation Session A Implementation Summary

## Metadata
- Date: 2026-03-20
- Status: completed
- Role/modal used: fullstack-developer / Default
- Model used: GPT-5 / Codex
- Source tree: `/Users/hieunv/Claude Agent/CodexKit` on `main` (dirty candidate tree)
- Baseline contract reference: `da9c0e5072a52a7463e8e2d56b4b8807ce3c0017` (`phase3-base-20260315`)
- Scope: fix confirmed Phase 3 fail-verdict blockers only; no phase-pass claim

## Files Changed
- `packages/codexkit-cli/src/index.ts`
- `packages/codexkit-compat-mcp/src/invoke-tool.ts`
- `packages/codexkit-core/src/services/approval-service.ts`
- `packages/codexkit-core/src/services/team-service.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-compat-primitives.integration.test.ts`
- `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`
- candidate evidence updated by runtime suite:
  - `.tmp/nfr-7.1-launch-latency.json`
  - `.tmp/nfr-7.2-dispatch-latency.json`

## Tests Added/Updated
- `tests/runtime/runtime-cli.integration.test.ts`
  - added: reject `compat call --caller-*` self-asserted identity flags
  - added: CLI `message pull` rejects non-user mailbox access
- `tests/runtime/runtime-compat-primitives.integration.test.ts`
  - updated: `team.delete` now verified as `shutting_down` until workers drain; `deleted` only after drain
- `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`
  - added: denied user pull to worker mailbox does not mutate cursor or delivery
  - added: `worker.spawn` task-team scope enforced when `teamId` omitted
  - added: `auto_approve_run` rollback test by injected policy-write failure (approval remains pending)
  - added: `task.create` ownedPaths normalization + absolute-path rejection
  - updated: cross-run `artifact.read` by `artifactId` expects `not_found` (frozen B0/spec alignment)

## Commands Run
1. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-cli.integration.test.ts tests/runtime/runtime-compat-primitives.integration.test.ts tests/runtime/runtime-compat-primitives-gap.integration.test.ts --no-file-parallelism`
2. `npm run typecheck`
3. `npm run test:runtime`
4. `npm run build`

## Results
- targeted runtime set: pass (`3` files, `15` tests)
- typecheck: pass
- full runtime suite: pass (`9` files, `46` tests)
- build: pass
- `.tmp/nfr-7.1-launch-latency.json` and `.tmp/nfr-7.2-dispatch-latency.json` changed by runtime tests; still candidate-tree evidence only, not validated phase-close proof

## Blocker-By-Blocker Fix Mapping
1. caller identity self-asserted, not authenticated
   - fix:
     - CLI compat caller flags `--caller-kind`, `--caller-worker`, `--caller-run` now rejected.
     - `compat call` caller identity is forced to session user caller.
   - code:
     - `packages/codexkit-cli/src/index.ts` (`parseCompatCaller`)
   - coverage:
     - `tests/runtime/runtime-cli.integration.test.ts` (`compat call rejects self-asserted caller flags`)

2. unauthorized mailbox pulls can mutate durable mailbox state
   - fix:
     - compat `message.pull` enforces user callers can only pull `recipientKind=user`.
     - direct CLI `message pull` path now blocks non-user mailbox pulls.
   - code:
     - `packages/codexkit-compat-mcp/src/invoke-tool.ts` (`message.pull` authz)
     - `packages/codexkit-daemon/src/runtime-controller.ts` (`pullMessages`)
   - coverage:
     - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` (`user mailbox authz denial does not mutate...`)
     - `tests/runtime/runtime-cli.integration.test.ts` (`message pull blocks non-user mailboxes...`)

3. `worker.spawn` can bypass team scope when `taskId` set and `teamId` omitted
   - fix:
     - spawn now resolves effective team from task when `teamId` omitted.
     - caller worker team scope checked against effective team.
     - prevents null-team worker claim on team-owned task.
   - code:
     - `packages/codexkit-compat-mcp/src/invoke-tool.ts` (`worker.spawn`)
   - coverage:
     - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` (`worker.spawn enforces task team scope...`)

4. `team.delete` does not wait for worker drain before `deleted`
   - fix:
     - `team.delete` now transitions to `shutting_down`, emits shutdown requests once, and returns `shutting_down` while live workers remain.
     - marks `deleted` only when no live team workers remain.
   - code:
     - `packages/codexkit-core/src/services/team-service.ts` (`deleteTeam`)
   - coverage:
     - `tests/runtime/runtime-compat-primitives.integration.test.ts` (`keeps team.delete in shutting_down until workers drain...`)

5. `auto_approve_run` is not atomic with approval resolution
   - fix:
     - policy update moved into `ApprovalService.respondApproval(...)` same transaction as approval resolution.
     - adds durable event `run.approval_policy.updated`.
     - idempotent replay path preserves policy.
   - code:
     - `packages/codexkit-compat-mcp/src/invoke-tool.ts` (`approval.respond`)
     - `packages/codexkit-core/src/services/approval-service.ts` (`respondApproval`, `setRunAutoApprovalPolicy`)
   - coverage:
     - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` (`approval auto_approve_run is transactionally coupled...`)

6. `task.create` persists raw `ownedPaths`
   - fix:
     - `task.create` now normalizes and validates owned paths with same helper used by `worker.spawn`.
   - code:
     - `packages/codexkit-compat-mcp/src/invoke-tool.ts` (`task.create`)
   - coverage:
     - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` (`task.create normalizes ownedPaths...`)

7. `artifact.read` cross-run error mapping drift
   - fix:
     - `artifact.read` cross-run out-of-scope lookup now normalizes to `not_found` for scoped callers.
   - code:
     - `packages/codexkit-compat-mcp/src/invoke-tool.ts` (`artifact.read`)
   - coverage:
     - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` (`artifact.read ... enforces run scope`)

## Known Risks
- compat caller hardening is CLI-path focused; internal/direct code calls to `invokeCompatTool` still rely on trusted caller injection by host code.
- `team.delete` now requires re-invocation after workers drain; operation is graceful and safe, but not long-poll blocking.
- policy update event name `run.approval_policy.updated` is new runtime event surface; downstream consumers should treat unknown event types safely.
- candidate tree remains dirty with many pre-existing Phase 3 files; this summary scopes only Session A remediation edits above.

## Handoff Notes For Reviewer And Tester Reruns
- rerun tester baseline order:
  1. targeted blockers: `tests/runtime/runtime-cli.integration.test.ts`, `tests/runtime/runtime-compat-primitives.integration.test.ts`, `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`
  2. full runtime: `npm run test:runtime`
- reviewer focus points:
  - `parseCompatCaller` hard stop for `--caller-*`
  - `message.pull` authz in both compat and CLI controller path
  - `worker.spawn` effective team derivation with `taskId`+missing `teamId`
  - `team.delete` no early terminal delete
  - `approval.respond(auto_approve_run)` transaction coupling
  - `task.create` ownedPaths normalization
  - `artifact.read` cross-run `not_found` normalization
- do not treat `.tmp/nfr-7.1-launch-latency.json` and `.tmp/nfr-7.2-dispatch-latency.json` as validated proof; candidate evidence only
- no phase-pass claim made in this implementation session

## Unresolved Questions
- none
