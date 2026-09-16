const tracks = [
  { title: 'In Confusion', file: 'audio/in-confusion.mp3', seed: 'sad' },
  { title: 'Lost In The Mall', file: 'audio/lost-in-the-mall.mp3', seed: 'calm' },
  { title: 'Neon Lambs', file: 'audio/neon-lambs.mp3', seed: 'happy' },
  { title: 'Night Shine', file: 'audio/night-shine.mp3', seed: 'romantic' },
  { title: 'Silver Wires', file: 'audio/silver-wires.mp3', seed: 'calm' },
  { title: 'Under The Roofs', file: 'audio/under-the-roofs.mp3', seed: 'sad' }
];

const moodMeta = {
  sad: { label: 'ГРУСТНАЯ · ВЕЧЕР / ДОЖДЬ', short: 'RAIN', weather: 'rain', icon: '╱╱' },
  calm: { label: 'СПОКОЙНАЯ · НОЧЬ / СНЕГ', short: 'SNOW', weather: 'snow', icon: '✣' },
  happy: { label: 'ВЕСЁЛАЯ · ДЕНЬ / СОЛНЦЕ', short: 'SUN', weather: 'clear', icon: '☀' },
  romantic: { label: 'РОМАНТИЧНАЯ · ЗАКАТ', short: 'DUSK', weather: 'dust', icon: '◐' }
};

const audio = document.querySelector('#audio');
const playButton = document.querySelector('#play');
const screenTitle = document.querySelector('#screenTitle');
const screenIndex = document.querySelector('#screenIndex');
const screenMood = document.querySelector('#screenMood');
const nowTitle = document.querySelector('#nowTitle');
const trackCounter = document.querySelector('#trackCounter');
const moodLabel = document.querySelector('#moodLabel');
const elapsed = document.querySelector('#elapsed');
const duration = document.querySelector('#duration');
const progress = document.querySelector('#screenProgress');
const trackButtons = document.querySelector('#trackButtons');
const equalizer = document.querySelector('#equalizer');
const windowField = document.querySelector('#windowField');
const tracklist = document.querySelector('.tracklist');
const volumeText = document.querySelector('#volumeText');
const canvas = document.querySelector('#weather');
const ctx = canvas.getContext('2d');

let current = 0;
let currentMood = tracks[0].seed;
let audioContext;
let analyser;
let source;
let freqData;
let timeData;
let smoothBass = 0;
let lastBeat = 0;
let featureFrames = [];
let lastClassify = 0;
let userMutedVolume = .78;
let particles = [];
let weatherMode = moodMeta[currentMood].weather;

const eqBars = Array.from({ length: 18 }, () => {
  const bar = document.createElement('i');
  bar.className = 'eq-bar';
  bar.style.height = `${10 + Math.random() * 25}%`;
  equalizer.appendChild(bar);
  return bar;
});

const windows = Array.from({ length: 150 }, (_, index) => {
  const light = document.createElement('i');
  light.className = 'window-light';
  light.dataset.index = index;
  light.style.setProperty('--light', (.62 + Math.random() * .35).toFixed(2));
  if (Math.random() > .82) light.classList.add('on');
  windowField.appendChild(light);
  return light;
});

tracks.forEach((track, index) => {
  const button = document.createElement('button');
  button.className = 'track-row';
  button.innerHTML = `<span class="num">${String(index + 1).padStart(2, '0')}</span><strong>${track.title}</strong><span class="mood-icon">${moodMeta[track.seed].icon}</span>`;
  button.setAttribute('aria-label', `Включить ${track.title}`);
  button.addEventListener('click', () => loadTrack(index, true));
  trackButtons.appendChild(button);
});

