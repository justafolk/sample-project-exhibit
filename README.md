# Field Store — Exhibit sample project

A runnable customer-side fixture for `justafolk/exhibit`: a small storefront with a saved-address checkout, deterministic totals, rejection scenarios, run-scoped data and cleanup. All data is sample data. No payment service, email, credentials, database or external network is required by the application. State lasts only for the server process.

This project lives in `sample-project-exhibit` (the selected sample repository). It does not add fake integrations or change Exhibit itself.

## Run and test

Use Node 22.12+ and npm 10:

```sh
npm ci
npm start
```

The server binds to loopback port 4173; set `PORT` to choose another port. Use a local browser when available. Cloud onboarding validates it internally and does not provide a public preview.

```sh
npm test                  # HTTP/domain integration test with an ephemeral server
npx playwright install chromium
npm run test:e2e           # 3 browser flows, isolated server on port 4174
npm run evidence          # real API self-test output in .local/<run-id>/
```

Browser tests capture WebM videos, traces and a successful confirmation screenshot under `test-results/`. These can be imported into Exhibit's recording studio. They remain manual, unverified recordings; media is not uploaded by Exhibit.

In the prepared cloud environment, activate the installed toolchain:

```sh
. /workspace/.tools/activate.sh
SAMPLE_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

That command uses the installed Debian Chromium and system ffmpeg because downloading Playwright's pinned Chromium is currently blocked by the running network policy. This fallback was tested with video capture; it is a different browser version from Playwright's default. Optional browser download domains are saved in environment settings for future use.

## Try the scenarios

The cart contains a notebook ($18) and pen ($6). The saved sample address is selected. Successful checkout returns an order ID and $24 total. Payment declined and out-of-stock selections return explicit errors without creating an order. Reset deletes only the current browser run and seeds it again. A unique run ID is visible below checkout.

API surface:

| Endpoint                       | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `GET /healthz`, `GET /version` | Health and actual Git HEAD, or explicit missing-commit state |
| `GET /api/catalog`             | Prices in integer cents and sample address                   |
| `POST /api/seed?runId=ID`      | Idempotently create an isolated run                          |
| `POST /api/checkout?runId=ID`  | JSON `{ "scenario": "happy", "addressId": "saved-home" }`    |
| `GET /api/order?runId=ID`      | Current order or null                                        |
| `DELETE /api/run?runId=ID`     | Idempotent, run-scoped cleanup                               |

This intentionally has no authentication and contains only synthetic data. Local startup defaults to loopback; the Render Blueprint explicitly sets `HOST=0.0.0.0` for public sample access. Never put real customer data or credentials into this fixture. It is not a production storefront.

## Connect the fixture to Exhibit

Start Exhibit using `make dev` in `/workspace/exhibit`, then choose **Explore sample workspace**. Setup can record `justafolk/sample-project-exhibit`, this local storefront URL, `local-sample-only` as the tenant and the runbook reference. This records metadata only; Exhibit does not connect or execute the project.

`exhibit/flow.yaml` and `exhibit/runbook.yaml` describe the checkout flow and bounded local recipe. Both remain `example-not-approved`. A human-reviewed runbook is a future execution prerequisite.

`exhibit/contracts.json` contains three labelled synthetic completeness inputs. Copy only the inner object into a contract. The complete example uses an explicitly synthetic SHA/PR; replace those with actual immutable refs before meaningful provenance testing. To exercise the real evaluator while Exhibit is running:

```sh
EXHIBIT_URL=http://127.0.0.1:27672 npm run test:exhibit
```

Use the actual Vite port from Exhibit's local `.env` if different. This checks all three evaluator states and logs out its isolated sample session.

`npm run evidence` runs API tests and saves actual output. Only a **clean, committed** checkout emits a commit-bound manifest compatible with Exhibit's existing evidence tooling. If the checkout has no commits, results truthfully contain `headSha: null` and no manifest is fabricated. From a clean committed checkout, generate and validate evidence with:

```sh
npm run evidence
python3 ../exhibit/scripts/evidence_tool.py report .local/RUN_ID/manifest.json \
  --artifact-root .local/RUN_ID --expected-sha FULL_ACTUAL_HEAD_SHA
