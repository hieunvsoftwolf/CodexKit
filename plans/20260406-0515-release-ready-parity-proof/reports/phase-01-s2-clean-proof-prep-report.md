# Phase 01 S2 Clean-Proof Prep Report

Date: 2026-04-06
Session: S2
Status: completed
Role/modal used: planner / reasoning
Model used: Codex / GPT-5
Plan: `plans/20260406-0515-release-ready-parity-proof/plan.md`
Phase: `Phase 01 Current-Head Release-Ready Parity Proof`
Pinned BASE_SHA: `308867621e6c3d77746302b08a624445f7b84213`

## Source Of Truth Read

- `README.md`
- `plans/20260406-0515-release-ready-parity-proof/plan.md`
- `plans/20260406-0515-release-ready-parity-proof/phase-01-current-head-release-ready-parity-proof.md`
- `plans/20260406-0515-release-ready-parity-proof/reports/phase-01-s1-planner-decomposition-report.md`
- `plans/20260406-0515-release-ready-parity-proof/reports/control-state-release-ready-parity-proof-clean-proof-prep-ready-after-s1-20260406-060047.md`
- `plans/20260406-0515-release-ready-parity-proof/reports/control-state-release-ready-parity-proof-s2-routed-20260406-060530.md`
- `docs/control-agent/control-agent-codexkit/verification-policy.md`
- `docs/control-agent/control-agent-codexkit/phase-guide.md`
- `docs/control-agent/control-agent-codexkit/plan-contract.md`
- `docs/non-functional-requirements.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s35-closeout-test-report.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s37-drift-disposition-report.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s38-report-disposition-report.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s39-lead-verdict.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-completed-clean-synced.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-passed.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s4-third-remediation-session-b-tester-report-20260330-s60.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s4-third-remediation-session-d-lead-verdict-20260330-s62.md`
- `tests/runtime/helpers/phase9-evidence.ts`
- `tests/runtime/helpers/runtime-fixture.ts`
- `tests/runtime/helpers/phase10-packaged-artifact-smoke.ts`
- `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts`
- `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts`

## Decision

- Phase 01 may proceed as `verification-only` after this prep.
- A fresh code-changing or remediation lane is not justified.
- The next runnable lane is a tester-only current-plan proof regeneration lane on a fresh worktree from `BASE_SHA`.

Reason:
- accepted current-head runtime evidence already exists at `308867621e6c3d77746302b08a624445f7b84213` through Phase 04 `S35/S39`
- no fresh contradictory evidence reopens accepted product behavior
- remaining gaps are proof-publication and proof-disposition gaps, not implementation gaps

## Reuse Matrix

### Direct Reuse From Accepted Current-Head Phase 04 Evidence

These may be cited directly in Phase 01 without rerun:

- `npm install --no-audit --no-fund` green evidence from `phase-04-s35-closeout-test-report.md`
- `npm run build` green evidence from `phase-04-s35-closeout-test-report.md`
- `npm run typecheck` green evidence from `phase-04-s35-closeout-test-report.md`
- `npm run test:runtime` green evidence from `phase-04-s35-closeout-test-report.md`
- cleanup/disposition proof from `phase-04-s37-drift-disposition-report.md`, `phase-04-s38-report-disposition-report.md`, and `phase-04-s39-lead-verdict.md`

Disposition:
- reuse by citation only
- do not recopy or mutate Phase 04 reports
- treat their raw logs as accepted historical-current-head evidence, not current-plan-owned regenerated artifacts

### Proof Families That Must Be Rerun

These must be rerun on the fresh Phase 01 verification surface:

- `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts`
- `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts`

Reason:
- the root `.tmp/validation-*.json` and `.tmp/phase-9-release-readiness-metrics.json` currently present on root are foreign-base artifacts tied to `8a7195c2a98253dd1060f9680b422b75d139068d` and are not acceptable for current-head proof
- `tests/runtime/helpers/phase9-evidence.ts` still writes raw outputs into `.tmp/**` and still synthesizes `release-readiness-report.md` into the historical Phase 0-10 plan path inside the executing worktree
- Phase 04 preserved command-level green evidence, but did not durably publish Phase 01-owned copies of the Phase 9 bundles, host manifest, release-readiness report, or packaged-artifact proof artifacts
- the historical narrow Phase 10 verdict is on base `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`, so it remains scope context only, not current-head proof

## Frozen Clean-Proof Execution Contract

### Authoritative Verification Surface

- root control surface: `/Users/hieunv/Claude Agent/CodexKit`
- root role: read-only control surface for plan docs, report persistence, and raw log persistence only
- authoritative verification worktree branch: `release-ready-phase01-s3-verification-only`
- authoritative verification worktree path: `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only`
- exact worktree creation command:
  - `git worktree add -b release-ready-phase01-s3-verification-only '/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only' 308867621e6c3d77746302b08a624445f7b84213`

