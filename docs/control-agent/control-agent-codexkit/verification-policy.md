# CodexKit Control Verification Policy

**Project**: CodexKit  
**Control Agent**: `control-agent-codexkit`  
**Purpose**: Define the required multi-session delivery model and routing policy for plan-driven phase execution.

## 1. Source Of Truth

The generated control agent must read these sources before routing:

1. `README.md`
2. `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md`
3. `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/phase-01-archive-confirmation-contract-alignment.md`
4. `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-runtime-stabilization-ready-20260404-214000.md`
5. `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-05-operational-closure-complete-after-w0b-sync-20260404-210557.md`
6. `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-post-landing-sync-and-closure-report-20260404-210557.md`
7. `docs/verification-policy.md`
8. `docs/prompt-cookbook-codexkit-phase-guide.md`
9. `docs/project-overview-pdr.md`
10. `docs/system-architecture.md`
11. `docs/project-roadmap.md`
12. `docs/non-functional-requirements.md`
13. `docs/control-agent/control-agent-codexkit/phase-guide.md`
14. `docs/control-agent/control-agent-codexkit/skill-inventory.md`

If a durable control-state report exists under `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports`, read it after the plan and before routing new sessions.
If no Phase 11 or 12 control-state exists yet, read `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-passed.md` as historical baseline context only.

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
- Session B0 should declare which tests, fixtures, harnesses, snapshots, or golden artifacts become verification-owned for the wave, and whether Session A may touch any of them.
- Session B must run the frozen Session B0 tests unchanged first when they exist.
- When the current wave touches an in-scope user-facing or operator-facing workflow, Session B0 must state the required real-workflow e2e evidence explicitly and whether browser-style automation such as Playwright, MCP-flow execution, or CLI-flow execution is the correct user-like harness for that surface.
- Session A may add implementation-adjacent unit tests in owned scope, but Session A does not replace independent verification.
- Session A must not modify verification-owned tests, fixtures, harnesses, snapshots, or golden artifacts unless the routed prompt explicitly grants that scope.

## 3A. Early-Failure And Anti-Debt Rules

- If a frozen Session B0 artifact exists and the docs or acceptance contract did not change, Session A should rerun the frozen B0 verification subset unchanged before claiming the candidate is ready for independent tester or reviewer routing.
- Do not treat synthetic success or synthetic failure as phase-complete behavior for in-scope public workflows. Either execute against real repo/runtime/tool evidence or return explicit typed blocked, degraded, deferred, or unsupported diagnostics.
- Do not allow lead verdict to pass an in-scope user-facing or operator-facing workflow without durable real-workflow e2e evidence, unless the tester artifact marks that workflow `N/A` with an explicit rationale and residual-risk note.
- If the current wave introduces a chooser, approval gate, or resume/continuation entry path, require the same wave to cover both entry and continuation. Stubbed or null continuation remains an in-scope blocker.
- Planner and Session B0 artifacts should distinguish what is frozen now, what is intentionally deferred, and what is reviewer-only or verdict-only coverage.
- After a failed verdict, default to remediation lane unless the docs or acceptance contract changed.
- If the same wave fails verdict twice in a row, route to planner refresh before another blind remediation loop.

## 3B. Host Verification Constraints

- If the same verification blocker repeats twice on the same host/runtime without reaching assertion-layer evidence, the control agent must promote it into a durable host verification constraint.
- A host verification constraint must record:
  - the failing surface
  - the exact blocker class
  - any changed-surface, browser-channel, startup-budget, or unsandboxed workaround that was proven
- Once the constraint exists, do not route another same-host same-surface blind retry.
- The next routed verification step must change at least one of:
  - host/runtime
  - browser channel
  - execution substrate
  - harness readiness path
- If later evidence is accepted only under a caveat, for example unsandboxed execution, the tester and lead verdict must repeat that caveat explicitly.

## 3C. Evidence Integrity Rules

