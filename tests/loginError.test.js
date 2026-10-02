"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyLoginError } = require("../lib/loginError");

test("a refused token is final", () => {
  const err = new Error("An invalid token was provided.");
  err.code = "TokenInvalid";
  assert.equal(classifyLoginError(err), "token");
});

test("a gateway authentication failure is a token problem", () => {
  assert.equal(classifyLoginError(new Error("Authentication failed")), "token");
});

test("a disallowed intents close is final", () => {
  assert.equal(classifyLoginError(new Error("Used disallowed intents")), "intents");
});

test("network errors and no sessions left are retried", () => {
  assert.equal(classifyLoginError({ code: "ECONNRESET" }), "retry");
  assert.equal(classifyLoginError(new Error("Not enough sessions remaining to spawn 1 shards; only 0 remaining")), "retry");
  assert.equal(classifyLoginError(undefined), "retry");
});
