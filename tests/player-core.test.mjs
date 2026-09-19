import test from 'node:test';
import assert from 'node:assert/strict';
import { clampVolume, trackTitleFromFile, weatherSpawnY, wrapIndex } from '../dist/player-core.js';

test('wrapIndex cycles through every available track', () => {
  assert.equal(wrapIndex(6, 6), 0);
  assert.equal(wrapIndex(-1, 6), 5);
});

test('clampVolume keeps wheel volume controls in the audio range', () => {
  assert.equal(clampVolume(1.08), 1);
  assert.equal(clampVolume(-0.08), 0);
  assert.equal(clampVolume(0.54), 0.54);
});

test('trackTitleFromFile turns an uploaded filename into a readable title', () => {
  assert.equal(trackTitleFromFile('my-night_song.mp3'), 'my night song');
  assert.equal(trackTitleFromFile('Track.WAV'), 'Track');
});

test('weatherSpawnY fills the visible mobile weather field on first render', () => {
  const y = weatherSpawnY({ height: 800, initial: true, random: 0.75 });
  assert.equal(y, 600);
  assert.equal(weatherSpawnY({ height: 800, initial: false, random: 0.75 }), -30);
});
