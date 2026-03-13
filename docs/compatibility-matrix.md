# ClaudeKit -> CodexKit Compatibility Matrix

**Project**: CodexKit
**Last Updated**: 2026-03-12
**Purpose**: Define exact migration mapping from ClaudeKit capabilities to CodexKit runtime and workflows

## Compatibility Policy

CodexKit targets **functional parity**, not host-runtime parity.

This means:
- preserve user-facing commands
- preserve workflow order and approval gates
- preserve role specialization
- preserve plan and report artifacts
- preserve task orchestration outcomes

This does not mean:
- replicate Claude Code internals
- replicate hook event contracts byte-for-byte
- replicate native Claude team/task APIs directly

## Parity Legend

| Level | Meaning |
|---|---|
| `Exact` | Same behavior and same artifact shape |
| `Equivalent` | Same user outcome, different runtime implementation |
| `Adapted` | Same task intent, but delivery mechanism changes |
| `Deferred` | Planned after V1 |

## Current Codex Native Capabilities

Current Codex host behavior already gives CodexKit useful integration points:

- root and ancestor `AGENTS.md` files are instruction-bearing and remain the canonical project guidance surface
- `.codex/config.toml` is the project-scoped Codex config surface for approvals, sandbox, features, and MCP server registration
- native MCP support exists, so CodexKit supplies compatibility semantics rather than inventing transport
- native skills exist, but CodexKit still needs its own importer and manifest layer for ClaudeKit migration fidelity
- native multi-agent role orchestration exists but remains experimental and is not sufficient as the durable parity runtime

## 1. Runtime and Primitive Mapping

| ClaudeKit Capability | ClaudeKit Source | CodexKit Equivalent | Parity Target | Migration Notes | Delivery Phase |
|---|---|---|---|---|---|
| Session bootstrap | `.claude/settings.json` `SessionStart` | `cdx` CLI boot + daemon run bootstrap + context compiler | `Equivalent` | Move session init logic out of host hook and into control plane | Phase 1-3 |
| Subagent bootstrap | `.claude/settings.json` `SubagentStart`, `.claude/hooks/subagent-init.cjs` | `worker.spawn` + worker context compiler | `Equivalent` | Compile context packet at spawn time instead of relying on host event payload | Phase 2-3 |
| Pre-tool policy hook | `.claude/settings.json` `PreToolUse`, privacy/scout hooks | daemon policy middleware + owned-path checks + approval requests | `Equivalent` | Policy decision happens in CodexKit tool surface, not host hook | Phase 3 |
| Post-tool reminders | `.claude/settings.json` `PostToolUse` | daemon-side notifications and terminal summaries | `Adapted` | Non-blocking reminder model | Phase 3 |
| Status line | `.claude/statusline.cjs` | terminal status panel in `cdx` | `Adapted` | No shell prompt injection required | Phase 1 |
| Ask user question | `AskUserQuestion` tool | `approval.request` + terminal prompt + `approval.respond` | `Equivalent` | Gate appears in terminal instead of Claude-native question UI | Phase 3 |
| Native task create | `TaskCreate` | `task.create` backed by SQLite ledger | `Equivalent` | Adds durable persistence instead of session-only tasks | Phase 3 |
| Native task list | `TaskList` | `task.list` | `Equivalent` | Filters and dependency metadata preserved | Phase 3 |
| Native task get | `TaskGet` | `task.get` | `Equivalent` | Includes artifacts, dependencies, ownership | Phase 3 |
| Native task update | `TaskUpdate` | `task.update` | `Equivalent` | Status, owner, blockers, notes supported | Phase 3 |
| Subagent spawn | `Task(subagent_type=...)` | `worker.spawn` | `Equivalent` | Worker runs in dedicated worktree with compiled context | Phase 2-3 |
| Team create | `TeamCreate` | `team.create` | `Equivalent` | Creates run-scoped team state and inbox | Phase 3 |
| Team delete | `TeamDelete` | `team.delete` | `Equivalent` | Clean shutdown plus archival log | Phase 3 |
| Agent messaging | `SendMessage` | `message.send` and `message.pull` | `Equivalent` | Mailbox model replaces Claude-native teammate bus | Phase 3 |
| Shutdown request | `SendMessage(type="shutdown_request")` | same message type in mailbox | `Equivalent` | Worker state machine handles graceful stop | Phase 3 |
| Plan approval response | `SendMessage(type="plan_approval_response")` | same message type or approval response record | `Equivalent` | Used by `team` and `cook` workflows | Phase 3 |
| Session-scoped task graph | Claude native tasks | SQLite ledger + claim leases | `Adapted` | Becomes durable and resumable across shells | Phase 1 |
| Team idle/wake behavior | Claude team runtime | event bus + mailbox wake-up | `Equivalent` | Explicit worker states: idle, running, waiting_message | Phase 2-3 |
| Hook-injected naming and plan context | `subagent-init.cjs`, `session-init.cjs` | context compiler from run state and plan state | `Equivalent` | No environment-file dependence | Phase 2 |

