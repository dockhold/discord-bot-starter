"use strict";
const { MessageFlags } = require("discord.js");
const { parseDice, rollDice, MAX_DICE, MAX_SIDES } = require("./dice");

// The command definitions sent to Discord on every start (a bulk overwrite,
// so restarting never duplicates a command).
const definitions = [
  {
    name: "ping",
    description: "Show the bot's gateway latency",
  },
  {
    name: "roll",
    description: "Roll dice, for example 2d6+1",
    options: [
      {
        name: "dice",
        description: "Dice notation, for example d20 or 2d6+1",
        type: 3, // ApplicationCommandOptionType.String
        required: true,
        max_length: 40,
      },
    ],
  },
];

const FORMAT_REPLY = "Use dice notation like d20 or 2d6+1.";
const TOO_BIG_REPLY = `Too big. Use at most ${MAX_DICE} dice and d${MAX_SIDES}.`;

// Pure: turns a command name and its input into a reply. Refusals are
// ephemeral (only the caller sees them).
function respond(name, input, { wsPing = -1, rand } = {}) {
  if (name === "ping") {
    const ms = Math.round(wsPing);
    return { content: ms >= 0 ? `Pong. Gateway latency ${ms} ms.` : "Pong." };
  }
  if (name === "roll") {
    const parsed = parseDice(input);
    if (!parsed.ok) {
      return { content: parsed.reason === "too big" ? TOO_BIG_REPLY : FORMAT_REPLY, ephemeral: true };
    }
    const { rolls, total } = rollDice(parsed, rand);
    const mod = parsed.modifier === 0 ? "" : parsed.modifier > 0 ? `+${parsed.modifier}` : `${parsed.modifier}`;
    const label = `${parsed.count}d${parsed.sides}${mod}`;
    const detail = parsed.count === 1 && parsed.modifier === 0 ? "" : ` (${rolls.join(", ")}${mod ? ` ${mod}` : ""})`;
    return { content: `${label}: **${total}**${detail}` };
  }
  return { content: "Unknown command.", ephemeral: true };
}

// Handles one interaction. `interaction` needs isChatInputCommand(),
// commandName, options.getString() and reply().
async function handleInteraction(interaction, ctx = {}) {
  if (!interaction.isChatInputCommand()) return;
  const input = interaction.commandName === "roll" ? interaction.options.getString("dice") : undefined;
  const reply = respond(interaction.commandName, input, ctx);
  await interaction.reply(
    reply.ephemeral ? { content: reply.content, flags: MessageFlags.Ephemeral } : { content: reply.content },
  );
}

module.exports = { definitions, respond, handleInteraction, FORMAT_REPLY, TOO_BIG_REPLY };
