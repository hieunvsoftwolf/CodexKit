# Project Overview & Product Development Requirements (PDR)

**Project Name**: CodexKit
**Version**: 0.1.0-draft
**Last Updated**: 2026-03-13
**Status**: Planning
**Project Type**: Migration product
**Primary Runtime Target**: Local Codex CLI, terminal-first UX
**Public Command Prefix**: `cdx`

## Executive Summary

CodexKit is a migration-focused product that recreates the functional surface of ClaudeKit on top of Codex. The goal is not to reproduce Claude Code internals. The goal is to preserve the same user-facing tasks, workflows, agents, gates, reports, and orchestration outcomes while replacing Claude-native runtime primitives with a Codex-native control plane.

CodexKit exists because ClaudeKit in this workspace is tightly coupled to Claude Code runtime contracts such as hooks, native task management, ask-user flows, team orchestration, and subagent lifecycle injection. Current Codex already provides useful host primitives such as root `AGENTS.md` instruction loading, project-scoped `.codex/config.toml`, MCP server integration, skills, sandbox and approval controls, and experimental multi-agent role orchestration. What it still does not provide is ClaudeKit-equivalent durable workflow state, a resumable shared task graph, or a migration-grade mailbox and approval runtime. CodexKit turns Codex host features plus local execution strengths into a replacement runtime that can support the same operational model users expect from ClaudeKit.

## Problem Statement

ClaudeKit today depends on a runtime model that is not portable to Codex:
- Hook-driven context injection and policy enforcement
- Native session-scoped task graph
- Native subagent and team orchestration
- Ask-user approval primitives
- Shared task ownership and message passing between agents

Without a compatibility layer, ClaudeKit content can be reused only as static instructions. The high-value workflows such as `/cook`, `/plan`, `/brainstorm`, `/fix`, and `/team` lose their orchestration semantics.

## Product Goal

Build a standalone `CodexKit` that enables users to:
- Use the same task-driven development model as ClaudeKit
- Run specialized agents with role-specific context and permissions
- Auto-claim tasks and coordinate through an event-driven runtime
- Approve gates in the terminal without needing an external UI
- Keep plans, reports, docs sync, testing, review, and finalize steps intact
- Migrate existing ClaudeKit projects and working habits with minimal retraining

## Vision

Make Codex a first-class host for ClaudeKit-grade software delivery workflows by shipping a local-first orchestration kit that preserves ClaudeKit behavior at the workflow level and improves on execution isolation.

## Mission

Deliver a migration-ready product that:
- Preserves ClaudeKit functional behavior on Codex
- Provides deterministic orchestration primitives missing from Codex runtime
- Reuses existing ClaudeKit content instead of rewriting everything from scratch
- Runs fully from local CLI and terminal prompts
- Supports production-grade planning, implementation, testing, review, and documentation loops

## Success Definition

CodexKit is successful when a team can take an existing ClaudeKit-driven repo and perform the following end-to-end from Codex:
- `cdx brainstorm` to produce decision reports and optionally hand off to planning
- `cdx plan` to create `plan.md` and `phase-*.md` files with tracked progress
- `cdx cook` to execute a feature plan with research, planning, implementation, test, review, finalize
- `cdx fix` and `cdx debug` to drive structured issue investigation and recovery
- `cdx review` and `cdx test` to delegate review and validation work to isolated workers
- `cdx team` to run multi-worker pipelines with message passing, auto-claim, and event-driven wake/suspend behavior

Functional parity claims are valid only when the owned metrics in `docs/non-functional-requirements.md` pass with executable evidence.

## Product Principles

- Functional parity over runtime parity
- Reuse content, replace execution model
- Local CLI first, terminal-first approvals
- Artifact-first collaboration over long free-form chat
- Event-driven orchestration over blocking coordinator loops
- Strong worker isolation and explicit file ownership
- Migration safety over feature novelty

## Non-Functional Requirements

CodexKit quality is governed by `docs/non-functional-requirements.md`.

V1 parity floor requirements:

- `NFR-1` Deterministic Continuity: resume, handoff, and explicit re-entry remain reliable without transcript reuse
- `NFR-2` Isolation and Repo Safety: worker execution never escapes owned paths or unsafe dirty-root policy
- `NFR-3` Interactive UX Efficiency: deterministic orchestration stays usable, prompt-light, and diagnostically clear
- `NFR-4` Real-Repo Robustness and Migration Safety: install, doctor, update, and workflow entry behave safely on supported repo states
- `NFR-5` Auditability and Failure Diagnosis: terminal state, artifacts, checkpoints, and recovery blockers stay inspectable after interruption

V1 surpass-host requirements:

- `NFR-6` Context Fidelity and Handoff Quality: compiled context must preserve enough intent and decisions that fresh-session continuation remains coherent without transcript dependency
- `NFR-7` Throughput and Parallel Payoff: worker orchestration and parallel workflows must provide measurable speed benefit, not just more machinery
- `NFR-8` Host Compatibility and Drift Resilience: Codex host changes must be detected early, surfaced clearly, and handled without silent downgrade

## CLI Surface Policy

- Public terminal syntax uses space-separated commands such as `cdx brainstorm`, `cdx plan`, `cdx cook`, and `cdx resume`
- ClaudeKit-style continuation remains first-class through explicit artifact paths such as `cdx cook /abs/path/to/plan.md`, especially after a fresh shell or cleared context
- Operator and inspection commands use subcommands such as `cdx daemon ...`, `cdx run ...`, `cdx task ...`, and `cdx approval ...`
- Specs should present the space-separated `cdx ...` command form as the canonical shell syntax; legacy ClaudeKit labels should appear only when quoted from source

## Workflow Execution Model

- Each top-level `cdx` workflow command creates or attaches to one durable workflow run in the ledger
- The run is the source of truth for checkpoints, approvals, active plan pointer, artifacts, and downstream handoff links
- Each worker attempt starts a fresh Codex child process in its own worktree from a compiled launch bundle
- Continuity comes from durable run state, artifacts, and context compilation, not from reusing a Codex transcript as workflow state
- Accepted handoffs such as brainstorm -> plan or plan -> cook create a linked downstream run with inherited artifact refs and plan pointers
- Approval policy is scoped to the current run. A downstream run inherits `auto` behavior only when the source workflow explicitly emits that policy in its handoff command or handoff metadata
- In interactive mode, the CLI may stay attached across a handoff so the user experiences one continuous terminal flow even though the downstream workflow is a new run
- `cdx resume` reconstructs workflow state from the ledger and may re-spawn fresh workers; it must not depend on the original Codex worker process still being alive
- Explicit plan-path re-entry must remain usable even when the original CLI attachment is gone, matching ClaudeKit's `/clear` then `/cook {absolute-plan-path}` continuation style

## Verified Host Assumptions

The current host assumptions are:

- root `AGENTS.md` remains the canonical Codex instruction entrypoint
- project-scoped Codex host config belongs in `.codex/config.toml` when needed
- native skills and experimental multi-agent roles are optional host accelerators, not the source of truth for CodexKit workflow state
- CodexKit remains authoritative for durable runs, tasks, claims, approvals, mailbox routing, and resume semantics

## Scope

### In Scope

- A local `cdx` CLI and background runtime
- Full workflow support for ClaudeKit core tasks
- Reusable role system derived from ClaudeKit agents
- Reusable workflow definitions derived from ClaudeKit skills
- Native task ledger, messaging, approvals, team state, and worker lifecycle
- Worktree-based worker isolation
- Plan hydration and sync-back
- Docs, review, test, and git finalize orchestration
- Compatibility importer for `.claude/agents`, `.claude/skills`, `.claude/rules`, and `plans/templates`
- MCP-based compatibility tool surface for Codex workers
- Terminal UX for approvals, run state, and targeted agent messaging

### Out of Scope for V1

- Perfect emulation of Claude Code hook internals
- Codex App-specific UI integration
- Web dashboard as a required dependency
- Cloud-only orchestration as the primary path
- Full historical migration of every previous Claude session
- Reimplementation of every low-value or deprecated slash command in ClaudeKit archives

## Inputs and Outputs

### Inputs

