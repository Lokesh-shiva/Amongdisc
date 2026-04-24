'use strict';

const { TILE_SIZE, PLAYER_COLORS } = require('../../constants');

// Sprite geometry constants (all relative to TILE_SIZE)
const HEAD_R   = Math.round(TILE_SIZE * 0.39);  // increased
const BODY_RX  = Math.round(TILE_SIZE * 0.42);  // increased
const BODY_RY  = Math.round(TILE_SIZE * 0.33);  // increased
const GHOST_R  = Math.round(TILE_SIZE * 0.30);  // increased

// Among-Us body: head sits on top of a squarish torso
// Head center offset from tile center:  -HEAD_R * 0.6 upward
// Body center offset:                   +HEAD_R * 0.45 downward
const HEAD_DY  =  -(HEAD_R * 0.55);
const BODY_DY  =    HEAD_R * 0.55;

// ─── Public entry point ───────────────────────────────────────────────────────

function drawPlayerLayer(ctx, players, playerOrder) {
  // Pass 1: ghost trails (drawn under everything)
  for (const id of playerOrder) {
    const p = players[id];
    if (p.lastPosition) drawGhostTrail(ctx, p);
  }

  // Pass 2: dead players first so alive ones render on top
  for (const id of playerOrder) {
    const p = players[id];
    if (!p.alive) drawDeadSprite(ctx, p);
  }

  // Pass 3: alive players
  for (const id of playerOrder) {
    const p = players[id];
    if (p.alive) drawAliveSprite(ctx, p);
  }
}

// ─── Ghost Trail ─────────────────────────────────────────────────────────────

function drawGhostTrail(ctx, player) {
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
  const cx    = player.lastPosition.x * TILE_SIZE + TILE_SIZE / 2;
  const cy    = player.lastPosition.y * TILE_SIZE + TILE_SIZE / 2;

  ctx.globalAlpha = 0.22;
  ctx.fillStyle   = color.hex;
  ctx.beginPath();
  ctx.arc(cx, cy, GHOST_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ─── Alive Sprite (Among-Us bean style) ───────────────────────────────────────

function drawAliveSprite(ctx, player) {
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
  const cx    = player.position.x * TILE_SIZE + TILE_SIZE / 2;
  const cy    = player.position.y * TILE_SIZE + TILE_SIZE / 2;

  const headCX = cx;
  const headCY = cy + HEAD_DY;
  const bodyCX = cx;
  const bodyCY = cy + BODY_DY;

  // ── Drop shadow ──────────────────────────────────────────────────────────
  ctx.globalAlpha = 0.30;
  ctx.fillStyle   = '#000';
  ctx.beginPath();
  ctx.ellipse(cx + 2, bodyCY + 3, BODY_RX, BODY_RY * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Body (torso) ─────────────────────────────────────────────────────────
  ctx.fillStyle = color.hex;
  ctx.beginPath();
  ctx.ellipse(bodyCX, bodyCY, BODY_RX, BODY_RY, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body shading gradient
  const bodyGrad = ctx.createLinearGradient(
    bodyCX - BODY_RX, bodyCY - BODY_RY,
    bodyCX + BODY_RX, bodyCY + BODY_RY
  );
  bodyGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
  bodyGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(bodyCX, bodyCY, BODY_RX, BODY_RY, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body outline
  ctx.strokeStyle = color.dark;
  ctx.lineWidth   = 1.2;
  ctx.beginPath();
  ctx.ellipse(bodyCX, bodyCY, BODY_RX, BODY_RY, 0, 0, Math.PI * 2);
  ctx.stroke();

  // ── Head ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = color.hex;
  ctx.beginPath();
  ctx.arc(headCX, headCY, HEAD_R, 0, Math.PI * 2);
  ctx.fill();

  // ── Visor (clipped to head circle) ───────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(headCX, headCY, HEAD_R, 0, Math.PI * 2);
  ctx.clip();

  // Dark visor band — covers top ~60% of head
  ctx.fillStyle = 'rgba(12, 22, 45, 0.88)';
  ctx.fillRect(
    headCX - HEAD_R,
    headCY - HEAD_R,
    HEAD_R * 2,
    HEAD_R * 1.35
  );

  // Visor glare — small bright oval in upper-left
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.beginPath();
  ctx.ellipse(
    headCX - HEAD_R * 0.22,
    headCY - HEAD_R * 0.38,
    HEAD_R * 0.30,
    HEAD_R * 0.16,
    -0.4,
    0, Math.PI * 2
  );
  ctx.fill();

  ctx.restore();

  // Head outline
  ctx.strokeStyle = color.dark;
  ctx.lineWidth   = 1.2;
  ctx.beginPath();
  ctx.arc(headCX, headCY, HEAD_R, 0, Math.PI * 2);
  ctx.stroke();

  // ── Player initial on body ────────────────────────────────────────────────
  const initial = (player.username || '?')[0].toUpperCase();
  ctx.fillStyle    = 'rgba(255,255,255,0.92)';
  ctx.font         = `bold ${Math.round(BODY_RY * 1.1)}px monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, bodyCX, bodyCY + 1);
}

// ─── Dead Sprite ──────────────────────────────────────────────────────────────

function drawDeadSprite(ctx, player) {
  const cx = player.position.x * TILE_SIZE + TILE_SIZE / 2;
  const cy = player.position.y * TILE_SIZE + TILE_SIZE / 2;

  // Faded grey ghost-like circle
  ctx.globalAlpha = 0.38;
  ctx.fillStyle   = '#8090a0';
  ctx.beginPath();
  ctx.arc(cx, cy, HEAD_R + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Red × skull mark
  const arm = HEAD_R * 0.7;
  ctx.strokeStyle = '#ff1744';
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
