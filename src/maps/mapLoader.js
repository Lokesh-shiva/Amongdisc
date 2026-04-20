'use strict';

const { TILE } = require('../constants');

/**
 * Wraps a raw map JSON object with utility methods used by the engine
 * and renderer.  One MapLoader instance is stored per session inside
 * the session's `map` field (serialised as plain JSON in Redis and
 * re-hydrated on each tick).
 */
class MapLoader {
  /**
   * @param {object} mapData - Raw map JSON (name, width, height, grid, rooms, spawnPoints)
   */
  constructor(mapData) {
    this.name        = mapData.name;
    this.width       = mapData.width;
    this.height      = mapData.height;
    this.grid        = mapData.grid;        // 2-D array [y][x]
    this.rooms       = mapData.rooms;       // [{ name, x, y, w, h }]
    this.spawnPoints = mapData.spawnPoints; // [{ x, y }]
  }

  /** Returns the raw tile type at (x, y), or WALL if out of bounds. */
  getTile(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return TILE.WALL;
    return this.grid[y][x];
  }

  /** Returns true when a player can walk onto (x, y). */
  isWalkable(x, y) {
    return this.getTile(x, y) !== TILE.WALL;
  }

  /**
   * Returns the name of the room that contains tile (x, y), or null
   * when the tile is in a corridor (not inside any room bounding box).
   */
  getRoomAt(x, y) {
    for (const room of this.rooms) {
      if (
        x >= room.x && x < room.x + room.w &&
        y >= room.y && y < room.y + room.h
      ) {
        return room.name;
      }
    }
    return null;
  }

  /**
   * Returns a Fisher-Yates shuffled copy of the spawn-point array so
   * players start at randomised positions every game.
   * @returns {{ x: number, y: number }[]}
   */
  getSpawnPoints() {
    const pts = [...this.spawnPoints];
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }

  /**
   * Returns the plain-object representation so it can be JSON-serialised
   * into Redis without losing the utility methods on reload.
   */
  toJSON() {
    return {
      name:        this.name,
      width:       this.width,
      height:      this.height,
      grid:        this.grid,
      rooms:       this.rooms,
      spawnPoints: this.spawnPoints,
    };
  }

  /**
   * Re-hydrates a MapLoader from a plain object (e.g. after JSON.parse
   * of a Redis value).
   * @param {object} data
   * @returns {MapLoader}
   */
  static fromJSON(data) {
    return new MapLoader(data);
  }
}

module.exports = { MapLoader };
