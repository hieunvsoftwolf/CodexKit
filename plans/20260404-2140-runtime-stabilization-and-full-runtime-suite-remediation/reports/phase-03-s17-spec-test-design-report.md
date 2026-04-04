# Phase 03 S17 Spec-Test-Design Report

Date: 2026-04-05
Session: S17
Status: completed
Role/modal used: spec-test-designer / reasoning
Model used: Codex / GPT-5
Pinned BASE_SHA: `537f1a8aed241b72664771a1295347dc9713a1e0`
Phase: `Phase 03 Phase 9 golden trace canonicalization`

## Scope Freeze

- Verification-owned scope for this wave is report-only. No verification-owned test or harness edit is frozen for Wave 1.
- Reason: the active phase docs and S15 planner decomposition already assign the only code-changing seam to one implementation lane: `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts` plus new `tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json`.
- `tests/runtime/helpers/phase9-evidence.ts` remains no-touch for this phase unless `S16` proves a minimal provenance note is required by the canonical path after direct implementation inspection.
- `S16` may touch only:
  - `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
  - new `tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json`
  - `tests/runtime/helpers/phase9-evidence.ts` only if necessity is proven and reported as a scoped provenance-only change

## Acceptance Freeze

- The failing seam is the live frozen-trace source path only.
- Acceptance for this wave is met only when all are true:
  - the focused suite no longer depends on `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-frozen-claudekit-plan-cook-trace.json`
  - the active frozen trace lives at repo-owned canonical path `tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json`
  - the canonical fixture is tracked in the candidate worktree
  - the active test references the frozen trace only through the canonical path for loader use, comparative note text, and `NFR-3.6` artifact emission
  - the focused Vitest command reaches assertion-layer execution and exits `0`
- Historical report artifacts remain preserved for audit only. They are not canonical live runtime inputs.
- Preserved host caveat: the historical report-path JSON may exist locally on this machine, but it is not canonical live source and must not be used as proof of pass.

## Verification-Owned Command Subset

Frozen command subset for `S18` unchanged-first verification:

1. Confirm canonical fixture is tracked:
   - `git ls-files --stage tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json`
   - Expected outcome: one tracked entry is returned for the canonical fixture.
2. Confirm historical report-path JSON is not the canonical tracked source:
   - `git ls-files --stage plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-frozen-claudekit-plan-cook-trace.json`
   - Expected outcome: no tracked entry is returned for the historical path.
3. Confirm the active test no longer performs a live read from the historical path and now points at the canonical path:
   - `rg -n "phase-9-frozen-claudekit-plan-cook-trace.json|tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json" tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
   - Expected outcome:
     - canonical fixture path is cited by the path constant and any downstream evidence/artifact ref that names the live frozen trace source
     - no live read remains for `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-frozen-claudekit-plan-cook-trace.json`
4. Run the focused suite:
   - `TMPDIR=.tmp NODE_NO_WARNINGS=1 npm_config_cache="$PWD/.npm-cache" npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
   - Expected outcome:
     - suite reaches assertion-layer execution
     - no `ENOENT` tied to the historical report path
     - exit status `0`

## Evidence Required To Prove Canonicality

- Required proof that the new fixture is canonical:
  - tracked-file evidence for `tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json`
  - active test-file evidence showing the canonical path is the only live frozen-trace source
  - focused-suite evidence showing the test executes without historical-path `ENOENT`
  - implementation summary statement naming the source used to create the fixture and stating the historical host-local JSON was treated as one-time handoff context only, not canonical live source
- Required proof that the historical path is no longer live:
  - no tracked canonical-source claim at the historical path
  - no active test-file loader or `NFR-3.6` artifact ref still pointing to the historical path
  - focused suite does not read or fail on the historical path

## Verification-Owned Surfaces

- Verification-owned artifact for this wave:
  - this report and the frozen `S18` command subset above
- Not verification-owned for Wave 1:
  - `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
  - `tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json`
  - `tests/runtime/helpers/phase9-evidence.ts`
- Decision on `S16` touching verification-owned surfaces:
  - `S16` may not modify any new verification-owned test or harness artifact because none are created in `S17`
  - `S16` may proceed within the implementation-owned scope already frozen by S15

## Test-Edit Decision

- Decision: verification-owned scope is report-only for this wave.
- Decision: no verification-authored test edit is needed before implementation.
- Decision: `tests/runtime/helpers/phase9-evidence.ts` should remain no-touch in this phase unless `S16` proves necessity for a minimal provenance-only adjustment.

## Downstream Expectations

- `S18` must run the frozen command subset unchanged first.
- `S18` must record exact command strings, candidate worktree path, and exit codes.
- `S18` must classify any failure as one of:
  - historical-path coupling still present
  - canonical fixture missing or untracked
  - new regression after assertion-layer entry
- `S19` should review for scope control:
  - no production runtime workflow code changes
  - no edits under `plans/20260313-1128-phase-0-preflight-clean-restart/reports/`
  - no `tests/runtime/helpers/phase9-evidence.ts` change unless the implementation summary proves necessity

## Unresolved Questions

- none
