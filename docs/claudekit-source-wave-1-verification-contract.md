# ClaudeKit Source Wave 1 Verification Contract

**Purpose:** lock strict pass/fail gates before expanding `knowledge/claudekit-source/`

## Scope

This contract applies to:

- `knowledge/claudekit-source/graph-manifest.json`
- `knowledge/claudekit-source/nodes.jsonl`
- `knowledge/claudekit-source/edges.jsonl`
- `knowledge/claudekit-source/evidence.jsonl`

Wave 1 covers ClaudeKit source knowledge only. No host-specific port decisions.

## Verification Layers

Every Wave 1 batch must satisfy:

1. **Base validation**
- manifest + record schema valid
- ids unique
- node/edge/evidence references resolve
- evidence source paths exist
- evidence checksum matches file content
- no placeholder checksum
- no placeholder line span

2. **Wave 1 completeness validation**
- required core agents exist
- required core workflows exist
- required core rules exist
- required runtime rewrite refs exist
- required artifact contracts exist
- required handoff edges exist

3. **Query contract regression tests**
- canonical handoffs resolve: `brainstorm -> plan`, `plan -> cook`, `debug -> fix`, `review -> fix`
- output queries resolve: decision, plan, phase, review, debug, and test artifacts
- tool/runtime queries resolve for `AskUserQuestion`, `Task*`, `Team*`, `SendMessage`, and hook-injected context
- finalize queries resolve from finalize gate to git handoff artifact

4. **Manual review checklist**
- semantic meaning matches ClaudeKit source
- ambiguous meaning is marked `manual-review`
- no CodexKit or OpenCode design leakage

No batch is considered done unless all required layers for that stage pass.

## Checksum And Evidence Rules

- Evidence checksum format is `sha256:<64 hex chars>`.
- Checksum is the full source file digest, not snippet digest.
- `lineStart` and `lineEnd` are required for Wave 1 evidence rows.
- Reserved placeholder sentinel is forbidden: `lineStart=1` and `lineEnd=999`.
- `seed-pending` is forbidden.
- Use the smallest defensible source span for each claim.

## Required Wave 1 Node IDs

### Agents
- `agent.brainstormer`
- `agent.code_reviewer`
- `agent.debugger`
- `agent.docs_manager`
- `agent.git_manager`
- `agent.planner`
- `agent.project_manager`
- `agent.researcher`
- `agent.tester`

### Skills
- `skill.ck_brainstorm`
- `skill.ck_code_review`
- `skill.ck_cook`
- `skill.ck_debug`
- `skill.ck_fix`
- `skill.ck_plan`
- `skill.ck_team`
- `skill.ck_test`
- `skill.ck_docs`
- `skill.ck_preview`
- `skill.ck_scout`

### Workflows
- `workflow.brainstorm`
- `workflow.cook`
- `workflow.debug`
- `workflow.fix`
- `workflow.plan`
- `workflow.review`
- `workflow.team`
- `workflow.test`

### Rules
- `rule.development_rules`
- `rule.documentation_management`
- `rule.orchestration_protocol`
- `rule.primary_workflow`

### Runtime / Tool Refs
- `tool_ref.ask_user_question`
- `tool_ref.send_message`
- `tool_ref.task_create`
- `tool_ref.task_get`
- `tool_ref.task_list`
- `tool_ref.task_subagent`
- `tool_ref.task_update`
- `tool_ref.team_create`
- `tool_ref.team_delete`
- `runtime_primitive.hook_injected_context`

### Artifacts
- `artifact.decision_report_md`
- `artifact.debug_report_md`
- `artifact.docs_impact_report`
- `artifact.git_handoff_report`
- `artifact.phase_file_md`
- `artifact.plan_md`
- `artifact.review_report_md`
- `artifact.scout_report_md`
- `artifact.test_report_md`

### Gates
- `gate.finalize_required`
- `gate.plan_approval`
- `gate.review_approval`
- `gate.test_pass_required`

## Required Wave 1 Edges

At minimum:

- `workflow.brainstorm hands_off_to workflow.plan`
- `workflow.plan hands_off_to workflow.cook`
- `workflow.debug hands_off_to workflow.fix`
- `workflow.review hands_off_to workflow.fix`
- `workflow.brainstorm produces artifact.decision_report_md`
- `workflow.plan produces artifact.plan_md`
- `workflow.plan produces artifact.phase_file_md`
- `workflow.review produces artifact.review_report_md`
- `workflow.debug produces artifact.debug_report_md`
- `workflow.test produces artifact.test_report_md`
- `workflow.cook gated_by gate.finalize_required`
- `workflow.fix gated_by gate.finalize_required`
- `gate.finalize_required hands_off_to artifact.git_handoff_report`

## Ambiguity Policy

- If the source states the behavior explicitly, mark record `active`.
- If the meaning is implied but still strong enough for Wave 1, allow the record with:
  - `status: manual-review`
  - reduced confidence
  - explicit inference note in evidence
- If meaning is weak or depends on host-specific interpretation, defer to Wave 2.

## Update Protocol For Future ClaudeKit Changes

When ClaudeKit source changes:

1. identify touched source files
2. rescout only affected source area
3. update node ids only if semantics changed
4. append or repair evidence first in working notes
5. update `nodes.jsonl`, then `evidence.jsonl`, then `edges.jsonl`
6. run base validation after each batch
7. run Wave 1 validation after the full update
8. run manual checklist
9. update `graph-manifest.json` last

No downstream graph import or init should happen from an invalid batch.

## Publish Rule

Validated JSONL files are the source of truth.

Any future importer, SQLite cache, graph DB, or IDE index must be derived from the validated JSONL set only.
