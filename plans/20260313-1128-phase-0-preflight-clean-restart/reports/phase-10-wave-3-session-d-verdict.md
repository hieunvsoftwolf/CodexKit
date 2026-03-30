# Phase 10 Wave 3 Session D Verdict

**Date**: 2026-03-28
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S1` only
**Status**: completed
**Role/Modal Used**: lead-verdict / Default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: `/Users/hieunv/Claude Agent/CodexKit` (branch `main`, working tree beyond pinned base)
**Skill Route**: none required

## Decision

Pass `P10-S1`.

The current candidate satisfies the frozen `P10-S1` acceptance contract from the B0 artifact. The tester passed every frozen B0 section (`A` through `F`). The reviewer found two real concerns, but neither is a current `P10-S1` blocker:

- the `IMPORTANT` finding is a durable-harness gap, not a demonstrated packaged-artifact behavior failure, because both tester and reviewer independently proved external non-repo tarball execution works
- the `MODERATE` finding is a doctor trust-boundary and product-policy concern that belongs to later Phase 10 doctor/onboarding hardening, not to the frozen `P10-S1` packaging seam

`P10-S1` is therefore closed as `pass`, and the next Phase 10 slice to open is `P10-S2`.

## Evidence Weighed

1. current repo tree for the `P10-S1` candidate
2. current durable control-state snapshot:
   - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s1-verdict-ready-control-agent-20260328-185941.md`
3. frozen B0 acceptance contract:
   - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-2-b0-spec-test-design.md`
4. Session A implementation summary:
   - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-2-session-a-implementation-summary.md`
5. Session B tester report:
   - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-3-session-b-tester-s21-report-20260328-1900.md`
6. Session C reviewer report:
   - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-3-session-c-review-report.md`
7. lead-owned confirmation runs:
   - `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism`
   - `npm run pack:cli`
   - `npm run smoke:cli:tarball`
   - external packaged-artifact probe from `/Users/hieunv/.codex_profiles/acc_3/memories/p10-s1-verdict-UXgBti`

## Frozen B0 Contract Mapping

### A. Artifact identity and installability

- Verdict: `pass`
- Why:
  - root `package.json` remains private and has no root `bin`
  - `packages/codexkit-cli/package.json` owns the public seam:
    - `"name": "@codexkit/cli"`
    - `"private": false`
    - `"bin": { "cdx": "./dist/index.js" }`
    - `"files": ["dist"]`
  - `npm run pack:cli` emits one tarball: `codexkit-cli-0.1.0.tgz`
  - packaged manifest preserves `@codexkit/cli` plus `cdx`

### B. Local packed-artifact validation path

- Verdict: `pass`
- Why:
  - `npm run smoke:cli:tarball` passes unchanged
  - committed smoke script executes both public entry forms against the tarball
  - committed smoke script pins repo-local npm cache at `.npm-cache`
- Reviewer weighting:
  - reviewer is correct that the committed smoke script still runs with repo-root `cwd`
  - that weakens the durability of the committed harness, but it does not invalidate this B0 section because the section froze the script as the canonical local validation path and that script is green

### C. No runtime dependency on source checkout layout

- Verdict: `pass`
- Why:
  - tester passed this section using tarball-installed entrypoints only
  - tester recorded extra non-root external checks as green
  - reviewer independently confirmed packaged `npx` and global-prefix execution from a non-repo writable root were green
  - lead-owned external probe reproduced the same result from `/Users/hieunv/.codex_profiles/acc_3/memories/p10-s1-verdict-UXgBti`
  - external `doctorReportPath` and `migrationAssistantReportPath` resolved under that external directory’s `.codexkit`, not under the source checkout
- Reviewer weighting:
  - reviewer is correct that the committed smoke harness does not itself prove this section
  - however the frozen B0 contract is outcome-based, not “committed smoke harness only”
  - the actual external packaged-artifact behavior is proven green by independent tester, reviewer, and lead evidence, so there is no current `P10-S1` blocker

### D. No runtime dependency on `node --experimental-strip-types`

- Verdict: `pass`
- Why:
  - repo-local `cdx` wrapper executes compiled JS and errors clearly if the build is missing
  - packaged tarball entrypoint is JS with Node shebang
  - tester found no `experimental-strip-types` references in extracted payload
  - reviewer also found no active runtime or packed payload regression here

### E. Both public entry forms

- Verdict: `pass`
- Why:
  - `npx --package <tarball> cdx doctor --json` passes
  - `npm install --global --prefix <local-prefix> <tarball>` then `<prefix>/bin/cdx doctor --json` passes
  - tester, reviewer, and lead external checks all confirm both forms work outside the source checkout when a local cache override is used on this host

### F. Preserve accepted `P10-S0` contract inside packaged path

- Verdict: `pass`
- Why:
  - freeze contract test passes
  - packaged manifest/bin identity stays `@codexkit/cli` plus `cdx`
  - no evidence shows the current packaging lane widening or regressing the accepted `P10-S0` runner contract

## Tester vs Reviewer Weighting

The tester pass carries primary acceptance weight because Session B executed the frozen B0 contract directly and reported all sections `A-F` passing with packaged-artifact evidence.

The reviewer findings still matter:

- `IMPORTANT` finding:
  - classification: accepted residual risk / follow-on work outside `P10-S1`
  - reason: it identifies that the committed smoke harness is not yet the durable proof vehicle for external packaged execution, but it does not show the packaged artifact failing the frozen `P10-S1` contract
  - disposition: carry forward as a harness-hardening requirement for later Phase 10 public-beta smoke coverage, not as a `P10-S1` remediation blocker

- `MODERATE` finding:
  - classification: accepted residual risk / follow-on work outside `P10-S1`
  - reason: first-run `doctor` persistence is a real trust-boundary/product-policy concern, but the frozen `P10-S1` contract did not forbid it; reviewer explicitly classified it as not a frozen-contract regression
  - disposition: route to later doctor/onboarding hardening, most naturally `P10-S2` and possibly `P10-S3`, not to `P10-S1`

No reviewer finding rises to “blocker requiring remediation now” for the exact `P10-S1` slice.

## Host Caveat

Keep the tester’s host caveat explicit:

- raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
- canonical scripted path remains green

This caveat is non-blocking for `P10-S1` because the frozen B0 command path already treats the repo-scripted local-cache route as canonical.

## Routing Call

- `P10-S1`: `pass`
- blocker set: none
- next Phase 10 slice to open: `P10-S2` Runner Resolution, Wrapper Support, And Doctor Hardening

## Unresolved Questions

- none