### Frozen Command Sequence

Commands must run in this order:

1. `mkdir -p '/Users/hieunv/Claude Agent/CodexKit/plans/20260406-0515-release-ready-parity-proof/reports/logs/s3'`
2. `git worktree add -b release-ready-phase01-s3-verification-only '/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only' 308867621e6c3d77746302b08a624445f7b84213`
3. `cd '/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only'`
4. `git rev-parse HEAD`
5. `git status --short`
6. `npm_config_cache="$PWD/.npm-cache" npm install --no-audit --no-fund`
7. `npm_config_cache="$PWD/.npm-cache" npm run build`
8. `npm_config_cache="$PWD/.npm-cache" npm run typecheck`
9. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts --no-file-parallelism`
10. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism`
11. copy accepted proof outputs into current-plan-owned destinations frozen below
12. `git status --short`

### Frozen Host Constraints

- preserve `npm_config_cache="$PWD/.npm-cache"` on npm and `npx` surfaces
- preserve `TMPDIR=.tmp` on Vitest surfaces
- do not use root `main` as the execution surface
- do not treat raw root `.tmp/**` evidence as authoritative current-head proof

## Raw Log Contract

Raw logs for the verification-only lane must be persisted on the root control surface under:

- `plans/20260406-0515-release-ready-parity-proof/reports/logs/s3/`

Required filenames:

- `01-git-worktree-add.log`
- `02-git-rev-parse-head.log`
- `03-git-status-short-pre.log`
- `04-npm-install.log`
- `05-npm-build.log`
- `06-npm-typecheck.log`
- `07-vitest-phase9-proof.log`
- `08-vitest-phase10-packaged-artifact.log`
- `09-disposition-proof.log`
- `10-git-status-short-post.log`

Disposition rule:
- command logs are authoritative only when preserved under the root current-plan logs path above
- worktree-local raw logs or terminal scrollback are non-authoritative unless copied there

## Current-Plan-Owned Artifact Destinations

### Release-Readiness Report

- authoritative destination:
  - `plans/20260406-0515-release-ready-parity-proof/reports/release-readiness-report.md`
- disposition source:
  - `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md`
- rule:
  - copy into the current plan path after the Phase 9 synthesis test passes
  - do not treat the historical-path source file as authoritative after copy

### Host Manifest

- authoritative destination:
  - `plans/20260406-0515-release-ready-parity-proof/reports/host-manifest.json`
- canonical source:
  - the `hostManifest` object embedded in `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/validation-migration-evidence.json`
- rule:
  - extract once after accepted Phase 9 proof generation
  - the copied JSON becomes the current-plan-owned host manifest for the release bundle

### Copied Phase 9 Evidence Bundles

Authoritative destinations:

- `plans/20260406-0515-release-ready-parity-proof/reports/phase9-evidence/validation-golden-evidence.json`
- `plans/20260406-0515-release-ready-parity-proof/reports/phase9-evidence/validation-chaos-evidence.json`
- `plans/20260406-0515-release-ready-parity-proof/reports/phase9-evidence/validation-migration-evidence.json`
- `plans/20260406-0515-release-ready-parity-proof/reports/phase9-evidence/phase-9-release-readiness-metrics.json`

Disposition sources:

- `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/validation-golden-evidence.json`
- `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/validation-chaos-evidence.json`
- `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/validation-migration-evidence.json`
- `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase-9-release-readiness-metrics.json`

Rule:
- copy only after the generating command passes
- preserve filenames exactly
- copied files become current-plan-owned proof; worktree `.tmp/**` originals remain verification-owned raw evidence

### Copied Packaged-Artifact Proof Artifacts

Authoritative destination root:

- `plans/20260406-0515-release-ready-parity-proof/reports/packaged-artifact/`

Minimum required copied artifacts:

- `plans/20260406-0515-release-ready-parity-proof/reports/packaged-artifact/phase10-packaged-artifact-smoke.log`
- every harness-generated `init-report.md` and `doctor-report.md` referenced by the packaged-artifact smoke run, copied into the same directory with unique prefixed filenames

Rule:
- the packaged-artifact raw command log is mandatory
- fixture-local packaged reports are optional only when the smoke run did not generate them; otherwise copy them
- temp fixture dirs, tarballs, installed bins, and wrapper bins remain verification-owned unless explicitly copied into this directory

## Disposition Rules

- accepted Phase 04 reports stay where they are and are cited directly; Phase 01 does not rewrite them
- any file produced under the verification worktree historical Phase 0-10 path or `.tmp/**` is verification input only until copied into the current plan destinations frozen above
- if a required Phase 9 or Phase 10 command fails, do not copy partial outputs into current-plan-owned destinations
- if post-run `git status --short` shows only known harness-side-effect files under worktree `.tmp/**` or historical report paths, classify them as verification-owned churn; do not treat that as product regression by itself
- do not reopen accepted product behavior without contradictory current-head evidence from the fresh S3 run

