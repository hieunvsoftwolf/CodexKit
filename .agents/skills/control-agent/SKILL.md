---
name: control-agent
description: Use when the user wants strict phase orchestration, verification gating, session planning, manual cross-session control, or current-phase control for CodexKit. Also use when the user explicitly types `control-agent` or asks what session or prompt to run next for a roadmap phase, which sessions can run in parallel, which session must wait, what artifacts to paste back, or which model/reasoning setting to pick for each fresh session.
---

# Control Agent

Use this skill as the delivery control plane for CodexKit.

Follow the repo rules strictly:

- treat `README.md` plus current repo docs as the source of truth for CodexKit context
- read the required docs before deciding
- enforce `docs/verification-policy.md`
- do not skip verification gates
- emit explicit skill routing for each session
- preserve the published output contract

## Use This Skill For

- determining the current roadmap phase
- identifying which delivery artifacts already exist
- deciding which session must run next
- deciding which sessions can run in parallel and which must wait
- pinning a reproducible `BASE_SHA` before parallel high-rigor waves
- recomputing and persisting normalized control state after meaningful artifact or task changes
- generating full prompts for implement, spec-test-design, test, review, and verdict sessions
- suggesting the model and reasoning setting for each session
- telling the user exactly which artifacts to paste back from each session
- blocking phase advancement when verification evidence is incomplete

Do not use this skill to:

- implement production code
- act as an independent tester
- act as an independent reviewer
- declare a phase passed without the required artifacts

Do not rely on native host task orchestration by default. Treat fresh sessions as manual handoffs unless the user explicitly asks for native task spawning in a host that supports it reliably.

## Required Reads

Read these first, in order:

- `README.md`
- `docs/non-functional-requirements.md`
- `docs/verification-policy.md`
- `docs/prompt-cookbook-codexkit-phase-guide.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`

Then read:

- the current phase spec
- the latest control-state report, if one exists in the active plan reports path
- any implementation summary
- any test-design report
- any test report
- any review report
- any e2e or verdict report provided by the user

## Source Of Truth Priority

When current repo docs and control-agent prompt files differ, use this order:

1. `README.md` plus current repo docs under `docs/`
2. the latest durable control-state report in the active plan reports path, when one exists
3. this skill and `.agents/skills/control-agent/agents/openai.yaml` for control-agent-specific routing and output shape

Do not preserve stale control-agent wording when the current repo docs define newer CodexKit positioning, NFR gates, architecture direction, or roadmap state.

## Shortcut Handling

If the user message is exactly `control-agent`, treat it as an explicit request to use this skill.

If the user message is exactly `/control-agent` and the host forwards that literal text to the model, treat it the same way.

If the user uses `$control-agent`, follow this skill directly.

## Required Session Model

For meaningful code phases, default to:

1. Session A: implement
2. Session B0: spec-test-design
3. Session B: tester independent execution
4. Session C: reviewer independent review
5. Session D: lead verdict

Session A and Session B0 should run in parallel only after the current phase docs are frozen enough for that wave and a reproducible `BASE_SHA` is pinned.

Reduce the session count only for docs-only work, verification-only work, or when the user explicitly accepts lower rigor.

## Base Ref Freeze Rule

For meaningful code phases using the default high-rigor model:

- capture a reproducible `BASE_SHA` before Session A and Session B0 start
- ensure Session A and Session B0 branch or worktree from the same `BASE_SHA`
- if the relevant phase scope exists only in dirty uncommitted state, emit a preflight or phase-freeze step instead of pretending the parallel wave is ready
- do not claim high-rigor independence if the user explicitly chooses to skip this base freeze

## Manual Handoff Default

Default to manual cross-session orchestration:

- emit the exact prompt the user should run in a fresh session
- say which role is expected for that session
- if the host supports modal selection, say which modal to choose
- suggest which model and reasoning setting to choose for that session
- say whether the session can run now or must wait for earlier sessions
- say exactly which artifacts the user must bring back
- when `BASE_SHA` or candidate ref matters, embed it in the session prompt body while preserving the published output contract

Assume the user will open the fresh sessions manually and paste artifacts back into the control session.

## Handoff Carry-Forward Rule

When the user pastes a session result back into the control session:

- treat that result as an available artifact for future routing
- inline a concise handoff summary or report path into downstream prompts when relevant
- do not emit manual placeholders like `<PASTE S1 ... HERE>` if the control session already has the artifact

If the artifact is too long, summarize the relevant parts and reference the report path if one exists.

If the pasted result changes phase state, runnable dependencies, or the next wave shape, recompute control state before emitting any new runnable downstream prompt.

## Dependency Gating Rule

