'use strict';

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { getDiscordClient } = require('./discord/client');
const { getRedisClient }   = require('./redis/redisClient');
const { registerEvents }   = require('./bot');

// ─── Command definitions for REST registration ────────────────────────────────
const commandFiles = ['create', 'join', 'start', 'end'];
const commandData  = commandFiles.map((name) => require(`./commands/${name}`).data.toJSON());

async function main() {
  // 1. Validate required env vars
  const { DISCORD_TOKEN, DISCORD_CLIENT_ID } = process.env;
  if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
    console.error('[Startup] Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env');
    process.exit(1);
  }

  // 2. Initialise Redis (triggers connection)
  getRedisClient();

  // 3. Register global slash commands via Discord REST API
  //    Global commands take ~1h to propagate; this is idempotent.
  const rest = new REST().setToken(DISCORD_TOKEN);
  try {
    console.log('[Startup] Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commandData }
    );
    console.log('[Startup] Slash commands registered.');
  } catch (err) {
    console.error('[Startup] Failed to register commands:', err);
    process.exit(1);
  }

  // 4. Wire up Discord event handlers
  registerEvents();

  // 5. Log in
  const client = getDiscordClient();
  await client.login(DISCORD_TOKEN);

  // 6. Resume active games
  const { PHASE } = require('./constants');
  const { startLoop } = require('./engine/gameEngine');
  const redis = getRedisClient();
  const keys = await redis.keys('session:*');
  let resumedCount = 0;
  for (const key of keys) {
    const raw = await redis.get(key);
    if (raw) {
      const session = JSON.parse(raw);
      if (session.phase === PHASE.GAME && session.messageId) {
        startLoop(session.id, session.channelId, session.messageId);
        resumedCount++;
      }
    }
  }
  if (resumedCount > 0) {
    console.log(`[Startup] Resumed ${resumedCount} active games from Redis.`);
  }
}

main().catch((err) => {
  console.error('[Startup] Fatal error:', err);
  process.exit(1);
});
