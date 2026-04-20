'use strict';

const { TILE_SIZE, PLAYER_COLORS } = require('../../constants');

const SPRITE_RADIUS = Math.round(TILE_SIZE * 0.38); // ~14px
const GHOST_RADIUS  = Math.round(TILE_SIZE * 0.28); // ~10px

/**
 * Renders all players onto `ctx` in two passes:
 *  Pass 1 — Ghost trails (faded circle at lastPosition)
 *  Pass 2 — Current sprites (alive = coloured circle; dead = grey + ×)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} players     - { [id]: PlayerObject }
 * @param {string[]} playerOrder
 */
function drawPlayerLayer(ctx, players, playerOrder) {
  // Pass 1: ghost trails
  for (const id of playerOrder) {
    const p = players[id];
    if (!p.lastPosition) continue;
    drawGhostTrail(ctx, p);
  }

  // Pass 2: current sprites
  for (const id of playerOrder) {
    const p = players[id];
    if (p.alive) {
      drawAliveSprite(ctx, p);
    } else {
      drawDeadSprite(ctx, p);
    }
  }
}

// ─── Ghost Trail ─────────────────────────────────────────────────────────────

function drawGhostTrail(ctx, player) {
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
  const cx    = player.lastPosition.x * TILE_SIZE + TILE_SIZE / 2;
  const cy    = player.lastPosition.y * TILE_SIZE + TILE_SIZE / 2;

  ctx.globalAlpha = 0.27;
  ctx.fillStyle   = color.hex;
  ctx.beginPath();
  ctx.arc(cx, cy, GHOST_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ─── Alive Sprite ─────────────────────────────────────────────────────────────

function drawAliveSprite(ctx, player) {
  const color  = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
  const cx     = player.position.x * TILE_SIZE + TILE_SIZE / 2;
  const cy     = player.position.y * TILE_SIZE + TILE_SIZE / 2;
  const r      = SPRITE_RADIUS;

  // Drop shadow
  ctx.globalAlpha = 0.4;
  ctx.fillStyle   = '#000000';
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Main circle
  ctx.fillStyle = color.hex;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Radial highlight (top-left light source)
  const hlX  = cx - r * 0.3;
  const hlY  = cy - r * 0.3;
  const grad = ctx.createRadialGradient(hlX, hlY, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1,    'rgba(0,0,0,0.2)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // White outline
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Initial
  const initial = (player.username || '?')[0].toUpperCase();
  ctx.fillStyle    = '#ffffff';
  ctx.font         = `bold ${Math.round(r * 1.1)}px monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, cx, cy + 1);
}

// ─── Dead Sprite ──────────────────────────────────────────────────────────────

function drawDeadSprite(ctx, player) {
  const cx = player.position.x * TILE_SIZE + TILE_SIZE / 2;
  const cy = player.position.y * TILE_SIZE + TILE_SIZE / 2;
  const r  = SPRITE_RADIUS;

  // Semi-transparent grey circle
  ctx.globalAlpha = 0.5;
  ctx.fillStyle   = '#607080';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Red × — two crossing lines
  const arm = r * 0.6;
  ctx.strokeStyle = '#e53935';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';

  ctx.beginPath();
  ctx.moveTo(cx - arm, cy - arm);
  ctx.lineTo(cx + arm, cy + arm);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + arm, cy - arm);
  ctx.lineTo(cx - arm, cy + arm);
  ctx.stroke();

  ctx.lineCap = 'butt';
}

module.exports = { drawPlayerLayer };
