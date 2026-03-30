# CodexKit Plan Contract

**Project**: CodexKit  
**Control Agent**: `control-agent-codexkit`

## 1. Purpose

Keep `plan.md` readable for humans and stable for control-agent parsing across repos, sessions, and regenerated scaffolds.

## 2. Recommended Machine-Readable Plan Frontmatter

Every active `plan.md` should keep these frontmatter fields synchronized:

- `title`
- `status`
- `current_phase`
- `current_phase_doc`
- `current_phase_status`
- `latest_control_state`

Recommended meanings:

- `status`: overall plan state such as `planned`, `in_progress`, `blocked`, or `complete`
- `current_phase`: short phase id such as `10c`
- `current_phase_doc`: path relative to `plan.md`
- `current_phase_status`: execution or wave state such as `pending`, `ready_for_w0b`, `in_progress`, `blocked`, `accepted`, or `complete`
- `latest_control_state`: path relative to `plan.md` pointing at the newest durable control-state report

## 3. Recommended Human-Readable Structure

- Keep a `## Phases` table with:
  - phase id
  - phase title
  - status
  - link to the phase doc
- Keep an explicit planning note when the next execution phase matters.
- Prefer a dedicated phase doc per active phase with:
  - `## Context`
  - `## Overview`
  - `## Requirements`
  - `## Implementation Steps`
  - `## Todo List`
  - `## Success Criteria`

## 4. Control-Agent Detection Order

Generated control-agents should resolve current phase in this order:

1. latest durable control-state under the active reports path
2. machine-readable plan frontmatter
3. explicit planning note in `plan.md`
4. `## Phases` table
5. legacy `### Phase ...` sections with checkbox tasks

## 5. Update Rules

- Update `current_phase`, `current_phase_doc`, `current_phase_status`, and `latest_control_state` in the same change wave that advances control state.
- Keep `current_phase_doc` and `latest_control_state` relative to `plan.md`.
- When a phase becomes accepted or complete, advance `current_phase` to the next execution phase instead of leaving stale values behind.
- If a host verification constraint becomes durable, record it in the latest control-state report and update `latest_control_state` accordingly.

## 6. Example

```yaml
---
title: "CodexKit Implementation Plan"
status: in_progress
current_phase: "10"
current_phase_doc: "phase-10-public-cli-packaging-and-onboarding.md"
current_phase_status: "blocked"
latest_control_state: "reports/control-state-phase-10-p10-s2-remediation-reroute-control-agent-20260328-195610.md"
---
```
