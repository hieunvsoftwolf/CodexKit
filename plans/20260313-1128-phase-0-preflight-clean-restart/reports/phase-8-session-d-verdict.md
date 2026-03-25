# Phase 8 Session D Verdict

**Date**: 2026-03-25
**Phase**: Phase 8 Packaging and Migration UX
**Verdict**: fail
**Role/Modal Used**: lead-verdict / default
**Model Used**: GPT-5 Codex / Codex CLI
**Pinned BASE_SHA**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`

## Decision

Phase 8 fails on the current candidate.

Reason:
- the reviewer reported one `CRITICAL` contract violation in preview/apply behavior for `cdx init` and `cdx update`
- tester and reviewer both confirmed install-only enforcement is missing
- tester confirmed `cdx doctor` misses import-registry drift
- reviewer confirmed `cdx resume` does not turn reclaim-blocked recovery into one concrete operator action

These are Phase 8-owned failures against the frozen contract and Phase 8-owned `NFR-4`, `NFR-5`, `NFR-6`, and `NFR-8` expectations. Under `docs/non-functional-requirements.md`, a mandatory failing Phase-owned metric is a release blocker for the phase.

## Contract-Weighted Blockers

### 1. `CRITICAL` Preview/apply contract drift in `cdx init` and `cdx update`

Why fail:
- Phase 8 froze preview-first packaging behavior
- reviewer showed current `init` and `update` apply paths write before any operator-visible preview/report is published
- the same command can both approve and mutate protected paths

Contract impact:
- violates Phase 8 shared packaging rules in `docs/workflow-extended-and-release-spec.md`
- violates frozen acceptance that planned writes, preserved files, conflicts, and blocked actions must be operator-visible before mutation starts
- blocks Phase 8 exit criteria for safe install/update behavior
- directly threatens `NFR-4.3`

Verdict weight:
- sufficient by itself to fail Phase 8

### 2. `IMPORTANT` Install-only state is advisory, not enforced

Why fail:
- tester proved a repo can be marked install-only and still run `cdx cook <plan-path>`
- reviewer confirmed workflow entrypoints do not enforce the guard

Contract impact:
- violates frozen install-only rule
- violates `NFR-4.5`
- means new-repo bootstrap is not safely bounded after install

### 3. `IMPORTANT` `cdx doctor` misses import-registry drift

Why fail:
- tester deleted `.codexkit/manifests/import-registry.json`
- `cdx doctor` still reported the repo healthy and emitted no import-registry drift finding

Contract impact:
- violates the Phase 8 doctor contract for manifest/import-registry consistency
- blocks the roadmap exit criterion that doctor detects missing dependencies and invalid state
- violates the repo-fixture expectation for broken install or registry drift

### 4. `IMPORTANT` `cdx resume` blocked-recovery handling is incomplete

Why fail:
- reviewer showed reclaim candidates are surfaced but not converted into one concrete recovery action
- current continuation command can ignore the actual reclaim blocker and still report generic recovery-ready output

Contract impact:
- violates the frozen blocked-recovery expectation
- violates `NFR-5.5` and `NFR-6.4`
- means resume continuity is only partial, not Phase 8-complete

## `test:runtime` Instability Classification

The frozen `npm run test:runtime -- ...` instability is **not** treated here as an independent Phase 8 contract blocker.

Why:
- tester traced the failure to the current `test:runtime` script rerunning the full runtime suite
- the failing assertion is in `tests/runtime/runtime-daemon.integration.test.ts:126`
- that regression is outside the specific Phase 8 packaging/migration UX contract

How it is treated:
- rerun-noise and evidence-hygiene debt
- it prevents a clean unchanged rerun of frozen commands 1 and 2
- it should be handled before or alongside retest for clean wave hygiene
- it is **not** part of the minimum Phase 8 remediation scope unless the team decides clean frozen-command reruns are mandatory before verdict reversal

## Minimum Remediation Scope

Only this minimum scope is required before Phase 8 can be re-tested:

1. restore true operator-visible preview-before-mutation behavior for `cdx init` and `cdx update`
2. enforce install-only blocking at worker-backed workflow entrypoints until the first commit exists
3. make `cdx doctor` detect missing or inconsistent import-registry state as explicit drift/broken-install output
4. make `cdx resume` convert reclaim-blocked recovery into one concrete next action instead of generic recovery-ready output

Explicit non-scope for this remediation:
- no Phase 9 golden, chaos, migration-validation, or release-readiness work
- no unrelated Phase 1 daemon-regression cleanup unless needed for rerun hygiene
- no widening into workflow areas outside `init`, `doctor`, `resume`, `update`, and migration assistant

## Next Session Target

Next session should be Phase 8 remediation implementation.

Recommended acceptance target for the remediation wave:
- fix the four blockers above
- add or expand verification-owned coverage for:
  - preview-before-apply sequencing
  - install-only workflow-entry blocking
  - import-registry drift detection
  - reclaim-blocked resume recovery action

## Final Outcome

- current candidate does not satisfy Phase 8 exit criteria
- current candidate must not advance to Phase 9
- remediation and re-verification are required

## Unresolved Questions

- none
