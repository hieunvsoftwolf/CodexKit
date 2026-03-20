# Phase 3 Session D Verdict

## Metadata
- Date: 2026-03-20
- Status: completed
- Role/modal used: lead verdict / Default
- Model used: GPT-5 / Codex
- Source of truth: current dirty candidate tree in `/Users/hieunv/Claude Agent/CodexKit` on `main`
- Evidence inputs read:
  - `README.md`
  - `docs/compatibility-primitives-and-mcp-spec.md`
  - `docs/compatibility-matrix.md`
  - `docs/project-roadmap.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-a-implementation-summary.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b-test-report.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-c-review-report.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-3-verdict-ready-after-s21-pasteback.md`

## Verdict
- Phase 3 Compatibility Primitive Layer: **FAIL**

## Lead Decision
- tester evidence shows the candidate is runnable and the current runtime suite passes
- reviewer evidence identifies release-blocking contract failures that are present in the current tree and are not disproved by the tests
- per control directive, reviewer findings are treated as real blockers unless evidence clearly disproves them; that disproof is absent here
- `.tmp/nfr-7.1-launch-latency.json` and `.tmp/nfr-7.2-dispatch-latency.json` are candidate-tree evidence only, not validated phase-close proof

## Exit-Criteria Assessment

### 1. worker prompts can use CodexKit primitives instead of Claude-native ones
- partial only
- compat surfaces exist in `packages/codexkit-compat-mcp/` and basic happy-path tests pass
- but the authority model is not compatible with spec 4.2/4.3 because caller identity is self-asserted from CLI flags, not authenticated session state
- evidence:
  - `packages/codexkit-cli/src/index.ts:120-131`
  - `packages/codexkit-cli/src/index.ts:392-402`
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:223-233`
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:291-295`
- effect: worker/system/user authority is advisory, so primitive isolation is weaker than required

### 2. terminal approval checkpoints work
- partial only
- request/respond durability exists and tests cover base flow
- but `auto_approve_run` is not atomic with approval resolution; approval commit and policy mutation are split across writes
- evidence:
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:532-542`
  - `packages/codexkit-core/src/services/approval-service.ts:113-170`
- effect: crash window can leave approval resolved while run policy stays non-auto, violating durable checkpoint semantics

### 3. messaging supports direct and team-targeted delivery
- partial only
- direct/team send and pull paths exist; restart cursor persistence has test evidence
- but mailbox authz is broken for user callers, and unauthorized pulls durably advance cursors / delivered markers
- evidence:
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:482-503`
  - `packages/codexkit-cli/src/index.ts:301-310`
  - `packages/codexkit-daemon/src/runtime-controller.ts:171-173`
  - `packages/codexkit-core/src/services/message-service.ts:79-115`
- effect: CLI users can pull worker or team mailboxes and mutate durable mailbox state, violating spec 4.2 and mailbox integrity

### 4. compatibility primitives do not weaken prior Phase 1/2 guarantees
- failed
- raw `ownedPaths` can enter task state without normalization, weakening the Phase 2 owned-path contract
- `worker.spawn` can bypass team-scope enforcement by supplying `taskId` without `teamId`, weakening team/task isolation
- `team.delete` marks teams `deleted` immediately instead of waiting for worker drain, weakening restart and wake semantics
- evidence:
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:298-317`
  - `packages/codexkit-compat-mcp/src/invoke-tool.ts:398-445`
  - `packages/codexkit-core/src/services/team-service.ts:114-178`

## Tester vs Reviewer Tension
- tester result: pass on executed suite, plus 3 added gap tests, no runtime failures
- reviewer result: 1 critical, 4 important, 1 moderate findings from code inspection against the spec
- resolution: reviewer wins for phase-close decision
- reason:
  - the passing tests do not exercise spoofed compat callers through CLI `--caller-*`
  - they do not cover user pulls of worker/team mailboxes or cursor corruption by unauthorized reads
  - they do not cover `worker.spawn` with `taskId` plus omitted `teamId`
  - they do not cover crash-safety for `auto_approve_run`
  - they do not cover graceful drain before `team.delete` returns `deleted`
  - they do not cover negative `task.create ownedPaths` normalization
- conclusion: test pass shows incomplete verification coverage, not blocker invalidation

## Blocking Findings Confirmed In Current Tree

### 1. Critical: caller identity is self-asserted, not authenticated
- confirmed
- `parseCompatCaller` accepts `--caller-kind`, `--caller-worker`, `--caller-run` directly and passes them to compat invoke unchanged
- `resolveCallerWorker` only checks that the named worker exists and optionally matches `caller.runId`
- this violates spec 4.2/4.3 authority boundaries

### 2. Important: unauthorized mailbox pulls mutate durable mailbox state
- confirmed
- user caller restriction exists only for `recipientKind=user` plus optional run check; nothing blocks user access to worker/team mailboxes in compat path
- `pullMessages` updates `deliveredAt` and cursor in the same transaction
- this is not read-only leakage; it changes durable delivery state

### 3. Important: `worker.spawn` team-scope bypass with `taskId` and omitted `teamId`
- confirmed
- task run is checked, but task team is only compared when payload `teamId` is present
- worker then registers with `teamId: null` and claims the task
- this violates spec 5.3 same-run same-team requirement

### 4. Important: `team.delete` is not graceful drain
- confirmed
- service sends `shutdown_request` messages then marks team `deleted` in the same transaction
- spec requires wait-for-stop/fail under reclaim policy before `deleted`

### 5. Important: `auto_approve_run` not atomic with approval resolution
- confirmed
- policy write happens after `respondApproval` transaction commits
- no same-transaction durability guarantee and no event for policy change

### 6. Moderate: `task.create` stores raw `ownedPaths`
- confirmed
- task path uses `optionalStringArray(payload, "ownedPaths")`; normalization helper exists but is not applied there
- this weakens prior owned-path invariants even if later phases consume the field more heavily

## Artifact.read Error Mapping Resolution
- tester unresolved question resolved: current implementation behavior is `permission_denied`, but frozen B0 expectation says `not_found` for cross-run artifact lookup
- evidence:
  - B0: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md:526-531`
  - spec error table: `docs/compatibility-primitives-and-mcp-spec.md:424-430`
  - implementation: `packages/codexkit-compat-mcp/src/invoke-tool.ts:591-616`
- lead call:
  - for cross-run `artifact.read` by `artifactId`, the compat surface should normalize to `not_found`, not `permission_denied`
  - rationale: the artifact exists, but not in caller scope; the spec defines `not_found` as referenced artifact does not exist in scope
- disposition:
  - this is a real spec/implementation drift
  - not the primary reason for phase failure because stronger blockers already exist
  - still needs correction or explicit spec change before close

## Phase 3 Close Decision
- do not close Phase 3
- required exit criteria are not met at release-blocker level
- current candidate should return to implementation with blocker fixes plus targeted tests for each blocker path

## Required Before Re-Verdict
1. replace self-asserted compat caller authority with authenticated session-derived identity, or remove the insecure public path
2. enforce mailbox authz for user callers and prevent unauthorized pulls from mutating cursors or delivery state
3. enforce `worker.spawn` task/team consistency even when `teamId` is omitted
4. make `team.delete` wait for worker drain before terminal delete status
5. make `auto_approve_run` atomic with approval resolution and emit durable audit/event evidence
6. normalize and validate `task.create ownedPaths`
7. align cross-run `artifact.read` error mapping with frozen B0/spec, or update the spec and B0 explicitly if design changed
8. add runtime tests for every blocker path above; current green suite is not enough

## Unresolved Questions
- none
