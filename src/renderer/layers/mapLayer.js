'use strict';

const { TILE, TILE_SIZE, TILE_COLORS } = require('../../constants');

/**
 * Renders the static map layer onto `ctx`.
 *
 * Drawing order:
 *  1. Fill entire canvas area with wall colour
 *  2. For each non-wall tile: floor fill + grid stroke
 *  3. Special tile overlays (TASK, VENT, SPAWN)
 *  4. Room labels centred in each room bounding box
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} mapData  - plain map JSON (not MapLoader; renderer gets raw JSON)
 */
function drawMapLayer(ctx, mapData) {
  const { width, height, grid, rooms } = mapData;
  const S = TILE_SIZE;

  // 1. Background (walls)
  ctx.fillStyle = TILE_COLORS.WALL;
  ctx.fillRect(0, 0, width * S, height * S);

  // 2. Floor tiles + grid lines
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile === TILE.WALL) continue;

      const px = x * S;
      const py = y * S;

      // Floor fill
      ctx.fillStyle = TILE_COLORS.FLOOR_FILL;
      ctx.fillRect(px, py, S, S);

      // Subtle grid line
      ctx.strokeStyle = TILE_COLORS.FLOOR_GRID;
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(px + 0.25, py + 0.25, S - 0.5, S - 0.5);

      // Tile-specific overlays
      if      (tile === TILE.TASK)  drawTaskOverlay(ctx, px, py, S);
      else if (tile === TILE.VENT)  drawVentOverlay(ctx, px, py, S);
      else if (tile === TILE.SPAWN) drawSpawnOverlay(ctx, px, py, S);
    }
  }

  // 4. Room labels
  for (const room of rooms) {
    const cx = (room.x + room.w / 2) * S;
    const cy = (room.y + room.h / 2) * S;
    drawRoomLabel(ctx, room.name, cx, cy, S);
  }
}

// ─── Tile overlays ────────────────────────────────────────────────────────────

function drawTaskOverlay(ctx, px, py, S) {
  const cx = px + S / 2;
  const cy = py + S / 2;
  const r  = S * 0.38;

  // Gold ring
  ctx.strokeStyle = TILE_COLORS.TASK_RING;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // ✦ glyph
  ctx.fillStyle  = TILE_COLORS.TASK_GLYPH;
  ctx.font       = `bold ${Math.round(S * 0.42)}px monospace`;
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', cx, cy + 1);
}

function drawVentOverlay(ctx, px, py, S) {
  // Green border
  ctx.strokeStyle = TILE_COLORS.VENT_BORDER;
  ctx.lineWidth   = 2;
  ctx.strokeRect(px + 2, py + 2, S - 4, S - 4);

  // Horizontal grate bars
  ctx.strokeStyle = TILE_COLORS.VENT_BAR;
  ctx.lineWidth   = 1.5;
  const bars    = 3;
  const spacing = (S - 8) / (bars + 1);
  for (let i = 1; i <= bars; i++) {
    const barY = py + 4 + spacing * i;
    ctx.beginPath();
    ctx.moveTo(px + 5, barY);
    ctx.lineTo(px + S - 5, barY);
    ctx.stroke();
  }
}

function drawSpawnOverlay(ctx, px, py, S) {
  const cx = px + S / 2;
  const cy = py + S / 2;
  const r  = S * 0.45;

  const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
  grad.addColorStop(0, 'rgba(58, 123, 213, 0.35)');
  grad.addColorStop(1, 'rgba(58, 123, 213, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Room labels ──────────────────────────────────────────────────────────────

function drawRoomLabel(ctx, name, cx, cy, S) {
  const fontSize = Math.max(10, Math.round(S * 0.28));
  ctx.font        = `600 ${fontSize}px sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(name, cx + 1, cy + 1);

  // Label text
  ctx.fillStyle = TILE_COLORS.ROOM_LABEL;
  ctx.fillText(name, cx, cy);
}

module.exports = { drawMapLayer };
