import assert from 'node:assert/strict';
import test from 'node:test';
import { getEvolution } from './evolution';

test('evolution changes form, size and color exactly at the five nutrition thresholds', () => {
  const thresholds = [0, 3, 7, 12, 18];
  const bodies = ['seed', 'sprout', 'horned', 'winged', 'crowned'];
  const scales = [1, 1.13, 1.28, 1.45, 1.65];
  const hues = [0, 45, 130, 200, 270];
  thresholds.forEach((xp, stage) => {
    const evolution = getEvolution(xp);
    assert.equal(evolution.stage, stage);
    assert.equal(evolution.threshold, xp);
    assert.equal(evolution.nextThreshold, thresholds[stage + 1] ?? null);
    assert.equal(evolution.body, bodies[stage]);
    assert.equal(evolution.scale, scales[stage]);
    assert.equal(evolution.hue, hues[stage]);
    assert.equal(evolution.progress, stage === 4 ? 1 : 0);
    if (xp > 0) assert.equal(getEvolution(xp - 1).stage, stage - 1);
  });
});

test('bait and webpage food contribute equally, with bounded stage progress', () => {
  assert.deepEqual(getEvolution(4, 3), getEvolution(7));
  assert.equal(getEvolution(1).progress, 1 / 3);
  assert.equal(getEvolution(5).progress, 0.5);
  assert.equal(getEvolution(1000).stage, 4);
  assert.equal(getEvolution(1000).progress, 1);
  assert.equal(getEvolution(1000).nextThreshold, null);
});

test('invalid counts cannot create negative or non-finite evolution values', () => {
  assert.equal(getEvolution(-10, 3).xp, 3);
  assert.equal(getEvolution(NaN, Infinity).xp, 0);
  assert.equal(getEvolution(2.9, 1.8).xp, 3);
});
