# CodexKit Control Verification Policy

**Project**: CodexKit  
**Control Agent**: `control-agent-codexkit`  
**Purpose**: Define the required multi-session delivery model and routing policy for plan-driven phase execution.

## 1. Source Of Truth

The generated control agent must read these sources before routing:

1. `README.md`
2. `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
3. `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-1-wave-setup.md`
4. `docs/phase-1-implementation-plan.md`
5. `docs/verification-policy.md`
6. `docs/prompt-cookbook-codexkit-phase-guide.md`
7. `docs/project-overview-pdr.md`
8. `docs/system-architecture.md`
9. `docs/project-roadmap.md`
10. `docs/non-functional-requirements.md`
11. `docs/control-agent/control-agent-codexkit/phase-guide.md`
12. `docs/control-agent/control-agent-codexkit/skill-inventory.md`

If a durable control-state report exists under `plans/20260313-1128-phase-0-preflight-clean-restart/reports`, read it after the plan and before routing new sessions.

## 2. Default High-Rigor Session Model

For meaningful code phases, default to:

1. Session A: `implement`
2. Session B0: `spec-test-design`
3. Session B: `tester` independent execution
4. Session C: `reviewer` independent review
5. Session D: `lead verdict`

Use reduced rigor only for docs-only work, verification-only work, or when the operator explicitly accepts lower rigor.

## 2A. Lane Selection Rule

The generated control agent should classify work into one of these lanes:

- Full rigor lane:
  - use when a wave introduces or changes a public command, workflow contract, approval/resume/checkpoint behavior, state-machine behavior, acceptance criteria, or NFR claim
  - use when the current phase or wave is new, ownership is still ambiguous, or multiple shared seams are changing together
  - default shape remains Session A + Session B0 + Session B + Session C + Session D
- Remediation lane:
  - use after a failed verdict when docs, acceptance criteria, and pinned `BASE_SHA` remain stable and the blocker set is already explicit
  - keep the frozen B0 artifact unchanged unless the docs or acceptance contract changed
  - default shape is remediation Session A, then tester + reviewer rerun, then verdict rerun
- Fast lane:
  - allow only for docs-only work, harness-only work, verification-only work, or very small internal fixes that do not change public workflow behavior, approval/resume/checkpoint semantics, acceptance criteria, or NFR claims
  - if risk is unclear, do not use fast lane; fall back to full rigor or remediation lane

## 3. TDD And Verification Architecture

- Session B0 must derive acceptance and integration expectations from the plan acceptance criteria, testing strategy, and public behavior contract before the candidate implementation is inspected.
- If the current phase exposes stable interfaces and test harness points, Session B0 should author verification-owned tests or harness updates before implementation completes.
- Session B must run the frozen Session B0 tests unchanged first when they exist.
- Session A may add implementation-adjacent unit tests in owned scope, but Session A does not replace independent verification.

## 3A. Early-Failure And Anti-Stubbing Rules

- If a frozen Session B0 artifact already exists for the current wave and the phase docs or acceptance criteria have not changed, Session A must run the frozen B0 verification subset unchanged before claiming the implementation is ready for independent tester or reviewer routing. If that subset cannot be run, Session A must state the exact blocker.
- Public workflow behavior must not be closed out with synthetic success or synthetic failure. For workflow commands, chooser paths, continuation paths, and terminal artifacts, the implementation must either use real repo/runtime/tool evidence or return an explicit typed blocked/deferred result permitted by the docs.
- If a workflow introduces a bare chooser path, approval gate, or resumable continuation in the current wave, the same wave must cover both entry and continuation. Stubbed or null continuation paths are in-scope blockers, not acceptable follow-up debt.
- Planner decomposition and Session B0 artifacts should make coverage boundaries explicit:
  - contracts frozen now
  - contracts intentionally deferred
  - contracts left to reviewer-only or verdict-only scrutiny

## 4. Parallel And Sequential Routing Rules

Parallel execution is allowed only when:
- workstreams own disjoint files, components, or non-overlapping directories
- no shared migration, schema, API contract, or generated artifact must land first
- the plan does not explicitly require ordered delivery
- the downstream session does not depend on an upstream artifact that is still missing

Sequence is required when:
- two tasks modify the same file, schema, migration, or generated manifest
- one task defines the interface or artifact consumed by another
- acceptance criteria depend on a prior task completing first
- the current phase still has unresolved scope or ownership ambiguity

Default dependency shape:
- Wave 0 baseline disposition: emit a runnable fresh-agent session when the intended starting baseline is still dirty, unlanded, or unsynced
- Wave 0 preflight: capture a reproducible `BASE_SHA` if the repo is not yet ready for the high-rigor wave
- Wave 1 parallel: Session A implement + Session B0 spec-test-design
- Wave 2 after Session A: Session C reviewer
- Wave 2 after Session A + Session B0: Session B tester
- Wave 3 after Session B + Session C: Session D lead verdict

## 5. Required Artifacts

A phase should not advance without:
- implementation summary
- spec-test-design report or equivalent verification-owned artifact when high rigor applies
- test report
- review report
- lead verdict or explicit phase verdict
- refreshed durable control-state when a canonical plan reports path is already in scope

Every runnable session prompt must also embed a `## Paste-Back Contract` section inside the fenced prompt body. Outer session-card metadata alone is insufficient.

