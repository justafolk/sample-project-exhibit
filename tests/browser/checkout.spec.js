import { test, expect } from "@playwright/test";

test("saved address checkout matches API and confirmation; cleanup is scoped", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Place sample order" }),
  ).toBeEnabled();
  await expect(page.getByRole("radio")).toBeChecked();
  await expect(page.getByText("Total $24.00", { exact: true })).toBeVisible();
  const runId = (await page.locator("#run").innerText()).replace("Run: ", "");
  await request.post("/api/seed?runId=other-browser");
  await page.getByRole("button", { name: "Place sample order" }).click();
  const order = (await (await request.get("/api/order?runId=" + runId)).json())
    .order;
  expect(order.totalCents).toBe(2400);
  expect(order.addressId).toBe("saved-home");
  await expect(page.getByRole("status")).toHaveText(
    `Order confirmed: ${order.id} · $24.00`,
  );
  await page.screenshot({
    path: test.info().outputPath("confirmation.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reset this run" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Run reset. No order exists.",
  );
  expect(
    (await (await request.get("/api/order?runId=" + runId)).json()).order,
  ).toBeNull();
  expect(
    (await request.get("/api/order?runId=other-browser")).ok(),
  ).toBeTruthy();
  await request.delete("/api/run?runId=other-browser");
  await request.delete("/api/run?runId=" + runId);
});
for (const [scenario, message] of [
  ["payment-declined", "Sample payment declined; no order created"],
  ["out-of-stock", "Sample item out of stock; no order created"],
]) {
  test(scenario + " does not create an order", async ({ page, request }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Place sample order" }),
    ).toBeEnabled();
    const runId = (await page.locator("#run").innerText()).replace("Run: ", "");
    await page.getByLabel("Test scenario").selectOption(scenario);
    await page.getByRole("button", { name: "Place sample order" }).click();
    await expect(page.getByRole("status")).toHaveText(message);
    expect(
      (await (await request.get("/api/order?runId=" + runId)).json()).order,
    ).toBeNull();
    await request.delete("/api/run?runId=" + runId);
  });
}
