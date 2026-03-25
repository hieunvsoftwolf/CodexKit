# Phase 8 Session B Test Report

**Date**: 2026-03-24
**Status**: blocked
**Role/Modal Used**: tester / default
**Model Used**: GPT-5 Codex / Codex CLI
**Pinned BASE_SHA**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`

## Scope

- verified current Phase 8 candidate against:
  - `docs/workflow-extended-and-release-spec.md`
  - `docs/project-roadmap.md`
  - `docs/compatibility-matrix.md`
  - `docs/project-overview-pdr.md`
  - `docs/system-architecture.md`
  - `docs/verification-policy.md`
  - `docs/non-functional-requirements.md`
  - `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-session-b0-spec-test-design.md`
- did not use reviewer output or verdict output
- did not modify production code
- added verification-only follow-up via ad hoc probes after the frozen B0 sequence

## Commands Run

1. `npm run test:runtime -- tests/runtime/runtime-cli.integration.test.ts`
2. `npm run test:runtime -- tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
3. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase8-cli.integration.test.ts tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism`
4. verification-only follow-up probe:
   `node --no-warnings --experimental-strip-types ...` against fresh temporary fixtures under `.tmp/phase8-followup/`

## Frozen B0 Sequence Results

### Command 1

- failed
- observed behavior:
  - `npm run test:runtime` expands to `vitest run tests/runtime --no-file-parallelism ...`
  - this reran the full runtime suite, not only `tests/runtime/runtime-cli.integration.test.ts`
- failing test:
  - `tests/runtime/runtime-daemon.integration.test.ts:126`
  - expected approval status `pending`
  - received `expired`
- Phase 8 note:
  - unrelated suite failure; not a Phase 8 packaging assertion
  - still blocks the frozen command from passing unchanged

### Command 2

- failed
- same root cause as Command 1:
  - `npm run test:runtime` reran the full runtime suite
  - failed again at `tests/runtime/runtime-daemon.integration.test.ts:126`
- Phase 8 note:
  - Phase 8 targeted file itself passed inside the broader run

### Command 3

- passed
- `2` files passed, `12` tests passed
- direct evidence:
  - `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
  - `tests/runtime/runtime-cli.integration.test.ts`

## Phase 8 Acceptance Results

### Passed

- `cdx init` preview exposed planned writes, preserved files, conflicts, and blocked actions on a ClaudeKit-style fixture with existing `README.md`, root `AGENTS.md`, and `.codex/config.toml`
- `cdx update` preview exposed conflicts and blocked actions after a protected managed file was locally modified
- protected writes to root `AGENTS.md` and `.codex/**` remained approval-gated
- `migration-assistant-report.md` was emitted and contained all required sections:
  - detected source kit markers
  - required install or upgrade actions
  - risky customizations needing manual review
  - recommended next command sequence
- `cdx doctor` blocked explicitly when `codex` was unavailable while the CLI entry remained runnable
  - status: `blocked`
  - finding code: `DOCTOR_CODEX_CLI_MISSING`
  - no silent downgrade observed
- `cdx doctor` detected broken install state and invalid runtime state
  - broken install: missing install-state produced `DOCTOR_INSTALL_STATE_MISSING` and `DOCTOR_REPO_STATE_UNSUPPORTED`
  - invalid runtime state: stale daemon lock produced `DOCTOR_DAEMON_LOCK_STALE`
- `cdx resume` surfaced stale-claim reclaim and emitted one explicit plan-path continuation command
  - reclaim candidate reason: `lease expired; reclaim recommended`
  - continuation command shape: `cdx cook <absolute-plan-path>`
- follow-up stayed bounded to Phase 8 packaging, migration UX, doctor, and resume behavior only

### Failed

#### 1. Install-only repos are not actually blocked from worker-backed workflows

- fixture:
  - git repo initialized
  - no initial commit
  - `cdx init --apply --approve-protected --approve-managed-overwrite`
