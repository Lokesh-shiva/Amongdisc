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
    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const session   = await getSession(sessionId);
    if (!session || session.phase !== PHASE.GAME) return interaction.deferUpdate();
    if (!session.players[interaction.user.id]) return interaction.deferUpdate();

    await queueInput(sessionId, interaction.user.id, DIRECTION_MAP[id]);

    try {
      await interaction.deferReply({ ephemeral: true });
      const { renderPlayerView }        = require('./renderer/renderer');
      const { buildMovementRowsPublic } = require('./engine/gameEngine');
      const { AttachmentBuilder }       = require('discord.js');
      const pngBuffer  = await renderPlayerView(session, interaction.user.id);
      const attachment = new AttachmentBuilder(pngBuffer, { name: 'view.png' });
      await interaction.editReply({
        files:      [attachment],
        components: buildMovementRowsPublic(),
      });
    } catch (err) {
      console.error('[Bot] Ephemeral view render error:', err);
      await interaction.editReply({ content: '⚠️ Could not render view.' }).catch(() => {});
    }
    return;
  }

  // ── Kill / Task / Vent ────────────────────────────────────────────────────
  if (ACTION_BUTTONS.has(id)) {
    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const session   = await getSession(sessionId);
    if (!session || session.phase !== PHASE.GAME) return interaction.deferUpdate();
    const player = session.players[interaction.user.id];
    if (!player) return interaction.deferUpdate();

    const action = ACTION_MAP[id];

    if (action === 'kill') {
      if (!player.alive) return interaction.reply({ content: 'You are dead.', ephemeral: true });
      if (player.role !== 'impostor') return interaction.reply({ content: 'Only impostors can kill.', ephemeral: true });
      const cooldown = player.killCooldownUntilTick - session.tickCount;
      if (cooldown > 0) {
        return interaction.reply({ content: `🔪 Kill is on cooldown for ${cooldown} more ticks.`, ephemeral: true });
      }
      await queueInput(sessionId, interaction.user.id, action);
      try {
        await interaction.deferReply({ ephemeral: true });
        const { renderPlayerView }        = require('./renderer/renderer');
        const { buildMovementRowsPublic } = require('./engine/gameEngine');
        const { AttachmentBuilder }       = require('discord.js');
        const pngBuffer  = await renderPlayerView(session, interaction.user.id);
        const attachment = new AttachmentBuilder(pngBuffer, { name: 'view.png' });
        await interaction.editReply({
          files:      [attachment],
          components: buildMovementRowsPublic(),
        });
      } catch (err) {
        console.error('[Bot] Ephemeral view render error (kill):', err);
        await interaction.editReply({ content: '⚠️ Could not render view.' }).catch(() => {});
      }
      return;
    }

    if (action === 'task') {
      if (!player.alive) return interaction.reply({ content: 'You are dead.', ephemeral: true });
      if (player.role === 'impostor') return interaction.reply({ content: 'Impostors cannot do tasks.', ephemeral: true });
      
      const { MapLoader } = require('./maps/mapLoader');
      const map = MapLoader.fromJSON(session.map);
      const taskDef = map.getTaskAt(player.position.x, player.position.y);
      if (!taskDef) {
        return interaction.reply({ content: '❌ You are not standing on a task tile.', ephemeral: true });
      }
      const task = session.tasks[taskDef.id];
      if (task && task.completed) {
        return interaction.reply({ content: '✅ Task is already completed.', ephemeral: true });
      }
      await queueInput(sessionId, interaction.user.id, action);
      try {
        await interaction.deferReply({ ephemeral: true });
        const { renderPlayerView }        = require('./renderer/renderer');
        const { buildMovementRowsPublic } = require('./engine/gameEngine');
        const { AttachmentBuilder }       = require('discord.js');
        const pngBuffer  = await renderPlayerView(session, interaction.user.id);
        const attachment = new AttachmentBuilder(pngBuffer, { name: 'view.png' });
        await interaction.editReply({
          files:      [attachment],
          components: buildMovementRowsPublic(),
        });
      } catch (err) {
        console.error('[Bot] Ephemeral view render error (task):', err);
        await interaction.editReply({ content: '⚠️ Could not render view.' }).catch(() => {});
      }
      return;
    }

    if (action === 'vent') {
      if (!player.alive) return interaction.reply({ content: 'You are dead.', ephemeral: true });
      if (player.role !== 'impostor') return interaction.reply({ content: 'Only impostors can vent.', ephemeral: true });
      await queueInput(sessionId, interaction.user.id, action);
      try {
        await interaction.deferReply({ ephemeral: true });
        const { renderPlayerView }        = require('./renderer/renderer');
        const { buildMovementRowsPublic } = require('./engine/gameEngine');
        const { AttachmentBuilder }       = require('discord.js');
        const pngBuffer  = await renderPlayerView(session, interaction.user.id);
        const attachment = new AttachmentBuilder(pngBuffer, { name: 'view.png' });
        await interaction.editReply({
          files:      [attachment],
          components: buildMovementRowsPublic(),
        });
      } catch (err) {
        console.error('[Bot] Ephemeral view render error (vent):', err);
        await interaction.editReply({ content: '⚠️ Could not render view.' }).catch(() => {});
      }
      return;
    }
  }

  // ── Lobby: Join button ────────────────────────────────────────────────────
  if (id === 'lobby_join') {
    const sessionId = `${interaction.guildId}_${interaction.channelId}`;
    const { joinSession, getSession: gs } = require('./engine/gameManager');
    const session = await gs(sessionId);
    
    if (!session) return interaction.reply({ content: '❌ No active lobby.', ephemeral: true });
    if (session.phase !== PHASE.LOBBY) return interaction.reply({ content: '❌ The game has already started.', ephemeral: true });
    if (session.playerOrder.length >= 10) return interaction.reply({ content: '❌ This lobby is full (10/10).', ephemeral: true });

    await interaction.deferUpdate();

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

    const session = await gs(sessionId);
    if (!session || session.phase !== PHASE.LOBBY) return;
    if (session.hostId !== interaction.user.id)    return;

    const started = await startSession(sessionId);
    const rows    = buildMovementRowsPublic();

    // Transform the lobby message into a button-only control panel (no map image)
    const edited = await interaction.message.edit({
      content:    '🎮 **Game in progress** — press any button to see your personal view.',
      embeds:     [],
      components: rows,
    }).catch(err => {
      console.error('[lobby_start] Failed to edit lobby message:', err);
      return null;
    });
    if (!edited) return;

    started.messageId = interaction.message.id;
    await saveSession(started);
    startLoop(started.id, started.channelId, interaction.message.id);
  }
}

module.exports = { registerEvents };
