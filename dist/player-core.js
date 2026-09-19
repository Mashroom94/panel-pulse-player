export function wrapIndex(index, length) {
  return ((index % length) + length) % length;
}

export function clampVolume(value) {
  return Math.max(0, Math.min(1, value));
}

export function formatTime(value) {
  if (!Number.isFinite(value)) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function lightLevel(isPlaying) {
  return isPlaying ? 1 : 0;
}
