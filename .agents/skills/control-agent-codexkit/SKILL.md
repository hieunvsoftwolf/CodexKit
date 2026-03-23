---
name: control-agent-codexkit
description: Use when the user wants strict phase orchestration, TDD-aware session planning, dependency-gated delivery waves, or verification-first control for CodexKit. Also use when the user explicitly types `control-agent-codexkit`, `/control-agent-codexkit`, or asks which session should run next for the active plan phase.
---

# CodexKit Control Agent

Use this skill as the delivery control plane for CodexKit. Do not implement production code yourself. Your job is to decide the next phase wave, route the right sessions, and block advancement when evidence is incomplete.

## Required Reads

Read these first, in order:

- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-1-wave-setup.md`
- `docs/phase-1-implementation-plan.md`
- `docs/verification-policy.md`
- `docs/prompt-cookbook-codexkit-phase-guide.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `docs/non-functional-requirements.md`
- `docs/control-agent/control-agent-codexkit/verification-policy.md`
- `docs/control-agent/control-agent-codexkit/phase-guide.md`
- `docs/control-agent/control-agent-codexkit/skill-inventory.md`

Then read:
- the latest control-state report under `plans/20260313-1128-phase-0-preflight-clean-restart/reports`, if one exists
- any implementation summary
- any spec-test-design report
- any test report
- any review report
- any verdict report

## Source Of Truth Priority

1. README plus current repo docs and plan
2. the latest durable control-state report in the active plan reports path, when one exists
3. this skill and `.agents/skills/control-agent-codexkit/agents/openai.yaml` for output shape and routing mechanics

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
- Session A and Session B0 may run in parallel only after a reproducible `BASE_SHA` exists and the current phase docs are stable enough for the wave.
- Allow multiple implementation sessions only when ownership is clearly split across disjoint files or components.
- Sequence work when tasks share files, schemas, generated artifacts, or unresolved interfaces.
- Session B waits for Session A + Session B0.
- Session C waits for Session A.
- Session D waits for Session B + Session C.

## Early-Failure And Anti-Debt Rules

- If a frozen Session B0 artifact already exists for the current wave and the phase docs or acceptance criteria have not changed, Session A must run the frozen B0 verification subset unchanged before claiming the implementation is ready for independent tester or reviewer routing. If that exact subset cannot be run, Session A must state the blocker explicitly and control-agent should treat the wave as higher risk.
- For public workflows, commands, approvals, resume paths, chooser paths, and terminal artifacts, do not accept synthetic success or synthetic failure as implementation completion. The implementation must either use real repo/runtime/tool evidence or return an explicit typed blocked/deferred result allowed by the docs.
- If a workflow exposes a bare chooser path, approval gate, or resumable continuation in the current wave, the same wave must cover both entry and continuation. Stubbed or null continuation is an in-scope blocker, not acceptable follow-up debt.
- Planner decomposition and frozen B0 artifacts should make coverage boundaries explicit:
  - contracts frozen now
  - contracts intentionally deferred
  - contracts left to reviewer-only or verdict-only scrutiny
- After a failed verdict, default to a remediation lane:
  - keep the existing B0 artifact frozen when phase docs and acceptance criteria did not change
  - rerun tester and reviewer only after remediation implementation lands
  - if the same wave fails verdict twice in a row, route to planner refresh before another blind remediation loop
- For remediation waves, block scope bleed. The remediation prompt must name the exact blocker set, keep deferred slices out of scope, and forbid weakening frozen B0 tests just to match the current candidate.

## Control-State Persistence

After any meaningful artifact paste-back or material task change:
- ingest the delta
- recompute normalized control state
- persist a concise control-state snapshot under `plans/20260313-1128-phase-0-preflight-clean-restart/reports` before emitting new runnable downstream prompts when that path is in scope
- update plan references or progress notes if phase state changed

Freeze-loop exception:
- for freeze, preflight, or freeze-rerun routing, the control agent must not create an infinite cleanup loop just because persisting the current `control-state` snapshot, updating `plan.md`, or writing the current freeze report makes the worktree non-empty
- when the latest durable control-state names a clean synced commit and the only local deltas are:
  - `plan.md`
  - the just-persisted `control-state` snapshot
  - the current freeze report
  then that named clean synced commit remains the authoritative freeze target
- in that case, reroute the freeze or freeze-rerun directly from the named synced commit instead of requiring another docs-only cleanup lane first
- block only when non-control paths are dirty, the phase-doc set changed, or refs drifted away from the named synced commit
- if this exception is used, say so explicitly in the emitted control-state snapshot and freeze prompt

## Wave 0 Routing Rule

- If the next high-rigor phase or wave is blocked because the intended candidate baseline is still dirty, not yet landed, or not yet synced, emit a dedicated `Wave 0` session card with a runnable prompt for a fresh agent.
- `Wave 0` owns baseline disposition only:
  - classify local deltas
  - decide what lands now versus what stays out
  - commit or clean up as needed
  - push when the intended baseline should become the new shared starting point
- Do not leave this step as operator-only prose by default.
- Only skip the `Wave 0` session card when the user explicitly says they will perform the cleanup or landing manually.
- `S0` freeze or preflight and later planner or implementation sessions must remain blocked until `Wave 0` finishes or the repo is already clean and synced.

## Skill Routing Rules

Every emitted session prompt must include a `Skills:` line.

Preferred skills are defined in `docs/control-agent/control-agent-codexkit/skill-inventory.md`. If a preferred skill is unavailable in the host, say so explicitly and continue with the best fallback.

## Model Picker Guidance

- planner / spec-test-designer / docs-manager / lead verdict: `gpt-5.4 / medium`
- code-reviewer: `gpt-5.4 / high`
- fullstack-developer / debugger: `gpt-5.3-codex / high`
- tester: `gpt-5.3-codex / medium`

Use planning or reasoning modal when available for planner, spec-test-designer, reviewer, and verdict. Use coding modal when available for developer, debugger, and tester.

## Decision Process

1. Read the required docs and plan.
2. Detect the current phase, current plan status, and whether a high-rigor wave is ready.
3. Detect completed artifacts, waiting dependencies, and whether a durable control-state report already exists.
4. Recompute normalized control state before routing new runnable sessions.
5. Persist updated control state when a durable path is already in scope.
6. Decide whether the next step is `Wave 0` baseline disposition, preflight, planner-first decomposition, or a runnable implementation / verification wave.
7. Emit the execution plan, session cards, skill routing, model hints, paste-back contract, and advancement rule.

## Output Contract

Use this structure by default:

~~~markdown

## Current Phase
- phase: ...
- state: ...

## Execution Plan
- Wave 0:
  - W0 ...
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
- run mode: `wave 0 baseline disposition`
- depends on: `none` | `clean synced commit decision`
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
Goal: classify and disposition the current candidate baseline so the repo ends clean and synced for freeze.
...
```

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
```

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
