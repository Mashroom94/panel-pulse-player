import { clampVolume, filterTrackIndexes, hasAudioSignal, rhythmPulse, startPlayback, trackKey, trackTitleFromFile, weatherSpawnY, wrapIndex } from './player-core.js';

const tracks = [
  { title: 'In Confusion', file: 'audio/in-confusion.mp3', mood: 'sad', bpm: 92 },
  { title: 'Lost In The Mall', file: 'audio/lost-in-the-mall.mp3', mood: 'calm', bpm: 82 },
  { title: 'Neon Lambs', file: 'audio/neon-lambs.mp3', mood: 'happy', bpm: 122 },
  { title: 'Night Shine', file: 'audio/night-shine.mp3', mood: 'romantic', bpm: 74 },
  { title: 'Silver Wires', file: 'audio/silver-wires.mp3', mood: 'calm', bpm: 88 },
  { title: 'Under The Roofs', file: 'audio/under-the-roofs.mp3', mood: 'sad', bpm: 96 }
];

const moodMeta = {
  sad: { label: 'ВЕЧЕР · ДОЖДЬ', weather: 'rain' },
  calm: { label: 'НОЧЬ · ЯСНО', weather: 'clear' },
  happy: { label: 'ДЕНЬ · СОЛНЦЕ', weather: 'clear' },
  romantic: { label: 'ЗВЁЗДНАЯ НОЧЬ', weather: 'stars' }
};

const audio = document.querySelector('#audio');
const scene = document.querySelector('.scene');
const playButton = document.querySelector('#play');
const screenTitle = document.querySelector('#screenTitle');
const screenIndex = document.querySelector('#screenIndex');
const weatherLabel = document.querySelector('#weatherLabel');
const volumeText = document.querySelector('#volumeText');
const elapsed = document.querySelector('#elapsed');
const duration = document.querySelector('#duration');
const progress = document.querySelector('#screenProgress');
const seek = document.querySelector('#seek');
const nowScreen = document.querySelector('#nowScreen');
const allScreen = document.querySelector('#allScreen');
const allButton = document.querySelector('#allButton');
const favoriteButton = document.querySelector('#favoriteButton');
const allClose = document.querySelector('#allClose');
const uploadButton = document.querySelector('#uploadButton');
const trackUpload = document.querySelector('#trackUpload');
const trackList = document.querySelector('#trackList');
const libraryTitle = document.querySelector('#libraryTitle');
const libraryTabs = document.querySelector('#libraryTabs');
const equalizer = document.querySelector('#equalizer');
const windowField = document.querySelector('#windowField');
const canvas = document.querySelector('#weather');
const ctx = canvas.getContext('2d');

let current = 0;
let currentMood = tracks[0].mood;
let audioContext;
let analyser;
let source;
let audioStream;
let analyserUnavailable = false;
let freqData;
let timeData;
let smoothBass = 0;
let lastBeat = 0;
let lastWindowPulse = 0;
let lastAudioSignal = 0;
let particles = [];
let weatherMode = moodMeta[currentMood].weather;
let screenMode = 'now';
let pendingTrack = 0;
let activeFilter = 'all';
const customTrackUrls = [];
const favoritesStorageKey = 'panel-pulse-favorites-v1';

const filterMeta = {
  all: { title: 'ALL TRACKS', empty: 'NO TRACKS' },
  favorites: { title: 'FAVORITES', empty: 'ADD TRACKS WITH THE HEART' },
  happy: { title: 'HAPPY', empty: 'NO HAPPY TRACKS' },
  calm: { title: 'CALM', empty: 'NO CALM TRACKS' },
  sad: { title: 'SAD', empty: 'NO SAD TRACKS' },
  romantic: { title: 'ROMANCE', empty: 'NO ROMANTIC TRACKS' }
};

