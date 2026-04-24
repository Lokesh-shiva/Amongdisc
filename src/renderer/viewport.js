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
