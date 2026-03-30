# Workflow Extended and Release Spec (Phases 6-9)

**Project**: CodexKit  
**Scope**: Phase 6 workflow parity extended through Phase 9 release validation  
**Last Updated**: 2026-03-13  
**Status**: Draft

## 1) Purpose

Define the implementation contract for the remaining migration-critical workflows and the release-hardening phases after Phase 5.

Public CLI syntax uses `cdx review`, `cdx test`, `cdx fix`, `cdx debug`, `cdx team`, `cdx init`, `cdx doctor`, `cdx resume`, and `cdx update`. Public and internal workflow references in this spec should use the same space-separated command form unless a ClaudeKit source identifier is being quoted verbatim.

This spec turns the source behavior in:

- `docs/project-roadmap.md`
- `docs/non-functional-requirements.md`
- `docs/compatibility-matrix.md`
- `docs/tdd-test-plan.md`
- `docs/workflow-parity-core-spec.md`
- `docs/worker-execution-and-isolation-spec.md`
- `docs/project-overview-pdr.md`
- `.claude/skills/code-review/SKILL.md`
- `.claude/skills/test/SKILL.md`
- `.claude/skills/fix/SKILL.md`
- `.claude/skills/debug/SKILL.md`
- `.claude/skills/team/SKILL.md`
- `.claude/skills/cook/references/workflow-steps.md`

into a concrete CodexKit runtime contract for:

- Phase 6: `cdx review`, `cdx test`, `cdx fix`, `cdx debug`, `cdx team`
- Phase 7: finalize flow, full sync-back, docs impact, git handoff
- Phase 8: `cdx init`, `cdx doctor`, `cdx update`, migration assistant, and `cdx resume` hardening
- Phase 9: golden parity tests, chaos tests, migration validation, release readiness

## 2) Scope

In scope:

- workflow behavior, gates, artifacts, and handoffs for Phases 6-9
- command-level parity requirements for the listed public `cdx` commands
- finalize rules shared across `cdx cook`, `cdx fix`, and team-cook flows
- packaging and migration UX requirements
- release validation and must-pass test suites

Out of scope:

- low-level SQLite schema design
- MCP request or response schema details
- browser dashboard design
- Windows-specific worker execution behavior
- post-V1 lower-priority roles such as `code-simplifier`

## 3) Build-On Contracts

This spec extends, and does not replace, the Phase 5 rules in `docs/workflow-parity-core-spec.md`.

Still authoritative from Phase 5:

- one workflow run per command invocation
- artifact path resolution under plan dir or run artifact dir
- checkpoint completion rules
- workflow checkpoint response codes for standard gates: `approved`, `revised`, `aborted`
- broader approval record states still follow the runtime and primitive specs: `pending`, `approved`, `revised`, `rejected`, `aborted`, `expired`

Additional invariants for Phases 6-9:

- no success claim without fresh verification evidence
- test, review, and finalize steps remain delegated, not silently inlined
- repo-mutating workflows must preserve ownership boundaries and worker isolation
- retained failed worktrees are inspect-only and never resumed in place
- commit creation remains user-controlled even when the rest of a workflow is autonomous
- packaging commands are non-destructive by default

### 3.1 Phase 6-9 NFR Coverage

Phases 6-9 close the remaining product-level quality requirements in `docs/non-functional-requirements.md`.

- Phase 6 extends `NFR-3` and `NFR-5` across `review`, `test`, `fix`, `debug`, and `team`, closes the extended workflow handoff families in `NFR-6`, and proves the workflow-level parallel payoff targets in `NFR-7`
- Phase 7 closes finalize and sync-back evidence needed for the remaining workflow-level traceability portions of `NFR-5`
- Phase 8 owns `NFR-4`, `NFR-8`, and the remaining hardening metrics for `NFR-1` and `NFR-6` continuity on migrated and interrupted repos
- Phase 9 is the release gate that must prove every mandatory metric from `NFR-1` through `NFR-8`

### 3.2 Additional Checkpoint IDs

Phase 6-9 must use stable checkpoint ids:

- `review-scout`
- `review-analysis`
- `review-publish`
- `test-preflight`
- `test-execution`
- `test-report`
- `fix-mode`
- `fix-diagnose`
- `fix-route`
- `fix-implement`
- `fix-verify`
- `debug-precheck`
- `debug-route`
- `debug-hypotheses`
- `debug-evidence`
- `debug-conclusion`
- `team-bootstrap`
- `team-monitor`
- `team-shutdown`
- `finalize-sync`
- `finalize-docs`
- `finalize-git`
- `package-scan`
- `package-preview`
- `package-apply`
- `doctor-scan`
- `resume-select`
- `resume-recover`
- `update-scan`
- `update-preview`
- `validation-golden`
- `validation-chaos`
- `validation-migration`

