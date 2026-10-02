"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDice, rollDice } = require("../lib/dice");

test("parses common notation", () => {
  assert.deepEqual(parseDice("d20"), { ok: true, count: 1, sides: 20, modifier: 0 });
  assert.deepEqual(parseDice("2d6+1"), { ok: true, count: 2, sides: 6, modifier: 1 });
  assert.deepEqual(parseDice(" 3D8 - 2 "), { ok: true, count: 3, sides: 8, modifier: -2 });
});

test("accepts the bounds exactly", () => {
  assert.equal(parseDice("100d1000").ok, true);
});

test("refuses over the bounds without computing", () => {
  for (const input of ["101d6", "1d1001", "1000d1000000", "2d6+1001", "99999999999999999999d6"]) {
    const r = parseDice(input);
    assert.equal(r.ok, false, input);
  }
  assert.equal(parseDice("101d6").reason, "too big");
  assert.equal(parseDice("99999999999999999999d6").reason, "format");
});

test("refuses things that are not dice", () => {
  for (const input of ["", "hello", "0d6", "2d0", "-1d6", "2d6+", "2d6*3", "2d6+1+1", "1.5d6", undefined, null]) {
    const r = parseDice(input);
    assert.deepEqual(r, { ok: false, reason: "format" }, String(input));
  }
});

test("rollDice stays in range and adds the modifier", () => {
  const { rolls, total } = rollDice({ count: 50, sides: 6, modifier: 3 });
  assert.equal(rolls.length, 50);
  assert.ok(rolls.every((n) => n >= 1 && n <= 6));
  assert.equal(total, rolls.reduce((a, b) => a + b, 3));
  assert.deepEqual(rollDice({ count: 2, sides: 6, modifier: 1 }, () => 5), { rolls: [6, 6], total: 13 });
});
