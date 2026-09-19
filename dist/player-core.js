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
