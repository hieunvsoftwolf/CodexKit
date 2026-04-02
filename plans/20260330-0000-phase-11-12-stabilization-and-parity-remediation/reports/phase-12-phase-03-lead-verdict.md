# Phase 12 Phase 3 Lead Verdict

**Date**: 2026-04-02
**Phase**: Phase 12 Phase 3 Archive and Preview Parity
**Status**: completed
**Role/Modal Used**: lead-verdict / default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `75a5af42d2f18e3ffee23ebebc6dc99ba20b5606`
**Candidate Ref**: `/Users/hieunv/Claude Agent/CodexKit` (`main`, working tree beyond pinned base)
**Skill Route**: none required

## Decision

Pass Phase 12 Phase 3 on the current candidate tree.

The current candidate satisfies the frozen Phase 12.3 acceptance contract from the active `plan.md` frontmatter, the phase doc, and the latest durable control-state snapshot. The raw tester evidence confirms that frozen phase-local archive and preview coverage exists and that real public CLI-flow evidence exists for both `cdx plan archive` and `cdx preview`. The reviewer found no blocking production mismatch. The three broader runtime failures are acceptable for this phase as stale-expectation fallout in legacy shared suites, not as Phase 12.3 blockers.

This is a pass on the current unlanded candidate, not operational completion. The wave is not operationally complete until the current Phase 12.3 candidate is explicitly dispositioned and landed as a clean synced commit, or explicitly rejected, from the root checkout.

## Evidence Weighed

Primary control source:

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-verdict-ready-after-s4-s5-20260402-172418.md`

Phase contract:

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md`

Supporting reports reviewed directly:

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-spec-test-design-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-implementation-summary.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-remediation-implementation-summary.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-test-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-review-report.md`

Raw tester evidence reviewed directly:

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.log`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.exit`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.log`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.exit`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.log`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.exit`

Candidate-tree code and test surfaces checked directly:

- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`
- `packages/codexkit-daemon/src/workflows/preview-workflow.ts`
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-cli/src/arg-parser.ts`
- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`

## Acceptance Criteria Mapping

### 1. `cdx plan archive` no longer mutates state before a confirmation gate resolves

- Verdict: pass
- Evidence:
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.log`
  - `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
  - `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`
- Why:
  - the phase-local runtime test proves the first archive pass returns `status: "pending"`, exposes typed `pendingApproval`, records checkpoint `plan-archive-confirmation`, leaves `plan.md` unchanged, and emits no archive artifacts before approval
  - the phase-local CLI test proves the same behavior through the real `cdx` entrypoint
  - the implementation now records `plan-archive-confirmation` before approval resolution and mutates only inside `resumePlanArchiveWorkflowFromApproval(...)`

### 2. Archive emits both archive summary and journal artifact output

- Verdict: pass
- Evidence:
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.log`
  - `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
  - `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`
- Why:
  - the phase-local runtime and CLI tests both assert `archive-summary.md` and `archive-journal-entry.md` exist after approval and are visible in run artifact listings
  - `completePlanArchive(...)` publishes both artifacts and returns both artifact identifiers

### 3. Preview emits a markdown artifact and a view URL artifact/field consistent with the represented graph contract

- Verdict: pass
- Evidence:
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.log`
  - `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
  - `packages/codexkit-daemon/src/workflows/preview-workflow.ts`
- Why:
  - the phase-local runtime and CLI tests both assert `preview-output.md`, `preview-view-url.md`, `previewViewUrl`, and durable artifact listing visibility
  - the preview workflow publishes both artifact classes and returns `previewViewUrl`, `previewViewUrlPath`, and `previewViewUrlArtifactId`

### 4. `workflow.preview` and its required artifacts leave the missing/partial buckets after this phase

- Verdict: pass for the owned represented surface in this candidate
- Evidence:
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-spec-test-design-report.md`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-test-report.md`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-review-report.md`
  - `packages/codexkit-cli/src/workflow-command-handler.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `packages/codexkit-daemon/src/workflows/index.ts`
  - `packages/codexkit-daemon/src/workflows/preview-workflow.ts`
