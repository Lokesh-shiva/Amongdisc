'use strict';

const { Client, GatewayIntentBits } = require('discord.js');

let _client = null;

/**
 * Returns the singleton Discord.js Client, creating it on first call.
 */
function getDiscordClient() {
  if (_client) return _client;

  _client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  return _client;
}

module.exports = { getDiscordClient };
