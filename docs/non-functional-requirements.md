# Non-Functional Requirements

**Project**: CodexKit  
**Version**: 0.1.0-draft  
**Last Updated**: 2026-03-13  
**Status**: Planning  
**Scope**: V1 release-gating quality contract

## 1) Purpose

This document defines the measurable non-functional requirements that gate CodexKit parity and release claims.

Functional parity alone is insufficient. A workflow, phase, or release may be called complete only when the NFR metrics owned by that scope pass with executable evidence.

## 2) Measurement Rules

- Every release branch must publish an NFR evidence bundle with commit SHA, suite results, fixture ids, and host manifest.
- The host manifest must include OS, CPU, RAM, filesystem type, Node version, git version, and Codex CLI version.
- Timing metrics apply only on a declared baseline machine and exclude time waiting for user decisions or external network/model responses; they measure local command startup and orchestration behavior only.
- Comparative metrics against ClaudeKit use frozen reference traces captured on the same fixture family, with the same operator policy and equivalent workflow mode.
- "First progress signal" means the first user-visible status line, checkpoint notice, or scan summary emitted after command acceptance and before long-running worker or model execution.
- "Happy-path fixture" means a supported fixture whose required prerequisites are already satisfied and where no blocking conflict is expected before the normal workflow path begins.
- A "first operator action" is one CLI command or one in-session continue or approve action. Manual database edits, ad hoc file repair, or second-chance shell surgery do not count.
- "Runnable state" means the user is either reattached to an active run or given one immediate next command that can continue execution without further clarification.
- A "blinded evaluator" receives only the compiled handoff bundle, the target workflow, and the fixture repo state. The evaluator must not see the upstream transcript.
- Blinded handoff sufficiency uses a five-part rubric: goal, constraints, accepted decisions, evidence refs, and unresolved questions or blockers. Each part scores `0-2`; a bundle passes when it scores at least `8/10`.
- "Sequential baseline" means the same fixture, verification scope, and task graph are executed with parallel features disabled.
- A "typed diagnostic" includes a stable error code or category, a plain-language cause, the blocking path, tool, or run when relevant, and one concrete next step or next command.
- A "silent downgrade" is any fallback from a requested capability to a narrower mode without an explicit terminal notice that names the missing capability and the effective fallback or blocked state.
- A "control-state snapshot" is the durable orchestration summary for an active control session. It must include current objective, current phase, rigor mode, pinned `BASE_SHA` when present, candidate ref when present, completed artifacts, waiting dependencies, next runnable sessions, reduced-rigor decisions, and unresolved questions or blockers.

## 3) Supported Fixture Matrix

| Fixture | Description | Expected handling | Required by |
|---|---|---|---|
| `fresh-no-git` | empty directory with no git metadata | supported for install and doctor only; worker-backed workflows remain blocked with explicit guidance | `NFR-4` |
| `git-clean` | git-backed repo with an initial commit and clean worktree | fully supported | `NFR-1`, `NFR-2`, `NFR-3`, `NFR-4`, `NFR-5` |
| `git-dirty-text` | tracked text changes in root checkout | supported via overlay bundle replay | `NFR-1`, `NFR-2`, `NFR-4` |
| `git-dirty-mixed-text` | tracked text changes plus supported untracked text files | supported via overlay bundle replay | `NFR-2`, `NFR-4` |
| `git-dirty-unsupported` | binary-only or otherwise unreplayable dirty state | unsupported; must fail before worker spawn with typed diagnostic | `NFR-2`, `NFR-4` |
| `claudekit-migrated` | ClaudeKit-style repo with `.claude/**` and custom project content | supported migration target | `NFR-1`, `NFR-3`, `NFR-4`, `NFR-5` |
| `interrupted-run` | run interrupted by daemon stop, worker crash, or pending approval | supported resume and reclaim target | `NFR-1`, `NFR-5` |
| `retained-failed-worker` | failed worker with retained worktree and logs | supported inspection and recovery target | `NFR-2`, `NFR-5` |
| `fresh-session-handoff` | downstream workflow starts from compiled bundle without the upstream transcript | supported handoff quality target | `NFR-6` |
| `task-change-reroute` | control session receives a new artifact or task delta after prior routing already existed | recompute and persist updated control state before new runnable downstream routing | `NFR-5`, `NFR-6` |
| `parallelizable-repo` | repo fixture with at least four independent executable work items and fixed verification scope | supported throughput benchmark target | `NFR-7` |
| `host-capability-gap` | supported repo running on unsupported or partially capable Codex host features | must degrade explicitly or fail before misleading execution | `NFR-4`, `NFR-8` |

## 4) Phase Ownership Summary

| NFR | Title | First owning phase | Release-closing phase |
|---|---|---|---|
| `NFR-1` | Deterministic Continuity | 1 | 8-9 |
| `NFR-2` | Isolation and Repo Safety | 2 | 9 |
| `NFR-3` | Interactive UX Efficiency | 5 | 9 |
| `NFR-4` | Real-Repo Robustness and Migration Safety | 8 | 9 |
| `NFR-5` | Auditability and Failure Diagnosis | 1 | 9 |
| `NFR-6` | Context Fidelity and Handoff Quality | 5 | 9 |
| `NFR-7` | Throughput and Parallel Payoff | 2 | 9 |
| `NFR-8` | Host Compatibility and Drift Resilience | 8 | 9 |

