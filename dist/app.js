import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { clampVolume, formatTime, lightLevel, wrapIndex } from './player-core.js';

const tracks = [
  { title:'In Confusion', file:'audio/in-confusion.mp3', mood:'sad' },
  { title:'Lost In The Mall', file:'audio/lost-in-the-mall.mp3', mood:'calm' },
  { title:'Neon Lambs', file:'audio/neon-lambs.mp3', mood:'happy' },
  { title:'Night Shine', file:'audio/night-shine.mp3', mood:'romantic' },
  { title:'Silver Wires', file:'audio/silver-wires.mp3', mood:'calm' },
  { title:'Under The Roofs', file:'audio/under-the-roofs.mp3', mood:'sad' }
];
const moods = {
  sad:{ short:'RAIN', label:'ВЕЧЕР · ДОЖДЬ', sky:0x182735, fog:0x101a22, house:0x343b3e },
  calm:{ short:'NIGHT', label:'НОЧЬ · ЯСНО', sky:0x081226, fog:0x09101d, house:0x252b30 },
  happy:{ short:'SUN', label:'ДЕНЬ · СОЛНЦЕ', sky:0x668eaa, fog:0x8296a2, house:0x686b67 },
  romantic:{ short:'STARS', label:'ЗВЁЗДНАЯ НОЧЬ', sky:0x090d22, fog:0x0b0c19, house:0x282932 }
};
const colors = [0x46a8ff,0x48f78b,0xff4fb7,0xffe44f,0xff7b32];

const canvas = document.querySelector('#stage');
const audio = document.querySelector('#audio');
const a11yNow = document.querySelector('#a11yNow');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
} catch {
  document.querySelector('#webglError').hidden = false;
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x182735);
scene.fog = new THREE.FogExp2(0x101a22, .021);
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .1, 120);
camera.position.set(0, 4.2, 17);
scene.add(camera);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .06;
controls.enablePan = false;
controls.minDistance = 13;
controls.maxDistance = 20;
controls.minPolarAngle = .92;
controls.maxPolarAngle = 1.46;
controls.minAzimuthAngle = -.62;
controls.maxAzimuthAngle = .62;
controls.target.set(0, 4.2, -1.5);

const hemi = new THREE.HemisphereLight(0xb7d4ec, 0x101214, 1.15);
scene.add(hemi);
const moonKey = new THREE.DirectionalLight(0xbedcff, 2.15);
moonKey.position.set(-8, 15, 10);
moonKey.castShadow = true;
moonKey.shadow.mapSize.set(2048, 2048);
moonKey.shadow.camera.left = -14;
moonKey.shadow.camera.right = 14;
moonKey.shadow.camera.top = 14;
moonKey.shadow.camera.bottom = -4;
scene.add(moonKey);
const warmKey = new THREE.DirectionalLight(0xffd89a, 0);
warmKey.position.set(10, 13, 6);
scene.add(warmKey);

const skyUniforms = { top:{ value:new THREE.Color(0x334c61) }, bottom:{ value:new THREE.Color(0x081018) } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(70, 32, 18),
  new THREE.ShaderMaterial({
    side:THREE.BackSide,
    depthWrite:false,
    uniforms:skyUniforms,
    vertexShader:'varying vec3 vPos; void main(){vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 top; uniform vec3 bottom; varying vec3 vPos; void main(){float h=smoothstep(-12.0,28.0,vPos.y); gl_FragColor=vec4(mix(bottom,top,h),1.0);}'
  })
);
scene.add(sky);

const asphalt = new THREE.Mesh(
  new THREE.PlaneGeometry(70, 42),
  new THREE.MeshStandardMaterial({ color:0x12191d, roughness:.34, metalness:.22 })
);
asphalt.rotation.x = -Math.PI / 2;
asphalt.position.set(0, -.03, 2);
asphalt.receiveShadow = true;
scene.add(asphalt);
for (let i=0;i<18;i+=1) {
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(.35+Math.random()*1.4,20), new THREE.MeshPhysicalMaterial({color:0x152733,roughness:.12,metalness:.35,transparent:true,opacity:.34}));
  puddle.rotation.x = -Math.PI/2;
  puddle.scale.y = .28 + Math.random()*.42;
  puddle.position.set((Math.random()-.5)*24,.006,2+Math.random()*12);
  scene.add(puddle);
}

