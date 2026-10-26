export function wrapIndex(index, length) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

export function clampVolume(value) {
  return Math.max(0, Math.min(1, value));
}

export function trackTitleFromFile(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'My track';
}

export function weatherSpawnY({ height, initial, random = Math.random() }) {
  return initial ? random * height : -30;
}

export async function startPlayback({ play, resume, contextState }) {
  // Start both operations during the original user gesture. Awaiting resume()
  // before play() can make mobile browsers reject playback as autoplay.
  const playPromise = play();
  let resumePromise;
  if (contextState === 'suspended' && typeof resume === 'function') {
    try {
      resumePromise = resume();
    } catch {
      // The analyser is optional; native audio playback must keep working.
    }
  }

  await playPromise;
  if (resumePromise) await Promise.resolve(resumePromise).catch(() => {});
}

export function rhythmPulse({ now, bpm }) {
  const beatMs = 60000 / Math.max(1, bpm);
  const phase = ((now % beatMs) + beatMs) % beatMs / beatMs;
  return Math.exp(-phase * 6);
}

export function hasAudioSignal({ energy, bass }) {
  return energy > 0.008 || bass > 0.008;
}

export function trackKey(track) {
  return `${track.file || ''}::${track.title || ''}`;
}

export function filterTrackIndexes(tracks, filter, favorites = new Set()) {
  return tracks.reduce((indexes, track, index) => {
    const matches = filter === 'all'
      || (filter === 'favorites' && favorites.has(trackKey(track)))
      || track.mood === filter;
    if (matches) indexes.push(index);
    return indexes;
  }, []);
}

export function classifyMood({ bpm = 96, energy = 0.4, brightness = 0.4 }) {
  if (bpm >= 108 && energy >= 0.58) return 'happy';
  if (energy <= 0.33) return 'calm';
  if (brightness >= 0.55 && bpm <= 105) return 'romantic';
  if (brightness <= 0.42 || energy <= 0.5) return 'sad';
  return bpm >= 104 ? 'happy' : 'romantic';
}

export function formatTrackSummary(filter, total, filteredTotal = total) {
  if (filter === 'all') return String(total);
  const labels = { favorites: 'FAV', happy: 'JOY', calm: 'CALM', sad: 'SAD', romantic: 'LOVE' };
  return `${labels[filter] || String(filter).toUpperCase()} · ${filteredTotal}`;
}

export function analyzePcmFeatures(samples, sampleRate) {
  const limit = Math.min(samples.length, Math.max(1, Math.floor(sampleRate * 90)));
  const envelopeRate = 100;
  const hop = Math.max(1, Math.floor(sampleRate / envelopeRate));
  const envelope = [];
  let squareSum = 0;
  let zeroCrossings = 0;
  let differenceSum = 0;
  let previous = samples[0] || 0;

  for (let start = 0; start < limit; start += hop) {
    const end = Math.min(limit, start + hop);
    let blockSquareSum = 0;
    for (let index = start; index < end; index += 1) {
      const value = samples[index];
      squareSum += value * value;
      blockSquareSum += value * value;
      if ((value >= 0) !== (previous >= 0)) zeroCrossings += 1;
      differenceSum += Math.abs(value - previous);
      previous = value;
    }
    envelope.push(Math.sqrt(blockSquareSum / Math.max(1, end - start)));
  }

  const mean = envelope.reduce((sum, value) => sum + value, 0) / Math.max(1, envelope.length);
  const centered = envelope.map(value => Math.max(0, value - mean * 0.72));
  let bestBpm = 96;
  let bestScore = -Infinity;
  for (let bpm = 60; bpm <= 180; bpm += 1) {
    const lag = Math.max(1, Math.round(envelopeRate * 60 / bpm));
    let score = 0;
    for (let index = lag; index < centered.length; index += 1) {
      score += centered[index] * centered[index - lag];
    }
    score /= Math.max(1, centered.length - lag);
    score *= 1 + Math.min(120, bpm) / 1000;
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  const rms = Math.sqrt(squareSum / Math.max(1, limit));
  return {
    bpm: bestBpm,
    energy: Math.max(0, Math.min(1, rms * 2.7)),
    brightness: Math.max(0, Math.min(1, Math.max(
      (zeroCrossings / Math.max(1, limit - 1)) * 8,
      (differenceSum / Math.max(1, limit - 1)) * 12
    )))
  };
}
