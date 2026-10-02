"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");
const { handleInteraction, definitions, TOO_BIG_REPLY } = require("../lib/commands");

// A stand-in for a Discord interaction: just what the handler touches.
function fake(commandName, dice, chat = true) {
  const replies = [];
  return {
    replies,
    isChatInputCommand: () => chat,
    commandName,
    options: { getString: () => dice },
    reply: async (r) => { replies.push(r); },
  };
}

test("/roll 1000d1000000 gets a short refusal and no roll", async () => {
  let rolled = 0;
  const i = fake("roll", "1000d1000000");
  await handleInteraction(i, { rand: () => { rolled++; return 0; } });
  assert.equal(rolled, 0);
  assert.equal(i.replies.length, 1);
  assert.equal(i.replies[0].content, TOO_BIG_REPLY);
  assert.ok(i.replies[0].content.length < 80);
  assert.equal(i.replies[0].flags, MessageFlags.Ephemeral);
});

test("/roll 2d6+1 answers with the total", async () => {
  const i = fake("roll", "2d6+1");
  await handleInteraction(i, { rand: () => 2 });
  assert.match(i.replies[0].content, /^2d6\+1: \*\*7\*\* \(3, 3 \+1\)$/);
  assert.equal(i.replies[0].flags, undefined);
});

test("/roll with junk gets the format hint", async () => {
  const i = fake("roll", "banana");
  await handleInteraction(i);
  assert.match(i.replies[0].content, /dice notation/);
  assert.equal(i.replies[0].flags, MessageFlags.Ephemeral);
});

test("/ping reports latency, and copes with none yet", async () => {
  const a = fake("ping");
  await handleInteraction(a, { wsPing: 42.4 });
  assert.match(a.replies[0].content, /42 ms/);
  const b = fake("ping");
  await handleInteraction(b, { wsPing: -1 });
  assert.equal(b.replies[0].content, "Pong.");
});

test("things that are not slash commands are ignored", async () => {
  const i = fake("roll", "d6", false);
  await handleInteraction(i);
  assert.equal(i.replies.length, 0);
});

test("the command list is /ping and /roll", () => {
  assert.deepEqual(definitions.map((d) => d.name), ["ping", "roll"]);
});
