# Phase 10 Wave 2 B0 Spec-Test-Design

**Date**: 2026-03-28
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Slice**: `P10-S1` Publishable Npm Artifact And Bin Packaging
**Session**: B0 spec-test-design rerun
**Status**: completed
**Role/Modal Used**: spec-test-designer / Default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: `/Users/hieunv/Claude Agent/CodexKit` (branch `main`, working tree beyond pinned base)
**Skill Route**: none required

## Scope Freeze

Freeze verification-owned acceptance for `P10-S1` only.

In scope:
- one installable npm artifact exposing `cdx`
- local tarball or packed-artifact validation path
- no runtime dependency on source checkout layout
- no runtime dependency on `node --experimental-strip-types`
- both public entry forms:
  - `npx @codexkit/cli ...`
  - `npm install -g @codexkit/cli`
- preservation of accepted `P10-S0` contract inside the packaged artifact path

Out of scope for this artifact:
- `P10-S2` runner-resolution feature expansion beyond preserved `P10-S0` contract
- `P10-S3` onboarding doc expansion
- `P10-S4` broader public-beta smoke harness and release gate
- treating repo-local `./cdx` success as sufficient acceptance evidence

## Source Of Truth Used

Read first and used:
- `README.md`
- `package.json`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s1-b0-reroute-after-s20-block.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-third-remediation-session-d-verdict.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/non-functional-requirements.md`
- `docs/verification-policy.md`

Allowed repo-tree inspection used for harness stability only:
- root `package.json`
- `packages/codexkit-cli/package.json`
- `scripts/build-cli-artifact.mjs`
- `scripts/smoke-cli-tarball.mjs`
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
- existence only of `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-2-session-a-implementation-summary.md`

Not used:
- candidate implementation summary contents
- candidate implementation branches
- non-`P10-S1` implementation summaries

## Stable Harness Decision

Stable existing harness points do exist:
- root script `build:cli-artifact` stages the publishable package artifact
- root script `pack:cli` packs `@codexkit/cli` through a repo-local npm cache path
- root script `smoke:cli:tarball` already executes the two intended public install forms against a local tarball
- existing Phase 10 freeze test already owns the accepted `P10-S0` package/bin command contract

Verification-owned test authoring decision:
- no new tests added in this B0 session

Reason:
- user requested durable spec-test-design report only
- existing stable harness points are sufficient to freeze commands, fixtures, and pass/fail criteria for Session B
- adding new verification code here would widen beyond the minimal reroute need

## Existing Harness Facts Relevant To `P10-S1`

From current tree:
- root scripts expose the intended pack/smoke entrypoints:
  - `package.json` scripts `build:cli-artifact`, `pack:cli`, `smoke:cli:tarball`
- publishable workspace manifest exists:
  - `packages/codexkit-cli/package.json` names `@codexkit/cli`
  - public bin is `cdx`
  - packed files are limited to `dist`
- tarball smoke script already validates:
  - local build/staging
  - `npm pack --workspace @codexkit/cli`
  - `npx --package <tarball> cdx doctor --json`
  - `npm install --global --prefix <local-prefix> <tarball>`
  - `<local-prefix>/bin/cdx doctor --json`
- Phase 10 freeze test already preserves accepted `P10-S0` package/bin/public-command contract against docs and manifests

Observed local artifact facts from current candidate tarball:
- `codexkit-cli-0.1.0.tgz` exists at repo root
- tarball exposes `package/package.json`
- tarball bin points to `./dist/index.js`
- tarball includes compiled JS under `package/dist/**`
- tarball contains no repo-root `cdx` wrapper
- tarball entrypoint is a Node shebang JS file, not a TypeScript launcher

## `P10-S1` Acceptance Design

Session B must treat `P10-S1` as passed only if every check below passes from the packaged-artifact path.

### A. Artifact Identity And Installability

Goal:
- prove one installable npm artifact owns the public CLI seam

Checks:
1. `packages/codexkit-cli/package.json` declares:
   - `"name": "@codexkit/cli"`
   - `"private": false`
   - `"bin": { "cdx": "./dist/index.js" }`
   - `"files": ["dist"]`
2. root `package.json` does not reintroduce the public bin contract at workspace root.
3. `npm run pack:cli` succeeds and emits one tarball for `@codexkit/cli`.
4. tarball manifest still declares `@codexkit/cli` and `cdx`.

Pass condition:
- exactly one installable artifact path exists and it is the package owning `cdx`

Fail examples:
- root workspace manifest owns `cdx`
- packed package is still private
- pack flow requires manual manifest edits

### B. Local Packed-Artifact Validation Path

Goal:
- prove a stable pre-publish validation path exists and is runnable locally

Checks:
1. `npm run smoke:cli:tarball` succeeds unchanged.
2. it performs both intended public install forms against the tarball:
   - `npx --package <tarball> cdx doctor --json`
   - `npm install --global --prefix <local-prefix> <tarball>` then `<local-prefix>/bin/cdx doctor --json`
3. the script uses a repo-local npm cache path, not the operator’s default global cache, to avoid environment noise.

Pass condition:
- tarball validation succeeds end to end through the existing smoke script

Fail examples:
- smoke path falls back to repo-local `./cdx`
- smoke path shells into source checkout internals instead of installed package entrypoints
- smoke path depends on operator-global npm cache repair

### C. No Runtime Dependency On Source Checkout Layout

Goal:
- prove installed artifact runs without needing repo-root layout like `./cdx`, source `.ts`, or workspace-relative package paths outside the tarball

Checks:
1. execute only tarball-installed entrypoints for acceptance:
   - `npx --package <tarball> cdx doctor --json`
   - `<local-prefix>/bin/cdx doctor --json`
2. inspect tarball contents:
   - `package/package.json`
   - `package/dist/index.js`
   - compiled runtime files under `package/dist/**`
3. confirm acceptance does not use repo-root `./cdx`.
4. confirm required runtime assets used by the CLI are present inside tarball payload.

Suggested inspection commands:
```bash
npm run pack:cli
tar -tf codexkit-cli-0.1.0.tgz
tar -xOf codexkit-cli-0.1.0.tgz package/package.json
tar -xOf codexkit-cli-0.1.0.tgz package/dist/index.js
```

Pass condition:
- both public entry forms execute from installed tarball state with no dependency on repo-root wrapper or checkout-only files

Fail examples:
- installed command errors because it expects repo-root `dist/packages/...` outside the package
- installed command requires the repo root `cdx` wrapper
- installed command requires files not shipped in tarball

### D. No Runtime Dependency On `node --experimental-strip-types`

Goal:
- prove packaged runtime is compiled JS and does not depend on source TypeScript execution flags

Checks:
1. tarball entrypoint is JS with a Node shebang.
2. tarball contents contain compiled `.js` runtime files under `dist`.
3. no acceptance command invokes `node --experimental-strip-types`.
4. grep artifact payload or unpacked files for `experimental-strip-types`; expect none.

Suggested inspection command:
```bash
tar -xOf codexkit-cli-0.1.0.tgz package/dist/index.js
```

Pass condition:
- installed artifact launches via normal Node execution only

Fail examples:
- packaged bin shells out to `node --experimental-strip-types`
- packaged runtime requires `.ts` source files to execute

### E. Both Public Entry Forms

Goal:
- prove the same artifact supports the two intended public consumption paths

Checks:
1. `npx @codexkit/cli` equivalent tarball path succeeds:
   - `npx --yes --package <tarball> cdx doctor --json`
2. global install equivalent succeeds:
   - `npm install --global --prefix <local-prefix> <tarball>`
   - `<local-prefix>/bin/cdx doctor --json`
3. outputs are valid JSON and represent the installed artifact, not repo-local fallback execution.

Pass condition:
- both public entry forms succeed from the same tarball

Fail examples:
- one form works and the other depends on repo state
- global install creates no usable `cdx`
- `npx` route resolves wrong package/bin

### F. Preserve Accepted `P10-S0` Contract Inside Packaged Path

Goal:
- prove `P10-S1` packaging does not regress the accepted shared Phase 10 contract

Required preserved seams:
- package name remains `@codexkit/cli`
- bin remains `cdx`
- intended public command forms remain:
  - `npx @codexkit/cli init`
  - `npx @codexkit/cli doctor`
  - `npm install -g @codexkit/cli`
  - `cdx init`
  - `cdx doctor`
- runner contract remains the accepted `P10-S0` contract, not a widened `P10-S2` redesign

Checks:
1. run existing freeze file:
   - `TMPDIR=.tmp vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
2. run tarball smoke path:
   - `npm run smoke:cli:tarball`
3. inspect tarball manifest and entrypoint to confirm packaged bin identity matches freeze expectations.

Pass condition:
- freeze file still passes
- tarball smoke still passes
- packaged artifact manifest/bin identity matches freeze contract

Fail examples:
- docs/manifests say `@codexkit/cli`/`cdx` but packed artifact exports something else
- package path works but regresses accepted command contract
- packaging change mutates runner contract outside accepted `P10-S0` behavior

## Session B Command Plan

Primary command sequence:
```bash
TMPDIR=.tmp vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts
npm run pack:cli
npm run smoke:cli:tarball
tar -tf codexkit-cli-0.1.0.tgz
tar -xOf codexkit-cli-0.1.0.tgz package/package.json
tar -xOf codexkit-cli-0.1.0.tgz package/dist/index.js
```

Notes:
- use `npm run pack:cli`, not raw `npm pack`, as the canonical pack command because the repo script pins a repo-local cache path
- do not accept repo-local `./cdx` runs as `P10-S1` evidence
- do not open broader Phase 10 smoke suites from `P10-S4`

## Exit-Criteria Mapping

| `P10-S1` requirement | Verification evidence |
|---|---|
| one installable npm artifact exposing `cdx` | package manifest inspection plus `npm run pack:cli` plus tarball `package/package.json` |
| local tarball or packed-artifact validation path | `npm run smoke:cli:tarball` |
| no runtime dependency on source checkout layout | tarball-installed `npx` and global-prefix executions only; no `./cdx` |
| no runtime dependency on `node --experimental-strip-types` | tarball entrypoint/content inspection plus installed-run success |
| support `npx @codexkit/cli ...` | tarball `npx --package <tarball> cdx doctor --json` |
| support `npm install -g @codexkit/cli` | tarball install to local prefix then `<prefix>/bin/cdx doctor --json` |
| preserve accepted `P10-S0` contract | Phase 10 freeze test plus tarball manifest/bin inspection |

## Blocking Assumptions And Harness Notes

- assume Session B runs from repo root and can execute Node/npm locally
- assume local pack artifact name remains `codexkit-cli-0.1.0.tgz` unless version changes; if version changes, use the emitted tarball name
- raw `npm pack --dry-run` against the operator default cache is not the canonical path here; local inspection showed a cache-permission failure under `~/.npm`, while repo-owned scripts already avoid that by setting a local cache path
- this is not a product blocker for `P10-S1` so long as `npm run pack:cli` and `npm run smoke:cli:tarball` pass unchanged

## Session B Verdict Rule

`P10-S1` passes only if:
- the freeze file passes
- `npm run pack:cli` passes
- `npm run smoke:cli:tarball` passes
- tarball inspection confirms installed package/bin identity and JS entrypoint shape
- no acceptance evidence depends on repo-local `./cdx`

Any failure in those checks is a `P10-S1` blocker.

## Unresolved Questions

- none
