'use strict';

const { Events, Collection } = require('discord.js');
const { getDiscordClient }   = require('./discord/client');
const { queueInput }         = require('./engine/inputHandler');
const { getSession }         = require('./engine/gameManager');
const { PHASE }              = require('./constants');

// ─── Load commands ────────────────────────────────────────────────────────────

const commands = new Collection();

for (const name of ['create', 'join', 'start', 'end']) {
  const cmd = require(`./commands/${name}`);
  commands.set(cmd.data.name, cmd);
}

// ─── Wire up event listeners ──────────────────────────────────────────────────

function registerEvents() {
  const client = getDiscordClient();

  client.once(Events.ClientReady, (c) => {
    console.log(`[Bot] Logged in as ${c.user.tag}`);
  });

  // ── Slash commands ─────────────────────────────────────────────────────────
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (!cmd) return;

      try {
        await cmd.execute(interaction);
      } catch (err) {
        console.error(`[Bot] Command error (/${interaction.commandName}):`, err);
        const method = interaction.deferred || interaction.replied
          ? 'editReply'
          : 'reply';
        await interaction[method]({
          content:   '❌ An error occurred while executing that command.',
          ephemeral: true,
        }).catch(() => {});
      }
      return;
    }

    // ── Button interactions ────────────────────────────────────────────────
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  });
}

// ─── Button handler ───────────────────────────────────────────────────────────

const MOVE_BUTTONS = new Set(['move_up', 'move_down', 'move_left', 'move_right']);
const DIRECTION_MAP = {
  move_up:    'up',
  move_down:  'down',
  move_left:  'left',
  move_right: 'right',
};

async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;

  // ── Movement buttons ────────────────────────────────────────────────────
  if (MOVE_BUTTONS.has(customId)) {
    // Must deferUpdate immediately — Discord 3-second timeout
    await interaction.deferUpdate();

    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const session   = await getSession(sessionId);

    if (!session || session.phase !== PHASE.GAME) return;

    // Player must be in this session
    if (!session.players[interaction.user.id]) return;

    const direction = DIRECTION_MAP[customId];
    await queueInput(sessionId, interaction.user.id, direction);
    return;
  }

  // ── Lobby: Join button ─────────────────────────────────────────────────
  if (customId === 'lobby_join') {
    // Re-use the /join command logic via a simulated interaction adapter
    await interaction.deferUpdate();

    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const { joinSession, getSession: gs } = require('./engine/gameManager');
    const session = await gs(sessionId);

    if (!session || session.phase !== PHASE.LOBBY) return;
    if (session.playerOrder.length >= 10) return;

    const updated = await joinSession(sessionId, interaction.user.id, interaction.user.username);

    const { buildLobbyEmbed, buildLobbyButtons } = require('./commands/create');
    await interaction.message.edit({
      embeds:     [buildLobbyEmbed(updated)],
      components: buildLobbyButtons(),
    }).catch(() => {});
    return;
  }

  // ── Lobby: Start button ────────────────────────────────────────────────
  if (customId === 'lobby_start') {
    await interaction.deferUpdate();

    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const { getSession: gs, startSession, saveSession } = require('./engine/gameManager');
    const { startLoop, buildMovementRowsPublic }        = require('./engine/gameEngine');
    const { renderFrame }                               = require('./renderer/renderer');
    const { AttachmentBuilder }                         = require('discord.js');

    const session = await gs(sessionId);
    if (!session || session.phase !== PHASE.LOBBY) return;
    if (session.hostId !== interaction.user.id)    return;

    const started    = await startSession(sessionId);
    const pngBuffer  = renderFrame(started);
    const attachment = new AttachmentBuilder(pngBuffer, { name: 'frame.png' });
    const rows       = buildMovementRowsPublic();

    const gameMsg = await interaction.channel.send({
      files:      [attachment],
      components: rows,
    });

    started.messageId = gameMsg.id;
    await saveSession(started);
    startLoop(started.id, started.channelId, gameMsg.id);

    // Remove the lobby buttons from the original lobby message
    await interaction.message.edit({ components: [] }).catch(() => {});
  }
}

module.exports = { registerEvents };
