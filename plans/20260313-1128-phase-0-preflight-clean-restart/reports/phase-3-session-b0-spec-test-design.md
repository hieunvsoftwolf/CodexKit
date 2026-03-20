# Phase 3 Session B0 Spec-Test Design

**Date**: 2026-03-20
**Status**: completed
**Role/Modal Used**: spec-test-designer / Default role contract
**Model Used**: GPT-5 / Codex
**Pinned BASE_SHA**: `da9c0e5072a52a7463e8e2d56b4b8807ce3c0017`

## Provenance

- source of truth used:
  - `docs/compatibility-primitives-and-mcp-spec.md`
  - `docs/compatibility-matrix.md`
  - `docs/project-roadmap.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-base-freeze-report.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-3-wave-1-ready.md`
  - pinned repo state at `da9c0e5072a52a7463e8e2d56b4b8807ce3c0017` / tag `phase3-base-20260315` in `/Users/hieunv/Claude Agent/CodexKit`
- excluded by design:
  - candidate implementation branches
  - implementation summaries
  - reviewer output
- pinned-base inspection method:
  - `git -C '/Users/hieunv/Claude Agent/CodexKit' rev-parse da9c0e5072a52a7463e8e2d56b4b8807ce3c0017`
  - `git -C '/Users/hieunv/Claude Agent/CodexKit' tag --list 'phase3-base-20260315'`
  - `git -C '/Users/hieunv/Claude Agent/CodexKit' show <BASE_SHA>:...`

## Summary

- froze acceptance for `task`, `team`, `worker`, `message`, `approval`, and `artifact` primitives from spec only
- included command plan, fixture plan, invariants, restart-safety checks, idempotency expectations, wake/suspend mailbox behavior, approval durability, and identity/authz negatives
- baseline pinned tree already contains Phase 1/2 runtime seams and tests, but not stable Phase 3 mailbox, team, or MCP primitive seams
- added no verification-owned tests in B0 because doing so at `BASE_SHA` would require inventing Phase 3 harness boundaries before implementation

## Phase 3 Exit-Criteria Mapping

| Exit criterion | Frozen verification target |
|---|---|
| worker prompts can use CodexKit primitives instead of Claude-native ones | all primitive request/result surfaces exist, validate scope/identity, and mutate durable state through daemon-owned services only |
| terminal approval checkpoints work | `approval.request/respond` create durable approvals, synthesize mailbox entries, survive restart, and reconstruct terminal state from durable rows only |
| messaging supports direct and team-targeted delivery | `message.send/pull` preserve durable order, cursor semantics, direct/team routing, wake behavior, and replay safety across restart |
| compatibility primitives do not weaken prior runtime guarantees | Phase 3 preserves Phase 1/2 restart, claim, owned-path, and durability invariants while adding compat surfaces |

## Baseline Commands

These are the only commands B0 treats as safe baseline evidence on the pinned tree:

1. `git -C '/Users/hieunv/Claude Agent/CodexKit' rev-parse HEAD`
2. `git -C '/Users/hieunv/Claude Agent/CodexKit' rev-parse da9c0e5072a52a7463e8e2d56b4b8807ce3c0017`
3. `git -C '/Users/hieunv/Claude Agent/CodexKit' tag --list 'phase3-base-20260315'`
4. `git -C '/Users/hieunv/Claude Agent/CodexKit' ls-tree -r --name-only da9c0e5072a52a7463e8e2d56b4b8807ce3c0017`
5. `git -C '/Users/hieunv/Claude Agent/CodexKit' show da9c0e5072a52a7463e8e2d56b4b8807ce3c0017:docs/compatibility-primitives-and-mcp-spec.md`
6. `npm run test:runtime`

Expected baseline result:

- `npm run test:runtime` should still pass unchanged on the pinned base as the pre-Phase-3 runtime floor
- no Phase 3-specific runtime tests are expected at `BASE_SHA`

## Stable Fixture Plan

### F1. Single-run primitive fixture

Use one run with:

- one root run id
- one standalone task
- one standalone worker
- one artifact output directory under workspace

