import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import worker from "../worker.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("game config proxy forwards a validated GET path and adds cache headers", async () => {
  let upstream;
  globalThis.fetch = async (url, init) => {
    upstream = { url: String(url), init };
    return new Response(JSON.stringify({ DailyTaskConf: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const response = await worker.fetch(
    new Request(
      "https://example.com/api/game-config/data/release-1/config.json",
    ),
    {},
  );

  assert.equal(
    upstream.url,
    "https://xxz-xyzw-res.hortorgames.com/data/release-1/config.json",
  );
  assert.equal(upstream.init.method, "GET");
  assert.equal(upstream.init.headers.Accept, "application/json");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(response.headers.get("Cache-Control"), /s-maxage=3600/);
});

test("game config proxy rejects unsafe paths and write methods", async () => {
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls++;
    return new Response("{}");
  };

  const invalidPath = await worker.fetch(
    new Request("https://example.com/api/game-config/data/../secret.json"),
    {},
  );
  assert.equal(invalidPath.status, 404);

  const post = await worker.fetch(
    new Request(
      "https://example.com/api/game-config/data/release-1/config.json",
      { method: "POST", body: "{}" },
    ),
    {},
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET, HEAD");
  assert.equal(upstreamCalls, 0);
});

test("game config proxy preserves upstream errors and reports transport failures", async () => {
  globalThis.fetch = async () =>
    new Response("forbidden", { status: 403, statusText: "Forbidden" });
  const forbidden = await worker.fetch(
    new Request(
      "https://example.com/api/game-config/data/release-1/config.json",
    ),
    {},
  );
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("Cache-Control"), "no-store");

  globalThis.fetch = async () => {
    throw new Error("upstream offline");
  };
  const unavailable = await worker.fetch(
    new Request(
      "https://example.com/api/game-config/data/release-1/config.json",
    ),
    {},
  );
  assert.equal(unavailable.status, 502);
  assert.match(await unavailable.text(), /upstream offline/);
});
