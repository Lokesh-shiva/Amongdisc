# Per-Player Viewport (Fog of War) — Design Spec
Date: 2026-04-24

## Goal

Replace the single shared full-map channel message with personal ephemeral views per player. Each player sees only a cropped, zoomed viewport around their character, hiding distant players and map areas. This makes gameplay more immersive and Among Us-like.

---

## Architecture

### Current flow
```
runTick → renderFrame(session) → editGameMessage (1 shared message)
```

### New flow
```
button press (interaction)
  → queueInput
  → renderPlayerView(session, playerId)
  → interaction.reply({ ephemeral: true, files: [png] })
```

The shared channel message is **deleted** when the game starts (`startLoop`). No shared map message exists during gameplay. The game-over screen still posts a full-map image publicly to the channel.

---

## Rendering

### `renderPlayerView(session, playerId)`

- Computes a 9×7 tile window centered on the player's position
- Clamps the window to map edges (player near a wall gets an off-center crop)
- Scales the cropped tile region up to fill the full 864×576px canvas (same output size as the old shared image) — tiles render at ~96px each instead of 36px
- Draws: map background slice, task overlays, bodies, players — **filtering out any player whose tile position falls outside the 9×7 window**
- Impostors have no special extended vision — same 9×7 window as crewmates
- HUD (96px bar) is appended below as usual, showing personal stats (role, tasks, cooldown)

### Ghost rendering

Dead players call the existing `renderFrame(session)` — full map, all players visible. This is intentional: ghosts get omniscience as a consolation/information reward.

### Minimap overlay

- Drawn in the bottom-right corner of the cropped canvas
- Scaled to ~20% of canvas width (~173×115px)
- Shows the full map layout (room outlines only, no tile detail)
- A white rectangle indicates the current viewport bounds
- Dots for players: self = white, others = their color — **only players within the current viewport are shown** (minimap respects fog of war)

### Configurable viewport size

- `VIEWPORT_W = 9`, `VIEWPORT_H = 7` added to `src/constants/index.js`
- `viewportW` and `viewportH` stored on the session object (defaults to constants)
- Future: `/create` command accepts `--viewport WxH` to override per-game

---

## Ephemeral Delivery

Discord ephemerals can only be sent in response to an interaction (button press or slash command) — not proactively. The delivery model is:

- Player presses any movement or action button
- Bot queues their input, then responds with `interaction.reply({ ephemeral: true, files: [viewportPng], components: [movementRows] })`
- Discord automatically replaces the previous ephemeral for that user
- Players who do not press buttons do not receive view updates until their next press

This is acceptable for gameplay: active players press buttons constantly. The complexity of storing interaction tokens for push-based updates is not worth it at this stage.

---

## Image Size

| | Tiles | Canvas size | Est. PNG size |
|---|---|---|---|
| Old shared map | 24×16 | 864×672px | ~120–200KB |
| New player view | 9×7 (scaled up) | 864×672px | ~40–80KB |
| Ghost view | 24×16 | 864×672px | ~120–200KB |

Same output dimensions — smaller file due to fewer unique pixels in the cropped area.

---

## Code Changes

### `src/constants/index.js`
- Add `VIEWPORT_W = 9`
- Add `VIEWPORT_H = 7`

### `src/engine/gameManager.js`
- Store `viewportW`, `viewportH` on session at creation (defaults to constants)

### `src/renderer/renderer.js`
- Add `renderPlayerView(session, playerId)` function
  - Crop + scale logic
  - Filtered player drawing (viewport bounds check)
  - Minimap overlay
- Keep `renderFrame` unchanged (used for game-over screen + ghost view)

### `src/engine/gameEngine.js`
- `startLoop`: delete the shared channel message after game begins
- `runTick`: remove `editGameMessage` call entirely
- Button interaction handler: after queuing input, call `renderPlayerView` for the pressing player and reply ephemerally

---

## Error Handling

- If ephemeral reply fails (interaction expired >3s): log and skip — player will see their view on next button press
- Ghost view falls back to `renderFrame` — same existing error handling applies
- Minimap render errors are non-fatal: catch and skip the overlay, still send the main view

---

## Out of Scope (this spec)

- Configurable viewport via `/create` flag (noted as future work)
- Spectator view for non-players
- Meeting phase — existing meeting UI unchanged for now