function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter(value => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

let favoriteKeys = readFavorites();

const eqBars = Array.from({ length: 18 }, () => {
  const bar = document.createElement('i');
  bar.className = 'eq-bar';
  bar.style.height = '7%';
  equalizer.appendChild(bar);
  return bar;
});

// Coordinates are measured against the source photograph (1672 × 941).
// Every overlay is sized to the glass area of one real window bay.
const windowColumns = [
  { x: 12.8, w: 1.95 }, { x: 17.2, w: 2.4 },
  { x: 27.7, w: 2.0 }, { x: 32.3, w: 2.4 }, { x: 37.7, w: 2.2 },
  { x: 42.9, w: 2.2 }, { x: 55.0, w: 2.2 },
  { x: 60.2, w: 2.1 }, { x: 65.5, w: 2.1 }, { x: 70.4, w: 2.0 },
  { x: 80.4, w: 2.2 }, { x: 85.6, w: 1.9 }
];
const windowRows = [15.8, 21.5, 27.2, 32.8, 38.7, 44.4, 50.2, 56.0, 61.8, 67.8, 73.9];
const windows = [];

windowRows.forEach((y, row) => {
  windowColumns.forEach((column, col) => {
    const light = document.createElement('i');
    light.className = 'window-light';
    light.style.setProperty('--x', `${column.x}%`);
    light.style.setProperty('--y', `${y}%`);
    light.style.setProperty('--w', `${column.w}%`);
    light.style.setProperty('--h', row === 0 ? '3.15%' : '3.05%');
    light.style.setProperty('--light', (.9 + Math.random() * .1).toFixed(2));
    windowField.appendChild(light);
    windows.push(light);
  });
});

function formatTime(value) {
  if (!Number.isFinite(value)) return '0:00';
  const min = Math.floor(value / 60);
  const sec = Math.floor(value % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function setMood(mood) {
  currentMood = mood;
  document.body.classList.remove('mood-sad', 'mood-calm', 'mood-happy', 'mood-romantic');
  document.body.classList.add(`mood-${mood}`);
  weatherLabel.textContent = moodMeta[mood].label;
  weatherMode = moodMeta[mood].weather;
  particles = [];
}

function isFavorite(index) {
  return favoriteKeys.has(trackKey(tracks[index]));
}

function saveFavorites() {
  try { localStorage.setItem(favoritesStorageKey, JSON.stringify([...favoriteKeys])); } catch { /* Session-only fallback. */ }
}

function updateFavoriteButton() {
  const active = isFavorite(current);
  favoriteButton.setAttribute('aria-pressed', String(active));
  favoriteButton.setAttribute('aria-label', active ? 'Удалить текущий трек из избранного' : 'Добавить текущий трек в избранное');
  favoriteButton.title = active ? 'Убрать из избранного' : 'Добавить в избранное';
}

function toggleFavorite(index) {
  const key = trackKey(tracks[index]);
  if (favoriteKeys.has(key)) favoriteKeys.delete(key); else favoriteKeys.add(key);
  saveFavorites();
  updateFavoriteButton();
  renderTrackList();
}

function visibleTrackIndexes() {
  return filterTrackIndexes(tracks, activeFilter, favoriteKeys);
}

function loadTrack(index, autoplay = false) {
  current = wrapIndex(index, tracks.length);
  const track = tracks[current];
  audio.src = track.file;
  screenTitle.textContent = track.title.toUpperCase();
  screenIndex.textContent = `${String(current + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}`;
  smoothBass = 0;
  lastAudioSignal = 0;
  setMood(track.mood);
  updateFavoriteButton();
  clearWindows();
  renderTrackList();
  if (autoplay) playAudio();
}

function renderTrackList() {
  trackList.innerHTML = '';
  const indexes = visibleTrackIndexes();
  libraryTitle.textContent = filterMeta[activeFilter].title;
  libraryTabs.querySelectorAll('[data-filter]').forEach(button => {
    button.setAttribute('aria-selected', String(button.dataset.filter === activeFilter));
  });

  if (!indexes.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-library';
    empty.textContent = filterMeta[activeFilter].empty;
    trackList.appendChild(empty);
    return;
  }

  indexes.forEach(index => {
    const track = tracks[index];
    const item = document.createElement('li');
    item.className = 'track-item';
    item.classList.toggle('selected', index === pendingTrack);
    item.classList.toggle('current', index === current);
    const button = document.createElement('button');
    button.className = 'track-choice';
    button.type = 'button';
    button.innerHTML = `<span>${track.title.toUpperCase()}</span>`;
    button.addEventListener('click', () => {
      pendingTrack = index;
      showNowPlaying();
      loadTrack(index, true);
    });
    const favorite = document.createElement('button');
    const favoriteActive = isFavorite(index);
    favorite.className = 'track-favorite';
    favorite.type = 'button';
    favorite.setAttribute('aria-pressed', String(favoriteActive));
    favorite.setAttribute('aria-label', favoriteActive ? `Удалить ${track.title} из избранного` : `Добавить ${track.title} в избранное`);
    favorite.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2 4.3 13A5.1 5.1 0 0 1 11.5 5.8l.5.5.5-.5A5.1 5.1 0 0 1 19.7 13Z"/></svg>';
    favorite.addEventListener('click', () => toggleFavorite(index));
    item.appendChild(button);
    item.appendChild(favorite);
    trackList.appendChild(item);
  });
}

function setLibraryFilter(filter) {
  if (!filterMeta[filter]) return;
  activeFilter = filter;
  renderTrackList();
}

function moveTrack(direction, autoplay = true) {
  const queue = visibleTrackIndexes();
  const available = queue.length ? queue : filterTrackIndexes(tracks, 'all', favoriteKeys);
  const position = available.indexOf(current);
  const nextPosition = position < 0
    ? (direction > 0 ? 0 : available.length - 1)
    : wrapIndex(position + direction, available.length);
  loadTrack(available[nextPosition], autoplay);
}

function showAllTracks() {
  screenMode = 'all';
  pendingTrack = current;
  nowScreen.hidden = true;
  allScreen.hidden = false;
  scene.classList.add('browsing');
  renderTrackList();
}

function showNowPlaying() {
  screenMode = 'now';
  nowScreen.hidden = false;
  allScreen.hidden = true;
  scene.classList.remove('browsing');
}

function initAudioGraph() {
  if (audioContext || analyserUnavailable) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const captureStream = audio.captureStream || audio.mozCaptureStream;
  if (!AudioContextClass || !captureStream) {
    analyserUnavailable = true;
    return;
  }

  try {
    // Analyse a copy of the stream. The audio element keeps its native output,
    // so a suspended Web Audio context can never make the music silent.
    audioStream = captureStream.call(audio);
    audioContext = new AudioContextClass();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = .7;
    source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  } catch (error) {
    audioContext = null;
    analyser = null;
    analyserUnavailable = true;
  }
}

async function playAudio() {
  try {
    initAudioGraph();
    if (typeof audio.play !== 'function') throw new Error('Audio playback is unavailable in this browser');
    await startPlayback({
      play: () => audio.play(),
      resume: audioContext ? () => audioContext.resume() : undefined,
      contextState: audioContext?.state || 'unavailable'
    });
  } catch (error) {
    scene.classList.remove('playing');
    playButton.setAttribute('aria-label', 'Воспроизвести');
    console.warn('Playback could not start', error);
  }
}

function togglePlay() {
  if (screenMode === 'all') {
    showNowPlaying();
    loadTrack(pendingTrack, true);
    return;
  }
  if (audio.paused) playAudio(); else audio.pause();
}

function setVolume(value) {
  audio.volume = clampVolume(value);
  volumeText.textContent = Math.round(audio.volume * 100);
}

function clearWindows() {
  windows.forEach(light => light.classList.remove('lit', 'hit'));
}

function flashWindows(intensity = .5, strong = false) {
  if (audio.paused) return;
  const amount = Math.round((strong ? 18 : 7) + intensity * (strong ? 52 : 22));
  const shuffled = windows.slice().sort(() => Math.random() - .5);
  shuffled.slice(0, amount).forEach((light, index) => {
    light.classList.add('lit');
    if (strong && index < amount * .65) {
      light.classList.remove('hit');
      void light.offsetWidth;
      light.classList.add('hit');
    }
    window.setTimeout(() => light.classList.remove('lit', 'hit'), 150 + Math.random() * 420);
  });
}

function animateFallbackRhythm(now) {
  const pulse = rhythmPulse({ now, bpm: tracks[current].bpm || 96 });
  eqBars.forEach((bar, index) => {
    const wave = .3 + .7 * Math.abs(Math.sin(now * .0042 + index * .72));
    bar.style.height = `${Math.round(10 + wave * 38 + pulse * (36 + (index % 4) * 4))}%`;
  });
  if (pulse > .8 && now - lastBeat > 240) {
    lastBeat = now;
    flashWindows(.82, true);
  } else if (now - lastWindowPulse > 320) {
    lastWindowPulse = now;
    flashWindows(.45, false);
  }
}

function analyse(now) {
  if (audio.paused) {
    eqBars.forEach(bar => { bar.style.height = '7%'; });
    return;
  }

  if (!analyser) {
    animateFallbackRhythm(now);
    return;
  }

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);
  const bassEnd = Math.floor(freqData.length * .12);
  let bassSum = 0;
  for (let i = 0; i < bassEnd; i += 1) bassSum += freqData[i];
  let squareSum = 0;
  for (const value of timeData) {
    const centered = (value - 128) / 128;
    squareSum += centered * centered;
  }
  const energy = Math.sqrt(squareSum / timeData.length);
  const bass = bassSum / Math.max(1, bassEnd * 255);
  if (hasAudioSignal({ energy, bass })) lastAudioSignal = now;
  if (!lastAudioSignal || now - lastAudioSignal > 700) {
    animateFallbackRhythm(now);
    return;
  }
  smoothBass = smoothBass * .9 + bass * .1;
  const beat = bass > smoothBass * 1.22 && bass > .14 && now - lastBeat > 180;

  eqBars.forEach((bar, i) => {
    const bin = Math.floor((i / eqBars.length) ** 1.65 * (freqData.length - 1));
    bar.style.height = `${Math.max(7, (freqData[bin] / 255) * 100)}%`;
  });

  if (beat) {
    lastBeat = now;
    flashWindows(Math.min(1, bass * 1.85 + energy), true);
  } else if (now - lastWindowPulse > 210 && energy > .055) {
    lastWindowPulse = now;
    flashWindows(Math.min(1, energy * 2.8), false);
  }
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  particles = [];
}

function makeParticle(initial = true) {
  if (weatherMode === 'rain') return { x: Math.random() * (innerWidth + 40) - 20, y: weatherSpawnY({ height: innerHeight, initial }), vx: -.55 - Math.random() * 1.1, vy: 12 + Math.random() * 10, size: 14 + Math.random() * 20, alpha: .3 + Math.random() * .36 };
  const skyHeight = Math.max(42, innerHeight * .12);
  return { x: Math.random() * innerWidth, y: Math.random() * skyHeight, vx: 0, vy: 0, size: .35 + Math.random() * .85, alpha: .24 + Math.random() * .58, phase: Math.random() * Math.PI * 2, twinkle: .0007 + Math.random() * .0012 };
}

function drawWeather(now) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const target = audio.paused ? 0 : weatherMode === 'rain' ? (innerWidth <= 600 ? 240 : 180) : weatherMode === 'stars' ? 60 : 0;
  while (particles.length < target) particles.push(makeParticle(true));
  if (particles.length > target) particles.length = target;

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    if (weatherMode === 'rain') {
      p.x += p.vx; p.y += p.vy;
      ctx.strokeStyle = `rgba(184,213,236,${p.alpha})`;
      ctx.lineWidth = .9;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx, p.y + p.size); ctx.stroke();
    } else if (weatherMode === 'stars') {
      const shimmer = .58 + Math.sin(now * p.twinkle + p.phase) * .34;
      ctx.fillStyle = `rgba(220,234,255,${Math.max(.08, p.alpha * shimmer)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else {
      continue;
    }
    if (p.y > innerHeight + 35 || p.y < -50 || p.x < -50 || p.x > innerWidth + 50) particles[i] = makeParticle(false);
  }
}

function loop(now) {
  analyse(now);
  drawWeather(now);
  requestAnimationFrame(loop);
}

audio.addEventListener('play', () => {
  scene.classList.add('playing');
  playButton.setAttribute('aria-label', 'Пауза');
});
audio.addEventListener('pause', () => {
  scene.classList.remove('playing');
  playButton.setAttribute('aria-label', 'Воспроизвести');
  clearWindows();
  particles = [];
});
audio.addEventListener('ended', () => moveTrack(1, true));
audio.addEventListener('loadedmetadata', () => { duration.textContent = formatTime(audio.duration); });
audio.addEventListener('timeupdate', () => {
  elapsed.textContent = formatTime(audio.currentTime);
  duration.textContent = formatTime(audio.duration);
  progress.style.width = `${audio.duration ? (audio.currentTime / audio.duration) * 100 : 0}%`;
});
audio.addEventListener('error', () => { weatherLabel.textContent = 'ТРЕК НЕДОСТУПЕН'; });

playButton.addEventListener('click', togglePlay);
document.querySelector('#prev').addEventListener('click', () => { if (screenMode === 'now') moveTrack(-1, true); });
document.querySelector('#next').addEventListener('click', () => { if (screenMode === 'now') moveTrack(1, true); });
document.querySelector('#volUp').addEventListener('click', () => setVolume(audio.volume + .08));
document.querySelector('#volDown').addEventListener('click', () => setVolume(audio.volume - .08));
allButton.addEventListener('click', showAllTracks);
favoriteButton.addEventListener('click', () => toggleFavorite(current));
allClose.addEventListener('click', showNowPlaying);
libraryTabs.addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (button) setLibraryFilter(button.dataset.filter);
});
uploadButton.addEventListener('click', () => trackUpload.click());
trackUpload.addEventListener('change', () => {
  const files = Array.from(trackUpload.files || []).filter(file => file.type.startsWith('audio/'));
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    customTrackUrls.push(url);
    tracks.push({ title: trackTitleFromFile(file.name), file: url, mood: 'calm', custom: true });
  });
  trackUpload.value = '';
  if (files.length) renderTrackList();
});
seek.addEventListener('click', event => {
  if (!audio.duration) return;
  const rect = seek.getBoundingClientRect();
  audio.currentTime = Math.max(0, Math.min(audio.duration, ((event.clientX - rect.left) / rect.width) * audio.duration));
});

document.querySelectorAll('.screen-swatch').forEach(button => {
  button.addEventListener('click', () => {
    document.body.dataset.color = button.dataset.color;
    document.querySelectorAll('.screen-swatch').forEach(node => {
      const active = node === button;
      node.classList.toggle('active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    clearWindows();
    if (!audio.paused) flashWindows(.92, true);
  });
});

document.addEventListener('keydown', event => {
  if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
  if (event.code === 'ArrowRight' && screenMode === 'now') moveTrack(1, true);
  if (event.code === 'ArrowLeft' && screenMode === 'now') moveTrack(-1, true);
  if (event.code === 'ArrowUp') setVolume(audio.volume + .05);
  if (event.code === 'ArrowDown') setVolume(audio.volume - .05);
});
window.addEventListener('resize', resizeCanvas);
window.addEventListener('beforeunload', () => customTrackUrls.forEach(url => URL.revokeObjectURL(url)));

setVolume(.78);
loadTrack(0);
resizeCanvas();
requestAnimationFrame(loop);