## 5) `NFR-1` Deterministic Continuity

CodexKit must preserve workflow continuity through ledger state, artifacts, and explicit handoff commands rather than transcript reuse.

| Metric | Target | Minimum phase | Evidence |
|---|---|---|---|
| `NFR-1.1` | `100%` of Phase 1 recovery fixtures let `cdx resume` rediscover an existing run after daemon restart without creating a duplicate run row | 1 | runtime recovery integration suite |
| `NFR-1.2` | `0` implicit `auto` approval leaks into downstream runs in handoff and resume suites | 5 | workflow handoff assertions |
| `NFR-1.3` | `0` duplicate live-task hydrations for the same active plan during explicit plan-path re-entry or resume | 5 | plan re-entry and hydration suite |
| `NFR-1.4` | `>=95%` of supported interruption fixtures recover on the first operator action | 8 | resume and reclaim fixture suite |
| `NFR-1.5` | `100%` of successful continuation paths return either attached run context or one explicit next command, including an absolute plan path when fresh-session re-entry is required | 5 | CLI golden output suite |

## 6) `NFR-2` Isolation and Repo Safety

CodexKit must isolate worker attempts from the root checkout and protect repo integrity even when the root is dirty.

| Metric | Target | Minimum phase | Evidence |
|---|---|---|---|
| `NFR-2.1` | `0` worker writes escape into the root checkout or other protected paths in the worker isolation suite | 2 | owned-path and protected-path tests |
| `NFR-2.2` | `100%` of injected owned-path violations are blocked before normal artifact publication | 2 | policy enforcement tests |
| `NFR-2.3` | `100%` of unsupported dirty-root fixtures fail before the worker enters `running` state | 2 | dirty-root preflight suite |
| `NFR-2.4` | `100%` of supported dirty-root fixtures reproduce expected file checksums in the worker worktree before execution starts | 2 | overlay replay suite |
| `NFR-2.5` | `100%` of retained failed-worker fixtures preserve inspectable worktree metadata and published artifacts until retention policy allows cleanup | 2 | retention and cleanup suite |

## 7) `NFR-3` Interactive UX Efficiency

CodexKit must remain operationally lighter than its runtime complexity suggests. Deterministic orchestration is not allowed to become excessive ceremony.

When a new public workflow enters scope, the applicable prompt, decision-budget, and diagnostic metrics in this section apply to that workflow family unless a metric says otherwise.

| Metric | Target | Minimum phase | Evidence |
|---|---|---|---|
| `NFR-3.1` | median explicit user-decision count from `cdx plan <task>` invocation to first durable artifact is `<=3` on supported happy-path fixtures | 5 | CLI scenario timing and prompt-count suite |
| `NFR-3.2` | `0` unnecessary mode or operation prompts occur when the command line or locked workflow context is already unambiguous | 5 | command-shape golden tests |
| `NFR-3.3` | `100%` of blocking CLI errors include a typed diagnostic with cause and one concrete next step or next command | 5 | diagnostic contract tests |
| `NFR-3.4` | first progress signal latency is `p95 <=2s` on the declared baseline machine for `cdx plan`, `cdx cook <plan-path>`, `cdx resume`, and `cdx doctor` before any long-running model work begins | 5 | baseline timing suite |
| `NFR-3.5` | `100%` of interactive handoff prompts present a default next action that matches ClaudeKit parity rules for the current workflow and mode | 6 | handoff prompt suite |
| `NFR-3.6` | on golden core fixtures, the interactive `plan -> cook` operator-action count is no worse than `+1` compared with the frozen ClaudeKit reference trace | 5 | comparative UX suite |
| `NFR-3.7` | supported interruption recovery reaches runnable state in `p95 <=2` operator actions once external blockers are cleared | 8 | recovery friction suite |

## 8) `NFR-4` Real-Repo Robustness and Migration Safety

CodexKit must work against real repository states and real migration targets without hidden destructive behavior.

| Metric | Target | Minimum phase | Evidence |
|---|---|---|---|
| `NFR-4.1` | `100%` of supported repo fixtures pass their declared `init`, `doctor`, `resume`, `update`, and workflow smoke scenarios | 8 | repo fixture matrix suite |
| `NFR-4.2` | `0` unmanaged file mutations occur without explicit operator approval | 8 | packaging and migration audit tests |
| `NFR-4.3` | `100%` of preview and apply flows enumerate planned writes, preserved files, conflicts, and blocked actions before mutation starts | 8 | preview/apply contract tests |
| `NFR-4.4` | `100%` of unsupported repo states fail with typed diagnostics before partial managed writes or worker spawn | 8 | negative fixture suite |
| `NFR-4.5` | `100%` of install-only repos without an initial commit remain blocked from worker-backed workflows until the required git prerequisites are satisfied | 8 | bootstrap and doctor fixture suite |
| `NFR-4.6` | `100%` of repo-state precondition gaps that allow safe degraded behavior enter an explicit degraded mode instead of hard failure or silent partial activation | 8 | degraded-mode repo fixture suite |

