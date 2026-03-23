import { CodexkitError } from "../../codexkit-core/src/index.ts";
import type { RuntimeController } from "../../codexkit-daemon/src/index.ts";
import { hasFlag, optionValue, optionValues, type ParsedArgs } from "./arg-parser.ts";

const PLAN_SUBCOMMANDS = new Set(["validate", "red-team", "archive"]);
const PLAN_MODES = ["auto", "fast", "hard", "parallel", "two"] as const;
const COOK_MODES = ["auto", "fast", "parallel", "no-test"] as const;

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

  return { handled: false };
}
