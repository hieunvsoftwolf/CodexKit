# Phase 12 Phase 3 Review Report

Date: 2026-03-31
Status: completed
Session role/modal: `code-reviewer / default`

## Findings

### 1. Low: preview boolean mode flags are not wired through the CLI parser

- `packages/codexkit-cli/src/workflow-command-handler.ts:209-230` only reads preview mode from `--mode <value>` or from the first positional token.
- `packages/codexkit-cli/src/arg-parser.ts:7-33` does not register `explain`, `slides`, `diagram`, or `ascii` as boolean flags, so `--slides`/`--diagram`/`--ascii` are not consumed as preview modes.
- Direct verification in the candidate tree showed:
  - `./cdx preview sample-target --slides --json` returned `"mode": "explain"`
  - `./cdx preview slides sample-target --json` returned `"mode": "slides"`
  - `./cdx preview sample-target --mode slides --json` returned `"mode": "slides"`
- The current CLI e2e test at `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts:85-110` uses `--explain`, but that still passes because the preview workflow defaults to `"explain"` even when the flag is ignored.
- Impact: not a Phase 12.3 blocker because the required public preview route and required artifacts are present, but the flag-form preview UX is incomplete and current coverage does not detect it.

### 2. Low: the documented `npm run test:runtime -- <file>` command remains evidence-noisy, so single-file phase evidence must rely on direct `vitest` invocation

- `package.json` defines `test:runtime` as `TMPDIR=.tmp vitest run tests/runtime --no-file-parallelism`, so appending a file path after `--` does not isolate execution to that file.
- This matches the durable control-state note in `reports/control-state-phase-12-phase-03-session-b-c-rerouted-20260331-191238.md`.
- I re-ran the owned Phase 12.3 files directly with isolated commands:
  - `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts --no-file-parallelism` -> pass
  - `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts --no-file-parallelism` -> pass
- Impact: not a blocker, but evidence-integrity language should keep distinguishing true phase-local single-file runs from the broader `npm run test:runtime` harness behavior.

## Scope Review

- Archive behavior in `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts:630-741` now matches Phase 12.3 scope:
  - first archive pass records `plan-archive-confirmation`
  - first archive pass returns `status: "pending"` with typed `pendingApproval`
  - no archive mutation occurs before approval
  - approval continuation performs archive mutation and emits both `archive-summary.md` and `archive-journal-entry.md`
- Preview behavior in `packages/codexkit-daemon/src/workflows/preview-workflow.ts:93-174` matches owned phase scope:
  - `workflow: "preview"` is routable through controller/CLI
  - `preview-output.md` and `preview-view-url.md` are both published
  - returned result includes `previewViewUrl`, `previewViewUrlPath`, and `previewViewUrlArtifactId`
- Remediation delta in `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts:646-663` is correct and narrowly scoped to the blocker:
  - first-pass archive status is now `pending`
  - `plan-archive-confirmation` is recorded before approval resolution
  - approval continuation still returns `valid` on completion and still publishes both archive artifacts

## Verification Summary

- Direct phase-local runtime verification passed:
  - `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
- Broader runtime verification still fails, but the preserved failures align with stale legacy assumptions:
  - `tests/runtime/runtime-cli.integration.test.ts:269-273` still expects immediate `archive.status === "valid"`
  - `tests/runtime/runtime-workflow-wave2.integration.test.ts:67-70` still expects immediate `archive.status === "valid"`
  - `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts:124-129` derives `NFR-5.2` from the same immediate-valid expectation

## Broader Runtime Caveat Answer

- The three broader runtime failures look like stale legacy expectations that now need synchronized follow-up updates, not a production mismatch that should still block verdict.
- Reasoning:
  - the new owned Phase 12.3 runtime and CLI tests pass when run in isolation
  - the broader failing assertions are exact matches for the previous immediate-archive contract and fail because `runPlanArchiveWorkflow(...)` now intentionally returns `status: "pending"` before approval, per `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts:646-663`
  - approval continuation still reaches the expected archived end state and artifact emission in `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts:721-740`
- Verdict effect:
  - broader shared tests and the Phase 5 NFR harness should be synchronized in follow-up work
  - those stale assertions should not block the Phase 12.3 verdict on this candidate tree

## Security And Threat Review Note

- No new material security blocker surfaced in Phase 12.3 scope.
- The new preview workflow stays local to the CLI/runtime boundary, emits local artifact paths and `file://` URLs, and does not add a network-facing service surface in this phase.

## Control-State Source Of Truth

- I treated `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-session-b-c-rerouted-20260331-191238.md` plus current `plan.md` frontmatter as the active durable control source.
- Generated control docs under `docs/control-agent/control-agent-codexkit/` still contain older preserved state fragments and must not override the latest durable control-state snapshot.

## Review Verdict

- No blocking Phase 12.3 production mismatch found in the remediation delta.
- Phase 12.3 owned behavior appears correct and sufficient for verdict, with two non-blocking caveats:
  - synchronize the three broader legacy archive expectations
  - either wire preview boolean mode flags or tighten the tests/docs to the supported positional/`--mode` forms

## Unresolved Questions

- none
