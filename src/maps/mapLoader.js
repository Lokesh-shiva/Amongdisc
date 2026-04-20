'use strict';

const { TILE } = require('../constants');

class MapLoader {
  constructor(mapData) {
    this.name        = mapData.name;
    this.width       = mapData.width;
    this.height      = mapData.height;
    this.grid        = mapData.grid;
    this.rooms       = mapData.rooms;
    this.spawnPoints = mapData.spawnPoints;
    this.vents       = mapData.vents  || [];
    this.tasks       = mapData.tasks  || [];
  }

  getTile(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return TILE.WALL;
    return this.grid[y][x];
  }

  isWalkable(x, y) {
    return this.getTile(x, y) !== TILE.WALL;
  }

  getRoomAt(x, y) {
    for (const room of this.rooms) {
      if (x >= room.x && x < room.x + room.w &&
          y >= room.y && y < room.y + room.h) {
        return room.name;
      }
    }
    return null;
  }

  /** Returns the vent definition at (x, y), or null. */
  getVentAt(x, y) {
    return this.vents.find(v => v.x === x && v.y === y) || null;
  }

  /** Returns the task definition at (x, y), or null. */
  getTaskAt(x, y) {
    return this.tasks.find(t => t.x === x && t.y === y) || null;
  }

  getSpawnPoints() {
    const pts = [...this.spawnPoints];
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }

  toJSON() {
    return {
      name:        this.name,
      width:       this.width,
      height:      this.height,
      grid:        this.grid,
      rooms:       this.rooms,
      spawnPoints: this.spawnPoints,
      vents:       this.vents,
      tasks:       this.tasks,
    };
  }

  static fromJSON(data) {
    return new MapLoader(data);
  }
}

module.exports = { MapLoader };