## 2. State, Plans, and Persistence Mapping

| ClaudeKit Capability | ClaudeKit Source | CodexKit Equivalent | Parity Target | Migration Notes | Delivery Phase |
|---|---|---|---|---|---|
| Active plan state | `.claude/scripts/set-active-plan.cjs` | `runs.plan_dir` + separate suggested-plan state + context compiler | `Equivalent` | Suggested branch-matched plans stay hints only until explicit activation; only the active plan changes report paths and continuation state | Phase 1-2 |
| Plan hydration | `docs/skill-native-task.md` | plan sync engine reading `plan.md` and `phase-*.md` | `Exact` | Unchecked items become ready tasks | Phase 4-5 |
| Sync-back to plans | `cook` finalize, `skill-native-task.md` | plan sync engine | `Exact` | Completed tasks backfill checkboxes across all phases | Phase 7 |
| Report naming | hook naming injection | naming service in daemon | `Equivalent` | Uses run, role, date, slug patterns | Phase 2 |
| Reports folder per plan | plan context injection | artifact service + reports path resolver | `Exact` | Same durable report pattern preserved | Phase 2 |
| Session resume | Claude session resume plus re-hydration | public `cdx resume` + daemon replay + explicit `cdx cook <abs-plan-path>` re-entry | `Equivalent` | ClaudeKit uses host resume hooks plus explicit plan-path continuation after cleared context; CodexKit must preserve both continuation styles | Phase 1-8 |
| Installed kit metadata | `.claude/.ck.json`, `.claude/metadata.json` | `.codexkit/config.toml` + manifest registry | `Adapted` | Track import source and runtime config | Phase 8 |

## 3. Workflow Command Mapping

| ClaudeKit Workflow | ClaudeKit Source | CodexKit Command | Parity Target | Migration Notes | Delivery Phase |
|---|---|---|---|---|---|
| Brainstorm | `.claude/skills/brainstorm/SKILL.md` | `cdx brainstorm` | `Equivalent` | Keeps discovery, debate, report, optional planning handoff | Phase 5 |
| Plan | `.claude/skills/plan/*`, `planner.md` | `cdx plan` | `Equivalent` | Generates `plan.md` + phases, preserves YAML frontmatter and mode-specific handoff commands | Phase 5 |
| Cook | `.claude/skills/cook/SKILL.md`, `workflow-steps.md` | `cdx cook` | `Equivalent` | Highest-priority parity workflow; default remains interactive, explicit `--auto` skips gates | Phase 5-7 |
| Fix | `.claude/skills/fix/*` | `cdx fix` | `Equivalent` | Preserves quick/standard/deep task patterns and ClaudeKit's autonomous-first mode-selection behavior | Phase 6 |
| Debug | `.claude/skills/debug/*` | `cdx debug` | `Equivalent` | Preserves investigation pipeline and evidence gathering | Phase 6 |
| Review | `.claude/skills/code-review/*` or reviewer role usage | `cdx review` | `Equivalent` | Keeps delegated review and severity output | Phase 6 |
| Test | `.claude/skills/test/*` | `cdx test` | `Equivalent` | Keeps test orchestration and retry loops | Phase 6 |
| Team | `.claude/skills/team/SKILL.md` | `cdx team` | `Equivalent` | Event-driven mailbox team mode replaces native Claude teams | Phase 6 |
| Docs update | `docs-manager`, docs workflows | `cdx docs` | `Equivalent` | Preserves docs impact and update behaviors | Phase 7 |
| Journal | `journal-writer` workflow | `cdx journal` | `Equivalent` | Durable reporting flow retained | Phase 7 |
| Scout | `ck:scout` skill | `cdx scout` | `Equivalent` | Internal search workflow on top of Codex tools | Phase 5 |
| Preview | `ck:preview` skill | `cdx preview` | `Adapted` | Terminal and file output first; browser UI optional later | Phase 7 |

## 4. `cdx cook` Step-Level Mapping

