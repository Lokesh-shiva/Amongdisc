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

const fs = require('fs');
const path = require('path');

const mapsDir = path.join(__dirname, '../maps/data');
const mapFiles = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json'));
const mapChoices = mapFiles.slice(0, 25).map(f => ({
  name: f.replace('.json', ''),
  value: f
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new game lobby in this channel')
    .addIntegerOption(opt => opt
      .setName('tick_interval')
      .setDescription('Tick interval in milliseconds (e.g. 2000)')
      .setMinValue(500)
      .setMaxValue(10000)
    )
    .addStringOption(opt => {
      opt.setName('map').setDescription('Map to play on');
      mapChoices.forEach(c => opt.addChoice(c.name, c.value));
      return opt;
    }),

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

    const tickIntervalMs = interaction.options.getInteger('tick_interval') || undefined;
    const mapFile = interaction.options.getString('map') || 'skeld.json';

    const session = await createSession({
      guildId:  interaction.guildId,
      channelId: interaction.channelId,
      hostId:    interaction.user.id,
      hostUsername: interaction.user.username,
      tickIntervalMs,
      mapFile,
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
