# Validation in the onboarding machine

Initial onboarding validation, before the sample project was committed. Executed against the created local sample project and the existing Exhibit checkout:

- Sample API test passed: saved address, $24 total, missing seed, invalid address, declined payment, out-of-stock, no order on rejection, checkout/seed idempotency and cleanup isolation.
- Sample browser suite: 3 passed. Successful confirmation, payment declined and out-of-stock. Actual WebM recordings and traces produced; confirmation screenshot produced. A recording was checked with ffprobe (1.44 seconds).
- Real Exhibit API: all 3 contract completeness fixture states matched (`ready`, `needs_info`, `not_testable`). The isolated sample session logged out successfully.
- Exhibit `make check` passed: generated contracts, TypeScript, web build, formatting, Go vet, Go race tests and 16 Python tooling tests.
- Exhibit browser suite: 18 passed, covering sample authentication/CSRF/session isolation, reports, filters, setup, flows, contract drafts, workspace metadata, error/mobile states and recording behavior.
- Both running applications returned healthy responses; Exhibit reported demo readiness. Sample `/version` correctly returned a null SHA because the repository has no commits.
- Evidence generator was exercised in a temporary committed Git fixture: the manifest matched the actual HEAD and local artifact hashes; tampered bytes were correctly rejected. The user repository was not committed.
- Sample API self-test output was saved under `.local/`; no commit-bound manifest was emitted for this unborn checkout.

Browser checks used the preinstalled Debian Chromium 154.0.8037.57 and system ffmpeg via the external cloud configuration. Playwright's default Chromium 156 download was denied by the running network policy. Optional download domains were saved to the configuration draft. The 18 Exhibit tests used `/workspace/.tools/exhibit-playwright.config.ts`; tracked Exhibit files were unchanged.

Not executed: PostgreSQL integration/account provisioning, Docker image build, interactive desktop capture permission, future customer execution/GitHub integrations, or the new GitHub Actions workflow on GitHub. Existing browser recording tests exercise capture with test-provided streams, not actual user desktop permission.

A new-task snapshot restore has not been tested. Configuration publication is performed by the user through environment settings.