| ClaudeKit `cook` Step | ClaudeKit Runtime Assumption | CodexKit Runtime Replacement | Parity Target | Notes |
|---|---|---|---|---|
| Step 0 intent detection | skill-level parsing | same logic in workflow engine | `Exact` | Modes preserved: interactive, auto, fast, parallel, no-test, code |
| Step 1 research | `Task` or `researcher` spawn | `worker.spawn(role="researcher")` | `Equivalent` | Parallel researchers in isolated worktrees |
| Review gate 1 | `AskUserQuestion` | terminal approval checkpoint | `Equivalent` | Approve, revise, abort |
| Step 2 planning | planner agent and plan files | planner worker + plan writer | `Equivalent` | Plan frontmatter preserved |
| Review gate 2 | `AskUserQuestion` | terminal approval checkpoint | `Equivalent` | Plan approve or revise |
| Step 3 implementation | Task graph + worker claims | ledger tasks + auto-claim workers | `Equivalent` | Ownership and blockers explicit |
| Review gate 3 | `AskUserQuestion` | terminal approval checkpoint | `Equivalent` | Summary rendered by CLI |
| Step 4 testing | mandatory tester/debugger delegation | same via `worker.spawn` | `Exact` | No self-test shortcut allowed |
| Review gate 4 | `AskUserQuestion` | terminal approval checkpoint | `Equivalent` | Test summary displayed |
| Step 5 code review | mandatory code-reviewer delegation | same via `worker.spawn` | `Exact` | Review score and critical findings preserved |
| Step 6 finalize | project-manager/docs-manager/git-manager delegation | same via three role workers | `Exact` | Sync-back, docs update, git handoff preserved |

## 5. Role Mapping

| ClaudeKit Role | ClaudeKit Source | CodexKit Role Manifest | Parity Target | Migration Notes | Delivery Phase |
|---|---|---|---|---|---|
| `planner` | `.claude/agents/planner.md` | `planner.role.json` + imported prompt | `Equivalent` | Replace native tasks with compatibility tools | Phase 4 |
| `researcher` | `.claude/agents/researcher.md` | `researcher.role.json` | `Equivalent` | Preserve report-first behavior | Phase 4 |
| `brainstormer` | `.claude/agents/brainstormer.md` | `brainstormer.role.json` | `Equivalent` | Preserve advise-only constraint | Phase 4 |
| `fullstack-developer` | `.claude/agents/fullstack-developer.md` | `fullstack-developer.role.json` | `Equivalent` | Add owned-path policy metadata | Phase 4 |
| `tester` | `.claude/agents/tester.md` | `tester.role.json` | `Equivalent` | Read-write within owned scope; test artifact publication required | Phase 4 |
| `debugger` | `.claude/agents/debugger.md` | `debugger.role.json` | `Equivalent` | Preserve hypothesis and root-cause style | Phase 4 |
| `code-reviewer` | `.claude/agents/code-reviewer.md` | `code-reviewer.role.json` | `Equivalent` | Read-only by default in CodexKit | Phase 4 |
| `docs-manager` | `.claude/agents/docs-manager.md` | `docs-manager.role.json` | `Equivalent` | Explicit docs impact output retained | Phase 4 |
| `git-manager` | `.claude/agents/git-manager.md` | `git-manager.role.json` | `Equivalent` | Commit remains gated by user approval | Phase 4 |
| `project-manager` | `.claude/agents/project-manager.md` | `project-manager.role.json` | `Equivalent` | Handles sync-back and unresolved mapping reports | Phase 4 |
| `ui-ux-designer` | `.claude/agents/ui-ux-designer.md` | `ui-ux-designer.role.json` | `Equivalent` | Frontend ownership scopes explicit | Phase 4 |
| `journal-writer` | `.claude/agents/journal-writer.md` | `journal-writer.role.json` | `Equivalent` | Same report output semantics | Phase 4 |
| `mcp-manager` | `.claude/agents/mcp-manager.md` | `mcp-manager.role.json` | `Adapted` | Manages CodexKit MCPs instead of Claude assumptions | Phase 7 |
| `code-simplifier` | `.claude/agents/code-simplifier.md` | `code-simplifier.role.json` | `Deferred` | Lower priority than core migration roles | Post V1 |

## 6. Policy and Hook Mapping

