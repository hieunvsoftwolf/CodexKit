# Phase 3 Session B Test Report

## Metadata
- Date: 2026-03-20
- Status: completed
- Role/modal used: tester / Default
- Model used: GPT-5 / Codex
- Source of truth: working tree at `/Users/hieunv/Claude Agent/CodexKit` on branch `main` (dirty by design)
- Frozen expectation baseline: `phase-3-session-b0-spec-test-design.md`

## Command Evidence
1. Required single-file first run (unchanged test):
   - `TMPDIR=.tmp npx vitest run tests/runtime/runtime-compat-primitives.integration.test.ts --no-file-parallelism`
   - result: pass (`1` file, `5` tests)
2. Required full runtime suite:
   - `npm run test:runtime`
   - result (first mandatory run): pass (`8` files, `37` tests)
3. Gap expansion (doc/harness-derived only):
   - added `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`
   - `TMPDIR=.tmp npx vitest run tests/runtime/runtime-compat-primitives-gap.integration.test.ts --no-file-parallelism`
   - result: pass (`1` file, `3` tests)
4. Full runtime re-run after gap expansion:
   - `npm run test:runtime`
   - result: pass (`9` files, `40` tests)

## Coverage Against Phase 3 Focus

### task.create/list/get/update
- verified:
  - create idempotency on natural key
  - update patch behavior (`priority`, `appendNote`)
  - list/get response correctness
  - list/get read-only behavior (no event-count increase)
- evidence:
  - `tests/runtime/runtime-compat-primitives.integration.test.ts`
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`

### worker.spawn
- verified:
  - spawn under supported mode
  - explicit `not_supported` envelope for unsupported mode (`cloud_task`)
- evidence:
  - `tests/runtime/runtime-compat-primitives.integration.test.ts`
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`

### team.create/delete
- verified:
  - create idempotency
  - delete path and shutdown-request side effect
- evidence:
  - `tests/runtime/runtime-compat-primitives.integration.test.ts`

### message.send/pull
- verified:
  - sender identity spoof blocked (`permission_denied`)
  - mailbox cursor durability across restart
  - team mailbox authz: non-orchestrator denied, orchestrator allowed
  - team-targeted delivery pull path
- evidence:
  - `tests/runtime/runtime-compat-primitives.integration.test.ts`
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`

### approval.request/respond
- verified:
  - request idempotency
  - respond idempotent replay
  - conflicting replay rejected
  - worker transitions to `waiting_approval`
  - synthetic user mailbox signal present
- evidence:
  - `tests/runtime/runtime-compat-primitives.integration.test.ts`

### artifact.publish/read
- verified:
  - publish idempotency by checksum
  - checksum-conflict guard (`state_conflict`)
  - read-by-id and read-by-run+path metadata lookup
  - run scope enforcement on read
- evidence:
  - `tests/runtime/runtime-compat-primitives.integration.test.ts`
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`

## Idempotency, Restart Safety, Cursor Durability, Identity/Scope, Stable Errors
- idempotency: task.create, team.create, approval.request, approval.respond, artifact.publish verified
- restart safety: message mailbox pull-after-reopen verified; full runtime suite also passed daemon/runtime reopen scenarios
- mailbox cursor durability: verified (`message.pull` after reopen returns remaining message only)
- identity/scope enforcement: verified for `message.send`/`message.pull`, `artifact.read`, `approval.respond` caller rules
- stable error behavior verified in compat envelopes:
  - `permission_denied` (identity mismatch, unauthorized mailbox pull, cross-run artifact read)
  - `state_conflict` (artifact checksum conflict, conflicting approval replay)
  - `not_supported` (unsupported spawn mode)

## Findings
- no blocking runtime test failures
- spec-vs-implementation note:
  - Session B0 matrix lists cross-run artifact read negative as `not_found`
  - observed compat behavior is `permission_denied` when caller carries mismatched `runId` and reads by `artifactId`
  - current tests lock observed behavior; decide whether to adjust spec wording or compat projection for strict parity

## `.tmp` NFR Artifacts Accounting
- `.tmp/nfr-7.1-launch-latency.json`: relevant evidence (updated by runtime latency tests)
  - observed p95: `git-clean=2653ms`, `git-dirty-text=5474ms` (both under stated 8000ms gate in runtime test)
- `.tmp/nfr-7.2-dispatch-latency.json`: relevant evidence (updated by runtime latency tests)
  - observed p95: `143ms` (under stated 1000ms gate in runtime test)
- disposition: relevant evidence, non-blocking

## Verification-Owned Amendments
- added test file only (no production edits):
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`
- rationale:
  - doc/harness gap coverage for explicit `task.list/get`, `artifact.read`, team mailbox authz/routing, and stable compat error envelopes

## Verdict
- Phase 3 candidate runtime in current dirty working tree passes required execution order and runtime suite checks.
- Additional gap-derived verification passed.
- No blocker found for tester session close.

## Unresolved Questions
- Should cross-run `artifact.read` normalize to `not_found` (as B0 matrix says) or remain `permission_denied` (as current implementation emits)?
