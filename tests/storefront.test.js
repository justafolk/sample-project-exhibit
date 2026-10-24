import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.js";

async function fixture(t) {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path, method = "GET", body) => {
    const response = await fetch(base + path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
}
const checkout = (delivery = "standard", scenario = "happy") => ({
  addressId: "saved-home",
  scenario,
  delivery,
});

test("health, version and catalog expose sample provenance", async (t) => {
  const call = await fixture(t);
  assert.equal((await call("/healthz")).body.status, "ok");
  assert.equal((await call("/version")).body.sample, true);
  assert.equal(
    (await call("/api/catalog")).body.items.reduce(
      (sum, item) => sum + item.priceCents,
      0,
    ),
    2400,
  );
});
for (const [delivery, fee] of [
  ["standard", 0],
  ["express", 500],
]) {
  test(`${delivery} delivery uses server-calculated subtotal, fee and total`, async (t) => {
    const call = await fixture(t);
    await call("/api/seed?runId=pricing", "POST");
    const result = await call("/api/checkout?runId=pricing", "POST", {
      ...checkout(delivery),
      totalCents: 1,
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.order, {
      id: "order-pricing",
      runId: "pricing",
      addressId: "saved-home",
      delivery,
      subtotalCents: 2400,
      deliveryCents: fee,
      totalCents: 2400 + fee,
      currency: "USD",
    });
  });
}
test("invalid delivery and malformed body create no order", async (t) => {
  const call = await fixture(t);
  await call("/api/seed?runId=validation", "POST");
  for (const body of [checkout("teleport"), null, []]) {
    const response = await call("/api/checkout?runId=validation", "POST", body);
    assert.equal(
      response.status,
      body === null || Array.isArray(body) ? 400 : 422,
    );
    assert.equal((await call("/api/order?runId=validation")).body.order, null);
  }
});
for (const [scenario, status] of [
  ["payment-declined", 402],
  ["out-of-stock", 409],
]) {
  test(`${scenario} rejects express checkout without writing an order`, async (t) => {
    const call = await fixture(t);
    await call("/api/seed?runId=rejection", "POST");
    assert.equal(
      (
        await call(
          "/api/checkout?runId=rejection",
          "POST",
          checkout("express", scenario),
        )
      ).status,
      status,
    );
    assert.equal((await call("/api/order?runId=rejection")).body.order, null);
  });
}
test("checkout retries and seeding preserve the first committed order", async (t) => {
  const call = await fixture(t);
  await call("/api/seed?runId=retry", "POST");
  const order = (
    await call("/api/checkout?runId=retry", "POST", checkout("express"))
  ).body.order;
  await call("/api/seed?runId=retry", "POST");
  assert.deepEqual(
    (await call("/api/checkout?runId=retry", "POST", checkout("standard"))).body
      .order,
    order,
  );
  assert.deepEqual((await call("/api/order?runId=retry")).body.order, order);
});
test("run-scoped cleanup is idempotent and preserves other runs", async (t) => {
  const call = await fixture(t);
  for (const run of ["alpha", "beta"])
    await call("/api/seed?runId=" + run, "POST");
  assert.equal(
    (await call("/api/run?runId=alpha", "DELETE")).body.cleaned,
    true,
  );
  assert.equal((await call("/api/order?runId=alpha")).status, 404);
  assert.equal((await call("/api/order?runId=beta")).status, 200);
  assert.equal((await call("/api/run?runId=alpha", "DELETE")).status, 200);
});
test("missing runs and incorrect addresses are rejected", async (t) => {
  const call = await fixture(t);
  assert.equal((await call("/api/seed", "POST")).status, 400);
  assert.equal(
    (await call("/api/checkout?runId=missing", "POST", checkout())).status,
    404,
  );
  await call("/api/seed?runId=address", "POST");
  assert.equal(
    (
      await call("/api/checkout?runId=address", "POST", {
        ...checkout(),
        addressId: "wrong",
      })
    ).status,
    422,
  );
});
