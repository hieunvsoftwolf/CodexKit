#!/usr/bin/env node
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const compiledPackagesDir = path.join(rootDir, "dist", "packages");
const cliPackageDir = path.join(rootDir, "packages", "codexkit-cli");
const cliDistDir = path.join(cliPackageDir, "dist");
const cliDistPackagesDir = path.join(cliDistDir, "packages");
const schemaSourcePath = path.join(rootDir, "docs", "codexkit-sqlite-schema.sql");
const schemaDestinationPath = path.join(cliDistDir, "docs", "codexkit-sqlite-schema.sql");
const entrypointPath = path.join(cliDistDir, "index.js");

if (!existsSync(compiledPackagesDir)) {
  throw new Error(`Missing compiled workspace packages at ${compiledPackagesDir}. Run npm run build first.`);
}

if (!existsSync(schemaSourcePath)) {
  throw new Error(`Missing database schema source at ${schemaSourcePath}.`);
}

rmSync(cliDistDir, { recursive: true, force: true });
mkdirSync(cliDistDir, { recursive: true });
cpSync(compiledPackagesDir, cliDistPackagesDir, { recursive: true });
mkdirSync(path.dirname(schemaDestinationPath), { recursive: true });
cpSync(schemaSourcePath, schemaDestinationPath);
writeFileSync(entrypointPath, "#!/usr/bin/env node\nimport \"./packages/codexkit-cli/src/index.js\";\n", "utf8");
chmodSync(entrypointPath, 0o755);

console.log(`Staged @codexkit/cli artifact at ${cliDistDir}`);
