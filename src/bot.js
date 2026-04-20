'use strict';

const { Events, Collection } = require('discord.js');
const { getDiscordClient }   = require('./discord/client');
const { queueInput }         = require('./engine/inputHandler');
const { getSession }         = require('./engine/gameManager');
const { PHASE }              = require('./constants');

// ─── Load slash commands ──────────────────────────────────────────────────────

const commands = new Collection();
for (const name of ['create', 'join', 'start', 'end']) {
  const cmd = require(`./commands/${name}`);
  commands.set(cmd.data.name, cmd);
}

// ─── Event registration ───────────────────────────────────────────────────────

function registerEvents() {
  const client = getDiscordClient();

  client.once(Events.ClientReady, (c) => {
    console.log(`[Bot] Logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (!cmd) return;
      try {
        await cmd.execute(interaction);
      } catch (err) {
        console.error(`[Bot] Command error (/${interaction.commandName}):`, err);
        const method = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
        await interaction[method]({
          content: '❌ An error occurred.',
          ephemeral: true,
        }).catch(() => {});
      }
      return;
    }

    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  });
}

// ─── Button handler ───────────────────────────────────────────────────────────

const MOVE_BUTTONS = new Set(['move_up', 'move_down', 'move_left', 'move_right']);
const DIRECTION_MAP = {
  move_up: 'up', move_down: 'down', move_left: 'left', move_right: 'right',
};

const ACTION_BUTTONS = new Set(['action_kill', 'action_task', 'action_vent']);
const ACTION_MAP = {
  action_kill: 'kill', action_task: 'task', action_vent: 'vent',
};

async function handleButtonInteraction(interaction) {
  const id = interaction.customId;

  // ── Movement ──────────────────────────────────────────────────────────────
  if (MOVE_BUTTONS.has(id)) {
    await interaction.deferUpdate();
    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const session   = await getSession(sessionId);
    if (!session || session.phase !== PHASE.GAME) return;
    if (!session.players[interaction.user.id]) return;
    await queueInput(sessionId, interaction.user.id, DIRECTION_MAP[id]);
    return;
  }

  // ── Kill / Task / Vent ────────────────────────────────────────────────────
  if (ACTION_BUTTONS.has(id)) {
    await interaction.deferUpdate();
    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const session   = await getSession(sessionId);
    if (!session || session.phase !== PHASE.GAME) return;
    if (!session.players[interaction.user.id]) return;
    await queueInput(sessionId, interaction.user.id, ACTION_MAP[id]);
    return;
  }

  // ── Lobby: Join button ────────────────────────────────────────────────────
  if (id === 'lobby_join') {
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

  // ── Lobby: Start button ───────────────────────────────────────────────────
  if (id === 'lobby_start') {
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

    const gameMsg = await interaction.channel.send({ files: [attachment], components: rows });
    started.messageId = gameMsg.id;
    await saveSession(started);
    startLoop(started.id, started.channelId, gameMsg.id);

    await interaction.message.edit({ components: [] }).catch(() => {});
  }
}

module.exports = { registerEvents };