const building = new THREE.Group();
building.position.set(0,0,-2.6);
scene.add(building);
const concreteMaterial = new THREE.MeshStandardMaterial({ color:0x3d4447, roughness:.91, metalness:.02 });
const concrete = new THREE.Mesh(new THREE.BoxGeometry(17.2,9.4,2.15), concreteMaterial);
concrete.position.y = 4.7;
concrete.castShadow = true;
concrete.receiveShadow = true;
building.add(concrete);

const seamMat = new THREE.MeshStandardMaterial({color:0x252b2e,roughness:1});
for(let floor=1;floor<11;floor+=1){
  const seam=new THREE.Mesh(new THREE.BoxGeometry(17.22,.022,.025),seamMat);
  seam.position.set(0,.48+floor*.79,1.083);
  building.add(seam);
}
for(let col=1;col<13;col+=1){
  const seam=new THREE.Mesh(new THREE.BoxGeometry(.022,9.36,.025),seamMat);
  seam.position.set(-8.6+col*1.32,4.7,1.083);
  building.add(seam);
}

const windowMeshes=[];
const windowMaterial=new THREE.MeshBasicMaterial({color:colors[0],toneMapped:false});
const darkGlass=new THREE.MeshPhysicalMaterial({color:0x07131b,roughness:.26,metalness:.18,transparent:true,opacity:.88});
const cols=[-7.65,-6.55,-5.4,-3.25,-2.05,-.95,.95,2.05,3.25,5.4,6.55,7.65];
const balconyXs=[-4.4,0,4.4];
for(let floor=0;floor<11;floor+=1){
  const y=.84+floor*.79;
  cols.forEach((x,col)=>{
    const frame=new THREE.Mesh(new THREE.BoxGeometry(.57,.39,.08),new THREE.MeshStandardMaterial({color:0x75838a,roughness:.72}));
    frame.position.set(x,y,1.12);
    building.add(frame);
    const glass=new THREE.Mesh(new THREE.BoxGeometry(.49,.31,.055),darkGlass);
    glass.position.set(x,y,1.17);
    building.add(glass);
    const light=new THREE.Mesh(new THREE.BoxGeometry(.48,.3,.06),windowMaterial);
    light.position.set(x,y,1.205);
    light.visible=false;
    light.userData={offAt:0,phase:(floor*13+col)*.71};
    building.add(light);
    windowMeshes.push(light);
  });
}

const balconyGlass=new THREE.MeshPhysicalMaterial({color:0x273c49,roughness:.18,metalness:.1,transparent:true,opacity:.52});
const railMat=new THREE.MeshStandardMaterial({color:0x738087,roughness:.58,metalness:.5});
balconyXs.forEach(x=>{
  for(let floor=0;floor<11;floor+=1){
    const y=.72+floor*.79;
    const slab=new THREE.Mesh(new THREE.BoxGeometry(1.02,.09,.78),concreteMaterial);
    slab.position.set(x,y,1.38);
    slab.castShadow=true;
    building.add(slab);
    const glass=new THREE.Mesh(new THREE.BoxGeometry(.96,.35,.035),balconyGlass);
    glass.position.set(x,y+.25,1.77);
    building.add(glass);
    [-.48,0,.48].forEach(dx=>{
      const post=new THREE.Mesh(new THREE.BoxGeometry(.025,.48,.025),railMat);
      post.position.set(x+dx,y+.25,1.8);
      building.add(post);
    });
    const topRail=new THREE.Mesh(new THREE.BoxGeometry(1.06,.025,.035),railMat);
    topRail.position.set(x,y+.49,1.8);
    building.add(topRail);
  }
});

