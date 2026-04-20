'use strict';

const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDiscordClient }                       = require('../discord/client');
const { getSession, saveSession, checkWinCondition } = require('./gameManager');
const { consumeInputs }                          = require('./inputHandler');
const { applyTick }                              = require('./physics');
const { MapLoader }                              = require('../maps/mapLoader');
const { renderFrame }                            = require('../renderer/renderer');
const { PHASE }                                  = require('../constants');

// sessionId → interval handle
const _activeLoops = new Map();

// ─── Loop management ──────────────────────────────────────────────────────────

async function startLoop(sessionId, channelId, messageId) {
  stopLoop(sessionId);

  // Send role DMs to all players without blocking loop startup
  const session = await getSession(sessionId);
  if (session) sendRoleNotifications(session).catch(() => {});

  const tickMs = parseInt(process.env.TICK_INTERVAL_MS || '2000', 10);
  const handle = setInterval(async () => {
    try {
      await runTick(sessionId, channelId, messageId);
    } catch (err) {
      console.error(`[Engine] Tick error for ${sessionId}:`, err);
    }
  }, tickMs);

  _activeLoops.set(sessionId, handle);
  console.log(`[Engine] Loop started for ${sessionId} (${tickMs}ms)`);
}

function stopLoop(sessionId) {
  const handle = _activeLoops.get(sessionId);
  if (handle) {
    clearInterval(handle);
    _activeLoops.delete(sessionId);
    console.log(`[Engine] Loop stopped for ${sessionId}`);
  }
}

function isLoopRunning(sessionId) {
  return _activeLoops.has(sessionId);
}

// ─── Core Tick ───────────────────────────────────────────────────────────────

async function runTick(sessionId, channelId, messageId) {
  // 1. Load session
  const session = await getSession(sessionId);
  if (!session || session.phase !== PHASE.GAME) {
    stopLoop(sessionId);
    return;
  }

  const map = MapLoader.fromJSON(session.map);

  // 2. Consume inputs (single Redis pipeline)
  const inputs = await consumeInputs(sessionId, session.playerOrder);

  // 3. Apply physics (movement + kill + task + vent)
  applyTick(session, map, inputs);

  // 4. Update room names for all players
  for (const id of session.playerOrder) {
    const p = session.players[id];
    p.currentRoom = map.getRoomAt(p.position.x, p.position.y);
  }

  // 5. Increment tick counter
  session.tickCount += 1;

  // 6. Check win condition
  const winner = checkWinCondition(session);
  if (winner) {
    session.phase = PHASE.END;
    await saveSession(session);
    const finalBuffer = renderFrame(session);
    await editGameMessage(channelId, messageId, finalBuffer, session, true);
    await announceWin(channelId, winner, session);
    stopLoop(sessionId);
    return;
  }

  // 7. Save updated session
  await saveSession(session);

  // 8. Render and edit Discord message
  const pngBuffer = renderFrame(session);
  await editGameMessage(channelId, messageId, pngBuffer, session, false);
}

// ─── Discord helpers ──────────────────────────────────────────────────────────

async function editGameMessage(channelId, messageId, pngBuffer, session, gameOver) {
  const client  = getDiscordClient();
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const attachment = new AttachmentBuilder(pngBuffer, { name: 'frame.png' });
  await message.edit({
    files:      [attachment],
    components: gameOver ? [] : buildMovementRows(),
  });
}

async function announceWin(channelId, winner, session) {
  const client  = getDiscordClient();
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const impostors = session.playerOrder
    .filter(id => session.players[id].role === 'impostor')
    .map(id => `**${session.players[id].username}**`)
    .join(', ');

  const msg = winner === 'crewmate'
    ? `🚀 **Crewmates Win!** All tasks complete or impostors eliminated.\n🔪 The impostor(s) were: ${impostors}`
    : `🔪 **Impostors Win!** The crew was overpowered.\n😈 The impostor(s) were: ${impostors}`;

  await channel.send(msg).catch(() => {});
}

async function sendRoleNotifications(session) {
  const client = getDiscordClient();
  for (const id of session.playerOrder) {
    const p = session.players[id];
    try {
      const user = await client.users.fetch(id);
      if (p.role === 'impostor') {
        await user.send(
          `🔪 **You are an IMPOSTOR** in ${session.map.name}!\n` +
          `Use the **🔪 Kill** button next to a crewmate to eliminate them.\n` +
          `Use the **🌀 Vent** button when standing on a green vent tile to teleport.`
        );
      } else {
        await user.send(
          `🚀 **You are a CREWMATE** in ${session.map.name}!\n` +
          `Walk to gold ✦ task tiles and press **✅ Task** to complete them.\n` +
          `Complete all ${session.taskTotal} tasks or eliminate the impostor to win!`
        );
      }
    } catch {
      // DMs may be disabled — not fatal
    }
  }
}

// ─── Button rows ──────────────────────────────────────────────────────────────

function buildMovementRows() {
  const blank = () => new ButtonBuilder()
    .setCustomId(`blank_${Math.random().toString(36).slice(2)}`)
    .setLabel('\u200b')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const row1 = new ActionRowBuilder().addComponents(
    blank(),
    new ButtonBuilder().setCustomId('move_up').setEmoji('⬆️').setStyle(ButtonStyle.Secondary),
    blank()
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('move_left').setEmoji('⬅️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('move_down').setEmoji('⬇️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('move_right').setEmoji('➡️').setStyle(ButtonStyle.Secondary)
  );

  // Action row: Kill (impostor), Task (crewmate), Vent (impostor)
  // All buttons are always shown; server validates eligibility each tick
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('action_kill').setEmoji('🔪').setLabel('Kill').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('action_task').setEmoji('✅').setLabel('Task').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('action_vent').setEmoji('🌀').setLabel('Vent').setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2, row3];
}

module.exports = {
  startLoop,
  stopLoop,
  isLoopRunning,
  runTick,
  buildMovementRowsPublic: buildMovementRows,
};
