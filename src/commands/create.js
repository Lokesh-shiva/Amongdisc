'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createSession, getSession } = require('../engine/gameManager');
const { PLAYER_COLORS }             = require('../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new game lobby in this channel'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const sessionId = `${interaction.guildId}_${interaction.channelId}`;

    // One game per channel — reject if one already exists
    const existing = await getSession(sessionId);
    if (existing) {
      await interaction.editReply({
        content: '⚠️ A game is already running in this channel. Use `/end` to stop it first.',
      });
      return;
    }

    const session = await createSession({
      guildId:  interaction.guildId,
      channelId: interaction.channelId,
      hostId:    interaction.user.id,
      hostUsername: interaction.user.username,
    });

    const embed = buildLobbyEmbed(session);
    const rows  = buildLobbyButtons();

    const reply = await interaction.editReply({ embeds: [embed], components: rows });

    // Persist the message ID so we can edit it later (join command)
    session.messageId = reply.id;
    const { saveSession } = require('../engine/gameManager');
    await saveSession(session);
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildLobbyEmbed(session) {
  const playerLines = session.playerOrder.map((id) => {
    const p     = session.players[id];
    const color = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length];
    const crown = id === session.hostId ? ' 👑' : '';
    return `${color.name} — **${p.username}**${crown}`;
  });

  const tickSec = (session.tickIntervalMs / 1000).toFixed(1);

  return new EmbedBuilder()
    .setTitle('🚀 Game Lobby')
    .setColor(0x1e88e5)
    .addFields(
      {
        name:   `Players (${session.playerOrder.length}/10)`,
        value:  playerLines.join('\n') || 'No players yet',
        inline: false,
      },
      { name: 'Map',       value: session.map.name, inline: true },
      { name: 'Tick Rate', value: `${tickSec}s`,     inline: true },
    )
    .setFooter({ text: `Session: ${session.id}` })
    .setTimestamp();
}

function buildLobbyButtons() {
  const joinBtn = new ButtonBuilder()
    .setCustomId('lobby_join')
    .setLabel('Join Game')
    .setStyle(ButtonStyle.Primary);

  const startBtn = new ButtonBuilder()
    .setCustomId('lobby_start')
    .setLabel('Start Game')
    .setStyle(ButtonStyle.Success);

  return [new ActionRowBuilder().addComponents(joinBtn, startBtn)];
}

module.exports.buildLobbyEmbed  = buildLobbyEmbed;
module.exports.buildLobbyButtons = buildLobbyButtons;
