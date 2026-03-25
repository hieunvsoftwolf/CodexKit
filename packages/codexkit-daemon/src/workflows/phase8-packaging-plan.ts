import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ManagedFileRecord } from "../../../codexkit-importer/src/index.ts";
import { createManagedFileRecord } from "../../../codexkit-importer/src/index.ts";
import type { ManagedTemplateFile } from "./phase8-managed-content.ts";
import type {
  ManagedFilePreviewItem,
  PackagingActionPlan,
  PackagingApprovalGate,
  PackagingBlockedAction
} from "./packaging-contracts.ts";
import { isProtectedManagedPath, uniqueApprovalGates } from "./packaging-contracts.ts";

export interface PackagingApprovalInput {
  approveProtected: boolean;
  approveManagedOverwrite: boolean;
}

export interface ManagedTemplatePayloadFingerprint {
  path: string;
  contentSha256: string;
}

function blocked(gate: PackagingApprovalGate, pathValue: string, cause: string, nextStep: string): PackagingBlockedAction {
  return {
    code: `APPROVAL_REQUIRED_${gate.toUpperCase().replace(/-/g, "_")}`,
    cause,
    nextStep,
    gate,
    path: pathValue
  };
}

function classifyPreviewItem(
  rootDir: string,
  template: ManagedTemplateFile,
  approvals: PackagingApprovalInput
): { preview: ManagedFilePreviewItem; canWrite: boolean; managedRecord: ManagedFileRecord } {
  const absolutePath = path.join(rootDir, template.path);
  let exists = false;
  let changed = false;
  try {
    const currentContent = readFileSync(absolutePath, "utf8");
    exists = true;
    changed = currentContent !== template.content;
  } catch {
    exists = false;
    changed = false;
  }

  const protectedPath = isProtectedManagedPath(template.path);
  const approvalGates: PackagingApprovalGate[] = [];
  let disposition: ManagedFilePreviewItem["disposition"] = protectedPath ? "protected-managed" : "managed";
  let reason = exists ? "already matches managed template" : "new managed file";
  let canWrite = !exists || changed;

  if (exists && changed) {
    if (template.path === "README.md") {
      disposition = "preserved";
      reason = "existing README.md preserved; no auto-merge for user-modified managed content";
      canWrite = false;
    } else {
      disposition = "conflict";
      reason = "existing managed file differs from template";
      approvalGates.push("managed-overwrite");
      if (protectedPath) {
        approvalGates.push("protected-path");
      }
      canWrite = approvals.approveManagedOverwrite && (!protectedPath || approvals.approveProtected);
    }
  } else if (protectedPath && (!exists || changed)) {
    approvalGates.push("protected-path");
    canWrite = approvals.approveProtected && canWrite;
    if (!approvals.approveProtected) {
      reason = exists ? "protected managed path requires explicit approval before overwrite" : "protected managed path requires explicit approval";
    }
  }

  const managedRecord = createManagedFileRecord(template.path, template.content, template.class);
  return {
    preview: {
      path: template.path,
      disposition,
      exists,
      changed,
      protectedPath,
      reason,
      approvalGates
    },
    canWrite,
    managedRecord
  };
}

export function buildPackagingActionPlan(
  rootDir: string,
  templates: ManagedTemplateFile[],
  approvals: PackagingApprovalInput
): {
  plan: PackagingActionPlan;
  writableTemplates: ManagedTemplateFile[];
  managedFiles: ManagedFileRecord[];
} {
  const plannedWrites: ManagedFilePreviewItem[] = [];
  const preservedFiles: ManagedFilePreviewItem[] = [];
  const conflicts: ManagedFilePreviewItem[] = [];
  const manualReview: ManagedFilePreviewItem[] = [];
  const blockedActions: PackagingBlockedAction[] = [];
  const writableTemplates: ManagedTemplateFile[] = [];
  const managedFiles: ManagedFileRecord[] = [];

  for (const template of templates) {
    const classified = classifyPreviewItem(rootDir, template, approvals);
    managedFiles.push(classified.managedRecord);
    const preview = classified.preview;
    if (preview.disposition === "preserved") {
      preservedFiles.push(preview);
      continue;
    }
    if (preview.disposition === "conflict") {
      conflicts.push(preview);
      if (!approvals.approveManagedOverwrite) {
        blockedActions.push(
          blocked(
            "managed-overwrite",
            preview.path,
            `Managed file '${preview.path}' is user-modified and cannot be auto-merged.`,
            "Rerun with --approve-managed-overwrite after reviewing the preview."
          )
        );
      }
      if (preview.protectedPath && !approvals.approveProtected) {
        blockedActions.push(
          blocked(
            "protected-path",
            preview.path,
            `Protected path '${preview.path}' requires explicit approval.`,
            "Rerun with --approve-protected after reviewing the preview."
          )
        );
      }
    }
    if (preview.disposition === "manual-review") {
      manualReview.push(preview);
      continue;
    }
    plannedWrites.push(preview);
    if (preview.approvalGates.includes("protected-path") && !approvals.approveProtected) {
      blockedActions.push(
        blocked(
          "protected-path",
          preview.path,
          `Protected path '${preview.path}' requires explicit approval before mutation.`,
          "Rerun with --approve-protected to allow this write."
        )
      );
    }
    if (classified.canWrite && (preview.changed || !preview.exists)) {
      writableTemplates.push(template);
    }
  }

  return {
    plan: {
      plannedWrites,
      preservedFiles,
      conflicts,
      manualReview,
      blockedActions,
      approvalsRequired: uniqueApprovalGates(plannedWrites.filter((item) => item.changed || !item.exists))
    },
    writableTemplates,
    managedFiles: managedFiles.sort((left, right) => left.path.localeCompare(right.path))
  };
}

export function applyManagedTemplateWrites(rootDir: string, writableTemplates: ManagedTemplateFile[]): string[] {
  const writtenPaths: string[] = [];
  for (const template of writableTemplates) {
    const absolutePath = path.join(rootDir, template.path);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, template.content, "utf8");
    writtenPaths.push(template.path);
  }
  return writtenPaths.sort();
}

export function buildManagedTemplatePayloadFingerprints(
  templates: ManagedTemplateFile[]
): ManagedTemplatePayloadFingerprint[] {
  return templates
    .map((template) => ({
      path: template.path,
      contentSha256: createHash("sha256").update(template.content).digest("hex")
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}
