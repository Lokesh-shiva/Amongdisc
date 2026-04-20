'use strict';

const { createCanvas }   = require('canvas');
const { TILE_SIZE, HUD_HEIGHT } = require('../constants');
const { drawMapLayer }   = require('./layers/mapLayer');
const { drawPlayerLayer } = require('./layers/playerLayer');
const { drawUILayer }    = require('./layers/uiLayer');

/**
 * Composites all three rendering layers into a single PNG buffer.
 *
 * Canvas layout:
 *   - Width  = map.width  × TILE_SIZE
 *   - Height = map.height × TILE_SIZE + HUD_HEIGHT
 *
 * Layer order:
 *   1. Map  (tiles, markers, room labels)
 *   2. Players (ghost trails then sprites)
 *   3. HUD  (player roster, phase pill, tick counter)
 *
 * @param {object} session - full game session (loaded from Redis / gameManager)
 * @returns {Buffer} PNG image buffer
 */
function renderFrame(session) {
  const { map, players, playerOrder, phase, tickCount } = session;

  const canvasW = map.width  * TILE_SIZE;
  const canvasH = map.height * TILE_SIZE + HUD_HEIGHT;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext('2d');

  // Layer 1 — Map
  drawMapLayer(ctx, map);

  // Layer 2 — Players
  drawPlayerLayer(ctx, players, playerOrder);

  // Layer 3 — HUD
  drawUILayer(ctx, session, canvasW, canvasH);

  return canvas.toBuffer('image/png');
}

module.exports = { renderFrame };