## 4) Phase 6 Outcome

Phase 6 is complete only if all of the following are true:

- `cdx review` produces severity-ordered findings with evidence and recommendations
- `cdx test` supports delegated test execution, report output, and retry-after-fix loops
- `cdx fix` preserves quick, standard, deep, and parallel routing semantics
- `cdx debug` produces a durable root-cause report before any fix handoff
- `cdx team` supports team-scoped runs, task claiming, direct messaging, idle/wake, shutdown, and cleanup

## 5) `cdx review`

### 5.1 Goal

Recreate ClaudeKit review behavior as a findings-first workflow that:

- scouts edge cases before review
- delegates review to dedicated reviewer workers
- emits severity-ordered findings only
- can run as recent-change review, full codebase scan, or parallel review

### 5.2 Public Command Surface

CodexKit must preserve the user-facing review operations from ClaudeKit:

- `cdx review <context>`
- `cdx review codebase`
- `cdx review codebase parallel`
- `cdx review` with no explicit operation

If `cdx review` is invoked without an explicit operation, prompt the user to choose between the default recent-change review path, `codebase`, and `codebase parallel` before execution starts.

### 5.3 Flow

| Step | Checkpoint | Gate | Required result |
|---|---|---|---|
| R0 | run start | No | Resolve scope: recent changes, `codebase`, or `codebase parallel` |
| R1 | `review-scout` | No | Edge-case scout or scope map complete |
| R2 | `review-analysis` | No | Reviewer worker(s) produce findings |
| R3 | synthesize | No | Duplicate findings merged, severity ordered |
| R4 | `review-publish` | No | Final report artifact published |

### 5.4 Required Artifacts

| Checkpoint | Required artifact | Notes |
|---|---|---|
| R1 | optional scout report | Required for large or unclear scope |
| R2 | reviewer raw reports | One per reviewer worker |
| R4 | `review-report.md` | Always required |

### 5.5 Findings Contract

`review-report.md` must:

- include findings only, not praise-only commentary
- order findings `CRITICAL` > `IMPORTANT` > `MODERATE`
- attach concrete evidence and a recommended action to each finding
- note explicit `no findings` if the review is clean
- preserve scoped reviewer output for parallel review runs

If `cdx review` is invoked inside `cdx cook` or `cdx fix`, this report is the review gate input.

### 5.6 Task-Managed Review Pipeline

For multi-file features, scoped parallel reviewers, or review-driven fix cycles, `cdx review` must preserve ClaudeKit's task-managed review chain:

| Stage task | Purpose | Dependency rule |
|---|---|---|
| scout | edge-case scout or scope map | entry task |
| review | reviewer analysis and findings | blocked on `scout` |
| fix | fix critical or required findings | blocked on all `review` tasks |
| verify | fresh verification after fixes | blocked on `fix` |

Pipeline rules:

- use the task-managed pipeline when 3 or more changed files, parallel reviewer scopes, or iterative critical fixes are involved
- scoped reviewer tasks may run in parallel by file group or review focus
- if fixes introduce new issues, create a new review cycle instead of mutating the completed review node
- limit re-review to 3 cycles before escalation to the user
- when `cdx review` runs standalone, the pipeline may stop after `review-publish`; when it runs inside `cdx cook` or `cdx fix`, the downstream `fix` and `verify` tasks must be represented explicitly

## 6) `cdx test`

### 6.1 Goal

Recreate ClaudeKit testing as a delegated QA workflow that:

- runs preflight verification first
- executes the right suite for the requested scope
- produces a structured QA report
- supports retry loops after fixes, not silent pass-through

### 6.2 Public Command Surface

CodexKit must preserve the user-facing test operations from ClaudeKit:

- `cdx test <context>`
- `cdx test ui [url]`
- `cdx test <context> --coverage`

If `cdx test` is invoked without an explicit operation, prompt the user to choose between the default test path and the `ui` path before execution starts.

### 6.3 Supported Modes

| Mode | Intent | Notes |
|---|---|---|
| default | unit/integration/e2e/build verification | Main Phase 6 path |
| `ui` | browser-based visual or interaction checks | Adapted path, file/report first |
| coverage | full suite with coverage metrics | Same report format, extra metrics |

### 6.4 Flow

