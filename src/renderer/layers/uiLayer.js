'use strict';

const { TILE_SIZE, HUD_HEIGHT, HUD_COLORS, PLAYER_COLORS, PHASE } = require('../../constants');

const PHASE_PILLS = {
  [PHASE.LOBBY]:   { color: HUD_COLORS.PHASE_LOBBY,   label: '◉ LOBBY'   },
  [PHASE.GAME]:    { color: HUD_COLORS.PHASE_GAME,    label: '▶ IN GAME'  },
  [PHASE.MEETING]: { color: HUD_COLORS.PHASE_MEETING, label: '⚑ MEETING' },
  [PHASE.END]:     { color: HUD_COLORS.PHASE_END,     label: '■ ENDED'   },
};

function drawUILayer(ctx, session, canvasW, canvasH) {
  const hudY = canvasH - HUD_HEIGHT;

  // Background
  ctx.fillStyle = HUD_COLORS.BG;
  ctx.fillRect(0, hudY, canvasW, HUD_HEIGHT);

  // Top border
  ctx.strokeStyle = HUD_COLORS.BORDER;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, hudY);
  ctx.lineTo(canvasW, hudY);
  ctx.stroke();

  // Divider between left roster and right panel
  const rightPanelW = 162;
  const divX        = canvasW - rightPanelW;
  ctx.strokeStyle   = HUD_COLORS.BORDER;
  ctx.lineWidth     = 1;
  ctx.beginPath();
  ctx.moveTo(divX, hudY + 6);
  ctx.lineTo(divX, hudY + HUD_HEIGHT - 6);
  ctx.stroke();

  drawPlayerRoster(ctx, session, hudY, canvasW, rightPanelW);
  drawRightPanel(ctx, session, canvasW, hudY, rightPanelW);
}

// ─── Player Roster ────────────────────────────────────────────────────────────

const ROSTER_PAD   = 8;
const COL_W        = 100;
const DOT_R        = 7;

function drawPlayerRoster(ctx, session, hudY, canvasW, rightPanelW) {
  const { players, playerOrder } = session;
  const availW  = canvasW - rightPanelW - ROSTER_PAD * 2;
  const maxCols = Math.max(1, Math.floor(availW / COL_W));
  const count   = Math.min(playerOrder.length, 10);

  for (let i = 0; i < count; i++) {
    const id     = playerOrder[i];
    const player = players[id];
    const col    = i % maxCols;
    const row    = Math.floor(i / maxCols);
    const colX   = ROSTER_PAD + col * COL_W;
    const rowY   = hudY + ROSTER_PAD + row * 45;
    drawPlayerEntry(ctx, player, colX, rowY);
  }
}

function drawPlayerEntry(ctx, player, x, y) {
  const color  = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
  const dotCX  = x + DOT_R + 2;
  const dotCY  = y + 9;

  if (player.alive) {
    ctx.fillStyle = color.hex;
    ctx.beginPath();
    ctx.arc(dotCX, dotCY, DOT_R, 0, Math.PI * 2);
    ctx.fill();

    // Thin dark outline on dot
    ctx.strokeStyle = color.dark;
    ctx.lineWidth   = 1;
    ctx.stroke();
  } else {
    // Greyed out dot
    ctx.fillStyle = '#506070';
    ctx.beginPath();
    ctx.arc(dotCX, dotCY, DOT_R, 0, Math.PI * 2);
    ctx.fill();

    // Red ×
    const arm = DOT_R * 0.6;
    ctx.strokeStyle = '#ff1744';
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

  const nameX = dotCX + DOT_R + 6;
  const name  = (player.username || '').slice(0, 10);

  ctx.fillStyle    = player.alive ? HUD_COLORS.TEXT_PRIMARY : '#607080';
  ctx.font         = 'bold 13px sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, nameX, y + 9);

  const room = player.currentRoom || 'Corridor';
  ctx.fillStyle = HUD_COLORS.TEXT_SECONDARY;
  ctx.font      = '11px sans-serif';
  ctx.fillText(room.slice(0, 14), nameX, y + 25);
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function drawRightPanel(ctx, session, canvasW, hudY, rightPanelW) {
  const panelX = canvasW - rightPanelW + 6;
  const panelW = rightPanelW - 14;

  // Phase pill
  const pill = PHASE_PILLS[session.phase] || PHASE_PILLS[PHASE.LOBBY];
  drawPhasePill(ctx, pill, panelX, hudY + 5, panelW);

  // Task progress bar (only during game)
  if (session.phase === PHASE.GAME || session.phase === PHASE.END) {
    drawTaskBar(ctx, session, panelX, hudY + 31, panelW);
  }

  // TICK label
  ctx.fillStyle    = HUD_COLORS.TEXT_SECONDARY;
  ctx.font         = 'bold 9px monospace';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('TICK', canvasW - 8, hudY + 50);

  // Large tick number
  ctx.fillStyle    = HUD_COLORS.TEXT_PRIMARY;
  ctx.font         = 'bold 24px monospace';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`#${session.tickCount}`, canvasW - 8, hudY + 58);

  // Map name
  ctx.fillStyle    = HUD_COLORS.TEXT_SECONDARY;
  ctx.font         = '9px sans-serif';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(session.map.name || 'Unknown Map', canvasW - 8, hudY + HUD_HEIGHT - 4);
}

function drawPhasePill(ctx, pill, x, y, w) {
  const h = 20;
  const r = h / 2;

  ctx.fillStyle = pill.color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle    = '#ffffff';
  ctx.font         = 'bold 10px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pill.label, x + w / 2, y + r);
}

function drawTaskBar(ctx, session, x, y, w) {
  const total  = session.taskTotal    || 0;
  const done   = session.taskCompleted || 0;
  if (total === 0) return;

  const ratio  = Math.min(1, done / total);
  const barH   = 8;
  const isDone = done >= total;

  // Track background
  ctx.fillStyle = HUD_COLORS.TASK_BAR_BG;
  roundRect(ctx, x, y, w, barH, 3);
  ctx.fill();

  // Fill
  if (ratio > 0) {
    ctx.fillStyle = isDone ? HUD_COLORS.TASK_BAR_DONE : HUD_COLORS.TASK_BAR_FILL;
    roundRect(ctx, x, y, Math.round(w * ratio), barH, 3);
    ctx.fill();
  }

  // Label
  const label = isDone ? `TASKS ✓ ${done}/${total}` : `TASKS  ${done}/${total}`;
  ctx.fillStyle    = isDone ? HUD_COLORS.TASK_BAR_DONE : HUD_COLORS.TEXT_SECONDARY;
  ctx.font         = '9px sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y + barH + 2);
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
  ctx.closePath();
}

module.exports = { drawUILayer };
