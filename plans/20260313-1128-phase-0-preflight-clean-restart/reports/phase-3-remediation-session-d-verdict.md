# Phase 3 Remediation Session D Verdict

## Metadata
- Date: 2026-03-20
- Status: completed
- Role/modal used: lead verdict / Default
- Model used: GPT-5 / Codex
- Source of truth: current dirty candidate tree in `/Users/hieunv/Claude Agent/CodexKit` on `main`
- Frozen verification contract: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md`
- Evidence inputs read:
  - `README.md`
  - `docs/compatibility-primitives-and-mcp-spec.md`
  - `docs/compatibility-matrix.md`
  - `docs/project-roadmap.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-d-verdict.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-remediation-session-a-implementation-summary.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-remediation-session-b-test-report.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-remediation-session-c-review-report.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-3-remediation-verdict-ready-after-s25-s26-pasteback.md`

## Verdict
- Phase 3 Compatibility Primitive Layer: **FAIL**

## Lead Decision
- remediation materially improves the candidate and closes five of the seven prior blockers
- the phase still fails because two reviewer findings remain reproducible on current public CLI/runtime-controller surfaces
- per control instruction, those reviewer findings are blockers unless clearly disproved; current-tree code inspection and direct repro confirm them
- `.tmp/nfr-7.1-launch-latency.json` and `.tmp/nfr-7.2-dispatch-latency.json` remain candidate-tree evidence only, not phase-close proof

## Exit-Criteria Assessment

### 1. worker prompts can use CodexKit primitives instead of Claude-native ones
- partial
- compat MCP primitives are present and the remediation tests show the compat-path fixes hold
- but the authority boundary still fails on another shipped primitive surface: direct CLI mutation routes still accept user-supplied worker identity and persist it into durable message and approval records
- this still violates spec authority rules that caller identity must come from authenticated/session-derived state, not free-form payload or flag hints

### 2. terminal approval checkpoints work
- pass on the remediated blocker set
- reviewer and code inspection agree `auto_approve_run` is now coupled to approval resolution inside the approval transaction
- tester rerun includes rollback coverage showing failed policy write keeps approval `pending`

### 3. messaging supports direct and team-targeted delivery
- partial
- compat and CLI mailbox-pull authz hardening appears correct for the reviewed `message.pull` paths
- but direct CLI `message send` still lets a terminal user persist `fromKind=worker` plus `fromWorkerId=<worker>` through public flags, so delivery exists while sender authority remains unsound

### 4. compatibility primitives do not weaken prior Phase 1/2 guarantees
- fail
- the direct CLI/runtime-controller `worker.spawn` path still allows `--task <team-task>` with omitted `--team`, producing a `teamId: null` worker plus active claim on a team-owned task
- that weakens the task/team isolation guarantee the remediation was supposed to restore

## Tester vs Reviewer Tension
- tester result: pass on targeted blocker suite and full runtime suite
- reviewer result: blocked due to two remaining direct CLI/runtime-controller defects
- lead resolution: reviewer prevails for phase-close
- reason:
  - tester evidence is real, but it is centered on compat-path and selected CLI coverage
  - the green suite does not disprove the reviewer’s direct CLI repros for:
    - `cdx message send --from-kind/--from-worker`
    - `cdx approval request --requester-worker`
    - `cdx worker spawn --task <team-task>` with omitted `--team`
  - those repros target public routes that bypass the hardened compat checks
- conclusion:
  - the tester rerun proves the compat fixes work where exercised
  - it does not establish that the candidate is phase-close safe across all shipped primitive entrypoints

## Blocking Findings Confirmed In Current Tree

### 1. Critical: direct CLI mutation routes still allow worker-identity spoofing
- code confirmation:
  - `packages/codexkit-cli/src/index.ts` forwards `message send` `--from-kind`, `--from-id`, and `--from-worker` directly at lines 276-290
  - `packages/codexkit-daemon/src/runtime-controller.ts` passes those fields straight into `messageService.sendMessage(...)` at lines 141-168
  - `packages/codexkit-cli/src/index.ts` forwards `approval request --requester-worker` directly at lines 307-324
  - `packages/codexkit-daemon/src/runtime-controller.ts` passes that to `approvalService.requestApproval(...)` at lines 201-212
  - downstream services only validate run membership, not caller authenticity:
    - `packages/codexkit-core/src/services/message-service.ts` lines 27-30
    - `packages/codexkit-core/src/services/approval-service.ts` lines 30-33 and 69-73
- direct repro confirmed on current tree:
  - spoofed `cdx message send --from-kind worker --from-worker <workerId>` persisted a durable message with `fromKind: "worker"` and `fromWorkerId: "<workerId>"`
  - spoofed `cdx approval request --requester-worker <workerId>` persisted a durable approval with `requestedByWorkerId: "<workerId>"`
- disposition:
  - blocker remains open
  - hardening `compat call` alone is insufficient because the same authority defect remains on first-class CLI primitive commands

### 2. Important: direct CLI/runtime-controller `worker.spawn` still bypasses effective team enforcement
- code confirmation:
  - `packages/codexkit-cli/src/index.ts` sends CLI `worker spawn` directly to `RuntimeController.spawnWorker(...)` at lines 258-273
  - `packages/codexkit-daemon/src/runtime-controller.ts` registers the worker with `teamId: input.teamId ?? null` and creates a claim when `taskId` is present, but never loads the task or derives team from it at lines 102-139
  - `packages/codexkit-core/src/services/worker-service.ts` only validates `teamId` when provided at lines 23-27
- direct repro confirmed on current tree:
  - create a team-owned task
  - run `cdx worker spawn --run <run> --task <taskId> --role fullstack-developer --display-name 'Bypass worker'`
  - result persisted with `teamId: null`
  - `cdx claim list --run <run>` then showed an active claim for that null-team worker on the team-owned task
- disposition:
  - blocker remains open
  - compat-path team enforcement does not clear the CLI/runtime-controller bypass

## Remediation Progress Accepted
- accepted as fixed for this verdict:
  - mailbox pull authz and no unauthorized cursor mutation on reviewed paths
  - `team.delete` graceful `shutting_down` to `deleted` behavior
  - transactional `auto_approve_run`
  - `task.create ownedPaths` normalization on compat path
  - `artifact.read` cross-run `not_found` normalization
- these fixes are necessary but not sufficient for phase close

## Phase 3 Close Decision
- do not close Phase 3
- current remediated candidate is still blocked on two public-surface contract violations

## Required Before Re-Verdict
1. remove or harden direct CLI primitive mutation routes so worker/system identity cannot be self-asserted by terminal users
2. make direct `RuntimeController.spawnWorker(...)` enforce the same effective-team rules as compat `worker.spawn`, or route CLI spawn through the compat implementation
3. add runtime coverage for:
   - spoofed `cdx message send --from-kind/--from-worker`
   - spoofed `cdx approval request --requester-worker`
   - `cdx worker spawn --task <team-task>` with omitted `--team`
4. rerun targeted verification and full runtime after those fixes

## Unresolved Questions
- none
