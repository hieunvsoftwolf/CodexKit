# Verification Policy

**Project**: CodexKit
**Last Updated**: 2026-03-13
**Purpose**: Define the required multi-session verification model for roadmap phases

## 1. Default Model

Meaningful code phases should use this high-rigor default delivery model:

1. Session A: `implement`
2. Session B0: `spec-test-design`
3. Session B: `tester` independent execution
4. Session C: `reviewer` independent review
5. Session D: `lead verdict`

Sessions A and B0 may run in parallel only after the control agent pins a reproducible `BASE_SHA` and the current phase docs and exit criteria are treated as frozen enough for that wave.

Docs-only work, verification-only work, or user-approved reduced-rigor work may use fewer sessions.

## 2. Why

Same-session role switching helps workflow discipline, but it is not independent verification.

Main risks:
- implementation bias
- tests shaped around code instead of spec
- acceptance expectations drifting after the candidate implementation is already visible
- softened review caused by prior rationale
- false confidence from shared context

Therefore:
- implementation and verification must be separated
- meaningful code phases should freeze verification expectations before the candidate implementation is inspected
- tester and reviewer must not rely on chat history from implementation
- pass/fail verdict must be based on artifacts, not trust

For independent verification:
- Session B0 uses the pinned `BASE_SHA` repo state plus the phase docs and exit criteria as the source of truth
- Sessions B, C, and D use the current candidate repo tree plus the phase docs and exit criteria as the source of truth
- implementation summaries and prior session results are handoff context only

## 3. Session Roles

### Session A: Implement

Allowed:
- planning
- contract freeze
- implementation
- implementation-adjacent unit or integration tests
- implementation summary

Not allowed:
- declaring the phase passed
- acting as independent reviewer
- acting as independent tester for final verdict

Required output:
- implementation summary
- files changed
- tests added and tests run
- known risks
- handoff note for tester and reviewer

### Session B0: Spec-Test-Design

Must run in a separate session from implementation and from the same pinned `BASE_SHA`.

Scope:
- derive acceptance and integration expectations from docs, exit criteria, and public behavior contracts
- define commands, fixtures, and expected failures before inspecting the candidate implementation
- author verification-owned tests or harness code only when the target test scope is already stable enough
- publish a durable design artifact that the final tester can execute against the candidate implementation

Not allowed:
- reading the implementation summary or candidate implementation branch
- changing production code
- weakening expected behavior to fit likely implementation shortcuts

Required output:
- test-design report
- tests or harness added in owned verification scope, if any
- planned commands and fixtures
- explicit mapping to phase exit criteria
- blocking assumptions or missing harness needs

### Session B: Tester

Must run in a separate session from implementation.
Should run after Session A and Session B0 when the high-rigor default model is in use.

Scope:
- verify against docs, exit criteria, and public behavior
- assume code may be wrong
- treat the Session B0 artifact as frozen expectation when it exists
- execute Session B0-authored tests unchanged first when they exist
- add acceptance or integration tests only for doc-derived gaps or verification-harness gaps

Not allowed by default:
- changing production code
- rewriting expected behavior to match implementation rationale

Required output:
- test report
- commands run
- failures or gaps
- explicit mapping to phase exit criteria
- note whether Session B0-authored verification passed unchanged or required verification-only amendments and why

### Session C: Reviewer

Must run in a separate session from implementation.

Scope:
- findings-first review against spec and code
- identify bugs, invariants violations, restart-safety risks, state machine risks, and testing gaps

Not allowed:
- editing code
- relying on prior implementation rationale

Required output:
- `CRITICAL`
- `IMPORTANT`
- `MODERATE`
- explicit `no findings` if clean

### Session D: Lead Verdict

Scope:
- compare implementation summary, test report, and review report against phase exit criteria
- decide pass or fail
- define blocker list if fail
- define next session target if pass

Required output:
- phase verdict: `pass` or `fail`
- blockers
- next action

## 4. Control Agent

The main lead session is the control agent.

The control agent is responsible for:
- choosing the current phase
- selecting the required session model
- pinning a reproducible `BASE_SHA` before any high-rigor parallel implementation and test-design wave
- recomputing and persisting normalized control state after meaningful artifact ingest or task change before emitting new downstream routing
- emitting prompts for Sessions A, B0, B, C, and D
- deciding which sessions can run in parallel and which must wait
- recommending the model and reasoning setting for each session
- defining the paste-back artifacts required from each fresh session
- refusing to advance a phase without required artifacts
- deciding when re-test or re-review is required
- routing the next session after a failed verdict

