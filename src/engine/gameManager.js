'use strict';

const { getRedisClient } = require('../redis/redisClient');
const {
  PHASE, PLAYER_COLORS, SESSION_TTL_S,
  IMPOSTOR_RATIO, INITIAL_KILL_COOLDOWN,
  VIEWPORT_W, VIEWPORT_H,
} = require('../constants');
const { MapLoader }  = require('../maps/mapLoader');
const skeldData      = require('../maps/data/skeld.json');

const SESSION_PREFIX = 'session:';

function sessionKey(id) { return `${SESSION_PREFIX}${id}`; }

// ─── Read / Write ─────────────────────────────────────────────────────────────

async function getSession(sessionId) {
  const raw = await getRedisClient().get(sessionKey(sessionId));
  return raw ? JSON.parse(raw) : null;
}

async function saveSession(session) {
  await getRedisClient().setex(
    sessionKey(session.id),
    SESSION_TTL_S,
    JSON.stringify(session)
  );
}

async function deleteSession(sessionId) {
  await getRedisClient().del(sessionKey(sessionId));
}

// ─── Session CRUD ─────────────────────────────────────────────────────────────

async function createSession({ guildId, channelId, hostId, hostUsername, tickIntervalMs, mapFile = 'skeld.json' }) {
  const sessionId = `${guildId}_${channelId}`;
  const mapPath   = require('path').join(__dirname, '../maps/data', mapFile);
  const mapData   = require(mapPath);
  const map       = new MapLoader(mapData);
  const host      = buildPlayer(hostId, hostUsername, 0);

  const session = {
    id:             sessionId,
    guildId,
    channelId,
    messageId:      null,
    hostId,
    phase:          PHASE.LOBBY,
    players:        { [hostId]: host },
    playerOrder:    [hostId],
    map:            map.toJSON(),
    tickCount:      0,
    tickIntervalMs: tickIntervalMs ?? parseInt(process.env.TICK_INTERVAL_MS || '2000', 10),
    createdAt:      Date.now(),
    startedAt:      null,
    // game state fields (populated on start)
    bodies:         [],
    tasks:          {},
    taskTotal:      0,
    taskCompleted:  0,
    transientEvents: [],
    viewportW:      VIEWPORT_W,
    viewportH:      VIEWPORT_H,
  };

  await saveSession(session);
  return session;
}

async function joinSession(sessionId, playerId, username) {
  const session = await getSession(sessionId);
  if (!session) return null;
  if (session.players[playerId]) return session;

  const colorIndex = session.playerOrder.length % PLAYER_COLORS.length;
  session.players[playerId] = buildPlayer(playerId, username, colorIndex);
  session.playerOrder.push(playerId);

  await saveSession(session);
  return session;
}

async function startSession(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return null;

  const map    = MapLoader.fromJSON(session.map);
  const spawns = map.getSpawnPoints();

  // Assign spawn positions
  session.playerOrder.forEach((id, i) => {
    const spawn = spawns[i % spawns.length];
    const p     = session.players[id];
    p.position     = { x: spawn.x, y: spawn.y };
    p.lastPosition = null;
    p.currentRoom  = map.getRoomAt(spawn.x, spawn.y);
  });

  // Assign roles and initialise game fields
  assignRoles(session);
  initTasks(session, map);

  session.phase     = PHASE.GAME;
  session.startedAt = Date.now();
  session.tickCount = 0;

  await saveSession(session);
  return session;
}

// ─── Win Condition ────────────────────────────────────────────────────────────

/**
 * Returns 'crewmate', 'impostor', or null if the game is still ongoing.
 * Called after every tick in gameEngine.runTick.
 */
function checkWinCondition(session) {
  const alive          = Object.values(session.players).filter(p => p.alive);
  const aliveImpostors = alive.filter(p => p.role === 'impostor');
  const aliveCrewmates = alive.filter(p => p.role === 'crewmate');

  // Impostors win when they equal or outnumber crewmates
  if (aliveCrewmates.length === 0) return 'impostor';
  if (aliveImpostors.length >= aliveCrewmates.length) return 'impostor';

  // Crewmates win when all impostors are dead
  if (aliveImpostors.length === 0) return 'crewmate';

  // Crewmates win when all tasks are completed
  if (session.taskTotal > 0 && session.taskCompleted >= session.taskTotal) return 'crewmate';

  return null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildPlayer(id, username, colorIndex) {
  return {
    id,
    username,
    colorIndex,
    position:              { x: 0, y: 0 },
    lastPosition:          null,
    role:                  'crewmate',
    alive:                 true,
    currentRoom:           null,
    killCooldownUntilTick: 0,
  };
}

function assignRoles(session) {
  const count         = session.playerOrder.length;
  const impostorCount = Math.max(1, Math.floor(count / IMPOSTOR_RATIO));

  // Shuffle a copy of playerOrder to pick impostors randomly
  const shuffled = [...session.playerOrder].sort(() => Math.random() - 0.5);

  for (const id of session.playerOrder) {
    session.players[id].role = 'crewmate';
    session.players[id].killCooldownUntilTick = 0;
  }

  shuffled.slice(0, impostorCount).forEach(id => {
    session.players[id].role = 'impostor';
    // Impostors start with a small cooldown so they can't kill instantly
    session.players[id].killCooldownUntilTick = INITIAL_KILL_COOLDOWN;
  });
}

function initTasks(session, map) {
  session.bodies        = [];
  session.tasks         = {};
  session.taskCompleted = 0;

  for (const task of map.tasks) {
    session.tasks[task.id] = {
      id:          task.id,
      name:        task.name,
      x:           task.x,
      y:           task.y,
      completed:   false,
      completedBy: null,
    };
  }

  session.taskTotal = map.tasks.length;
}

module.exports = {
  getSession,
  saveSession,
  deleteSession,
  createSession,
  joinSession,
  startSession,
  checkWinCondition,
};
