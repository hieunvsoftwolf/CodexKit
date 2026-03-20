# Phase 3 Remediation Session C Review Report

## Metadata
- Date: 2026-03-20
- Status: completed
- Role/modal used: code-reviewer / Default
- Model used: GPT-5 / Codex
- Source of truth: current dirty candidate tree in `/Users/hieunv/Claude Agent/CodexKit` on `main`
- Required context read:
  - `README.md`
  - `docs/compatibility-primitives-and-mcp-spec.md`
  - `docs/compatibility-matrix.md`
  - `docs/project-roadmap.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-d-verdict.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-remediation-session-a-implementation-summary.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-3-remediation-wave-2-ready-after-s24.md`
- Commands run:
  - `git status --short --branch`
  - targeted file inspection with `nl -ba` / `git diff`
  - `npm run test:runtime`

## Findings

### CRITICAL

#### 1. Caller identity is still self-assertable on the new direct CLI mutation routes, so the Session D authority-model blocker is not actually closed
- `compat call` now rejects `--caller-*`, but the same candidate adds first-class CLI mutation commands that still accept caller-controlled worker/system identity fields and pass them straight into durable services.
- `message send` accepts `--from-kind`, `--from-id`, and `--from-worker` at [packages/codexkit-cli/src/index.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts#L276) and forwards them unchanged at [packages/codexkit-daemon/src/runtime-controller.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts#L141). The only downstream guard is “worker belongs to run” at [packages/codexkit-core/src/services/message-service.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-core/src/services/message-service.ts#L27), not “caller is that worker”.
- `approval request` accepts `--requester-worker` at [packages/codexkit-cli/src/index.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts#L307) and forwards it at [packages/codexkit-daemon/src/runtime-controller.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts#L201). [packages/codexkit-core/src/services/approval-service.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-core/src/services/approval-service.ts#L30) again only validates run membership, then mutates that worker to `waiting_approval` at [packages/codexkit-core/src/services/approval-service.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-core/src/services/approval-service.ts#L69).
- This is the same class of defect as the original verdict blocker: caller identity still comes from user-supplied flags on a public CLI path instead of authenticated/session-derived state. The hardening only covered `compat call`, not the newly exposed primitive commands.
- Test gap: the added CLI coverage only checks `compat call --caller-*` rejection and non-user mailbox pull denial in [tests/runtime/runtime-cli.integration.test.ts](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-cli.integration.test.ts#L71). There is no negative test for spoofed `message send`, `approval request`, or similar direct CLI mutation routes.
- Direct CLI repro on the current tree:
  - `cdx message send --run <run> --to-kind user --to-id <run> --body 'spoofed as worker' --from-kind worker --from-worker <workerId>`
  - accepted and persisted with `fromKind: "worker"` and `fromWorkerId: "<workerId>"`
  - `cdx approval request --run <run> --checkpoint plan-review --question 'Approve?' --option approve:Approve --requester-worker <workerId>`
  - accepted and persisted with `requestedByWorkerId: "<workerId>"`, proving the CLI path still lets a user impersonate a worker for durable state changes

### IMPORTANT

#### 2. `worker.spawn` effective-team enforcement is still bypassable on the direct CLI/runtime-controller path
- The compat MCP path now derives `effectiveTeamId` from `taskId` and rejects cross-team worker callers at [packages/codexkit-compat-mcp/src/invoke-tool.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-compat-mcp/src/invoke-tool.ts#L408).
- The direct CLI path still calls `RuntimeController.spawnWorker(...)` from [packages/codexkit-cli/src/index.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts#L258), and that controller implementation never loads the task, never derives team from task, and never checks task/team consistency before creating the worker and claim at [packages/codexkit-daemon/src/runtime-controller.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts#L102).
- Because [packages/codexkit-core/src/services/worker-service.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-core/src/services/worker-service.ts#L23) only validates an explicit `teamId` when one is provided, `cdx worker spawn --run <run> --task <team-owned-task> --role ...` still registers a null-team worker and claims the team-owned task.
- That leaves the original “effective team enforcement” blocker unresolved on a shipped surface, even though the compat-only tests are green.
- Test gap: the new coverage in [tests/runtime/runtime-compat-primitives-gap.integration.test.ts](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-compat-primitives-gap.integration.test.ts#L163) exercises only `invokeCompatTool("worker.spawn", ...)`; it does not cover the CLI/runtime-controller route.
- Direct CLI repro on the current tree:
  - create a team-owned task via `cdx compat call --name task.create ... teamId=<team>`
  - then call `cdx worker spawn --run <run> --task <taskId> --role fullstack-developer --display-name 'Bypass worker'`
  - result: worker is created with `teamId: null`, and `cdx run show <run>` shows an active claim binding that null-team worker to the team-owned task

## Blocker Re-check

1. caller identity/auth model
   - failed
   - `compat call` is hardened, but dedicated CLI primitive commands still let users self-assert worker identity and mutate durable state.
2. mailbox authz and durable cursor mutation behavior
   - fixed on reviewed paths
   - compat `message.pull` now rejects user access to worker/team mailboxes before calling `pullMessages`, and CLI `message pull` blocks non-user mailboxes before cursor mutation.
3. `worker.spawn` effective team enforcement
   - failed
   - fixed in compat path only; still bypassable via direct CLI/runtime-controller spawn.
4. `team.delete` graceful drain semantics
   - fixed
   - current `TeamService.deleteTeam` transitions to `shutting_down`, sends shutdown requests once, and only returns `deleted` after no live workers remain.
5. `auto_approve_run` transaction coupling
   - fixed
   - policy mutation now occurs inside `ApprovalService.respondApproval(...)` transaction and rollback coverage exists.
6. `task.create` ownedPaths normalization
   - fixed on reviewed compat path
   - compat `task.create` now normalizes and validates repo-relative `ownedPaths`.
7. `artifact.read` cross-run `not_found` normalization
   - fixed
   - compat `artifact.read` now normalizes out-of-scope artifact-id lookup to `not_found`.

## Test Evidence
- `npm run test:runtime` passed in the current tree: `9` files, `46` tests.
- The remediation-added runtime tests do validate the compat-path fixes for mailbox authz, compat `worker.spawn`, `auto_approve_run`, `ownedPaths`, and `artifact.read`.
- They do not cover the remaining direct CLI/runtime-controller defects above, so the green suite is insufficient to clear the phase.

## Repro Evidence
- direct CLI identity spoof repro summary from the current tree:
  - `runId: run_9debfa2f0c152451`
  - `workerId: worker_fabe618ee41a95f2`
  - spoofed message accepted with:
    - `fromKind: "worker"`
    - `fromWorkerId: "worker_fabe618ee41a95f2"`
  - spoofed approval request accepted with:
    - `approvalId: "approval_af398a3cf36b26e8"`
    - `requestedByWorkerId: "worker_fabe618ee41a95f2"`
- direct CLI `worker.spawn` bypass repro summary from the current tree:
  - `runId: run_be8f6bc02b965609`
  - `teamId: team_ba9d3a163943a60d`
  - `taskId: task_af0b98532796b03e`
  - spawned worker accepted with `teamId: null`
  - resulting claim:
    - `claimId: claim_18a3fe4cffbd6d4b`
    - `taskId: "task_af0b98532796b03e"`
    - `workerId: "worker_26b570d4fba3b994"`
    - `status: "active"`

## Review Verdict
- Phase 3 remains blocked.
- The candidate materially fixes five of the seven Session D blockers.
- Two blockers remain open on public direct CLI/runtime-controller paths:
  - caller identity/auth model
  - `worker.spawn` effective team enforcement

## Required Before Re-Verdict
1. remove or harden direct CLI primitive mutation routes that currently accept caller-controlled worker/system identity fields
2. make direct `RuntimeController.spawnWorker(...)` enforce the same task/team invariants as compat `worker.spawn`, or route the CLI through the compat implementation
3. add runtime coverage for:
   - spoofed `cdx message send --from-kind/--from-worker`
   - spoofed `cdx approval request --requester-worker`
   - `cdx worker spawn --task <team-task>` with omitted `--team`

## Unresolved Questions
- none
