"use strict";
const http = require("node:http");

const DOCS = "https://dockhold.eu/docs/recipes/deploy-a-discord-bot";

// Builds the invite link for a bot: the application ID, the two scopes a
// slash-command bot needs, and permissions 0 (slash replies need none).
function inviteUrl(applicationId) {
  if (!/^\d{5,25}$/.test(String(applicationId))) return null;
  const params = new URLSearchParams({
    client_id: String(applicationId),
    scope: "bot applications.commands",
    permissions: "0",
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

// `state` is read on every request: { gateway, message, invite }.
function createServer(state) {
  return http.createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    const send = (code, body) => {
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "GET" && req.method !== "HEAD") return send(405, { error: "method not allowed" });
    if (path === "/health") return send(200, { status: "ok" });
    if (path === "/") {
      return send(200, {
        status: "ok",
        gateway: state.gateway,
        message: state.message,
        invite: state.invite,
        docs: DOCS,
      });
    }
    return send(404, { error: "not found" });
  });
}

module.exports = { createServer, inviteUrl, DOCS };
