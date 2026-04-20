'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getSession, joinSession } = require('../engine/gameManager');
const { buildLobbyEmbed, buildLobbyButtons } = require('./create');
const { PHASE } = require('../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join the game lobby in this channel'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const session   = await getSession(sessionId);

    if (!session) {
      await interaction.editReply({ content: '❌ No active lobby in this channel. Use `/create` first.' });
      return;
    }

    if (session.phase !== PHASE.LOBBY) {
      await interaction.editReply({ content: '❌ The game has already started.' });
      return;
    }

    if (session.playerOrder.length >= 10) {
      await interaction.editReply({ content: '❌ This lobby is full (10/10).' });
      return;
    }

    const updated = await joinSession(sessionId, interaction.user.id, interaction.user.username);

    // Refresh the lobby embed in the original message
    if (updated.messageId) {
      try {
        const channel = await interaction.client.channels.fetch(interaction.channelId);
        const message = await channel.messages.fetch(updated.messageId);
        await message.edit({
          embeds:     [buildLobbyEmbed(updated)],
          components: buildLobbyButtons(),
        });
      } catch {
        // Non-fatal — lobby embed refresh failed
      }
    }

    await interaction.editReply({ content: '✅ You joined the lobby!' });
  },
};