- Existing ClaudeKit content in `.claude/`
- Existing plan templates in `plans/templates/`
- Existing reports, plans, docs, and conventions in the repository
- Existing user mental model around `/brainstorm`, `/plan`, `/cook`, `/fix`, `/team`
- Codex CLI local runtime

### Outputs

- `CodexKit` runtime and CLI
- Root-level `docs/` with migration-ready product and technical docs
- `.codexkit/` runtime directory
- root `AGENTS.md` plus optional `.codex/config.toml` and other Codex integration files
- Terminal-first orchestration workflows
- Compatibility tooling to run migrated tasks with parity expectations

## Target Users

### Primary Users

1. Existing ClaudeKit users migrating to Codex
2. Technical leads who want deterministic multi-agent workflows in local CLI
3. Solo developers who rely on structured planning and review loops
4. Teams wanting stronger isolation and worktree-based parallel execution

### User Needs

- Preserve existing working habits
- Preserve report and plan artifacts
- Preserve role specialization
- Preserve approval gates
- Gain stronger isolation and more controllable worker execution
- Avoid rebuilding internal orchestration semantics by hand each session

## User Personas

### Persona 1: ClaudeKit Migrator

- Already uses ClaudeKit workflows
- Wants Codex runtime benefits without losing orchestration behavior
- Expects commands and artifacts to remain familiar

### Persona 2: Terminal-First Tech Lead

- Runs development from local shell and worktrees
- Needs visibility into worker states, ownership, blockers, and approvals
- Wants task graphs and reports to remain deterministic

### Persona 3: Multi-Agent Workflow Designer

- Treats the coding agent system as production infrastructure
- Needs reusable role definitions, explicit policies, and repeatable workflows
- Wants event-driven coordination rather than manual task juggling

## Market Context

There are building blocks on the market, but no complete drop-in ClaudeKit-for-Codex product was identified during current research:
- `openai/skills` provides official Codex skills, not a full orchestration runtime
- `n-skills` and `openskills` provide skill distribution and cross-agent packaging
- `Agor`, `agentpipe`, and `coding-agent-template` provide related orchestration or multi-agent infrastructure
- `codex-subagents-mcp` and similar experiments cover subagent-style behavior, but not full ClaudeKit parity
- `OpenHands` and `MetaGPT` are broader agent platforms, not migration kits for ClaudeKit workflows

CodexKit therefore addresses a real gap: migration-grade workflow parity for ClaudeKit on Codex.

## Key Capabilities

### 1. Compatibility Command Surface

CodexKit must expose a ClaudeKit-like development surface with public `cdx` commands:
- `cdx brainstorm`
- `cdx plan`
- `cdx cook`
- `cdx fix`
- `cdx debug`
- `cdx review`
- `cdx test`
- `cdx team`
- `cdx docs`
- `cdx journal`
- `cdx scout`
- `cdx preview`

### 2. Native Orchestration Runtime

CodexKit must provide a replacement for Claude-native task and team primitives:
- Task creation and dependency tracking
- Worker spawn and lifecycle management
- Task auto-claim and lease renewal
- Team-scoped message routing
- Event-driven wake/suspend
- Approval gates

### 3. Worker Isolation

Each worker must run in a defined execution boundary:
- Dedicated git worktree
- Explicit file ownership scope
- Role-specific tool permissions
- Separate artifact output

### 4. Plan-Centric Execution

CodexKit must preserve ClaudeKit's plan-based operation model:
- Generate `plan.md` and `phase-*.md`
- Hydrate task graph from unchecked plan items
- Sync completed work back to markdown plans
- Track unresolved mappings

### 5. Artifact-First Team Coordination

CodexKit must coordinate through durable outputs:
- Reports
- Patch bundles
- Review findings
- Test results
- Docs impact evaluations
- Finalize summaries

### 6. Terminal-First User Control

The user must remain in control from the terminal:
- Approval prompts
- Status inspection
- Targeted messaging with `@agent` and `@team`
- Resume and recovery of interrupted runs

## Functional Requirements

### FR1: Command Runtime

The system must execute `cdx` workflows from the local terminal and route them into the correct workflow engine.

### FR2: Task Graph

The system must support:
- pending, in-progress, completed, blocked, failed task states
- cancelled task state for abort and run-cancel paths
- dependency chains
- file ownership metadata
- phase and plan metadata

