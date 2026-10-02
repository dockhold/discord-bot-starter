"use strict";
const { Client, Events, GatewayIntentBits } = require("discord.js");
const { definitions, handleInteraction } = require("./lib/commands");
const { createServer, inviteUrl } = require("./lib/status");
const { classifyLoginError } = require("./lib/loginError");

let stopping = false;
const port = Number(process.env.PORT) || 3000;
const token = (process.env.DISCORD_TOKEN || "").trim();
const guildId = (process.env.DISCORD_GUILD_ID || "").trim();

// What the status page shows. gateway is "connected", "connecting" or "no token".
const state = { gateway: token ? "connecting" : "no token", message: "", invite: null };

// One line per event. The token is scrubbed from anything logged, in case an
// upstream message ever quotes it.
const log = (line) => console.log(token ? String(line).split(token).join("[token]") : line);
const why = (err) => `code ${err && err.code !== undefined ? err.code : "none"}: ${(err && err.message) || "no message"}`;

const server = createServer(state);
server.listen(port, "0.0.0.0", () => log(`status server listening on ${port}`));

let client = null;

// A client that failed to log in destroys itself and cannot be reused, so each
// login attempt gets a new one.
function buildClient() {
  const c = new Client({ intents: [GatewayIntentBits.Guilds] });

  c.once(Events.ClientReady, async (ready) => {
    state.gateway = "connected";
    state.invite = inviteUrl(ready.application.id);
    state.message = "Connected.";
    log(`connected as ${ready.user.tag}`);
    log(`invite: ${state.invite}`);
    try {
      // A bulk overwrite replaces the whole list in that scope, so a restart
      // never duplicates a command.
      if (guildId) await ready.application.commands.set(definitions, guildId);
      else await ready.application.commands.set(definitions);
      log(`commands registered ${guildId ? "to one server" : "globally"}: ${definitions.map((d) => d.name).join(", ")}`);
    } catch (err) {
      state.message = "Connected, but Discord refused the command list. If DISCORD_GUILD_ID is set, check it on the app's Variables tab and that the bot was invited to that server.";
      log(`could not register commands (${why(err)}). ${state.message}`);
    }
  });

  c.on(Events.InteractionCreate, (interaction) => {
    handleInteraction(interaction, { wsPing: c.ws.ping }).catch((err) => {
      log(`interaction failed (${why(err)})`);
    });
  });

  c.on(Events.Error, (err) => log(`client error (${why(err)})`));
  c.on(Events.ShardError, (err) => log(`gateway error (${why(err)})`));
  c.on(Events.ShardDisconnect, (event) => {
    const code = event && event.code !== undefined ? event.code : "unknown";
    state.gateway = "connecting";
    state.message = `Disconnected from Discord (close code ${code}). Reconnecting.`;
    log(state.message);
  });
  c.on(Events.ShardResume, () => {
    state.gateway = "connected";
    state.message = "Connected.";
    log("gateway resumed");
  });
  return c;
}

const TOKEN_MESSAGE =
  "Discord refused the token. Check the secret you attached as DISCORD_TOKEN (Secrets in the dashboard sidebar, then the app's Variables tab). The app restarts by itself when you change it.";
const INTENTS_MESSAGE =
  "Discord refused the connection: an intent this bot asks for is not switched on in the developer portal. Turn it on, or remove it from the code, then restart the app.";

if (!token) {
  state.message =
    "DISCORD_TOKEN is missing. Create the token under Secrets in the dashboard sidebar, then attach it on the app's Variables tab as DISCORD_TOKEN. The app restarts by itself.";
  log(state.message);
} else {
  const login = (attempt = 1) => {
    if (stopping) return;
    if (client) client.destroy().catch(() => {});
    client = buildClient();
    client.login(token).catch((err) => {
      const kind = classifyLoginError(err);
      if (kind !== "retry") {
        // Retrying cannot fix these, and a crash loop would only hide the cause.
        state.gateway = "no token";
        state.message = kind === "token" ? TOKEN_MESSAGE : INTENTS_MESSAGE;
        log(`${state.message} (${why(err)})`);
        return;
      }
      const wait = Math.min(60, 5 * attempt);
      state.gateway = "connecting";
      state.message = `Could not reach Discord. Trying again in ${wait} s.`;
      log(`login failed (${why(err)}), retrying in ${wait} s`);
      setTimeout(() => login(attempt + 1), wait * 1000);
    });
  };
  login();
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  log(`${signal} received, shutting down`);
  // Hard limit: leave inside 10 seconds whatever is still open.
  setTimeout(() => process.exit(1), 8000).unref();
  if (client) client.destroy().catch(() => {});
  server.close(() => process.exit(0));
  server.closeAllConnections();
}
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));
