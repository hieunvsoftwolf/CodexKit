# Phase 01 S3 Spec-Test-Design Report

Date: 2026-04-04
Status: completed
Session: S3
Role/modal used: spec-test-designer / read-only contract freeze
Model used: Codex / GPT-5
Pinned BASE_SHA: `c11a8abf11703df92b4c81152d39d52f356964bd`
Execution surface: root control surface only, read-only

## Source-of-truth inputs read

- `README.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/phase-01-archive-confirmation-contract-alignment.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-01-planner-decomposition-report.md`
- `docs/control-agent/control-agent-codexkit/verification-policy.md`
- `docs/control-agent/control-agent-codexkit/plan-contract.md`
- `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`
- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`

## Frozen contract decision

Phase 12 archive runtime + CLI tests remain the contract anchor for Phase 01. Legacy runtime, legacy CLI, and NFR evidence surfaces must align to this already-landed behavior, not reopen it.

Canonical runtime seam from `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`:

- archive entry creates confirmation gate at `plan-archive-confirmation` and returns `status: "pending"` with `pendingApproval.approvalId`, `pendingApproval.checkpoint`, and `pendingApproval.nextStep` at lines 498-520 and 630-663
- archive entry must not mutate `plan.md` before approval at lines 630-663
- archive entry must not emit `archiveSummaryPath`, `archiveJournalPath`, or archive artifact ids before approval at lines 646-663
- approval continuation is the only path that may return `status: "valid"` and publish archive summary + journal artifacts at lines 711-741
- approval continuation mutates `plan.md` to `status: "archived"`, clears active-plan when needed, records archive metadata, and publishes durable artifacts at lines 523-612 and 711-741

Canonical verification seam from Phase 12 runtime anchor:

- `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts:23-93` proves:
  - entry returns `pending`
  - checkpoint is `plan-archive-confirmation`
  - `cdx approval respond` continuation hint exists
  - no archive artifacts exist before approval
  - `plan.md` remains unchanged before approval
  - approval continuation returns `valid`
  - archive summary + journal artifacts exist after approval
  - run artifact listing contains those artifacts after approval

Canonical verification seam from Phase 12 CLI anchor:

- `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts:25-82` proves same contract through real `cdx` commands:
  - `cdx plan archive <planPath>` returns `pending`
  - approval resolution requires real `cdx approval respond <approvalId> --response approve`
  - only continuation yields archived plan state and durable archive artifacts
  - artifact presence must be proved via `cdx run show <runId>`

## Frozen expectations by surface

### 1. Legacy runtime surface

Target file: `tests/runtime/runtime-workflow-wave2.integration.test.ts`

Current stale expectation at lines 67-73 assumes:

- `runPlanArchiveWorkflow(...)` returns `status: "valid"` immediately
- `archiveSummaryPath` exists immediately
- `plan.md` is archived immediately

Frozen replacement contract:

- first archive call must assert `status: "pending"`
- first archive call must assert `pendingApproval.checkpoint === "plan-archive-confirmation"`
- first archive call must assert approval id exists and next-step string contains `cdx approval respond`
- first archive call must assert plan file is byte-for-byte unchanged before approval
- first archive call must assert archive summary/journal paths and artifact ids are absent before approval
- approval continuation proof is required, using runtime approval response path
- only after continuation may the test assert:
  - `status: "valid"`
  - `status: "archived"` in `plan.md`
  - archive summary and journal files exist
  - blocked validate/red-team diagnostics occur against archived plan state
  - archived plan + phase remain immutable after blocked validate/red-team

### 2. Legacy CLI surface

Target file: `tests/runtime/runtime-cli.integration.test.ts`

Current stale expectation at lines 269-278 assumes:

- `cdx plan archive <planPath>` returns `valid` immediately
- archive summary exists immediately
- plan becomes archived in same command

Frozen replacement contract:

- real `cdx plan archive <planPath>` must return `status: "pending"`
- response must include `pendingApproval.approvalId`
- response must include checkpoint `plan-archive-confirmation`
- response must include next-step string containing `cdx approval respond`
- plan file must remain unchanged before approval
- no archive summary/journal paths are acceptable before approval
- test must execute real `cdx approval respond <approvalId> --response approve`
- continuation must return `status: "valid"`
- continuation must expose archive summary + journal paths and artifact ids
- archived plan state plus artifact visibility must then be confirmed with real CLI surfaces, including `cdx run show <runId>`

### 3. NFR evidence surface

Target file: `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`

Current stale expectation at lines 104-140 assumes:

- `archive.status === "valid"` in same call before any approval continuation proof

Frozen replacement contract for `NFR-5.2`:

- NFR evidence must include completed implementation proof from `cookAuto`
- archive entry must first prove `status: "pending"`
- archive entry must expose real approval-continuation handle
- approval continuation proof is mandatory before blocked archived-plan diagnostics are asserted
- blocked validate diagnostic evidence remains required after approval
- blocked red-team diagnostic evidence remains required after approval
- both diagnostic artifacts must still be durable published artifacts with typed codes:
  - `PLAN_VALIDATE_BLOCKED_ARCHIVED`
  - `PLAN_RED_TEAM_BLOCKED_ARCHIVED`
- `N/A` is not acceptable for archive entry or archive continuation in this phase

## Ownership freeze for this wave

Execution-owned by S2:

- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`

