// Local self-test evidence only. No upload, trusted verdict or invented commit.
import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const startedAt = new Date().toISOString();
const runId = "local-" + Date.now();
const directory = ".local/" + runId;
mkdirSync(directory, { recursive: true });
const result = spawnSync(
  process.execPath,
  ["--test", "tests/storefront.test.js"],
  { encoding: "utf8" },
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
const bytes = Buffer.from((result.stdout || "") + (result.stderr || ""));
writeFileSync(directory + "/test-output.txt", bytes);
let sha = null,
  dirty = true;
try {
  sha = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  dirty = Boolean(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  );
} catch {}
writeFileSync(
  directory + "/result.json",
  JSON.stringify(
    {
      sample: true,
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: result.status,
      headSha: sha,
      dirty,
      coverage:
        "API self-test only; browser recordings are produced separately by npm run test:e2e",
    },
    null,
    2,
  ),
);
if (sha && !dirty) {
  const manifest = {
    schemaVersion: 1,
    sample: true,
    runId,
    attempt: 1,
    repository: "justafolk/sample-project-exhibit",
    pullRequest: null,
    headSha: sha,
    flowId: "checkout.saved-address",
    flowRevision: sha,
    startedAt,
    finishedAt: new Date().toISOString(),
    origin: "self_test",
    termination: result.status === 0 ? "completed" : "failed",
    assertions: [
      {
        id: "api-suite",
        label: "API checkout, rejection, idempotency and cleanup tests",
        status: result.status === 0 ? "passed" : "failed",
      },
    ],
    artifacts: [
      {
        path: "test-output.txt",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
        mediaType: "text/plain",
      },
    ],
    notCovered: [
      "Browser behavior and recordings are tested separately",
      "Real payments, email, customer staging and GitHub execution",
      "Self-reported local test; no trusted collector or verdict",
    ],
    cleanup: {
      status: "completed",
      details: "Ephemeral in-process server closed; no persistent data",
    },
  };
  writeFileSync(
    directory + "/manifest.json",
    JSON.stringify(manifest, null, 2),
  );
} else
  console.log(
    "Commit-bound manifest omitted: this checkout needs a clean commit. No SHA has been invented.",
  );
console.log("Results: " + directory);
process.exitCode = result.status ?? 1;