Purpose:

- `task.*`
- `worker.spawn`
- `approval.*`
- `artifact.*`

### F2. Team-routing fixture

Use one run with:

- one team
- one orchestrator worker
- one member worker
- one direct worker mailbox target
- one shared team mailbox target

Purpose:

- `team.*`
- `message.send/pull`
- team wake semantics

### F3. Restart fixture

Use one run with:

- pending approval
- unread direct message
- unread team message
- published artifact
- blocked or waiting worker state

Steps:

1. create durable state
2. stop daemon cleanly or simulate reopen
3. reopen runtime
4. re-run reads and reconciliation

Purpose:

- mailbox durability
- approval durability
- cursor durability
- wake-after-restart projection

### F4. Identity and authz fixture

Use one run with:

- worker A authenticated
- worker B authenticated
- user caller
- cross-run ids from a second run

Purpose:

- reject payload identity spoofing
- reject cross-run references
- reject mailbox access outside caller scope

### F5. Artifact path fixture

Use one run with:

- workspace-root file
- runtime artifact-root file
- path traversal attempts
- same-path republish attempts

Purpose:

- canonicalization
- escape prevention
- idempotent publish
- checksum conflict behavior

## Shared Invariants

- every primitive remains run-scoped even when `runId` is omitted from result bodies
- daemon is the only durable writer
- every successful mutating operation appends at least one event in the same transaction
- caller identity comes from the authenticated session, not payload hints
- restart correctness is measured from durable rows plus events, never transcript memory
- Phase 3 error codes must normalize to the spec surface even if lower-level internal services use different local error names

## Acceptance Cases

### Task Primitive

`T-01 create task with valid run and no hard blockers`
- command path: `task.create`
- fixture: `F1`
- expect:
  - durable task row created
  - initial status is `ready`
  - `task.created` appended

`T-02 create task with blocking dependency`
- command path: `task.create` then `task.get` or `task.list`
- fixture: `F1`
- expect:
  - durable dependency edge created
  - initial status is `pending` or immediately reconciled to blocked scheduling state per implementation shape, but task must not become runnable before dependency completion
  - dependency release later emits `task.ready`

`T-03 natural-key idempotent create`
- command path: replay `task.create` with same `(runId, teamId, parentTaskId, subject, role, stepRef)`
- fixture: `F1`
- expect:
  - existing task returned
  - no duplicate durable task row

`T-04 get and list stay read-only`
- command path: `task.list`, `task.get`
- fixture: `F1`
- expect:
  - no events appended
  - no status mutation

`T-05 update patch respects immutable fields`
- command path: `task.update`
- fixture: `F1`
- expect:
  - mutable patch fields work
  - immutable identity fields (`runId`, `teamId`, `parentTaskId`, `dependsOn`, `planDir`, `phaseFile`) are rejected with `validation_error` or equivalent spec-surface failure

`T-06 claim required for in-progress`
- command path: `task.update`
- fixture: `F1`
- expect:
  - moving task to `in_progress` without valid active claim fails
  - failure class: `state_conflict` or `lease_expired` depending on durable claim state

`T-07 blocked task refuses premature ready/in_progress`
- command path: `task.update`
- fixture: `F1`
- expect:
  - unresolved approval or dependency keeps task blocked
  - failure is stable and non-retryable unless blocker changes

`T-08 terminal state is durable`
- command path: `task.update`
- fixture: `F1`
- expect:
  - terminal status yields `task.completed` or `task.failed`
  - conflicting terminal rewrites return `state_conflict`

`T-09 cross-run task reference negative`
- command path: `task.get`, `task.update`
- fixture: `F4`
- expect:
  - existing id from another run is invisible at this caller scope
  - failure: `not_found`

### Team Primitive

`TM-01 create team with unique name`
- command path: `team.create`
- fixture: `F2`
- expect:
  - one team row
  - one durable shared team mailbox owner
  - team status valid for new team

`TM-02 team create with orchestrator role`
- command path: `team.create`
- fixture: `F2`
- expect:
  - orchestrator worker bootstrapped
  - `orchestrator_worker_id` persisted

