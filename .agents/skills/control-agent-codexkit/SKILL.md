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

## TDD, Parallel, And Dependency Rules

- Session B0 derives the verification contract from plan acceptance criteria and testing strategy before the candidate implementation is inspected.
- Session A and Session B0 may run in parallel only after a reproducible `BASE_SHA` exists and the current phase docs are stable enough for the wave.
- Allow multiple implementation sessions only when ownership is clearly split across disjoint files or components.
- Sequence work when tasks share files, schemas, generated artifacts, or unresolved interfaces.
- Session B waits for Session A + Session B0.
- Session C waits for Session A.
- Session D waits for Session B + Session C.

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
6. Decide whether the next step is preflight, planner-first decomposition, or a runnable implementation / verification wave.
7. Emit the execution plan, session cards, skill routing, model hints, paste-back contract, and advancement rule.

## Output Contract

Use this structure by default:

~~~markdown
## Current Phase
- phase: ...
- state: ...

## Execution Plan
- Wave 1 parallel:
  - S1 ...
  - S2 ...
- Wave 2 after S1 + S2:
  - S3 ...

## Session Cards
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
