const tracks = [
  { title: 'In Confusion', file: 'audio/in-confusion.mp3', mood: 'sad' },
  { title: 'Lost In The Mall', file: 'audio/lost-in-the-mall.mp3', mood: 'calm' },
  { title: 'Neon Lambs', file: 'audio/neon-lambs.mp3', mood: 'happy' },
  { title: 'Night Shine', file: 'audio/night-shine.mp3', mood: 'romantic' },
  { title: 'Silver Wires', file: 'audio/silver-wires.mp3', mood: 'calm' },
  { title: 'Under The Roofs', file: 'audio/under-the-roofs.mp3', mood: 'sad' }
];

const moodMeta = {
  sad: { short: 'RAIN', label: 'ВЕЧЕР · ДОЖДЬ', weather: 'rain' },
  calm: { short: 'SNOW', label: 'НОЧЬ · СНЕГ', weather: 'snow' },
  happy: { short: 'SUN', label: 'ДЕНЬ · СОЛНЦЕ', weather: 'clear' },
  romantic: { short: 'DUSK', label: 'ЗАКАТ', weather: 'dust' }
};

const audio = document.querySelector('#audio');
const scene = document.querySelector('.scene');
const playButton = document.querySelector('#play');
const screenTitle = document.querySelector('#screenTitle');
const screenIndex = document.querySelector('#screenIndex');
const screenMood = document.querySelector('#screenMood');
const weatherLabel = document.querySelector('#weatherLabel');
const volumeText = document.querySelector('#volumeText');
const elapsed = document.querySelector('#elapsed');
const duration = document.querySelector('#duration');
const progress = document.querySelector('#screenProgress');
const seek = document.querySelector('#seek');
const nowScreen = document.querySelector('#nowScreen');
const allScreen = document.querySelector('#allScreen');
const allButton = document.querySelector('#allButton');
const allClose = document.querySelector('#allClose');
const trackList = document.querySelector('#trackList');
const equalizer = document.querySelector('#equalizer');
const windowField = document.querySelector('#windowField');
const canvas = document.querySelector('#weather');
const ctx = canvas.getContext('2d');

let current = 0;
let currentMood = tracks[0].mood;
let audioContext;
let analyser;
let source;
let freqData;
let timeData;
let smoothBass = 0;
let lastBeat = 0;
let lastWindowPulse = 0;
let particles = [];
let weatherMode = moodMeta[currentMood].weather;
let screenMode = 'now';
let pendingTrack = 0;

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
  screenMood.textContent = moodMeta[mood].short;
  weatherLabel.textContent = moodMeta[mood].label;
  weatherMode = moodMeta[mood].weather;
  particles = [];
}

function loadTrack(index, autoplay = false) {
  current = (index + tracks.length) % tracks.length;
  const track = tracks[current];
  audio.src = track.file;
  screenTitle.textContent = track.title.toUpperCase();
  screenIndex.textContent = `${String(current + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}`;
  smoothBass = 0;
  setMood(track.mood);
  clearWindows();
  renderTrackList();
  if (autoplay) playAudio();
}

function renderTrackList() {
  trackList.innerHTML = '';
  tracks.forEach((track, index) => {
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
      renderTrackList();
    });
    item.appendChild(button);
    trackList.appendChild(item);
  });
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

function moveTrackSelection(step) {
  pendingTrack = (pendingTrack + step + tracks.length) % tracks.length;
  renderTrackList();
}

function initAudioGraph() {
  if (audioContext) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = .7;
  source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
  freqData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);
}

