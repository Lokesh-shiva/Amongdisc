'use strict';

const { DIR_DELTA } = require('../constants');
const { MapLoader }  = require('../maps/mapLoader');

/**
 * Attempts to move `moverId` one step in `direction`.
 *
 * Resolution order:
 *  1. direction is a valid key in DIR_DELTA
 *  2. player exists and is alive
 *  3. target tile is within map bounds (getTile returns non-WALL)
 *  4. target tile is walkable
 *  5. no other alive player already occupies the target tile
 *
 * @param {MapLoader} map        - hydrated MapLoader instance
 * @param {object}   players    - { [playerId]: PlayerObject }
 * @param {string}   moverId    - the player attempting to move
 * @param {string}   direction  - 'up' | 'down' | 'left' | 'right'
 * @returns {{ x: number, y: number } | null}  new position or null if blocked
 */
function resolveMovement(map, players, moverId, direction) {
  // 1. valid direction
  const delta = DIR_DELTA[direction];
  if (!delta) return null;

  // 2. player exists and alive
  const player = players[moverId];
  if (!player || !player.alive) return null;

  // 3 & 4. target tile walkable (isWalkable includes bounds check)
  const nx = player.position.x + delta.dx;
  const ny = player.position.y + delta.dy;
  if (!map.isWalkable(nx, ny)) return null;

  // 5. no other alive player on target tile
  for (const [id, other] of Object.entries(players)) {
    if (id === moverId) continue;
    if (!other.alive) continue;
    if (other.position.x === nx && other.position.y === ny) return null;
  }

  return { x: nx, y: ny };
}

/**
 * Applies all queued moves for one tick.
 *
 * Conflict resolution: two players targeting the same tile are resolved
 * by their index in `playerOrder` — the earlier-joined player wins.
 * We process players in playerOrder sequence; since resolveMovement checks
 * current positions (already updated players block later ones), the first
 * mover in join-order implicitly wins any race to the same tile.
 *
 * @param {MapLoader} map
 * @param {object}   players      - mutated in-place
 * @param {string[]} playerOrder  - insertion-order player IDs
 * @param {object}   inputs       - { [playerId]: string[] }  (from inputHandler)
 * @returns {void}
 */
function applyTick(map, players, playerOrder, inputs) {
  for (const playerId of playerOrder) {
    const moves = inputs[playerId];
    if (!moves || moves.length === 0) continue;

    // Try each buffered move in order; apply the first valid one.
    for (const dir of moves) {
      const newPos = resolveMovement(map, players, playerId, dir);
      if (newPos) {
        const p = players[playerId];
        p.lastPosition = { ...p.position };
        p.position     = newPos;
        break; // only one move applied per tick
      }
    }
  }
}

module.exports = { resolveMovement, applyTick };
