# Worker Execution and Isolation Spec (Phase 2)

**Project**: CodexKit  
**Scope**: Phase 2 worker execution and isolation  
**Last Updated**: 2026-03-13  
**Status**: Draft for implementation

This spec implements `docs/adr-0001-codex-worker-execution-and-session-model.md`.

It also inherits quality gates from `docs/non-functional-requirements.md`.

## 1) Purpose

Define a concrete Phase 2 execution model so CodexKit can run parallel workers safely on one machine:

- one worker, one process supervisor, one worktree
- explicit file ownership and write boundaries
- durable worker liveness, shutdown, and reclaim behavior
- deterministic artifact capture from each worker attempt

This doc covers execution and isolation only.  
This doc excludes MCP tool contracts, importer design, and workflow semantics.

## 2) Phase 2 Scope

In scope:

- worktree manager behavior and lifecycle
- worker launcher and local process supervision
- worker authority boundaries
- owned path enforcement model
- artifact capture and publication rules
- heartbeat, shutdown, crash recovery, and reclaim
- local Codex CLI execution assumptions
- security and isolation constraints for local-first execution

Out of scope:

- MCP method shapes or transport contracts
- ClaudeKit content import or manifest generation
- workflow-specific step logic for `cook`, `plan`, `team`, or others
- remote executors, containers, or cloud workers
- browser UI or non-terminal control surfaces

## 3) Runtime Model

Phase 2 extends the Phase 1 runtime core with an execution layer:

- daemon remains the only authority for worker, claim, task, and artifact state
- `codexkit-runner` manages local worktrees and worker child processes
- each worker attempt is isolated in a dedicated git worktree
- each worker attempt has a dedicated runtime bundle, log set, and artifact folder
- worker liveness is tracked by a daemon-visible heartbeat written by the supervisor, not by transcript parsing

The minimal execution tuple is:

- `worker` row in SQLite
- `claim` row for the active task lease
- one supervisor-owned OS child process running Codex CLI
- one dedicated worktree rooted at `workers.worktree_path`
- one artifact staging directory for logs, diffs, and worker outputs

### 3.1 Phase 2 NFR Coverage

Phase 2 owns the isolation and crash-evidence metrics in `docs/non-functional-requirements.md`.

- `NFR-2.1` through `NFR-2.5` for worktree isolation, owned-path enforcement, dirty-root preflight, overlay fidelity, and retention safety
- `NFR-5.4` for durable crash and recovery evidence after worker or daemon failure
- `NFR-7.1` and `NFR-7.2` for launch latency and ready-task dispatch latency on the execution substrate

## 4) Runtime Filesystem Layout

Default Phase 2 runtime paths:

```text
.codexkit/
  runtime/
    worktrees/<worker-id>/
    launch/<worker-id>/
      prompt.md
      context.json
      owned-paths.json
      env.json
    control/<worker-id>.json
    logs/
      <worker-id>.stdout.log
      <worker-id>.stderr.log
      <worker-id>.supervisor.log
    artifacts/<run-id>/<worker-id>/
      manifest.json
      patch.diff
      changed-files.json
      outputs/
```

Rules:

- worktree path is unique per worker id and never reused by another worker
- launch bundle is immutable after process start except for control metadata
- artifact directory is append-only for the lifetime of a worker attempt
- runtime-private paths under `.codexkit/runtime/` are never part of any worker owned path set

## 5) Worktree Manager

### 5.1 Responsibilities

The worktree manager must:

- resolve the source snapshot for a worker attempt
- allocate a unique branch name and worktree path
- materialize the worktree from the selected snapshot
- apply any prepared local overlay before launch
- persist worktree metadata onto the worker record
- prune retained worktrees after retention policy allows it

### 5.2 Source Snapshot Contract

A worker launches from a resolved snapshot, not from a live mutable root checkout.

Allowed snapshot inputs:

- a git commit or branch ref
- a git commit or branch ref plus a prepared overlay bundle produced by the daemon from the current workspace state

V1 dirty-root policy:

- overlay bundles are the only supported dirty-root snapshot mechanism in V1
- the runner must not create hidden or temporary git commits to materialize dirty workspace state
- an overlay bundle must carry tracked text diffs, supported untracked text files, and a manifest of applied paths plus checksums
- if the current root contains unsupported binary-only changes or any change the overlay builder cannot replay safely, worker spawn must fail before launch with an explicit operator-visible error that asks the user to commit, stash, or clean the root state first

