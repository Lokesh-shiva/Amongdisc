'use strict';

const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getSession, startSession, saveSession }  = require('../engine/gameManager');
const { startLoop }                              = require('../engine/gameEngine');
const { renderFrame }                            = require('../renderer/renderer');
const { PHASE }                                  = require('../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start the game (host only)'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

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

    if (session.playerOrder.length < 1) {
      await interaction.editReply({ content: '❌ At least 1 player needed.' });
      return;
    }

    // Transition to GAME phase and assign spawn positions
    const started = await startSession(sessionId);

    // Render tick-0 frame
    const pngBuffer = await renderFrame(started);
    const attachment = new AttachmentBuilder(pngBuffer, { name: 'frame.png' });

    const { buildMovementRowsPublic } = require('../engine/gameEngine');
    const rows = buildMovementRowsPublic();

    // Delete the ephemeral reply and post the game message
    await interaction.deleteReply().catch(() => {});

    const gameMsg = await interaction.channel.send({
      files:      [attachment],
      components: rows,
    });

    // Persist the game message ID so the tick loop knows what to edit
    started.messageId = gameMsg.id;
    await saveSession(started);

    // Start the tick loop
    startLoop(started.id, started.channelId, gameMsg.id);
  },
};