function formatTime(value) {
  if (!Number.isFinite(value)) return '0:00';
  const min = Math.floor(value / 60);
  const sec = Math.floor(value % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function setMood(mood) {
  if (!moodMeta[mood]) return;
  currentMood = mood;
  document.body.classList.remove('mood-sad', 'mood-calm', 'mood-happy', 'mood-romantic');
  document.body.classList.add(`mood-${mood}`);
  moodLabel.textContent = moodMeta[mood].label;
  screenMood.textContent = moodMeta[mood].short;
  weatherMode = moodMeta[mood].weather;
  particles = [];
}

function loadTrack(index, autoplay = false) {
  current = (index + tracks.length) % tracks.length;
  const track = tracks[current];
  audio.src = track.file;
  screenTitle.textContent = track.title.toUpperCase();
  nowTitle.textContent = track.title;
  screenIndex.textContent = String(current + 1).padStart(2, '0');
  trackCounter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}`;
  [...trackButtons.children].forEach((node, i) => node.classList.toggle('active', i === current));
  featureFrames = [];
  setMood(track.seed);
  if (autoplay) playAudio();
}

function initAudioGraph() {
  if (audioContext) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = .72;
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
  if (audio.paused) playAudio(); else audio.pause();
}

function setVolume(value) {
  audio.volume = Math.max(0, Math.min(1, value));
  if (audio.volume > 0) userMutedVolume = audio.volume;
  volumeText.textContent = Math.round(audio.volume * 100);
}

function classifyMood() {
  if (featureFrames.length < 80) return tracks[current].seed;
  const sample = featureFrames.slice(-220);
  const avg = key => sample.reduce((sum, f) => sum + f[key], 0) / sample.length;
  const energy = avg('energy');
  const brightness = avg('brightness');
  const bass = avg('bass');
  const pulse = avg('pulse');

  if (energy > .19 && (brightness > .32 || pulse > .22)) return 'happy';
  if (energy < .105 && brightness < .29) return 'calm';
  if (brightness < .245 && bass > .42) return 'sad';
  return 'romantic';
}

function lightWindows(intensity = .5) {
  const amount = Math.round(10 + intensity * 30);
  windows.forEach(light => {
    if (Math.random() < .2) light.classList.remove('on', 'pulse');
  });
  for (let i = 0; i < amount; i += 1) {
    const light = windows[Math.floor(Math.random() * windows.length)];
    light.classList.add('on');
    light.classList.remove('pulse');
    void light.offsetWidth;
    light.classList.add('pulse');
  }
}

function analyse(now) {
  if (!analyser || audio.paused) {
    eqBars.forEach((bar, i) => { bar.style.height = `${9 + Math.sin(now / 520 + i) * 5 + Math.random() * 3}%`; });
    return;
  }
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  let spectralSum = 0;
  let magnitudeSum = 0;
  let total = 0;
  let bassSum = 0;
  const bassEnd = Math.floor(freqData.length * .12);
  for (let i = 0; i < freqData.length; i += 1) {
    const value = freqData[i];
    total += value;
    magnitudeSum += value;
    spectralSum += value * i;
    if (i < bassEnd) bassSum += value;
  }
  let squareSum = 0;
  for (const value of timeData) {
    const centered = (value - 128) / 128;
    squareSum += centered * centered;
  }
  const energy = Math.sqrt(squareSum / timeData.length);
  const bass = bassSum / Math.max(1, bassEnd * 255);
  const brightness = magnitudeSum ? (spectralSum / magnitudeSum) / freqData.length : 0;
  smoothBass = smoothBass * .91 + bass * .09;
  const beat = bass > smoothBass * 1.24 && bass > .16 && now - lastBeat > 190;

  featureFrames.push({ energy, brightness, bass, pulse: beat ? 1 : 0 });
  if (featureFrames.length > 320) featureFrames.shift();

  eqBars.forEach((bar, i) => {
    const bin = Math.floor((i / eqBars.length) ** 1.7 * (freqData.length - 1));
    bar.style.height = `${Math.max(6, (freqData[bin] / 255) * 100)}%`;
  });

  if (beat) {
    lastBeat = now;
    lightWindows(Math.min(1, bass * 1.7 + energy));
  }
  if (now - lastClassify > 8000) {
    lastClassify = now;
    setMood(classifyMood());
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
  if (weatherMode === 'rain') return { x: Math.random() * innerWidth, y: -30, vx: -2.2, vy: 12 + Math.random() * 11, size: 9 + Math.random() * 18, alpha: .2 + Math.random() * .34 };
  if (weatherMode === 'snow') return { x: Math.random() * innerWidth, y: -15, vx: -.7 + Math.random() * 1.4, vy: .7 + Math.random() * 1.8, size: 1.5 + Math.random() * 3.8, alpha: .35 + Math.random() * .6, phase: Math.random() * 6.28 };
  return { x: Math.random() * innerWidth, y: innerHeight * (.12 + Math.random() * .62), vx: -.1 + Math.random() * .2, vy: -.08 - Math.random() * .15, size: .6 + Math.random() * 1.8, alpha: .12 + Math.random() * .3 };
}

function drawWeather(now) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const target = weatherMode === 'rain' ? 180 : weatherMode === 'snow' ? 130 : weatherMode === 'dust' ? 46 : 0;
  while (particles.length < target) particles.push(makeParticle());
  if (particles.length > target) particles.length = target;

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    if (weatherMode === 'rain') {
      p.x += p.vx; p.y += p.vy;
      ctx.strokeStyle = `rgba(184,213,236,${p.alpha})`;
      ctx.lineWidth = .75;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx, p.y + p.size); ctx.stroke();
    } else if (weatherMode === 'snow') {
      p.y += p.vy; p.x += p.vx + Math.sin(now / 800 + p.phase) * .34;
      ctx.fillStyle = `rgba(235,246,255,${p.alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else {
      p.x += p.vx; p.y += p.vy;
      ctx.fillStyle = `rgba(255,218,166,${p.alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    if (p.y > innerHeight + 35 || p.y < -40 || p.x < -40 || p.x > innerWidth + 40) particles[i] = makeParticle();
  }
}

function loop(now) {
  analyse(now);
  drawWeather(now);
  requestAnimationFrame(loop);
}

audio.addEventListener('play', () => {
  playButton.textContent = 'Ⅱ';
  playButton.setAttribute('aria-label', 'Пауза');
});
audio.addEventListener('pause', () => {
  playButton.textContent = '▶';
  playButton.setAttribute('aria-label', 'Воспроизвести');
});
audio.addEventListener('ended', () => loadTrack(current + 1, true));
audio.addEventListener('loadedmetadata', () => { duration.textContent = formatTime(audio.duration); });
audio.addEventListener('timeupdate', () => {
  elapsed.textContent = formatTime(audio.currentTime);
  duration.textContent = formatTime(audio.duration);
  progress.style.width = `${audio.duration ? (audio.currentTime / audio.duration) * 100 : 0}%`;
});
audio.addEventListener('error', () => {
  moodLabel.textContent = 'ТРЕК НЕДОСТУПЕН · ВЫБЕРИТЕ ДРУГОЙ';
});

playButton.addEventListener('click', togglePlay);
document.querySelector('#prev').addEventListener('click', () => loadTrack(current - 1, true));
document.querySelector('#next').addEventListener('click', () => loadTrack(current + 1, true));
document.querySelector('#listToggle').addEventListener('click', () => tracklist.classList.toggle('open'));
document.querySelector('#volUp').addEventListener('click', () => setVolume(audio.volume + .08));
document.querySelector('#volDown').addEventListener('click', () => setVolume(audio.volume - .08));
document.querySelector('#mute').addEventListener('click', () => setVolume(audio.volume ? 0 : userMutedVolume));

document.querySelectorAll('.swatch').forEach(button => {
  button.addEventListener('click', () => {
    document.body.dataset.color = button.dataset.color;
    document.querySelectorAll('.swatch').forEach(node => {
      const active = node === button;
      node.classList.toggle('active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    lightWindows(.9);
  });
});

document.addEventListener('keydown', event => {
  if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
  if (event.code === 'ArrowRight') loadTrack(current + 1, true);
  if (event.code === 'ArrowLeft') loadTrack(current - 1, true);
  if (event.code === 'ArrowUp') setVolume(audio.volume + .05);
  if (event.code === 'ArrowDown') setVolume(audio.volume - .05);
});
window.addEventListener('resize', resizeCanvas);

setVolume(.78);
loadTrack(0);
resizeCanvas();
lightWindows(.4);
requestAnimationFrame(loop);