| Step | Checkpoint | Gate | Required result |
|---|---|---|---|
| T0 | scope resolve | No | Determine changed area, suite, and expected outputs |
| T1 | `test-preflight` | No | Typecheck/lint/analyze commands complete |
| T2 | `test-execution` | No | Requested test suite runs |
| T3 | analyze | No | Failures, flakes, skips, and slow tests triaged |
| T4 | `test-report` | No | QA report published |

### 6.5 Required Artifacts

| Checkpoint | Required artifact | Notes |
|---|---|---|
| T1 | preflight output capture | Can stay in run artifacts |
| T2 | test runner output | Always retained |
| T4 | `test-report.md` | Always required |
| T4 | optional screenshots | Required for `ui` mode when screenshots were taken |

### 6.6 Test Report Contract

`test-report.md` must include:

- totals: passed, failed, skipped, duration
- coverage metrics when available
- every failed test with cause and suggested fix
- build status and warnings
- unresolved questions at end if any

Default thresholds remain:

- line coverage `80%+`
- branch coverage `70%+`

If `cdx test` runs inside `cdx cook` or `cdx fix`, failure blocks progress until:

- a fix loop runs and a new test report passes, or
- the user explicitly aborts

## 7) `cdx fix`

### 7.1 Goal

Recreate ClaudeKit fix behavior as a routed workflow that always starts with debugging, then chooses the cheapest safe path to resolution.

### 7.2 Public Command Surface

CodexKit must preserve the core fix entrypoints from ClaudeKit:

- `cdx fix <issue> --auto`
- `cdx fix <issue> --review`
- `cdx fix <issue> --quick`
- `cdx fix <issue> --parallel`
- `cdx fix <issue>` with no explicit mode

If the request does not explicitly pick a mode, `cdx fix` must preserve ClaudeKit's autonomous-first mode chooser: prompt for mode selection before route locking unless the issue is clearly trivial, the user already implied a mode, or prior workflow context already established one.

### 7.3 Approval Policy vs Execution Route

Two decisions are separate:

- approval policy: `autonomous` or `human-in-the-loop`
- execution route: `quick`, `standard`, `deep`, or `parallel`

`autonomous` is the recommended/default selection in the chooser. It may auto-advance workflow gates when evidence is strong. It must not auto-commit.

### 7.4 Route Selection

| Route | Use when | Minimum shape |
|---|---|---|
| `quick` | clear single-scope issue, type/lint/trivial bug | debug -> fix -> review -> finalize |
| `standard` | multi-file issue, moderate uncertainty | debug -> scout -> implement -> test -> review -> finalize |
| `deep` | architecture impact or unclear solution space | debug -> research -> brainstorm -> plan -> implement -> test -> review -> finalize |
| `parallel` | multiple independent issues or explicit parallel request | one routed subrun per issue, merged finalize |

### 7.5 Flow

| Step | Checkpoint | Gate | Required result |
|---|---|---|---|
| F0 | `fix-mode` | Optional | Approval policy and route resolved |
| F1 | `fix-diagnose` | No | Root cause established via `cdx debug` semantics |
| F2 | `fix-route` | Optional | Quick/standard/deep/parallel route locked |
| F3 | `fix-implement` | Depends on policy | Fix applied in owned scope |
| F4 | `fix-verify` | Depends on policy | Fresh test + review evidence exists |
| F5 | finalize entry | Depends on policy | Phase 7 finalize contract runs |

### 7.6 Required Artifacts

| Route | Required artifacts |
|---|---|
| quick | debug summary, review report, fix summary, finalize report |
| standard | debug report, scout notes, test report, review report, finalize report |
| deep | debug report, research report, decision report, plan artifact, test report, review report, finalize report |
| parallel | per-issue artifacts plus merged finalize report |

### 7.7 Routing Rules

- no fix route may skip initial diagnosis
- quick route escalates to standard if scope grows or review fails
- deep route is required when planning or external research materially changes the solution
- parallel route must assign explicit file ownership boundaries per issue
- all successful fix routes that modify repo content must run Phase 7 finalize

## 8) `cdx debug`

### 8.1 Goal

Recreate ClaudeKit debugging as a root-cause-first workflow that:

- produces hypotheses before patching
- collects evidence for and against each theory
- converges on a root-cause chain
- hands off to `cdx fix` only after diagnosis is publishable

### 8.2 Flow

