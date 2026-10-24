import http from "node:http";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const catalog = [
  { id: "notebook", name: "Field notebook", priceCents: 1800 },
  { id: "pen", name: "Studio pen", priceCents: 600 },
];
const address = {
  id: "saved-home",
  label: "Sample home",
  street: "42 Example Lane",
  city: "Testville",
};
export function createApp() {
  const runs = new Map();
  let sha = null;
  try {
    sha = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {}
  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, "http://localhost");
    try {
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(
          readFileSync(new URL("../public/index.html", import.meta.url)),
        );
      }
      if (req.method === "GET" && url.pathname === "/healthz")
        return send(200, { status: "ok", sample: true });
      if (req.method === "GET" && url.pathname === "/version")
        return send(200, {
          sample: true,
          headSha: sha,
          commitAvailable: Boolean(sha),
        });
      if (req.method === "GET" && url.pathname === "/api/catalog")
        return send(200, { items: catalog, address, sample: true });
      const runId = url.searchParams.get("runId");
      if (!runId || !/^[a-zA-Z0-9_-]{1,80}$/.test(runId))
        return send(400, {
          error:
            "A runId of 1–80 letters, numbers, underscores or hyphens is required",
        });
      if (req.method === "POST" && url.pathname === "/api/seed") {
        if (!runs.has(runId)) runs.set(runId, { order: null });
        return send(200, { runId, address, sample: true });
      }
      if (req.method === "DELETE" && url.pathname === "/api/run") {
        runs.delete(runId);
        return send(200, { runId, cleaned: true });
      }
      const run = runs.get(runId);
      if (!run) return send(404, { error: "Seed this run first" });
      if (req.method === "GET" && url.pathname === "/api/order")
        return send(200, { order: run.order });
      if (req.method === "POST" && url.pathname === "/api/checkout") {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 4096)
            return send(413, { error: "Request too large" });
        }
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          return send(400, { error: "Invalid JSON" });
        }
        if (
          !["happy", "payment-declined", "out-of-stock"].includes(body.scenario)
        )
          return send(400, { error: "Unknown scenario" });
        if (body.addressId !== address.id)
          return send(422, { error: "Choose the saved address" });
        if (body.scenario === "payment-declined")
          return send(402, {
            error: "Sample payment declined; no order created",
          });
        if (body.scenario === "out-of-stock")
          return send(409, {
            error: "Sample item out of stock; no order created",
          });
        run.order ??= {
          id: `order-${runId}`,
          runId,
          addressId: address.id,
          totalCents: catalog.reduce((sum, item) => sum + item.priceCents, 0),
          currency: "USD",
        };
        return send(200, { order: run.order, sample: true });
      }
      return send(404, { error: "Not found" });
    } catch {
      if (!res.headersSent) send(500, { error: "Internal error" });
      else res.end();
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createApp();
  server.listen(
    Number(process.env.PORT || 4173),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `Sample storefront listening on port ${server.address().port}`,
      ),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => server.close());
}
