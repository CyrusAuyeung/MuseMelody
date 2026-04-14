import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const frontendRoot = join(repoRoot, "program", "Musemelody", "frontend");
const distRoot = join(frontendRoot, "dist");
const studioRoot = join(repoRoot, "public", "studio");

if (!existsSync(frontendRoot)) {
  throw new Error(`Frontend project not found: ${frontendRoot}`);
}

execSync("npm run build", {
  cwd: frontendRoot,
  stdio: "inherit"
});

rmSync(studioRoot, { recursive: true, force: true });
mkdirSync(studioRoot, { recursive: true });
cpSync(distRoot, studioRoot, { recursive: true });

console.log(`Studio build copied to ${studioRoot}`);