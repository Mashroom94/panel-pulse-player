import test from 'node:test';
import assert from 'node:assert/strict';
import { clampVolume, formatTime, wrapIndex, lightLevel } from '../dist/player-core.js';

test('wrapIndex cycles track indices in both directions', () => {
  assert.equal(wrapIndex(6, 6), 0);
  assert.equal(wrapIndex(-1, 6), 5);
});

test('clampVolume keeps volume inside the audio range', () => {
  assert.equal(clampVolume(1.2), 1);
  assert.equal(clampVolume(-0.2), 0);
  assert.equal(clampVolume(0.78), 0.78);
});

test('formatTime returns player-friendly minutes and seconds', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(125.8), '2:05');
  assert.equal(formatTime(Number.NaN), '0:00');
});

test('window light level stays constant while a track is playing', () => {
  assert.equal(lightLevel(true), 1);
  assert.equal(lightLevel(false), 0);
});
