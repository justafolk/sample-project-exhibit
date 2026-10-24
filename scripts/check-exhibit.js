import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base = process.env.EXHIBIT_URL || "http://127.0.0.1:27672";
const origin = new URL(base).origin;
const response = await fetch(base + "/api/v1/auth/demo", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: "{}",
});
assert.equal(response.status, 200, "Exhibit must be running in demo mode");
const cookie = response.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
const session = await response.json();
const headers = {
  Cookie: cookie,
  Origin: origin,
  "Content-Type": "application/json",
  "X-CSRF-Token": session.csrfToken,
};
try {
  const fixtures = JSON.parse(
    readFileSync(new URL("../exhibit/contracts.json", import.meta.url)),
  );
  for (const state of ["ready", "needs_info", "not_testable"]) {
    const evaluation = await fetch(base + "/api/v1/contracts/evaluate", {
      method: "POST",
      headers,
      body: JSON.stringify(fixtures[state]),
    });
    assert.equal(evaluation.status, 200);
    assert.equal((await evaluation.json()).state, state);
    console.log(
      "PASS contract completeness: " +
        state +
        " (synthetic inputs, no execution authorization)",
    );
  }
} finally {
  const logout = await fetch(base + "/api/v1/auth/logout", {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(logout.status, 200);
}
