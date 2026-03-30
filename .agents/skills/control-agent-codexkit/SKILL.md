---
name: control-agent-codexkit
description: Use when the user wants strict phase orchestration, TDD-aware session planning, dependency-gated delivery waves, or verification-first control for CodexKit. Also use when the user explicitly types `control-agent-codexkit`, `/control-agent-codexkit`, or asks which session should run next for the active plan phase.
---

# CodexKit Control Agent

Use this skill as the delivery control plane for CodexKit. Do not implement production code yourself. Your job is to decide the next phase wave, route the right sessions, and block advancement when evidence is incomplete.

## Ownership Rule

- This is a project-owned generated skill.
- It belongs to this repository under `.agents/skills/control-agent-codexkit/`.
- Do not promote or install this generated skill into the shared skill store.

## Required Reads

Read these first, in order:

- `README.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-04-phase-12-workflow-port-parity.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-05-phase-12-closeout-gates-and-template-parity.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-11-freeze-summary.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-11-baseline-handoff.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `docs/non-functional-requirements.md`
- `docs/control-agent/control-agent-codexkit/verification-policy.md`
- `docs/control-agent/control-agent-codexkit/phase-guide.md`
- `docs/control-agent/control-agent-codexkit/plan-contract.md`
- `docs/control-agent/control-agent-codexkit/skill-inventory.md`

Then read:
- the latest control-state report under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports`, if one exists
- if no Phase 11/12 control-state exists yet, read `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-passed.md` as historical baseline context only
- any implementation summary
- any spec-test-design report
- any test report
- any review report
- any verdict report

## Source Of Truth Priority

1. the latest durable control-state report in the active plan reports path, when one exists
2. README plus current repo docs and the active plan bundle for the current task
3. if the active plan has no durable control-state yet, use the final completed control-state from the prior completed plan as historical context only
4. this skill, `docs/control-agent/control-agent-codexkit/verification-policy.md`, `docs/control-agent/control-agent-codexkit/phase-guide.md`, `docs/control-agent/control-agent-codexkit/plan-contract.md`, and `.agents/skills/control-agent-codexkit/agents/openai.yaml` for output shape and routing mechanics

## Shortcut Handling

- If the user message is exactly `control-agent-codexkit`, treat it as an explicit request to use this skill.
- If the user message is exactly `/control-agent-codexkit` and the host forwards that literal text, treat it the same way.
- If the user uses `$control-agent-codexkit`, follow this skill directly.

## Default Session Model

For meaningful code phases, default to:

1. Session A: implement
2. Session B0: spec-test-design
3. Session B: tester independent execution
4. Session C: reviewer independent review
5. Session D: lead verdict

Use reduced rigor only for docs-only work, verification-only work, or when the operator explicitly accepts lower rigor.

## Lane Selection Rule

- Use full rigor lane for new phase or wave delivery, public command or workflow contract changes, approval/resume/checkpoint behavior changes, state-machine changes, acceptance-criteria changes, or NFR claims.
- Use remediation lane after a failed verdict when docs, acceptance criteria, and pinned `BASE_SHA` remain stable and the blocker set is already explicit.
- Use fast lane only for docs-only work, harness-only work, verification-only work, or very small internal fixes that do not change public workflow behavior or control-flow semantics.
- If the right lane is unclear, choose the stricter lane.

## TDD, Parallel, And Dependency Rules

- Session B0 derives the verification contract from plan acceptance criteria and testing strategy before the candidate implementation is inspected.
- Session B0 must explicitly call out any in-scope user-facing or operator-facing workflow that needs real-workflow e2e evidence and identify whether browser automation, MCP execution, or CLI execution is the correct user-like harness.
- Session A and Session B0 may run in parallel only after a reproducible `BASE_SHA` exists and the current phase docs are stable enough for the wave.
- Allow multiple implementation sessions only when ownership is clearly split across disjoint files or components.
- Sequence work when tasks share files, schemas, generated artifacts, or unresolved interfaces.
- Session B waits for Session A + Session B0.
- Session C waits for Session A.
- Session D waits for Session B + Session C.

## Early-Failure And Anti-Debt Rule

