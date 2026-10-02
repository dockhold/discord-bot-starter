# Discord bot starter

A slash-command bot that stays online. It answers `/ping` and `/roll` (dice
like `2d6+1`), and it is a short, plain starting point for your own commands.
It runs on [Dockhold](https://dockhold.eu), so it keeps running when your
laptop is closed.

[![Deploy on Dockhold](https://dockhold.eu/button.svg)](https://app.dockhold.eu/new?repo=https://github.com/dockhold/discord-bot-starter&name=discord-bot-starter&ref=button-discord-bot)

## Deploy

1. Get a bot token from Discord (steps [below](#get-a-bot-token)).
2. Open the [Deploy link](https://app.dockhold.eu/new?repo=https://github.com/dockhold/discord-bot-starter&name=discord-bot-starter&ref=button-discord-bot)
   and sign in if asked. The free plan is enough.
3. Under **Environment**, in the **Secrets** list, click **New secret**
   and set its **Env var name** to `DISCORD_TOKEN`. Give the entry a
   name that belongs to this app, for example `discord-bot-token`, because
   secrets are shared across your apps by name. Paste the token as the value
   and deploy.
4. Open the app's URL. The page is JSON. Once the bot is connected, it has an
   `invite` value. Copy that value into your browser and pick your server.

Deployed without the token? Create it under Secrets in the dashboard sidebar
and attach it on the app's Variables tab as `DISCORD_TOKEN`. The app restarts
and picks it up. Until then the app's URL says the token is missing and where
to set it. A token Discord refuses is reported the same way. Neither one makes
the app restart in a loop.

## Get a bot token

1. Open the [Discord developer portal](https://discord.com/developers/applications)
   and choose **New Application**.
2. Open the **Bot** page and choose **Reset Token**. Copy it now. Discord shows
   it once.
3. Leave the **Privileged Gateway Intents** switches off. This bot does not
   read messages, so it needs none of them.

4. If you switch off **Public Bot** on the Bot page, only you can add the bot to a server.

The invite link on the app's URL asks for the `bot` and `applications.commands`
scopes and no extra permissions. Slash command replies do not need any.

## Run one copy only

Keep this app at one copy. Two copies would both receive every command and
both answer it.

## Commands show up where?

By default the commands are registered globally. Discord can take a while to
show a global command in every server. For quick testing, add a plain variable
on the app's Variables tab named `DISCORD_GUILD_ID`, set to your server's ID
(turn on Developer Mode in Discord, then right-click the server and choose
**Copy Server ID**), and restart. The commands then appear in that one server
at once.

On every start the bot replaces the command list in one place only: that
server when `DISCORD_GUILD_ID` is set, otherwise globally. Switching between
the two leaves the other list registered, so your test server can show each
command twice. To remove the old list, send Discord an empty list for it with
your bot token (`GUILD_ID` is your server's ID; use the second URL form for
global commands):

```bash
curl -X PUT -H "Authorization: Bot $DISCORD_TOKEN" -H "Content-Type: application/json" \
  -d '[]' "https://discord.com/api/v10/applications/$APPLICATION_ID/guilds/$GUILD_ID/commands"
# global list: .../applications/$APPLICATION_ID/commands
```

`APPLICATION_ID` is on the General Information page of your application in the
developer portal. This is Discord's bulk overwrite call, described in
[Discord's application commands documentation](https://docs.discord.com/developers/interactions/application-commands).
Restarting the app does not remove either list.

## Add a command

1. Add its definition to `definitions` in [`lib/commands.js`](lib/commands.js).
2. Add a branch for its name in `respond` in the same file. It returns the
   reply text. Keep the logic in `respond` so it can be tested without
   Discord.
3. Add a test in [`tests/commands.test.js`](tests/commands.test.js).

To run your own version, click **Use this template** on GitHub to make your
own copy, then deploy that copy from the dashboard with GitHub connected.
Every push to its main branch then redeploys the bot.

## Run it locally

```bash
npm install
DISCORD_TOKEN=your-token DISCORD_GUILD_ID=your-server-id PORT=3000 npm start
npm test
```

Open http://localhost:3000 to see the status. `gateway` is `connected`,
`connecting` or `no token`.

## Full walkthrough

[Deploy a Discord bot](https://dockhold.eu/docs/recipes/deploy-a-discord-bot)