| Step | Checkpoint | Gate | Required result |
|---|---|---|---|
| D0 | run start | No | Normalize issue, impact, and reproduction target |
| D1 | `debug-precheck` | No | Reproduction, recent changes, boundary map, and trace starting point recorded |
| D2 | `debug-route` | No | Investigation branch or branch mix selected |
| D3 | `debug-hypotheses` | No | Competing theories defined from precheck evidence |
| D4 | `debug-evidence` | No | Logs, traces, repro data, or code evidence gathered |
| D5 | analyze | No | Surviving theory identified and downstream handoff prepared |
| D6 | `debug-conclusion` | No | Root-cause report published |

### 8.2.1 Mandatory Pre-Hypothesis Guardrails

Before `debug-hypotheses`, `cdx debug` must preserve the core ClaudeKit discipline from systematic debugging:

- reproduce consistently, or explicitly record why reliable reproduction is not yet possible
- inspect recent code, config, dependency, migration, and environment changes relevant to the issue
- identify component boundaries and gather evidence at ingress/egress points before narrowing theories
- trace failing data or control flow backward toward the likely origin rather than starting from the surface symptom alone
- avoid proposing or testing fixes before the precheck evidence is captured
- if two consecutive hypotheses fail, return to `debug-precheck` instead of continuing guess-and-check

### 8.3 Investigation Branch Dispatch

`cdx debug` must preserve ClaudeKit's broader investigation surface, not just generic code-level debugging.

At `D2`, the lead or debugger worker must classify the issue into one or more branches:

| Branch | Use when | Primary evidence | Required behavior |
|---|---|---|---|
| `code` | test failures, local bugs, build breakage, integration defects | stack traces, repro steps, code paths, failing assertions | Run standard hypothesis-driven debugging across relevant components |
| `logs-ci` | CI/CD failures, deployment issues, server incidents, log-driven production bugs | CI logs, app/server logs, job metadata, timestamps, correlated failures | Preserve failing command or job context, correlate logs across stages, and isolate first failing layer before proposing a fix |
| `database` | query failures, migration issues, data integrity drift, lock/contention symptoms | schema state, failing queries, execution plans, migration output, data samples | Distinguish schema/design faults from bad data or bad queries; record any destructive-query risk before execution |
| `performance` | slow endpoints, degraded jobs, resource exhaustion, scaling regressions | latency measurements, query timings, profiles, throughput/error trends | Identify bottleneck location first, then separate symptom metrics from root cause mechanisms |
| `frontend` | UI bugs, visual regressions, browser-only failures, console/network issues | screenshots, console errors, network traces, DOM state, responsive checks | Attempt frontend verification via browser helpers when available; if unavailable, record the missing capability and continue with file/code evidence |

Branch selection rules:

- multiple branches may be active for the same run
- each active branch must contribute evidence or be explicitly ruled out
- branch selection determines which artifacts and tools are expected during `debug-evidence`
- multi-branch investigations may spawn parallel debugger workers per branch or per hypothesis

### 8.4 Investigation Task Graph

`cdx debug` must preserve ClaudeKit's task-managed investigation patterns when the investigation is non-trivial.

Create a task graph when any of the following is true:

- the investigation has 3 or more meaningful steps
- multiple components or evidence sources are involved
- parallel evidence collection is useful
- the incident is performance-, database-, or CI-heavy

Skip task graph creation only for small single-scope investigations where the overhead would exceed the benefit.

Standard investigation graph:

| Stage task | Purpose | Dependency rule |
|---|---|---|
| assess | scope, impact, reproduction, recent changes | entry task |
| collect | logs, traces, metrics, screenshots, data state | blocked on `assess` |
| analyze | correlate evidence, identify root cause | blocked on all `collect` tasks |
| `fix-handoff` | handoff or create downstream `cdx fix` work item | blocked on `analyze` |
| `verify-handoff` | prepare verification expectations for `cdx fix` or parent workflow | blocked on `fix-handoff` |

Task graph rules:

- use the `3-task rule`: if the investigation has fewer than 3 meaningful steps, stay sequential
- branch-specific collection tasks may run in parallel, but `analyze` must block on all required evidence tasks
- `fix-handoff` and `verify-handoff` preserve ClaudeKit's full investigation chain without forcing code edits inside standalone `cdx debug`
- when `cdx debug` is invoked inside `cdx fix` or `cdx cook`, handoff tasks may bind directly to the caller's fix/verify tasks instead of creating duplicate nodes
- if a downstream fix attempt fails verification, create a new analyze cycle rather than mutating the old investigation in place
- after 3 failed analyze/fix/verify cycles, escalate to the user as a likely architecture-level issue

