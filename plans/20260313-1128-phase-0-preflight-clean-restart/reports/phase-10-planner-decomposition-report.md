# Phase 10 Planner Decomposition Report

**Date**: 2026-03-27
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Status**: completed
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Scope And Sources

Source of truth used:
- accepted Phase 9 final baseline at `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
- current candidate repo tree in `/Users/hieunv/Claude Agent/CodexKit`
- `README.md`
- `package.json`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-completed-clean-synced.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-planner-ready-public-beta-packaging.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-final-baseline-disposition-report.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/workflow-parity-core-spec.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/non-functional-requirements.md`
- `docs/verification-policy.md`
- `docs/control-agent/control-agent-codexkit/verification-policy.md`

Scope guardrails:
- Phase 10 only: public/self-serve CLI productization of the accepted Phase 9 baseline
- do not widen into new workflow capability unless a public install or use blocker strictly requires it
- planner artifact only; no implementation, no session routing prompts, no verification claims
- keep Node/npm distribution only for beta; no native binary packaging lane

## Current Repo-State Read For Decomposition

- the accepted engineering baseline is Phase 9 complete and synced at `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
- repo-local operator workflows already exist for `cdx init`, `cdx doctor`, `cdx resume`, `cdx update`, and the Phase 5-9 workflow surface
- current install and doctor contracts are Phase 8 repo-local contracts, not public package contracts:
  - `packages/codexkit-daemon/src/workflows/init-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/doctor-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/update-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/packaging-contracts.ts`
- the current CLI is not publishable yet:
  - root `package.json` is `"private": true`
  - workspace package manifests are `"private": true`
  - root `cdx` is a repo-local bash wrapper that executes TypeScript source with `node --experimental-strip-types`
  - current build emits `dist/` from `packages/**/*.ts`, but there is no frozen public package artifact contract
- worker launch is still hardcoded to `codex exec`:
  - `packages/codexkit-daemon/src/runner/worker-runtime.ts`
  - `buildDefaultWorkerCommand()` returns `["codex", "exec", ...]`
- `cdx doctor` currently probes only `codex --version`; wrapped runners such as `codex-safe` are not part of a frozen public contract yet
- Phase 8 and Phase 9 tests already prove repo-local packaging and migration behavior, but they execute the workspace-local `./cdx` script rather than an installable tarball or registry package:
  - `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`

## Minimum Public-Beta Target UX

### Distribution And Install Shape

- public beta should ship one npm package that exposes the `cdx` bin
- support both `npx` and global npm install from the same artifact
- `npx` is the canonical beta quickstart and the primary acceptance path
- global install is a supported convenience path, not a separate packaging lane
- do not add a second binary-style distribution channel in Phase 10

Recommended shell forms:
- `npx @codexkit/cli init`
- `npx @codexkit/cli doctor`
- `npm install -g @codexkit/cli`
- `cdx init`
- `cdx doctor`

Rationale:
- `npx` removes install friction for first-time public-beta users
- global install comes almost for free once one publishable npm artifact exists
- a second packaging format would widen Phase 10 beyond install/use viability

### Binary And Runner Contract

Frozen beta contract:
- the public package owns the `cdx` bin only
- the default worker transport remains `codex exec --input-file <...> --context-file <...>`
- CodexKit does not own Codex account login state; it binds to whatever account/session the selected runner already uses

Runner resolution order for beta:
1. explicit environment override for the current shell or CI job
2. persisted repo-local runner config in `.codexkit/config.toml`
3. default built-in runner command: `codex exec`

Runner policy decision:
- beta should be config-driven with env override
- do not add a wizard-driven runner chooser in Phase 10
- `cdx init` preview may show the detected default and the persisted target runner, but the workflow should stay preview/apply, not become a setup wizard

Wrapper contract:
- environments using wrappers such as `codex-safe` must be able to set the runner command and fixed args without patching product code
- `cdx doctor` must report which runner source is active:
  - env override
  - `.codexkit/config.toml`
  - default `codex exec`
- `cdx doctor` must validate the configured runner path enough to fail early with a typed diagnostic instead of falling through to later worker-launch failure

### First-Run Init And Doctor Flow

`cdx init` beta contract:
- preview-first remains the default behavior
- preview must show:
  - repo classification
  - planned writes
  - preserved files
  - conflicts
  - protected-path approvals
  - runner choice that would be persisted or used
  - install-only gating if the repo lacks an initial commit
- apply must require the matching preview fingerprint before mutation
- apply must not create an implicit first commit

`cdx doctor` beta minimum:
- verify Node, git, `git worktree`, and chosen runner availability
- verify repo git state and first-commit gate
- verify install-state and manifest consistency
- verify the active runner source and command
- emit typed diagnostics with one concrete next command
- explicitly distinguish:
  - healthy
  - degraded
  - blocked

### Minimum Quickstart Path

Public-beta quickstart must be short enough for a user who does not know the internals:

1. install with `npx` or global npm install
2. run `cdx init` preview
3. run `cdx init --apply ...` after approvals
4. create the first commit if the repo is install-only
5. run `cdx doctor`
6. run `cdx brainstorm <task>`
7. continue to `cdx plan <task>` or brainstorm handoff
8. run `cdx cook <absolute-plan-path>`

The docs must show one fully spelled example with exact commands, not only abstract command names.

### Acceptance Smoke Verification

Beta acceptance must cover four public-user entry cases:

- fresh repo:
  - install package
  - run `cdx init` preview and apply
  - verify install-only gating and `cdx doctor`
- git-backed repo:
  - install package
  - run `cdx init`
  - run `cdx doctor`
  - execute the minimum `brainstorm -> plan -> cook` smoke path
- install-only repo:
  - prove worker-backed workflows remain blocked until first commit exists
- wrapped runner environment:
  - configure wrapper such as `codex-safe`
  - run `cdx doctor`
  - prove worker launch path resolves through the wrapper contract

## Decomposition: Owned Slices

## Slice P10-S0: Shared Public Package And Runner Contract Freeze

- ownership: freeze the public npm artifact shape, `cdx` bin contract, runner resolution order, public-beta smoke matrix, and the docs contract that all later slices rely on
- must change:
  - `package.json`
  - `packages/codexkit-cli/package.json`
  - `packages/codexkit-daemon/src/runner/worker-runtime.ts`
  - `packages/codexkit-daemon/src/runtime-config.ts`
  - `packages/codexkit-daemon/src/workflows/packaging-contracts.ts`
  - docs that define the public install and runner contract
- outputs:
  - one frozen public npm package contract for the `cdx` bin
  - decision that beta supports both `npx` and global install, with `npx` first
  - frozen runner resolution order:
    - env override
    - `.codexkit/config.toml`
    - default `codex exec`
  - frozen rule that account binding stays outside CodexKit and belongs to the chosen runner
  - frozen acceptance matrix for:
    - fresh repo
    - git-backed repo
    - install-only repo
    - wrapped runner repo
- why first:
  - every other Phase 10 slice depends on these contracts
  - without this freeze, docs, packaging, and smoke harness work will drift

## Slice P10-S1: Publishable Npm Artifact And Bin Packaging

- ownership: convert the repo-local CLI into one installable npm artifact usable by `npx` and `npm install -g`
- must change:
  - root `package.json`
  - workspace package manifests under `packages/`
  - build and bin entrypoint wiring
  - root `cdx` shim or its replacement
  - any packaging metadata needed for `npm pack` and publish
- outputs:
  - installable npm artifact exposing `cdx`
  - no dependency on the source checkout layout
  - no dependency on `node --experimental-strip-types` at runtime
  - local tarball smoke path such as `npm pack` for pre-publish validation
  - one artifact that supports both:
    - `npx @codexkit/cli ...`
    - `npm install -g @codexkit/cli`
- seam decisions:
  - keep Phase 10 to one publishable package, not a public multi-package workspace rollout
  - internal packages may stay implementation detail as long as the installable artifact is self-contained

## Slice P10-S2: Runner Resolution, Wrapper Support, And Doctor Hardening

- ownership: remove the hardcoded public dependency on bare `codex`, define wrapper-safe runner resolution, and extend `cdx doctor` to diagnose it
- must change:
  - `packages/codexkit-daemon/src/runner/worker-runtime.ts`
  - `packages/codexkit-daemon/src/runtime-config.ts`
  - `packages/codexkit-daemon/src/workflows/doctor-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/init-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/update-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/phase8-managed-content.ts`
  - runner-related docs
- outputs:
  - configurable runner command plus args
  - persisted runner config in `.codexkit/config.toml`
  - env override path for temporary shells and CI
  - typed diagnostics when the chosen runner is missing or incompatible
  - explicit wrapped-runner coverage for `codex-safe`-style environments
- beta constraint:
  - no wizard-driven account binding flow
  - no new auth subsystem
  - only runner location, invocation, and diagnostics hardening

## Slice P10-S3: Onboarding UX, README, And Quickstart Path

- ownership: make Phase 8 onboarding legible to outside users who do not know the repo internals
- must change:
  - `README.md`
  - dedicated quickstart docs under `docs/`
  - `packages/codexkit-daemon/src/workflows/phase8-managed-content.ts`
  - `packages/codexkit-daemon/src/workflows/init-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/doctor-workflow.ts`
  - optional CLI render/help text if the current output is too repo-internal
- outputs:
  - README install section with:
    - `npx`-first path
    - global install alternative
    - prerequisites
    - first-run commands
  - dedicated quickstart doc with one exact successful path from init to `brainstorm -> plan -> cook`
  - docs for wrapped-runner setup with one concrete `codex-safe` example
  - next-step text in `init-report.md` and `doctor-report.md` aligned to public docs, not only internal continuation habits
- public-beta minimum:
  - a user must be able to copy commands from README or the quickstart doc and reach a first runnable workflow without tribal knowledge

## Slice P10-S4: Public-Beta Smoke Harness And Release Gate

- ownership: verify the packaged artifact, not the workspace-local checkout, against the public-beta entry matrix
- must change:
  - runtime smoke tests under `tests/runtime/`
  - shared fixture helpers under `tests/runtime/helpers/`
  - release/readiness evidence collation if needed
- outputs:
  - tarball or packed-artifact smoke tests that install or execute the package the way a public user would
  - acceptance coverage for:
    - fresh repo install and doctor
    - git-backed repo install and quickstart workflow
    - install-only gating
    - wrapped-runner path
  - explicit evidence that Phase 9 repo-local guarantees still hold through the packaged artifact
  - public-beta go or no-go report based on packaged-artifact results
- rule:
  - a repo-local `./cdx` pass is not enough for Phase 10 acceptance
  - the acceptance harness must execute the packaged artifact path directly

## Shared Files, Shared Contracts, And Packaging Seams

Highest-conflict shared files:
- `package.json`
- `tsconfig.build.json`
- `cdx`
- `packages/codexkit-cli/package.json`
- `packages/codexkit-cli/src/index.ts`
- `packages/codexkit-daemon/src/runtime-config.ts`
- `packages/codexkit-daemon/src/runner/worker-runtime.ts`
- `packages/codexkit-daemon/src/workflows/packaging-contracts.ts`
- `packages/codexkit-daemon/src/workflows/init-workflow.ts`
- `packages/codexkit-daemon/src/workflows/doctor-workflow.ts`
- `packages/codexkit-daemon/src/workflows/update-workflow.ts`
- `packages/codexkit-daemon/src/workflows/phase8-managed-content.ts`
- `README.md`
- new quickstart docs under `docs/`
- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`
- new packaged-artifact smoke tests