Phase 2 rule:

- the launcher must finish snapshot resolution before the worker process starts
- once launched, the worker worktree does not inherit further live root checkout changes

If snapshot resolution fails, worker spawn fails before a `running` state is entered.

### 5.3 Create Flow

Worktree creation sequence:

1. validate repo root, git availability, and target snapshot
2. allocate `branch_name` using `codex/<run-id>/<worker-id>`
3. create worktree directory
4. materialize git worktree from base snapshot
5. apply overlay bundle when present
6. verify resulting worktree fingerprint and current HEAD
7. write launch bundle files for the worker
8. persist `worktree_path`, `branch_name`, and `cwd`

Failure rules:

- partial worktree creation must be rolled back when safe
- if rollback is not safe, the path is marked quarantined and never reused
- a failed create never assigns the task claim to that worker attempt

### 5.4 Retention and Cleanup

Worktrees are disposable but not immediately deleted.

Default retention:

- completed worker with no policy violation: retain for 24 hours
- failed worker or ownership violation: retain for 72 hours
- user-requested inspection hold: retain until explicit release

Cleanup rules:

- cleanup happens only after artifacts are captured and ledger publication completes
- cleanup removes worktree contents and prunes git worktree metadata
- retained worktrees are marked read-only at the policy level and never resumed in place

## 6) Worker Launcher

### 6.1 Responsibilities

The worker launcher is a supervisor around the Codex CLI child process. It must:

- assemble launch inputs
- start the worker process with a controlled environment
- capture stdout, stderr, exit code, and signal termination
- publish heartbeat updates while the child is alive
- stop the child gracefully or forcefully on daemon request
- finalize artifact capture before releasing the worker attempt

### 6.2 Launch Inputs

Each launch bundle contains:

- `prompt.md`: role prompt plus task brief
- `context.json`: minimal compiled context and references
- `owned-paths.json`: normalized writable path rules
- `env.json`: effective env allowlist for audit/debug

The launcher treats these files as input evidence. They are retained with the worker attempt.

### 6.3 Process Contract

Phase 2 assumes Codex CLI can be started as a local child process with:

- explicit current working directory
- explicit environment map
- stdin or file-based prompt input
- machine-observable exit status

The launcher must not depend on human terminal interaction to keep the process alive.

Session rules:

- each worker attempt starts a fresh Codex process/session from the launch bundle
- the default worker transport for V1 is `codex exec` or an equivalent non-interactive Codex CLI invocation behind the same runner interface
- the worker session receives compiled prompt input from `prompt.md` plus structured references from `context.json`
- worker retries, reclaim, and resume must not depend on reusing a prior Codex transcript
- if a future transport such as Codex SDK is added later, it must preserve the same run/worker/session semantics

### 6.4 Environment Contract

Allowed inherited environment is allowlist-based.

Baseline allowlist:

- shell and locale basics: `PATH`, `HOME`, `SHELL`, `LANG`, `TERM`
- CodexKit runtime metadata: `CODEXKIT_RUN_ID`, `CODEXKIT_WORKER_ID`, `CODEXKIT_TASK_ID`
- worker-local paths: `CODEXKIT_WORKTREE`, `CODEXKIT_OWNED_PATHS_FILE`, `CODEXKIT_ARTIFACT_DIR`
- Codex CLI required auth variables only when explicitly configured

Rules:

- ambient secrets unrelated to worker execution are stripped
- launch env is recorded for audit as keys only by default, not raw secret values
- env values that point outside the worktree are allowed only from the launcher allowlist

### 6.5 Exit Semantics

Launcher records:

- exit code
- terminating signal, if any
- started and ended timestamps
- last heartbeat timestamp
- whether a final diff and final logs were captured

Exit interpretation:

- `0`: process completed; task outcome still depends on artifact and policy checks
- non-zero: worker attempt failed unless a higher layer explicitly remaps it
- signal kill or missing finalization: worker attempt failed and reclaim flow starts

## 7) Ownership Boundaries

### 7.1 Authority Boundaries

Authority is split on purpose:

- daemon owns ledger state and state transitions
- runner owns worktree creation, process supervision, and raw evidence capture
- worker owns only edits inside its own worktree and only inside granted writable paths

The worker does not own:

- SQLite state
- other worker worktrees
- runtime-private control files
- the root checkout