const entrance=new THREE.Mesh(new RoundedBoxGeometry(1.35,.82,.22,4,.04),new THREE.MeshStandardMaterial({color:0x10171b,roughness:.7,metalness:.3}));
entrance.position.set(0,.45,1.18);
building.add(entrance);
[-5.8,0,5.8].forEach(x=>{
  const roof=new THREE.Mesh(new THREE.BoxGeometry(1.8,.75,1.45),concreteMaterial);
  roof.position.set(x,9.78,0);
  roof.castShadow=true;
  building.add(roof);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,1.8,8),railMat);
  mast.position.set(x,11.03,0);
  building.add(mast);
});

const starsGeo=new THREE.BufferGeometry();
const starPositions=new Float32Array(600*3);
for(let i=0;i<600;i+=1){starPositions[i*3]=(Math.random()-.5)*55;starPositions[i*3+1]=8+Math.random()*24;starPositions[i*3+2]=-10-Math.random()*30;}
starsGeo.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xd9eaff,size:.055,transparent:true,opacity:.84,sizeAttenuation:true}));
stars.visible=false;
scene.add(stars);

const rainCount=900;
const rainGeo=new THREE.BufferGeometry();
const rainPositions=new Float32Array(rainCount*3);
function resetRain(i,top=true){rainPositions[i*3]=(Math.random()-.5)*28;rainPositions[i*3+1]=top?Math.random()*18:16+Math.random()*4;rainPositions[i*3+2]=-5+Math.random()*20;}
for(let i=0;i<rainCount;i+=1)resetRain(i,true);
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xa9c9de,size:.035,transparent:true,opacity:.46}));
rain.visible=false;
scene.add(rain);

const sunRays=new THREE.Group();
for(let i=0;i<4;i+=1){
  const ray=new THREE.Mesh(new THREE.PlaneGeometry(3.2+i*.8,22),new THREE.MeshBasicMaterial({color:0xffe1a0,transparent:true,opacity:.045,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  ray.rotation.z=-.42+i*.07;
  ray.position.set(7-i*1.4,10,-4+i*.3);
  sunRays.add(ray);
}
sunRays.visible=false;
scene.add(sunRays);

const holder=new THREE.Group();
holder.position.set(0,.72,-5.8);
camera.add(holder);
const handMaterial=new THREE.MeshStandardMaterial({color:0x5a3f34,roughness:.82,metalness:0});
const palm=new THREE.Mesh(new RoundedBoxGeometry(2.5,2.5,.72,5,.22),handMaterial);
palm.position.set(.35,-2.0,-.22);
palm.rotation.z=-.12;
palm.castShadow=true;
holder.add(palm);
const forearm=new THREE.Mesh(new THREE.CapsuleGeometry(.66,2.6,6,12),handMaterial);
forearm.position.set(.12,-3.7,-.2);
forearm.rotation.z=-.06;
forearm.castShadow=true;
holder.add(forearm);
for(let i=0;i<3;i+=1){
  const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.18,.92,5,10),handMaterial);
  finger.position.set(1.64,-.48-i*.53,.08);
  finger.rotation.z=.14;
  finger.castShadow=true;
  holder.add(finger);
}
const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.22,1.05,5,10),handMaterial);
thumb.position.set(1.38,-1.05,.46);
thumb.rotation.z=-.64;
holder.add(thumb);

const player=new THREE.Group();
player.rotation.set(-.04,.03,0);
holder.add(player);
const bodyMaterial=new THREE.MeshPhysicalMaterial({color:0x202426,roughness:.7,metalness:.38,clearcoat:.08,clearcoatRoughness:.72});
const body=new THREE.Mesh(new RoundedBoxGeometry(3.15,4.75,.72,7,.24),bodyMaterial);
body.castShadow=true;
body.userData.action='rotate';
player.add(body);

for(let i=0;i<8;i+=1){
  const scratch=new THREE.Mesh(new THREE.BoxGeometry(.65+Math.random()*.7,.008,.008),new THREE.MeshBasicMaterial({color:i%2?0x55595a:0x0b0d0e,transparent:true,opacity:.34}));
  scratch.position.set((Math.random()-.5)*2.3,-.15-Math.random()*1.7,.369);
  scratch.rotation.z=(Math.random()-.5)*.25;
  player.add(scratch);
}