- Why:
  - the route exists through CLI parser -> controller -> workflow export
  - raw tester logs contain passing real-CLI preview evidence
  - reviewer concluded the owned preview behavior is present and not mismatched in production

## Raw Tester Evidence Assessment

- `phase-12-phase-03-required-step-1.exit`, `phase-12-phase-03-required-step-2.exit`, and `phase-12-phase-03-required-step-3.exit` all record `EXIT_CODE=1`
- those non-zero exits do not negate the frozen phase-local evidence because the raw logs also show both owned Phase 12.3 files passing:
  - `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
- the raw logs also show the exact real CLI-flow assertions passing:
  - `real cdx archive flow gates plan mutation until approval resolves and publishes summary plus journal artifacts`
  - `real cdx preview flow emits markdown and view-url artifacts through the public CLI entrypoint`

Conclusion:

- frozen phase-local archive + preview evidence exists
- real CLI-flow evidence exists for both:
  - `cdx plan archive`
  - `cdx preview`

## Preserved Harness Caveat

Repeat this caveat explicitly and preserve it:

- `npm run test:runtime -- <file>` expands into broader runtime coverage in this repo

This is confirmed by the raw step logs, which show the supposedly file-scoped Step 1 and Step 2 commands still ran the broader `tests/runtime` suite and surfaced the same three unrelated failures.

## Three Broader Runtime Failures

Observed broader failures in raw logs:

- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`

Assessment:

- acceptable as follow-up stale-expectation fallout for Phase 12.3
- still blockers for a fully green broader runtime suite
- not blockers for this phase verdict

Why:

- the first two failures are direct stale assertions expecting immediate archive `status: "valid"` before confirmation, while the accepted Phase 12.3 behavior now intentionally returns `status: "pending"` until approval resolves
- the Phase 5 NFR failure is downstream fallout because `NFR-5.2` still derives truth from the older immediate-valid archive expectation
- the owned Phase 12.3 runtime and CLI tests pass in the same broader runs, so there is no contradictory production evidence for this phase

Required follow-up surfaces:

- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`

## Reviewer Finding Weighting

Reviewer outcome:

- no blocking Phase 12.3 production mismatch found

I independently checked the cited production and legacy-test surfaces and agree with that conclusion.

## Preview Flag Caveat

Preserved caveat:

- `--slides` / `--diagram` / `--ascii` flag form is not wired
- positional mode and `--mode <value>` forms work

Evidence:

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-review-report.md`
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-cli/src/arg-parser.ts`
- `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`

Disposition:

- not Phase 12.3-blocking
- follow-up work

Why:

- the required public preview route and required artifacts are present and verified
- supported invocation forms already work:
  - positional mode
  - `--mode <value>`
- the missing boolean-flag parser wiring is a UX/completeness gap outside the frozen minimum acceptance contract for this slice

## Required Landing Or Disposition Step

Exact remaining step:

- run a dedicated post-verdict baseline-disposition / merge step on the current Phase 12.3 candidate tree

That step must:

- classify the current dirty root-checkout deltas
- stage and land the intended Phase 12.3 production files, phase-local verification files, active plan/report/control-state artifacts, and this verdict report into a clean synced commit on `main`
- either exclude or separately disposition unrelated/transient churn before merge, especially `.tmp` timing JSON noise and any unrelated control-doc refresh not required for Phase 12.3
- verify clean sync after landing

Until that happens:

- Phase 12.3 is passed on candidate
- Phase 12.3 is not yet landed
- the wave should not be marked operationally complete

## Routing Call

- Phase 12 Phase 3: pass on current candidate
- broader stale-expectation follow-up: required, but not as a Phase 12.3 blocker
- preview boolean flag wiring: follow-up work, not a Phase 12.3 blocker
- immediate next control action: baseline-disposition / merge of the passed-but-unlanded Phase 12.3 candidate

## Unresolved Questions

- none
