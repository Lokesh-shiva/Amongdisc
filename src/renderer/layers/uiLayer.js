'use strict';

const { TILE_SIZE, HUD_HEIGHT, HUD_COLORS, PLAYER_COLORS, PHASE } = require('../../constants');

const PHASE_PILLS = {
  [PHASE.LOBBY]:   { color: HUD_COLORS.PHASE_LOBBY,   label: '◉ LOBBY'   },
  [PHASE.GAME]:    { color: HUD_COLORS.PHASE_GAME,    label: '▶ IN GAME'  },
  [PHASE.MEETING]: { color: HUD_COLORS.PHASE_MEETING, label: '⚑ MEETING' },
  [PHASE.END]:     { color: HUD_COLORS.PHASE_END,     label: '■ ENDED'   },
};

/**
 * Renders the HUD bar at the bottom of the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} session  - full session object
 * @param {number} canvasW  - total canvas width
 * @param {number} canvasH  - total canvas height (map area + HUD)
 */
function drawUILayer(ctx, session, canvasW, canvasH) {
  const hudY = canvasH - HUD_HEIGHT;

  // ── Background bar ────────────────────────────────────────────────────────
  ctx.fillStyle = HUD_COLORS.BG;
  ctx.fillRect(0, hudY, canvasW, HUD_HEIGHT);

  // Top border
  ctx.strokeStyle = HUD_COLORS.BORDER;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, hudY);
  ctx.lineTo(canvasW, hudY);
  ctx.stroke();

  // ── Left panel — player roster ────────────────────────────────────────────
  drawPlayerRoster(ctx, session, hudY, canvasW);

  // ── Right panel — phase pill + tick + map name ────────────────────────────
  drawRightPanel(ctx, session, canvasW, hudY);
}

// ─── Player Roster ────────────────────────────────────────────────────────────

const ROSTER_PADDING    = 8;
const ROSTER_COL_WIDTH  = 80;  // px per player column
const DOT_RADIUS        = 6;
const USERNAME_FONT     = '11px sans-serif';
const ROOM_FONT         = '10px sans-serif';

function drawPlayerRoster(ctx, session, hudY, canvasW) {
  const { players, playerOrder } = session;
  const rightPanelW = 160;
  const maxCols     = Math.floor((canvasW - rightPanelW - ROSTER_PADDING * 2) / ROSTER_COL_WIDTH);
  const count       = Math.min(playerOrder.length, 10);

  for (let i = 0; i < count; i++) {
    const id     = playerOrder[i];
    const player = players[id];
    const col    = i % maxCols;
    const row    = Math.floor(i / maxCols);

    const colX = ROSTER_PADDING + col * ROSTER_COL_WIDTH;
    const rowY = hudY + ROSTER_PADDING + row * 42;

    drawPlayerEntry(ctx, player, colX, rowY);
  }
}

function drawPlayerEntry(ctx, player, x, y) {
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
  const dotCX = x + DOT_RADIUS + 2;
  const dotCY = y + 10;

  if (player.alive) {
    // Coloured dot
    ctx.fillStyle = color.hex;
    ctx.beginPath();
    ctx.arc(dotCX, dotCY, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Grey dot + red ×
    ctx.fillStyle = '#607080';
    ctx.beginPath();
    ctx.arc(dotCX, dotCY, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    const arm = DOT_RADIUS * 0.6;
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(dotCX - arm, dotCY - arm);
    ctx.lineTo(dotCX + arm, dotCY + arm);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dotCX + arm, dotCY - arm);
    ctx.lineTo(dotCX - arm, dotCY + arm);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // Username (max 9 chars)
  const nameX = dotCX + DOT_RADIUS + 4;
  const name  = (player.username || '').slice(0, 9);
  ctx.fillStyle    = HUD_COLORS.TEXT_PRIMARY;
  ctx.font         = USERNAME_FONT;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, nameX, y + 10);

  // Room name below username
  const room = player.currentRoom || 'Corridor';
  ctx.fillStyle = HUD_COLORS.TEXT_SECONDARY;
  ctx.font      = ROOM_FONT;
  ctx.fillText(room.slice(0, 11), nameX, y + 24);
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function drawRightPanel(ctx, session, canvasW, hudY) {
  const panelW = 150;
  const panelX = canvasW - panelW - 8;

  // Phase pill
  const pill = PHASE_PILLS[session.phase] || PHASE_PILLS[PHASE.LOBBY];
  drawPhasePill(ctx, pill, panelX, hudY + 8, panelW);

  // Tick counter label
  ctx.fillStyle    = HUD_COLORS.TEXT_SECONDARY;
  ctx.font         = 'bold 10px monospace';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('TICK', canvasW - 8, hudY + 34);

  // Large tick number
  ctx.fillStyle    = HUD_COLORS.TEXT_PRIMARY;
  ctx.font         = 'bold 28px monospace';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`#${session.tickCount}`, canvasW - 8, hudY + 44);

  // Map name (bottom right)
  ctx.fillStyle    = HUD_COLORS.TEXT_SECONDARY;
  ctx.font         = '10px sans-serif';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(session.map.name || 'Unknown Map', canvasW - 8, hudY + HUD_HEIGHT - 6);
}

function drawPhasePill(ctx, pill, x, y, w) {
  const h  = 22;
  const r  = h / 2;

  // Pill background
  ctx.fillStyle = pill.color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();

  // Pill label
  ctx.fillStyle    = '#ffffff';
  ctx.font         = 'bold 11px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pill.label, x + w / 2, y + r);
}

module.exports = { drawUILayer };
