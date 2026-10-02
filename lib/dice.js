"use strict";
const { randomInt } = require("node:crypto");

// Dice notation such as "d20", "2d6" or "2d6+1". Bounded so a command cannot
// burn CPU or fill a reply: at most MAX_DICE dice, each with at most MAX_SIDES
// sides. The pattern caps digit counts, so a huge number is refused without
// ever being converted or computed with.
const MAX_DICE = 100;
const MAX_SIDES = 1000;
const MAX_MODIFIER = 1000;

const PATTERN = /^(\d{1,9})?d(\d{1,9})(?:([+-])(\d{1,9}))?$/;

// Returns { ok: true, count, sides, modifier } or { ok: false, reason }, where
// reason is "format" or "too big". Nothing is rolled here.
function parseDice(input) {
  const text = String(input ?? "").replace(/\s+/g, "").toLowerCase();
  const match = PATTERN.exec(text);
  if (!match) return { ok: false, reason: "format" };
  const count = match[1] === undefined ? 1 : Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] === undefined ? 0 : Number(match[4]) * (match[3] === "-" ? -1 : 1);
  if (count < 1 || sides < 1) return { ok: false, reason: "format" };
  if (count > MAX_DICE || sides > MAX_SIDES || Math.abs(modifier) > MAX_MODIFIER) {
    return { ok: false, reason: "too big" };
  }
  return { ok: true, count, sides, modifier };
}

// rand(n) returns an integer from 0 to n - 1. It is a parameter so tests can
// pin it; the default is crypto.randomInt.
function rollDice({ count, sides, modifier }, rand = (n) => randomInt(n)) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rand(sides) + 1);
  const total = rolls.reduce((sum, n) => sum + n, modifier);
  return { rolls, total };
}

module.exports = { parseDice, rollDice, MAX_DICE, MAX_SIDES, MAX_MODIFIER };
