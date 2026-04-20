'use strict';

const { getRedisClient }               = require('../redis/redisClient');
const { PHASE, PLAYER_COLORS, SESSION_TTL_S } = require('../constants');
const { MapLoader }                    = require('../maps/mapLoader');
const skeldData                        = require('../maps/data/skeld.json');

const SESSION_PREFIX = 'session:';

function sessionKey(sessionId) {
  return `${SESSION_PREFIX}${sessionId}`;
}

// ─── Read / Write helpers ────────────────────────────────────────────────────

/**
 * Loads and parses a session from Redis.
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
async function getSession(sessionId) {
  const redis = getRedisClient();
  const raw   = await redis.get(sessionKey(sessionId));
  return raw ? JSON.parse(raw) : null;
}

/**
 * Serialises and saves a session to Redis, resetting the TTL.
 * @param {object} session
 */
async function saveSession(session) {
  const redis = getRedisClient();
  await redis.setex(
    sessionKey(session.id),
    SESSION_TTL_S,
    JSON.stringify(session)
  );
}

/**
 * Deletes a session from Redis.
 * @param {string} sessionId
 */
async function deleteSession(sessionId) {
  const redis = getRedisClient();
  await redis.del(sessionKey(sessionId));
}

// ─── Session CRUD ────────────────────────────────────────────────────────────

/**
 * Creates a brand-new lobby session for the host player.
 *
 * @param {object} opts
 * @param {string} opts.guildId
 * @param {string} opts.channelId
 * @param {string} opts.hostId
 * @param {string} opts.hostUsername
 * @param {number} [opts.tickIntervalMs]
 * @returns {Promise<object>} the created session
 */
async function createSession({ guildId, channelId, hostId, hostUsername, tickIntervalMs }) {
  const sessionId = `${guildId}_${channelId}`;
  const map       = new MapLoader(skeldData);

  const hostColorIndex = 0;
  const host = buildPlayer(hostId, hostUsername, hostColorIndex);

  const session = {
    id:             sessionId,
    guildId,
    channelId,
    messageId:      null, // set when lobby embed is posted
    hostId,
    phase:          PHASE.LOBBY,
    players:        { [hostId]: host },
    playerOrder:    [hostId],
    map:            map.toJSON(),
    tickCount:      0,
    tickIntervalMs: tickIntervalMs ?? parseInt(process.env.TICK_INTERVAL_MS || '2000', 10),
    createdAt:      Date.now(),
    startedAt:      null,
  };

  await saveSession(session);
  return session;
}

/**
 * Adds a player to an existing lobby session.
 * Silently does nothing if the player is already present.
 *
 * @param {string} sessionId
 * @param {string} playerId
 * @param {string} username
 * @returns {Promise<object|null>} updated session, or null if session not found
 */
async function joinSession(sessionId, playerId, username) {
  const session = await getSession(sessionId);
  if (!session) return null;
  if (session.players[playerId]) return session; // already joined

  const colorIndex = session.playerOrder.length % PLAYER_COLORS.length;
  session.players[playerId]  = buildPlayer(playerId, username, colorIndex);
  session.playerOrder.push(playerId);

  await saveSession(session);
  return session;
}

/**
 * Transitions a session from LOBBY → GAME and assigns spawn positions.
 *
 * @param {string} sessionId
 * @returns {Promise<object|null>} updated session or null if not found
 */
async function startSession(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return null;

  const map    = MapLoader.fromJSON(session.map);
  const spawns = map.getSpawnPoints();

  session.playerOrder.forEach((id, i) => {
    const spawn = spawns[i % spawns.length];
    session.players[id].position     = { x: spawn.x, y: spawn.y };
    session.players[id].lastPosition = null;
    session.players[id].currentRoom  = map.getRoomAt(spawn.x, spawn.y);
  });

  session.phase     = PHASE.GAME;
  session.startedAt = Date.now();
  session.tickCount = 0;

  await saveSession(session);
  return session;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPlayer(id, username, colorIndex) {
  return {
    id,
    username,
    colorIndex,
    position:     { x: 0, y: 0 }, // overwritten on start
    lastPosition: null,
    role:         'crewmate',
    alive:        true,
    currentRoom:  null,
  };
}

module.exports = {
  getSession,
  saveSession,
  deleteSession,
  createSession,
  joinSession,
  startSession,
};
