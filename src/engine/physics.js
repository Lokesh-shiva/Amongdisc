'use strict';

const { DIR_DELTA, KILL_RANGE, KILL_COOLDOWN_TICKS } = require('../constants');

const MOVE_INPUTS   = new Set(['up', 'down', 'left', 'right']);
const ACTION_INPUTS = new Set(['kill', 'task', 'vent']);

// ─── Movement ─────────────────────────────────────────────────────────────────

/**
 * Checks whether `moverId` can move one step in `direction`.
 * Returns new {x,y} if valid, null if blocked.
 */
function resolveMovement(map, players, moverId, direction) {
  const delta  = DIR_DELTA[direction];
  if (!delta) return null;

  const player = players[moverId];
  if (!player || !player.alive) return null;

  const nx = player.position.x + delta.dx;
  const ny = player.position.y + delta.dy;
  if (!map.isWalkable(nx, ny)) return null;

  for (const [id, other] of Object.entries(players)) {
    if (id === moverId || !other.alive) continue;
    if (other.position.x === nx && other.position.y === ny) return null;
  }

  return { x: nx, y: ny };
}

// ─── Tick resolution ──────────────────────────────────────────────────────────

/**
 * Applies all queued inputs for one tick.
 *
 * Pass 1 — movement: first valid direction per player (join-order priority)
 * Pass 2 — actions:  first of kill/task/vent per player
 *
 * Mutates session.players, session.bodies, session.tasks, session.taskCompleted.
 *
 * @param {object}    session - full game session (mutated in-place)
 * @param {MapLoader} map     - hydrated MapLoader
 * @param {object}    inputs  - { [playerId]: string[] }
 */
function applyTick(session, map, inputs) {
  const { players, playerOrder } = session;

  // Pass 1: movement
  for (const playerId of playerOrder) {
    const moves = inputs[playerId];
    if (!moves) continue;

    for (const input of moves) {
      if (!MOVE_INPUTS.has(input)) continue;
      const newPos = resolveMovement(map, players, playerId, input);
      if (newPos) {
        const p        = players[playerId];
        p.lastPosition = { ...p.position };
        p.position     = newPos;
        break;
      }
    }
  }

  // Pass 2: special actions (one per player per tick)
  for (const playerId of playerOrder) {
    const moves  = inputs[playerId];
    if (!moves) continue;
    const action = moves.find(m => ACTION_INPUTS.has(m));
    if (!action) continue;

    if (action === 'kill') applyKill(session, map, playerId);
    if (action === 'task') applyTask(session, map, playerId);
    if (action === 'vent') applyVent(session, map, playerId);
  }
}

// ─── Kill ─────────────────────────────────────────────────────────────────────

function applyKill(session, map, killerId) {
  const killer = session.players[killerId];
  if (!killer || !killer.alive || killer.role !== 'impostor') return;
  if (session.tickCount < killer.killCooldownUntilTick)        return;

  // Find nearest alive crewmate within KILL_RANGE (Chebyshev distance)
  let target  = null;
  let minDist = Infinity;

  for (const id of session.playerOrder) {
    if (id === killerId) continue;
    const p = session.players[id];
    if (!p.alive || p.role === 'impostor') continue;

    const dist = Math.max(
      Math.abs(p.position.x - killer.position.x),
      Math.abs(p.position.y - killer.position.y)
    );
    if (dist <= KILL_RANGE && dist < minDist) {
      minDist = dist;
      target  = p;
    }
  }

  if (!target) return;

  target.alive = false;
  session.bodies.push({
    x:          target.position.x,
    y:          target.position.y,
    colorIndex: target.colorIndex,
    username:   target.username,
  });

  killer.killCooldownUntilTick = session.tickCount + KILL_COOLDOWN_TICKS;
  console.log(`[Physics] ${killer.username} killed ${target.username}`);
}

// ─── Task ─────────────────────────────────────────────────────────────────────

function applyTask(session, map, playerId) {
  const player = session.players[playerId];
  if (!player || !player.alive || player.role === 'impostor') return;

  const taskDef = map.getTaskAt(player.position.x, player.position.y);
  if (!taskDef) return;

  const task = session.tasks[taskDef.id];
  if (!task || task.completed) return;

  task.completed   = true;
  task.completedBy = playerId;
  session.taskCompleted += 1;
  console.log(`[Physics] ${player.username} completed task "${task.name}" (${session.taskCompleted}/${session.taskTotal})`);
}

// ─── Vent ─────────────────────────────────────────────────────────────────────

function applyVent(session, map, playerId) {
  const player = session.players[playerId];
  if (!player || !player.alive || player.role !== 'impostor') return;

  const vent = map.getVentAt(player.position.x, player.position.y);
  if (!vent || !vent.linkedTo.length) return;

  // Pick a random linked vent as destination
  const linkedId  = vent.linkedTo[Math.floor(Math.random() * vent.linkedTo.length)];
  const dest      = map.vents.find(v => v.id === linkedId);
  if (!dest) return;

  player.lastPosition = { ...player.position };
  player.position     = { x: dest.x, y: dest.y };
  player.currentRoom  = map.getRoomAt(dest.x, dest.y);
  console.log(`[Physics] ${player.username} vented to (${dest.x}, ${dest.y})`);
}

module.exports = { resolveMovement, applyTick };