`TM-03 team create idempotency`
- command path: replay `team.create` with same `(runId, name)`
- fixture: `F2`
- expect:
  - existing team returned while not deleted
  - no duplicate team or mailbox rows

`TM-04 team name uniqueness negative`
- command path: `team.create`
- fixture: `F2`
- expect:
  - same run cannot create second live team with same name
  - failure: `state_conflict`

`TM-05 graceful delete`
- command path: `team.delete`
- fixture: `F2`
- expect:
  - status transitions through `shutting_down`
  - live workers receive `shutdown_request`
  - terminal team status becomes `deleted`
  - `team.deleted` appended

`TM-06 delete idempotency`
- command path: replay `team.delete`
- fixture: `F2`
- expect:
  - current delete state returned
  - no second destructive sequence

`TM-07 cross-run delete negative`
- command path: `team.delete`
- fixture: `F4`
- expect:
  - team id from another run rejected as `not_found`

### Worker Primitive

`W-01 spawn worker in local_worktree mode`
- command path: `worker.spawn`
- fixture: `F1`
- expect:
  - durable worker identity allocated
  - state enters valid starting or idle path
  - worktree path, if returned, is informational only

`W-02 spawn worker scoped to team and task`
- command path: `worker.spawn`
- fixture: `F2`
- expect:
  - referenced task and team belong to same run
  - worker lands in same durable scope

`W-03 unsupported execution modes are explicit`
- command path: `worker.spawn` with `local_shared` and `cloud_task`
- fixture: `F1`
- expect:
  - request is schema-valid
  - Phase 3 may reject with `not_supported`
  - no partial task corruption

`W-04 readOnly grant still permits messages and artifacts`
- command path: `worker.spawn` plus follow-on `message.send` / `artifact.publish`
- fixture: `F1`
- expect:
  - repo-content mutation blocked by launch policy
  - artifact publication and messaging still allowed

`W-05 failed launch does not strand task in progress`
- command path: `worker.spawn`
- fixture: `F1`
- expect:
  - failed launch leaves task unclaimed unless valid claim already existed
  - no orphan `in_progress` task from failed spawn path

`W-06 cross-run task or team negative`
- command path: `worker.spawn`
- fixture: `F4`
- expect:
  - task or team from another run rejected as `not_found`

### Message Primitive

`M-01 direct worker message delivery`
- command path: `message.send`, `message.pull`
- fixture: `F2`
- expect:
  - one immutable message row
  - worker mailbox receives only direct-target message
  - `message.sent` appended

`M-02 team-targeted message delivery`
- command path: `message.send`, `message.pull`
- fixture: `F2`
- expect:
  - message lands in shared team mailbox
  - orchestrator is default wake target
  - no implicit per-worker fan-out

`M-03 user-targeted message delivery`
- command path: `message.send`
- fixture: `F1`
- expect:
  - terminal attention queue receives message

`M-04 stable pull ordering`
- command path: `message.pull`
- fixture: `F2`
- expect:
  - mailbox order is `created_at ASC, id ASC`
  - repeated reads with `sinceMessageId` preserve strict ordering

`M-05 cursor advance semantics`
- command path: `message.pull` without `sinceMessageId`
- fixture: `F2`
- expect:
  - stored mailbox cursor advances to final returned message
  - subsequent cursor-based pull returns only newer messages

`M-06 replay-safe pull after retry`
- command path: `message.pull` with `sinceMessageId`
- fixture: `F3`
- expect:
  - after retry or restart, caller can replay safely
  - dedupe by `message.id`

`M-07 message send is intentionally non-idempotent`
- command path: replay `message.send`
- fixture: `F2`
- expect:
  - each accepted call creates a new message row
  - duplicates are visible as distinct ids

`M-08 sender identity negative`
- command path: `message.send`
- fixture: `F4`
- expect:
  - worker A cannot send with payload `fromWorkerId=workerB`
  - failure: `permission_denied`

