# Per-Player Viewport (Fog of War) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single shared full-map channel message with per-player ephemeral views showing a zoomed 9×7 tile fog-of-war viewport, delivered when the player presses any button.

**Architecture:** On every button press, the bot renders a personal viewport (9×7 tiles centered on the player, scaled up to full canvas size) and replies ephemerally. The shared game-in-progress map image is removed; the lobby message is transformed into a text-only control panel with movement buttons. Dead players (ghosts) receive a full-map view. The shared channel message returns only at game-over.

**Tech Stack:** Node.js 18+, discord.js 14, @napi-rs/canvas, ioredis, node:test (built-in)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/renderer/viewport.js` | Pure `computeViewport` helper — no canvas dep, fully testable |
| Create | `test/viewport.test.js` | Unit tests for viewport clamping |
| Modify | `src/constants/index.js` | Add `VIEWPORT_W = 9`, `VIEWPORT_H = 7` |
| Modify | `src/engine/gameManager.js` | Add `viewportW`/`viewportH` to session at creation |
| Modify | `src/renderer/renderer.js` | Add `renderPlayerView` + `drawMinimap` |
| Modify | `src/bot.js` | Button handlers send ephemeral views; lobby_start edits lobby message into control panel |
| Modify | `src/engine/gameEngine.js` | Remove per-tick `editGameMessage` call from `runTick` |

---

## Task 1: Viewport constants

**Files:**
- Modify: `src/constants/index.js`

- [ ] **Step 1: Add the two constants**

In `src/constants/index.js`, add after the `SESSION_TTL_S` line:

```js
// ─── Viewport (fog of war) ───────────────────────────────────────────────────
const VIEWPORT_W = 9;   // tiles wide each player can see
const VIEWPORT_H = 7;   // tiles tall each player can see
```

- [ ] **Step 2: Export them**

Add `VIEWPORT_W` and `VIEWPORT_H` to the `module.exports` object at the bottom of `src/constants/index.js`:

```js
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
  VIEWPORT_W,
  VIEWPORT_H,
};
```

- [ ] **Step 3: Commit**

```bash
git add src/constants/index.js
git commit -m "feat: add VIEWPORT_W and VIEWPORT_H constants"
```

---

## Task 2: Extract and test computeViewport

**Files:**
- Create: `src/renderer/viewport.js`
- Create: `test/viewport.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `test/viewport.test.js`:

```js
'use strict';

const { strict: assert } = require('node:assert');
const { test } = require('node:test');
const { computeViewport } = require('../src/renderer/viewport');

test('centers on player in middle of map', () => {
  // Player at (12,8) on 24×16 map, viewport 9×7
  // halfW=4, halfH=3 → x=12-4=8, y=8-3=5
  assert.deepEqual(computeViewport(12, 8, 24, 16, 9, 7), { x: 8, y: 5 });
});

test('clamps to top-left when player near origin', () => {
  assert.deepEqual(computeViewport(0, 0, 24, 16, 9, 7), { x: 0, y: 0 });
});

test('clamps to top-left when player close to edge', () => {
  // Player at (2,2): 2-4=-2 → clamped to 0; 2-3=-1 → clamped to 0
  assert.deepEqual(computeViewport(2, 2, 24, 16, 9, 7), { x: 0, y: 0 });
});

test('clamps to bottom-right when player near far edge', () => {
  // Player at (23,15): max x = 24-9=15, max y = 16-7=9
  assert.deepEqual(computeViewport(23, 15, 24, 16, 9, 7), { x: 15, y: 9 });
});

test('x clamps but y centers normally', () => {
  // Player at (1, 8): x=1-4=-3→0; y=8-3=5
  assert.deepEqual(computeViewport(1, 8, 24, 16, 9, 7), { x: 0, y: 5 });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test test/viewport.test.js
```

Expected: `ReferenceError` or `Cannot find module` — the module doesn't exist yet.

- [ ] **Step 3: Create `src/renderer/viewport.js`**

