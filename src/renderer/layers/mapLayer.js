'use strict';

const { TILE, TILE_SIZE, TILE_COLORS, PLAYER_COLORS } = require('../../constants');

// ─── Map Layer ────────────────────────────────────────────────────────────────

function drawMapLayer(ctx, mapData) {
  const { width, height, grid, rooms, tasks } = mapData;
  const S = TILE_SIZE;

  // Completed task IDs for dimmed overlay
  const completedTaskXY = new Set();
  if (tasks) {
    for (const t of tasks) completedTaskXY.add(`${t.x},${t.y}`);
  }

  // 1. Wall background
  ctx.fillStyle = TILE_COLORS.WALL;
  ctx.fillRect(0, 0, width * S, height * S);

  // 2. Floor tiles
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile === TILE.WALL) continue;

      const px = x * S;
      const py = y * S;

      ctx.fillStyle = TILE_COLORS.FLOOR_FILL;
      ctx.fillRect(px, py, S, S);

      ctx.strokeStyle = TILE_COLORS.FLOOR_GRID;
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(px + 0.25, py + 0.25, S - 0.5, S - 0.5);

      if      (tile === TILE.TASK)  drawTaskOverlay(ctx, px, py, S);
      else if (tile === TILE.VENT)  drawVentOverlay(ctx, px, py, S);
      else if (tile === TILE.SPAWN) drawSpawnOverlay(ctx, px, py, S);
    }
  }

  // 3. Room labels
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

  ctx.strokeStyle = TILE_COLORS.TASK_RING;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle    = TILE_COLORS.TASK_GLYPH;
  ctx.font         = `bold ${Math.round(S * 0.42)}px monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', cx, cy + 1);
}

function drawCompletedTaskOverlay(ctx, px, py, S) {
  // Green checkmark tint over completed task tiles
  ctx.fillStyle = 'rgba(46, 204, 113, 0.18)';
  ctx.fillRect(px, py, S, S);

  const cx = px + S / 2;
  const cy = py + S / 2;
  const r  = S * 0.38;

  ctx.strokeStyle = TILE_COLORS.TASK_DONE;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle    = TILE_COLORS.TASK_DONE;
  ctx.font         = `bold ${Math.round(S * 0.42)}px monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓', cx, cy + 1);
}

function drawVentOverlay(ctx, px, py, S) {
  ctx.strokeStyle = TILE_COLORS.VENT_BORDER;
  ctx.lineWidth   = 2;
  ctx.strokeRect(px + 2, py + 2, S - 4, S - 4);

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
  const cx   = px + S / 2;
  const cy   = py + S / 2;
  const r    = S * 0.45;
  const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
  grad.addColorStop(0, 'rgba(58, 123, 213, 0.35)');
  grad.addColorStop(1, 'rgba(58, 123, 213, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoomLabel(ctx, name, cx, cy, S) {
  const fontSize = Math.max(10, Math.round(S * 0.28));
  ctx.font         = `600 ${fontSize}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(0,0,0,0.6)';
  ctx.fillText(name, cx + 1, cy + 1);
  ctx.fillStyle    = TILE_COLORS.ROOM_LABEL;
  ctx.fillText(name, cx, cy);
}

// ─── Dead Bodies Layer ────────────────────────────────────────────────────────

/**
 * Renders dead body markers between the map and player layers.
 * Bodies appear as flat coloured ovals with a white × — distinct
 * from the standing dead-player sprite in playerLayer.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object[]} bodies  - [{ x, y, colorIndex, username }]
 * @param {object}   sessionTasks  - session.tasks (to show completed task tints)
 * @param {object}   mapData
 */
function drawBodiesLayer(ctx, bodies, sessionTasks, mapData) {
  // First: re-render completed task overlays (green tint replaces gold)
  if (sessionTasks) {
    const S = TILE_SIZE;
    const offX = mapData.taskOffsetX || 0;
    const offY = mapData.taskOffsetY || 0;
    for (const task of Object.values(sessionTasks)) {
      if (!task.completed) continue;
      const px = task.x * S + offX;
      const py = task.y * S + offY;
      drawCompletedTaskOverlay(ctx, px, py, S);
    }
  }

  // Then: draw each dead body
  for (const body of (bodies || [])) {
    drawDeadBody(ctx, body);
  }
}

function drawDeadBody(ctx, body) {
  const color = PLAYER_COLORS[body.colorIndex % PLAYER_COLORS.length];
  const cx    = body.x * TILE_SIZE + TILE_SIZE / 2;
  const cy    = body.y * TILE_SIZE + TILE_SIZE / 2 + 4; // slightly below tile center
  const rw    = TILE_SIZE * 0.42;
  const rh    = TILE_SIZE * 0.20;

  // Blood pool
  ctx.fillStyle = 'rgba(160, 0, 0, 0.8)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 3, rw * 1.4, rh * 1.6, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Coloured flat oval
  ctx.globalAlpha = 1.0;
  ctx.fillStyle   = color.hex;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dark outline
  ctx.strokeStyle = color.dark;
  ctx.lineWidth   = 2.0;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // White ×
  const arm = rw * 0.38;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy - arm * 0.6);
  ctx.lineTo(cx + arm, cy + arm * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + arm, cy - arm * 0.6);
  ctx.lineTo(cx - arm, cy + arm * 0.6);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawKillFlash(ctx, x, y) {
  const cx = x * TILE_SIZE + TILE_SIZE / 2;
  const cy = y * TILE_SIZE + TILE_SIZE / 2;
  const S = TILE_SIZE;
  
  // Blood splatter / flash effect
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, S);
  grad.addColorStop(0, 'rgba(255, 0, 0, 0.9)');
  grad.addColorStop(0.4, 'rgba(255, 0, 0, 0.6)');
  grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, S, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff1744';
  ctx.font = `bold ${Math.round(S * 0.5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Text shadow
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.fillText('KILL!', cx, cy - S * 0.6);
  ctx.shadowBlur = 0; // reset
}

module.exports = { drawMapLayer, drawBodiesLayer, drawKillFlash };
