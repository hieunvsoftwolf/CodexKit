# ClaudeKit Source Wave 2 Plan

**Purpose:** extend the active Wave 1 graph into broader reusable ClaudeKit source knowledge without introducing host-specific projections  
**Status:** planning  
**Last Updated:** 2026-03-13

## 1. Starting Point

Wave 1 is active in `knowledge/claudekit-source/` and passes:

- `npm run validate:claudekit-source-graph`
- `npm run validate:claudekit-source-graph:wave1`
- `npm run smoke:claudekit-source-graph`
- `npm test`

Current graph status:

- 56 nodes
- 64 edges
- 127 evidence rows

Assumption carried forward:

- repository root `README.md` is still missing; note it, do not treat it as a blocker

## 2. Locked Wave 2 Decisions

- Keep all outputs host-neutral.
- Do not add host-specific `maps_to` projections.
- Add `workflow.research` as a first-class workflow.
- Model `team research` as a team template/subflow, not as `workflow.team_research`.
- Include `journal` only as a micro-scope:
  - `agent.journal_writer`
  - `skill.ck_journal`
  - `artifact.journal_entry_md`
  - `resource.docs_journals_dir`
- Do not model `workflow.journal` in Wave 2.

## 3. Wave 2 Goals

Wave 2 should make the graph more useful for future CLI and IDE ports by capturing:

- standalone research workflow semantics
- support workflows that were intentionally deferred in Wave 1
- plan template semantics from `plans/templates/**`
- richer team-template orchestration semantics
- reusable resource/context nodes that explain naming, reports, plans, and journals paths
- narrow journal capture for continuity and docs memory without inventing a full workflow

## 4. Exact Source Inventory

Read only the source needed for Wave 2:

- `.claude/agents/journal-writer.md`
- `.claude/agents/researcher.md` when re-checking research-role semantics
- `.claude/skills/research/SKILL.md`
- `.claude/skills/docs/SKILL.md`
- `.claude/skills/docs/references/init-workflow.md`
- `.claude/skills/docs/references/update-workflow.md`
- `.claude/skills/docs/references/summarize-workflow.md`
- `.claude/skills/scout/SKILL.md`
- `.claude/skills/scout/references/internal-scouting.md`
- `.claude/skills/scout/references/task-management-scouting.md`
- `.claude/skills/preview/SKILL.md`
- `.claude/skills/preview/references/generation-modes.md`
- `.claude/skills/preview/references/view-mode.md`
- `.claude/skills/journal/SKILL.md`
- `.claude/skills/team/SKILL.md`
- `.claude/skills/team/references/agent-teams-controls-and-modes.md`
- `.claude/skills/team/references/agent-teams-examples-and-best-practices.md`
- `plans/templates/feature-implementation-template.md`
- `plans/templates/bug-fix-template.md`
- `plans/templates/refactor-template.md`
- `plans/templates/template-usage-guide.md`

## 5. In Scope

### 5.1 Research Layer

Add:

- `skill.ck_research`
- `workflow.research`
- `artifact.research_report_md`
- `artifact.research_summary_md`

Capture:

- research methodology
- report contract
- source recency and attribution expectations
- relation from `template.team_research` to `workflow.research`

### 5.2 Support Workflow Layer

Promote these to first-class workflows if evidence is strong:

- `workflow.docs`
- `workflow.scout`
- `workflow.preview`

Also add any clearly supported artifacts/resources such as:

- `artifact.docs_summary_md` or equivalent only if source gives a stable contract
- `artifact.preview_output_md` or equivalent only if source gives a stable contract
- `artifact.scout_report_md` can be enriched, not renamed
- `resource.docs_dir`

### 5.3 Journal Micro-Scope

Add only:

- `agent.journal_writer`
- `skill.ck_journal`
- `artifact.journal_entry_md`
- `resource.docs_journals_dir`

Capture:

- when the journal-writer is used
- where journal entries live
- journal entry structure
- any team-mode constraints that are explicitly stated

Do not add:

- `workflow.journal`
- broad emotional/reflective policy nodes beyond what source states explicitly

### 5.4 Template Layer

Add first-class template nodes:

- `template.feature_implementation`
- `template.bug_fix`
- `template.refactor`
- `template.template_usage_guide`
- `template.team_research`
- `template.team_cook`
- `template.team_review`
- `template.team_debug`

Capture:

- when each plan template is selected
- which artifacts they shape
- which workflows they support
- how the usage guide constrains plan shape and context size

### 5.5 Team Orchestration Enrichment

Extend `workflow.team` with template-level semantics:

- `template.team_research` wraps `workflow.research`
- `template.team_cook` wraps `workflow.cook`
- `template.team_review` wraps `workflow.review`
- `template.team_debug` wraps `workflow.debug`

Add richer runtime/tool refs only when source is explicit:

- `tool_ref.exit_plan_mode`
- `tool_ref.plan_approval_response`
- `event_ref.task_completed`
- `event_ref.teammate_idle`
- `tool_ref.shutdown_request`
- `tool_ref.shutdown_response`

