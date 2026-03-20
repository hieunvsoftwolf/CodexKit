# Phase 3 Session C Review Report

## Metadata
- Date: 2026-03-20
- Status: completed
- Role/modal used: code-reviewer / Default
- Model used: GPT-5 / Codex
- Source of truth reviewed: dirty working tree in `/Users/hieunv/Claude Agent/CodexKit` on `main`
- Phase references used:
  - `README.md`
  - `docs/compatibility-primitives-and-mcp-spec.md`
  - `docs/compatibility-matrix.md`
  - `docs/project-roadmap.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-a-implementation-summary.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-3-wave-2-ready-after-s20.md`

## Findings

### CRITICAL

1. Caller identity is not authenticated; the CLI lets any caller self-assert `user`, `worker`, or `system` authority and pass arbitrary `workerId` / `runId`, so the compat router's identity checks are advisory only.
- Evidence:
  - `packages/codexkit-cli/src/index.ts:120-131` builds the compat caller directly from `--caller-kind`, `--caller-worker`, and `--caller-run`.
  - `packages/codexkit-cli/src/index.ts:392-402` passes that free-form caller object straight into `controller.invokeCompat(...)`.
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:291-295` accepts the caller object as the authority source, and `resolveCallerWorker` only verifies that the referenced worker row exists.
- Why this is a release blocker:
  - spec 4.2 and 4.3 require an authenticated worker session and say caller identity must come from session state, not free-form payload or CLI fields
  - with the current path, any local caller can impersonate another worker or `system`, bypass worker/team/run isolation, and perform privileged operations such as system-only task updates or worker-only message flows

### IMPORTANT

2. Mailbox access control is broken for user callers, and an unauthorized pull has durable side effects.
- Evidence:
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:482-498` only constrains `user` callers for `recipientKind=user`; it does not block `user` access to `worker` or `team` mailboxes
  - `packages/codexkit-cli/src/index.ts:301-310` exposes `message pull` directly with arbitrary `recipient-kind` and `recipient-id`
  - `packages/codexkit-daemon/src/runtime-controller.ts:171-173` forwards that request straight to `messageService.pullMessages(...)` with no caller or run-scope enforcement
  - `packages/codexkit-core/src/services/message-service.ts:35-62` advances `deliveredAt` and mailbox cursors on every pull
- Why this matters:
  - spec 4.2 says CLI->daemon users may pull the user inbox, not worker or team mailboxes
  - unauthorized pulls do not just read data; they also durably advance the mailbox cursor and mark delivery, so one bad read can hide or reorder messages for the real worker or team after restart

3. `worker.spawn` fails the required team-scope check when the caller supplies `taskId` but omits `teamId`.
- Evidence:
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:403-417` only enforces caller team scope if `teamId` is present in the payload
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:431-445` then creates a worker with `teamId: null` and claims the task anyway
- Why this matters:
  - spec 5.3 requires `taskId`, when present, to belong to the same run and team scope
  - a team-scoped worker can claim another team's task by omitting `teamId`, which breaks team identity enforcement and lets null-team workers hold claims on team-owned work

4. `team.delete` is implemented as a hard delete, not the required graceful drain.
- Evidence:
  - `packages/codexkit-core/src/services/team-service.ts:122-176` transitions to `shutting_down`, enqueues `shutdown_request` messages, then immediately marks the team `deleted` in the same transaction
- Why this matters:
  - spec 5.2 requires transition to `shutting_down`, enqueue shutdown, wait for workers to stop or fail under reclaim policy, then mark `deleted`
  - current behavior can leave live workers attached to a deleted team across restart and creates inconsistent wake semantics because later team wake logic skips deleted or shutting-down teams

5. `auto_approve_run` is not durably atomic with approval resolution.
- Evidence:
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:538-542` resolves the approval first, then writes `approval.policy.run.<runId>=auto` afterward
  - `packages/codexkit-core/src/services/approval-service.ts:113-170` commits the approval row, task and worker state changes, event, and synthetic mailbox response inside its own transaction
- Why this matters:
  - spec 5.5 says `auto_approve_run` is approval resolution plus current-run policy update only, and spec 4.3 requires successful mutating side effects to be durable together
  - a crash between the two writes leaves restart state inconsistent: the approval is already approved and the response message exists, but the run is not actually in auto-approve mode
  - the policy mutation also emits no domain event, which weakens replay and audit visibility for a durable state change

### MODERATE

6. `task.create` persists raw `ownedPaths` without normalization or repo-relative validation.
- Evidence:
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:301-316` feeds `optionalStringArray(payload, "ownedPaths")` directly into `fileOwnership`
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:208-215` already contains `normalizeOwnedPaths(...)`, but it is only used by `worker.spawn`
- Why this matters:
  - spec 4.3 requires `ownedPaths` to be normalized repo-relative paths
  - this allows `task.create` to store absolute paths or traversal-like entries that later phases may treat as ownership grants, weakening the Phase 2 owned-path contract

## Notes
- The dirty candidate tree also modifies `.tmp/nfr-7.1-launch-latency.json` and `.tmp/nfr-7.2-dispatch-latency.json`.
- I did not find code consuming those files directly, so they are not a functional bug by themselves.
- They do materially change recorded p95 values, so they should be treated as candidate-tree evidence only, not proof that Phase 3 preserved the Phase 2 `NFR-7` baseline without fresh provenance.

## Testing Gaps Relevant To Findings
- `tests/runtime/runtime-compat-primitives.integration.test.ts` and `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` cover orchestrator-only team pulls, restart cursor persistence, and checksum conflict handling.
- I did not find coverage for:
  - spoofed compat callers through CLI `--caller-*`
  - user access to worker or team mailboxes
  - unauthorized mailbox-cursor advancement by the wrong caller
  - `worker.spawn` team-scope bypass when `taskId` is set and `teamId` is omitted
  - crash-safety or restart atomicity for `auto_approve_run`
  - `task.create` owned-path normalization negatives
  - `team.delete` waiting for worker drain before `deleted`

## Change Summary
- Reviewed the dirty Phase 3 candidate in `/Users/hieunv/Claude Agent/CodexKit` against the Phase 3 primitive spec, compatibility matrix, roadmap gating, and Session B0 acceptance targets.
- Focused on `packages/codexkit-compat-mcp/src/invoke-tool.ts`, approval and message durable side effects, artifact behavior, mailbox and team services, and worker, task, and team scope enforcement.

## Unresolved Questions
- none