- Session B tester evidence must include the exact commands run, the execution surface used, and the resulting exit status or equivalent pass/fail signal for each required step.
- Session B tester evidence must cite the raw artifact, log, trace, screenshot, report, or CI job path or identifier that supports each claimed result. Summary prose alone is insufficient.
- If Session B runs on CI or another machine gate, the tester artifact must record the exact job, check, or pipeline status that was observed.
- Session D lead verdict must inspect the tester and reviewer artifacts plus the raw evidence references they cite before passing the wave. Do not pass based only on session summaries.
- Session D must name the exact tester artifacts, log paths, trace paths, screenshots, reports, and CI or machine-gate statuses that were checked.
- If a required machine gate or CI check does not exist for the wave, Session D must say so explicitly and justify why the remaining evidence is sufficient or leave the wave blocked.

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
- when the intended starting baseline is dirty, unlanded, or unsynced, emit a runnable baseline-disposition prep session instead of collapsing cleanup into operator-only prose
- naming rule:
  - if there is only one preparation step, it may use plain `Wave 0` / `W0`
  - if both baseline disposition and preflight or freeze are needed, use `Wave 0A` / `W0A` for baseline disposition and `Wave 0B` / `W0B` for preflight or freeze
- preflight or freeze should capture a reproducible `BASE_SHA` before the high-rigor wave starts
- Wave 1 parallel: Session A implement + Session B0 spec-test-design
- Wave 2 after Session A: Session C reviewer
- Wave 2 after Session A + Session B0: Session B tester
- Wave 3 after Session B + Session C: Session D lead verdict

## 4A. Execution Surface Discipline

- For any code-changing implementation or remediation wave, Session A must run in a brand-new dedicated execution worktree created from the clean routed base branch.
- Root `main` is the control surface and durable-source surface. Do not edit production code directly on root `main`.
- The control agent must name the execution worktree strategy explicitly in the routed session card:
  - base branch or ref
  - new branch name
  - whether the root checkout is read-only control surface only
- Session B0 may run read-only from the control surface because it freezes expectations against the pinned baseline.
- Session B tester may execute against the candidate execution worktree or its merged candidate state, but the routed prompt must state which surface is authoritative.
- If the host/runtime cannot guarantee a separate execution worktree for Session A, the control agent must block and emit a worktree-creation prep step instead of routing implementation on root `main`.

## 4B. Merge Closure Rule

- A code-changing wave is not complete just because Session D returned pass.
- Session D lead verdict owns merge closure for the wave:
  - either confirm that the accepted candidate has been merged back to `main`
  - or emit the exact merge/disposition step required next
- Do not mark the wave or bundle complete while merge-to-`main` is still pending, conflicted, or left as informal operator prose.
- If human approval is required before merge, Session D must record that explicitly and leave the wave in blocked merge-pending state rather than complete.
- After merge or explicit no-merge disposition, the control agent must persist a fresh durable control-state showing the post-merge truth on `main`.

## 4C. Worktree Cleanup Rule

- After merge-to-`main` or explicit no-merge archival disposition is confirmed durably, the execution worktree must be cleaned up or archived explicitly.
- Do not leave an old execution worktree as an active control surface after the wave closes.
- If the execution worktree is fully merged and clean, emit a cleanup step that removes it.
- If the execution worktree still contains unmerged or intentionally preserved state, emit an archival disposition step and rename it or its branch clearly before removing it from active use.
- A closed wave is not operationally complete until:
  - merge/disposition is confirmed
  - post-merge durable control-state is persisted
  - execution worktree cleanup/archive disposition is confirmed

## 5. Required Artifacts

A phase should not advance without:
- implementation summary
- spec-test-design report or equivalent verification-owned artifact when high rigor applies
- test report
- review report
- lead verdict or explicit phase verdict
- merge/disposition confirmation when the wave changed production code
- execution worktree cleanup/archive confirmation when the wave used a dedicated coding surface
- refreshed durable control-state when a canonical plan reports path is already in scope

