'use strict';

const { getRedisClient }          = require('../redis/redisClient');
const { MAX_INPUT_QUEUE, INPUT_TTL_S } = require('../constants');

/**
 * Builds the Redis key for a player's input queue.
 * @param {string} sessionId
 * @param {string} playerId
 */
function inputKey(sessionId, playerId) {
  return `inputs:${sessionId}:${playerId}`;
}

/**
 * Queues one direction for a player.
 * Uses RPUSH + LTRIM (keeps only the last MAX_INPUT_QUEUE entries)
 * and refreshes the TTL so stale keys expire automatically.
 *
 * @param {string} sessionId
 * @param {string} playerId
 * @param {string} direction - 'up' | 'down' | 'left' | 'right'
 */
async function queueInput(sessionId, playerId, direction) {
  const redis = getRedisClient();
  const key   = inputKey(sessionId, playerId);

  const pipeline = redis.pipeline();
  pipeline.rpush(key, direction);
  pipeline.ltrim(key, -MAX_INPUT_QUEUE, -1); // keep last N
  pipeline.expire(key, INPUT_TTL_S);
  await pipeline.exec();
}

/**
 * Consumes all queued inputs for every player in the session in a single
 * Redis round-trip (pipeline: LRANGE + DEL per player).
 *
 * @param {string}   sessionId
 * @param {string[]} playerIds
 * @returns {Promise<{ [playerId: string]: string[] }>}
 */
async function consumeInputs(sessionId, playerIds) {
  if (!playerIds.length) return {};

  const redis    = getRedisClient();
  const pipeline = redis.pipeline();

  // Issue LRANGE then DEL for each player's queue
  for (const id of playerIds) {
    const key = inputKey(sessionId, id);
    pipeline.lrange(key, 0, -1);
    pipeline.del(key);
  }

  const results = await pipeline.exec();
  // results = [[err, lrangeVal], [err, delVal], [err, lrangeVal], ...]

  const inputs = {};
  for (let i = 0; i < playerIds.length; i++) {
    const lrangeResult = results[i * 2];       // [err, string[]]
    inputs[playerIds[i]] = lrangeResult[1] || [];
  }

  return inputs;
}

module.exports = { queueInput, consumeInputs };
