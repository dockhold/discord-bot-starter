"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer, inviteUrl } = require("../lib/status");

test("invite URL carries both scopes and permissions 0", () => {
  const u = new URL(inviteUrl("123456789012345678"));
  assert.equal(u.origin + u.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(u.searchParams.get("client_id"), "123456789012345678");
  assert.equal(u.searchParams.get("scope"), "bot applications.commands");
  assert.equal(u.searchParams.get("permissions"), "0");
  assert.equal(inviteUrl("not-an-id"), null);
});

test("/ and /health answer", async () => {
  const state = { gateway: "no token", message: "m", invite: null };
  const server = createServer(state);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  const root = await (await fetch(`${base}/`)).json();
  assert.deepEqual(Object.keys(root).sort(), ["docs", "gateway", "invite", "message", "status"]);
  assert.equal(root.gateway, "no token");
  state.gateway = "connected";
  assert.equal((await (await fetch(`${base}/`)).json()).gateway, "connected");
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  server.close();
});
