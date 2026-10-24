// Run real Node HTTP tests with immutable-start provenance and preserve exit status.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const directory = ".local/evidence";
mkdirSync(directory, { recursive: true });
const startedAt = new Date().toISOString();
const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const dirty = Boolean(
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
);
const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-reporter=junit",
    `--test-reporter-destination=${directory}/api-tests.xml`,
    "tests/storefront.test.js",
  ],
  { stdio: "inherit" },
);
writeFileSync(
  `${directory}/api-capture.json`,
  JSON.stringify(
    {
      schemaVersion: 1,
      headSha,
      dirty,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: result.status,
      signal: result.signal,
    },
    null,
    2,
  ),
);
process.exitCode = result.status ?? 1;
