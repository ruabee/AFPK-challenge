import test from "node:test";
import assert from "node:assert/strict";
import { makeServer } from "../BE/서버.mjs";
import { validatePayload } from "../BE/요청검증.mjs";
import { upstreamError } from "../AI/클로드연결.mjs";
const user = { role: "user", content: "테스트" };
test("zero interest, losses, compound growth and forged results", () => {
  const run = (rate) =>
    validatePayload({
      messages: [user],
      simulation: { initial: 100, monthly: 50, years: 10, rate, value: 999999 },
    }).simulation;
  assert.equal(run(0).value, 6100);
  assert.ok(run(-5).value < 6100);
  assert.ok(run(5).value > 6100);
  assert.notEqual(run(5).value, 999999);
});
test("reject invalid roles, long messages and invalid simulation", () => {
  for (const body of [
    { messages: [{ role: "system", content: "x" }] },
    { messages: [user, { role: "assistant", content: "x" }] },
    { messages: [{ ...user, content: "x".repeat(16001) }] },
    {
      messages: [user],
      simulation: { initial: 0, monthly: 50, years: 1.5, rate: 5 },
    },
  ])
    assert.throws(() => validatePayload(body));
});
test("safe error mapping never echoes raw upstream messages", () => {
  assert.match(
    upstreamError(
      400,
      "This API key is not scoped to a workspace; anthropic-workspace-id required",
    ),
    /워크스페이스/,
  );
  assert.match(upstreamError(400, "Invalid API key secret"), /인증/);
  assert.match(upstreamError(400, "credit balance too low"), /크레딧/);
  assert.ok(!upstreamError(500, "secret").includes("secret"));
});
test("HTTP handles context, credentials, errors, origin and static allowlist", async () => {
  let captured;
  let fail = false;
  const server = makeServer({
    getConfig: async () => ({
      key: "test-secret",
      model: "test-model",
      workspace: "wrkspc_test",
    }),
    fetchImpl: async (url, options) => {
      captured = { url, ...options };
      return new Response(
        JSON.stringify(
          fail
            ? { error: { message: "Invalid API key test-secret" } }
            : {
                content: [{ type: "text", text: "응답" }],
                stop_reason: "end_turn",
              },
        ),
        { status: fail ? 401 : 200 },
      );
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    for (const path of [
      "/.env",
      "/server.mjs",
      "/BE/서버.mjs",
      "/AI/상담지침.md",
      "/.git/config",
    ])
      assert.equal((await fetch(base + path)).status, 404);
    for (const [path, marker] of [
      ["/", "AskYES"],
      ["/app.js", "function"],
      ["/simulator.js", "function"],
      ["/style.css", ":root"],
    ]) {
      const asset = await fetch(base + path);
      assert.equal(asset.status, 200);
      assert.ok((await asset.text()).includes(marker));
    }
    const health = await (await fetch(base + "/api/health")).text();
    assert.ok(!health.includes("test-secret"));
    const payload = {
      messages: [user, { role: "assistant", content: "previous answer" }, user],
      simulation: { initial: 0, monthly: 50, years: 10, rate: 5 },
    };
    const options = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    };
    assert.equal(
      (
        await fetch(base + "/api/chat", {
          ...options,
          headers: { ...options.headers, origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await (await fetch(base + "/api/chat", options)).json()).reply,
      "응답",
    );
    const body = JSON.parse(captured.body);
    assert.equal(body.messages[1].content, "previous answer");
    assert.match(body.messages[2].content, /7764/);
    assert.equal(captured.headers["x-api-key"], "test-secret");
    assert.equal(captured.headers["anthropic-workspace-id"], "wrkspc_test");
    fail = true;
    const error = await (await fetch(base + "/api/chat", options)).json();
    assert.match(error.error, /인증/);
    assert.ok(!error.error.includes("test-secret"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