const screenCanvas=document.createElement('canvas');
screenCanvas.width=768;
screenCanvas.height=600;
const sctx=screenCanvas.getContext('2d');
const screenTexture=new THREE.CanvasTexture(screenCanvas);
screenTexture.colorSpace=THREE.SRGBColorSpace;
screenTexture.minFilter=THREE.LinearFilter;
const screen=new THREE.Mesh(new RoundedBoxGeometry(2.62,2.26,.055,6,.12),new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false}));
screen.position.set(0,.93,.39);
screen.userData.action='screen';
player.add(screen);

const wheelMaterial=new THREE.MeshStandardMaterial({color:0x111517,roughness:.62,metalness:.45});
const wheel=new THREE.Mesh(new THREE.CylinderGeometry(1.03,1.03,.11,64),wheelMaterial);
wheel.rotation.x=Math.PI/2;
wheel.position.set(0,-1.32,.39);
wheel.userData.action='rotate';
player.add(wheel);
const centerButton=new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.14,48),new THREE.MeshStandardMaterial({color:0x252b2e,roughness:.58,metalness:.38}));
centerButton.rotation.x=Math.PI/2;
centerButton.position.set(0,-1.32,.48);
centerButton.userData.action='play';
player.add(centerButton);

const glyphMaterial=new THREE.MeshBasicMaterial({color:0xdfe9ee,toneMapped:false});
function bar(x,y,w,h){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.025),glyphMaterial);m.position.set(x,y,.57);player.add(m);return m;}
bar(0,-.57,.25,.045);bar(0,-.57,.045,.25);bar(0,-2.07,.25,.045);
function triangle(x,y,flip=false){const sh=new THREE.Shape();sh.moveTo(flip?.11:-.11,-.12);sh.lineTo(flip?.11:-.11,.12);sh.lineTo(flip?-.11:.11,0);sh.closePath();const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),glyphMaterial);m.position.set(x,y,.565);player.add(m);return m;}
const playGlyph=triangle(0,-1.32,false);
const pauseA=bar(-.07,-1.32,.045,.23),pauseB=bar(.07,-1.32,.045,.23);pauseA.visible=pauseB.visible=false;
triangle(-.67,-1.32,true);triangle(-.82,-1.32,true);triangle(.67,-1.32,false);triangle(.82,-1.32,false);
const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
function hit(name,x,y,w,h){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),hitMaterial);m.position.set(x,y,.585);m.userData.action=name;player.add(m);return m;}
hit('plus',0,-.57,.8,.38);hit('minus',0,-2.07,.8,.38);hit('prev',-.76,-1.32,.48,.62);hit('next',.76,-1.32,.48,.62);
hit('all',1.06,1.86,.5,.34);
for(let i=0;i<5;i+=1)hit(`color:${i}`,.26+i*.19,.39,.18,.28);

let current=0,pending=0,screenMode='now',selectedColor=0,currentMood=tracks[0].mood;
let audioContext,analyser,source,freqData,timeData,smoothBass=0,lastBeat=0,lastPulse=0;
let duration=0,screenDirty=true,lastScreenPaint=0;

function initAudio(){
  if(audioContext)return;
  audioContext=new (window.AudioContext||window.webkitAudioContext)();
  analyser=audioContext.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.72;
  source=audioContext.createMediaElementSource(audio);source.connect(analyser);analyser.connect(audioContext.destination);
  freqData=new Uint8Array(analyser.frequencyBinCount);timeData=new Uint8Array(analyser.fftSize);
}
async function playAudio(){try{initAudio();if(audioContext.state==='suspended')await audioContext.resume();await audio.play();}catch(error){console.warn('Audio playback is unavailable',error);a11yNow.textContent='Не удалось запустить трек';}screenDirty=true;}
function setMood(mood){currentMood=mood;screenDirty=true;applyMood();}
function loadTrack(index,autoplay=false){current=wrapIndex(index,tracks.length);pending=current;audio.src=tracks[current].file;setMood(tracks[current].mood);clearWindows();if(autoplay)playAudio();}
function setVolume(value){audio.volume=clampVolume(value);screenDirty=true;}
function togglePlay(){if(screenMode==='all'){screenMode='now';loadTrack(pending,true);return;}audio.paused?playAudio():audio.pause();}
function clearWindows(){windowMeshes.forEach(w=>{w.visible=false;w.userData.offAt=0;});}
function pulseWindows(now,strong=false){
  if(audio.paused)return;
  const count=strong?44:24;
  const shuffled=[...windowMeshes].sort(()=>Math.random()-.5);
  shuffled.slice(0,count).forEach((w,i)=>{w.visible=Boolean(lightLevel(true));w.userData.offAt=now+190+(i%7)*34;});
}
function setWindowColor(){windowMaterial.color.setHex(colors[selectedColor]);screenDirty=true;}