The control agent does not replace tester or reviewer independence.

Default control mode is manual handoff across fresh sessions, not native host task orchestration. The user may open sessions manually, run the emitted prompt in the suggested agent/model, and paste artifacts back into the control session.

For meaningful code phases, the default dependency shape is:
- Wave 1 parallel: Session A implement + Session B0 spec-test-design
- Wave 2 after Session A: Session C reviewer independent review
- Wave 2 after Session A + Session B0: Session B tester independent execution
- Wave 3 after Session B + Session C: Session D lead verdict

## 4A. Skill Routing Rule

The control agent must emit an explicit skill route for every session it plans.

Default mappings:
- use `$openai-docs` for OpenAI, Codex, MCP, skills, approvals, and capability verification
- use `$security-threat-model` for architecture risk and trust-boundary analysis
- use `$security-best-practices` for secure-by-default implementation or review in runtime code
- use `$gh-fix-ci` for GitHub Actions failure investigation
- use `$gh-address-comments` for PR review-thread intake or resolution

If a session does not need any curated skill, say so explicitly as `none required`.

## 4B. Model Picker Rule

The control agent must suggest a model and reasoning setting for every emitted session.

Default mapping:
- `planner`: `gpt-5.4 / medium`
- `researcher`: `gpt-5.4 / medium`
- `docs-manager`: `gpt-5.4 / medium`
- `spec-test-designer`: `gpt-5.4 / medium`
- `fullstack-developer`: `gpt-5.3-codex / high`
- `debugger`: `gpt-5.3-codex / high`
- `tester`: `gpt-5.3-codex / medium`
- `code-reviewer`: `gpt-5.4 / high`
- `lead verdict`: `gpt-5.4 / medium`

If the exact model name is not available in the host, choose the closest coding-first model for implementation/debug/testing and the closest flagship reasoning model for planning/review/verdict.

Model choice is advisory. The prompt itself does not select the host model.

## 4C. Session Card Rule

For each planned fresh session, the control agent must emit a session card with:
- role expected
- modal hint if the host exposes modal selection
- `Skills:` route
- suggested model
- fallback model
- ready-now status
- run mode
- dependency list
- explicit copy instructions for what the user should paste into the fresh session
- paste-back template
- full copy-paste prompt

Default control-agent output should include:
- `## Current Phase`
- `## Execution Plan`
- `## Session Cards`
- `## Artifact Checklist`
- `## Model Picker Summary`
- `## Advancement Rule`
- `## Unresolved Questions`

If the user has already pasted a prior session result into the control session, the control agent should carry it forward into the next prompt as a concise handoff summary or report path. Do not emit manual placeholders like `<PASTE S1 ... HERE>` when the artifact is already available.

If a planned session depends on an artifact that is not yet available in the control session:
- list it as waiting
- do not emit a runnable fresh-session prompt yet
- in `paste into new session`, say `none yet; wait for <dependency artifacts>`
- tell the user to return after the dependency result is pasted back, then re-emit the downstream session with the handoff carried forward

Because chat context is not durable enough for long workflows:
- if an active plan directory or canonical report path is already in scope, the control agent should persist meaningful session results there before routing the next session
- prefer concise reports under `plans/<active-plan>/reports/`
- update `plan.md` artifact references or progress notes when the new result changes phase state
- if no durable path is known yet, the control agent should say so explicitly

## 4D. Control State Persistence Rule

When the user pastes a meaningful session result back into the control session, or states a material task, phase, dependency, or rigor-mode change, the control agent should:
- ingest the new artifact or task delta
- recompute the normalized control state before routing any new downstream session
- if an active plan directory or canonical report path is already in scope, persist a concise `control-state` snapshot under `plans/<active-plan>/reports/` before emitting new runnable downstream prompts
- update the active `plan.md` references or progress notes when the recomputed state changes the current phase, runnable wave, or required artifacts
- if no durable path is known yet, say plainly that the updated control state currently exists only in the control-session context

The normalized `control-state` snapshot should include:
- current objective or task framing
- current phase and rigor mode
- pinned `BASE_SHA`, if any
- candidate ref, if any
- completed artifacts and their durable paths when known
- waiting dependencies and blocked sessions
- next runnable sessions
- reduced-rigor decisions or policy exceptions
- unresolved questions or blockers

Freeze-loop exception:
- for freeze, preflight, or freeze-rerun routing, the control agent should not open repeated docs-only cleanup lanes when its own `control-state` persistence is the only reason the worktree is non-empty
- if the latest durable control-state names a clean synced commit and the only new local deltas are:
  - `plan.md`
  - the just-persisted `control-state` snapshot
  - the current freeze report
  then the named synced commit remains the authoritative freeze target
