import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface ImporterFixture {
  rootDir: string;
  cleanup: () => Promise<void>;
}

export async function createImporterFixture(files: Record<string, string>): Promise<ImporterFixture> {
  const rootDir = await mkdtemp(path.join(tmpdir(), "codexkit-importer-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }
  return {
    rootDir,
    cleanup: async () => rm(rootDir, { recursive: true, force: true })
  };
}