```js
'use strict';

/**
 * Computes the top-left tile coordinate of the viewport window.
 * Centers on (px, py) and clamps to map bounds.
 *
 * @param {number} px       - Player tile X
 * @param {number} py       - Player tile Y
 * @param {number} mapW     - Map width in tiles
 * @param {number} mapH     - Map height in tiles
 * @param {number} vpW      - Viewport width in tiles
 * @param {number} vpH      - Viewport height in tiles
 * @returns {{ x: number, y: number }}
 */
function computeViewport(px, py, mapW, mapH, vpW, vpH) {
  const halfW = Math.floor(vpW / 2);
  const halfH = Math.floor(vpH / 2);
  const x = Math.max(0, Math.min(px - halfW, mapW - vpW));
  const y = Math.max(0, Math.min(py - halfH, mapH - vpH));
  return { x, y };
}

module.exports = { computeViewport };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node --test test/viewport.test.js
```

Expected output:
```
▶ centers on player in middle of map
✔ centers on player in middle of map (Xms)
▶ clamps to top-left when player near origin
✔ clamps to top-left when player near origin (Xms)
...
ℹ tests 5
ℹ pass 5
ℹ fail 0
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/viewport.js test/viewport.test.js
git commit -m "feat: add computeViewport helper with unit tests"
```

---

## Task 3: Add viewportW / viewportH to session

**Files:**
- Modify: `src/engine/gameManager.js`

- [ ] **Step 1: Import the new constants at the top of gameManager.js**

Change the existing constants import (line 2) from:

```js
const {
  PHASE, PLAYER_COLORS, SESSION_TTL_S,
  IMPOSTOR_RATIO, INITIAL_KILL_COOLDOWN,
} = require('../constants');
```

To:

```js
const {
  PHASE, PLAYER_COLORS, SESSION_TTL_S,
  IMPOSTOR_RATIO, INITIAL_KILL_COOLDOWN,
  VIEWPORT_W, VIEWPORT_H,
} = require('../constants');
```

- [ ] **Step 2: Add viewportW/viewportH to the session object in createSession**

In `createSession`, add `viewportW` and `viewportH` to the session literal (after `transientEvents: []`):

```js
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
  bodies:         [],
  tasks:          {},
  taskTotal:      0,
  taskCompleted:  0,
  transientEvents: [],
  viewportW:      VIEWPORT_W,
  viewportH:      VIEWPORT_H,
};
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/gameManager.js
git commit -m "feat: store viewportW/viewportH on session"
```

---

## Task 4: renderPlayerView and drawMinimap

**Files:**
- Modify: `src/renderer/renderer.js`

This is the core rendering task. We add two new functions: `drawMinimap` (internal) and `renderPlayerView` (exported).

- [ ] **Step 1: Add the viewport import at the top of renderer.js**

Add after the existing requires in `src/renderer/renderer.js`:

```js
const { computeViewport }     = require('./viewport');
const { VIEWPORT_W, VIEWPORT_H, PLAYER_COLORS } = require('../constants');
```

The full top of the file should now look like:

```js
'use strict';

const path                    = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { TILE_SIZE, HUD_HEIGHT, TILE_COLORS, TILE, VIEWPORT_W, VIEWPORT_H, PLAYER_COLORS } = require('../constants');
const { drawBodiesLayer }     = require('./layers/mapLayer');
const { drawPlayerLayer }     = require('./layers/playerLayer');
const { drawUILayer }         = require('./layers/uiLayer');
const { computeViewport }     = require('./viewport');
```

- [ ] **Step 2: Add the drawMinimap function**

Add this function after `drawRoomLabels` (before `module.exports`) in `src/renderer/renderer.js`:

```js
// ─── Minimap overlay ──────────────────────────────────────────────────────────

function drawMinimap(ctx, session, vpX, vpY, vpW, vpH, selfId, canvasW, mapH) {
  const mapData = session.map;
  const MM_W = Math.round(canvasW * 0.20);
  const MM_H = Math.round(MM_W * mapData.height / mapData.width);
  const MM_X = canvasW - MM_W - 8;
  const MM_Y = mapH - MM_H - 8;
  const tileW = MM_W / mapData.width;
  const tileH = MM_H / mapData.height;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.70)';
  ctx.fillRect(MM_X, MM_Y, MM_W, MM_H);

  // Border
  ctx.strokeStyle = '#445566';
  ctx.lineWidth   = 1;
  ctx.strokeRect(MM_X, MM_Y, MM_W, MM_H);

  // Viewport rectangle (white outline showing where we are)
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(
    MM_X + vpX * tileW,
    MM_Y + vpY * tileH,
    vpW * tileW,
    vpH * tileH
  );

  // Player dots — fog of war: only show players within current viewport (always show self)
  for (const id of session.playerOrder) {
    const p = session.players[id];
    const isSelf = id === selfId;
    if (!isSelf) {
      const inVp = p.position.x >= vpX && p.position.x < vpX + vpW &&
                   p.position.y >= vpY && p.position.y < vpY + vpH;
      if (!inVp) continue;
    }
    const dotX  = MM_X + (p.position.x + 0.5) * tileW;
    const dotY  = MM_Y + (p.position.y + 0.5) * tileH;
    const color = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length];
    ctx.fillStyle = isSelf ? '#ffffff' : color.hex;
    ctx.beginPath();
    ctx.arc(dotX, dotY, isSelf ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

- [ ] **Step 3: Add the renderPlayerView function**

Add this function after `renderFrame` in `src/renderer/renderer.js`:

```js
/**
 * Renders a personal viewport for one player.
 * Dead players (ghosts) get the full map via renderFrame.
 * Alive players get a zoomed 9×7-tile crop scaled to the full canvas size.
 *
 * @param {object} session
 * @param {string} playerId
 * @returns {Promise<Buffer>} PNG buffer
 */
