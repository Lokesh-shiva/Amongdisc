'use strict';

// ─── Tile Types ─────────────────────────────────────────────────────────────
const TILE = {
  WALL:  0,
  FLOOR: 1,
  TASK:  2,
  VENT:  3,
  SPAWN: 4,
};

// ─── Rendering Dimensions ───────────────────────────────────────────────────
const TILE_SIZE  = 36;  // pixels per tile
const HUD_HEIGHT = 96;  // pixels for the bottom HUD bar (increased for task bar)

// ─── Colours ────────────────────────────────────────────────────────────────
const TILE_COLORS = {
  WALL:        '#05050f',
  FLOOR_FILL:  '#0d1b2a',
  FLOOR_GRID:  '#1a2a3a',
  TASK_RING:   '#f5c518',
  TASK_GLYPH:  '#ffe066',
  TASK_DONE:   '#2ecc71',   // completed task overlay tint
  VENT_BAR:    '#2ecc71',
  VENT_BORDER: '#27ae60',
  SPAWN_GLOW:  '#3a7bd5',
  ROOM_LABEL:  'rgba(255,255,255,0.35)',
  BODY_FILL:   'rgba(180,0,0,0.7)',
};

const HUD_COLORS = {
  BG:               'rgba(8,12,22,0.96)',
  BORDER:           '#2a3a5a',
  TEXT_PRIMARY:     '#e8eaf6',
  TEXT_SECONDARY:   '#7986cb',
  PHASE_LOBBY:      '#43a047',
  PHASE_GAME:       '#1e88e5',
  PHASE_MEETING:    '#fb8c00',
  PHASE_END:        '#e53935',
  TASK_BAR_BG:      '#1a2a3a',
  TASK_BAR_FILL:    '#43a047',
  TASK_BAR_DONE:    '#00e676',
};

// ─── Player Colour Palette ───────────────────────────────────────────────────
const PLAYER_COLORS = [
  { name: 'Red',    hex: '#c51111', dark: '#7a0a0a' },
  { name: 'Blue',   hex: '#132ed1', dark: '#0a1a80' },
  { name: 'Green',  hex: '#117f2d', dark: '#0a4d1c' },
  { name: 'Pink',   hex: '#ed54ba', dark: '#9c2870' },
  { name: 'Orange', hex: '#ef7d0d', dark: '#8c4800' },
  { name: 'Yellow', hex: '#f5f557', dark: '#9c9c00' },
  { name: 'Black',  hex: '#3f474e', dark: '#1a1e22' },
  { name: 'White',  hex: '#d6e0f0', dark: '#8a9bbf' },
  { name: 'Purple', hex: '#6b2fbb', dark: '#3d1870' },
  { name: 'Cyan',   hex: '#38fedc', dark: '#1a8c78' },
];

// ─── Game Phases ─────────────────────────────────────────────────────────────
const PHASE = {
  LOBBY:   'lobby',
  GAME:    'game',
  MEETING: 'meeting',
  END:     'end',
};

// ─── Movement Deltas ─────────────────────────────────────────────────────────
const DIR_DELTA = {
  up:    { dx:  0, dy: -1 },
  down:  { dx:  0, dy:  1 },
  left:  { dx: -1, dy:  0 },
  right: { dx:  1, dy:  0 },
};

// ─── Input Queue ─────────────────────────────────────────────────────────────
const MAX_INPUT_QUEUE = 3;  // max buffered inputs per player per tick
const INPUT_TTL_S     = 60;

// ─── Session ─────────────────────────────────────────────────────────────────
const SESSION_TTL_S = 3600;

// ─── Kill System ─────────────────────────────────────────────────────────────
const KILL_COOLDOWN_TICKS  = 10;  // ticks before impostor can kill again (~20s)
const KILL_RANGE           = 1;   // Chebyshev distance (adjacent tiles + diagonals)
const INITIAL_KILL_COOLDOWN = 5;  // first kill cooldown on game start

// ─── Impostor Assignment ─────────────────────────────────────────────────────
const IMPOSTOR_RATIO = 5;  // 1 impostor per this many players (min 1)

module.exports = {
  TILE,
  TILE_SIZE,
  HUD_HEIGHT,
  TILE_COLORS,
  HUD_COLORS,
  PLAYER_COLORS,
  PHASE,
  DIR_DELTA,
  MAX_INPUT_QUEUE,
  INPUT_TTL_S,
  SESSION_TTL_S,
  KILL_COOLDOWN_TICKS,
  KILL_RANGE,
  INITIAL_KILL_COOLDOWN,
  IMPOSTOR_RATIO,
};
