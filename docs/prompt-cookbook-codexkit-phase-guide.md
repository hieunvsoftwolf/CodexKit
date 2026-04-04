# Prompt Cookbook CodexKit Phase Guide

**Project**: CodexKit
**Last Updated**: 2026-03-13
**Purpose**: Session-by-session entry guide for docs verification, phase implementation, spec-test design, testing, review, and e2e validation

## 1. Start Every New Session Like This

New sessions do not reliably remember prior chat context.

What persists:
- repo files
- `docs/`
- code already written
- plans and reports

What you should always do:
- tell Codex to read this file first
- tell Codex current phase
- tell Codex what is already done
- tell Codex whether you want docs verification, implementation, spec-test design, testing, review, or e2e validation

In this repo, the canonical explicit invocation is `$control-agent-codexkit`.
Do not assume plain `control-agent` routes to a repo-local generic control skill here.
If your host does not expose repo skills cleanly, say: `Bạn là control-agent cho CodexKit`.

Recommended bootstrap prompt:

```text
Đọc các file sau trước khi làm gì:
1. docs/verification-policy.md
2. docs/prompt-cookbook-codexkit-phase-guide.md
3. docs/prompt-cookbook.md
4. docs/project-roadmap.md
5. <latest control-state report path if available>

Current status:
- completed: <what is already done>
- current phase: <phase number/name>
- next target: <verify docs / implement / spec-test-design / test / review / e2e>

Sau khi đọc xong, hãy:
1. tóm tắt current state
2. chọn đúng agents và skills cần dùng
3. chia execution plan thành wave song song hoặc dependency order
4. với mỗi session, cho tôi role expected, modal hint nếu host có modal, suggested model, fallback model, run mode, depends on, paste back exactly, và prompt cụ thể có dòng `Skills:`
5. kết thúc bằng model picker summary ngắn
```

Control-agent rule:
- every planned session must say which curated skill to use, or `Skills: none required`
- if a phase prompt below omits the skill line, control-agent must add it before emitting
- every planned session must include role expected, optional modal hint, suggested model, fallback model, run mode, depends on, and paste-back instructions
- default to manual handoff across fresh sessions unless the user explicitly requests native task orchestration
- if the repo is not yet clean and synced on the intended starting baseline, emit a runnable `Wave 0` session card for a fresh agent to do baseline disposition; do not leave this step as operator-only prose by default
- for meaningful code phases, default to `implement + spec-test-design` in the first parallel wave after a reproducible `BASE_SHA` is pinned
- every session card must say which exact block the user should paste into the fresh session
- every emitted session prompt must end with the exact result template the user should paste back into the control session
- default output should also end with `## Advancement Rule` and `## Unresolved Questions`
- if the user has already pasted a prior session result into the control session, carry it forward into downstream prompts instead of emitting a manual paste placeholder
- if a planned session still depends on a missing upstream artifact, mark it as waiting and do not emit a runnable prompt block for it yet
- when an active plan dir or durable report path is in scope, persist meaningful session results there before routing the next session
- after a pasted session result or a material task change, recompute and persist concise `control-state` before emitting new runnable downstream prompts when a durable path is in scope
- freeze-loop exception: if the only new local deltas are `plan.md`, the just-persisted `control-state`, and the current freeze report, do not open another cleanup lane first; rerun freeze directly from the latest clean synced commit named in durable control-state unless refs or phase docs changed
- for spec-test-design prompts, say explicitly that phase docs + exit criteria + pinned `BASE_SHA` are the source of truth, and the candidate implementation must not be inspected
- for tester/reviewer/verdict prompts, say explicitly that repo tree + phase docs + exit criteria are the source of truth, and prior session results are handoff context only
- if no reproducible base commit exists yet for a meaningful code phase, block the high-rigor parallel wave and tell the user to freeze a base or accept reduced rigor explicitly

Recommended control-agent output shape:

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
- role expected: `fullstack-developer`
- modal to choose: `host does not expose modal selection`
- skills: `none required`
- suggested model: `gpt-5.3-codex / high`
- fallback model: `closest coding-first model / high`
- ready now: `yes`
- run mode: `wave 0 baseline disposition`
- depends on: `none`
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
Skills: none required
Session role expected: fullstack-developer
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
- run mode: `parallel wave 1`
- depends on: `none`
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

## Model Picker Summary
- S1: `... / ...`
- S2: `... / ...`

## Advancement Rule
- pass when ...
- fail when ...

## Unresolved Questions
- ...

When a session is still waiting on upstream results, prefer this shape:

~~~markdown
### S2
- role expected: `tester`
- modal to choose: `host does not expose modal selection`
- skills: `none required`
- suggested model: `gpt-5.3-codex / medium`
- fallback model: `closest coding-first model / medium`
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
~~~