Verification-owned and read-only for S2:

- `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
- this report

Read-only runtime anchor:

- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`

Ownership rule:

- S2 may edit only the three execution-owned files above
- S2 may not edit Phase 12 anchor tests
- S2 may not edit production workflow code unless contradiction evidence proves anchor tests and runtime code disagree; absent that proof, production workflow code stays frozen
- S4 must treat Phase 12 anchors and this report as immutable contract input

## Frozen S4 first-run commands

S4 must run these unchanged first, in this order:

```bash
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-wave2.integration.test.ts
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts
```

S4 rule:

- run the two Phase 12 anchor suites unchanged before the three candidate legacy surfaces
- if either anchor fails on the candidate surface, return blocked against contract integrity before interpreting legacy failures as acceptable implementation defects

## Real-workflow evidence requirement

Required. No `N/A`.

Exact requirement:

- CLI archive flow evidence is required for `tests/runtime/runtime-cli.integration.test.ts`
- runtime in-process archive approval continuation proof is also required
- `N/A` is not acceptable for archive entry or archive continuation in this phase

What counts as acceptable evidence:

- for CLI archive flow:
  - real `cdx plan archive <planPath> --json` execution
  - real `cdx approval respond <approvalId> --response approve --json` execution
  - real `cdx run show <runId> --json` evidence for artifact visibility after continuation
  - command-level pass/fail with exact command strings, execution surface, and raw output/log reference in tester artifact
- for runtime in-process approval continuation:
  - first call to `runPlanArchiveWorkflow(...)` or equivalent controller entry proving `pending`
  - real approval response through runtime controller continuation path
  - proof that plan mutation and archive artifact publication happen only after continuation

What does not count:

- asserting only final archived state without proving the pending gate
- synthetic or manually fabricated artifact paths
- treating blocked validate/red-team diagnostics as sufficient without archive approval continuation proof

## Host caveats and evidence capture

Active host caveats still in force from current plan + README:

- raw `npx` may fail with `EPERM` on this machine when `~/.npm` ownership is invalid
- repo-local npm cache override is therefore mandatory for frozen S4 commands
- sandboxed Vitest/Vite temp-file `EPERM` remains an active caveat even though latest reruns did not reproduce it

Effect on evidence capture:

- S4 must preserve the frozen `npm_config_cache="$PWD/.npm-cache"` and `TMPDIR=.tmp` prefixes unchanged
- if a host `EPERM` or temp-file startup failure happens before assertion-layer evidence, S4 must record it as host-blocked evidence, not as contract-pass and not as product-regression proof
- tester artifact must capture exact failing command, exit code, stderr/log path, and whether failure occurred before test assertions loaded
- if host caveat reproduces twice on same surface without reaching assertions, promote it under durable host verification constraint per verification policy instead of blind retry

## Expected verdict shape for S4

Pass condition for this phase subset:

- both Phase 12 anchor suites pass unchanged
- all three execution-owned suites pass
- tester artifact includes command-level evidence and required real-workflow CLI + runtime continuation proof

Block condition:

- anchor suites fail
- any legacy suite still expects immediate archive `valid`
- CLI archive flow lacks real approval continuation evidence
- runtime archive path lacks in-process approval continuation evidence
- host caveat prevents assertion-layer evidence and is not captured as typed host blocker

## Unresolved questions

- none
