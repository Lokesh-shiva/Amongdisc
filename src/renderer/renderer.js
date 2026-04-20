'use strict';

const { createCanvas }    = require('@napi-rs/canvas');
const { TILE_SIZE, HUD_HEIGHT } = require('../constants');
const { drawMapLayer, drawBodiesLayer } = require('./layers/mapLayer');
const { drawPlayerLayer } = require('./layers/playerLayer');
const { drawUILayer }     = require('./layers/uiLayer');

/**
 * Composites all rendering layers into a single PNG buffer.
 *
 * Layer order:
 *   1. Map tiles (floor, task, vent, spawn overlays, room labels)
 *   2. Dead bodies + completed task tints
 *   3. Players (ghost trails → dead sprites → alive sprites)
 *   4. HUD (roster, phase pill, task bar, tick counter)
 */
function renderFrame(session) {
  const { map, players, playerOrder } = session;

  const canvasW = map.width  * TILE_SIZE;
  const canvasH = map.height * TILE_SIZE + HUD_HEIGHT;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext('2d');

  drawMapLayer(ctx, map);
  drawBodiesLayer(ctx, session.bodies || [], session.tasks || {}, map);
  drawPlayerLayer(ctx, players, playerOrder);
  drawUILayer(ctx, session, canvasW, canvasH);

  return canvas.toBuffer('image/png');
}

module.exports = { renderFrame };
