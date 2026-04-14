import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const frontendRoot = join(repoRoot, "program", "Musemelody", "frontend");
const distRoot = join(frontendRoot, "dist");
const studioRoot = join(repoRoot, "public", "studio");
const homepagePath = join(repoRoot, "public", "index.html");

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

const embedJsFile = existsSync(join(studioRoot, "assets"))
  ? readdirSync(join(studioRoot, "assets")).find((file) => /^embed-.*\.js$/.test(file))
  : null;

if (embedJsFile) {
  const homepageHtml = readFileSync(homepagePath, "utf8");
  const cleaned = homepageHtml
    .replace(/\s*<script type="module" src="\.\/app\.js" defer><\/script>\s*/g, "\n")
    .replace(/\s*<script type="module" src="\/studio\/assets\/[^"]+\.js"><\/script>\s*/g, "\n");
  const injected = cleaned.replace(
    "</body>",
    `    <script type="module" src="/studio/assets/${embedJsFile}"></script>\n  </body>`
  );
  writeFileSync(homepagePath, injected, "utf8");
}

console.log(`Studio build copied to ${studioRoot}`);