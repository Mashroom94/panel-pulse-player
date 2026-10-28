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

export function weatherParticleTarget({ mode, paused, mobile }) {
  if (mode === 'stars') return mobile ? 105 : 90;
  if (mode === 'rain' && !paused) return mobile ? 240 : 180;
  return 0;
}

export function isSkyNormalizedPoint({ u, v }) {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return false;
  if (u < 0.105 || u > 0.895) return v >= 0 && v < 0.62;
  let roof = 0.11;
  if ((u >= 0.255 && u <= 0.335) || (u >= 0.67 && u <= 0.75)) roof = 0.045;
  else if (u >= 0.45 && u <= 0.55) roof = 0.085;
  return v >= 0 && v < roof;
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
  return track.id || `${track.file || ''}::${track.title || ''}`;
}

export function matchesTrackSearch(track, query) {
  const normalized = String(query || '').trim().toLocaleLowerCase('ru');
  if (!normalized) return true;
  return [track.title, track.artist, track.album]
    .filter(Boolean)
    .some(value => String(value).toLocaleLowerCase('ru').includes(normalized));
}

export function groupTracksByAlbum(tracks, indexes) {
  const groups = new Map();
  indexes.forEach(index => {
    const track = tracks[index];
    const album = track.album?.trim() || 'Без альбома';
    const artist = track.artist?.trim() || 'Неизвестный исполнитель';
    const key = `${album.toLocaleLowerCase('ru')}::${artist.toLocaleLowerCase('ru')}`;
    if (!groups.has(key)) groups.set(key, { album, artist, indexes: [] });
    groups.get(key).indexes.push(index);
  });
  return [...groups.values()];
}

export function albumMetadataFromPath(relativePath) {
  const parts = String(relativePath || '').split(/[\\/]+/).filter(Boolean);
  if (parts.length < 2) return { artist: '', album: '' };
  const albumFolder = parts.at(-2).trim();
  if (parts.length >= 3) {
    return { artist: parts.at(-3).trim(), album: albumFolder };
  }
  const combined = albumFolder.match(/^(.+?)\s+(?:—|–|-)\s+(.+)$/);
  if (combined) return { artist: combined[1].trim(), album: combined[2].trim() };
  return { artist: '', album: albumFolder };
}

function syncsafeSize(bytes, offset) {
  return ((bytes[offset] & 0x7f) << 21)
    | ((bytes[offset + 1] & 0x7f) << 14)
    | ((bytes[offset + 2] & 0x7f) << 7)
    | (bytes[offset + 3] & 0x7f);
}

function decodeId3Text(payload) {
  if (payload.length < 2) return '';
  const encoding = payload[0];
  const bytes = payload.subarray(1);
  try {
    if (encoding === 1 || encoding === 2) {
      const littleEndian = encoding === 1 && bytes[0] === 0xff && bytes[1] === 0xfe;
      const start = encoding === 1 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) ? 2 : 0;
      return new TextDecoder(littleEndian ? 'utf-16le' : 'utf-16be').decode(bytes.subarray(start)).replace(/\0+$/g, '').trim();
    }
    return new TextDecoder(encoding === 3 ? 'utf-8' : 'windows-1252').decode(bytes).replace(/\0+$/g, '').trim();
  } catch {
    return '';
  }
}

export function parseId3Metadata(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 10 || String.fromCharCode(...bytes.subarray(0, 3)) !== 'ID3') return {};
  const version = bytes[3];
  const tagEnd = Math.min(bytes.length, 10 + syncsafeSize(bytes, 6));
  const fields = { TIT2: 'title', TPE1: 'artist', TALB: 'album' };
  const result = {};
  let offset = 10;
  while (offset + 10 <= tagEnd) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = version === 4
      ? syncsafeSize(bytes, offset + 4)
      : new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0);
    if (!size || offset + 10 + size > tagEnd) break;
    if (fields[id]) {
      const value = decodeId3Text(bytes.subarray(offset + 10, offset + 10 + size));
      if (value) result[fields[id]] = value;
    }
    offset += 10 + size;
  }
  return result;
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