async function playAudio() {
  initAudioGraph();
  if (audioContext.state === 'suspended') await audioContext.resume();
  try { await audio.play(); } catch (error) { console.warn('Playback needs a tap', error); }
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
  audio.volume = Math.max(0, Math.min(1, value));
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

function analyse(now) {
  if (!analyser || audio.paused) {
    eqBars.forEach(bar => { bar.style.height = '7%'; });
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

function makeParticle() {
  if (weatherMode === 'rain') return { x: Math.random() * innerWidth, y: -30, vx: -1.8 - Math.random() * 1.2, vy: 12 + Math.random() * 10, size: 10 + Math.random() * 18, alpha: .18 + Math.random() * .3 };
  if (weatherMode === 'snow') {
    const depth = .12 + Math.random() * .88;
    return { x: Math.random() * innerWidth, y: -8 - Math.random() * innerHeight * .28, vx: (-.1 + Math.random() * .2) * depth, vy: .08 + depth * .4, size: .35 + depth * 1.25, alpha: .12 + depth * .42, phase: Math.random() * Math.PI * 2, spin: .14 + Math.random() * .28, depth };
  }
  return { x: Math.random() * innerWidth, y: innerHeight * (.1 + Math.random() * .65), vx: -.1 + Math.random() * .2, vy: -.06 - Math.random() * .12, size: .5 + Math.random() * 1.5, alpha: .1 + Math.random() * .25 };
}

function drawWeather(now) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const target = audio.paused ? 0 : weatherMode === 'rain' ? 170 : weatherMode === 'snow' ? 145 : weatherMode === 'dust' ? 42 : 0;
  while (particles.length < target) particles.push(makeParticle());
  if (particles.length > target) particles.length = target;

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    if (weatherMode === 'rain') {
      p.x += p.vx; p.y += p.vy;
      ctx.strokeStyle = `rgba(184,213,236,${p.alpha})`;
      ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx, p.y + p.size); ctx.stroke();
    } else if (weatherMode === 'snow') {
      p.y += p.vy;
      p.x += p.vx + Math.sin(now / (1800 / p.spin) + p.phase) * (.035 + p.depth * .11);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(now * .00018 * p.spin + p.phase);
      ctx.fillStyle = `rgba(241,248,255,${p.alpha})`;
      ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * (.7 + p.depth * .18), 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      p.x += p.vx; p.y += p.vy;
      ctx.fillStyle = `rgba(255,218,166,${p.alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    if (p.y > innerHeight + 35 || p.y < -50 || p.x < -50 || p.x > innerWidth + 50) particles[i] = makeParticle();
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
audio.addEventListener('ended', () => loadTrack(current + 1, true));
audio.addEventListener('loadedmetadata', () => { duration.textContent = formatTime(audio.duration); });
audio.addEventListener('timeupdate', () => {
  elapsed.textContent = formatTime(audio.currentTime);
  duration.textContent = formatTime(audio.duration);
  progress.style.width = `${audio.duration ? (audio.currentTime / audio.duration) * 100 : 0}%`;
});
audio.addEventListener('error', () => { weatherLabel.textContent = 'ТРЕК НЕДОСТУПЕН'; });

playButton.addEventListener('click', togglePlay);
document.querySelector('#prev').addEventListener('click', () => { if (screenMode === 'now') loadTrack(current - 1, true); });
document.querySelector('#next').addEventListener('click', () => { if (screenMode === 'now') loadTrack(current + 1, true); });
document.querySelector('#volUp').addEventListener('click', () => screenMode === 'all' ? moveTrackSelection(-1) : setVolume(audio.volume + .08));
document.querySelector('#volDown').addEventListener('click', () => screenMode === 'all' ? moveTrackSelection(1) : setVolume(audio.volume - .08));
allButton.addEventListener('click', showAllTracks);
allClose.addEventListener('click', showNowPlaying);
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
  if (event.code === 'ArrowRight' && screenMode === 'now') loadTrack(current + 1, true);
  if (event.code === 'ArrowLeft' && screenMode === 'now') loadTrack(current - 1, true);
  if (event.code === 'ArrowUp') screenMode === 'all' ? moveTrackSelection(-1) : setVolume(audio.volume + .05);
  if (event.code === 'ArrowDown') screenMode === 'all' ? moveTrackSelection(1) : setVolume(audio.volume - .05);
});
window.addEventListener('resize', resizeCanvas);

setVolume(.78);
loadTrack(0);
resizeCanvas();
requestAnimationFrame(loop);
