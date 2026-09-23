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