## 2. Current Recommended Next Step

Current repo state appears to be:
- migration docs baseline exists
- roadmap/spec docs exist
- docs verification for Phase 1 readiness completed on `2026-03-12`
- durable readiness artifacts exist under `plans/20260312-1422-docs-verification-phase-1-readiness/`
- discarded local Phase 1 candidate implementation was removed on `2026-03-13` to restore default high-rigor delivery
- active clean-restart preflight plan exists under `plans/20260313-1128-phase-0-preflight-clean-restart/`
- no actual Phase 1 implementation, spec-test-design, tester, reviewer, or verdict artifact exists yet

Recommended next step:
- run Phase 0 preflight first, not Phase 1 implementation yet
- initialize or attach a git-backed repo at workspace root
- capture a reproducible `BASE_SHA` from the clean docs-first baseline
- keep the current docs stable enough for the first high-rigor Phase 1 wave
- after `BASE_SHA` exists, start Phase 1 with Session A implementation and Session B0 spec-test-design in parallel
- after any result is pasted back, recompute and persist updated `control-state` before opening the next runnable downstream session when a durable path is already in scope
- keep final tester waiting until both implementation and spec-test-design artifacts exist
- keep reviewer waiting until implementation exists
- keep lead-verdict waiting until final tester and reviewer artifacts exist
- treat the docs-readiness plan as background context only, not as a substitute for Phase 1 delivery artifacts

Recommended control-session bootstrap:

```text
Đọc các file sau trước khi làm gì:
1. docs/verification-policy.md
2. docs/prompt-cookbook-codexkit-phase-guide.md
3. docs/project-roadmap.md
4. plans/20260313-1128-phase-0-preflight-clean-restart/plan.md
5. docs/phase-1-implementation-plan.md
6. docs/runtime-core-technical-spec.md
7. <latest control-state report path if available>

Current status:
- docs verification readiness already completed in plans/20260312-1422-docs-verification-phase-1-readiness/plan.md
- discarded local Phase 1 candidate implementation has been removed for a clean restart
- no S1 Result or S2 Result exists yet for real Phase 1 code delivery
- next target is Phase 0 preflight for a clean high-rigor Phase 1 start

Hãy dùng control-agent workflow và emit đúng contract chuẩn:
1. ## Current Phase
2. ## Execution Plan
3. ## Session Cards
4. ## Artifact Checklist
5. ## Model Picker Summary
6. ## Advancement Rule
7. ## Unresolved Questions

Rules:
- before `BASE_SHA` exists, block the high-rigor implementation wave and route to preflight only
- Session A implementation and Session B0 spec-test-design should be `ready now: yes` only after a reproducible `BASE_SHA` exists
- final tester must be waiting until both the implementation result and spec-test-design artifact are pasted back
- reviewer must be waiting until the implementation result is pasted back
- lead verdict must be waiting until tester and reviewer results are pasted back
- do not emit manual placeholders if an upstream artifact already exists in the control session
- if a downstream dependency artifact is missing, `paste into new session` must say `none yet; wait for <dependency artifacts>`
- after a pasted result or task change, recompute and persist concise `control-state` before emitting new runnable downstream prompts when a durable path is already in scope
- if a freeze or freeze-rerun would otherwise be blocked only by the just-written `plan.md`, `control-state`, and current freeze report, carry forward the latest clean synced commit from durable control-state and rerun freeze directly instead of creating a cleanup loop
- every emitted prompt must include `Skills:` and `Session role expected:`
- spec-test-design prompts must include the pinned `BASE_SHA` and forbid reading the candidate implementation branch or implementation summary
- for tester, reviewer, and verdict prompts, say repo tree + phase docs + exit criteria are the source of truth, and prior session artifacts are handoff context only
```

## 3. Phase Files

Detailed phase prompts are split to keep docs manageable:

- [Phase 0-4 Guide](/Users/hieunv/Claude Agent/Claudekit-GPT/docs/prompt-cookbook-codexkit-phase-guide/phase-0-4.md)
- [Phase 5-9 Guide](/Users/hieunv/Claude Agent/Claudekit-GPT/docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md)

Control-agent and independence rules are defined in [verification-policy.md](/Users/hieunv/Claude Agent/Claudekit-GPT/docs/verification-policy.md).

## 4. Recommended Worker Counts By Phase