If schema expansion is needed for `event_ref`, do it intentionally and only after confirming that the new kind is required across multiple evidence-backed records.

### 5.6 Resource And Context Layer

Add reusable context nodes where source is explicit:

- `resource.reports_path`
- `resource.plans_path`
- `resource.name_pattern`
- `resource.active_plan`
- `resource.docs_dir`
- `resource.docs_journals_dir`
- `resource.current_branch`

These should capture CK Context and hook-injected naming/path assumptions without turning them into host-specific runtime design.

## 6. Out Of Scope

- any host-specific `maps_to` graph layer
- importer/exporter generation pipelines
- graph database init or SQLite cache
- `.opencode/**` knowledge capture
- raw prompt body storage
- session-state ledgers, pids, or runtime logs
- `workflow.journal`
- broad preview server internals unless directly needed for workflow meaning

## 7. Proposed Node Batches

### Batch 0: Wave 2 Baseline

- add `skill.ck_research`
- add `workflow.research`
- add resource nodes needed by new scopes
- extend schema only if a new kind such as `event_ref` is truly required

### Batch 1: Plan Templates

- add the four `plans/templates/**` nodes
- add edges from templates to `artifact.plan_md`, `artifact.phase_file_md`, `workflow.plan`, `workflow.fix`, or `workflow.cook` where source supports them

### Batch 2: Support Workflows

- add `workflow.docs`
- add `workflow.scout`
- add `workflow.preview`
- add any artifacts/contracts that are explicit in source

### Batch 3: Journal Micro-Scope

- add `agent.journal_writer`
- add `skill.ck_journal`
- add `artifact.journal_entry_md`
- add `resource.docs_journals_dir`

### Batch 4: Team Templates And Runtime Enrichment

- add `template.team_research`
- add `template.team_cook`
- add `template.team_review`
- add `template.team_debug`
- add related tool/event refs if evidence is strong

### Batch 5: Artifact And Gate Refinement

- add research report artifacts
- refine docs/preview/scout artifacts if exact contracts exist
- add any team-template gate semantics that are explicit and reusable

## 8. Proposed Edge Batches

1. `defines`
- skills to workflows
- templates to wrapped workflows

2. `references`
- templates to artifact contracts and usage guide references
- docs workflow to `resource.docs_dir`
- journal skill/agent to `resource.docs_journals_dir`

3. `uses` and `requires`
- `AskUserQuestion` routing for docs and preview
- research tool usage only where source is explicit
- team template refs to `Team*`, `Task*`, `SendMessage`, approval hooks/events

4. `produces`
- research workflow to research artifacts
- docs/scout/preview/journal/template outputs where explicit

5. `hands_off_to` and `delegates_to`
- `template.team_research` to `workflow.research`
- team template -> wrapped workflow relations
- research and docs handoffs only if source defines them clearly

## 9. Validation Extension

Wave 2 should add a new strict profile after node and edge scope is finalized:

- `validate:claudekit-source-graph:wave2`

Wave 2 validation should require:

- all Wave 2 nodes and edges
- no regression of Wave 1 query contract
- smoke query additions for:
  - `workflow.research`
  - support workflow routing (`docs`, `preview`)
  - team research template wrapping
  - journal micro-scope path and artifact contract

Wave 2 should also extend the maintenance tooling:

- `impact` must surface new Wave 2 nodes and edges when touched files change
- `smoke` should print Wave 2 query checks

## 10. Acceptance Criteria

Wave 2 is complete when:

- research workflow is queryable without rescanning source
- docs/scout/preview semantics are captured as reusable workflows or support nodes with evidence
- templates are queryable as first-class graph entities
- journal micro-scope exists without inventing a fake workflow
- team research is modeled as template/subflow wrapping `workflow.research`
- validators, smoke, and tests all pass
- update playbook and audit report are refreshed

## 11. Recommended Execution Order

1. `research`
2. `plans/templates/**`
3. `docs`
4. `scout`
5. `preview`
6. `journal` micro-scope
7. `team` template enrichment
8. validation and maintenance-tool extension

This order front-loads the highest-value reusable semantics and delays the more ambiguous team/runtime detail until the simpler standalone flows are already stable.

## 12. Deferred To Wave 3

- host-specific projections
- deterministic extractor/regenerator
- SQLite or graph DB cache
- preview server behavior beyond workflow-level meaning
- external scout mode as a first-class graph slice
- full journal lifecycle modeling
- package artifact export for downstream consumers

## 13. Risks

- support workflows may expose subcommands but not stable artifact filenames
- team references may describe events and responses more like protocol text than durable node contracts
- template semantics may overlap with existing `workflow.plan` and `artifact.plan_md` records and require careful non-duplicative modeling
- journal source is rich enough for artifact shape but still too weak for a safe standalone workflow model

## 14. Unresolved Questions

- none