Shared contracts that must stay single-sourced:
- npm package name and `cdx` bin shape
- runner resolution order and config schema
- the exact preview/apply contract for `cdx init`
- `cdx doctor` typed-diagnostic contract for host, repo, and runner gaps
- quickstart command forms shown in docs
- install-only gating rules

Packaging seams that must be handled explicitly:
- repo-local bash wrapper versus published bin
- source-tree TypeScript execution versus compiled distributable output
- private workspace manifests versus one public artifact
- hardcoded `codex exec` versus configurable runner invocation
- repo-local runtime tests versus packaged-artifact smoke tests

## Sequential Vs Parallel Plan

Must stay sequential:

1. `P10-S0` before every other slice.
   Reason: package name, bin shape, runner contract, and smoke matrix are the shared contract freeze.
2. `P10-S1` before any outside-user package test.
   Reason: no self-serve user can test a private repo-local wrapper.
3. `P10-S2` before wrapped-runner or account-binding claims.
   Reason: current baseline hardcodes bare `codex`.
4. `P10-S1` plus `P10-S2` before `P10-S4`.
   Reason: the acceptance harness must target the real packaged artifact with the real runner contract.

Can run in parallel after `P10-S0`:

- `P10-S1` and `P10-S2` can run in parallel if ownership stays split between:
  - package/build/bin files
  - runtime runner/doctor/init files
