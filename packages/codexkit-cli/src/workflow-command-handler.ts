import { CodexkitError } from "../../codexkit-core/src/index.ts";
import type { RuntimeController } from "../../codexkit-daemon/src/index.ts";
import { hasFlag, optionValue, optionValues, type ParsedArgs } from "./arg-parser.ts";

const PLAN_SUBCOMMANDS = new Set(["validate", "red-team", "archive"]);
const PLAN_MODES = ["auto", "fast", "hard", "parallel", "two"] as const;
const COOK_MODES = ["auto", "fast", "parallel", "no-test"] as const;
const FIX_MODES = ["auto", "review", "quick", "parallel"] as const;
const DEBUG_BRANCHES = new Set(["code", "logs-ci", "database", "performance", "frontend"]);
const TEAM_PRIMITIVE_ACTIONS = new Set(["create", "list", "delete"]);
const PREVIEW_MODES = new Set(["explain", "slides", "diagram", "ascii"]);

function assertSingleMode(modes: string[], command: string): string | undefined {
  if (modes.length > 1) {
    throw new CodexkitError("CLI_USAGE", `${command} received multiple mode flags`, {
      code: "WF_MODE_CONFLICT",
      cause: `Only one mode can be selected. Received: ${modes.join(", ")}`,
      nextStep: `Retry with a single ${command} mode flag.`
    });
  }
  return modes[0];
}

function detectFlagMode(options: ParsedArgs["options"], modes: readonly string[]): string[] {
  return modes.filter((mode) => hasFlag(options, mode));
}

function throwWaveDeferred(command: string, code: string, nextStep: string): never {
  throw new CodexkitError("CLI_USAGE", `${command} is deferred in Phase 6 Wave 1`, {
    code,
    cause: `${command} workflow orchestration is intentionally out of Wave 1 scope.`,
    nextStep
  });
}

function assertNoPlanCreationFlags(parsed: ParsedArgs, subcommand: string): void {
  if (hasFlag(parsed.options, "no-tasks") || detectFlagMode(parsed.options, PLAN_MODES).length > 0 || optionValue(parsed.options, "mode")) {
    throw new CodexkitError("CLI_USAGE", `cdx plan ${subcommand} does not accept plan-creation mode flags`, {
      code: "WF_PLAN_SUBCOMMAND_FLAG_INVALID",
      cause: "Subcommands mutate/archive existing plan artifacts and do not generate a new plan.",
      nextStep: `Run cdx plan ${subcommand} <absolute-plan-path> without --fast/--hard/--parallel/--two/--auto/--no-tasks.`
    });
  }
}

function assertSinglePlanPath(rest: string[], subcommand: string): string {
  if (rest.length !== 1 || !rest[0]) {
    throw new CodexkitError("CLI_USAGE", `cdx plan ${subcommand} requires exactly one plan path`, {
      code: "WF_PLAN_SUBCOMMAND_PATH_REQUIRED",
      cause: `Expected one positional plan path for '${subcommand}', received ${rest.length}.`,
      nextStep: `Run cdx plan ${subcommand} <absolute-plan-path>.`
    });
  }
  return rest[0];
}

