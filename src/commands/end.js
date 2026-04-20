'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getSession, deleteSession } = require('../engine/gameManager');
const { stopLoop }                  = require('../engine/gameEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('end')
    .setDescription('Stop the game and clear session data (host only)'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const session   = await getSession(sessionId);

    if (!session) {
      await interaction.editReply({ content: '❌ No active game in this channel.' });
      return;
    }

    if (session.hostId !== interaction.user.id) {
      await interaction.editReply({ content: '❌ Only the host can end the game.' });
      return;
    }

    // Stop the tick loop (safe even if not running)
    stopLoop(sessionId);

    // Delete session from Redis
    await deleteSession(sessionId);

    await interaction.editReply({ content: '✅ Game ended and session cleared.' });
  },
};
