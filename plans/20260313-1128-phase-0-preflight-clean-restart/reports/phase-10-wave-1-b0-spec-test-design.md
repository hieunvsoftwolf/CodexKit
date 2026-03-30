# Phase 10 Wave 1 B0 Spec-Test-Design

**Date**: 2026-03-27
**Status**: completed
**Role/Modal Used**: spec-test-designer / default planning modal
**Model Used**: GPT-5 / Codex
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Provenance

Source of truth used:
- accepted Phase 9 baseline at `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
- current candidate repo tree in `/Users/hieunv/Claude Agent/CodexKit`
- `README.md`
- `package.json`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-wave-1-ready-after-planner.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-completed-clean-synced.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/non-functional-requirements.md`
- `docs/verification-policy.md`

Pinned-tree seams inspected to assess verification stability only:
- root `package.json`
- root `cdx`
- `packages/codexkit-cli/package.json`
- `packages/codexkit-daemon/src/runtime-config.ts`
- `packages/codexkit-daemon/src/runner/worker-runtime.ts`
- `packages/codexkit-daemon/src/workflows/packaging-contracts.ts`
- `packages/codexkit-daemon/src/workflows/init-workflow.ts`
- `packages/codexkit-daemon/src/workflows/doctor-workflow.ts`
- `packages/codexkit-daemon/src/workflows/phase8-managed-content.ts`
- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
- `tests/runtime/runtime-worker-runtime.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`
- `tests/runtime/helpers/runtime-fixture.ts`

Excluded by design:
- candidate implementation branches or diffs
- implementation summaries
- reviewer output
- tester output
- any acceptance weakening derived from current implementation limitations

## Summary

- froze `P10-S0` only
- froze the shared public package contract all later Phase 10 slices must honor
- defined verification checks for:
  - one public npm artifact shape and `cdx` bin contract
  - runner resolution precedence
  - `cdx doctor` runner-source and runner-availability diagnostics
  - `cdx init` preview/apply surfacing of runner choice and install-only gating
  - exact public install and quickstart command forms
  - the later packaged-artifact smoke matrix for `P10-S4`
- added no verification-owned tests in B0 because the current stable harness is still repo-local `./cdx`, not a packed npm artifact or stable runner-config seam

## Scope Guardrail

This B0 artifact freezes the shared contract only.

It does not freeze:
- the exact package build wiring for `P10-S1`
- the exact env var names or TOML keys for `P10-S2`
- doc layout or wording beyond exact public command forms for `P10-S3`
- the concrete `P10-S4` harness implementation beyond the required matrix and acceptance targets below

## P10-S0 Acceptance Freeze

Phase 10 Wave 1 shared-contract acceptance passes only if all of these remain true:

- beta ships exactly one public npm artifact
- that artifact owns the public `cdx` bin contract
- the same artifact supports both `npx` use and global npm install
- the public beta remains Node/npm only; no second binary or installer channel is part of Phase 10 acceptance
- runner resolution order is exactly:
  1. env override
  2. `.codexkit/config.toml`
  3. default built-in `codex exec`
- runner override/config must be able to express wrapper commands plus fixed args without product-code patching
- runner account/login state stays outside CodexKit and belongs to the selected runner
- `cdx doctor` must surface both active runner source and effective runner command
- `cdx doctor` must fail early with typed diagnostics when the selected runner is unavailable or incompatible
- `cdx init` remains preview-first and must surface the runner choice and install-only gate before mutation
- `cdx init --apply` requires a matching preview and must not create an implicit first commit
- public docs must show exact install and quickstart commands using the frozen package and `cdx` forms
- later `P10-S4` acceptance must execute the packaged artifact directly; repo-local `./cdx` is supporting evidence only, never primary acceptance

## Contract Checks

### 1. Public Npm Artifact Shape And `cdx` Bin Contract

Frozen acceptance target:

- one publishable npm package is the public beta surface
- current frozen package name is `@codexkit/cli`
- that package exposes the public `cdx` bin
- public install paths supported by the same artifact:
  - `npx @codexkit/cli <command>`
  - `npm install -g @codexkit/cli`
  - `cdx <command>` after global install
- packaged execution must not depend on:
  - the source checkout layout
  - the root repo-local `./cdx` wrapper
  - `node --experimental-strip-types` at runtime
- internal workspace packages may remain implementation detail; public acceptance cares only about the single installable artifact and `cdx` bin behavior

Later verification checks:

- packed artifact metadata resolves to exactly one public package and one public bin name: `cdx`
- packed artifact contains a runnable compiled entrypoint for the bin
- `npx @codexkit/cli init` and globally installed `cdx init` enter the same product surface
- `npx @codexkit/cli doctor` and globally installed `cdx doctor` enter the same product surface
- no public quickstart path requires the repo-local wrapper or a cloned source tree