function applyMood(){
  const mood=moods[currentMood];
  scene.fog.color.setHex(mood.fog);concreteMaterial.color.setHex(mood.house);
  const night=currentMood==='calm'||currentMood==='romantic';
  bodyMaterial.color.setHex(night?0x111416:0x202426);handMaterial.color.setHex(night?0x30231f:0x5a3f34);
  if(currentMood==='happy'){skyUniforms.top.value.setHex(0x86b4cf);skyUniforms.bottom.value.setHex(0x354d5d);hemi.intensity=1.75;moonKey.intensity=.9;warmKey.intensity=2.8;}
  else if(night){skyUniforms.top.value.setHex(0x101936);skyUniforms.bottom.value.setHex(0x050713);hemi.intensity=.48;moonKey.intensity=1.1;warmKey.intensity=0;}
  else{skyUniforms.top.value.setHex(0x334c61);skyUniforms.bottom.value.setHex(0x081018);hemi.intensity=.85;moonKey.intensity=1.65;warmKey.intensity=0;}
}

function drawScreen(now){
  sctx.fillStyle='#061018';sctx.fillRect(0,0,768,600);
  const c=`#${colors[selectedColor].toString(16).padStart(6,'0')}`;
  sctx.textBaseline='middle';sctx.fillStyle='#d9efff';sctx.font='700 25px Arial';
  if(screenMode==='all'){
    sctx.fillText('ALL TRACKS',36,45);sctx.fillStyle=c;sctx.textAlign='right';sctx.fillText('BACK',730,45);sctx.textAlign='left';
    tracks.forEach((track,i)=>{const y=110+i*66;if(i===pending){sctx.fillStyle=c;sctx.fillRect(24,y-25,720,50);sctx.fillStyle='#061018';}else{sctx.fillStyle='rgba(217,239,255,.55)';}sctx.font='700 23px Arial';sctx.fillText(`${String(i+1).padStart(2,'0')}  ${track.title.toUpperCase()}`,40,y);});
    sctx.fillStyle='rgba(217,239,255,.62)';sctx.font='18px Arial';sctx.fillText('+ ВВЕРХ   − ВНИЗ   PLAY ВЫБРАТЬ',36,565);
  }else{
    const track=tracks[current];
    sctx.fillStyle='rgba(217,239,255,.62)';sctx.font='18px Arial';sctx.fillText(`${String(current+1).padStart(2,'0')} / ${String(tracks.length).padStart(2,'0')}`,34,35);sctx.fillText(moods[currentMood].short,340,35);
    sctx.fillStyle=c;sctx.strokeStyle=c;sctx.lineWidth=2;sctx.strokeRect(655,14,82,42);sctx.font='700 18px Arial';sctx.fillText('ALL ›',668,35);
    sctx.fillStyle='#e6f3fb';sctx.font='800 33px Arial';sctx.fillText(track.title.toUpperCase(),34,105);
    sctx.fillStyle='rgba(217,239,255,.58)';sctx.font='18px Arial';sctx.fillText('RAREERRA',34,142);sctx.textAlign='right';sctx.fillText(`VOL ${Math.round(audio.volume*100)}`,733,105);sctx.textAlign='left';
    const bars=18;for(let i=0;i<bars;i+=1){const v=freqData&&!audio.paused?freqData[Math.floor(i/bars*freqData.length)]/255:.05;sctx.fillStyle=c;sctx.fillRect(34+i*38,315-v*120,24,Math.max(5,v*120));}
    const p=duration?audio.currentTime/duration:0;sctx.fillStyle='rgba(255,255,255,.18)';sctx.fillRect(34,350,700,5);sctx.fillStyle=c;sctx.fillRect(34,350,700*p,5);
    sctx.fillStyle='rgba(217,239,255,.62)';sctx.font='17px Arial';sctx.fillText(formatTime(audio.currentTime),34,382);sctx.textAlign='right';sctx.fillText(formatTime(duration),734,382);sctx.textAlign='left';
    sctx.fillText(moods[currentMood].label,34,458);sctx.fillText('DRAG — ПОВОРОТ 3D',34,510);
    colors.forEach((hex,i)=>{const x=448+i*55;sctx.fillStyle=`#${hex.toString(16).padStart(6,'0')}`;sctx.fillRect(x,440,36,36);if(i===selectedColor){sctx.strokeStyle='#fff';sctx.lineWidth=3;sctx.strokeRect(x-3,437,42,42);}});
    sctx.fillStyle='rgba(217,239,255,.72)';sctx.font='16px Arial';sctx.fillText('ВЫБЕРИ ЦВЕТ',448,510);
  }
  screenTexture.needsUpdate=true;screenDirty=false;lastScreenPaint=now;
}

