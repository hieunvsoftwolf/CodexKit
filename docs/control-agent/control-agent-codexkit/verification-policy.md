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

## 3. TDD And Verification Architecture

- Session B0 must derive acceptance and integration expectations from the plan acceptance criteria, testing strategy, and public behavior contract before the candidate implementation is inspected.
- If the current phase exposes stable interfaces and test harness points, Session B0 should author verification-owned tests or harness updates before implementation completes.
- Session B must run the frozen Session B0 tests unchanged first when they exist.
- Session A may add implementation-adjacent unit tests in owned scope, but Session A does not replace independent verification.

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

## 6. Control-State Persistence

After a meaningful artifact is pasted back or the task framing changes materially, the control agent must:
- recompute normalized control state
- persist a concise `control-state` snapshot under `plans/20260313-1128-phase-0-preflight-clean-restart/reports` before emitting new runnable downstream prompts when that path is in scope
- update any active `plan.md` references or progress notes if the phase state changes

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