```

Even a passing report is self-reported and **Unverified**. Browser captures are separate from the API self-test manifest and are not claimed as API-test artifacts.

See [the feature test guide](exhibit/FEATURES.md) for supported and future coverage. No webhook delivery, staging job, trusted upload or GitHub check is simulated as a working integration.

## Deploy on Render

The checked-in `render.yaml` defines one free Node web service from `main`, with `npm ci --omit=dev`, `npm start`, and `/healthz` as the health check. Node is pinned to 22.22.2; `HOST=0.0.0.0` lets Render route requests to the process, and Render supplies `PORT`. No database or secret is needed.

In Render, create a Blueprint using `justafolk/sample-project-exhibit` and apply the configuration. An existing service can instead use the same settings. Free services may sleep when idle. State is in memory, so orders disappear on restart or deployment; use one instance. All checkout scenarios remain simulations.

After deployment, check `/healthz`, `/version`, and `/api/catalog`, then place a sample order and verify the confirmation. The Blueprint is a deployment recipe; its presence alone does not establish that a live Render service exists.

## PR evidence with `agent-test`

Add the exact `agent-test` label to an open, non-draft PR in this repository. The **Exhibit agent-test evidence** workflow runs API and recorded browser tests for that PR's exact head SHA. It also runs on new commits, reopen and ready-for-review while the label remains present. Unlabelled PRs, draft PRs and forks are skipped; adding an unrelated label does not rerun evidence. Removing the label disables subsequent attempts.

Exhibit's pinned `sample-pr-evidence` action gates the event, checks checkout/capture provenance, hashes browser artifacts, and publishes an **Unverified** sample report in the Actions job summary. The seven-day artifact bundle contains the manifest, report, Playwright JSON, WebM videos, traces and confirmation screenshot. Each bundle includes the PR number, run ID and attempt. Either API or browser test failure fails the evidence job. Collection still attempts to report failed browser runs; missing/invalid reports fail collection instead of inventing success.

This workflow uses a fresh GitHub-hosted runner, read-only repository permissions and no inherited secrets. It starts the PR code locally; it does **not** test the deployed Render service, schedule a job through Exhibit's HTTP API, post PR comments, or create a trusted verdict. Do not supply staging credentials. The ordinary CI workflow remains independent of this opt-in evidence run.

Merge the Exhibit support PR before this integration. If Exhibit is private, enable same-owner action sharing in Exhibit's **Settings → Actions → General → Access** and allow the pinned actions in repository/organization policy. No extra token is needed for shared private actions. Create the `agent-test` repository label if it does not already exist.

### Video recording and Codex CLI

Every browser flow is recorded at 1280×720, with screenshots and traces retained on success or failure. `recordings.json` in the evidence bundle indexes the original videos by path, bytes and SHA-256, tied to the PR, commit and run attempt. Download the Actions artifact and open the corresponding file under `test-results/`. Missing video now fails Exhibit collection instead of silently accepting an unrecorded run.

The workflow also has a separate **codex-review** job. It runs **Codex CLI** to review deterministic results and recording metadata and suggest coverage gaps. It does not drive a browser or claim to watch video contents. The review is advisory; it cannot change test outcomes, the evidence manifest or verification status.

An OpenAI API key is **not required**: the CLI can use a Codex ChatGPT login. For unattended GitHub execution:

1. Run `codex login` on a trusted local machine using the intended ChatGPT account.
2. Store that CLI's `auth.json` contents securely as the repository's `CODEX_AUTH_JSON` Actions secret. Do not commit it, upload it, or paste it into chat. Configure a supported account with available Codex usage, and replace the secret if its login expires.
3. Add `agent-test` to a PR or push a new commit to an already labelled PR.

Without the secret, the job explicitly reports **not configured**; no Codex model is called. With it, the fresh agent job downloads and validates only that attempt's evidence, executes pinned CLI version 0.164.0 under an unprivileged user and read-only/no-network tool permissions, and uploads a separate advisory `codex-review/review.md` artifact for seven days. Model commands are denied access to the authentication directory and `/proc`; the native CLI can still authenticate. Credentials are temporary and excluded from artifacts. Model execution has a five-minute timeout; the job has a ten-minute limit. No PR code is checked out or executed in this credential-bearing job.

The Codex authentication file is an account credential. It is not automatically supplied by connecting Codex to GitHub or by this cloud session. No credentials are copied from the current session. Live model execution needs validation after the GitHub secret is configured; the unauthenticated path is deliberately distinguishable from a completed review.

### Codex CI output report

The **codex-review** job publishes a `codex-ci-report-pr-<PR>-<RUN>-<ATTEMPT>` artifact on success and failure. Download and extract it, then open **`report.html`** for the standalone report, **`report.md`** for Markdown or **`report.json`** for machine-readable results. A completed model review also retains the original `review.md`.

The report ties the Codex outcome to the PR/head SHA and run attempt, lists validated browser assertion and recording counts, and presents agent suggestions separately from deterministic results. Missing authentication is **not configured**; setup/agent errors produce a failure report rather than invented advice. The Markdown report is also available in the Actions job summary. Reports remain advisory and Unverified, and do not claim Codex watched the video content. Downloads are retained for seven days alongside the separate original video evidence bundle.