### 8.5 Required Artifacts

| Checkpoint | Required artifact | Notes |
|---|---|---|
| D1 | precheck note | Reproduction status, recent changes, boundary map, and trace starting point |
| D2 | route note | Branch selection plus rationale; may stay inline in run metadata |
| D4 | optional per-hypothesis notes | Required for multi-hypothesis runs |
| D4 | optional branch evidence bundle | Required when `logs-ci`, `database`, `performance`, or `frontend` branch is active |
| D6 | `debug-report.md` | Always required |

Branch-specific evidence expectations:

- `logs-ci`: failing job identifiers, relevant log excerpts or summaries, and stage correlation notes
- `database`: query or migration evidence, schema context, and safety note for risky diagnostics
- `performance`: measured symptom data plus bottleneck analysis notes
- `frontend`: screenshots and console/network observations when browser helpers are available, otherwise a fallback note explaining the reduced evidence path

### 8.6 Debug Report Contract

`debug-report.md` must include:

- executive summary with issue, impact, root cause status, and recommended next action
- selected investigation branch or branch mix
- timeline or ordered investigation sequence when timing matters
- technical analysis with findings, evidence chain, and confirmed root cause
- disproven hypotheses and why they were ruled out
- actionable recommendations separated into immediate, short-term, and long-term follow-ups when applicable
- supporting evidence references: logs, traces, metrics, screenshots, queries, or runner outputs
- unresolved questions at end if any

`cdx debug` may spawn parallel debugger workers when:

- the issue spans multiple components
- evidence sources are independent
- competing hypotheses benefit from adversarial testing
- branch-specific evidence can be collected independently

## 9) `cdx team`

### 9.1 Goal

Replace Claude-native Agent Teams with CodexKit team-scoped runs that preserve:

- shared task list and self-claim behavior
- direct teammate messaging
- wake-on-message and idle notifications
- coordinated shutdown and cleanup

### 9.2 Command Surface and Flags

CodexKit must preserve the global team command contract:

- `cdx team <template> <context>`
- team-size flags such as `--devs`, `--researchers`, `--reviewers`, `--debuggers`
- `--plan-approval` and `--no-plan-approval`
- `--delegate` for lead-only coordination mode

Global team rules:

- `--delegate` means the lead coordinates tasks, approvals, and synthesis, but does not take ownership of implementation work
- every template must perform team bootstrap first; if the team runtime is unavailable or bootstrap fails, abort the command
- `cdx team` must not silently fall back to sequential or subagent execution
- all teammate spawns must be team-scoped and tied to the active team run

### 9.3 Supported Templates

Phase 6 must support:

- `cdx team research`
- `cdx team cook`
- `cdx team review`
- `cdx team debug`

### 9.4 Flow

| Step | Checkpoint | Gate | Required result |
|---|---|---|---|
| M0 | `team-bootstrap` | No | Team created, template selected, teammate context compiled |
| M1 | task seed | No | Team-scoped tasks created with dependencies |
| M2 | execution | No | Workers claim tasks, send messages, publish artifacts |
| M3 | `team-monitor` | No | Lead reacts to runtime events such as `task.completed`, `worker.idle`, and routed team messages |
| M4 | `team-shutdown` | No | Shutdown requests sent, teammates drained, team deleted |

### 9.5 Team Rules

- team mode must not silently degrade into sequential single-run execution
- every write-capable teammate task must include owned scope or owned files
- direct messaging must support teammate and lead targeting
- primary monitoring must use CodexKit runtime events, not Claude-native hook names
- `task.completed` and `worker.idle` are the primary monitoring path; polling is fallback only
- failed or stuck teammates can be replaced and their tasks reassigned without corrupting team state

### 9.6 Template Contracts

| Template | Required workers | Required output |
|---|---|---|
| research | researcher teammates | merged research summary |
| cook | dev teammates + tester + finalize workers | implementation/test/finalize bundle |
| review | scoped code reviewers | merged review report |
| debug | debugger teammates per hypothesis | merged root-cause report |

### 9.7 Template-Specific Rules

`cdx team research` must:

- derive explicit research angles before teammate spawn
- seed one research task per angle
- merge teammate reports into one synthesized research summary

`cdx team cook` must:

- accept either a plan path or a feature description
- bootstrap a planner step first when only a description is given
- preserve `--plan-approval` behavior with default `on`
- require each dev teammate to publish an execution plan or ownership proposal before code changes begin
- route approval back to the developer through the approval layer plus a `plan_approval_response` message artifact
- create non-overlapping dev ownership scopes and a tester task blocked on all dev tasks
- run docs impact evaluation before shutdown and before any finalize handoff completes
- abort rather than silently falling back to non-team execution if team bootstrap fails