function analyse(now){
  if(!analyser||audio.paused){if(now-lastScreenPaint>120)screenDirty=true;return;}
  analyser.getByteFrequencyData(freqData);analyser.getByteTimeDomainData(timeData);
  let bass=0;const end=Math.max(8,Math.floor(freqData.length*.13));for(let i=0;i<end;i+=1)bass+=freqData[i];bass/=end*255;
  let energy=0;for(const value of timeData){const v=(value-128)/128;energy+=v*v;}energy=Math.sqrt(energy/timeData.length);
  smoothBass=smoothBass*.9+bass*.1;
  if(bass>smoothBass*1.2&&bass>.13&&now-lastBeat>185){lastBeat=now;pulseWindows(now,true);}else if(energy>.055&&now-lastPulse>260){lastPulse=now;pulseWindows(now,false);}
  screenDirty=true;
}

function updateWeather(delta,now){
  const playing=!audio.paused;
  rain.visible=playing&&currentMood==='sad';stars.visible=playing&&currentMood==='romantic';sunRays.visible=playing&&currentMood==='happy';
  if(rain.visible){for(let i=0;i<rainCount;i+=1){rainPositions[i*3]-=delta*1.7;rainPositions[i*3+1]-=delta*(10+(i%9));if(rainPositions[i*3+1]<0)resetRain(i,false);}rainGeo.attributes.position.needsUpdate=true;}
  if(stars.visible)stars.material.opacity=.66+Math.sin(now*.0017)*.14;
}

function onScreenTap(uv){
  const x=uv.x*768,y=(1-uv.y)*600;
  if(screenMode==='all'){if(y<75&&x>610){screenMode='now';screenDirty=true;}return;}
  if(y<75&&x>620){screenMode='all';pending=current;screenDirty=true;return;}
  if(y>420&&y<530&&x>420){selectedColor=Math.max(0,Math.min(4,Math.floor((x-430)/55)));setWindowColor();pulseWindows(performance.now(),true);return;}
  if(y>330&&y<405&&duration){audio.currentTime=clampVolume((x-34)/700)*duration;screenDirty=true;}
}
function action(name,hitInfo){
  if(name==='play')togglePlay();
  if(name==='all'){screenMode=screenMode==='all'?'now':'all';pending=current;screenDirty=true;}
  if(name.startsWith('color:')){selectedColor=Number(name.split(':')[1]);setWindowColor();pulseWindows(performance.now(),true);}
  if(name==='prev'&&screenMode==='now')loadTrack(current-1,true);
  if(name==='next'&&screenMode==='now')loadTrack(current+1,true);
  if(name==='plus')screenMode==='all'?(pending=wrapIndex(pending-1,tracks.length),screenDirty=true):setVolume(audio.volume+.08);
  if(name==='minus')screenMode==='all'?(pending=wrapIndex(pending+1,tracks.length),screenDirty=true):setVolume(audio.volume-.08);
  if(name==='screen'&&hitInfo.uv)onScreenTap(hitInfo.uv);
}

