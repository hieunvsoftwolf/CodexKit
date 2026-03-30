# Phase 10 Wave 3 Session B Tester Report (S21)

**Date**: 2026-03-28  
**Phase**: Phase 10 Public CLI Packaging and Onboarding  
**Slice**: `P10-S1` only  
**Session Role/Modal**: tester / Default  
**Status**: completed  
**Scope Guard**: stayed in packaged-artifact verification for `P10-S1`; did not widen into `P10-S2`, `P10-S3`, `P10-S4`, or release-readiness closure.

## Frozen B0 Contract Execution

Executed frozen verification commands unchanged:

1. `npm run pack:cli` -> passed
2. `npm run smoke:cli:tarball` -> passed
3. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism` -> passed (`1` file, `5` tests)

For strict B0 alignment, also re-ran in B0 sequence (`vitest -> pack -> smoke`), all passed again.

## Evidence Collected

- Manifest inspection:
  - root [`package.json`](../../../../package.json): workspace remains `private: true`; no root `bin`.
  - [`packages/codexkit-cli/package.json`](../../../../packages/codexkit-cli/package.json): `"name": "@codexkit/cli"`, `"private": false`, `"bin": { "cdx": "./dist/index.js" }`, `"files": ["dist"]`.
- Tarball artifact:
  - `codexkit-cli-0.1.0.tgz` produced by `npm run pack:cli`.
  - `ls -1 codexkit-cli-*.tgz` returned one artifact: `codexkit-cli-0.1.0.tgz`.
  - `tar -xOf codexkit-cli-0.1.0.tgz package/package.json` confirms package/bin contract in packaged artifact.
  - `tar -xOf codexkit-cli-0.1.0.tgz package/dist/index.js` shows JS shebang entrypoint: `#!/usr/bin/env node`.
- Smoke harness behavior:
  - [`scripts/smoke-cli-tarball.mjs`](../../../../scripts/smoke-cli-tarball.mjs) executes both public entry forms:
    - `npx --yes --package <tarball> cdx doctor --json`
    - `npm install --global --prefix <local-prefix> <tarball>` then `<prefix>/bin/cdx doctor --json`
  - Script pins repo-local npm cache: `npm_config_cache=.npm-cache`.
- Additional packaged-path checks:
  - From outside repo root (`.tmp/p10-s1-manual-check`) with local cache override, both tarball entry forms succeeded and returned JSON.
  - Extracted tarball payload contains no `experimental-strip-types` references (`rg` no match).
  - Extracted tarball payload contains no `.ts` files (`rg` no match).
  - Tarball has no repo-root `./cdx` wrapper file.

## Acceptance Mapping (Frozen B0 Sections A-F)

| Section | Result | Evidence |
|---|---|---|
| A. Artifact identity and installability | pass | package manifests match frozen contract; `npm run pack:cli` passed; packed `package/package.json` preserves `@codexkit/cli` + `cdx`; one installable tarball artifact observed |
| B. Local packed-artifact validation path | pass | `npm run smoke:cli:tarball` passed unchanged; script runs both tarball entry forms; script uses repo-local npm cache |
| C. No runtime dependency on source checkout layout | pass | acceptance executed via tarball-installed entrypoints; tarball contains required runtime files under `dist/**`; no packaged `./cdx`; manual run from non-root working dir also passed with local cache |
| D. No runtime dependency on `node --experimental-strip-types` | pass | packaged entrypoint is JS shebang; no `experimental-strip-types` string in extracted payload; no `.ts` runtime files shipped |
| E. Both public entry forms | pass | smoke script and manual non-root checks both succeeded for `npx --package <tarball>` and `<prefix>/bin/cdx` |
| F. Preserve accepted `P10-S0` contract inside packaged path | pass | frozen Phase-10 contract test passed (5/5); tarball manifest/bin identity stayed `@codexkit/cli` + `cdx`; smoke path passed |

## Implementation Summary Claim Check

Compared against `phase-10-wave-2-session-a-implementation-summary.md`:

- Claim: `pack:cli`, `smoke:cli:tarball`, freeze vitest pass -> **matched**.
- Claim: publish seam remains `@codexkit/cli` + `cdx` with packaged `dist` payload -> **matched**.
- Claim: runtime no longer depends on `--experimental-strip-types` for packaged path -> **matched**.
- Claim: tarball supports both public entry forms -> **matched**.

Observed mismatch between implementation summary claims and current evidence:
- none.

## Pass/Fail/Blocked For Exact `P10-S1` Slice

- `P10-S1`: **pass**
- Blocked items in-slice: none
- Out-of-scope lanes (`P10-S2`/`P10-S3`/`P10-S4`, release readiness): intentionally not evaluated

## Notes

- Raw `npx` without local cache override still fails on this host with `~/.npm` ownership (`EPERM`). This matches prior B0 harness notes and is non-blocking for `P10-S1` because canonical verification path uses repo-local cache (`pack:cli` and `smoke:cli:tarball`).

## Unresolved Questions

- none
