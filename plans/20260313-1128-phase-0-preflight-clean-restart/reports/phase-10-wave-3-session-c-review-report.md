# Phase 10 Wave 3 Session C Review Report

**Date**: 2026-03-28  
**Phase**: Phase 10 Public CLI Packaging and Onboarding  
**Scope**: `P10-S1` only  
**Status**: completed  
**Role/Modal Used**: code-reviewer / Default  
**Model Used**: GPT-5 / Codex CLI  
**Skill Route**: `security-best-practices`, `security-threat-model`

## Findings

### IMPORTANT: Tarball smoke evidence does not prove installed-artifact behavior outside the source checkout

- Evidence:
  - `scripts/smoke-cli-tarball.mjs` hard-codes `cwd = rootDir` for both packaged entry checks, so both `npx --package <tarball> cdx doctor --json` and `<prefix>/bin/cdx doctor --json` execute from the repo checkout, not from a foreign install-only directory. See `scripts/smoke-cli-tarball.mjs:12-15` and `scripts/smoke-cli-tarball.mjs:38-45`.
  - Runtime root selection climbs to the nearest `.git` parent. When smoke runs from the checkout, the packaged CLI is still operating against this repo’s root state. See `packages/codexkit-db/src/runtime-paths.ts:19-37`.
  - `P10-S1` B0 explicitly froze “no runtime dependency on source checkout layout” and “acceptance does not use repo-root ./cdx”, but the durable smoke path never exits the repo tree, so it cannot catch checkout-coupled root discovery drift.
- Why it matters:
  - This is the exact acceptance seam `P10-S1` was meant to harden: install-style execution must behave the same when the package is consumed outside the source tree.
  - The current wave evidence can pass even though the durable harness has not proved fresh external execution semantics.
- Repro summary:
  - External probe from `/Users/hieunv/.codex_profiles/acc_3/memories/p10-s1-review-fresh/run-iDeIPW` showed the packaged CLI can run correctly outside the repo, but that proof came from an ad hoc reviewer probe, not from the committed smoke harness.
- Recommended action:
  - Change the smoke script to copy the tarball into a temp directory outside the checkout, `cd` there before both package-consumption checks, and assert the resulting `doctorReportPath` or `.codexkit` root stays under that temp directory.

### MODERATE: `cdx doctor` persists runtime state on first run in a fresh external directory without any preview/apply gate

- Evidence:
  - `RuntimeController` opens the runtime context in the constructor before command dispatch. See `packages/codexkit-daemon/src/runtime-controller.ts:33-35`.
  - Opening the runtime context immediately opens the SQLite database and runs migrations. See `packages/codexkit-daemon/src/runtime-context.ts:20-23`.
  - Opening the runtime database unconditionally creates `.codexkit/state`, `.codexkit/runtime`, logs, artifacts, and the SQLite file. See `packages/codexkit-db/src/open-database.ts:5-8` and `packages/codexkit-db/src/runtime-paths.ts:61-67`.
  - `runDoctorWorkflow()` then creates a durable run and publishes both migration-assistant and doctor report artifacts. See `packages/codexkit-daemon/src/workflows/doctor-workflow.ts:237-266` and `packages/codexkit-daemon/src/workflows/doctor-workflow.ts:439-479`.
  - Reviewer probe from a fresh non-git directory under `/Users/hieunv/.codex_profiles/acc_3/memories/p10-s1-review-fresh/run-iDeIPW` produced `.codexkit/state/runtime.sqlite` plus report artifacts on the first `npx --package <tarball> cdx doctor --json` invocation.
- Why it matters:
  - This is a trust-boundary surprise for a public diagnostic entrypoint reached through `npx @codexkit/cli doctor`: the command creates persistent local state before the user has gone through `init --apply`.
  - I did not find a direct `P10-S1` contract line forbidding this, so I am classifying it as a packaging/install trust concern rather than a frozen-contract regression.
- Recommended action:
  - Decide explicitly whether first-run `doctor` is allowed to persist `.codexkit` state.
  - If yes, document that side effect in onboarding and smoke expectations.
  - If no, split `doctor` into a no-write scan path plus an explicit persistence step, or add an `--ephemeral` mode for package-consumption diagnostics.

## Checks Run

- `npm run pack:cli`
- `node scripts/smoke-cli-tarball.mjs`
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism`
- External packaged-artifact probes from a non-repo writable root:
  - `npx --yes --package <tarball> cdx doctor --json`
  - `npm install --global --prefix <prefix> <tarball>`
  - `<prefix>/bin/cdx doctor --json`

## What Checked Clean

- Packaged manifest/bin seam matches the frozen `P10-S0` contract: `@codexkit/cli` and `cdx`.
- Tarball payload contains compiled JS entrypoints and packaged schema asset under `dist/docs/codexkit-sqlite-schema.sql`.
- No active runtime code or packed payload reintroduced `--experimental-strip-types`.
- Packaged `npx` and install-style bin execution both worked from an external non-git directory.

## Threat Model Notes

- In-scope trust boundaries for this review were:
  - operator shell -> packaged `cdx` entrypoint
  - packaged CLI -> local filesystem under the current working directory
  - packaged CLI -> local toolchain discovery (`node`, `git`, `codex`)
- Highest realistic abuse path in this slice is unintended local mutation or checkout-coupled behavior during package-consumption commands, not remote compromise.
- No evidence found that the tarball executes TypeScript directly or requires repo-local runtime assets once installed.

## Unresolved Questions

- none