- `P10-S3` can start after `P10-S0` once the public package name, runner resolution order, and quickstart contract are frozen
- late `P10-S3` doc polishing can overlap with `P10-S4`, but the exact commands and screenshots or transcripts must not drift after smoke results are captured

Condensed dependency graph:

- `S0 -> S1,S2,S3`
- `S1 + S2 -> S4`
- `S3` must be complete before outside-user self-serve testing is invited publicly

## What Must Land Before Any Outside User Can Test The Public Package

Minimum must-land set:

- `P10-S0` shared contract freeze
- `P10-S1` publishable npm artifact with `cdx`
- `P10-S2` runner resolution and doctor diagnostics
- `P10-S3` README plus quickstart docs with exact commands

Meaning:
- without `S1`, there is no artifact a user can install
- without `S2`, wrapped or non-default runner environments are undefined and doctor is incomplete
- without `S3`, the package is not self-serve for a user who does not know the internals

Before calling the result a public-beta candidate, `P10-S4` must also pass.

## Recommended Immediate Next Execution Shape

- first implementation wave should start with `P10-S0`
- after `P10-S0` lands, split ownership into:
  - packaging lane: `P10-S1`
  - runtime runner lane: `P10-S2`
  - docs/onboarding lane: `P10-S3`
- hold `P10-S4` until `P10-S1` and `P10-S2` stabilize enough that the packaged artifact and runner contract are real, not provisional

## Unresolved Questions

- if npm publishing ownership blocks the existing scoped name `@codexkit/cli`, freeze the final public package name in `P10-S0` before any implementation starts