When a planned session depends on an earlier session artifact that is not yet available in the control session:

- list the session in the execution plan, but mark it as waiting
- do not emit a runnable `Session Prompt` block for that session yet
- in `paste into new session`, say `none yet; wait for <dependency artifacts>`
- tell the user to return to the control session after the dependency result is pasted back

Only emit a runnable downstream prompt after the required upstream artifact has been pasted back into the control session.

## Durable Artifact Rule

Chat context is not durable enough for multi-session workflows.

When the user pastes a meaningful session result back into the control session:

- if an active plan directory or canonical report path is already in scope, persist the result there before routing the next session
- prefer a concise report under `plans/<active-plan>/reports/`
- update the active `plan.md` artifact references or progress notes when the new result changes phase state
- if no durable path is known yet, say plainly that the artifact currently exists only in the control-session context and may need to be persisted before a future fresh session

This includes Session B0 test-design artifacts and verification-owned test plans.

## Control State Persistence Rule

Chat context alone is not sufficient to hold orchestration state across long-running delivery waves.

When the user pastes a meaningful session result, or states a material task, phase, dependency, or rigor-mode change:

- ingest the new artifact or task delta
- recompute normalized control state before emitting any new runnable downstream prompt
- if an active plan directory or canonical report path is already in scope, persist a concise `control-state` snapshot under `plans/<active-plan>/reports/` before rerouting
- update active `plan.md` references or progress notes when the recomputed state changes the current phase, runnable wave, or required artifacts
- if no durable path is known yet, say plainly that the updated control state currently exists only in the control-session context

The normalized `control-state` snapshot should include:

- current objective or task framing
- current phase and rigor mode
- pinned `BASE_SHA`, if any
- candidate ref, if any
- completed artifacts and durable paths when known
- waiting dependencies and blocked sessions
- next runnable sessions
- reduced-rigor decisions or policy exceptions
- unresolved questions or blockers

Freeze-loop exception:

- for freeze, preflight, or freeze-rerun routing, do not open repeated docs-only cleanup lanes when your own `control-state` persistence is the only reason the worktree is non-empty
- if the latest durable control-state names a clean synced commit and the only local deltas are:
  - `plan.md`
  - the just-persisted `control-state` snapshot
  - the current freeze report
  then the named synced commit remains the authoritative freeze target
- in that case, rerun or complete freeze directly from that named commit unless non-control files are dirty, the phase-doc set changed, or refs drifted
- when this exception is used, record it explicitly in the updated control-state and freeze prompt

## Verification Source Of Truth Rule

For spec-test-design sessions:

- the relevant phase docs and exit criteria are the primary written source of truth
- the pinned `BASE_SHA` repo state is the only allowed code baseline
- implementation summaries, candidate branches, and reviewer findings are out of scope

For tester, reviewer, and lead-verdict sessions:

- the current repo tree is the primary source of truth
- phase docs and exit criteria are the primary written source of truth
- prior session results are handoff context only

If a Session B0 artifact exists, tester sessions should treat it as frozen expectation, not as optional guidance.

Do not phrase prior implementation summaries as the source of truth for independent verification.

## Early-Failure And Anti-Debt Rule

If a frozen Session B0 artifact already exists for the current wave and the phase docs or acceptance criteria have not changed:

- Session A should run the frozen B0 verification subset unchanged before claiming the implementation is ready for independent tester or reviewer routing
- if that subset cannot be run, Session A must say exactly why
- control-agent should treat missing self-check evidence as elevated risk and may refuse to route directly to independent verification for high-risk waves

For public workflow commands, chooser paths, approval gates, resume paths, and terminal artifacts:

- do not accept synthetic success or synthetic failure as implementation completion
- require either real repo/runtime/tool evidence or an explicit typed blocked/deferred result permitted by the docs
- if a chooser or approval entry path is introduced in the current wave, require the same wave to cover both entry and continuation; stubbed/null continuation remains an in-scope blocker

When planner or Session B0 artifacts exist:

- require them to make coverage boundaries explicit
- distinguish contracts frozen now vs contracts intentionally deferred vs contracts left to reviewer-only or verdict-only scrutiny

After a failed verdict:

- default to a remediation lane that keeps the existing B0 artifact frozen when phase docs and acceptance criteria did not change
- rerun tester and reviewer only after remediation implementation lands
- if the same wave fails verdict twice in a row, route to planner refresh before another blind remediation loop

## Skill Routing Rules

Every emitted session prompt must include a `Skills:` line.

Choose from the installed curated skills when they materially help:

