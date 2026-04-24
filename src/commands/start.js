'use strict';

const { SlashCommandBuilder }                    = require('discord.js');
const { getSession, startSession, saveSession }  = require('../engine/gameManager');
const { startLoop, buildMovementRowsPublic }     = require('../engine/gameEngine');
const { PHASE }                                  = require('../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start the game (host only)'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const session   = await getSession(sessionId);

    if (!session) {
      await interaction.editReply({ content: '❌ No lobby found. Use `/create` first.' });
      return;
    }

    if (session.hostId !== interaction.user.id) {
      await interaction.editReply({ content: '❌ Only the host can start the game.' });
      return;
    }

    if (session.phase !== PHASE.LOBBY) {
      await interaction.editReply({ content: '❌ The game is already running.' });
      return;
    }

    if (session.playerOrder.length < 4) {
      await interaction.editReply({ content: '❌ At least 4 players needed to start.' });
      return;
    }

    const started = await startSession(sessionId);
    const rows    = buildMovementRowsPublic();

    // Post a text-only control panel (no map image) so fog of war is preserved
    const gameMsg = await interaction.channel.send({
      content:    '🎮 **Game in progress** — press any button to see your personal view.',
      components: rows,
    });

    started.messageId = gameMsg.id;
    await saveSession(started);
    startLoop(started.id, started.channelId, gameMsg.id);

    await interaction.editReply({ content: '✅ Game started!' });
  },
};