### 7.2 Path Classes

Every worker sees path rules in normalized repo-relative form:

- `owned-write`: files or directories the worker may edit freely
- `shared-write`: explicitly granted shared files such as generated indexes or lockfiles
- `artifact-write`: output paths for reports and captured deliverables
- `read-only`: readable but not writable content
- `runtime-private`: denied runtime internals such as `.git/` and `.codexkit/runtime/`

Default rule set:

- repo content is read-only unless granted in `owned-write` or `shared-write`
- artifact paths are writable only in declared output locations
- runtime-private paths are neither writable nor publishable

### 7.3 Enforcement Model

Phase 2 uses layered enforcement:

1. worktree isolation prevents direct writes into the user root checkout
2. owned-path manifest tells the worker what it may change
3. supervisor validates changed paths during execution and again at finalization
4. unauthorized changes are captured as evidence and block normal publication

This is operational isolation, not kernel-grade sandboxing.

### 7.4 Violation Handling

If a worker changes an unauthorized path:

- launcher records an ownership violation artifact
- normal patch publication is blocked
- worker transitions to `failed`
- active claim is released or expired by reclaim policy
- retained worktree stays available for inspection until cleanup

Shared-write exceptions must be explicit. There is no implicit promotion from read-only to writable.

### 7.5 Path Safety Rules

Path checks must:

- normalize separators and collapse `.` and `..`
- resolve symlinks before ownership evaluation
- reject writes that escape the worktree root through symlink traversal
- treat case-insensitive collisions carefully on macOS and Windows-class filesystems

## 8) Artifact Capture

### 8.1 Artifact Goals

Artifact capture must preserve enough evidence to:

- understand what the worker changed
- recover useful outputs after failure
- support retry or reclaim without re-reading raw terminal transcript
- keep parity with ClaudeKit-style durable reports and outputs

### 8.2 Captured Artifact Set

Each worker attempt captures at least:

- stdout log
- stderr log
- supervisor log
- changed file manifest
- patch diff against the launch snapshot
- final status summary

When present, the attempt also captures:

- report files written by the worker
- docs outputs
- test logs
- screenshots or traces produced by the task

### 8.3 Capture Pipeline

Artifact capture happens in three stages:

1. live capture
- stream stdout and stderr to append-only log files
- update coarse activity markers such as `last_output_at`

2. finalize capture
- compute changed file set from the worktree
- build patch diff from initial snapshot to final worktree state
- collect declared output files into artifact staging

3. publish
- calculate checksums
- write artifact manifest
- create ledger artifact rows with final paths and summaries

### 8.4 Publication Rules

Publication rules:

- raw logs always publish as evidence artifacts unless explicitly disabled by policy
- unauthorized file changes publish only as trace evidence, never as normal deliverable artifacts
- missing explicit report output does not discard the attempt; patch and logs still publish
- artifact rows must point to immutable retained files, not to the live worktree path

### 8.5 Artifact Classification

Phase 2 aligns captured outputs with existing artifact kinds where possible:

- `patch` for diff output
- `report`, `summary`, or `docs` for worker-authored documents
- `test-log` for test output
- `trace` for violation evidence, supervisor metadata, or crash evidence

## 9) Heartbeat, Shutdown, and Reclaim

### 9.1 Heartbeat Model

Heartbeat is emitted by the supervisor while the child process is alive.

Default timing:

- heartbeat interval: 10 seconds
- worker stale threshold: 30 seconds
- claim lease extension target: at least 3 heartbeat intervals ahead

Each heartbeat updates:

- `workers.last_heartbeat_at`
- active claim `heartbeat_at`
- derived liveness metadata such as pid alive, last output time, and dirty-worktree flag

Heartbeat means the supervisor still observes a live process.  
Heartbeat does not guarantee useful progress.

### 9.2 Graceful Shutdown

Graceful shutdown sequence:

1. daemon records shutdown intent
2. launcher sends soft termination to the child process
3. launcher waits for a configurable grace period
4. launcher captures final logs and diff
5. worker moves to `stopped` if finalization succeeds

Default graceful timeout: 15 seconds.

### 9.3 Forced Shutdown

Forced shutdown starts when:

- graceful timeout expires
- child process ignores termination
- daemon restarts and finds an orphaned child still running

Forced shutdown rules:

- launcher sends hard kill
- worker is marked `failed` unless a clean finalization still completes
- reclaim starts immediately after evidence capture finishes or times out

### 9.4 Stale Worker Detection

A worker is stale when:

- no heartbeat arrives before the stale threshold, or
- the recorded pid no longer exists, or
- launcher state cannot be reconciled with the worker row

Stale worker handling:

- mark worker `failed`
- expire or release active claim
- emit reclaim event
- preserve logs and retained worktree for inspection

### 9.5 Reclaim Policy

Reclaim exists so worker failure does not strand task ownership.

Reclaim flow:

1. capture available evidence from the failed attempt
2. reconcile active claim to `released` or `expired`
3. clear `tasks.owner_worker_id` when the dead worker still owns the task
4. recompute task state
5. requeue task if retry policy allows it

Task requeue rules:

- requeue to `ready` when failure is infrastructure-only and retry budget remains
- move to `blocked` when manual review is required
- move to `failed` when policy violation or hard execution failure is terminal

The next worker receives prior attempt summaries and artifact refs, not the dead process state.

## 10) Local CLI Execution Assumptions

Phase 2 is built around local Codex CLI execution on one machine.

Required assumptions:

- `git` is installed and `git worktree` is available
- the repo root is git-backed and has at least one commit before worker-backed workflows run
- Codex CLI is installed, callable from the daemon host, and can run as a subprocess
- the local filesystem supports multiple concurrent worktrees
- the daemon and worker processes run as the same OS user

Operational assumptions:

- POSIX-style process signals are the baseline behavior for Phase 2
- dirty workspace state is represented as a clean git base snapshot plus an optional overlay bundle before launch
- very large binary-only local changes may block launch if they cannot be reproduced safely in worker worktrees
- network access, if any, is inherited from the host environment and not mediated by CodexKit in Phase 2

Packaging/runtime boundary:

- Phase 8 packaging may install CodexKit into a fresh directory before worker execution is available
- Phase 2 worker-backed workflows remain blocked until the repo is git-backed, has an initial commit, and supports `git worktree`
- the CLI and doctor flow must surface this state explicitly rather than failing later during worker spawn

Non-goals for Phase 2:

- hard sandboxing against a malicious local process
- cross-machine worker scheduling
- resumable in-place continuation inside the same worktree after daemon loss

## 11) Security and Isolation Constraints

### 11.1 Security Posture

Phase 2 provides strong operational separation for cooperating local workers.  
It does not provide hostile-code containment.

### 11.2 Required Constraints

The execution layer must:

- never run workers in the user root checkout
- minimize inherited environment variables
- keep runtime control files outside worker writable scope
- store runtime artifacts with restrictive permissions
- sanitize branch names, worker ids, and generated paths
- validate real paths before any ownership decision

### 11.3 Secrets Handling

Secrets rules:

- secrets are not copied into launch bundles
- auth env needed by Codex CLI is passed only through the launch allowlist
- logs and artifact manifests must redact known secret values when feasible
- runtime debug dumps must never serialize full secret-bearing env maps by default

### 11.4 Cross-Worker Isolation

Cross-worker isolation rules:

- one worker never shares a writable worktree with another worker
- workers never publish artifacts into another worker's artifact directory
- runner never reuses a retained worktree for a new worker id
- branch naming stays unique per worker attempt

### 11.5 Git and Filesystem Safety

The runner must treat these paths as protected:

- `.git/`
- `.codexkit/runtime/`
- paths outside the resolved repo root
- other retained worker worktrees

Any attempted modification to protected paths is an execution policy violation.

## 12) Acceptance Criteria

Phase 2 worker execution is complete only when all of the following are true:

- multiple local workers can run in parallel in separate worktrees
- each worker launch records worktree path, branch name, pid, and heartbeat timestamps
- unauthorized file edits are detected before normal artifact publication
- worker stdout, stderr, patch diff, and summary are retained as artifacts
- graceful shutdown releases task ownership cleanly
- crash or stale worker detection triggers reclaim without corrupting task state
- retained failed worktrees can be inspected before cleanup
- cleanup prunes expired retained worktrees without removing published artifacts
- Phase 2-owned metrics in `docs/non-functional-requirements.md` pass

## Unresolved Questions

- Whether Windows Phase 2 support needs a separate supervisor implementation for non-POSIX signal handling
- Whether optional OS-level read-only mounts are worth adding later for stronger enforcement of owned paths
