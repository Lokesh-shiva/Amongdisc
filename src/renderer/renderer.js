'use strict';

const path                    = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { TILE_SIZE, HUD_HEIGHT, TILE_COLORS, TILE } = require('../constants');
const { drawBodiesLayer }     = require('./layers/mapLayer');
const { drawPlayerLayer }     = require('./layers/playerLayer');
const { drawUILayer }         = require('./layers/uiLayer');

// Path to the user-supplied map background image
const MAP_IMAGE_PATH = path.join(__dirname, '../maps/data/starbase.png');

// Cache: undefined = not yet attempted, null = load failed, Image = loaded ok
let _mapImage = undefined;

async function loadMapImage() {
  if (_mapImage !== undefined) return _mapImage;
  try {
    _mapImage = await loadImage(MAP_IMAGE_PATH);
    console.log('[Renderer] Map image loaded from', MAP_IMAGE_PATH);
  } catch {
    _mapImage = null;
    console.warn('[Renderer] starbase.png not found — using procedural tile rendering');
  }
  return _mapImage;
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Composites all rendering layers into a PNG buffer.
 * If src/maps/data/starbase.png exists it is used as the map background.
 * Otherwise falls back to procedural tile rendering.
 *
 * Layer order:
 *   1. Map background  (image OR procedural tiles)
 *   2. Task overlays   (gold ring = pending, green ✓ = done)
 *   3. Dead bodies
 *   4. Players         (ghost trails → dead → alive)
 *   5. HUD
 */
async function renderFrame(session) {
  const { map, players, playerOrder } = session;

  const mapW    = map.width  * TILE_SIZE;
  const mapH    = map.height * TILE_SIZE;
  const canvasW = mapW;
  const canvasH = mapH + HUD_HEIGHT;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext('2d');

  const img = await loadMapImage();

  if (img) {
    // ── Image background ──────────────────────────────────────────────────
    ctx.drawImage(img, 0, 0, mapW, mapH);

    // Task overlays (game state the image can't show)
    drawTaskOverlays(ctx, map, session.tasks || {});

    // Subtle room labels over the image
    drawRoomLabels(ctx, map);
  } else {
    // ── Fallback: procedural tiles ────────────────────────────────────────
    const { drawMapLayer } = require('./layers/mapLayer');
    drawMapLayer(ctx, map);
  }

  // Bodies layer also handles completed task tints
  drawBodiesLayer(ctx, session.bodies || [], session.tasks || {}, map);

  drawPlayerLayer(ctx, players, playerOrder);
  drawUILayer(ctx, session, canvasW, canvasH);

  return canvas.toBuffer('image/png');
}

// ─── Task overlays (drawn on top of image) ────────────────────────────────────

function drawTaskOverlays(ctx, mapData, sessionTasks) {
  const S = TILE_SIZE;

  for (const task of Object.values(sessionTasks)) {
    const px = task.x * S;
    const py = task.y * S;
    const cx = px + S / 2;
    const cy = py + S / 2;
    const r  = S * 0.38;

    if (task.completed) {
      // Green tint + checkmark
      ctx.fillStyle = 'rgba(46, 204, 113, 0.22)';
      ctx.fillRect(px, py, S, S);

      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle    = '#00e676';
      ctx.font         = `bold ${Math.round(S * 0.42)}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', cx, cy + 1);
    } else {
      // Pulsing gold ring so players know where to stand
      ctx.strokeStyle = 'rgba(245, 197, 24, 0.80)';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle    = 'rgba(255, 224, 102, 0.70)';
      ctx.font         = `bold ${Math.round(S * 0.36)}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✦', cx, cy + 1);
    }
  }
}

// ─── Room labels over image ───────────────────────────────────────────────────

function drawRoomLabels(ctx, mapData) {
  const S = TILE_SIZE;
  for (const room of mapData.rooms) {
    const cx = (room.x + room.w / 2) * S;
    const cy = (room.y + room.h / 2) * S;

    const fontSize = Math.max(10, Math.round(S * 0.26));
    ctx.font         = `600 ${fontSize}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.70)';
    ctx.fillText(room.name, cx + 1, cy + 1);

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(room.name, cx, cy);
  }
}

module.exports = { renderFrame };
