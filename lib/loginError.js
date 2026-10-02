"use strict";

// Sorts a failed login into what the app should do about it.
//   "token":   Discord refused the token, at login or as gateway close code
//              4004 ("Authentication failed"). Retrying cannot fix it.
//   "intents": Discord closed the connection because of the intents the bot
//              asks for (close code 4014 or 4013, which the websocket layer
//              throws as a plain Error with no code). Retrying cannot fix it.
//   "retry":   anything else (network, rate limit, no sessions left).
function classifyLoginError(err) {
  const message = String((err && err.message) || "");
  if ((err && err.code === "TokenInvalid") || /authentication failed/i.test(message)) return "token";
  if (/disallowed intents|invalid intents/i.test(message)) return "intents";
  return "retry";
}

module.exports = { classifyLoginError };
