import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvArg(args) {
  const envIndex = args.findIndex((arg) => arg.startsWith("--env="));
  if (envIndex === -1) return { envPath: null, args };
  const envPath = args[envIndex].slice("--env=".length);
  const filteredArgs = [...args.slice(0, envIndex), ...args.slice(envIndex + 1)];
  return { envPath, args: filteredArgs };
}

const { envPath: explicitEnvPath, args } = parseEnvArg(process.argv.slice(2));

const candidateEnvPaths = explicitEnvPath
  ? [explicitEnvPath]
  : [
      process.env.NODE_ENV === "test" ? ".env.test" : null,
      ".env",
      ".env.test"
    ].filter(Boolean);

for (const envPath of candidateEnvPaths) {
  const resolved = path.resolve(process.cwd(), envPath);
  if (fs.existsSync(resolved)) {
    dotenv.config({ path: resolved });
    break;
  }
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prismaEntrypoints = [
  path.resolve(__dirname, "..", "..", "node_modules", "prisma", "build", "index.js"),
  path.resolve(__dirname, "..", "node_modules", "prisma", "build", "index.js")
];

const prismaCliPath = prismaEntrypoints.find((p) => fs.existsSync(p));
if (!prismaCliPath) {
  console.error("Could not find Prisma CLI entrypoint (node_modules/prisma/build/index.js).");
  process.exit(1);
}

const result = spawnSync(process.execPath, [prismaCliPath, ...args], {
  stdio: "inherit",
  env: process.env
});

if (result.error) {
  console.error("Failed to run Prisma CLI.", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
