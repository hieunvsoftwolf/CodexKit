# Phase 8 Session B0 Spec-Test-Design

**Date**: 2026-03-24
**Status**: completed
**Role/Modal Used**: spec-test-designer / default planning modal
**Model Used**: GPT-5 Codex / Codex CLI
**Pinned BASE_SHA**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`

## Provenance

- source of truth used:
  - `README.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-8-wave-1-ready-after-planner.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-planner-decomposition-report.md`
  - `docs/workflow-extended-and-release-spec.md`
  - `docs/project-roadmap.md`
  - `docs/compatibility-matrix.md`
  - `docs/project-overview-pdr.md`
  - `docs/system-architecture.md`
  - `docs/verification-policy.md`
  - `docs/non-functional-requirements.md`
  - `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`
- pinned repo state inspected:
  - public CLI and controller seams at `BASE_SHA`
  - existing runtime CLI test harness under `tests/runtime/`
  - existing runtime fixture helpers under `tests/runtime/helpers/`
- excluded by design:
  - candidate implementation branches or diffs
  - implementation summaries
  - reviewer output
  - tester output
  - any acceptance relaxation based on unseen candidate code

## Summary

- froze non-destructive preview/apply acceptance for `cdx init` and `cdx update`
- froze explicit approval requirements for protected writes to root `AGENTS.md` and `.codex/**`
- froze install-only behavior for repos without an initial commit
- froze host-capability-gap, degraded-mode, and typed-diagnostic expectations for `cdx doctor`
- froze reclaim, blocked-recovery, and explicit continuation-command expectations for `cdx resume`
- froze required sections for `migration-assistant-report.md` and the shared repo-fixture matrix
- did not add verification-owned tests in this B0 session because the pinned base has generic CLI/runtime harnesses but does not yet expose a stable Phase 8 public workflow surface for `init`, `doctor`, `update`, and workflow-style `resume`

## Acceptance Freeze

Phase 8 passes only if all of these remain true at candidate verification time:

- `cdx init` and `cdx update` always scan before writing and always preview planned actions before any apply step
- preview output enumerates planned writes, preserved files, conflicts, and blocked actions before mutation starts
- unmanaged repo files are never rewritten without explicit operator approval
- writes to root `AGENTS.md` and `.codex/**` are always approval-gated
- repos without an initial commit may be installed but must remain install-only and blocked from worker-backed workflows until the first commit exists
- `cdx doctor` detects missing mandatory tools, invalid runtime state, migration drift, and broken install state with explicit severity levels
- `cdx doctor` fails or degrades explicitly on host-capability-gap fixtures; no silent downgrade is allowed
- `cdx resume` resumes interrupted runs from durable ledger state, surfaces stale-worker or stale-claim reclaim when needed, and never reuses retained failed worktrees in place
- `cdx resume` emits one explicit continuation command when workflow semantics require plan-path re-entry
- `migration-assistant-report.md` is emitted by the shared migration assistant used by `cdx init`, `cdx doctor`, and `cdx update`
- Phase 8 acceptance remains bounded to packaging and migration UX only; no Phase 9 golden, chaos, or release-readiness claims are part of this B0 contract

## Exit-Criteria Mapping

| Phase 8 exit criterion | Frozen verification target |
|---|---|
| New repo install works | candidate must support fresh-repo `cdx init` with preview-first behavior, correct protected-write approval gates, and explicit install-only handling when no initial commit exists |
| Existing ClaudeKit repo install works without destructive rewrites | candidate must preserve user-owned content by default, enumerate conflicts before apply, and route risky customizations to manual review rather than silent overwrite |
| Doctor command detects missing dependencies and invalid state | candidate must publish `doctor-report.md` with `error` / `warn` / `info` levels and explicit typed diagnostics for unsupported or blocked states |
| Phase 8-owned metrics for `NFR-4`, `NFR-8`, and remaining continuity hardening in `NFR-1` and `NFR-6` pass | candidate must produce executable evidence for repo-fixture safety, capability-gap behavior, resume and reclaim continuity, blocked-recovery output, and explicit continuation commands |

## Normative Interpretations

Where the docs leave room for formatting variation, B0 freezes the following minimum behavior:

- preview/apply formatting may vary, but every previewable packaging flow must make all four of these operator-visible before mutation:
  - planned writes
  - preserved files
  - conflicts
  - blocked actions
- a typed diagnostic must include a stable code or category, a plain-language cause, and one concrete next step or next command
- install-only is not a hard failure by itself:
  - install may complete
  - worker-backed workflows remain blocked until git prerequisites are satisfied
- for `cdx doctor`, unsupported mandatory host capability is a blocking `error`
- for `cdx doctor`, optional capability gaps may degrade only when the degraded mode is named explicitly
- for `cdx resume`, explicit continuation command emission is mandatory when durable recovery alone is insufficient to resume semantic progress, especially for plan-path re-entry flows such as `cdx cook <absolute-plan-path>`
- for `cdx update`, current docs freeze a conservative interpretation:
  - user-modified managed files must stop at preview and explicit choice
  - B0 does not accept silent auto-merge of user modifications

## Artifact Assertions

### `init-report.md`

Minimum durable content:

- detected repo class:
  - `fresh`
  - `existing-codexkit`
  - `claudekit-style`
  - or explicit unsupported or broken state
- planned writes
- preserved files
- conflicts
- blocked actions
- approvals requested and approved, if any
- explicit note when repo remains install-only because the first commit does not exist yet
- next steps

### `update-report.md`

Minimum durable content:

- installed-state scan summary
- managed-file changes
- preserved files
- conflicts
- blocked actions
- applied safe updates, if any
- manual merge actions for user-modified managed files
- explicit note that unmanaged files were not rewritten by default

### `doctor-report.md`

Minimum durable content:

- mandatory tool checks:
  - Codex CLI
  - Node runtime
  - git
  - `git worktree`
- repo git-backed and initial-commit health
- runtime dir health and stale lock state
- manifest or import-registry consistency
- root `README.md` presence when required by repo instructions
- resumable-run and retained-worktree anomalies
- missing generated files or broken install state
- each finding labeled `error`, `warn`, or `info`
- any unsupported host state expressed as a typed diagnostic with one concrete next step

### `resume-report.md`

Minimum durable content:

- resumable runs, pending approvals, or recovery candidates selected by `resume-select`
- recovered run id and workflow
- checkpoint continuity summary
- reclaim actions taken or required for stale workers or stale claims
- explicit statement that retained failed worktrees were not resumed in place
- explicit continuation command when semantic re-entry is required
- blocker summary with one concrete recovery action when resume cannot continue immediately

### `migration-assistant-report.md`

Minimum durable content:

- detected source kit markers
- required install or upgrade actions
- risky customizations needing manual review
- recommended next command sequence

Frozen shared rule:

- the migration assistant is a shared helper artifact used by `cdx init`, `cdx doctor`, and `cdx update`
- B0 does not require a separate public top-level migration command

## Fixture Matrix

| Fixture | Purpose | Primary acceptance targets |
|---|---|---|
| `F1 fresh-non-git-install` | fresh directory without usable git history | `cdx init` preview-first behavior, optional `git init` approval, install-only note, blocked worker-backed follow-up |
| `F2 git-no-initial-commit` | git-backed repo without first commit | install-only persistence, `doctor` git-health warning or error, `NFR-4.5` |
| `F3 clean-managed-install` | supported git repo with initial commit | `cdx init` success path, managed asset creation, protected-path approvals, durable `init-report.md` |
| `F4 claudekit-style-migration` | repo with `.claude/**` and migration markers | migration assistant sections, non-destructive install behavior, import-registry creation, preserved custom guidance files |
| `F5 modified-managed-update` | existing CodexKit install with user-modified managed files | `cdx update` preview-first conflict handling, explicit overwrite choice, no blind merge |
| `F6 broken-install-or-registry-drift` | missing generated files or inconsistent manifest registry | `cdx doctor` broken-install detection and explicit severity |
| `F7 host-capability-gap` | supported repo on unsupported or partially capable host | typed blocked or degraded doctor output, no silent downgrade, `NFR-8.2` and `NFR-8.3` |
| `F8 interrupted-run-pending-approval` | interrupted durable run with pending approval | `cdx resume` selection, blocked-recovery output, unresolved approvals surfaced, `NFR-6.4` |
| `F9 stale-reclaim` | interrupted run with stale worker or expired claim | reclaim visibility, deterministic resume outcome, one concrete recovery action when blocked |
| `F10 explicit-plan-reentry` | plan-driven workflow requiring command re-entry | mandatory explicit continuation command such as `cdx cook <absolute-plan-path>` |

## Planned Commands For Session B

These commands are frozen as the first unchanged tester sequence once Session A lands candidate implementation:

1. `npm run test:runtime -- tests/runtime/runtime-cli.integration.test.ts`
2. `npm run test:runtime -- <Phase 8 CLI integration file(s) authored by Session A or verification-only follow-up>`
3. `npx vitest run <Phase 8 targeted runtime tests> --no-file-parallelism`

Candidate verification must cover at least these scenario groups:

```bash
cdx init --json
cdx update --json
cdx doctor --json
cdx resume --json
```

Expected tester adaptation:

- Session B should execute the frozen B0-owned subset first when Phase 8 verification files exist
- if Session A does not provide Phase 8 executable tests, Session B should add only verification-owned follow-up in stable test scope
- Session B must not weaken these expectations to match implementation shortcuts

## Verification-Owned Tests Added

Added:

- none

Reason:

- the pinned base has stable generic harness points:
  - CLI invocation helper pattern in `tests/runtime/runtime-cli.integration.test.ts`
  - git and non-git fixture helpers in `tests/runtime/helpers/runtime-fixture.ts`
- but the pinned base does not yet expose a stable Phase 8 public workflow surface:
  - `packages/codexkit-cli/src/workflow-command-handler.ts` contains no `init`, `doctor`, or `update` workflow branches
  - `packages/codexkit-daemon/src/runtime-controller.ts` still exposes `resume()` as inspection-oriented run listing, not Phase 8 workflow recovery
- adding executable Phase 8 tests in B0 now would force assumptions about future command dispatch, result shapes, or artifact field names that are not yet frozen in the base tree
- B0 therefore publishes report-only expectations now and leaves executable test authorship to the first point where Session A lands stable public seams or Session B can add verification-only coverage against real candidate behavior

## Stable Harness Points Confirmed

Stable enough now:

- `tests/runtime/runtime-cli.integration.test.ts` proves JSON CLI invocation, failure capture, and durable result inspection patterns already exist
- `tests/runtime/helpers/runtime-fixture.ts` already supports:
  - scratch repo fixtures
  - git-backed fixtures with an initial commit
  - fake-clock helpers for interruption or reclaim timing

Not stable enough yet for B0-authored Phase 8 tests on `BASE_SHA`:

- no pinned-tree command-shape contract yet for `cdx init`, `cdx doctor`, or `cdx update`
- no pinned-tree workflow-style `cdx resume` result contract yet
- no pinned-tree artifact publication seam yet for:
  - `init-report.md`
  - `doctor-report.md`
  - `resume-report.md`
  - `update-report.md`
  - `migration-assistant-report.md`

## Acceptance By Area

### `cdx init`

Frozen candidate expectations:

- `package-scan` must classify repo type before any write
- `package-preview` must expose writes, preserved files, conflicts, and blocked actions
- protected writes to root `AGENTS.md` and `.codex/**` require explicit approval
- if repo is not git-backed, preview must say worker-backed workflows require a git repo with an initial commit
- `git init` may happen only by explicit approval
- install must not create an implicit bootstrap commit
- repo may finish install in install-only state until the first commit exists

### `cdx update`

Frozen candidate expectations:

- update scans installed version, release manifest, and import registry before any apply
- preview shows managed-file changes and conflicts before mutation
- safe auto-apply may only affect unchanged managed files
- user-modified managed files require explicit choice before overwrite
- unmanaged repo files are never rewritten by default
- protected updates touching root `AGENTS.md` or `.codex/**` remain preview-first and approval-gated

### `cdx doctor`

Frozen candidate expectations:

- doctor must publish `doctor-report.md`
- missing mandatory tools or unsupported mandatory host capabilities block workflow health with typed diagnostics
- optional capability gaps may degrade only with explicit naming of the degraded mode
- stale lock, broken runtime state, manifest drift, broken install state, missing required `README.md`, resumable-run anomalies, and retained-worktree anomalies must all appear explicitly in the report

### `cdx resume`

Frozen candidate expectations:

- resume lists resumable runs, teams, and pending approvals
- resume recovers checkpoint state, inbox state, and active plan pointer
- stale-worker or stale-claim reclaim is surfaced, not hidden
- retained failed worktrees are inspect-only and never resumed in place
- fresh worktree respawn is acceptable
- audit continuity and checkpoint ids must be preserved
- when workflow semantics require explicit re-entry, resume must emit the next command, not only raw run metadata

### Migration Assistant

Frozen candidate expectations:

- used by `cdx init`, `cdx doctor`, and `cdx update`
- must detect source kit markers and risky customizations
- must recommend next commands instead of silently mutating risky customizations
- must be testable on both fresh and migrated repo fixtures

## Planned Tester Execution Order

1. Verify candidate Phase 8 command shapes and artifact publication against this B0 report.
2. Execute any Phase 8 verification-owned tests already present in the candidate unchanged first.
3. Add verification-only tests only for doc-derived gaps or stable-harness gaps.
4. Validate fresh install, migrated install, doctor diagnostics, resume and reclaim behavior, and update conflict handling before any pass recommendation.

## Blockers And Gaps

- the pinned base does not yet expose stable public Phase 8 workflow entrypoints, so B0 cannot author executable tests now without guessing candidate result shapes
- the docs require host compatibility handling, but the pinned base does not yet define a concrete supported-version manifest or capability-detector API; B0 therefore freezes only externally visible typed blocked or degraded behavior, not implementation internals
- the docs leave `cdx update` auto-merge policy unresolved; B0 freezes the conservative current-doc interpretation that user-modified managed files must stop at preview and explicit choice

## Non-Goals

- no Phase 9 golden, chaos, migration-validation, or release-readiness acceptance
- no implementation proposals for packaging internals beyond what is necessary to freeze verification targets
- no reviewer-style code findings against unseen candidate code

## Unresolved Questions

- none
