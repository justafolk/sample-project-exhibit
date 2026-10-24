import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";
export default defineConfig({
  metadata:
    process.env.EXHIBIT_CAPTURE === "1"
      ? {
          exhibitCapture: {
            schemaVersion: 1,
            headSha: execFileSync("git", ["rev-parse", "HEAD"], {
              encoding: "utf8",
            }).trim(),
            dirty: Boolean(
              execFileSync("git", ["status", "--porcelain"], {
                encoding: "utf8",
              }).trim(),
            ),
          },
        }
      : {},
  testDir: "./tests/browser",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4174",
    launchOptions: process.env.SAMPLE_CHROMIUM_PATH
      ? { executablePath: process.env.SAMPLE_CHROMIUM_PATH }
      : {},
    video: "on",
    trace: "on",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node src/server.js",
    url: "http://127.0.0.1:4174/healthz",
    env: { PORT: "4174" },
    reuseExistingServer: false,
  },
});