- in that case, the control agent should rerun or complete freeze directly from that named commit unless non-control files are dirty, the phase-doc set changed, or refs drifted
- when this exception is used, record it explicitly in the updated control-state and freeze prompt so downstream sessions know why the freeze is still valid

## 4E. Base Ref And Isolation Rule

For meaningful code phases using the high-rigor default model:
- the control agent should capture `BASE_SHA` before Session A and Session B0 start
- Session A and Session B0 should start from branches or worktrees rooted at the same `BASE_SHA`
- Session B0 must not inspect the candidate implementation branch, implementation summary, or reviewer findings
- if the phase scope only exists in dirty uncommitted state and no reproducible base commit exists, the control agent should block the parallel high-rigor wave until the user creates a durable base or explicitly accepts reduced rigor

## 5. Required Artifacts

A meaningful code phase must not advance without:
- implementation summary
- test-design report or equivalent verification-owned artifact from Session B0, unless the control agent recorded an explicit reduced-rigor exception
- test report
- review report
- e2e or phase verdict
- durable control-state when a canonical plan or report path is already in scope

If any artifact is missing, the next session must be verification-focused, not new implementation.

## 6. Re-Verification Rule

Run a new Session B0 spec-test-design session when:
- phase docs, exit criteria, or public behavior contracts changed materially
- the pinned `BASE_SHA` for the phase was reset
- the previous Session B0 artifact was based on superseded scope

Recompute and persist control state again when:
- a new session result changes runnable dependencies
- the user updates the task framing or acceptance target
- the control agent records a reduced-rigor decision or reverses one

Run a new tester or reviewer session when:
- production code changed after Session B or C
- reviewer found critical issues
- tester found blockers or missing acceptance coverage
- phase exit criteria are still not fully evidenced

After meaningful fixes:
- rerun Session B0 if the expected behavior contract changed
- run tester again
- run reviewer again if behavior or invariants changed
- then rerun lead verdict

## 7. New Session Bootstrap

Every new session should start by reading:
- `README.md`
- `docs/verification-policy.md`
- `docs/prompt-cookbook-codexkit-phase-guide.md`
- the current phase spec
- the latest control-state report, if one exists in the active plan reports path

Recommended bootstrap prompt:

```text
Đọc các file sau trước khi làm gì:
1. README.md
2. docs/verification-policy.md
3. docs/prompt-cookbook-codexkit-phase-guide.md
4. <current phase doc>
5. <latest control-state report path if available>

Current phase: <phase>
Current session type: <implement / spec-test-design / tester / reviewer / lead verdict>
Pinned base ref: <BASE_SHA or none>
Candidate ref: <branch or commit or none yet>
Known artifacts:
- <artifact 1>
- <artifact 2>

Hãy bám đúng verification policy, không dùng chat history cũ làm nguồn sự thật, thực hiện đúng vai trò của session này, nêu rõ skill nào phải dùng hoặc không cần skill, và tôn trọng giới hạn đọc candidate implementation nếu đây là session spec-test-design.
```

When the control agent emits a fresh-session prompt, it should also say:
- which role is expected
- which modal to choose if the host exposes modal selection
- which model and reasoning setting to choose
- which exact block the user should paste into the fresh session
- what artifacts must be pasted back after the session ends

The fresh-session prompt itself should end with the exact result template the user must bring back to the control session.

If a session is not ready because dependencies are still missing, the control agent should not emit a runnable fresh-session prompt yet. It should say that nothing should be pasted into a new session until the required upstream result is pasted back into the control session.

For spec-test-design prompts, the prompt should state that the pinned `BASE_SHA` repo state plus the phase docs and exit criteria are the source of truth, and that candidate implementation artifacts are out of scope.

For tester, reviewer, and lead-verdict prompts, the prompt should state that the current candidate repo tree plus the phase docs are the source of truth, and that prior session artifacts are handoff context only.

## 8. Enforcement

The lead session should stop phase progression when:
- a meaningful code phase skipped the default high-rigor model without an explicit reduced-rigor decision
- Session B0 evidence is missing where the high-rigor model applies
- a durable control-state snapshot should exist but has not been refreshed after a material artifact or task change
- tester has not run
- reviewer has not run
- verdict has not been issued
- evidence does not satisfy phase exit criteria

Shipping a phase without these gates is an explicit risk decision, not the default workflow.