`M-09 mailbox access negative`
- command path: `message.pull`
- fixture: `F4`
- expect:
  - caller cannot pull mailbox it is not authorized to read
  - failure: `permission_denied`

`M-10 restart durability`
- command path: `message.send`, daemon restart, `message.pull`
- fixture: `F3`
- expect:
  - message ids and order survive restart
  - unread mail remains pullable

`M-11 wake and suspend behavior`
- command path: `message.send`
- fixture: `F2`, `F3`
- expect:
  - `message.sent` to worker wakes `waiting_message` worker
  - `message.sent` to team wakes orchestrator

### Approval Primitive

`A-01 request approval creates durable gate`
- command path: `approval.request`
- fixture: `F1`
- expect:
  - approval row created with `pending`
  - `approval.requested` event appended
  - synthetic user mailbox message of type `approval_request`
  - requesting worker moves to `waiting_approval`

`A-02 request approval idempotency`
- command path: replay `approval.request` with same open `(runId, taskId, checkpoint)`
- fixture: `F1`
- expect:
  - same pending approval returned
  - no duplicate approval row

`A-03 respond approve`
- command path: `approval.respond`
- fixture: `F1`
- expect:
  - approval status `approved`
  - task or run resumes deterministically
  - synthetic worker or orchestrator response message emitted

`A-04 respond revise`
- command path: `approval.respond`
- fixture: `F1`
- expect:
  - approval status `revised`
  - worker resumes with revise response semantics

`A-05 respond reject or abort`
- command path: `approval.respond`
- fixture: `F1`
- expect:
  - approval status durable as `rejected` or `aborted`
  - task or run remains blocked under durable blocker reason

`A-06 auto_approve_run scope`
- command path: `approval.respond`
- fixture: `F1`
- expect:
  - only current run policy changes
  - downstream run does not inherit auto-approval unless workflow handoff emits it explicitly

`A-07 respond idempotent replay`
- command path: replay `approval.respond` with same final response
- fixture: `F1`
- expect:
  - same final state returned
  - replay with different response after resolution fails with `state_conflict`

`A-08 expired approvals stay durable blockers`
- command path: `approval.request` with expiry, restart or reconciliation, `approval.respond`
- fixture: `F3`
- expect:
  - expired approval remains durable blocker
  - terminal projection still reconstructible after reopen

`A-09 approval durability across restart`
- command path: `approval.request`, daemon restart, terminal inspection, `approval.respond`
- fixture: `F3`
- expect:
  - terminal prompt reconstructs from durable state only
  - no transcript dependency

`A-10 approval identity negative`
- command path: `approval.request`
- fixture: `F4`
- expect:
  - payload `requestedByWorkerId` mismatch against authenticated worker fails with `permission_denied`

### Artifact Primitive

`AR-01 publish existing workspace file`
- command path: `artifact.publish`
- fixture: `F5`
- expect:
  - canonical path persisted
  - checksum computed before commit
  - `artifact.published` appended

`AR-02 publish existing runtime-artifact file`
- command path: `artifact.publish`
- fixture: `F5`
- expect:
  - artifact-root path allowed when owned by run

`AR-03 publish idempotency`
- command path: replay `artifact.publish` for same canonical `(runId, path, checksum)`
- fixture: `F5`
- expect:
  - existing durable artifact returned
  - no duplicate row

`AR-04 checksum conflict negative`
- command path: republish same path with different checksum
- fixture: `F5`
- expect:
  - failure: `state_conflict`

`AR-05 path escape negative`
- command path: `artifact.publish`
- fixture: `F5`
- expect:
  - path outside workspace or run artifact root rejected with `permission_denied` or `validation_error`

`AR-06 missing file negative`
- command path: `artifact.publish`
- fixture: `F5`
- expect:
  - non-existent file rejected with `validation_error`

`AR-07 read-by-id and read-by-run-path`
- command path: `artifact.read`
- fixture: `F5`
- expect:
  - metadata lookup works by `artifactId` or `(runId, path)`
  - file bytes are not returned

`AR-08 cross-run artifact read negative`
- command path: `artifact.read`
- fixture: `F4`
- expect:
  - other-run artifact is not visible
  - failure: `not_found`

