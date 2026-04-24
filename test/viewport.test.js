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