const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
let drag=null,playerTargetX=-.04,playerTargetY=.03;
function hitsAt(event){const rect=canvas.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(player.children,true);}
canvas.addEventListener('pointerdown',event=>{const hits=hitsAt(event);if(!hits.length)return;const hitInfo=hits.find(h=>h.object.userData.action);if(!hitInfo)return;controls.enabled=false;drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,hit:hitInfo};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>7&&drag.hit.object.userData.action==='rotate'){playerTargetY=Math.max(-.58,Math.min(.58,playerTargetY+dx*.008));playerTargetX=Math.max(-.28,Math.min(.2,playerTargetX+dy*.007));}drag.x=event.clientX;drag.y=event.clientY;});
canvas.addEventListener('pointerup',event=>{if(!drag||drag.id!==event.pointerId)return;const moved=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);if(moved<8&&drag.hit.object.userData.action!=='rotate')action(drag.hit.object.userData.action,drag.hit);drag=null;controls.enabled=true;});
canvas.addEventListener('pointercancel',()=>{drag=null;controls.enabled=true;});

audio.addEventListener('play',()=>{playGlyph.visible=false;pauseA.visible=pauseB.visible=true;a11yNow.textContent=`Играет ${tracks[current].title}`;screenDirty=true;applyMood();});
audio.addEventListener('pause',()=>{playGlyph.visible=true;pauseA.visible=pauseB.visible=false;clearWindows();screenDirty=true;});
audio.addEventListener('error',()=>{console.warn('Audio element error',audio.error?.message||audio.error?.code);a11yNow.textContent='Не удалось загрузить трек';});
audio.addEventListener('ended',()=>loadTrack(current+1,true));
audio.addEventListener('loadedmetadata',()=>{duration=audio.duration;screenDirty=true;});
audio.addEventListener('timeupdate',()=>{screenDirty=true;});
document.querySelector('#a11yPlay').addEventListener('click',togglePlay);
document.querySelector('#a11yPrev').addEventListener('click',()=>loadTrack(current-1,true));
document.querySelector('#a11yNext').addEventListener('click',()=>loadTrack(current+1,true));
document.querySelector('#a11yUp').addEventListener('click',()=>action('plus'));
document.querySelector('#a11yDown').addEventListener('click',()=>action('minus'));
document.querySelector('#a11yAll').addEventListener('click',()=>action('all'));
document.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();togglePlay();}if(event.code==='KeyA')action('all');if(event.code==='ArrowLeft')action('prev');if(event.code==='ArrowRight')action('next');if(event.code==='ArrowUp')action('plus');if(event.code==='ArrowDown')action('minus');});

function resize(){renderer.setSize(innerWidth,innerHeight,false);renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1.25:1.55));camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<600?52:43;camera.updateProjectionMatrix();const mobile=innerWidth<600;holder.scale.setScalar(mobile ? .58 : .68);holder.position.set(0,mobile ? .42 : .72,mobile ? -6.15 : -5.8);}
window.addEventListener('resize',resize);
setVolume(.78);setWindowColor();loadTrack(0);resize();

const clock=new THREE.Clock();
function loop(now){
  const delta=Math.min(.05,clock.getDelta());
  controls.update();analyse(now);updateWeather(delta,now);
  windowMeshes.forEach(w=>{if(w.visible&&w.userData.offAt<now)w.visible=false;});
  player.rotation.x+=(playerTargetX-player.rotation.x)*.1;player.rotation.y+=(playerTargetY-player.rotation.y)*.1;
  holder.position.y+=(Math.sin(now*.0012)*.012-(holder.position.y-(innerWidth<600?-2.05:-1.72)))*.025;
  if(screenDirty&&now-lastScreenPaint>45)drawScreen(now);
  renderer.render(scene,camera);requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