When the repo is not yet clean and synced on the intended baseline, the control agent must emit a runnable `Wave 0` session card instead of leaving only an operator reminder. That `Wave 0` card should route a fresh agent to classify local deltas, land or discard the candidate appropriately, and verify that the repo is clean and synced before freeze.

That in-prompt contract must require a structured session result reply whose heading matches the emitted session id, for example `## S2 Result`.

The required session result template is:
- `## Sx Result`
- `status`
- `role/modal used`
- `model used`
- `### Summary`
- `### Full Report Or Report Path`
- `### Blockers`
- `### Handoff Notes For Next Sessions`

### Preserved Local Additions
The control agent should also require, when applicable:
- explicit evidence that Session A ran the frozen B0 verification subset unchanged before handoff, or an explicit blocker stating why that was impossible
- explicit chooser and continuation coverage for any new public workflow gate introduced in the current wave
- explicit typed blocked/deferred behavior instead of synthetic placeholder outcomes for deferred or unsupported paths

## 6. Control-State Persistence

After a meaningful artifact is pasted back or the task framing changes materially, the control agent must:
- recompute normalized control state
- persist a concise `control-state` snapshot under `plans/20260313-1128-phase-0-preflight-clean-restart/reports` before emitting new runnable downstream prompts when that path is in scope
- update any active `plan.md` references or progress notes if the phase state changes

Freeze-loop exception:
- for freeze, preflight, or freeze-rerun routing, the control agent must not create a docs-only cleanup loop just because persisting the current `control-state` snapshot, updating `plan.md`, or writing the current freeze report makes the worktree non-empty
- if the latest durable control-state names a clean synced commit and refs still match that commit, treat that named commit as the authoritative freeze target when the only local deltas are:
  - `plan.md`
  - the just-persisted `control-state` snapshot
  - the current freeze report
- in that case, the control agent should reroute the freeze or freeze-rerun directly from the named synced commit instead of requiring the new control artifacts to be landed first
- the freeze must still block when non-control files are dirty, the phase-doc set changed, or `HEAD`/`main`/`origin/main` drifted away from the named commit
- when this exception is used, record it explicitly in the control-state snapshot and freeze prompt

The control-state snapshot must include:
- current objective
- current phase
- rigor mode
- pinned `BASE_SHA`, if any
- candidate ref, if any
- completed artifacts
- waiting dependencies
- next runnable sessions
- reduced-rigor exceptions
- unresolved questions or blockers

If baseline disposition is still pending, the snapshot should name the `Wave 0` session explicitly as the next runnable step instead of collapsing it into operator-only prose.

## 7. Model And Modal Guidance

- planning / spec-test-design / docs / verdict: prefer `gpt-5.4 / medium`
- review: prefer `gpt-5.4 / high`
- implementation / debugging: prefer `gpt-5.3-codex / high`
- testing: prefer `gpt-5.3-codex / medium`

If the host exposes modal selection:
- planning or reasoning modal for planner, spec-test-designer, reviewer, and lead verdict
- coding modal for fullstack-developer, debugger, and tester

## 8. Current Plan Baseline

- plan: `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- active phase spec: `docs/phase-1-implementation-plan.md`
- detected current phase: `Phase 1 Runtime Foundation`
- phase state: `high-rigor Wave 1 ready from pinned BASE_SHA`
- pinned `BASE_SHA`: `3a805e8c9bf2b6a8e53aba07ab13e39adce34d66`

## 9. Enforcement

The control agent must stop phase advancement when:
- required artifacts are missing
- a runnable session depends on missing upstream evidence
- a high-rigor wave should have a durable control-state snapshot but does not
- the plan acceptance criteria are not yet evidenced by implementation, test, and review artifacts
- a public workflow path in scope remains synthetic
- chooser or approval continuation in scope remains stubbed or null
- a frozen Session B0 self-check was required but skipped without an explicit blocker

### Preserved Local Additions
- Session A did not run the frozen B0 verification subset for the current unchanged wave and did not provide an explicit blocker
- a public workflow path in scope is implemented with synthetic placeholder behavior instead of real evidence or explicit typed blocked/deferred behavior
- a chooser or approval entry path was added in scope but its continuation path is still stubbed, null, or unverified
- the same wave has already failed verdict twice in a row without a planner refresh
