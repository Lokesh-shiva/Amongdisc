'use strict';

const { AttachmentBuilder }          = require('discord.js');
const { getDiscordClient }           = require('../discord/client');
const { getSession, saveSession, deleteSession } = require('./gameManager');
const { consumeInputs }              = require('./inputHandler');
const { applyTick }                  = require('./physics');
const { MapLoader }                  = require('../maps/mapLoader');
const { renderFrame }                = require('../renderer/renderer');
const { PHASE }                      = require('../constants');

// Map of sessionId → NodeJS.Timeout (interval handle)
const _activeLoops = new Map();

/**
 * Starts the tick loop for a session.
 * Idempotent: calling it twice for the same session replaces the old interval.
 *
 * @param {string} sessionId
 * @param {string} channelId   - Discord channel to fetch the game message from
 * @param {string} messageId   - the single message to edit every tick
 */
function startLoop(sessionId, channelId, messageId) {
  stopLoop(sessionId); // clear any existing handle first

  const tickMs = parseInt(process.env.TICK_INTERVAL_MS || '2000', 10);

  const handle = setInterval(async () => {
    try {
      await runTick(sessionId, channelId, messageId);
    } catch (err) {
      console.error(`[Engine] Tick error for session ${sessionId}:`, err);
    }
  }, tickMs);

  _activeLoops.set(sessionId, handle);
  console.log(`[Engine] Loop started for ${sessionId} (${tickMs}ms)`);
}

/**
 * Stops and removes the tick loop for a session.
 * @param {string} sessionId
 */
function stopLoop(sessionId) {
  const handle = _activeLoops.get(sessionId);
  if (handle) {
    clearInterval(handle);
    _activeLoops.delete(sessionId);
    console.log(`[Engine] Loop stopped for ${sessionId}`);
  }
}

/**
 * Returns true if a loop is currently active for the given session.
 * @param {string} sessionId
 */
function isLoopRunning(sessionId) {
  return _activeLoops.has(sessionId);
}

// ─── Core Tick ───────────────────────────────────────────────────────────────

/**
 * Executes one tick:
 *  1. Load session from Redis
 *  2. Consume all queued player inputs (one Redis pipeline)
 *  3. Apply physics (movement + collision)
 *  4. Update room names for all players
 *  5. Increment tick counter
 *  6. Save updated session to Redis
 *  7. Render new PNG frame
 *  8. Edit the Discord game message
 *
 * @param {string} sessionId
 * @param {string} channelId
 * @param {string} messageId
 */
async function runTick(sessionId, channelId, messageId) {
  // 1. Load session
  const session = await getSession(sessionId);
  if (!session || session.phase !== PHASE.GAME) {
    stopLoop(sessionId);
    return;
  }

  const map = MapLoader.fromJSON(session.map);

  // 2. Consume queued inputs
  const inputs = await consumeInputs(sessionId, session.playerOrder);

  // 3. Apply physics
  applyTick(map, session.players, session.playerOrder, inputs);

  // 4. Update room names
  for (const id of session.playerOrder) {
    const p = session.players[id];
    p.currentRoom = map.getRoomAt(p.position.x, p.position.y);
  }

  // 5. Increment tick
  session.tickCount += 1;

  // 6. Save session
  await saveSession(session);

  // 7. Render frame
  const pngBuffer = renderFrame(session);

  // 8. Edit Discord message
  await editGameMessage(channelId, messageId, pngBuffer, session);
}

// ─── Discord helpers ──────────────────────────────────────────────────────────

async function editGameMessage(channelId, messageId, pngBuffer, session) {
  const client  = getDiscordClient();
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const attachment = new AttachmentBuilder(pngBuffer, { name: 'frame.png' });
  const rows       = buildMovementRows();

  await message.edit({
    files:      [attachment],
    components: rows,
  });
}

function buildMovementRows() {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const up = new ButtonBuilder()
    .setCustomId('move_up')
    .setEmoji('⬆️')
    .setStyle(ButtonStyle.Secondary);

  const down = new ButtonBuilder()
    .setCustomId('move_down')
    .setEmoji('⬇️')
    .setStyle(ButtonStyle.Secondary);

  const left = new ButtonBuilder()
    .setCustomId('move_left')
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary);

  const right = new ButtonBuilder()
    .setCustomId('move_right')
    .setEmoji('➡️')
    .setStyle(ButtonStyle.Secondary);

  // Filler (disabled) for row 1 layout: [_, ⬆️, _]
  const blank = () => new ButtonBuilder()
    .setCustomId(`blank_${Math.random().toString(36).slice(2)}`)
    .setLabel('\u200b') // zero-width space
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const row1 = new ActionRowBuilder().addComponents(blank(), up, blank());
  const row2 = new ActionRowBuilder().addComponents(left, down, right);

  return [row1, row2];
}

module.exports = { startLoop, stopLoop, isLoopRunning, runTick, buildMovementRowsPublic: buildMovementRows };