`cdx team review` must:

- derive explicit review focuses such as security, performance, and test coverage
- run one reviewer per focus or per scoped file group
- merge and de-duplicate findings into one review report
- seed review tasks so fix/verify follow-up can attach cleanly when findings require action

`cdx team debug` must:

- derive competing hypotheses up front
- allow debugger teammates to challenge each other through direct messaging
- merge per-hypothesis evidence into one root-cause report

### 9.8 Team Event Mapping

ClaudeKit source templates refer to native events like `TaskCompleted` and `TeammateIdle`.

CodexKit must map those expectations to durable runtime events:

- Claude `TaskCompleted` -> CodexKit `task.completed`
- Claude `TeammateIdle` -> CodexKit `worker.idle`
- team wake by peer message -> CodexKit `message.sent` to worker or team
- plan approval routing -> CodexKit `approval.resolved` plus `plan_approval_response`

## 10) Phase 7: Finalize, Sync-Back, Docs, Git

### 10.1 When Finalize Runs

Finalize is mandatory for:

- `cdx cook` after successful review
- `cdx fix` when repo content changed
- `cdx team cook` at lead synthesis time

Finalize is optional or skipped-with-reason for standalone `cdx review`, `cdx test`, and `cdx debug`.

### 10.2 Finalize Flow

| Step | Checkpoint | Gate | Required result |
|---|---|---|---|
| X0 | finalize entry | No | Gather implementation, test, and review artifacts |
| X1 | `finalize-sync` | No | Full sync-back completed or explicit no-plan path recorded |
| X2 | `finalize-docs` | No | Docs impact evaluated and acted on |
| X3 | `finalize-git` | Yes for commit | Git handoff prepared; commit only on approval |
| X4 | publish | No | Finalize report written and run status updated |

### 10.3 Sync-Back Contract

Sync-back must:

- parse all `phase-*.md` files in the active plan dir
- reconcile completed tasks against all relevant unchecked items, not only current phase
- backfill stale `[ ] -> [x]` items across the full plan
- update `plan.md` status and progress from actual checkbox state
- publish an unresolved mapping report when a completed task cannot be reconciled

If no active plan exists, finalize must record `no active plan` and continue with docs/git handling.

### 10.4 Docs Impact Contract

Docs impact evaluation is mandatory for every finalize-capable run.

`docs-impact-report.md` must include:

- impact level: `none`, `minor`, or `major`
- action taken: `no update needed`, `updated`, or `needs separate follow-up`
- affected docs paths or explicit reason for no update

`docs-manager` always runs for finalize-capable workflows. It may conclude that no documentation edit is needed, but it must still publish the impact decision.

### 10.5 Git Handoff Contract

`git-manager` must produce a `git-handoff-report.md` containing:

- changed files summary
- stageability or conflict warnings
- suggested conventional commit message
- explicit user choice needed: `commit`, `do not commit`, or `later`

Default rule:

- workflow may stage a preview internally
- workflow must not create a commit without terminal approval

### 10.6 Additional Public Workflow Contracts

The migration target also includes top-level helper workflows that are public commands in ClaudeKit and remain public in CodexKit V1.

`cdx docs` must preserve:

- `init`
- `update`
- `summarize`

Minimum contract:

- `init` creates or refreshes project documentation scaffolding from the current repo
- `update` evaluates changes and updates existing docs
- `summarize` produces a concise codebase summary without acting like full init

`cdx journal` must preserve:

- journaling of recent changes or a named topic
- durable output under `docs/journals/`
- use of the `journal-writer` role or equivalent workflow adapter

`cdx scout` must preserve:

- fast codebase scouting as a first-class command
- internal local scouting as the default path
- an explicit external scouting entrypoint compatible with the source `ext` token; a readable alias such as `--external` may exist, but `ext` must remain accepted for parity
- concise scout report output that can feed `brainstorm`, `plan`, `review`, `fix`, or `debug`

`cdx preview` must preserve:

- file or directory preview mode
- generation modes for explainers, slides, diagrams, and ASCII output
- an explicit `--stop` command that safely shuts down any background preview server when server-backed preview mode is active; when no server is running it should return an informative no-op
- terminal/file-first rendering in V1, with browser preview optional later

These workflows may remain lighter-weight than `cook` or `team`, but they must stay importable, callable, and documented as public commands rather than hidden helper-only skills.

