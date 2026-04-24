'use strict';

const path                    = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { TILE_SIZE, HUD_HEIGHT, TILE_COLORS, TILE, VIEWPORT_W, VIEWPORT_H, PLAYER_COLORS } = require('../constants');
const { drawBodiesLayer }     = require('./layers/mapLayer');
const { drawPlayerLayer }     = require('./layers/playerLayer');
const { drawUILayer }         = require('./layers/uiLayer');
const { computeViewport }     = require('./viewport');

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

  if (session.transientEvents) {
    const { drawKillFlash } = require('./layers/mapLayer');
    for (const event of session.transientEvents) {
      if (event.type === 'kill') {
        drawKillFlash(ctx, event.x, event.y);
      }
    }
  }

  return canvas.toBuffer('image/png');
}

// ─── Task overlays (drawn on top of image) ────────────────────────────────────

function drawTaskOverlays(ctx, mapData, sessionTasks) {
  const S = TILE_SIZE;
  const offX = mapData.taskOffsetX || 0;
  const offY = mapData.taskOffsetY || 0;

  for (const task of Object.values(sessionTasks)) {
    const px = task.x * S + offX;
    const py = task.y * S + offY;
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

// ─── Minimap overlay ──────────────────────────────────────────────────────────

function drawMinimap(ctx, session, vpX, vpY, vpW, vpH, selfId, canvasW, mapH) {
  const mapData = session.map;
  const MM_W = Math.round(canvasW * 0.20);
  const MM_H = Math.round(MM_W * mapData.height / mapData.width);
  const MM_X = canvasW - MM_W - 8;
  const MM_Y = mapH - MM_H - 8;
  const tileW = MM_W / mapData.width;
  const tileH = MM_H / mapData.height;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.70)';
  ctx.fillRect(MM_X, MM_Y, MM_W, MM_H);

  // Border
  ctx.strokeStyle = '#445566';
  ctx.lineWidth   = 1;
  ctx.strokeRect(MM_X, MM_Y, MM_W, MM_H);

  // Viewport rectangle (white outline showing where we are)
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(
    MM_X + vpX * tileW,
    MM_Y + vpY * tileH,
    vpW * tileW,
    vpH * tileH
  );

  // Player dots — fog of war: only show players within current viewport (always show self)
  for (const id of session.playerOrder) {
    const p = session.players[id];
    const isSelf = id === selfId;
    if (!isSelf) {
      const inVp = p.position.x >= vpX && p.position.x < vpX + vpW &&
                   p.position.y >= vpY && p.position.y < vpY + vpH;
      if (!inVp) continue;
    }
    const dotX  = MM_X + (p.position.x + 0.5) * tileW;
    const dotY  = MM_Y + (p.position.y + 0.5) * tileH;
    const color = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length];
    ctx.fillStyle = isSelf ? '#ffffff' : color.hex;
    ctx.beginPath();
    ctx.arc(dotX, dotY, isSelf ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders a personal viewport for one player.
 * Dead players (ghosts) get the full map via renderFrame.
 * Alive players get a zoomed 9×7-tile crop scaled to the full canvas size.
 *
 * @param {object} session
 * @param {string} playerId
 * @returns {Promise<Buffer>} PNG buffer
 */
async function renderPlayerView(session, playerId) {
  const player = session.players[playerId];

  // Ghosts see the full map
  if (!player || !player.alive) return renderFrame(session);

  const { map, players, playerOrder } = session;
  const vpW = session.viewportW || VIEWPORT_W;
  const vpH = session.viewportH || VIEWPORT_H;

  const mapW    = map.width  * TILE_SIZE;
  const mapH    = map.height * TILE_SIZE;
  const canvasW = mapW;
  const canvasH = mapH + HUD_HEIGHT;

  const { x: vpX, y: vpY } = computeViewport(
    player.position.x, player.position.y,
    map.width, map.height,
    vpW, vpH
  );

  const canvas = createCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext('2d');

  const img = await loadMapImage();

  // ── Draw map background (cropped + scaled up) ─────────────────────────────
  if (img) {
    ctx.drawImage(
      img,
      vpX * TILE_SIZE, vpY * TILE_SIZE, vpW * TILE_SIZE, vpH * TILE_SIZE,
      0, 0, mapW, mapH
    );
  }

  // ── Scale + translate context so existing draw helpers work correctly ──────
  const scaleX = mapW / (vpW * TILE_SIZE);
  const scaleY = mapH / (vpH * TILE_SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, mapW, mapH);
  ctx.clip();
  ctx.scale(scaleX, scaleY);
  ctx.translate(-vpX * TILE_SIZE, -vpY * TILE_SIZE);

  if (img) {
    drawTaskOverlays(ctx, map, session.tasks || {});
  } else {
    const { drawMapLayer } = require('./layers/mapLayer');
    drawMapLayer(ctx, map);
    drawTaskOverlays(ctx, map, session.tasks || {});
  }

  drawBodiesLayer(ctx, session.bodies || [], session.tasks || {}, map);

  // Filter players to those within the viewport only
  const visibleIds = playerOrder.filter(id => {
    if (id === playerId) return true; // always show self
    const p = players[id];
    return p.position.x >= vpX && p.position.x < vpX + vpW &&
           p.position.y >= vpY && p.position.y < vpY + vpH;
  });
  drawPlayerLayer(ctx, players, visibleIds);

  // Kill flash (only if within viewport)
  if (session.transientEvents) {
    const { drawKillFlash } = require('./layers/mapLayer');
    for (const event of session.transientEvents) {
      if (event.type === 'kill') {
        const inVp = event.x >= vpX && event.x < vpX + vpW &&
                     event.y >= vpY && event.y < vpY + vpH;
        if (inVp) drawKillFlash(ctx, event.x, event.y);
      }
    }
  }

  ctx.restore();

  // ── Minimap overlay ───────────────────────────────────────────────────────
  drawMinimap(ctx, session, vpX, vpY, vpW, vpH, playerId, canvasW, mapH);

  // ── HUD ───────────────────────────────────────────────────────────────────
  drawUILayer(ctx, session, canvasW, canvasH);

  return canvas.toBuffer('image/png');
}

module.exports = { renderFrame, renderPlayerView };