- observed:
  - init result `installOnly: true`
  - `.codexkit/state/install-state.json` recorded `installOnly: true`
  - `cdx doctor` reported repo class `install-only-no-initial-commit`
  - `cdx cook <plan-path>` still succeeded
  - cook diagnostics only reported `COOK_IMPLEMENTATION_READY`
- expected from Phase 8 freeze:
  - install-only repos must remain blocked from worker-backed workflows until first commit exists
- impact:
  - violates `NFR-4.5`
  - current implementation only labels install-only state; it does not enforce the workflow block

#### 2. `cdx doctor` does not detect import-registry drift

- fixture:
  - healthy installed repo after `cdx init --apply`
  - deleted `.codexkit/manifests/import-registry.json`
- observed:
  - `cdx doctor` returned status `healthy`
  - no finding or diagnostic referenced import-registry drift
  - only unrelated info finding present: `DOCTOR_RESUMABLE_RUNS_PRESENT`
- expected from Phase 8 docs and B0 freeze:
  - doctor must detect manifest or import-registry consistency issues / migration drift
- impact:
  - violates the frozen doctor contract
  - weakens `NFR-4.1`, `NFR-4.6`, and the Phase 8 doctor exit criterion for migration drift detection

## Follow-Up Probe Evidence

### Preview / Update Probe

- init preview:
  - checkpoints: `package-scan`, `package-preview`
  - preserved: `README.md`
  - conflicts: `AGENTS.md`, `.codex/config.toml`
  - blocked gates: `managed-overwrite`, `protected-path`
- update preview after local protected-file edit:
  - checkpoints: `update-scan`, `update-preview`
  - conflicts: `AGENTS.md`
  - blocked gates: `managed-overwrite`, `protected-path`

### Install-Only Probe

- doctor result:
  - repo class: `install-only-no-initial-commit`
  - status: `degraded`
  - finding: `DOCTOR_INSTALL_ONLY_REPO`
  - diagnostic: `REPO_INSTALL_ONLY`
- failing behavior:
  - cook workflow still ran instead of blocking

### Host-Capability Probe

- host simulation:
  - `codex` absent from `PATH`
  - CLI entry remained runnable
- result:
  - doctor status `blocked`
  - finding `DOCTOR_CODEX_CLI_MISSING` with severity `error`

### Broken Install / Runtime-State Probe

- doctor findings included:
  - `DOCTOR_INSTALL_STATE_MISSING`
  - `DOCTOR_REPO_STATE_UNSUPPORTED`
  - `DOCTOR_DAEMON_LOCK_STALE`
- diagnostics included:
  - `REPO_BROKEN_CODEXKIT_STATE`

### Resume Probe

- `cdx resume <run-id>` returned:
  - stale reclaim candidate
  - continuation command `cdx cook <absolute-plan-path>`

## Exit-Criteria Mapping

| Phase 8 target | Result | Evidence |
|---|---|---|
| New repo install works | partial | preview/apply behavior works; install-only enforcement incomplete |
| Existing ClaudeKit repo install works without destructive rewrites | pass | preview preserved `README.md`, conflicted protected files, blocked before unsafe overwrite |
| Doctor command detects missing dependencies and invalid state | partial | missing tool and stale lock detected; import-registry drift missed |
| Phase 8-owned metrics for `NFR-4`, `NFR-8`, and remaining continuity hardening in `NFR-1` and `NFR-6` pass | fail | install-only workflow block missing; doctor migration-drift detection missing |

## Concrete Defects

1. Install-only state is advisory only; worker-backed workflow entry is not blocked before first commit.
2. `cdx doctor` misses deleted import-registry drift and reports the repo healthy.
3. Frozen commands 1 and 2 currently fail unchanged because `test:runtime` reruns the full runtime suite and trips the existing runtime-daemon regression at `tests/runtime/runtime-daemon.integration.test.ts:126`.

## Recommended Next Session

- remediation session should:
  - enforce install-only gating for worker-backed workflow entrypoints
  - add doctor detection for import-registry drift / missing registry
  - decide whether the broad `test:runtime` script shape should be narrowed for B0 command stability or the unrelated daemon regression should be fixed first

## Unresolved Questions

- none