| Phase | Recommended workers | Core roles |
|---|---:|---|
| Phase 0 | 3 | researcher, planner, docs-manager |
| Docs verification pass | 4 | researcher, planner, docs-manager, code-reviewer |
| Phase 1 | 6 | planner, 2 devs, spec-test-designer, tester, code-reviewer |
| Phase 2 | 6-7 | planner, 2 devs, spec-test-designer, tester, code-reviewer, optional debugger |
| Phase 3 | 6 | planner, 2 devs, spec-test-designer, tester, code-reviewer |
| Phase 4 | 7 | planner, researcher, 2 devs, spec-test-designer, tester, code-reviewer |
| Phase 5 | 7 | planner, researcher, 2 devs, spec-test-designer, tester, code-reviewer |
| Phase 6 | 7 | planner, debugger, 2 devs, spec-test-designer, tester, code-reviewer |
| Phase 7 | 6-7 | planner, dev, docs-manager, spec-test-designer, tester, code-reviewer, optional git-manager |
| Phase 8 | 7-8 | planner, researcher, 2 devs, spec-test-designer, tester, code-reviewer, optional docs-manager |
| Phase 9 | 5 | planner, debugger, tester, code-reviewer, project-manager |

Counts above exclude the lead session.

## 5. Fast Start Prompts

### If docs are done but not verified yet

```text
Đọc docs/verification-policy.md và docs/prompt-cookbook-codexkit-phase-guide.md trước.
Hiện trạng:
- docs baseline đã xong
- chưa verify chính thức theo OpenAI/Codex capability và security/threat assumptions
- chưa bắt đầu implement Phase 1

Hãy chạy docs verification pass trước khi code.
Tôi muốn:
1. 1 researcher dùng openai-docs
2. 1 planner review internal spec consistency
3. 1 docs-manager sửa docs
4. 1 code-reviewer review findings-only

Sau đó cho tôi verdict:
- đã đủ chuẩn để bắt đầu Phase 1 chưa
- nếu rồi thì prompt Phase 1 là gì
```

### If docs already verified and you want to start Phase 1

```text
Đọc docs/verification-policy.md và docs/prompt-cookbook-codexkit-phase-guide.md trước.
Hiện trạng:
- docs baseline complete
- docs verification pass complete
- docs readiness artifacts exist under plans/20260312-1422-docs-verification-phase-1-readiness/
- chưa có `S1 Result` hoặc `S2 Result` cho actual Phase 1 code delivery
- current target is Phase 1 Runtime Foundation

Hãy dùng control-agent workflow cho Phase 1.
Tôi muốn bạn:
1. emit execution plan và session cards đúng contract chuẩn
2. nếu có `BASE_SHA` ổn định thì implementation và spec-test-design phải cùng `ready now: yes`
3. final tester phải waiting cho tới khi `S1 Result` và `S2 Result` được paste back
4. reviewer phải waiting cho tới khi implementation result được paste back
5. không emit placeholder tay nếu control session đã có upstream artifact
6. kết thúc bằng Artifact Checklist, Model Picker Summary, Advancement Rule, và Unresolved Questions
```

### If a phase was implemented and you only want verify plus e2e

```text
Đọc docs/verification-policy.md và docs/prompt-cookbook-codexkit-phase-guide.md trước.
Hiện trạng:
- code cho Phase <N> đã implement xong
- current target là verify + e2e validation

Nếu chưa có spec-test-design artifact hợp lệ, hãy emit thêm session đó trước final tester.

Nếu control session vừa nhận thêm artifact mới hoặc task mới, hãy recompute và persist updated `control-state` trước khi emit session verify tiếp theo nếu đã có durable report path.

Hãy dùng:
- 1 tester
- 1 code-reviewer
- 1 debugger nếu cần

Output:
- test report
- review findings
- e2e verdict
- blockers trước khi move sang phase tiếp theo
```

## 6. What I Will Know In A New Session

I will not reliably know prior chat history.

I will know what is in the repo:
- docs
- code
- plans
- reports

Best minimal new-session prompt:

```text
Đọc docs/verification-policy.md và docs/prompt-cookbook-codexkit-phase-guide.md trước.
Current phase: <phase>
Done:
- <done item 1>
- <done item 2>
Next:
- <verify docs / implement / spec-test-design / test / review / e2e>
Nếu có `control-state` report path thì đọc nó trước.
Hãy chọn đúng role/session routing, pin `BASE_SHA` nếu phase code đủ điều kiện high-rigor, emit session cards, và không mở runnable downstream session khi dependency artifact chưa có.
```

## 7. Phase Transition Rule

Do not move to the next phase until the current phase has:
- implementation summary
- spec-test-design report or equivalent verification-owned artifact when the high-rigor model applies
- test report
- review report
- e2e verdict
- refreshed durable control-state when a canonical plan or report path is already in scope
- explicit pass/fail against phase exit criteria

If one of these is missing, next session should start with verification, not new implementation.
