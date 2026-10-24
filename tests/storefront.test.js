import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.js";

test("checkout, rejection, idempotency, provenance and run-isolated cleanup", async (t) => {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, method = "GET", body) => {
    const response = await fetch(base + path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await call("/healthz")).body.status, "ok");
  assert.equal((await call("/version")).body.sample, true);
  assert.equal((await call("/api/seed", "POST")).status, 400);
  assert.equal(
    (await call("/api/checkout?runId=missing", "POST", {})).status,
    404,
  );
  for (const id of ["alpha", "beta"])
    assert.equal((await call("/api/seed?runId=" + id, "POST")).status, 200);
  assert.equal(
    (
      await call("/api/checkout?runId=alpha", "POST", {
        scenario: "happy",
        addressId: "wrong",
      })
    ).status,
    422,
  );
  for (const [scenario, status] of [
    ["payment-declined", 402],
    ["out-of-stock", 409],
  ]) {
    assert.equal(
      (
        await call("/api/checkout?runId=alpha", "POST", {
          scenario,
          addressId: "saved-home",
        })
      ).status,
      status,
    );
    assert.equal((await call("/api/order?runId=alpha")).body.order, null);
  }
  const order = (
    await call("/api/checkout?runId=alpha", "POST", {
      scenario: "happy",
      addressId: "saved-home",
    })
  ).body.order;
  assert.equal(order.totalCents, 2400);
  assert.equal(order.addressId, "saved-home");
  assert.deepEqual(
    (
      await call("/api/checkout?runId=alpha", "POST", {
        scenario: "happy",
        addressId: "saved-home",
      })
    ).body.order,
    order,
  );
  await call("/api/seed?runId=alpha", "POST");
  assert.deepEqual((await call("/api/order?runId=alpha")).body.order, order);
  assert.equal(
    (await call("/api/run?runId=alpha", "DELETE")).body.cleaned,
    true,
  );
  assert.equal((await call("/api/order?runId=alpha")).status, 404);
  assert.equal((await call("/api/order?runId=beta")).status, 200);
  assert.equal((await call("/api/run?runId=alpha", "DELETE")).status, 200);
});