## Expected Failure Matrix

| Area | Negative case | Expected stable code |
|---|---|---|
| task | malformed payload, immutable-field mutation | `validation_error` |
| task | cross-run id lookup | `not_found` |
| task | no active claim or lost lease | `state_conflict` or `lease_expired` |
| team | duplicate live name in same run | `state_conflict` |
| team | cross-run delete | `not_found` |
| worker | unsupported execution mode | `not_supported` |
| worker | cross-run task or team | `not_found` |
| message | sender identity spoof | `permission_denied` |
| message | unauthorized mailbox pull | `permission_denied` |
| approval | worker identity spoof | `permission_denied` |
| approval | second conflicting resolution | `state_conflict` |
| artifact | path escape | `permission_denied` or `validation_error` |
| artifact | same path, different checksum | `state_conflict` |

## Restart-Safety Checks

- unread direct and team mailbox entries remain durable after daemon restart
- mailbox order and ids remain stable after reopen
- pending approval remains visible after restart
- resolved approval remains durable after restart
- terminal prompt can be rebuilt from approval row plus linked task or artifact metadata only
- cursor-driven mailbox pull resumes from durable cursor, not process memory
- wake conditions after reopen come from events and durable state, not transcript scanning

## Wake/Suspend Checks

- worker with no runnable task but mailbox responsibility can remain `waiting_message`
- worker blocked on approval enters `waiting_approval`
- `message.sent` to worker wakes target worker
- `message.sent` to team wakes orchestrator
- `approval.requested` wakes terminal loop
- `approval.resolved` wakes requesting worker or orchestrator
- `shutdown_request` wakes graceful stop path

## Verification-Owned Tests

- none added in B0

Reason:

- pinned base exposes only pre-Phase-3 stable seams: runtime fixture helpers, Phase 1/2 runtime services, controller inspection paths, and existing runtime integration tests
- pinned base does not expose stable `TeamService`, `MessageService`, mailbox cursor service, compat MCP transport handlers, or `artifact.read` service seams
- adding tests now would either:
  - duplicate lower-phase coverage already present, or
  - invent test-only primitive seams ahead of the implementation, which B0 must not do

## Owned-Test Recommendation If Stable Seams Appear In Session A

If Session A introduces stable compat surfaces without changing expected behavior, tester should prefer verification files such as:

- `tests/runtime/phase3-compat-primitives.integration.test.ts`
- `tests/runtime/phase3-mailbox-restart.integration.test.ts`
- `tests/runtime/phase3-approval-terminal.integration.test.ts`

Minimum acceptable seams before adding them:

- public compat request handlers or controller methods for all Phase 3 primitives
- durable mailbox cursor access through runtime context
- restartable test harness that can stop and reopen daemon state without branch-specific hacks

## Tester Command Plan

Execute unchanged B0 expectations first in this order:

1. verify candidate identity against `BASE_SHA` ancestry and current branch/ref
2. `npm run test:runtime`
3. run any new Phase 3 targeted runtime tests added by Session A without editing their expectations
4. if compat surface is CLI-backed, run targeted JSON-mode CLI checks for primitive success and failure envelopes
5. rerun restart scenarios after daemon stop or reopen

Expected tester evidence:

- commands run
- pass/fail per primitive family
- which failure codes matched spec
- whether restart and wake behavior matched frozen expectations
- whether any verification-only amendments were required and why

## Blocking Assumptions

- candidate implementation must expose Phase 3 primitive surfaces that are actually callable by tester
- stable error-code projection must exist at the compat surface even if internal services keep narrower implementation-specific errors
- restart or reopen harness must remain available without relying on transcript state

## Unresolved Questions

- whether the candidate will expose primitive checks through CLI shims, direct runtime controller helpers, MCP harness calls, or a mix
- whether `message.send` remains intentionally non-idempotent in the final implementation or gains an explicit idempotency key with a spec update
- whether non-orchestrator team workers will be allowed to pull shared team mailboxes by default in the candidate
