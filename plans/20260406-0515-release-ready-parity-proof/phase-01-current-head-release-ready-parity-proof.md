# Phase 01 Current-Head Release-Ready Parity Proof

## Context

**Status**: `ready_for_planner`  
**Latest Durable Control State**: `reports/control-state-release-ready-parity-proof-ready-for-planner-20260406-051537.md`  
**Pinned BASE_SHA**: `308867621e6c3d77746302b08a624445f7b84213`  
**Historical accepted engineering baseline**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Overview

This phase exists to prove or disprove a broad release-ready parity claim on the current `main` tree. Historical evidence is strong enough to support an engineering-baseline claim, but not strong enough to support an unqualified public or release-ready parity claim without a fresh current-head proof bundle.

## Requirements

- do not reopen accepted runtime or workflow product behavior unless fresh current-head evidence shows a real regression
- do not treat the historical Phase 9 pass or the historical narrow Phase 10 pass as sufficient current-head release proof by themselves
- produce or route a fresh candidate-scoped `release-readiness-report.md` with a pass or fail table for every metric in `docs/non-functional-requirements.md`
- include release-gate evidence for the current tree across the required Phase 9 proof families and any still-relevant packaged-artifact/public-beta surfaces
- preserve the explicit host caveat that raw `npx` can hit `~/.npm` ownership `EPERM` on this machine; any accepted proof must repeat the caveat when relevant
- keep root `main` as the control surface; any later code-changing or clean-proof verification wave must use a planner-declared fresh worktree strategy

## Implementation Steps

1. Reconcile historical Phase 9, Phase 10, and Phase 04 evidence against the current `main` baseline.
2. Freeze the current-head release-ready acceptance matrix, harness list, and evidence-owned artifacts.
3. Decide whether the next lane is verification-only, full-rigor remediation, or a stricter baseline-disposition or freeze shape.
4. Route the exact downstream sessions needed to prove or block the release-ready parity claim.
5. Publish a verdict that either accepts the claim on current-head evidence or names the exact blocker set.

## Todo List

- [ ] reconcile historical baseline evidence and current-head claim scope [critical]
- [ ] freeze the current-head release-ready acceptance and verification matrix [critical]
- [ ] decide whether `W0` or a fresh clean-proof surface is required before any downstream execution
- [ ] route exact planner-owned downstream session prompts for proof, review, and verdict
- [ ] publish the final release-ready parity verdict with explicit caveats or blockers

## Success Criteria

- a planner report freezes the release-ready claim scope against the current tree without relying on stale historical shorthand
- the current-head release-proof lane is explicit about required suites, reports, worktree strategy, and host caveats
- a fresh candidate-scoped `release-readiness-report.md` is produced or an explicit blocker explains why it cannot yet be accepted
- the final verdict states clearly whether CodexKit is release-ready parity-complete on current `main`

## Unresolved Questions

- whether the current-head release-ready proof can stay verification-only
- whether the old Phase 9 harnesses remain current-contract-accurate without a refresh
- whether doc-status normalization belongs in this same plan or in a later docs-only closure lane