## Proof Artifacts That Remain Verification-Owned

- `tests/runtime/helpers/phase9-evidence.ts`
- `tests/runtime/helpers/phase10-packaged-artifact-smoke.ts`
- `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts`
- `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts`
- `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/**`
- `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md`
- any worktree-local temp fixture directories, packed tarballs, installed bins, wrapper-bin dirs, and `node_modules` created by the packaged-artifact smoke run unless copied into the current-plan destination

## Ready-Now Tester Card

### `S3`

- Role expected: `tester`
- Skills: `none required`
- Suggested model: `gpt-5.3-codex / medium`
- Fallback model: `closest codex-capable tester model / medium`
- Ready-now status: `yes`
- Run mode: `coding`
- Root main usage: read-only control surface only; report/log persistence allowed; no production code edits
- Depends on: `Phase 01 S2 clean-proof prep`

Full prompt:

```text
You are tester for CodexKit.

Skills: none required
Session role expected: tester
Run mode: coding
Root main usage: read-only control surface only; report/log persistence allowed
Do not change production code.
Do not edit test contracts unless the prompt explicitly allows it.

Source of truth:
- current repo tree
- plans/20260406-0515-release-ready-parity-proof/plan.md
- plans/20260406-0515-release-ready-parity-proof/phase-01-current-head-release-ready-parity-proof.md
- plans/20260406-0515-release-ready-parity-proof/reports/phase-01-s2-clean-proof-prep-report.md
- plans/20260406-0515-release-ready-parity-proof/reports/control-state-release-ready-parity-proof-verification-only-ready-after-s2-20260406-061036.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/phase-guide.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/non-functional-requirements.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s35-closeout-test-report.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s39-lead-verdict.md
- tests/runtime/helpers/phase9-evidence.ts
- tests/runtime/helpers/phase10-packaged-artifact-smoke.ts
- tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts
- tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts
- tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts
- tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts
- tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts

Pinned BASE_SHA:
- 308867621e6c3d77746302b08a624445f7b84213

Execution contract to follow exactly:
- create worktree:
  - git worktree add -b release-ready-phase01-s3-verification-only '/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only' 308867621e6c3d77746302b08a624445f7b84213
- raw logs root:
  - /Users/hieunv/Claude Agent/CodexKit/plans/20260406-0515-release-ready-parity-proof/reports/logs/s3
- command order:
  1. git worktree add ...
  2. cd '/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only'
  3. git rev-parse HEAD
  4. git status --short
  5. npm_config_cache="$PWD/.npm-cache" npm install --no-audit --no-fund
  6. npm_config_cache="$PWD/.npm-cache" npm run build
  7. npm_config_cache="$PWD/.npm-cache" npm run typecheck
  8. npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts --no-file-parallelism
  9. npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism
  10. copy accepted proof outputs into current-plan-owned destinations
  11. git status --short

Current-plan-owned destinations:
- release readiness report:
  - plans/20260406-0515-release-ready-parity-proof/reports/release-readiness-report.md
- host manifest:
  - plans/20260406-0515-release-ready-parity-proof/reports/host-manifest.json
- phase 9 evidence:
  - plans/20260406-0515-release-ready-parity-proof/reports/phase9-evidence/validation-golden-evidence.json
  - plans/20260406-0515-release-ready-parity-proof/reports/phase9-evidence/validation-chaos-evidence.json
  - plans/20260406-0515-release-ready-parity-proof/reports/phase9-evidence/validation-migration-evidence.json
  - plans/20260406-0515-release-ready-parity-proof/reports/phase9-evidence/phase-9-release-readiness-metrics.json
- packaged artifact proof:
  - plans/20260406-0515-release-ready-parity-proof/reports/packaged-artifact/

Reuse rules:
- cite Phase 04 accepted build/typecheck/full-runtime green evidence directly
- rerun and republish only the Phase 9 proof families and the packaged-artifact smoke family
- do not treat root .tmp artifacts or historical Phase 0-10 report paths as authoritative after copy

Host constraints:
- raw npx may require npm_config_cache="$PWD/.npm-cache"
- keep TMPDIR=.tmp on Vitest surfaces

Need:
- execute the frozen verification-only lane exactly
- preserve command-level evidence and raw log paths for every step
- disposition accepted outputs into the current-plan-owned destinations only after successful generation
- classify any remaining worktree drift precisely
- write a durable tester report under plans/20260406-0515-release-ready-parity-proof/reports/

Do not:
- change production code
- reopen accepted product behavior without fresh contradictory evidence
- treat partial or failed outputs as accepted proof

## Paste-Back Contract
When done, reply using exactly this template:

## S3 Result
- status: completed | blocked
- role/modal used: ...
- model used: ... / ...

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

## Unresolved Questions

- none