## 9) `NFR-5` Auditability and Failure Diagnosis

Every critical workflow, recovery path, and failure state must be inspectable after the fact without depending on a lost terminal transcript.

When a new terminal workflow enters scope in a later phase, `NFR-5.2` immediately applies to that workflow family.

| Metric | Target | Minimum phase | Evidence |
|---|---|---|---|
| `NFR-5.1` | `100%` of Phase 1 runtime records remain retrievable by stable ids after daemon restart | 1 | runtime persistence suite |
| `NFR-5.2` | `100%` of terminal workflow runs publish either a durable success summary artifact or a typed failure diagnostic artifact | 5 | workflow terminal-state suite |
| `NFR-5.3` | `100%` of artifacts, approvals, and checkpoint transitions are traceable to `run_id`; task-scoped records also carry `task_id` | 1 | ledger traceability tests |
| `NFR-5.4` | `100%` of worker or daemon crash fixtures retain the last durable checkpoint, supervisor logs, and recovery state for inspection | 2 | chaos recovery suite |
| `NFR-5.5` | `100%` of reclaim or resume blockers surface the current blocking resource and one concrete recovery action in terminal output | 8 | recovery diagnostics suite |
| `NFR-5.6` | `100%` of `task-change-reroute` fixtures with a durable plan or report path already in scope persist a refreshed control-state snapshot before any new runnable downstream prompt is emitted | 5 | control-state persistence suite |

## 10) `NFR-6` Context Fidelity and Handoff Quality

CodexKit must preserve enough intent, decisions, and blockers in compiled context so fresh-session continuation remains coherent without transcript reuse.

| Metric | Target | Minimum phase | Evidence |
|---|---|---|---|
| `NFR-6.1` | `100%` of in-scope workflow handoff bundles contain goal, constraints, accepted decisions, evidence refs, unresolved questions or blockers, and next action | 5 | handoff bundle schema tests |
| `NFR-6.2` | `>=90%` of `fresh-session-handoff` fixtures pass the blinded evaluator sufficiency rubric without access to the upstream transcript | 5 | comparative handoff review suite |
| `NFR-6.3` | `0` operator restatement events occur on golden core handoff fixtures for previously accepted decisions already present upstream | 5 | fresh-session continuation suite |
| `NFR-6.4` | `100%` of blocked or approval-pending continuations surface unresolved questions and blocking approvals in handoff or resume output | 8 | blocked-handoff and resume suite |
| `NFR-6.5` | `100%` of persisted control-state snapshots include every required control-state field and correctly name the next runnable sessions and waiting dependencies on `task-change-reroute` fixtures | 5 | control-state schema and reroute suite |

## 11) `NFR-7` Throughput and Parallel Payoff

CodexKit must earn the complexity cost of its runtime by providing measurable orchestration throughput and parallel execution benefit.

| Metric | Target | Minimum phase | Evidence |
|---|---|---|---|
| `NFR-7.1` | worker launch latency from approved spawn to first worker progress signal is `p95 <=8s` on the baseline machine for `git-clean` and `git-dirty-text` fixtures | 2 | worker launch benchmark suite |
| `NFR-7.2` | ready-task dispatch latency from dependency clearance to claim assignment is `p95 <=1s` on a warm daemon | 2 | scheduler latency suite |
| `NFR-7.3` | on the `parallelizable-repo` fixture, the canonical parallel workflow completes at least `25%` faster than the sequential baseline while preserving all applicable quality metrics | 6 | parallel payoff benchmark |
| `NFR-7.4` | the parallel payoff benchmark introduces no more than `10%` additional failed or retried tasks versus the sequential baseline | 6 | comparative reliability benchmark |

## 12) `NFR-8` Host Compatibility and Drift Resilience

CodexKit must remain honest and operable as Codex host behavior evolves. Unsupported host states must be detected early and surfaced clearly.

| Metric | Target | Minimum phase | Evidence |
|---|---|---|---|
| `NFR-8.1` | every release branch publishes a supported host matrix covering at least two Codex CLI versions and all listed versions pass the host smoke suite | 8 | host-matrix smoke suite |
| `NFR-8.2` | `100%` of unsupported Codex CLI versions or missing mandatory host capabilities fail before workflow start with a typed diagnostic naming the supported range or missing capability | 8 | host preflight suite |
| `NFR-8.3` | `100%` of optional capability-dependent paths either degrade explicitly or surface a typed blocked state; `0` silent downgrade events are allowed on `host-capability-gap` fixtures | 8 | capability downgrade suite |
| `NFR-8.4` | every release candidate includes host compatibility results less than seven days old for the declared support matrix | 9 | release evidence bundle |

## 13) Release Gate

- No phase may claim parity completion if any mandatory metric owned by that phase is failing.
- Phase 9 release readiness must publish a pass or fail table for every metric in this document.
- Waived issues may remain only for non-mandatory future-phase items; a failed mandatory V1 metric is a release blocker.
