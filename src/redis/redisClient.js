'use strict';

const Redis = require('ioredis');

let _client = null;

/**
 * Returns the singleton ioredis client, creating it on first call.
 * Subsequent calls return the same instance.
 */
function getRedisClient() {
  if (_client) return _client;

  _client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  _client.on('connect', () => console.log('[Redis] Connected'));
  _client.on('error',   (err) => console.error('[Redis] Error:', err.message));

  return _client;
}

module.exports = { getRedisClient };
