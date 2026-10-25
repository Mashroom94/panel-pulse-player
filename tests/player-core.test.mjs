import test from 'node:test';
import assert from 'node:assert/strict';
import { clampVolume, filterTrackIndexes, hasAudioSignal, rhythmPulse, startPlayback, trackKey, trackTitleFromFile, weatherSpawnY, wrapIndex } from '../dist/player-core.js';

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

test('startPlayback starts the media before waiting for the audio graph to resume', async () => {
  const calls = [];
  let releaseResume;
  const resumeGate = new Promise(resolve => { releaseResume = resolve; });

  const pending = startPlayback({
    play: () => { calls.push('play'); return Promise.resolve(); },
    resume: () => { calls.push('resume'); return resumeGate; },
    contextState: 'suspended'
  });

  assert.deepEqual(calls, ['play', 'resume']);
  releaseResume();
  await pending;
});

test('startPlayback still plays when an audio graph is unavailable', async () => {
  let played = false;
  await startPlayback({
    play: () => { played = true; return Promise.resolve(); },
    contextState: 'unavailable'
  });
  assert.equal(played, true);
});

test('rhythmPulse creates a visible beat fallback without changing audio routing', () => {
  assert.equal(rhythmPulse({ now: 0, bpm: 120 }), 1);
  assert.ok(rhythmPulse({ now: 180, bpm: 120 }) < 0.4);
  assert.ok(rhythmPulse({ now: 500, bpm: 120 }) > 0.99);
});

test('hasAudioSignal detects browsers that return an empty analyser stream', () => {
  assert.equal(hasAudioSignal({ energy: 0, bass: 0 }), false);
  assert.equal(hasAudioSignal({ energy: 0.012, bass: 0.004 }), true);
});

test('filterTrackIndexes builds mood and favorites queues', () => {
  const library = [
    { title: 'Rain', file: 'rain.mp3', mood: 'sad' },
    { title: 'Sun', file: 'sun.mp3', mood: 'happy' },
    { title: 'Night', file: 'night.mp3', mood: 'romantic' }
  ];
  const favorites = new Set([trackKey(library[1]), trackKey(library[2])]);

  assert.deepEqual(filterTrackIndexes(library, 'all', favorites), [0, 1, 2]);
  assert.deepEqual(filterTrackIndexes(library, 'favorites', favorites), [1, 2]);
  assert.deepEqual(filterTrackIndexes(library, 'sad', favorites), [0]);
});