## 11) Phase 8: Packaging and Migration UX

### 11.1 Shared Packaging Rules

All packaging commands must:

- scan before writing
- preview planned actions before apply
- preserve existing repo content unless the user approves a managed update
- record managed assets and source versions in the import registry
- surface manual follow-up steps instead of silently rewriting custom files

### 11.2 `cdx init`

Goal:

- install CodexKit into a new repo or migrate an existing ClaudeKit-style repo

Flow:

1. `package-scan` detects repo type: fresh, existing CodexKit, or ClaudeKit-style
2. `package-preview` renders planned files, conflicts, and preserved files
3. `package-apply` writes `.codexkit/`, root `AGENTS.md`, optional `.codex/config.toml`, manifests, and migration-safe docs/assets
4. publish `init-report.md`

Must support:

- fresh repo bootstrap
- existing repo install without destructive rewrites
- import registry creation
- root `README.md` creation or managed refresh so repo instructions have a canonical project overview like ClaudeKit
- optional preservation of root guidance files when already present
- explicit approval before writing protected Codex paths such as root `AGENTS.md` and `.codex/**`

Fresh-repo bootstrap rules:

- if the target directory is not git-backed, `package-preview` must say that worker-backed workflows require a git repo with an initial commit
- `package-apply` may initialize git only with explicit approval; it must not create an implicit bootstrap commit
- if install finishes before the repo has its first commit, CodexKit must mark the repo install-only and block worker-backed workflows until that commit exists

### 11.3 `cdx doctor`

Goal:

- detect missing dependencies, invalid runtime state, and migration drift

`doctor-report.md` must cover:

- required tools present: Codex CLI, Node runtime, git, `git worktree`
- repo is git-backed and has an initial commit before worker-backed workflows are treated as healthy
- runtime dir health and stale lock state
- manifest/import registry consistency
- root `README.md` presence when repo instructions require it
- resumable run or retained worktree anomalies
- missing generated files or broken install state

Output levels:

- `error`: blocks workflows
- `warn`: degraded but recoverable
- `info`: useful but non-blocking

### 11.4 `cdx resume`

Goal:

- resume interrupted runs safely from the durable ledger
- preserve ClaudeKit-style continuity both through run recovery and explicit plan-path continuation after a fresh shell

Flow:

1. `resume-select` lists resumable runs, teams, and pending approvals
2. `resume-recover` rehydrates checkpoint state, inbox state, and active plan pointers
3. reclaim stale tasks or workers when leases are expired
4. publish `resume-report.md`

Rules:

- resume never reuses a retained failed worktree in place
- resume may re-spawn workers against fresh worktrees
- resume must preserve audit continuity and checkpoint ids
- resume must surface an equivalent explicit continuation command when workflow semantics require it, such as `cdx cook <absolute-plan-path>` for plan-driven implementation re-entry

### 11.5 `cdx update`

Goal:

- update installed CodexKit-managed content without overwriting user-owned changes blindly

Flow:

1. `update-scan` compares installed version, release manifest, and import registry
2. `update-preview` shows managed-file changes and conflicts
3. apply only safe updates automatically
4. publish `update-report.md` with manual merge actions if needed

Rules:

- user-modified managed files require explicit choice before overwrite
- unmanaged repo files are never rewritten by default
- update may refresh manifests, generated role/workflow content, and packaged docs
- updates touching root `AGENTS.md` or `.codex/**` must stay preview-first and approval-gated

### 11.6 Migration Assistant

Phase 8 also ships a migration assistant used by `cdx init`, `cdx doctor`, and `cdx update`.

It must produce a `migration-assistant-report.md` with:

- detected source kit markers
- required install or upgrade actions
- risky customizations needing manual review
- recommended next command sequence

## 12) Phase 9: Hardening and Parity Validation

### 12.1 Outcome

Phase 9 is complete only if release readiness is backed by executable evidence, not document claims.

### 12.2 Golden Parity Suite

Golden tests must validate artifact and checkpoint parity for:

- `cdx brainstorm`
- `cdx plan`
- `cdx cook`
- `cdx review`
- `cdx test`
- `cdx fix`
- `cdx debug`
- `cdx team`
- finalize flow
- packaging commands

Golden assertions must cover:

- checkpoint order
- required artifacts exist
- required report sections exist
- approval gates appear at the right stages
- sync-back updates plans correctly
- docs impact and git handoff artifacts are produced

### 12.3 Chaos Suite

Chaos tests must cover:

- worker crash before task completion
- worker crash after artifact publish but before task update
- stale heartbeat reclaim
- daemon restart during active run
- interrupted finalize after sync but before git handoff
- stuck or unresponsive team member replacement
- approval interruption followed by resume

Each chaos case must assert:

- no ledger corruption
- deterministic reclaim or resume outcome
- preserved artifact history
- explicit operator-visible recovery state

### 12.4 Migration Validation Checklist

Release validation must include a checklist proving:

- new repo `cdx init` works
- existing ClaudeKit-style repo install is non-destructive
- `cdx doctor` detects broken installs and stale runtime state
- `cdx resume` restores interrupted workflows
- golden workflow suite passes on fixture repos
- chaos scenarios recover without orphaning critical state
- finalize still produces sync-back, docs impact, and git handoff

### 12.5 Release Readiness Report

Phase 9 must publish `release-readiness-report.md` containing:

- suite summary: unit, integration, golden, chaos
- explicit pass or fail table for every metric in `docs/non-functional-requirements.md`
- open blocker list
- waived issues, if any
- migration readiness verdict

## 13) Test Expansion Beyond Phase 1

This extends `docs/tdd-test-plan.md` beyond the current Phase 1 focus.

| Phase | Minimum new tests |
|---|---|
| 6 | unit tests for route selection, report synthesis, severity ordering, team event handling |
| 6 | integration tests for delegated review/test/fix/debug/team flows |
| 6 | comparative handoff fidelity tests for extended workflow bundles and parallel payoff benchmarks |
| 7 | integration tests for sync-back, docs impact evaluation, and commit approval handoff |
| 8 | CLI integration tests for init/doctor/resume/update against fixture repos and host-capability-gap fixtures |
| 9 | golden fixture tests, chaos recovery tests, and host-matrix smoke validation |

Test discipline remains:

- write failing tests before implementation where practical
- prefer invariant assertions over brittle transcript snapshots
- use fixture repos for workflow and packaging scenarios
- keep release gating tied to executable suites, not manual inspection only

## 14) Acceptance Criteria

Phases 6-9 are done only when all of the following are true:

- extended workflows run end-to-end with durable artifacts
- `cdx team` preserves task, message, and shutdown semantics
- finalize updates plans, evaluates docs impact, and produces git handoff
- packaging commands are safe for both fresh and migrated repos
- resume and reclaim succeed across interruption scenarios
- golden parity and chaos suites pass for release fixtures
- no critical blockers remain on the migration checklist
- all mandatory metrics in `docs/non-functional-requirements.md` pass on release fixtures

## 15) Phase 10 Shared Contract Freeze (`P10-S0`)

`P10-S0` freezes the cross-lane public contract only. It does not deliver the full publish lane, docs/onboarding lane, or packaged-artifact harness lane.

### 15.1 Public Package And Bin Contract

- package name: `@codexkit/cli`
- bin name: `cdx`
- public beta supports both:
  - `npx @codexkit/cli ...` (canonical quickstart)
  - global install via `npm install -g @codexkit/cli`

### 15.2 Runner Resolution Order Contract

Runner selection must resolve in this order:

1. env override via `CODEXKIT_RUNNER`
2. `.codexkit/config.toml` via `[runner] command = "..."`
3. default built-in `codex exec`

Account ownership rule remains frozen:

- CodexKit does not own Codex login/account state
- CodexKit binds to the selected runner command and current runner session
- `cdx doctor` must surface active runner source plus effective runner command and fail blocked with typed diagnostics when the selected runner is unavailable or incompatible
- `cdx init` preview/apply must surface active runner source plus effective runner command before mutation

### 15.3 Public-Beta Smoke Matrix Contract

Phase 10 acceptance matrix for packaged-artifact verification is frozen to these shared cases:

- `fresh-repo`
- `git-backed-repo`
- `install-only-repo`
- `wrapped-runner`

Later slices may implement harness details, but they must not redefine this matrix shape.

### 15.4 Docs Command-Form Contract

Public install and quickstart docs must preserve these exact command forms:

- `npx @codexkit/cli init`
- `npx @codexkit/cli doctor`
- `npm install -g @codexkit/cli`
- `cdx init`
- `cdx doctor`

## 16) Unresolved Questions

- Whether `cdx test ui` ships as a full V1 path or remains an adapted optional mode when browser helpers are present
- Whether `cdx update` should ever auto-merge user-modified managed files or always stop at preview
- Whether commit approval should default to stage-only or allow one-step stage-and-commit after explicit approval
