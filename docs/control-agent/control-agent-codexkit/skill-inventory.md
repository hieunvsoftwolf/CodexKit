# CodexKit Control Skill Inventory

**Project**: CodexKit  
**Control Agent**: `control-agent-codexkit`

This inventory defines the recommended skill and model mapping for the generated control agent. If a listed skill is unavailable in the host, the control agent should say so explicitly and continue with the best available fallback.

| Role | Suggested Model | Fallback Model | Modal Hint | Preferred Skills | Use For |
|---|---|---|---|---|---|
| `planner` | `gpt-5.4 / medium` | `closest flagship reasoning model / medium` | planning / reasoning mode if the host exposes modal selection | `openai-docs`, `docs-seeker`, `sequential-thinking` | phase decomposition, dependency mapping, source-of-truth verification |
| `spec-test-designer` | `gpt-5.4 / medium` | `closest flagship reasoning model / medium` | planning / reasoning mode if the host exposes modal selection | `docs-seeker`, `web-testing`, `sequential-thinking` | TDD-first acceptance design, fixture design, expected command/result mapping |
| `fullstack-developer` | `gpt-5.3-codex / high` | `closest coding-first model / high` | coding mode if the host exposes modal selection | `security-best-practices`, `docs-seeker`, `git` | implementation, safe edits, spec-constrained code changes |
| `tester` | `gpt-5.3-codex / medium` | `closest coding-first model / medium` | coding / verification mode if the host exposes modal selection | `web-testing`, `gh-fix-ci`, `docs-seeker` | executing the frozen test design, structured test evidence, CI failure triage |
| `code-reviewer` | `gpt-5.4 / high` | `closest flagship reasoning model / high` | review / reasoning mode if the host exposes modal selection | `security-best-practices`, `security-threat-model`, `gh-address-comments` | findings-first review, invariant checking, trust-boundary review |
| `debugger` | `gpt-5.3-codex / high` | `closest coding-first model / high` | coding / debugging mode if the host exposes modal selection | `gh-fix-ci`, `docs-seeker`, `sequential-thinking` | root-cause analysis, failure reproduction, flaky integration diagnosis |
| `docs-manager` | `gpt-5.4 / medium` | `closest flagship reasoning model / medium` | docs / reasoning mode if the host exposes modal selection | `docs-seeker`, `openai-docs` | updating docs when phase output changes user-facing contracts or workflows |
| `lead verdict` | `gpt-5.4 / medium` | `closest flagship reasoning model / medium` | reasoning / review mode if the host exposes modal selection | `none required` | phase pass/fail decision against acceptance criteria and evidence |

## Notes

- `planner` should be used whenever the current phase has 3 or more non-trivial tasks, shared ownership risk, or unclear dependencies.
- `spec-test-designer` should be used whenever the phase has stable acceptance criteria and meaningful independent verification is required.
- `docs-manager` should be added when the phase changes user-facing commands, workflows, contract docs, or onboarding paths.
- `debugger` should be added when the current phase is blocked by flaky tests, integration breakage, CI failure, or unclear runtime behavior.