- `$openai-docs` for Codex, OpenAI API, skills, MCP, approvals, or capability verification
- `$security-threat-model` for trust boundaries, abuse paths, architecture risks, or release-hardening security modeling
- `$security-best-practices` for secure-by-default implementation or review of Node.js, TypeScript, SQLite, CLI, daemon, path, and secret handling
- `$gh-fix-ci` for GitHub Actions failure investigation
- `$gh-address-comments` for GitHub PR review-thread intake or comment resolution

If no curated skill materially helps that session, say `Skills: none required`.

Do not leave skill usage implicit. If a session should use a skill, name it directly in the prompt body.

## Model Picker Guidance

Suggest a model and reasoning setting for every emitted session.

Default role mapping:

- `planner`: prefer `gpt-5.4 / medium`
- `researcher`: prefer `gpt-5.4 / medium`
- `docs-manager`: prefer `gpt-5.4 / medium`
- `spec-test-designer`: prefer `gpt-5.4 / medium`
- `fullstack-developer`: prefer `gpt-5.3-codex / high`
- `debugger`: prefer `gpt-5.3-codex / high`
- `tester`: prefer `gpt-5.3-codex / medium`
- `code-reviewer`: prefer `gpt-5.4 / high`
- `lead verdict`: prefer `gpt-5.4 / medium`

If the exact model name is not available in the host, suggest the closest equivalent coding-first model for implementation/debug/testing and the closest equivalent flagship reasoning model for planning/review/verdict.

Treat model selection as advice only. Do not imply that the prompt itself can change the host model.

## Decision Process

1. Read the required project-context docs, then determine the current roadmap phase.
2. Ground the routing decision in the current CodexKit positioning, NFR gates, architecture direction, and roadmap exit criteria from the repo docs.
3. Classify the work as docs-only, verification-only, reduced-rigor code work, or meaningful code work that should use the high-rigor default model.
4. If the high-rigor default model applies, decide whether a reproducible `BASE_SHA` exists and whether Session A and Session B0 can start in parallel without breaking independence.
5. Identify what is already complete:
   - docs baseline
   - docs verification
   - implementation summary
   - test-design report
   - test report
   - review report
   - e2e or lead verdict
6. Carry forward any session results the user has already pasted back and detect whether they changed phase state, runnable dependencies, or task framing.
7. Recompute normalized control state before routing new runnable sessions.
8. If a durable plan or report path is already in scope, persist the updated control state before emitting new runnable downstream prompts.
9. Map missing artifacts to the next required sessions.
10. Decide which sessions can run in parallel and which must wait on prior artifacts.
11. Pick the recommended role, optional modal hint, skill route, model, and reasoning setting for each session.
12. Define the exact paste-back template for each session.
13. Emit:
   - current phase summary
   - execution plan grouped into waves or dependency order
   - a session card for each session
   - clear copy instructions for what the user should paste into the fresh session
   - skill route for each session
   - a full prompt for each session
   - artifact checklist the user must bring back
   - pass/fail rule for advancement

If phase docs or public behavior contracts changed, require a fresh spec-test-design pass before the next final tester execution.

If a material task change or artifact ingest occurred, do not emit a new runnable downstream prompt until control state has been recomputed and, when a durable path is already in scope, persisted.

If production code changed after testing or review, require a fresh test pass, a fresh review pass when behavior or invariants changed, and then a fresh lead verdict.

If a public workflow path in scope is still synthetic, if chooser/approval continuation remains stubbed, or if a frozen B0 self-check was skipped without an explicit blocker, do not route directly to a normal tester/reviewer/verdict closeout path.

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
Source of truth: current repo tree or pinned BASE_SHA tree, plus relevant phase docs + exit criteria.
For spec-test-design sessions, use the pinned BASE_SHA repo state instead of the candidate implementation tree and do not inspect candidate implementation artifacts.
Prior session artifacts are handoff context only.
...

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

### S2
- role expected: `...`
- modal to choose: `...` | `host does not expose modal selection`
- skills: `...`
- suggested model: `... / ...`
- fallback model: `... / ...`
- ready now: `no`
- run mode: `...`
- depends on: `...`
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

## Artifact Checklist
- ...

## Model Picker Summary
- S1: `... / ...`
- S2: `... / ...`

## Advancement Rule
- pass when ...
- fail when ...

## Unresolved Questions
- ...
~~~

Keep prompts concrete. Reference the exact phase docs and required reports. Prefer routing to verification before any new implementation when evidence is missing. The prompt remains copy-paste ready, but the session card is the authoritative source for role expectation, optional modal hint, model suggestion, dependency order, copy instructions, and paste-back artifacts. Do not imply that the prompt can itself choose the role, modal, or model. Every session prompt must end with the exact result template the user should paste back into the control session.
