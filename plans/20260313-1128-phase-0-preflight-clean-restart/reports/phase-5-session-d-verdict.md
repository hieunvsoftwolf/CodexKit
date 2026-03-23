# Phase 5 Session D Verdict

**Date**: 2026-03-22
**Phase**: Phase 5 Workflow Parity Core
**Session**: D lead verdict
**Status**: blocked
**Role/Modal Used**: lead verdict / Default
**Model Used**: GPT-5 / Codex
**Pinned BASE_SHA**: `df037409230223e7813a23358cc2da993cb6c67f`

## Decision

Fail the current Phase 5 Wave 1 candidate.

The current candidate does not satisfy the frozen Wave 1 acceptance bar for `P5-S1`, `P5-S2`, and `P5-S5`. Session B's passing frozen checks matter, but Session C identified real repo-tree defects inside the in-scope Wave 1 contract. Those findings are blockers because they break runnable continuation semantics, cook pickup correctness, and brainstorm handoff auditability that Wave 1 explicitly owns.

## Scope Basis

Wave 1 scope for this verdict only:
- `P5-S0`
- `P5-S1`
- `P5-S2`
- `P5-S3` core only
- `P5-S5`

Deferred from this wave and not used as fail reasons by themselves:
- `P5-S4`
- final `P5-S6`
- `P5-S7`

Source of truth weighted highest:
- current candidate repo tree
- frozen Phase 5 docs and reports
- Session B and Session C artifacts as verification context, not as replacement for repo inspection

## Verdict Mapping By Finding

### 1. Broken emitted `plan -> cook` handoff commands

Verdict: blocker for this wave.

Why it blocks Wave 1:
- This is inside `P5-S1` CLI public surface, not deferred scope.
- Wave 1 froze absolute continuation commands as part of the public `cdx brainstorm`, `cdx plan`, `cdx cook` surface and explicit plan-path re-entry.
- The candidate emits commands such as `cdx cook --auto <abs-plan-path>` and `cdx cook --parallel <abs-plan-path>`, but the parser consumes the plan path as a flag value instead of the cook positional. The generated handoff is therefore not runnable on the same candidate tree.

Wave boundary call:
- not deferrable to final `P5-S6`; runnable handoff syntax belongs to Wave 1 CLI parity and continuity
- not a `P5-S4` issue

Evidence:
- `packages/codexkit-cli/src/arg-parser.ts:12`
- `packages/codexkit-cli/src/workflow-command-handler.ts:93`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-c-review-report.md:35`
- `docs/workflow-parity-core-spec.md:105`
- `docs/workflow-parity-core-spec.md:525`

### 2. `cdx cook` partial reuse skips required hydration

Verdict: blocker for this wave.

Why it blocks Wave 1:
- This is inside `P5-S5` hydration bootstrap and the Wave 1 portion of cook pickup semantics, not deferred final `P5-S6` execution depth.
- Wave 1 explicitly owns task reuse and hydration bootstrap for plan-path re-entry. The candidate only hydrates when `reusedTaskIds.length === 0`, and its reuse scan counts child tasks, so an incomplete reusable phase-task set can falsely suppress hydration.
- That violates the frozen pickup rule and leaves the new cook run without the required task graph state.

Wave boundary call:
- this is not full cook through post-implementation work; it is the Wave 1 bootstrap contract that final `P5-S6` depends on
- therefore not deferrable to Wave 2

Evidence:
- `packages/codexkit-daemon/src/workflows/cook-workflow.ts:64`
- `packages/codexkit-daemon/src/workflows/hydration-engine.ts:64`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-c-review-report.md:65`
- `docs/workflow-parity-core-spec.md:433`
- `docs/workflow-parity-core-spec.md:486`
- `docs/workflow-parity-core-spec.md:527`

### 3. `brainstorm` missing blocking handoff gate and complete handoff bundle

Verdict: blocker for this wave.

Why it blocks Wave 1:
- This is inside `P5-S2` brainstorm vertical and Phase 5 core handoff quality, not deferred later-phase workflow work.
- The frozen spec marks `brainstorm-decision` and `brainstorm-handoff` as blocking approval checkpoints, and Wave 1 acceptance requires durable audit trail via artifacts, approval records, or explicit no-file semantics that still preserve the blocking gate.
- The candidate directly creates the downstream run and records `brainstorm-handoff` as approved or aborted without a durable approval record. The downstream handoff metadata also omits the handoff-bundle fields required by `NFR-6.1`.
- This weakens both approval traceability and fresh-session continuation quality for the in-scope `brainstorm -> plan` handoff family.

Wave boundary call:
- not deferred to `P5-S7`; `P5-S7` is evidence close, not license to ship a known failing in-scope handoff contract
- not deferred to final `P5-S6`; this is brainstorm-owned behavior

Evidence:
- `packages/codexkit-daemon/src/workflows/brainstorm-workflow.ts:58`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-c-review-report.md:96`
- `docs/workflow-parity-core-spec.md:182`
- `docs/workflow-parity-core-spec.md:509`
- `docs/non-functional-requirements.md:136`
- `docs/non-functional-requirements.md:139`

## What Still Passes

These remain accepted for the current candidate and do not require rerouting on their own:
- `P5-S0` checkpoint naming and explicit-only approval inheritance defaulting are materially in place
- `P5-S3` core plan artifact generation, frontmatter, and phase file minimum sections are materially in place
- deferred `P5-S4` subcommands are correctly represented as deferred typed diagnostics rather than false completion
- Session B verification additions were valid and useful, but insufficient to cover the three repo defects above

## Blocker Order

1. `P5-S1` fix public CLI handoff parsing so emitted `cdx cook --auto|--parallel <abs-plan-path>` commands are runnable
2. `P5-S5` fix cook pickup semantics so partial phase-task reuse triggers recovery hydration and child tasks cannot satisfy the phase-task reuse test
3. `P5-S2` implement a durable blocking brainstorm handoff approval record and emit a complete downstream handoff bundle that satisfies the in-scope `NFR-6.1` contract

## Reroute Target

Next reroute target: Phase 5 remediation Session A.

Required remediation scope:
- patch `P5-S1` CLI arg parsing / workflow dispatch for cook handoff commands
- patch `P5-S5` cook reuse-vs-hydration decision and reuse filtering
- patch `P5-S2` brainstorm handoff gating and metadata bundle completeness
- add or update tests so the broken generated handoff command, partial-reuse cook path, and brainstorm approval/bundle contract are directly asserted

After remediation:
- rerun Session B against the frozen Wave 1 scope plus the remediation deltas
- rerun Session C review on the remediated candidate
- return to Session D for a new verdict

## Next Runnable Wave

No new wave is runnable from this candidate.

Wave 2 must not start from the current candidate because Wave 1 is not accepted. The next runnable path is the remediation loop for the current Wave 1 candidate, not a Phase 5 Wave 2 start.

## Unresolved Questions

- `--help` typed-usage drift remains non-blocking for this verdict unless the remediation sessions discover a stricter frozen requirement than the current docs and tester evidence show