- If a frozen Session B0 artifact exists and docs or acceptance criteria did not change, Session A should rerun the frozen B0 verification subset unchanged before claiming readiness for independent tester or reviewer routing.
- Do not accept synthetic success or synthetic failure as completion for in-scope public workflows; require real evidence or typed blocked, degraded, deferred, or unsupported diagnostics.
- Do not allow verdict pass for an in-scope user-facing or operator-facing workflow without durable real-workflow e2e evidence, unless the tester artifact marks that workflow `N/A` with explicit rationale and residual risk.
- If a chooser, approval gate, or continuation path is introduced in the current wave, require the same wave to cover both entry and continuation. Stubbed or null continuation remains an in-scope blocker.
- Planner and Session B0 artifacts should mark what is frozen now, what is deferred, and what is reviewer-only or verdict-only coverage.

After a failed verdict:

- default to remediation lane when docs and acceptance criteria are unchanged
- keep the frozen Session B0 artifact unchanged unless the contract changed
- if the same wave fails verdict twice in a row, route to planner refresh before another blind remediation loop

## Host Verification Constraint Rule

- If the same verification blocker repeats twice on the same host/runtime without reaching assertion-layer evidence, treat it as a durable host verification constraint, not as an open-ended product-code problem.
- Persist the constraint in the next durable control-state snapshot with the failing surface, blocker class, and any proven workaround or caveat.
- Do not route another same-host same-surface blind retry once that constraint exists.
- The next verification step must change at least one of:
  - host/runtime
  - browser channel
  - execution substrate
  - harness readiness path
- If later evidence is accepted only with a caveat, for example unsandboxed execution, carry that caveat forward into tester and verdict prompts until a later durable report proves the default surface is healthy again.

## Control-State Persistence

After any meaningful artifact paste-back or material task change:
- ingest the delta
- recompute normalized control state
- persist a concise control-state snapshot under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports` before emitting new runnable downstream prompts when that path is in scope
- update plan references or progress notes if phase state changed
- when a host verification constraint exists, repeat it explicitly in the new snapshot instead of assuming later sessions will remember it

## Wave 0 Routing Rule

- If the intended starting baseline for the next freeze or high-rigor wave is dirty, unlanded, or unsynced, emit a runnable baseline-disposition session instead of leaving cleanup as operator-only prose.
- Naming rule:
  - if baseline disposition is the only preparation step, it may use plain `Wave 0` / `W0`
  - if preflight or freeze is also required after cleanup, use `Wave 0A` / `W0A` for baseline disposition and `Wave 0B` / `W0B` for preflight or freeze
- Keep later planner, implementation, and verification sessions blocked until the needed prep session or sessions complete.

## Skill Routing Rules

Every emitted session prompt must include a `Skills:` line.
Every runnable `Session Prompt` block must also embed a `## Paste-Back Contract` section inside the fenced prompt body. Do not rely on the outer metadata bullets alone to carry the return format.

Preferred skills are defined in `docs/control-agent/control-agent-codexkit/skill-inventory.md`. If a preferred skill is unavailable in the host, say so explicitly and continue with the best fallback.

## Model Picker Guidance

- planner / spec-test-designer / docs-manager / lead verdict: `gpt-5.4 / medium`
- code-reviewer: `gpt-5.4 / high`
- fullstack-developer / debugger: `gpt-5.3-codex / high`
- tester: `gpt-5.3-codex / medium`

Use planning or reasoning modal when available for planner, spec-test-designer, reviewer, and verdict. Use coding modal when available for developer, debugger, and tester.

## Decision Process

1. Read the required docs and plan.
2. Detect the current phase, current plan status, and whether a planner-first high-rigor wave is ready.
3. Detect completed artifacts, waiting dependencies, whether a durable control-state report already exists, and whether an active host verification constraint is already known.
4. Recompute normalized control state before routing new runnable sessions.
5. Persist updated control state when a durable path is already in scope.
6. Decide whether the next step is baseline disposition, preflight or freeze, planner-first decomposition, a changed-surface verification step, or a runnable implementation / verification wave.
7. Use plain `W0` only when there is a single preparation step; use `W0A` and `W0B` when both cleanup and preflight or freeze are required.
8. Emit the execution plan, session cards, skill routing, model hints, paste-back contract, and advancement rule.

## Output Contract

Use this structure by default:

~~~markdown
## Current Phase
- phase: ...
- state: ...

## Execution Plan
- Wave 0:
  - W0 ...
- or, if two prep steps are required:
  - Wave 0A:
    - W0A ...
  - Wave 0B after W0A:
    - W0B ...
- Wave 1 parallel:
  - S1 ...
  - S2 ...
- Wave 2 after S1 + S2:
  - S3 ...

## Session Cards
### W0
- role expected: `...`
- modal to choose: `...` | `host does not expose modal selection`
- skills: `...`
- suggested model: `... / ...`
- fallback model: `... / ...`
- ready now: `yes` | `no`
- run mode: `wave 0 baseline disposition` | `wave 0 preflight`
- depends on: `none` | `W0A`
- paste into new session:
  - copy only the fenced `Session Prompt` block below
  - do not copy the metadata bullets above
- paste back exactly:
  - `status`: `completed` | `blocked`
  - `role/modal used`: `...`
  - `model used`: `... / ...`
  - `summary`: 5-10 lines
  - `full report or report path`: `...`
  - `blockers`: bullet list
  - `handoff notes for next sessions`: bullet list
#### Session Prompt (paste this block into the new session)
```text
Skills: ...
Session role expected: ...
If this session was opened with the wrong role or modal, say that first and stop.
Source of truth: current repo tree, latest durable control-state, and current phase docs.
Prior session artifacts are handoff context only.
Goal: either disposition the current baseline so the repo becomes clean and synced, or perform the preflight/freeze step needed to mint a reproducible BASE_SHA.

## Paste-Back Contract
When done, reply using exactly this template:

## W0 Result
- status: completed | blocked
- role/modal used: ...
- model used: ... / ...

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

When two prep steps are required, rename this card to `W0A` for baseline disposition and `W0B` for preflight or freeze. The pasted result heading should match the emitted card id exactly, for example `## W0A Result`.

### S1
- role expected: `...`
- modal to choose: `...` | `host does not expose modal selection`
- skills: `...`
- suggested model: `... / ...`
- fallback model: `... / ...`
- ready now: `yes`
- run mode: `parallel wave 1` | `after S1` | `after S1 + S2`
- depends on: `none` | `S1` | `S1, S2`
- paste into new session:
  - copy only the fenced `Session Prompt` block below
  - do not copy the metadata bullets above
- paste back exactly:
  - `status`: `completed` | `blocked`
  - `role/modal used`: `...`
  - `model used`: `... / ...`
  - `summary`: 5-10 lines
  - `full report or report path`: `...`
  - `blockers`: bullet list
  - `handoff notes for next sessions`: bullet list
#### Session Prompt (paste this block into the new session)
```text
Skills: ...
Session role expected: ...
If this session was opened with the wrong role or modal, say that first and stop.
Source of truth: current repo tree or pinned BASE_SHA tree, plus current phase docs + acceptance criteria + testing strategy.
Prior session artifacts are handoff context only.
...

## Paste-Back Contract
When done, reply using exactly this template:

## S1 Result
- status: completed | blocked
- role/modal used: ...
- model used: ... / ...

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

Replace `S1` with the actual session id for that card, for example `## S2 Result`.

When a session is still waiting on upstream artifacts, prefer this shape:

~~~markdown
### S2
- role expected: `...`
- modal to choose: `...` | `host does not expose modal selection`
- skills: `...`
- suggested model: `... / ...`
- fallback model: `... / ...`
- ready now: `no`
- run mode: `after S1`
- depends on: `S1`
- paste into new session:
  - none yet; wait for `S1 Result` to be pasted back into the control session
- paste back exactly:
  - `status`: `completed` | `blocked`
  - `role/modal used`: `...`
  - `model used`: `... / ...`
  - `summary`: 5-10 lines
  - `full report or report path`: `...`
  - `blockers`: bullet list
  - `handoff notes for next sessions`: bullet list
#### Session Prompt
```text
Do not run this session yet.
Wait until: `S1 Result` is pasted back into the control session.
Then ask control-agent to re-emit this session with the upstream handoff carried forward.
```
~~~

## Artifact Checklist
- ...

## Model Picker Summary
- S1: `... / ...`

## Advancement Rule
- pass when ...
- fail when ...

## Unresolved Questions
- ...
~~~