Freeze note:

- if npm ownership blocks `@codexkit/cli`, downstream work must stop and the control state must be refreshed before `P10-S1` starts
- a silent rename later is not allowed; it would invalidate the exact docs and smoke-command contract frozen here

### 2. Runner Resolution Order

Frozen acceptance target:

- runner precedence is exact:
  1. explicit env override for the current shell or CI job
  2. persisted repo-local runner config in `.codexkit/config.toml`
  3. default built-in runner command `codex exec`
- env override must beat repo config every time
- repo config must beat the built-in default every time
- both env override and repo config must be able to represent:
  - alternate runner binary or wrapper
  - fixed runner args
- wrapper use such as `codex-safe` is a supported contract path
- account binding or login state belongs to the selected runner, not to CodexKit

Not frozen here:

- exact env variable names
- exact TOML key names
- internal parsing helpers or data structures

Later verification checks:

- with env override present and repo config also present, effective runner source is `env override`
- with no env override and repo config present, effective runner source is `.codexkit/config.toml`
- with neither override present, effective runner source is default built-in `codex exec`
- effective worker launch path honors the chosen wrapper command and fixed args
- no path silently falls back from an invalid override/config to bare `codex exec`

### 3. `cdx doctor` Diagnostics For Runner Source And Availability

Frozen acceptance target:

- `cdx doctor` status taxonomy remains:
  - `healthy`
  - `degraded`
  - `blocked`
- `cdx doctor` must verify:
  - Node
  - git
  - `git worktree`
  - repo git state and first-commit gate
  - install-state and manifest consistency
  - chosen runner availability
- `cdx doctor` must report:
  - active runner source
  - effective runner command
  - availability result for that runner
- runner failures must be typed diagnostics with:
  - stable code or category
  - plain-language cause
  - blocking path/tool when relevant
  - one concrete next command or next step

Later verification checks:

- env-selected runner appears as the active runner source even when repo config exists
- config-selected runner appears as the active runner source when no env override exists
- default built-in `codex exec` appears as the active runner source only when no higher-precedence source exists
- missing or broken chosen runner yields `blocked`, not silent fallback
- valid chosen wrapper runner yields non-blocked runner diagnostics
- doctor output stays consistent with the runner choice shown by `cdx init`

### 4. `cdx init` Preview/Apply Contract

Frozen acceptance target:

- preview-first remains default
- preview must surface:
  - repo classification
  - planned writes
  - preserved files
  - conflicts
  - protected-path approvals
  - runner choice that would be used or persisted
  - install-only gating when the repo lacks an initial commit
- apply must require a matching preview fingerprint before mutation
- apply must not create an implicit first commit
- if the repo is still install-only after apply, worker-backed workflows remain blocked until the first commit exists
- runner choice surfaced in preview must match the same precedence contract later used by doctor and worker launch

Later verification checks:

- preview output/report contains runner choice and runner source
- preview output/report contains install-only gating when applicable
- apply without a matching preview remains blocked
- apply can complete while the repo remains install-only
- install-only state is explicit, durable, and later visible to `cdx doctor`
- no implicit bootstrap commit is created in fresh or install-only repos

### 5. Public Docs Contract For Install And Quickstart Command Forms

Frozen exact public install forms:

- `npx @codexkit/cli init`
- `npx @codexkit/cli doctor`
- `npm install -g @codexkit/cli`
- `cdx init`
- `cdx doctor`

Frozen quickstart command-form requirements:

- docs must present `npx` as the canonical beta-first path
- docs must present global install as a supported convenience path, not a separate product lane
- docs must include one fully spelled quickstart using exact public command forms from install through first workflow entry
- that quickstart must include:
  - init preview
  - init apply
  - doctor
  - one first workflow step into `brainstorm`
  - continuation to `plan` or explicit brainstorm handoff
  - `cdx cook /absolute/path/to/plan.md`
- docs must include explicit install-only guidance that the user must create the first commit before worker-backed workflows

Allowed documentation flexibility:

- README and quickstart-doc placement may vary
- exact prose may vary
- the example task text may vary
- the concrete first-commit git command may vary by repo

Not allowed:

- abstract command names without copyable shell forms
- docs that only show repo-local `./cdx`
- docs that omit either `npx` or global install support

## Packaged-Artifact Smoke Matrix Definition For Later `P10-S4`

`P10-S4` must execute the packaged artifact directly.

Required matrix:

| Matrix id | Fixture | Install path | Required commands | Frozen acceptance targets |
|---|---|---|---|---|
| `M1` | fresh repo | `npx` | `npx @codexkit/cli init`; `npx @codexkit/cli init --apply` when approvals are satisfied; `npx @codexkit/cli doctor` | proves packaged artifact works in a repo with no prior git history, init surfaces fresh/install-only state, apply does not create a first commit, doctor surfaces the blocked or degraded first-commit next step |
| `M2` | git-backed repo | global install | `npm install -g @codexkit/cli`; `cdx init`; `cdx init --apply`; `cdx doctor`; minimum `brainstorm -> plan -> cook` smoke path | proves the public bin works outside the source checkout, the package is self-serve on a normal repo, and the quickstart path remains runnable from the packaged artifact |
| `M3` | install-only repo | either supported install path | `cdx init`; `cdx init --apply`; `cdx doctor`; at least one representative worker-backed workflow entry | proves install-only state remains explicit after apply and worker-backed workflows stay blocked with typed diagnostics until the first commit exists |
| `M4` | wrapped-runner repo | whichever supported install path is not yet exercised by the chosen matrix implementation | `cdx doctor`; one representative worker-backed workflow using wrapper configuration | proves wrapper-safe runner selection, doctor runner-source reporting, and actual worker launch through the selected wrapper contract |

Matrix-wide rules:

- across `M1` through `M4`, both supported install paths must be exercised at least once:
  - `npx`
  - global install plus `cdx`
- repo-local `./cdx` execution is not an acceptable substitute for any matrix row
- runner assertions must validate the effective selected source, not only command success
- install-only assertions must validate typed blocking behavior, not just missing success

## NFR Mapping

| Frozen contract area | Primary NFRs |
|---|---|
| typed runner and package diagnostics | `NFR-3.3`, `NFR-8.2`, `NFR-8.3` |
| preview/apply surfacing and non-destructive install behavior | `NFR-4.2`, `NFR-4.3`, `NFR-4.4` |
| install-only gating | `NFR-4.5`, `NFR-4.6` |
| repo fixture matrix and public package smoke coverage | `NFR-4.1` |
| durable doctor/init evidence | `NFR-5.2` |

## Stable Harness Assessment

Stable pinned-base harness points that exist today:

- repo-local CLI/runtime integration via `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
- runner runtime coverage via `tests/runtime/runtime-worker-runtime.integration.test.ts`
- validation/report placement seams via `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts`
- migration fixture patterns via `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`

Why they are not sufficient for B0-owned executable tests now:

- current CLI tests execute the root repo-local `./cdx` wrapper, not a packed npm artifact
- current root `package.json` and `packages/codexkit-cli/package.json` are still `private`
- current root `cdx` depends on `node --experimental-strip-types` and source-tree paths
- current runner contract in code is still hardcoded to bare `codex exec`
- current `.codexkit/config.toml` is managed content only; no stable public runner-config resolution seam exists yet
- no existing helper installs a tarball or executes `npx @codexkit/cli ...` against a packed artifact

Conclusion:

- no verification-owned tests added in this B0 session
- executable verification for this contract belongs after `P10-S1` and `P10-S2` create a real packaged-artifact and runner-resolution surface

## Verification-Owned Tests Added

- none

Reason:

- adding repo-local tests now would overfit the old wrapper path and risk false acceptance for the wrong public surface

## Planned Tester Execution Order

When `P10-S1` and `P10-S2` exist, Session B or later `P10-S4` verification should execute in this order:

1. inspect the packed artifact shape first
2. execute `M1` through `M4` against the packaged artifact, not the repo-local wrapper
3. run any retained Phase 8/9 repo-local regression subset only as supporting evidence that Phase 10 did not regress accepted baseline behavior

Suggested command families for later verification:

- `npm pack`
- temp-dir install via `npx` or `npm install -g` against the packed artifact
- targeted runtime smoke commands for `init`, `doctor`, and one minimal workflow path

These commands are design guidance only here.
They are not executable B0-owned tests yet.

## Non-Goals

- no freeze of full `P10-S1` packaging internals
- no freeze of exact runner env-var or TOML key names
- no freeze of the exact future smoke harness file layout
- no product-code edits
- no acceptance claim for full Phase 10

## Blockers And Gaps

- package name ownership for `@codexkit/cli` is still an explicit blocker risk; if blocked, control must refresh `P10-S0` before downstream implementation
- the current stable harness has no packed-artifact execution seam yet
- the current pinned base has no implemented runner-resolution/config seam yet, so B0 can freeze behavior only, not executable verification

## Unresolved Questions

- whether `@codexkit/cli` is publishable under the intended npm ownership