export function tryHandleWorkflowCommand(
  parsed: ParsedArgs,
  controller: RuntimeController
): { handled: boolean; result?: unknown } {
  const [group, second, ...rest] = parsed.positionals;
  if (group === "init") {
    if (second || rest.length > 0) {
      throw new CodexkitError("CLI_USAGE", "init accepts no positional arguments", {
        code: "WF_INIT_POSITIONAL_INVALID",
        cause: "Unexpected extra tokens were provided to cdx init.",
        nextStep: "Use cdx init [--apply] [--init-git] [--approve-git-init] [--approve-protected] [--approve-managed-overwrite]."
      });
    }
    return {
      handled: true,
      result: controller.init({
        ...(hasFlag(parsed.options, "apply") ? { apply: true } : {}),
        ...(hasFlag(parsed.options, "init-git") ? { initGit: true } : {}),
        ...(hasFlag(parsed.options, "approve-git-init") ? { approveGitInit: true } : {}),
        ...(hasFlag(parsed.options, "approve-protected") ? { approveProtected: true } : {}),
        ...(hasFlag(parsed.options, "approve-managed-overwrite") ? { approveManagedOverwrite: true } : {})
      })
    };
  }

  if (group === "update") {
    if (second || rest.length > 0) {
      throw new CodexkitError("CLI_USAGE", "update accepts no positional arguments", {
        code: "WF_UPDATE_POSITIONAL_INVALID",
        cause: "Unexpected extra tokens were provided to cdx update.",
        nextStep: "Use cdx update [--apply] [--approve-protected] [--approve-managed-overwrite]."
      });
    }
    return {
      handled: true,
      result: controller.update({
        ...(hasFlag(parsed.options, "apply") ? { apply: true } : {}),
        ...(hasFlag(parsed.options, "approve-protected") ? { approveProtected: true } : {}),
        ...(hasFlag(parsed.options, "approve-managed-overwrite") ? { approveManagedOverwrite: true } : {})
      })
    };
  }

  if (group === "doctor") {
    if (second || rest.length > 0) {
      throw new CodexkitError("CLI_USAGE", "doctor does not accept positional arguments", {
        code: "WF_DOCTOR_POSITIONAL_INVALID",
        cause: "Unexpected positional tokens were provided to cdx doctor.",
        nextStep: "Run cdx doctor."
      });
    }
    return {
      handled: true,
      result: controller.doctor()
    };
  }

  if (group === "resume") {
    if (rest.length > 0) {
      throw new CodexkitError("CLI_USAGE", "resume accepts at most one run id positional", {
        code: "WF_RESUME_POSITIONAL_INVALID",
        cause: "Multiple resume target identifiers were provided.",
        nextStep: "Run cdx resume or cdx resume <run-id>."
      });
    }
    return {
      handled: true,
      result: controller.resume({
        ...(second ? { runId: second } : {})
      })
    };
  }

  if (group === "brainstorm") {
    const topic = [second, ...rest].filter(Boolean).join(" ").trim();
    if (!topic) {
      throw new CodexkitError("CLI_USAGE", "brainstorm topic is required", {
        code: "WF_BRAINSTORM_TOPIC_REQUIRED",
        cause: "No topic argument was provided.",
        nextStep: "Run cdx brainstorm <topic>."
      });
    }
    const handoffTarget = optionValue(parsed.options, "handoff");
    if (handoffTarget && handoffTarget !== "plan") {
      throw new CodexkitError("CLI_USAGE", "unsupported brainstorm handoff target", {
        code: "WF_BRAINSTORM_HANDOFF_INVALID",
        cause: `Unsupported handoff target '${handoffTarget}'.`,
        nextStep: "Use --handoff plan or omit --handoff."
      });
    }
    const mode = optionValue(parsed.options, "mode");
    const handoffMode = optionValue(parsed.options, "handoff-mode");
    return {
      handled: true,
      result: controller.brainstorm({
        topic,
        constraints: optionValues(parsed.options, "constraint"),
        ...(mode ? { mode: mode as never } : {}),
        ...(handoffTarget === "plan" || hasFlag(parsed.options, "continue-plan") ? { handoffToPlan: true } : {}),
        ...(optionValue(parsed.options, "handoff-task") ? { handoffTask: optionValue(parsed.options, "handoff-task")! } : {}),
        ...(handoffMode ? { handoffMode: handoffMode as never } : {}),
        ...(hasFlag(parsed.options, "inherit-auto") ? { inheritAutoApproval: true } : {})
      })
    };
  }

  if (group === "plan") {
    if (second && PLAN_SUBCOMMANDS.has(second)) {
      assertNoPlanCreationFlags(parsed, second);
      if (second === "validate") {
        return {
          handled: true,
          result: controller.planValidate({ planPath: assertSinglePlanPath(rest, second) })
        };
      }
      if (second === "red-team") {
        return {
          handled: true,
          result: controller.planRedTeam({ planPath: assertSinglePlanPath(rest, second) })
        };
      }
      if (rest.length > 1) {
        throw new CodexkitError("CLI_USAGE", "cdx plan archive accepts at most one plan path positional", {
          code: "WF_PLAN_ARCHIVE_POSITIONAL_INVALID",
          cause: "Multiple archive target arguments were provided.",
          nextStep: "Run cdx plan archive <absolute-plan-path> or cdx plan archive."
        });
      }
      return {
        handled: true,
        result: controller.planArchive({ ...(rest[0] ? { planPath: rest[0] } : {}) })
      };
    }
    const task = [second, ...rest].filter(Boolean).join(" ").trim();
    if (!task) {
      throw new CodexkitError("CLI_USAGE", "plan task is required", {
        code: "WF_PLAN_TASK_REQUIRED",
        cause: "No planning task argument was provided.",
        nextStep: "Run cdx plan <task>."
      });
    }
    const modeFromFlag = assertSingleMode(detectFlagMode(parsed.options, PLAN_MODES), "plan");
    return {
      handled: true,
      result: controller.plan({
        task,
        ...(modeFromFlag ? { mode: modeFromFlag as never } : {}),
        ...(hasFlag(parsed.options, "no-tasks") ? { noTasks: true } : {})
      })
    };
  }

  if (group === "preview") {
    const modeFromOption = optionValue(parsed.options, "mode");
    let mode = modeFromOption;
    const targetTokens = [second, ...rest].filter(Boolean);
    if (!mode && targetTokens.length > 0 && PREVIEW_MODES.has(targetTokens[0]!)) {
      mode = targetTokens.shift()!;
    }
    if (mode && !PREVIEW_MODES.has(mode)) {
      throw new CodexkitError("CLI_USAGE", "unsupported preview mode", {
        code: "WF_PREVIEW_MODE_INVALID",
        cause: `Unsupported mode '${mode}'.`,
        nextStep: "Use preview modes: explain, slides, diagram, ascii."
      });
    }
    const target = targetTokens.join(" ").trim();
    return {
      handled: true,
      result: controller.preview({
        ...(target ? { target } : {}),
        ...(mode ? { mode: mode as never } : {}),
        ...(hasFlag(parsed.options, "stop") ? { stop: true } : {})
      })
    };
  }

  if (group === "cook") {
    if (rest.length > 0) {
      throw new CodexkitError("CLI_USAGE", "cook accepts at most one plan path positional", {
        code: "WF_COOK_POSITIONAL_INVALID",
        cause: "Multiple positional arguments were provided.",
        nextStep: "Run cdx cook <absolute-plan-path> or cdx cook with mode flags."
      });
    }
    const explicitMode = optionValue(parsed.options, "mode");
    const flagMode = assertSingleMode(detectFlagMode(parsed.options, COOK_MODES), "cook");
    const planPath = second;
    const mode = explicitMode ?? flagMode ?? (planPath ? "code" : "interactive");
    return {
      handled: true,
      result: controller.cook({
        ...(planPath ? { planPath } : {}),
        mode: mode as never
      })
    };
  }

  if (group === "review") {
    if (!second) {
      return {
        handled: true,
        result: controller.review({})
      };
    }
    if (second === "codebase") {
      const tokenParallel = rest.length === 1 && rest[0] === "parallel";
      if (rest.length > 0 && !tokenParallel) {
        throw new CodexkitError("CLI_USAGE", "invalid review codebase shape", {
          code: "WF_REVIEW_CODEBASE_SHAPE_INVALID",
          cause: `Expected 'cdx review codebase' or 'cdx review codebase parallel', received extra tokens: ${rest.join(" ")}.`,
          nextStep: "Use cdx review codebase or cdx review codebase parallel."
        });
      }
      return {
        handled: true,
        result: controller.review({
          scope: "codebase",
          parallel: tokenParallel || hasFlag(parsed.options, "parallel"),
          context: tokenParallel ? "codebase parallel review" : "codebase review"
        })
      };
    }
    if (hasFlag(parsed.options, "parallel")) {
      throw new CodexkitError("CLI_USAGE", "parallel review is only valid for codebase scope", {
        code: "WF_REVIEW_PARALLEL_SCOPE_INVALID",
        cause: "Parallel review routing is only supported with 'cdx review codebase parallel'.",
        nextStep: "Use cdx review codebase parallel, or remove --parallel from recent-change review."
      });
    }
    const reviewContext = [second, ...rest].filter(Boolean).join(" ").trim();
    return {
      handled: true,
      result: controller.review({ scope: "recent", context: reviewContext })
    };
  }

  if (group === "test") {
    if (!second) {
      return {
        handled: true,
        result: controller.test({
          mode: "chooser"
        })
      };
    }
    if (second === "ui") {
      if (hasFlag(parsed.options, "coverage")) {
        throw new CodexkitError("CLI_USAGE", "ui mode and coverage mode cannot be combined", {
          code: "WF_TEST_MODE_CONFLICT",
          cause: "UI and coverage are separate execution modes.",
          nextStep: "Run cdx test ui [url] or cdx test <context> --coverage."
        });
      }
      if (rest.length > 1) {
        throw new CodexkitError("CLI_USAGE", "ui mode accepts at most one URL positional", {
          code: "WF_TEST_UI_POSITIONAL_INVALID",
          cause: "Multiple URL arguments were provided.",
          nextStep: "Run cdx test ui [url]."
        });
      }
      const url = rest[0];
      if (url && !/^https?:\/\/\S+$/i.test(url)) {
        throw new CodexkitError("CLI_USAGE", "ui mode URL must be an absolute http(s) URL", {
          code: "WF_TEST_UI_URL_INVALID",
          cause: `Received '${url}'.`,
          nextStep: "Use an absolute URL like https://example.com or omit the URL."
        });
      }
      return {
        handled: true,
        result: controller.test({
          mode: "ui",
          context: url ? `ui ${url}` : "ui",
          ...(url ? { url } : {})
        })
      };
    }
    const testContext = [second, ...rest].filter(Boolean).join(" ").trim();
    return {
      handled: true,
      result: controller.test({
        mode: hasFlag(parsed.options, "coverage") ? "coverage" : "default",
        context: testContext
      })
    };
  }

  if (group === "fix") {
    if (!second) {
      throw new CodexkitError("CLI_USAGE", "fix issue is required", {
        code: "WF_FIX_ISSUE_REQUIRED",
        cause: "No issue description was provided.",
        nextStep: "Run cdx fix <issue> [--auto|--review|--quick|--parallel]."
      });
    }
    const explicitMode = optionValue(parsed.options, "mode");
    if (explicitMode && !FIX_MODES.includes(explicitMode as typeof FIX_MODES[number])) {
      throw new CodexkitError("CLI_USAGE", "unsupported fix mode", {
        code: "WF_FIX_MODE_INVALID",
        cause: `Unsupported mode '${explicitMode}'.`,
        nextStep: "Use --auto, --review, --quick, --parallel, or omit mode."
      });
    }
    const flagMode = assertSingleMode(detectFlagMode(parsed.options, FIX_MODES), "fix");
    if (explicitMode && flagMode && explicitMode !== flagMode) {
      throw new CodexkitError("CLI_USAGE", "fix received conflicting mode selections", {
        code: "WF_FIX_MODE_CONFLICT",
        cause: `Received --mode ${explicitMode} and --${flagMode}.`,
        nextStep: "Retry with one fix mode selector."
      });
    }
    throwWaveDeferred("cdx fix", "WF_FIX_DEFERRED_WAVE2", "Use cdx debug <issue> in Wave 1, then route fix in Wave 2.");
  }

  if (group === "debug") {
    const issue = [second, ...rest].filter(Boolean).join(" ").trim();
    if (!issue) {
      throw new CodexkitError("CLI_USAGE", "debug issue is required", {
        code: "WF_DEBUG_ISSUE_REQUIRED",
        cause: "No issue description was provided.",
        nextStep: "Run cdx debug <issue>."
      });
    }
    const branch = optionValue(parsed.options, "branch");
    if (branch && !DEBUG_BRANCHES.has(branch)) {
      throw new CodexkitError("CLI_USAGE", "unsupported debug branch", {
        code: "WF_DEBUG_BRANCH_INVALID",
        cause: `Unsupported debug branch '${branch}'.`,
        nextStep: "Use --branch code|logs-ci|database|performance|frontend or omit --branch."
      });
    }
    return {
      handled: true,
      result: controller.debug({
        issue,
        ...(branch ? { branch: branch as never } : {})
      })
    };
  }

  if (group === "team") {
    if (!second || TEAM_PRIMITIVE_ACTIONS.has(second)) {
      return { handled: false };
    }
    if (rest.length === 0) {
      throw new CodexkitError("CLI_USAGE", "team template context is required", {
        code: "WF_TEAM_CONTEXT_REQUIRED",
        cause: `Template '${second}' requires a context argument.`,
        nextStep: "Run cdx team <template> <context>."
      });
    }
    throwWaveDeferred("cdx team", "WF_TEAM_DEFERRED_WAVE2", "Use direct team primitives in Wave 1; workflow template support starts in Wave 2.");
  }

  return { handled: false };
}