For in-scope user-facing or operator-facing workflows, the required `test report` must include:
- the real-workflow e2e harness used, such as browser automation, MCP execution, or CLI execution
- the exact workflow covered
- pass or fail status for that workflow
- if coverage is `N/A`, an explicit justification and residual-risk statement

Every required `test report` should also include:
- exact commands run
- execution surface used, such as worktree path, browser channel, CI job, or external host
- exit code or equivalent terminal status for each required command or harness step
- raw artifact, log, trace, screenshot, or report paths that support the claimed result
- any CI or machine-gate identifier and final status when such a gate was used

Every required `lead verdict` should also include:
- the exact tester artifacts and review artifacts inspected
- the raw evidence references checked, not just prose summaries
- whether a machine gate or CI gate was required for merge closure, and its status
- an explicit blocked state when the tester artifact lacks command-level evidence or when a required gate is missing or failing

Every runnable session prompt must also embed a `## Paste-Back Contract` section inside the fenced prompt body. Outer session-card metadata alone is insufficient.

When the intended baseline is still dirty, unlanded, or unsynced, the control agent must emit a runnable baseline-disposition session card. Do not leave that step as operator-only prose by default.

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

## 6. Control-State Persistence

After a meaningful artifact is pasted back or the task framing changes materially, the control agent must:
- recompute normalized control state
- persist a concise `control-state` snapshot under `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports` before emitting new runnable downstream prompts when that path is in scope
- update any active `plan.md` references or progress notes if the phase state changes
- repeat any active host verification constraint explicitly so later sessions do not rediscover the same failure from scratch

The control-state snapshot must include:
- current objective
- current phase
- rigor mode
- pinned `BASE_SHA`, if any
- candidate ref, if any
- active execution worktree or merge surface, when code work is in flight
- completed artifacts
- waiting dependencies
- next runnable sessions
- reduced-rigor exceptions
- active host verification constraints, if any
- unresolved questions or blockers

If baseline disposition is still pending, the snapshot should list that prep session explicitly as the next runnable step.

## 7. Model And Modal Guidance

- planning / spec-test-design / docs / verdict: prefer `gpt-5.4 / medium`
- review: prefer `gpt-5.4 / high`
- implementation / debugging: prefer `gpt-5.3-codex / high`
- testing: prefer `gpt-5.3-codex / medium`

If the host exposes modal selection:
- planning or reasoning modal for planner, spec-test-designer, reviewer, and lead verdict
- coding modal for fullstack-developer, debugger, and tester

## 8. Current Plan Baseline

- plan: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md`
- active phase spec: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/phase-01-archive-confirmation-contract-alignment.md`
- detected current phase: `Phase 1: Archive Confirmation Contract Alignment`
- phase state: `ready_for_planner`
- pinned `BASE_SHA`: `c11a8abf11703df92b4c81152d39d52f356964bd`
- latest durable control-state: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-runtime-stabilization-ready-20260404-214000.md`
- routing note: start with planner-first decomposition before any implementation or independent verification wave

## 9. Enforcement

The control agent must stop phase advancement when:
- required artifacts are missing
- a runnable session depends on missing upstream evidence
- a high-rigor wave should have a durable control-state snapshot but does not
- the plan acceptance criteria are not yet evidenced by implementation, test, and review artifacts
- a public workflow path in scope remains synthetic
- required real-workflow e2e evidence for an in-scope user-facing or operator-facing workflow is missing, failed, or replaced by an unjustified `N/A`
- the tester artifact lacks command-level evidence, execution-surface disclosure, or raw evidence references for a claimed result
- a required machine gate or CI gate is missing, failing, or left implicit when the wave requires it
- chooser or approval continuation in scope remains stubbed or null
- a frozen Session B0 self-check was required but skipped without an explicit blocker