async function renderPlayerView(session, playerId) {
  const player = session.players[playerId];

  // Ghosts see the full map
  if (!player || !player.alive) return renderFrame(session);

  const { map, players, playerOrder } = session;
  const vpW = session.viewportW || VIEWPORT_W;
  const vpH = session.viewportH || VIEWPORT_H;

  const mapW    = map.width  * TILE_SIZE;
  const mapH    = map.height * TILE_SIZE;
  const canvasW = mapW;
  const canvasH = mapH + HUD_HEIGHT;

  const { x: vpX, y: vpY } = computeViewport(
    player.position.x, player.position.y,
    map.width, map.height,
    vpW, vpH
  );

  const canvas = createCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext('2d');

  const img = await loadMapImage();

  // ── Draw map background (cropped + scaled up) ─────────────────────────────
  if (img) {
    ctx.drawImage(
      img,
      vpX * TILE_SIZE, vpY * TILE_SIZE, vpW * TILE_SIZE, vpH * TILE_SIZE,
      0, 0, mapW, mapH
    );
  }

  // ── Scale + translate context so existing draw helpers work correctly ──────
  const scaleX = mapW / (vpW * TILE_SIZE);
  const scaleY = mapH / (vpH * TILE_SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, mapW, mapH);
  ctx.clip();
  ctx.scale(scaleX, scaleY);
  ctx.translate(-vpX * TILE_SIZE, -vpY * TILE_SIZE);

  if (img) {
    drawTaskOverlays(ctx, map, session.tasks || {});
  } else {
    const { drawMapLayer } = require('./layers/mapLayer');
    drawMapLayer(ctx, map);
    drawTaskOverlays(ctx, map, session.tasks || {});
  }

  drawBodiesLayer(ctx, session.bodies || [], session.tasks || {}, map);

  // Filter players to those within the viewport only
  const visibleIds = playerOrder.filter(id => {
    if (id === playerId) return true; // always show self
    const p = players[id];
    return p.position.x >= vpX && p.position.x < vpX + vpW &&
           p.position.y >= vpY && p.position.y < vpY + vpH;
  });
  drawPlayerLayer(ctx, players, visibleIds);

  // Kill flash (only if within viewport)
  if (session.transientEvents) {
    const { drawKillFlash } = require('./layers/mapLayer');
    for (const event of session.transientEvents) {
      if (event.type === 'kill') {
        const inVp = event.x >= vpX && event.x < vpX + vpW &&
                     event.y >= vpY && event.y < vpY + vpH;
        if (inVp) drawKillFlash(ctx, event.x, event.y);
      }
    }
  }

  ctx.restore();

  // ── Minimap overlay ───────────────────────────────────────────────────────
  drawMinimap(ctx, session, vpX, vpY, vpW, vpH, playerId, canvasW, mapH);

  // ── HUD ───────────────────────────────────────────────────────────────────
  drawUILayer(ctx, session, canvasW, canvasH);

  return canvas.toBuffer('image/png');
}
```

- [ ] **Step 4: Export renderPlayerView**

Change `module.exports` at the bottom of `src/renderer/renderer.js`:

```js
module.exports = { renderFrame, renderPlayerView };
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/renderer.js src/renderer/viewport.js
git commit -m "feat: add renderPlayerView with fog-of-war viewport and minimap"
```

---

## Task 5: Update lobby_start handler to create control panel

**Files:**
- Modify: `src/bot.js` (the `lobby_start` block, lines 147–170)

Currently the handler sends a new channel message with the full map image. We replace this: the lobby message itself is transformed into a text-only control panel with movement buttons.

- [ ] **Step 1: Replace the lobby_start handler body**

Find the `if (id === 'lobby_start')` block (starts at line 147) and replace the entire block body with:

```js
if (id === 'lobby_start') {
  await interaction.deferUpdate();
  const sessionId = `${interaction.guildId}_${interaction.channelId}`;
  const { getSession: gs, startSession, saveSession } = require('./engine/gameManager');
  const { startLoop, buildMovementRowsPublic }        = require('./engine/gameEngine');

  const session = await gs(sessionId);
  if (!session || session.phase !== PHASE.LOBBY) return;
  if (session.hostId !== interaction.user.id)    return;

  const started = await startSession(sessionId);
  const rows    = buildMovementRowsPublic();

  // Transform the lobby message into a button-only control panel (no map image)
  await interaction.message.edit({
    content:    '🎮 **Game in progress** — press any button to see your personal view.',
    embeds:     [],
    components: rows,
  }).catch(() => {});

  started.messageId = interaction.message.id;
  await saveSession(started);
  startLoop(started.id, started.channelId, interaction.message.id);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/bot.js
git commit -m "feat: transform lobby message into control panel on game start"
```

---

## Task 6: Update movement button handler to send ephemeral view

**Files:**
- Modify: `src/bot.js` (the `MOVE_BUTTONS` block, lines 65–73)

- [ ] **Step 1: Replace the movement button handler**

Find the `if (MOVE_BUTTONS.has(id))` block and replace it with:

```js
if (MOVE_BUTTONS.has(id)) {
  const sessionId = `${interaction.guildId}_${interaction.channelId}`;
  const session   = await getSession(sessionId);
  if (!session || session.phase !== PHASE.GAME) return interaction.deferUpdate();
  if (!session.players[interaction.user.id]) return interaction.deferUpdate();

  await queueInput(sessionId, interaction.user.id, DIRECTION_MAP[id]);

  try {
    const { renderPlayerView }      = require('./renderer/renderer');
    const { buildMovementRowsPublic } = require('./engine/gameEngine');
    const { AttachmentBuilder }     = require('discord.js');
    const pngBuffer  = await renderPlayerView(session, interaction.user.id);
    const attachment = new AttachmentBuilder(pngBuffer, { name: 'view.png' });
    await interaction.reply({
      ephemeral:  true,
      files:      [attachment],
      components: buildMovementRowsPublic(),
    });
  } catch (err) {
    console.error('[Bot] Ephemeral view render error:', err);
    await interaction.deferUpdate().catch(() => {});
  }
  return;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/bot.js
git commit -m "feat: movement buttons send ephemeral player viewport"
```

---

## Task 7: Update action button handlers to send ephemeral view

**Files:**
- Modify: `src/bot.js` (the `ACTION_BUTTONS` block, lines 76–123)

The error paths (wrong role, cooldown, already dead) remain as text-only ephemerals. Only the success paths (kill queued, task queued, vent queued) change to show the player view.

- [ ] **Step 1: Replace the action_kill success path**

Find this block inside the `action === 'kill'` branch:

```js
await interaction.deferUpdate();
await queueInput(sessionId, interaction.user.id, action);
return;
```

Replace with:

```js
await queueInput(sessionId, interaction.user.id, action);
try {
  const { renderPlayerView }        = require('./renderer/renderer');
  const { buildMovementRowsPublic } = require('./engine/gameEngine');
  const { AttachmentBuilder }       = require('discord.js');
  const pngBuffer  = await renderPlayerView(session, interaction.user.id);
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'view.png' });
  await interaction.reply({
    ephemeral:  true,
    files:      [attachment],
    components: buildMovementRowsPublic(),
  });
} catch (err) {
  console.error('[Bot] Ephemeral view render error (kill):', err);
  await interaction.deferUpdate().catch(() => {});
}
return;
```

- [ ] **Step 2: Replace the action_task success path**

Find this block inside the `action === 'task'` branch:

```js
await interaction.reply({ content: '✅ Doing task...', ephemeral: true });
await queueInput(sessionId, interaction.user.id, action);
return;
```

Replace with:

```js
await queueInput(sessionId, interaction.user.id, action);
try {
  const { renderPlayerView }        = require('./renderer/renderer');
  const { buildMovementRowsPublic } = require('./engine/gameEngine');
  const { AttachmentBuilder }       = require('discord.js');
  const pngBuffer  = await renderPlayerView(session, interaction.user.id);
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'view.png' });
  await interaction.reply({
    ephemeral:  true,
    files:      [attachment],
    components: buildMovementRowsPublic(),
  });
} catch (err) {
  console.error('[Bot] Ephemeral view render error (task):', err);
  await interaction.deferUpdate().catch(() => {});
}
return;
```

- [ ] **Step 3: Replace the action_vent success path**

Find this block inside the `action === 'vent'` branch:

```js
await interaction.deferUpdate();
await queueInput(sessionId, interaction.user.id, action);
return;
```

Replace with:

```js
await queueInput(sessionId, interaction.user.id, action);
try {
  const { renderPlayerView }        = require('./renderer/renderer');
  const { buildMovementRowsPublic } = require('./engine/gameEngine');
  const { AttachmentBuilder }       = require('discord.js');
  const pngBuffer  = await renderPlayerView(session, interaction.user.id);
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'view.png' });
  await interaction.reply({
    ephemeral:  true,
    files:      [attachment],
    components: buildMovementRowsPublic(),
  });
} catch (err) {
  console.error('[Bot] Ephemeral view render error (vent):', err);
  await interaction.deferUpdate().catch(() => {});
}
return;
```

- [ ] **Step 4: Commit**

```bash
git add src/bot.js
git commit -m "feat: action buttons (kill/task/vent) send ephemeral player viewport"
```

---

## Task 8: Remove per-tick render from gameEngine

**Files:**
- Modify: `src/engine/gameEngine.js`

The tick no longer sends any image to the channel. The `editGameMessage` call remains only for the game-over path (which still reveals the full map publicly).

- [ ] **Step 1: Remove the final render call from runTick**

In `src/engine/gameEngine.js`, find these two lines at the end of `runTick` (after `await saveSession(session)`):

```js
  // 8. Render and edit Discord message
  const pngBuffer = await renderFrame(session);
  await editGameMessage(channelId, messageId, pngBuffer, session, false);