### FR3: Auto-Claim

Workers must be able to auto-claim unblocked tasks based on:
- role compatibility
- ownership scope
- team membership
- current lease availability

### FR4: Worker Spawn

The system must spawn role-specific Codex workers with:
- role prompt
- task brief
- ownership boundaries
- relevant artifacts
- plan context
- policy constraints

### FR5: Team Messaging

The system must support agent-to-agent and team-to-team messaging with:
- direct recipient targeting
- inbox pull
- priority levels
- wake-on-mention behavior
- shutdown and approval response message types

### FR6: Approval Gates

The system must support interactive and auto modes with terminal-based approval prompts matching ClaudeKit checkpoints.

### FR7: Plan Hydration and Sync-Back

The system must:
- read existing plans
- generate task graphs from unchecked items
- sync completed items back to all relevant phase files
- update `plan.md` progress and status

### FR8: Workflow Parity

The system must preserve behavior for:
- research
- planning
- implementation
- testing
- review
- docs update
- git finalize
- team mode

### FR9: Content Import

The system must import and normalize:
- agent definitions
- skills
- rules
- plan templates

### FR10: Resume and Recovery

The system must resume interrupted runs safely and reclaim abandoned tasks after lease expiration.

### FR11: Observability

The system must provide terminal-readable visibility into:
- active workers
- task ownership
- blockers
- approvals
- recent artifacts
- message queue state

### FR12: Migration Safety

The system must allow migration without destructive modification of existing repository content.

## Non-Functional Requirements

### NFR1: Local Reliability

- Runtime must survive interrupted shells and recover state from disk
- Worker crash must not corrupt the task ledger
- Reclaim and replay must be deterministic

### NFR2: Performance

- Simple command dispatch under 2 seconds
- Worker spawn overhead under 10 seconds in warm state
- Task hydration from an average plan under 3 seconds

### NFR3: Isolation

- Workers must not write outside owned scope unless explicitly escalated
- Review-only roles must be enforceable as read-only

### NFR4: Maintainability

- Workflow manifests must be content-driven
- Runtime primitives must be independent from individual workflows
- Compatibility shims must be testable in isolation

### NFR5: Portability

- macOS and Linux first
- Windows support later through compatible shell adapters

### NFR6: Auditability

- Every task claim, message, approval, artifact, and finalize action must be logged

## V1 Acceptance Criteria

- `cdx brainstorm` creates a decision report and optional planning handoff
- `cdx plan` creates valid `plan.md` and `phase-*.md` files
- `cdx cook` runs end-to-end through implementation, testing, review, finalize
- `cdx cook --parallel` spawns multiple isolated workers with ownership enforcement
- `cdx team` supports team-scoped workers, messages, idle/wake, and shutdown
- Plan hydration and sync-back work across sessions
- Approval gates operate fully from terminal
- Docs update and finalize delegation are functional
- The system reuses ClaudeKit content rather than rewriting all prompts

## Risks

- Workflow parity may drift if imported skill instructions contain host-specific assumptions that are missed
- Raw agent-to-agent chat can explode context and must be aggressively summarized
- Worktree merge conflicts can reduce the benefit of parallel execution if ownership boundaries are weak
- Terminal-only UX can become noisy without strong status and inbox design
- ClaudeKit content quality is mixed with runtime-specific instructions and must be normalized carefully

## Dependencies

- Stable Codex CLI usage model
- MCP support for custom tool surface
- Git worktree availability
- Local Node.js runtime for daemon and control plane
- Reliable persistence store, SQLite for v1

## Milestone Goals

### M1

Working runtime core with tasks, claims, workers, approvals, and terminal control loop.

### M2

Imported ClaudeKit roles and workflows running for `cdx brainstorm`, `cdx plan`, and `cdx cook`.

### M3

Full parity for testing, review, finalize, and team mode.

### M4

Installer, doctor, updater, and migration hardening ready for real repositories.

## Unresolved Questions

- Whether V1 should support Windows worker execution or only local Unix-like environments
- Whether git finalize should default to commit creation or stop before commit
- Whether a short alias such as `cdx b` or `cdx p` should ship in V1 or remain out of scope
