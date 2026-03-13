# ADR 0001: Codex Worker Execution and Session Model

**Status**: Accepted for V1  
**Date**: 2026-03-12  
**Owners**: CodexKit planning docs  
**Related Docs**:
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/runtime-core-technical-spec.md`
- `docs/worker-execution-and-isolation-spec.md`
- `docs/workflow-parity-core-spec.md`
- `docs/workflow-extended-and-release-spec.md`

## Context

CodexKit needs a deterministic way to:

- run long workflows such as `brainstorm`, `plan`, `cook`, `fix`, and `team`
- hand off from one workflow to another without losing context
- resume interrupted work safely
- run multiple workers in parallel without mixing ownership or state
- avoid depending on Codex transcript continuity as workflow state

Three transport styles were plausible:

1. treat a long-lived interactive Codex session as the workflow state
2. launch fresh non-interactive Codex workers from compiled inputs and keep workflow state in CodexKit
3. adopt Codex SDK as the primary execution transport immediately

The architecture already assumes:

- CodexKit owns durable runs, tasks, claims, approvals, mailbox routing, and resume semantics
- workers run in isolated worktrees
- approvals and handoffs are terminal-driven and auditable

What was still ambiguous was the exact execution model for a worker, the relationship between a run and a Codex session, and where brainstorm -> plan or plan -> cook continuity should live.

## Decision

CodexKit V1 will use a state-driven worker model with fresh Codex worker sessions per attempt.

This means:

- public CLI syntax is `cdx <workflow>` and `cdx <operator> <subcommand>`
- one top-level workflow invocation creates or attaches to one durable run in the CodexKit ledger
- one worker attempt maps to one fresh Codex process/session in one dedicated worktree
- worker continuity never depends on reusing a prior Codex transcript
- workflow continuity lives in the ledger, artifacts, checkpoints, plan pointers, and handoff metadata
- accepted handoffs such as brainstorm -> plan or plan -> cook create a new downstream run linked to the upstream run
- the terminal may stay attached across a handoff so the user experiences one continuous flow, but the downstream workflow is still a new run
- `cdx resume` reconstructs workflow state from the ledger and may re-spawn fresh workers; it must not require the old worker session to still exist

## V1 Worker Transport

The default V1 worker transport is `codex exec` or an equivalent non-interactive Codex CLI invocation behind the same runner interface.

Each worker launch is compiled into a launch bundle:

- `prompt.md`: role prompt plus task brief
- `context.json`: minimal compiled context, artifact refs, and plan metadata
- `owned-paths.json`: writable scope and path-policy inputs
- `env.json`: allowlisted environment metadata for audit/debug

The runner is responsible for:

- creating the worktree
- materializing the launch bundle
- starting the Codex worker process
- capturing logs, exit status, and artifacts
- updating heartbeat and final state through the daemon

## What Is Explicitly Not the Workflow State

The following are not authoritative workflow state:

- a live Codex terminal transcript
- a Codex app thread
- an in-memory process graph inside one shell session
- the existence of a specific worker pid

These may help execution, but they are disposable execution details, not the control plane.

## Consequences

### Positive

- `resume` is deterministic and does not depend on fragile session history
- parallel execution is easier to reason about because each worker attempt is isolated
- handoff from one workflow to another is explicit and auditable
- worker retries and reclaim can be implemented without transcript surgery
- the same orchestration model can later target other hosts, including OpenCode, with a compatible runner interface

### Negative

- worker startup cost is higher than reusing one live interactive session
- context must be compiled carefully because workers do not inherit chat history implicitly
- some rich interactive host behaviors have to be modeled explicitly through approvals, mailbox state, and artifacts

## Alternatives Considered

### A. Long-lived interactive Codex session as the workflow state

Rejected for V1.

Why:

- resume and reclaim become transcript-dependent
- workflow handoff becomes implicit and harder to audit
- parallel worker isolation is weaker
- session loss can destroy workflow continuity

### B. Codex SDK as the immediate primary transport

Deferred for V1.

Why:

- it may still become a later transport, but choosing it now would widen the implementation surface too early
- V1 needs a stable runner contract more than a richer embedding surface
- `codex exec` style transport keeps the first implementation closer to the CLI-first operating model already assumed by the specs

## Implementation Rules

1. Phase 1 must freeze the runner interface and run/worker/session semantics before deeper workflow implementation.
2. Phase 2 must implement worker launch, worktree isolation, artifact capture, and fresh-session semantics according to this ADR.
3. Phase 3 must connect compatibility MCP, approvals, and mailbox behavior to this worker model rather than introducing transcript-driven shortcuts.
4. Phase 5 and later workflows must use downstream run handoff for brainstorm -> plan, plan -> cook, debug -> fix, and similar chains.
5. If Codex SDK is introduced later, it must preserve the same external run/worker/session contract.

## Phase Placement

This ADR belongs operationally in two places:

- Phase 0 / spec baseline: the decision must be written and accepted before runtime interfaces drift
- Phase 2 / worker execution: the decision is implemented concretely here

Practical rule:

- write and approve the ADR before or during early Phase 1
- do not start full Phase 2 launcher implementation until the ADR is accepted

## Follow-Up

- keep `docs/worker-execution-and-isolation-spec.md` aligned with this ADR
- keep `docs/workflow-parity-core-spec.md` and `docs/workflow-extended-and-release-spec.md` aligned on downstream run handoff semantics
- add a later ADR only if the project promotes Codex SDK from optional future transport to primary execution transport