```

Delete them entirely. The function now ends after `await saveSession(session)`.

- [ ] **Step 2: Verify the win-condition path still calls editGameMessage**

Confirm the win block (around line 101–110) still contains:

```js
const finalBuffer = await renderFrame(session);
await editGameMessage(channelId, messageId, finalBuffer, session, true);
```

This is correct — the game-over reveal still posts the full map publicly. Do not remove it.

- [ ] **Step 3: Run the bot and smoke-test**

```bash
node src/index.js
```

Expected: Bot starts without errors. In Discord:
1. `/create` → lobby embed appears
2. `/join` → players join
3. Host clicks **Start** → lobby message transforms to `🎮 Game in progress — press any button to see your personal view.` with movement buttons; no map image posted
4. Player clicks ⬆️ → ephemeral appears showing their zoomed viewport (visible only to them) with minimap in bottom-right corner
5. Dead player clicks any button → ephemeral shows full map
6. Game ends → full map image posted publicly to channel with win announcement

- [ ] **Step 4: Commit**

```bash
git add src/engine/gameEngine.js
git commit -m "feat: remove per-tick map render; views are now ephemeral on button press"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Ephemeral per-player view ✓ (Tasks 6, 7)
  - Shared message replaced by control panel ✓ (Task 5)
  - 9×7 tile crop scaled to full canvas size ✓ (Task 4)
  - Other players hidden outside viewport ✓ (Task 4 `visibleIds` filter)
  - Dead players see full map ✓ (Task 4 ghost branch)
  - Minimap with fog-of-war dots + viewport rectangle ✓ (Task 4)
  - viewportW/viewportH on session for future configurability ✓ (Task 3)
- [x] **No placeholders** — all steps contain complete code
- [x] **Type consistency** — `renderPlayerView` signature matches all call sites in Tasks 6 and 7; `computeViewport` signature matches usage in Task 4