| ClaudeKit Policy / Hook | ClaudeKit Source | CodexKit Replacement | Parity Target | Notes |
|---|---|---|---|---|
| Development rules reminder | `.claude/hooks/dev-rules-reminder.cjs` | context compiler includes active rule packs | `Equivalent` | Applied at run start and worker spawn |
| Usage context awareness | `.claude/hooks/usage-context-awareness.cjs` | daemon summaries and guardrail messages | `Adapted` | Runtime-level observability rather than host hook |
| Descriptive file naming reminder | `.claude/hooks/descriptive-name.cjs` | write-policy checker | `Equivalent` | Trigger before patch approval |
| Scout block | `.claude/hooks/scout-block.cjs` | owned-path + ignore-path filters | `Equivalent` | Faster and more deterministic |
| Privacy block | `.claude/hooks/privacy-block.cjs` | policy engine + terminal approval prompt | `Equivalent` | Preserves user gate semantics |
| Post-edit simplify reminder | `.claude/hooks/post-edit-simplify-reminder.cjs` | daemon notification after patch artifact publish | `Adapted` | Same intent, different trigger mechanism |

## 7. Installer and Repository Structure Mapping

| ClaudeKit Artifact | ClaudeKit Source | CodexKit Equivalent | Parity Target | Notes |
|---|---|---|---|---|
| `ck init` / `ck new` | external `claudekit-cli` flow | `cdx init` | `Equivalent` | Installs `.codexkit/`, root `AGENTS.md`, optional `.codex/config.toml`, manifests, docs |
| `.claude/` runtime dir | current workspace | `.codexkit/` runtime + optional `.codex/` project config | `Adapted` | Split between CodexKit state and Codex host config |
| `CLAUDE.md` | root artifact | root `AGENTS.md` plus generated role/workflow manifests | `Equivalent` | User-facing guidance re-hosted in the file Codex actually reads |
| `AGENTS.md` root instruction | root artifact | preserved or merged into root `AGENTS.md` | `Equivalent` | Do not relocate the canonical instruction file under `.codex/` |
| installed metadata registry | `.claude/metadata.json` | `.codexkit/manifests/import-registry.json` | `Equivalent` | Tracks source-to-manifest mapping |

## 8. Artifact and Output Mapping

| ClaudeKit Artifact | ClaudeKit Source | CodexKit Equivalent | Parity Target | Notes |
|---|---|---|---|---|
| decision reports | brainstorm and research workflows | same report shape under plan or run report path | `Exact` | Maintain naming and concise style |
| `plan.md` | planner workflow | same | `Exact` | Frontmatter required |
| `phase-*.md` | planner workflow | same | `Exact` | Checkboxes remain source of truth for migration |
| review reports | code-review workflows | same | `Exact` | Severity ordering preserved |
| debug reports | debug workflows | same | `Exact` | Root cause chain preserved |
| docs impact evaluation | cook finalize | same | `Exact` | Mandatory finalize artifact |
| git finalize summary | git-manager | same | `Equivalent` | Commit step remains user-controlled |

## 9. Known Gaps and Planned Adaptations

| Gap | Why It Exists | CodexKit Strategy | Priority |
|---|---|---|---|
| No native Claude-style task API in Codex | Host runtime difference | Build SQLite task ledger and MCP facade | P1 |
| Native multi-agent is experimental, not migration-grade durable state | Host feature exists but is not the parity target | Keep CodexKit task, claim, approval, and mailbox runtime authoritative | P1 |
| No native teammate message bus | Host runtime difference | Build mailbox + event-driven wake/suspend | P1 |
| No host hook contract | Host runtime difference | Move hook behavior into daemon middleware and context compiler | P1 |
| No built-in team UI | Host runtime difference | Terminal control panel plus status and inbox views | P1 |
| No direct Claude task hydration | Host runtime difference | Use plan sync engine and durable run state | P1 |
| Browser-native preview UX | Different product surface | Ship terminal/file-first preview in V1 | P2 |
| Archived or deprecated ClaudeKit commands | Low migration value | Defer until core parity is stable | P3 |

## 10. V1 Must-Pass Compatibility Targets

CodexKit V1 is considered migration-ready only if all of the following are true:

| Target | Required Result |
|---|---|
| `cdx brainstorm` | Produces a decision report and optional planning handoff |
| `cdx plan` | Produces valid `plan.md` and phase files with correct frontmatter |
| `cdx cook` | Executes through implementation, testing, review, and finalize |
| Task graph | Supports creation, auto-claim, dependency unblock, reclaim after worker failure |
| Messaging | Supports direct worker and team messaging with wake-on-message behavior |
| Approvals | All ClaudeKit review gates exist in terminal form |
| Sync-back | Completed tasks are reconciled into plan files correctly |
| Worker isolation | Parallel workers run in separate worktrees with explicit ownership |

## Unresolved Questions

- Whether `preview` parity should include a browser renderer in V1 or remain file-first
- Whether lower-priority roles like `code-simplifier` should be imported in the first release
- Whether migration tooling should preserve root `CLAUDE.md` and `AGENTS.md` verbatim or generate CodexKit-specific replacements
