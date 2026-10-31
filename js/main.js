// MAGENTA VICE – Open-World-Parodie im Telekommunikations-Vertrieb · von HEKO präsentiert
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { clamp, lerp, smooth, rng, pick, angDiff, canvas, tex, signTex, drawT, fitText, FONT, setAniso, fmtEUR, fmtEURc, radialTex, roundRect, drawHeko, HEKO_RATIO } from './util.js?v=20261031-2130';
import { world, buildWorld, buildSky, updateTOD, TOD, GRID, RHW, PED_OFF, LAND, ISLAND, CAUSE, BEACH_X, DEEP_X, BRANDS, circleHit, queryColliders, lineBlocked, surfaceY, isDeep, onLand, sky } from './world.js?v=20261031-2130';
import { makeVehicle, makeCharacter, poseCharacter, setDriver, VTYPES, paintMat, sharedMats, setDetail, setCarLod } from './models.js?v=20261031-2130';
import * as AU from './audio.js?v=20261031-2130';
import { loadAssets, ASSETS } from './assets.js?v=20261031-2130';
import { humanAvailable, makeHuman, animateHuman, setHumanWeapon, muzzleWorld, setHumanShadow, weaponModel } from './people.js?v=20261031-2130';
import { TARIFFS, CATEGORIES } from './tarife.js?v=20261031-2130';

export const VERSION = '20261031-2130';
const $ = id => document.getElementById(id);
const PARAMS = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const isMobile = isTouch || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const TEST = PARAMS.has('test');
document.body.classList.toggle('touch', isTouch);
const R = rng(Date.now() & 0xffffff);
const rand = (a, b) => a + R() * (b - a);

// ---------------------------------------------------------------- Qualität
const QUALITY = {
  hoch: { label: 'HOCH', maxPR: 2.5, minPR: 1.5, shadow: 4096, bloom: 1, samples: 4, shadowR: 80, ao: 1, dens: 1, carVis: 260, carLod: 32, pedVis: 80, pedFar: 42, pedShadow: 34, flashLight: 1 },
  mittel: { label: 'MITTEL', maxPR: 2.0, minPR: 1.25, shadow: 2048, bloom: 1, samples: 4, shadowR: 65, ao: 0, dens: 0.72, carVis: 200, carLod: 24, pedVis: 62, pedFar: 28, pedShadow: 22, flashLight: 1 },
  niedrig: { label: 'NIEDRIG', maxPR: 1.5, minPR: 0.75, shadow: 1024, bloom: 0, samples: 2, shadowR: 50, ao: 0, dens: 0.5, carVis: 150, carLod: 16, pedVis: 46, pedFar: 18, pedShadow: 12, flashLight: 0 },
};
const isMobileUA = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const autoQ = () => isMobileUA ? 'mittel' : 'hoch';
let SAVE = loadSave();
let qSel = { ultra: 'hoch', spar: 'niedrig' }[PARAMS.get('q') || SAVE.quality] || PARAMS.get('q') || SAVE.quality || 'auto';
if (qSel !== 'auto' && !QUALITY[qSel]) qSel = 'auto';
let qKey = qSel === 'auto' ? autoQ() : qSel;
let Q = QUALITY[qKey];
let DPR = window.devicePixelRatio || 1;
let pr = PARAMS.has('pr') ? +PARAMS.get('pr') : Math.min(DPR, Q.maxPR);
const fixedPR = PARAMS.has('pr');

const glCanvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(pr);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.info.autoReset = false;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setAniso(Math.min(16, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcfe6f5, 0.002);
const hemi = new THREE.HemisphereLight(0xdff0ff, 0x8a7a60, 1.0); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xffffff, 3); sunL.castShadow = true;
sunL.shadow.mapSize.set(Q.shadow, Q.shadow); sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.04;
const sc = sunL.shadow.camera; sc.near = 1; sc.far = 500; sc.left = -Q.shadowR; sc.right = Q.shadowR; sc.top = Q.shadowR; sc.bottom = -Q.shadowR;
scene.add(sunL, sunL.target);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.2, 3200);

let composer, bloom, renderPass, grade, aoPass = null;
function setupComposer() {
  const [w, h] = viewSize();
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: isMobile && pr >= 1.75 ? Math.min(2, Q.samples) : Q.samples });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr); composer.setSize(w, h);
  renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
  aoPass = null;
  if (Q.ao && !isMobile && PARAMS.get('ao') !== '0') {
    aoPass = new GTAOPass(scene, camera, w, h);
    aoPass.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
    aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    aoPass.blendIntensity = 0.75;
    // Transparente Effekte (Wolken, Lichtkegel, Neon-Glühen) nicht in die AO-Tiefe schreiben
    const ov = aoPass.overrideVisibility.bind(aoPass);
    aoPass.overrideVisibility = () => { ov(); scene.traverse(o => { if (o.material && (o.material.transparent || o.material.depthWrite === false)) o.visible = false; }); };
    composer.addPass(aoPass);
  }
  bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.55, 1.0);
  const bs = bloom.setSize.bind(bloom), bscale = isMobile ? 0.5 : 0.75;
  bloom.setSize = (a, b) => bs(Math.round(a * bscale), Math.round(b * bscale));
  bloom.enabled = !!Q.bloom; composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, con: { value: 1.06 }, vig: { value: 0.32 }, tint: { value: new THREE.Vector3(1.0, 0.99, 1.02) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con, vig; uniform vec3 tint; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, sat);
        col = (col - 0.5) * con + 0.5; col *= tint;
        vec2 d = vUv - 0.5; col *= 1.0 - vig * dot(d, d) * 1.6;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }`,
  });
  composer.addPass(grade);
  composer.setSize(w, h);
}
function applyQuality(k) {
  qSel = k; qKey = k === 'auto' ? autoQ() : k; Q = QUALITY[qKey]; SAVE.quality = k; persist();
  pr = fixedPR ? pr : Math.min(DPR, Q.maxPR);
  sunL.shadow.mapSize.set(Q.shadow, Q.shadow); if (sunL.shadow.map) { sunL.shadow.map.dispose(); sunL.shadow.map = null; }
  sc.left = -Q.shadowR; sc.right = Q.shadowR; sc.top = Q.shadowR; sc.bottom = -Q.shadowR; sc.updateProjectionMatrix();
  composer.dispose?.(); setupComposer(); onResize(true);
}
// ---- Viewport / Drehen / Vollbild: robust neu vermessen (iOS meldet nach dem Drehen oft kurz alte Größen)
function viewSize() {
  const r = glCanvas.getBoundingClientRect();
  let w = Math.round(r.width), h = Math.round(r.height);
  if (!(w > 0 && h > 0)) { const vv = window.visualViewport; w = Math.round(vv ? vv.width : innerWidth); h = Math.round(vv ? vv.height : innerHeight); }
  return [Math.max(1, w), Math.max(1, h)];
}
let lastVW = 0, lastVH = 0, lastPR = 0;
function onResize(force) {
  const [w, h] = viewSize();
  const d = window.devicePixelRatio || 1;
  if (d !== DPR) { DPR = d; if (!fixedPR) pr = Math.min(DPR, Q.maxPR); }
  if (!fixedPR) pr = Math.min(pr, Math.min(DPR, Q.maxPR));
  if (force !== true && w === lastVW && h === lastVH && pr === lastPR) return;
  lastVW = w; lastVH = h; lastPR = pr;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  composer.setPixelRatio(pr); composer.setSize(w, h);
  if (aoPass) aoPass.setSize(Math.round(w * pr), Math.round(h * pr));
  try { sizeMinimap(); } catch (e) { /* noch beim Laden */ } document.body.classList.toggle('portrait', h > w);
  { const bm = document.getElementById('bigmap'); if (bm && bm.offsetParent && typeof drawBigMap === 'function') requestAnimationFrame(() => drawBigMap(bm)); }
  window.__mvView = { w, h, pr, bw: glCanvas.width, bh: glCanvas.height, aspect: camera.aspect };
}
function resetTouches() {
  try { void joy; } catch (e) { return; }
  joy.id = null; joy.x = joy.y = 0; look.id = null;
  joyKnob.style.transform = ''; joyEl.classList.remove('on'); joyEl.style.left = ''; joyEl.style.top = '';
  for (const el of document.querySelectorAll('.tbtn.down')) el.classList.remove('down');
  inp.sprint = false; inp.hb = false; inp.punch = false; inp.actHeld = false;
  try { W.fireHeld = false; W.aimHeld = false; clearTimeout(wpnHold.t); if (W.wheel) closeWheel(false); } catch (e) { }
}
let settleRAF = 0;
function scheduleResize(rotated) {
  if (rotated) resetTouches();
  onResize();
  // Mehrfach nachmessen, bis die Größe ~6 Frames stabil ist (max. ~1,5 s)
  cancelAnimationFrame(settleRAF);
  let stable = 0, n = 0, pw = -1, ph = -1;
  const tick = () => {
    const [w, h] = viewSize();
    if (w === pw && h === ph) stable++; else { stable = 0; pw = w; ph = h; onResize(); }
    if (stable < 6 && ++n < 90) settleRAF = requestAnimationFrame(tick);
  };
  settleRAF = requestAnimationFrame(tick);
  for (const t of [120, 350, 700]) setTimeout(() => onResize(), t);
}
addEventListener('resize', () => scheduleResize(false));
addEventListener('orientationchange', () => scheduleResize(true));
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => scheduleResize(true));
if (window.visualViewport) { visualViewport.addEventListener('resize', () => scheduleResize(false)); visualViewport.addEventListener('scroll', () => { if (scrollY || scrollX) scrollTo(0, 0); }); }
document.addEventListener('fullscreenchange', () => scheduleResize(true));
document.addEventListener('webkitfullscreenchange', () => scheduleResize(true));
addEventListener('pageshow', () => scheduleResize(false));

// ---------------------------------------------------------------- Welt
const forcedHour = PARAMS.has('hour') ? clamp(parseFloat(PARAMS.get('hour')) || 0, 0, 24) : null;
TOD.forced = forcedHour;
setDetail(isMobile ? 0 : 1);
buildWorld(scene);
buildSky(scene, renderer, sunL, hemi, isMobile);
setupComposer();
updateTOD(scene, true);

// ---------------------------------------------------------------- 3D-Modelle laden (Ladebalken)
{
  const t0 = performance.now(), txt = $('loadTxt'), fill = $('loadFill');
  await loadAssets(p => { if (fill) fill.style.width = (p * 100).toFixed(1) + '%'; if (txt) txt.textContent = `Lade Menschen, Autos & Waffen … ${Math.round(p * 100)} %`; });
  if (txt) txt.textContent = 'Stadt wird bevölkert …';
  window.__mvAssets = { ms: Math.round(performance.now() - t0), failed: ASSETS.failed.slice(), humans: humanAvailable() }; if (TEST) window.__mvAssets.A = ASSETS;
}
const HUMANS = humanAvailable();
function mkChar(kind) { return HUMANS ? makeHuman(kind, R) : makeCharacter(kind === 'cop' || kind === 'swat' ? 'civ' : kind === 'night' ? 'civ' : kind, R); }

// ---------------------------------------------------------------- Speicherstand
function loadSave() { try { return JSON.parse(localStorage.getItem('magentaVice.v1')) || {}; } catch (e) { return {}; } }
function persist() {
  try {
    SAVE = Object.assign(SAVE, { money: G?.money ?? SAVE.money, wanted: G?.wanted ?? 0, contracts: G?.contracts ?? [], mission: G?.mission ?? 0, mstate: G?.mstate ?? {}, mstep: G?.mstep ?? 0, stats: G?.stats ?? {}, station: AU.A.station, muted: !AU.A.on });
    localStorage.setItem('magentaVice.v1', JSON.stringify(SAVE));
  } catch (e) { }
}

// ---------------------------------------------------------------- Spielzustand
const G = {
  money: SAVE.money ?? 0, wanted: SAVE.wanted ?? 0, health: 100, contracts: SAVE.contracts ?? [],
  mission: SAVE.mission ?? 0, mstate: SAVE.mstate || {}, stats: Object.assign({ robbed: 0, rangers: 0, delivered: 0, stolen: 0, escapes: 0, punches: 0, earned: 0, kinds: {} }, SAVE.stats || {}),
  mode: 'foot', car: null, started: false, paused: false, lastSeen: 0, evadeT: 0, bustT: 0, time: 0, deadT: 0, msgT: 0,
};
window.__mv = { G, VERSION };

// ---------------------------------------------------------------- Graph-Hilfen
const NODES = world.nodes;
function nearestNode(x, z) { let b = null, bd = 1e9; for (const n of NODES) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = n; } } return b; }
function bfsNext(fromId, toId, avoidId = -1) {
  if (fromId === toId) return null;
  const prev = new Map([[fromId, -1]]), q = [fromId];
  while (q.length) { const c = q.shift(); if (c === toId) break; for (const n of NODES[c].nb) if (!prev.has(n) && !(c === fromId && n === avoidId)) { prev.set(n, c); q.push(n); } }
  if (!prev.has(toId)) return null;
  let c = toId; while (prev.get(c) !== fromId) { c = prev.get(c); if (c === -1 || c === undefined) return null; }
  return c;
}
const rightOf = (dx, dz) => { const l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
const LANE = 3.0;
function lanePolyline(A, Bn, C, out) {
  const [r1x, r1z] = rightOf(Bn.x - A.x, Bn.z - A.z), [r2x, r2z] = rightOf(C.x - Bn.x, C.z - Bn.z);
  out[0] = A.x + r1x * LANE; out[1] = A.z + r1z * LANE;
  const straight = Math.abs(r1x - r2x) + Math.abs(r1z - r2z) < 0.01;
  out[2] = Bn.x + (straight ? r1x * LANE : (r1x + r2x) * LANE); out[3] = Bn.z + (straight ? r1z * LANE : (r1z + r2z) * LANE);
  out[4] = C.x + r2x * LANE; out[5] = C.z + r2z * LANE;
  return straight;
}

// ---------------------------------------------------------------- Fahrzeuge
const vehicles = [];
function spawnVehicle(kind, x, z, h, opts = {}) {
  const ci = opts.color ?? Math.floor(R() * VTYPES[kind].colors.length);
  const m = makeVehicle(kind, ci);
  const v = { m, kind, T: VTYPES[kind], x, z, y: surfaceY(x, z), h, vx: 0, vz: 0, yr: 0, steer: 0, thr: 0, hb: false, hp: VTYPES[kind].hp, ai: null, driver: opts.driver || 'none', police: kind === 'police' || kind === 'swat', siren: false, sinking: 0, wheelRot: 0, smokeT: 0, stuckT: 0, revT: 0, dead: false, lastHit: 0, pitch: 0, roll: 0, id: vehicles.length };
  setDriver(m, v.driver === 'none' ? 'none' : v.police ? 'cop' : v.driver === 'player' ? 'player' : 'civ');
  m.root.position.set(x, v.y, z); m.root.rotation.y = h; scene.add(m.root);
  vehicles.push(v); return v;
}
function removeVehicle(v) { scene.remove(v.m.root); const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); }
function placeOnEdge(v, which, avoidView = false) {
  const cand = world.edges.filter(([a, b]) => { const A = NODES[a], B = NODES[b]; return which === 'ocean' ? A.x === 240 && B.x === 240 : (A.z === 0 && B.z === 0 && Math.min(A.x, B.x) === -580 && Math.max(A.x, B.x) === -240); });
  if (!cand.length) return false;
  for (let tries = 0; tries < 24; tries++) {
    const [a, b] = pick(R, cand), [A, Bn] = R() < 0.5 ? [a, b] : [b, a], NA = NODES[A], NB = NODES[Bn], t = rand(0.12, 0.88);
    const [rx, rz] = rightOf(NB.x - NA.x, NB.z - NA.z), x = lerp(NA.x, NB.x, t) + rx * LANE, z = lerp(NA.z, NB.z, t) + rz * LANE;
    if (vehicles.some(o => o !== v && Math.hypot(o.x - x, o.z - z) < 11)) continue;
    if (avoidView && inView(x, z, 6) && Math.hypot(x - player.x, z - player.z) < 160) continue;
    v.x = x; v.z = z; v.h = Math.atan2(NB.x - NA.x, NB.z - NA.z); v.vx = v.vz = 0; v.yr = 0; v.sinking = 0; v.hp = v.T.hp; v.dead = false;
    v.y = surfaceY(x, z); v.m.root.position.set(x, v.y, z); v.m.root.rotation.set(0, v.h, 0); v.m.body.rotation.set(0, 0, 0);
    setAI(v, A, Bn, chooseNext(Bn, A), 'traffic');
    const sp = v.ai.speed * 0.8; v.vx = Math.sin(v.h) * sp; v.vz = Math.cos(v.h) * sp;
    return true;
  }
  return false;
}
// Sichtbare Fahrer in Cabrios (echte Figuren, sitzend)
const SEAT = { x: 0.37, y: -0.5, z: -0.28 };
function stepCabrioSeats(dt) {
  if (!HUMANS) return;
  for (const v of vehicles) {
    if (v.kind !== 'cabrio' && v.kind !== 'speedster') continue;
    const who = v === G.car ? 'player' : v.driver === 'ai' ? 'civ' : v.driver === 'cop' ? 'cop' : null, dc = distToCam(v);
    if (!who || dc > 75) { if (v.seat) v.seat.root.visible = false; continue; }
    if (!v.seat || v.seatWho !== who) {
      if (v.seat) v.m.body.remove(v.seat.root);
      v.seat = makeHuman(who, R); v.seatWho = who; v.seat.root.position.set(SEAT.x, SEAT.y, SEAT.z); v.m.body.add(v.seat.root);
    }
    v.seat.root.visible = true; setHumanShadow(v.seat, dc < 30);
    animateHuman(v.seat, dt, { speed: 0, sit: 'car', far: dc > 30, look: null });
  }
}
function setAI(v, A, Bn, C, mode = 'traffic') {
  v.ai = { mode, A, B: Bn, C, poly: new Float32Array(6), straight: true, speed: rand(10, 14), waitT: 0, stunT: 0 };
  v.ai.straight = lanePolyline(NODES[A], NODES[Bn], NODES[C], v.ai.poly);
}
function chooseNext(Bid, Aid) {
  const nb = NODES[Bid].nb.filter(n => n !== Aid);
  if (!nb.length) return Aid;
  // Geradeaus bevorzugen
  const A = NODES[Aid], Bn = NODES[Bid], dx = Bn.x - A.x, dz = Bn.z - A.z;
  const straight = nb.find(n => { const c = NODES[n]; return Math.abs((c.x - Bn.x) * dz - (c.z - Bn.z) * dx) < 1 && ((c.x - Bn.x) * dx + (c.z - Bn.z) * dz) > 0; });
  if (straight !== undefined && R() < 0.5) return straight;
  return nb[Math.floor(R() * nb.length)];
}
// Fahrzeug auf zufälliger Kante in Abstand-Ring zum Punkt platzieren
function placeOnRoad(v, cx, cz, dmin, dmax, mode = 'traffic', avoidView = true) {
  for (let tries = 0; tries < 40; tries++) {
    const [a, b] = world.edges[Math.floor(R() * world.edges.length)];
    const [A, Bn] = R() < 0.5 ? [a, b] : [b, a];
    const NA = NODES[A], NB = NODES[Bn], t = rand(0.25, 0.7);
    const [rx, rz] = rightOf(NB.x - NA.x, NB.z - NA.z);
    const x = lerp(NA.x, NB.x, t) + rx * LANE, z = lerp(NA.z, NB.z, t) + rz * LANE;
    const d = Math.hypot(x - cx, z - cz); if (d < dmin || d > dmax) continue;
    if (avoidView && inView(x, z, 6) && d < 160) continue;
    if (vehicles.some(o => o !== v && Math.hypot(o.x - x, o.z - z) < 12)) continue;
    v.x = x; v.z = z; v.h = Math.atan2(NB.x - NA.x, NB.z - NA.z); v.vx = v.vz = 0; v.yr = 0; v.sinking = 0; v.hp = v.T.hp; v.dead = false;
    v.y = surfaceY(x, z); v.m.root.position.set(x, v.y, z); v.m.root.rotation.set(0, v.h, 0); v.m.body.rotation.set(0, 0, 0);
    setAI(v, A, Bn, chooseNext(Bn, A), mode);
    const sp = v.ai.speed * 0.8; v.vx = Math.sin(v.h) * sp; v.vz = Math.cos(v.h) * sp;
    return true;
  }
  return false;
}
const _frustum = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();
function inView(x, z, r = 3) { _sph.center.set(x, 1, z); _sph.radius = r; return _frustum.intersectsSphere(_sph); }

// Physik
const _hit = { x: 0, z: 0, nx: 0, nz: 0, n: 0 };
function carCircles(v) { const L = v.T.len, W = v.T.wid, o = Math.max(0, L / 2 - W / 2), fx = Math.sin(v.h), fz = Math.cos(v.h); return [[v.x + fx * o, v.z + fz * o, o], [v.x, v.z, 0], [v.x - fx * o, v.z - fz * o, -o]]; }
function stepVehicle(v, dt) {
  const T = v.T;
  if (v.sinking > 0) { v.sinking += dt; v.vx *= 0.95; v.vz *= 0.95; v.x += v.vx * dt; v.z += v.vz * dt; v.y -= dt * 0.8; v.m.root.position.set(v.x, v.y, v.z); return; }
  let fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -fz, rz = fx;
  let vf = v.vx * fx + v.vz * fz, vl = v.vx * rx + v.vz * rz;
  const thr = v.dead ? 0 : v.thr;
  let a = 0;
  const onSand = v.x > BEACH_X + 2;
  const maxV = T.maxV * (onSand ? 0.55 : 1) * (v.hp < T.hp * 0.25 ? 0.6 : 1);
  if (thr > 0) a = vf < -0.5 ? 18 * thr : T.acc * thr * Math.max(0, 1 - vf / maxV);
  else if (thr < 0) a = vf > 0.5 ? -22 * -thr : T.acc * 0.7 * thr * Math.max(0, 1 + vf / 14);
  a -= vf * (onSand ? 0.5 : 0.05) + Math.sign(vf) * (Math.abs(thr) < 0.05 ? 2.2 : 0.3);
  if (Math.abs(vf) < 0.3 && Math.abs(thr) < 0.05) { vf *= 0.8; a = 0; }
  if (v.hb) a -= Math.sign(vf) * 6;
  vf += a * dt;
  const grip = T.grip * (v.hb ? 0.18 : 1) * (onSand ? 0.6 : 1);
  vl *= Math.exp(-grip * dt);
  const spd = Math.abs(vf);
  const sa = v.steer * T.steer / (1 + spd / 24);
  let target = vf * Math.tan(sa) / T.wb;
  if (v.hb) target *= 1.45;
  v.yr += (target - v.yr) * Math.min(1, (v.hb ? 5 : 9) * dt);
  v.h += v.yr * dt;
  fx = Math.sin(v.h); fz = Math.cos(v.h); rx = -fz; rz = fx;
  // Driftanteil: ein Teil der Längsgeschwindigkeit wird beim Einlenken seitlich (Handbremse)
  v.vx = fx * vf + rx * vl; v.vz = fz * vf + rz * vl;
  v.skid = clamp(Math.abs(vl) / 6, 0, 1);
  v.x += v.vx * dt; v.z += v.vz * dt;
  // Welt-Kollision
  let impact = 0;
  for (const [cx, cz, off] of carCircles(v)) {
    if (!circleHit(cx, cz, T.wid / 2, _hit)) continue;
    v.x += _hit.x; v.z += _hit.z;
    const nx = _hit.nx, nz = _hit.nz, vn = v.vx * nx + v.vz * nz;
    if (vn < 0) {
      v.vx -= 1.3 * vn * nx; v.vz -= 1.3 * vn * nz; v.vx *= 0.92; v.vz *= 0.92;
      v.yr += (off * (fx * nz - fz * nx)) * vn * 0.05;
      impact = Math.max(impact, -vn);
    }
  }
  if (impact > 3) carDamage(v, impact, null);
  // Wasser
  if (isDeep(v.x, v.z) && v.sinking === 0) { v.sinking = 0.01; AU.sfx.splash(); if (v === G.car) onPlayerCarSinks(v); }
  // Darstellung
  const gy = surfaceY(v.x, v.z); v.y += (gy - v.y) * Math.min(1, dt * 12);
  const r = v.m.root; r.position.set(v.x, v.y, v.z); r.rotation.y = v.h;
  // Karosserie neigen (Beschleunigung / Kurve)
  const tp = clamp(-a * 0.004, -0.05, 0.05), tr = clamp(v.yr * vf * 0.006, -0.08, 0.08);
  v.pitch += (tp - v.pitch) * Math.min(1, dt * 6); v.roll += (tr - v.roll) * Math.min(1, dt * 6);
  v.m.body.rotation.set(v.pitch, 0, v.roll);
  v.wheelRot += vf * dt / 0.38;
  if (v.m.wheels) for (const w of v.m.wheels) { w.w.rotation.x = v.wheelRot; if (w.front) w.piv.rotation.y = v.steer * T.steer * 0.8; }
  v.speed = vf;
}
function carDamage(v, impact, other) {
  const now = G.time;
  v.hp -= impact * impact * 0.9 * (v.police ? 0.7 : 1);
  if (now - v.lastHit > 0.25) { v.lastHit = now; if (impact > 5 && distToCam(v) < 80) AU.sfx.crash(clamp(impact / 20, 0.2, 1)); }
  if (v === G.car) { if (impact > 12) hurt((impact - 12) * 1.2); shake(Math.min(1, impact / 25)); }
  if (v.hp <= 0 && !v.dead) { v.dead = true; v.hp = 0; if (v === G.car) help('Motorschaden! Steig aus und klau dir ein neues Auto.'); }
}
function distToCam(o) { return Math.hypot(o.x - camera.position.x, o.z - camera.position.z); }
// Fahrzeug-Fahrzeug
function collideVehicles() {
  for (let i = 0; i < vehicles.length; i++) {
    const a = vehicles[i]; if (a.sinking) continue;
    for (let j = i + 1; j < vehicles.length; j++) {
      const b = vehicles[j]; if (b.sinking) continue;
      const rr = (a.T.len + b.T.len) / 2 + 0.5;
      if (Math.abs(a.x - b.x) > rr || Math.abs(a.z - b.z) > rr) continue;
      const ca = carCircles(a), cb = carCircles(b), ra = a.T.wid / 2, rb = b.T.wid / 2;
      let best = null;
      for (const p of ca) for (const q of cb) { const dx = p[0] - q[0], dz = p[1] - q[1], d = Math.hypot(dx, dz), pen = ra + rb - d; if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: dx / (d || 1), nz: dz / (d || 1) }; }
      if (!best) continue;
      const ma = a.T.mass, mb = b.T.mass, tot = ma + mb;
      a.x += best.nx * best.pen * mb / tot; a.z += best.nz * best.pen * mb / tot;
      b.x -= best.nx * best.pen * ma / tot; b.z -= best.nz * best.pen * ma / tot;
      const rv = (a.vx - b.vx) * best.nx + (a.vz - b.vz) * best.nz;
      if (rv < 0) {
        const j2 = -(1.35) * rv / (1 / ma + 1 / mb);
        a.vx += j2 / ma * best.nx; a.vz += j2 / ma * best.nz; b.vx -= j2 / mb * best.nx; b.vz -= j2 / mb * best.nz;
        a.yr += (R() - 0.5) * -rv * 0.04; b.yr += (R() - 0.5) * -rv * 0.04;
        const imp = -rv;
        if (imp > 2.5) {
          carDamage(a, imp * mb / tot * 1.4, b); carDamage(b, imp * ma / tot * 1.4, a);
          for (const [x, y] of [[a, b], [b, a]]) if (x.ai && x.ai.mode === 'traffic') x.ai.stunT = 1.5;
          if (G.car && (a === G.car || b === G.car)) {
            const o = a === G.car ? b : a;
            if (o.police && imp > 4) crime(1, 'Polizeiauto gerammt', true);
            if (o.driver === 'ai' && imp > 6 && R() < 0.4) AU.sfx.horn();
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- KI-Fahrer
function aiDrive(v, dt) {
  const ai = v.ai, P = ai.poly;
  if (v.dead || v.sinking) { v.thr = 0; v.steer = 0; v.hb = false; return; }
  const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -fz, rz = fx;
  const vf = v.vx * fx + v.vz * fz;
  let tx, tz, targetV;
  const chase = ai.mode === 'police' && G.wanted > 0;
  const px = G.car ? G.car.x : player.x, pz = G.car ? G.car.z : player.z;
  const dP = Math.hypot(px - v.x, pz - v.z);
  ai.direct = chase && dP < 70 && !lineBlocked(v.x, v.z, px, pz, 2);
  if (ai.direct) {
    const pv = G.car ? G.car : player;
    tx = px + (pv.vx || 0) * 0.5; tz = pz + (pv.vz || 0) * 0.5;
    targetV = dP < 9 ? (G.car ? Math.max(4, Math.hypot(G.car.vx, G.car.vz) * 0.95) : 2) : v.T.maxV * 0.85;
    if (!G.car && dP < 7) targetV = 0;
  } else {
    // Polyline verfolgen
    const ax = P[0], az = P[1], bx = P[2], bz = P[3], cx = P[4], cz = P[5];
    const sx = bx - ax, sz = bz - az, L1 = Math.hypot(sx, sz) || 1;
    let t = ((v.x - ax) * sx + (v.z - az) * sz) / (L1 * L1);
    const dB = Math.hypot(bx - v.x, bz - v.z);
    if (t > 0.999 || dB < 4) { // nächste Kante
      const nA = ai.B, nB = ai.C;
      let nC;
      if (chase) { const tn = nearestNode(px, pz).id; nC = bfsNext(nB, tn, nA); if (nC == null || nC === nA) nC = chooseNext(nB, nA); }
      else nC = chooseNext(nB, nA);
      ai.A = nA; ai.B = nB; ai.C = nC; ai.straight = lanePolyline(NODES[nA], NODES[nB], NODES[nC], P);
      return aiDrive(v, dt);
    }
    const look = 6 + Math.abs(vf) * 0.45;
    let s = clamp(t, 0, 1) * L1 + look;
    if (s <= L1) { tx = ax + sx / L1 * s; tz = az + sz / L1 * s; }
    else { const s2 = s - L1, ux = cx - bx, uz = cz - bz, L2 = Math.hypot(ux, uz) || 1; tx = bx + ux / L2 * Math.min(s2, L2); tz = bz + uz / L2 * Math.min(s2, L2); }
    targetV = chase ? v.T.maxV * 0.78 : ai.speed;
    if (!ai.straight && dB < 26) targetV = Math.min(targetV, chase ? 13 : 6.5);
    // Ampel: bei Rot/Gelb vor der Haltelinie stoppen
    if (!chase) { const tl = TL.get(ai.B); if (tl) { const NA = NODES[ai.A], NB = NODES[ai.B], ax = Math.abs(NB.x - NA.x) > Math.abs(NB.z - NA.z) ? 0 : 1; if (tlPhase(tl, ax) !== 0) { const dN = Math.hypot(NB.x - v.x, NB.z - v.z) - (RHW + 3 + v.T.len / 2); if (dN > -1 && (tlPhase(tl, ax) === 2 || dN > 6)) targetV = Math.min(targetV, Math.max(0, dN * 0.8)); } } }
    if (ai.panicT > 0) { ai.panicT -= dt; targetV = Math.max(targetV, v.T.maxV * 0.6); }
  }
  // Hindernisse voraus
  if (!ai.direct) {
    let block = 1e9;
    for (const o of vehicles) {
      if (o === v) continue;
      const dx = o.x - v.x, dz = o.z - v.z; if (Math.abs(dx) > 18 || Math.abs(dz) > 18) continue;
      const ahead = dx * fx + dz * fz, lat = dx * rx + dz * rz;
      if (ahead > 0 && ahead < 16 && Math.abs(lat) < 2.3) block = Math.min(block, ahead - (o.T.len + v.T.len) / 2);
    }
    if (!G.car && !chase) { const dx = player.x - v.x, dz = player.z - v.z, ahead = dx * fx + dz * fz, lat = dx * rx + dz * rz; if (ahead > 0 && ahead < 12 && Math.abs(lat) < 2) block = Math.min(block, ahead - v.T.len / 2 - 1.5); }
    for (const p of peds) { if (p.state === 'down') continue; const dx = p.x - v.x, dz = p.z - v.z; if (Math.abs(dx) > 12 || Math.abs(dz) > 12) continue; const ahead = dx * fx + dz * fz, lat = dx * rx + dz * rz; if (ahead > 0 && ahead < 10 && Math.abs(lat) < 1.8) block = Math.min(block, ahead - v.T.len / 2 - 1.5); }
    if (block < 1e9) targetV = Math.min(targetV, Math.max(0, block * (chase ? 2 : 1.1)));
  }
  if (ai.stunT > 0) { ai.stunT -= dt; targetV = 0; }
  // Steuern
  const want = Math.atan2(tx - v.x, tz - v.z);
  let st = angDiff(v.h, want);
  // Festgefahren → zurücksetzen
  if (ai.revT > 0) { ai.revT -= dt; v.thr = -0.8; v.steer = -Math.sign(st) || 1; v.hb = false; return; }
  if (targetV > 3 && Math.abs(vf) < 1.2 && ai.stunT <= 0) { ai.stuckT = (ai.stuckT || 0) + dt; if (ai.stuckT > (chase ? 1.0 : 3)) { ai.stuckT = 0; ai.revT = chase ? 1.0 : 1.4; } } else ai.stuckT = 0;
  if (Math.abs(st) > 1.6 && chase) { // Ziel hinter uns: wenden
    v.steer = Math.sign(st); v.thr = vf > 8 ? -0.5 : 0.7; v.hb = vf > 10; return;
  }
  v.steer = clamp(st * 2.2, -1, 1);
  const dv = targetV - vf;
  v.thr = clamp(dv * 0.35, -1, 1); v.hb = false;
}

// ---------------------------------------------------------------- Figuren
const peds = [];
function spawnPed(kind, x, z, ring) {
  const ch = mkChar(kind);
  const p = { ch, kind, x, z, h: 0, y: surfaceY(x, z), speed: kind === 'ranger' ? 1.2 : rand(1.0, 1.5), ring, dir: R() < 0.5 ? 1 : -1, state: 'walk', t: 0, phase: R() * 6, hp: kind === 'ranger' ? 3 : 2, fall: 0, vx: 0, vz: 0, flee: 0, talkT: 0, punchT: 0, hitT: 0, stars: null, said: 0, beach: !ring };
  ch.root.position.set(x, p.y, z); scene.add(ch.root);
  peds.push(p); return p;
}
function ringPoint(rg, u) { // u ∈ [0,4) entlang des Rings
  const w = rg.x1 - rg.x0, d = rg.z1 - rg.z0, per = 2 * (w + d); let s = ((u % per) + per) % per;
  if (s < w) return [rg.x0 + s, rg.z0]; s -= w; if (s < d) return [rg.x1, rg.z0 + s]; s -= d; if (s < w) return [rg.x1 - s, rg.z1]; s -= w; return [rg.x0, rg.z1 - s];
}
function ringNearest(rg, x, z) {
  const w = rg.x1 - rg.x0, d = rg.z1 - rg.z0;
  const cand = [[clamp(x, rg.x0, rg.x1) - rg.x0, Math.abs(z - rg.z0)], [w + clamp(z, rg.z0, rg.z1) - rg.z0, Math.abs(x - rg.x1)], [w + d + rg.x1 - clamp(x, rg.x0, rg.x1), Math.abs(z - rg.z1)], [2 * w + d + rg.z1 - clamp(z, rg.z0, rg.z1), Math.abs(x - rg.x0)]];
  cand.sort((a, b) => a[1] - b[1]); return cand[0][0];
}
function starSprite() {
  const c = canvas(64, 64), g = c.getContext('2d'); g.fillStyle = '#ffe14a'; g.strokeStyle = '#a0600a'; g.lineWidth = 3; g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 12 : 28; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
  return new THREE.SpriteMaterial({ map: tex(c), depthTest: false, transparent: true });
}
let STAR_MAT = null;
function knockDown(p, fromX, fromZ, force = 4) {
  p.state = 'down'; p.t = 0; p.fall = 0; const dx = p.x - fromX, dz = p.z - fromZ, l = Math.hypot(dx, dz) || 1;
  p.vx = dx / l * force; p.vz = dz / l * force; p.h = Math.atan2(-dx, -dz);
  if (!STAR_MAT) STAR_MAT = starSprite();
  if (!p.stars) { p.stars = new THREE.Group(); for (let k = 0; k < 3; k++) { const s = new THREE.Sprite(STAR_MAT); s.scale.set(0.28, 0.28, 1); p.stars.add(s); } scene.add(p.stars); }
  p.stars.visible = true;
}
function stepPed(p, dt, near) {
  p.t += dt;
  const ch = p.ch;
  if (p.state === 'down') {
    p.fall = Math.min(1, p.fall + dt * 4);
    p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= Math.exp(-4 * dt); p.vz *= Math.exp(-4 * dt);
    if (p.stars) { const a = p.t * 5; p.stars.children.forEach((s, k) => s.position.set(Math.cos(a + k * 2.1) * 0.35, 0.35, Math.sin(a + k * 2.1) * 0.35)); p.stars.position.set(p.x - Math.sin(p.h) * 1.5, p.y, p.z - Math.cos(p.h) * 1.5); }
    if (p.t > 4.2 && !p.out) { p.state = 'getup'; p.t = 0; if (p.stars) p.stars.visible = false; }
  } else if (p.state === 'getup') {
    p.fall = Math.max(0, p.fall - dt * 2);
    if (p.fall <= 0) { p.state = 'flee'; p.t = 0; p.flee = 8; p.hp = p.maxHp || (p.kind === 'ranger' ? 3 : 2); }
  } else {
    let tx, tz, spd = p.speed;
    p.look = null;
    if (p.hostile) { [tx, tz, spd] = stepHostile(p, dt); }
    else if (p.state === 'sit' || p.state === 'lie' || p.state === 'dance' || p.state === 'idle') { spd = 0; tx = p.x + Math.sin(p.h); tz = p.z + Math.cos(p.h); if (p.state === 'idle' && Math.hypot(player.x - p.x, player.z - p.z) < 6) p.look = _lookV.set(player.x, player.y + 1.6, player.z); }
    else if (p.state === 'flee') {
      p.flee -= dt; const dx = p.x - player.x, dz = p.z - player.z, l = Math.hypot(dx, dz) || 1;
      tx = p.x + dx / l * 5; tz = p.z + dz / l * 5; spd = 4.2;
      if (p.flee <= 0) { p.state = p.ring || p.beach ? 'walk' : 'idle'; if (p.ring) p.u = ringNearest(p.ring, p.x, p.z); }
    } else if (p.state === 'talk') {
      p.talkT -= dt; spd = 0; tx = p.x + Math.sin(p.h); tz = p.z + Math.cos(p.h);
      if (p.talkT <= 0) p.state = 'walk';
    } else if (p.ring) {
      if (p.u == null) p.u = ringNearest(p.ring, p.x, p.z);
      p.u += p.dir * spd * dt;
      [tx, tz] = ringPoint(p.ring, p.u + p.dir * 1.5);
      // D2D-ler bleiben an Haustüren stehen
      if (p.kind === 'ranger' && R() < dt * 0.06) { p.state = 'talk'; p.talkT = rand(3, 6); }
    } else {
      // Strand: zufällig schlendern
      if (!p.goal || Math.hypot(p.goal[0] - p.x, p.goal[1] - p.z) < 1) p.goal = [rand(BEACH_X + 4, 318), clamp(p.z + rand(-30, 30), LAND.z0 + 8, LAND.z1 - 8)];
      [tx, tz] = p.goal;
    }
    const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz);
    if (l > 0.01 && spd > 0) {
      const want = Math.atan2(dx, dz); p.h += angDiff(p.h, want) * Math.min(1, dt * 8);
      const mv = Math.min(spd * dt, l + 0.5);
      if (p.state === 'flee' || p.hostile || !p.ring) { p.x += Math.sin(p.h) * mv; p.z += Math.cos(p.h) * mv; }
      else { [p.x, p.z] = ringPoint(p.ring, p.u); }
    }
    p.phase += dt * spd * 4.2;
    p.cur = spd;
  }
  // Kollision mit Gebäuden
  if (p.state !== 'sit' && p.state !== 'lie' && circleHit(p.x, p.z, 0.35, _hit)) { p.x += _hit.x; p.z += _hit.z; if (p.state === 'flee' && R() < 0.05) p.h += 1.5; }
  if (p.x > DEEP_X - 8) p.x = DEEP_X - 8;
  p.y += (surfaceY(p.x, p.z) - p.y) * Math.min(1, dt * 10);
  p.hitT = Math.max(0, p.hitT - dt); p.punchT = Math.max(0, (p.punchT || 0) - dt); p.swingT = Math.max(0, (p.swingT || 0) - dt); p.recoil = Math.max(0, (p.recoil || 0) - dt * 6);
  if (near) {
    ch.root.position.set(p.x, p.y + (p.yOff || 0), p.z); ch.root.rotation.y = p.h;
    if (ch.human) {
      const dc = Math.hypot(p.x - camera.position.x, p.z - camera.position.z);
      const vis = dc < Q.pedVis && (dc < 14 || inView(p.x, p.z, 2.5));
      ch.root.visible = vis;
      if (vis) {
        animateHuman(ch, dt, { speed: p.state === 'talk' || p.state === 'sit' || p.state === 'dance' || p.state === 'idle' || p.state === 'lie' ? 0 : (p.cur || 0), fall: p.state === 'lie' ? 1 : p.fall, talk: p.state === 'talk' || p.chat ? p.t : 0, hit: p.hitT / 0.3,
          punch: p.punchT > 0 ? 1 - p.punchT / 0.35 : 0, swing: p.swingT > 0 ? 1 - p.swingT / 0.45 : 0, aim: p.aimT > 0 ? p.aimAt : null, weapon: p.weapon, recoil: p.recoil,
          dance: p.state === 'dance', sit: p.state === 'sit' ? 'bench' : null, flee: p.state === 'flee', look: p.look || null, far: dc > Q.pedFar });
        setHumanShadow(ch, dc < Q.pedShadow);
      }
    } else {
      ch.root.visible = true;
      poseCharacter(ch, p.phase, p.state === 'talk' ? 0 : clamp((p.cur || 0) / 2.5, 0.4, 1.3), 0, p.fall, p.state === 'talk' ? p.t : 0);
      ch.body.rotation.x = p.hitT > 0 ? -0.4 * p.hitT / 0.3 : 0;
    }
  } else ch.root.visible = false;
}
function respawnPed(p) {
  // weit weg → neu in der Nähe des Spielers
  if (p.kind === 'ranger') { const rg = pick(R, world.resRings.filter(rg => Math.hypot((rg.x0 + rg.x1) / 2 - player.x, (rg.z0 + rg.z1) / 2 - player.z) < 260)) || pick(R, world.resRings); p.ring = rg; }
  else if (!p.beach) p.ring = pick(R, world.rings.filter(rg => { const d = Math.hypot((rg.x0 + rg.x1) / 2 - player.x, (rg.z0 + rg.z1) / 2 - player.z); return rg.kind !== 'R' && d > 30 && d < 110; })) || p.ring;
  if (p.ring) { // Stelle außer Sicht, aber in der Nähe (belebte Straßen)
    for (let k = 0; k < 8; k++) { p.u = R() * 240; [p.x, p.z] = ringPoint(p.ring, p.u); const d = Math.hypot(p.x - player.x, p.z - player.z); if (d > 38 && d < 120 && (!inView(p.x, p.z) || d > 70)) break; }
  }
  p.state = 'walk'; p.fall = 0; p.hp = p.kind === 'ranger' ? 3 : 2; if (p.stars) p.stars.visible = false;
  p.out = false; p.hostile = false; p.aimT = 0; if (p.weapon && p.ch.human) setHumanWeapon(p.ch, null); p.weapon = null;
}

// ---------------------------------------------------------------- Spieler
const player = { x: 0, z: 0, y: 0, h: 0, vx: 0, vz: 0, ch: mkChar('player'), phase: 0, punchT: 0, punchCD: 0, fall: 0, downT: 0, sprint: false };
scene.add(player.ch.root);
const SPAWN = world.pois.spawn;
function placePlayer(x, z, h = 0) { player.x = x; player.z = z; player.h = h; player.y = surfaceY(x, z); player.vx = player.vz = 0; player.ch.root.visible = true; }
placePlayer(SPAWN.x, SPAWN.z, Math.PI);

// ---------------------------------------------------------------- Eingabe
const keys = {};
const inp = { mx: 0, my: 0, sprint: false, hb: false, punch: false, act: false, actHeld: false, horn: false, camDX: 0, camDY: 0, lastCam: -10 };
addEventListener('keydown', e => {
  if (e.repeat && !['KeyE'].includes(e.code)) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (!G.started) return;
  if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Tab') { e.preventDefault(); togglePhone(); }
  if (G.paused) return;
  if (e.code === 'KeyF' || e.code === 'Enter') enterExit();
  if (e.code === 'KeyE' && !e.repeat) { inp.actHeld = true; if (!ctx.rob) enterExit(); }
  if (e.code === 'KeyQ') inp.punch = true;
  if (/^Digit[1-4]$/.test(e.code) && !G.car) selectSlot(+e.code.slice(5) - 1);
  if (e.code === 'KeyC' && !e.repeat && !G.car) openWheel();
  if (e.code === 'KeyR') nextStation();
  if (e.code === 'KeyH') AU.sfx.horn();
  if (e.code === 'KeyM') { openPhone('map'); }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyE') inp.actHeld = false; if (e.code === 'KeyC') closeWheel(true); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// Maus: Klick = Schlag, Ziehen/Pointer-Lock = Kamera
glCanvas.addEventListener('mousedown', e => {
  if (!G.started || G.paused || isTouch) return;
  if (document.pointerLockElement !== glCanvas && !TEST) { glCanvas.requestPointerLock?.(); }
  if (e.button === 0) { inp.punch = true; W.fireHeld = true; }
  if (e.button === 2) { W.aimHeld = true; e.preventDefault(); }
});
addEventListener('mouseup', e => { if (e.button === 0) W.fireHeld = false; if (e.button === 2) W.aimHeld = false; });
glCanvas.addEventListener('contextmenu', e => e.preventDefault());
glCanvas.addEventListener('wheel', e => { if (!G.started || G.paused || G.car) return; e.preventDefault(); cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: false });
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== glCanvas) return;
  if (W.wheel) { W.wheelX = clamp(W.wheelX + e.movementX, -120, 120); W.wheelY = clamp(W.wheelY + e.movementY, -120, 120); wheelPoint(W.wheelX, W.wheelY); return; }
  inp.camDX += e.movementX; inp.camDY += e.movementY; inp.lastCam = G.time;
});
// Touch: virtueller Joystick links, Kamera-Wischen rechts
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, look = { id: null, x: 0, y: 0 };
const joyEl = $('joy'), joyKnob = $('joyKnob');
function onTouchStart(e) {
  if (!G.started || G.paused) return;
  for (const t of e.changedTouches) {
    if (t.target.closest && t.target.closest('.tbtn, #hudPhone, #phone, .chip, #wheel, #ammu')) continue;
    const lr = touchLayer.getBoundingClientRect();
    if (t.clientX - lr.left < lr.width * 0.42 && joy.id === null) { joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0; joy.r = Math.max(40, (joyEl.getBoundingClientRect().width || 120) * 0.46); joyEl.style.left = (t.clientX - lr.left) + 'px'; joyEl.style.top = (t.clientY - lr.top) + 'px'; joyEl.classList.add('on'); }
    else if (look.id === null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; }
  }
  e.preventDefault();
}
function onTouchMove(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { const dx = t.clientX - joy.ox, dy = t.clientY - joy.oy, l = Math.hypot(dx, dy), m = joy.r || 55, k = l > m ? m / l : 1; joy.x = dx * k / m; joy.y = dy * k / m; joyKnob.style.transform = `translate(${dx * k}px,${dy * k}px)`; }
    if (t.identifier === look.id) { inp.camDX += (t.clientX - look.x) * 1.6; inp.camDY += (t.clientY - look.y) * 1.6; look.x = t.clientX; look.y = t.clientY; inp.lastCam = G.time; }
  }
  e.preventDefault();
}
function onTouchEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; joyKnob.style.transform = ''; joyEl.classList.remove('on'); }
    if (t.identifier === look.id) look.id = null;
  }
}
const touchLayer = $('touchLayer');
touchLayer.addEventListener('touchstart', onTouchStart, { passive: false });
touchLayer.addEventListener('touchmove', onTouchMove, { passive: false });
touchLayer.addEventListener('touchend', onTouchEnd); touchLayer.addEventListener('touchcancel', onTouchEnd);
function holdBtn(id, on, off) {
  const el = $(id); if (!el) return;
  const d = e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); AU.initAudio(); on(); };
  const u = e => { e.preventDefault(); el.classList.remove('down'); off && off(); };
  el.addEventListener('touchstart', d, { passive: false }); el.addEventListener('touchend', u); el.addEventListener('touchcancel', u);
  el.addEventListener('mousedown', d); el.addEventListener('mouseup', u); el.addEventListener('mouseleave', e => { if (el.classList.contains('down')) u(e); });
}
holdBtn('bPunch', () => { if (G.car) inp.hb = true; else { inp.punch = true; W.fireHeld = true; } }, () => { inp.hb = false; W.fireHeld = false; });
holdBtn('bAim', () => toggleLock());
holdBtn('bEnter', () => enterExit());
holdBtn('bHorn', () => { if (G.car) AU.sfx.horn(); });
// Waffen-Taste: Tippen = wechseln (Fäuste → 1 → 2 → 3), lange drücken = Waffenrad (Finger ziehen, loslassen wählt)
const wpnHold = { t: 0, id: null, x: 0, y: 0 };
{
  const el = $('bWeapon');
  const down = e => { e.preventDefault(); e.stopPropagation(); AU.initAudio(); el.classList.add('down'); const p = e.changedTouches ? e.changedTouches[0] : e; wpnHold.id = e.changedTouches ? p.identifier : 'm'; const r = $('wheel').getBoundingClientRect(); wpnHold.x = p.clientX; wpnHold.y = p.clientY; clearTimeout(wpnHold.t); wpnHold.t = setTimeout(() => { openWheel(); wpnHold.open = true; }, 420); wpnHold.open = false; };
  const move = e => { if (!W.wheel || wpnHold.id == null) return; const p = e.changedTouches ? [...e.changedTouches].find(t => t.identifier === wpnHold.id) : e; if (!p) return; e.preventDefault(); const r = $('wheelSegs').getBoundingClientRect(); wheelPoint(p.clientX - (r.left + r.width / 2), p.clientY - (r.top + r.height / 2)); };
  const up = e => { if (wpnHold.id == null) return; e.preventDefault(); el.classList.remove('down'); clearTimeout(wpnHold.t); wpnHold.id = null; if (W.wheel) closeWheel(true); else if (!wpnHold.open) cycleWeapon(1); };
  el.addEventListener('touchstart', down, { passive: false }); addEventListener('touchmove', move, { passive: false }); el.addEventListener('touchend', up); el.addEventListener('touchcancel', up);
  el.addEventListener('mousedown', down); addEventListener('mousemove', move); addEventListener('mouseup', up);
}
holdBtn('bRadio', () => nextStation());
holdBtn('bAct', () => { inp.actHeld = true; }, () => { inp.actHeld = false; });
holdBtn('bGas', () => { inp.gas = true; }, () => { inp.gas = false; });
holdBtn('bBrake', () => { inp.brake = true; }, () => { inp.brake = false; });
function moveInput() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1; if (keys.KeyS || keys.ArrowDown) y += 1;
  if (joy.id !== null) { x += joy.x; y += joy.y; }
  if (inp.gas) y -= 1; if (inp.brake) y += 1;
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  if (TEST && window.__mvInput) { x = window.__mvInput.x; y = window.__mvInput.y; }
  return [x, y];
}

// ---------------------------------------------------------------- Kamera
const cam = { yaw: Math.PI / 2, pitch: 0.28, dist: 4.6, shake: 0, fov: 62, tx: 0, ty: 0, tz: 0, init: false };
function shake(a) { cam.shake = Math.max(cam.shake, a); }
function updateCamera(dt) {
  const inCar = !!G.car;
  const tgt = inCar ? G.car : player;
  cam.yaw -= inp.camDX * 0.0042; cam.pitch = clamp(cam.pitch + inp.camDY * 0.003, -0.25, 1.1); inp.camDX = inp.camDY = 0;
  // Autofolgen
  const idle = G.time - inp.lastCam > (inCar ? 1.0 : 2.0);
  if (idle) {
    let want = tgt.h;
    if (inCar) { const sp = Math.hypot(G.car.vx, G.car.vz); if (sp > 2) { const vh = Math.atan2(G.car.vx, G.car.vz); const fwdDot = Math.sin(G.car.h) * G.car.vx + Math.cos(G.car.h) * G.car.vz; want = fwdDot < -2 ? G.car.h : vh; } }
    const moving = inCar ? Math.hypot(G.car.vx, G.car.vz) > 1 : Math.hypot(player.vx, player.vz) > 0.5;
    if (moving) cam.yaw += angDiff(cam.yaw, want) * Math.min(1, dt * (inCar ? 3.2 : 1.6));
    cam.pitch += ((inCar ? 0.2 : 0.26) - cam.pitch) * Math.min(1, dt * 1.5);
  }
  const L = inCar ? G.car.T.len : 0;
  const sp = inCar ? Math.hypot(G.car.vx, G.car.vz) : 0;
  const wantDist = inCar ? 3.6 + L * 0.72 + sp * 0.035 : 4.4;
  cam.dist += (wantDist - cam.dist) * Math.min(1, dt * 3);
  const ty = tgt.y + (inCar ? 1.0 + G.car.T.h * 0.5 : 1.6);
  if (!cam.init) { cam.tx = tgt.x; cam.ty = ty; cam.tz = tgt.z; cam.init = true; }
  const k = Math.min(1, dt * (inCar ? 14 : 12));
  cam.tx += (tgt.x - cam.tx) * k; cam.ty += (ty - cam.ty) * k; cam.tz += (tgt.z - cam.tz) * k;
  // Schulterversatz zu Fuß
  const sx = inCar ? 0 : -Math.cos(cam.yaw) * 0.55, sz = inCar ? 0 : Math.sin(cam.yaw) * 0.55;
  const cp = Math.cos(cam.pitch), spi = Math.sin(cam.pitch);
  let d = cam.dist;
  // Kamera-Kollision mit Gebäuden
  for (let s = 0.6; s <= cam.dist; s += 0.4) {
    const x = cam.tx + sx - Math.sin(cam.yaw) * cp * s, z = cam.tz + sz - Math.cos(cam.yaw) * cp * s, y = ty + spi * s;
    let blocked = false;
    for (const c of queryColliders(x, z, 0.3)) if (c.h > y - 0.3 && x > c.x0 - 0.3 && x < c.x1 + 0.3 && z > c.z0 - 0.3 && z < c.z1 + 0.3 && c.kind !== 'lamp' && c.kind !== 'palm') { blocked = true; break; }
    if (blocked) { d = Math.max(1.5, s - 0.4); break; }
  }
  const px = cam.tx + sx - Math.sin(cam.yaw) * cp * d, pz = cam.tz + sz - Math.cos(cam.yaw) * cp * d;
  let py = ty + spi * d + (cam.dist - d) * 0.35; py = Math.max(py, surfaceY(px, pz) + 0.4);
  camera.position.set(px, py, pz);
  if (cam.shake > 0) { camera.position.x += (R() - 0.5) * cam.shake * 0.5; camera.position.y += (R() - 0.5) * cam.shake * 0.4; cam.shake = Math.max(0, cam.shake - dt * 2.5); }
  camera.lookAt(cam.tx + sx, ty + (inCar ? 0 : 0.05), cam.tz + sz);
  if (TEST && window.__mvCam) { const o = window.__mvCam; camera.position.set(o.p[0], o.p[1], o.p[2]); camera.lookAt(o.l[0], o.l[1], o.l[2]); }
  const fov = inCar ? 62 + clamp(sp / 50, 0, 1) * 16 : 60;
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 2);
  if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------- Spieler-Steuerung
function stepPlayer(dt) {
  const [mx, my] = moveInput();
  if (G.car) {
    const v = G.car;
    const fwd = Math.sin(v.h) * v.vx + Math.cos(v.h) * v.vz;
    v.thr = -my; v.steer = clamp(-mx, -1, 1) * (1 - Math.min(0.35, Math.abs(fwd) / 120));
    if (keys.Space || inp.hb) v.hb = true; else v.hb = false;
    if (TEST && window.__mvInput && window.__mvInput.hb) v.hb = true;
    player.x = v.x; player.z = v.z; player.y = v.y; player.vx = v.vx; player.vz = v.vz; player.h = v.h;
    return;
  }
  const P = player, ch = P.ch;
  P.punchT = Math.max(0, P.punchT - dt); P.punchCD = Math.max(0, P.punchCD - dt);
  if (P.downT > 0) { // umgefahren
    P.downT -= dt; P.fall = Math.min(1, P.fall + dt * 5);
    P.x += P.vx * dt; P.z += P.vz * dt; P.vx *= Math.exp(-4 * dt); P.vz *= Math.exp(-4 * dt);
    if (P.downT <= 0) P.fall = 0;
  } else {
    const aiming = W.aimT > 0 && isGun(curW());
    const sprint = !aiming && (keys.ShiftLeft || keys.ShiftRight || inp.sprint || (joy.id !== null && Math.hypot(joy.x, joy.y) > 0.92));
    const spd = (sprint ? 6.6 : aiming ? 2.2 : 3.0) * Math.min(1, Math.hypot(mx, my) * 1.2);
    if (Math.hypot(mx, my) > 0.08) {
      // relativ zur Kamera
      const a = cam.yaw, fx = Math.sin(a), fz = Math.cos(a), rx = -fz, rz = fx;
      const dx = fx * -my + rx * mx, dz = fz * -my + rz * mx, l = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz); if (!aiming) P.h += angDiff(P.h, want) * Math.min(1, dt * 12);
      P.vx = dx / l * spd; P.vz = dz / l * spd;
    } else { P.vx *= Math.exp(-14 * dt); P.vz *= Math.exp(-14 * dt); }
    P.x += P.vx * dt; P.z += P.vz * dt;
    const s = Math.hypot(P.vx, P.vz); P.phase += dt * s * 3.4; P.curSpeed = s;
  }
  // Kollision Welt & Autos
  if (circleHit(P.x, P.z, 0.38, _hit)) { P.x += _hit.x; P.z += _hit.z; }
  for (const v of vehicles) {
    if (Math.abs(v.x - P.x) > 8 || Math.abs(v.z - P.z) > 8) continue;
    const sp = Math.hypot(v.vx, v.vz);
    for (const [cx, cz] of carCircles(v)) {
      const dx = P.x - cx, dz = P.z - cz, d = Math.hypot(dx, dz), rr = v.T.wid / 2 + 0.38;
      if (d < rr) {
        P.x += dx / (d || 1) * (rr - d); P.z += dz / (d || 1) * (rr - d);
        if (sp > 5 && P.downT <= 0) { hurt(sp * 2.2); P.downT = 2.2; P.fall = 0; P.vx = v.vx * 0.6 + dx / (d || 1) * 3; P.vz = v.vz * 0.6 + dz / (d || 1) * 3; AU.sfx.punch(); shake(0.6); }
      }
    }
  }
  // Wasser: nicht zu tief
  if (P.x > DEEP_X - 6) { P.x = DEEP_X - 6; if (G.time - (P.waterMsg || -9) > 5) { P.waterMsg = G.time; help('Zu tief! Telekom-Mitarbeiter schwimmen nur im Geld.'); } }
  if (!onLand(P.x, P.z) && P.x < LAND.x0) { P.x = Math.max(P.x, LAND.x0 + 1); }
  P.y += (surfaceY(P.x, P.z) - P.y) * Math.min(1, dt * 12);
  // Schlagen
  playerAttack(dt);
  ch.root.position.set(P.x, P.y, P.z); ch.root.rotation.y = P.h;
  P.hitT = Math.max(0, (P.hitT || 0) - dt);
  if (ch.human) animateHuman(ch, dt, { speed: P.downT > 0 ? 0 : (P.curSpeed || 0), punch: P.punchT > 0 ? 1 - P.punchT / 0.32 : 0, fall: P.fall, aim: P.downT <= 0 && W.aimT > 0 ? W.aimPt : null, weapon: curW(), recoil: W.recoil, swing: W.swingT > 0 ? 1 - W.swingT / 0.4 : 0, hit: P.hitT / 0.3 });
  else poseCharacter(ch, P.phase, clamp((P.curSpeed || 0) / 3, 0, 1.4), P.punchT > 0 ? 1 - P.punchT / 0.32 : 0, P.fall);
}
function doPunch(dmg = 1, reach = 2.3, bat = false) {
  AU.sfx.whoosh(); G.stats.punches++;
  const fx = Math.sin(player.h), fz = Math.cos(player.h);
  let best = null, bd = reach;
  for (const p of peds) {
    if (p.state === 'down' || p.state === 'getup' || p.out) continue;
    const dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz);
    if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.35) { best = p; bd = d; }
  }
  if (!best) return;
  setTimeout(() => AU.sfx.punch(), 90);
  best.hp -= dmg; best.hitT = 0.3; best.h = Math.atan2(-fx, -fz); best.sit = null; best.yOff = 0;
  if (bat && BLOOD && R() < 0.5) bloodSpray(new THREE.Vector3(best.x, best.y + 1.5, best.z), new THREE.Vector3(fx, 0, fz), 4);
  if (best.kind === 'ranger' && !best.hostile && best.hp > 0) rangerAggro(best, false);
  if (best.cop && G.wanted < 2) crime(2, 'Angriff auf Polizei', true);
  { const dx = best.x - player.x, dz = best.z - player.z, d = Math.hypot(dx, dz) || 1; player.h = Math.atan2(dx, dz); if (d > 1.0) { player.x += dx / d * Math.min(0.5, d - 1.0); player.z += dz / d * Math.min(0.5, d - 1.0); } best.x += dx / d * 0.18; best.z += dz / d * 0.18; }
  shake(0.15);
  if (best.kind === 'ranger') label(best, pick(R, ['Aua! Mein Klemmbrett!', 'Hey! Ich mach nur meinen Job!', 'Das melde ich meinem Teamleiter!', 'Wollen Sie nicht doch unterschreiben?']), 1.6, 'bubble');
  else label(best, pick(R, ['Aua!', 'Hey!', 'Spinnst du?!', 'Hilfe!']), 1.2, 'bubble');
  if (best.hp <= 0) {
    knockDown(best, player.x, player.z, 5); AU.sfx.boing(); best.hostile = false;
    if (best.kind === 'ranger') {
      G.stats.rangers++; G.mstate.rangers = (G.mstate.rangers || 0) + 1;
      dropPickup('clipboard', best.x - fx * 0.2 + fz * 0.9, best.z - fz * 0.2 - fx * 0.9, 2 + Math.floor(R() * 3));
      dropPickup('cash', best.x - fx * 0.2 - fz * 0.9, best.z - fz * 0.2 + fx * 0.9, Math.round(rand(20, 80)) * 100);
      popup(best, 'D2D-LER AUSGEKNOCKT!', 'warn');
    } else if (R() < 0.6) dropPickup('cash', best.x + fx, best.z + fz, Math.round(rand(5, 35)) * 100);
    if (policeNear(player.x, player.z, 60)) crime(1, 'Körperverletzung');
  } else if (best.kind !== 'ranger' && !best.cop && R() < 0.5) { best.state = 'flee'; best.flee = 6; }
  // Umstehende fliehen
  for (const p of peds) if (p !== best && (p.state === 'walk' || p.state === 'idle' || p.state === 'sit') && !p.hostile && Math.hypot(p.x - player.x, p.z - player.z) < 14 && R() < 0.7) { p.state = 'flee'; p.flee = 5; }
}
function hurt(n) {
  if (G.deadT > 0) return;
  G.health = Math.max(0, G.health - n); flash('hurt');
  if (G.health <= 0) wasted();
}
// ---------------------------------------------------------------- Waffen, Inventar & Kampf
const WEAP = {
  faust: { name: 'Fäuste', melee: true },
  schlagstock: { name: 'Schlagstock', melee: true, dmg: 2, price: 8000 },
  pistole: { name: 'Pistole', dmg: 2, rate: 0.3, spread: 0.012, range: 75, pellets: 1, carDmg: 28, price: 45000, ammoN: 36, ammoPrice: 6000, start: 36, auto: false },
  uzi: { name: 'Uzi', dmg: 1, rate: 0.08, spread: 0.04, range: 55, pellets: 1, carDmg: 15, price: 120000, ammoN: 120, ammoPrice: 12000, start: 120, auto: true },
  schrotflinte: { name: 'Schrotflinte', dmg: 0.85, rate: 0.85, spread: 0.075, range: 30, pellets: 8, carDmg: 12, price: 160000, ammoN: 16, ammoPrice: 9000, start: 16, auto: false },
};
const WDESC = { schlagstock: 'Für schwierige Kundengespräche.', pistole: '12 Schuss Überzeugungskraft. Ohne Vertragsbindung.', uzi: 'Flatrate-Feuer. Leider mit Datenvolumen.', schrotflinte: 'Breitband – deckt die ganze Straße ab.' };
const WKEYS = ['schlagstock', 'pistole', 'uzi', 'schrotflinte'];
const INV = { slots: [null, null, null], sel: 0, last: 1 };
if (Array.isArray(SAVE.inv)) SAVE.inv.slice(0, 3).forEach((s, i) => { if (s && WEAP[s.k]) INV.slots[i] = { k: s.k, ammo: Math.max(0, s.ammo | 0) }; });
let BLOOD = SAVE.blood !== false;
const W = { aimT: 0, aimPt: new THREE.Vector3(), recoil: 0, swingT: 0, cd: 0, lock: null, aimHeld: false, fireHeld: false, lastShot: -9, lastCrime: -9, wheel: false, wheelSel: 0, wheelX: 0, wheelY: 0 };
function curW() { return INV.sel === 0 ? 'faust' : (INV.slots[INV.sel - 1] && INV.slots[INV.sel - 1].k) || 'faust'; }
function curSlot() { return INV.sel ? INV.slots[INV.sel - 1] : null; }
function isGun(k) { return k === 'pistole' || k === 'uzi' || k === 'schrotflinte'; }
function selectSlot(i, quiet) {
  if (i > 0 && !INV.slots[i - 1]) return false;
  INV.sel = i; if (i) INV.last = i;
  if (player.ch.human) setHumanWeapon(player.ch, curW() === 'faust' ? null : curW());
  if (!isGun(curW())) W.lock = null;
  if (!quiet) AU.sfx.wheel();
  updateWeaponHud(); return true;
}
function cycleWeapon(dir = 1) { for (let k = 1; k <= 4; k++) { const i = ((INV.sel + dir * k) % 4 + 4) % 4; if (i === 0 || INV.slots[i - 1]) { selectSlot(i); return; } } }
function persistInv() { SAVE.inv = INV.slots.map(s => s && { k: s.k, ammo: s.ammo }); SAVE.blood = BLOOD; persist(); }
function giveWeapon(k, ammo) {
  const have = INV.slots.findIndex(s => s && s.k === k);
  if (have >= 0) { INV.slots[have].ammo += ammo; AU.sfx.pickup(); if (isGun(k)) help(`+${ammo} Schuss für ${WEAP[k].name}`); updateWeaponHud(); persistInv(); return true; }
  let i = INV.slots.findIndex(s => !s);
  if (i < 0) { // Waffentausch: gehaltene (oder zuletzt gehaltene) Waffe fallen lassen
    i = (INV.sel || INV.last || 1) - 1;
    const old = INV.slots[i], fx = Math.sin(player.h), fz = Math.cos(player.h);
    const d = dropPickup('w:' + old.k, player.x - fz * 1.3 - fx * 0.5, player.z + fx * 1.3 - fz * 0.5, old.ammo, 120); d.noPick = 1;
    help(`Waffentausch: ${WEAP[old.k].name} abgelegt, ${WEAP[k].name} genommen.`);
  } else help(`${WEAP[k].name} aufgenommen! ${isTouch ? 'Waffen-Taste: wechseln · lange drücken: Waffenrad' : '1–4 / Mausrad: wechseln · C halten: Waffenrad'}`);
  INV.slots[i] = { k, ammo }; AU.sfx.pickup(); selectSlot(i + 1, true); persistInv();
  return true;
}
// Waffen-Symbole aus den echten 3D-Modellen rendern
const ICONS = {};
function weaponIcon(k) {
  if (ICONS[k]) return ICONS[k];
  try {
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x556070, 2.4)); const dl = new THREE.DirectionalLight(0xffffff, 2.6); dl.position.set(1, 3, 4); sc.add(dl);
    const m = weaponModel(k); m.rotation.y = Math.PI / 2; sc.add(m); m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const hw = Math.max(s.x * 0.56, s.y * 1.12), W2 = 512, H2 = 256;
    const camO = new THREE.OrthographicCamera(-hw, hw, hw / 2, -hw / 2, 0.01, 20); camO.position.set(c.x, c.y, c.z + 5); camO.lookAt(c);
    const rt = new THREE.WebGLRenderTarget(W2, H2);
    const oldCol = renderer.getClearColor(new THREE.Color()), oldA = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, camO);
    const px = new Uint8Array(W2 * H2 * 4); renderer.readRenderTargetPixels(rt, 0, 0, W2, H2, px);
    renderer.setRenderTarget(null); renderer.setClearColor(oldCol, oldA); rt.dispose();
    const cv = canvas(W2, H2), g = cv.getContext('2d'), id = g.createImageData(W2, H2);
    const enc = x => { x /= 255; x = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; return Math.min(255, x * 255 * 1.15); };
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const a = ((H2 - 1 - y) * W2 + x) * 4, b = (y * W2 + x) * 4; id.data[b] = enc(px[a]); id.data[b + 1] = enc(px[a + 1]); id.data[b + 2] = enc(px[a + 2]); id.data[b + 3] = px[a + 3]; }
    g.putImageData(id, 0, 0);
    const out = canvas(192, 96), og = out.getContext('2d'); og.shadowColor = 'rgba(0,0,0,.8)'; og.shadowBlur = 6; og.drawImage(cv, 0, 0, 192, 96);
    return ICONS[k] = out.toDataURL('image/png');
  } catch (e) { console.warn('Waffen-Icon', k, e); return ICONS[k] = ''; }
}
function slotHtml(k, ammo) { return k === 'faust' ? '<span class="wfist">👊</span>' : `<img src="${weaponIcon(k)}" alt="">${isGun(k) ? `<em>${ammo}</em>` : ''}`; }
function updateWeaponHud() {
  const el = $('wslots'); if (!el) return;
  let h = `<div class="ws ${INV.sel === 0 ? 'sel' : ''}">${slotHtml('faust')}</div>`;
  for (let i = 0; i < 3; i++) { const s = INV.slots[i]; h += `<div class="ws ${INV.sel === i + 1 ? 'sel' : ''} ${s ? '' : 'empty'}">${s ? slotHtml(s.k, s.ammo) : `<b>${i + 2}</b>`}</div>`; }
  el.innerHTML = h;
  const k = curW(), s = curSlot();
  $('bWeapon').innerHTML = k === 'faust' ? '👊' : `<img src="${weaponIcon(k)}" alt="">${isGun(k) ? `<em>${s.ammo}</em>` : ''}`;
  $('bPunch').textContent = G.car ? '⛔' : isGun(k) ? '🔥' : '👊';
  $('bPunch').title = G.car ? 'Handbremse' : isGun(k) ? 'Feuern' : 'Schlagen';
  $('bAim').classList.toggle('hide', !isGun(k));
  document.body.classList.toggle('armed', isGun(k));
}
// Waffenrad
function openWheel() {
  if (G.car || W.wheel) return;
  W.wheel = true; W.wheelSel = INV.sel; W.wheelX = W.wheelY = 0;
  const segs = [['faust', null], ...INV.slots.map(s => s ? [s.k, s.ammo] : [null, null])];
  $('wheelSegs').innerHTML = segs.map(([k, a], i) => `<div class="wseg s${i} ${k ? '' : 'empty'} ${i === INV.sel ? 'hot' : ''}" data-ws="${i}">${k ? slotHtml(k, a) + `<span>${WEAP[k].name}</span>` : '<span>leer</span>'}</div>`).join('');
  $('wheelName').textContent = WEAP[curW()].name;
  $('wheel').classList.add('on'); AU.sfx.wheel();
}
function wheelHot(i) {
  if (i > 0 && !INV.slots[i - 1]) return;
  W.wheelSel = i;
  for (const el of document.querySelectorAll('.wseg')) el.classList.toggle('hot', +el.dataset.ws === i);
  $('wheelName').textContent = WEAP[i === 0 ? 'faust' : INV.slots[i - 1].k].name;
}
function wheelPoint(dx, dy) { // Richtung → Segment (0 oben, 1 rechts, 2 unten, 3 links)
  if (Math.hypot(dx, dy) < 18) return;
  const a = Math.atan2(dx, -dy), i = ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4; wheelHot(i);
}
function closeWheel(apply = true) { if (!W.wheel) return; W.wheel = false; $('wheel').classList.remove('on'); if (apply && W.wheelSel !== INV.sel) selectSlot(W.wheelSel); }
$('wheel').addEventListener('pointerdown', e => { const s = e.target.closest('.wseg'); if (s) { wheelHot(+s.dataset.ws); closeWheel(true); e.preventDefault(); } });

// Ziel-Suche (Auto-Aim / Lock-on)
function aimable(p) { return p.state !== 'down' && p.state !== 'getup' && !p.out; }
function findTarget(range, cone, fromH) {
  let best = null, bs = 1e9; const fx = Math.sin(fromH), fz = Math.cos(fromH);
  for (const p of peds) {
    if (!aimable(p)) continue;
    const dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz); if (d > range || d < 0.5) continue;
    const c = (dx * fx + dz * fz) / d; if (c < Math.cos(cone)) continue;
    if (lineBlocked(player.x, player.z, p.x, p.z, 2)) continue;
    const threat = p.hostile || (p.cop && G.wanted > 0) ? 0.45 : 1;
    const sc = (d / range + (1 - c) * 2.2) * threat; if (sc < bs) { bs = sc; best = p; }
  }
  return best;
}
function toggleLock() {
  if (!isGun(curW())) return;
  if (W.lock) { W.lock = null; return; }
  W.lock = findTarget(WEAP[curW()].range * 0.8, 1.25, cam.yaw) || findTarget(30, Math.PI, player.h);
  if (W.lock) { AU.sfx.click(); W.aimT = 1; } else help('Kein Ziel in Reichweite.', 1.6);
}
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _re = new THREE.Vector3(), _cd = new THREE.Vector3();
// Strahl gegen senkrechten Zylinder (Figur/Auto) → Abstand oder -1
function rayCyl(o, d, cx, by, cz, r, hgt) {
  const a = d.x * d.x + d.z * d.z; if (a < 1e-6) return -1;
  const fx = o.x - cx, fz = o.z - cz, b = 2 * (fx * d.x + fz * d.z), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc); let t = (-b - sq) / (2 * a); const t2 = (-b + sq) / (2 * a);
  if (t2 < 0) return -1; if (t < 0) t = 0;
  for (const tt of [t, (t + t2) / 2, t2]) { const y = o.y + d.y * tt; if (y >= by && y <= by + hgt) return tt; }
  return -1;
}
function rayWorld(o, d, maxT) {
  for (let t = 0.4; t < maxT; t += 0.45) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < surfaceY(x, z)) return t;
    for (const c of queryColliders(x, z, 0.05)) if (y < c.h && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return t;
  }
  return 1e9;
}
// Ein Schuss (Spieler oder NPC). shooter = 'player' | ped
function traceShot(o, d, range, w, shooter) {
  let best = range, hitP = null, hitV = null, hitPlayer = false, solid = false;
  for (const p of peds) {
    if (p === shooter || p.state === 'down' || p.out) continue;
    if (Math.abs(p.x - o.x) > range + 2 || Math.abs(p.z - o.z) > range + 2) continue;
    const t = rayCyl(o, d, p.x, p.y, p.z, 0.3, 1.8); if (t >= 0 && t < best) { best = t; hitP = p; }
  }
  if (shooter !== 'player' && !G.car) { const t = rayCyl(o, d, player.x, player.y, player.z, 0.34, 1.8); if (t >= 0 && t < best) { best = t; hitP = null; hitPlayer = true; } }
  for (const v of vehicles) {
    if ((shooter === 'player' && v === G.car) || v.sinking) continue;
    if (Math.abs(v.x - o.x) > range + 4 || Math.abs(v.z - o.z) > range + 4) continue;
    for (const [cx, cz] of carCircles(v)) { const t = rayCyl(o, d, cx, v.y, cz, v.T.wid / 2, v.T.h); if (t >= 0 && t < best) { best = t; hitV = v; hitP = null; hitPlayer = v === G.car; } }
  }
  const tw = rayWorld(o, d, best); if (tw < best) { best = tw; hitP = null; hitV = null; hitPlayer = false; solid = true; }
  const end = _re.copy(o).addScaledVector(d, best);
  tracer(o, end, shooter === 'player');
  const dist = Math.hypot(end.x - player.x, end.z - player.z);
  if (hitP) damagePed(hitP, w.dmg, end.clone(), d.clone(), shooter, false);
  else if (hitPlayer && !hitV) { playerShot(w.npcDmg || 6, end, d); }
  else if (hitV) { damageVehicle(hitV, w.carDmg || 15, end.clone(), shooter); if (hitV === G.car && shooter !== 'player') hurt((w.npcDmg || 6) * 0.25); }
  else if (solid || best < range) { sparks(end, 6, 1); dust(end, 3); if (R() < 0.3) AU.sfx.ricochet(dist); }
}
function playerShot(dmg, at, d) {
  hurt(dmg); player.hitT = 0.3; shake(0.25);
  bloodSpray(at, d, 8, true);
}
function fireWeapon() {
  const k = curW(), w = WEAP[k], slot = curSlot();
  if (!slot || slot.ammo <= 0) { AU.sfx.empty(); help('Keine Munition! Nachschub gibt’s im AMMU-NETZ am Strand.', 2.5); W.cd = 0.4; return; }
  slot.ammo--; W.cd = w.rate; W.recoil = 1; W.aimT = Math.max(W.aimT, 1.4); W.lastShot = G.time;
  const P = player, tgt = W.aimPt;
  P.h = Math.atan2(tgt.x - P.x, tgt.z - P.z);
  // Mündung: echte Waffenposition, wenn bereits im Anschlag; sonst geschätzt
  const fx = Math.sin(P.h), fz = Math.cos(P.h);
  if (W.aimT > 0 && W.aimedFrames > 2 && player.ch.human) muzzleWorld(player.ch, _ro);
  else _ro.set(P.x + fx * 0.75 - fz * 0.18, P.y + 1.42, P.z + fz * 0.75 + fx * 0.18);
  const o = _ro.clone();
  for (let k2 = 0; k2 < w.pellets; k2++) {
    _rd.subVectors(tgt, o).normalize();
    const sp = w.spread * (Math.hypot(P.vx, P.vz) > 1 ? 1.6 : 1);
    _rd.x += (R() - 0.5) * 2 * sp; _rd.y += (R() - 0.5) * 2 * sp * 0.7; _rd.z += (R() - 0.5) * 2 * sp; _rd.normalize();
    traceShot(o, _rd.clone(), w.range, w, 'player');
  }
  muzzleFlash(o, k === 'schrotflinte' ? 1.5 : k === 'uzi' ? 0.8 : 1);
  AU.sfx.shot(k, 0); shake(k === 'schrotflinte' ? 0.35 : k === 'uzi' ? 0.08 : 0.14);
  // Panik & Fahndung
  for (const p of peds) if (!p.hostile && !p.cop && p.state !== 'down' && !p.out && Math.hypot(p.x - P.x, p.z - P.z) < 40) { p.state = 'flee'; p.flee = rand(7, 12); p.sit = null; p.yOff = 0; }
  if (G.time - W.lastCrime > 5 && (policeNear(P.x, P.z, 110) || copPedNear(P.x, P.z, 60) || G.wanted === 0)) { W.lastCrime = G.time; crime(1, 'Schüsse in der Öffentlichkeit'); }
  if (slot.ammo === 0) setTimeout(() => help('Magazin leer! Munition im AMMU-NETZ kaufen.', 2.5), 300);
  updateWeaponHud();
}
function copPedNear(x, z, r) { return peds.some(p => p.cop && !p.out && p.state !== 'down' && Math.hypot(p.x - x, p.z - z) < r); }
// Treffer an Fußgängern
function damagePed(p, dmg, at, dir, shooter, melee) {
  p.hp -= dmg; p.hitT = 0.3;
  if (BLOOD) bloodSpray(at, dir, melee ? 5 : 12); else dust(at, 4);
  AU.sfx.thud(Math.hypot(p.x - player.x, p.z - player.z));
  const byPlayer = shooter === 'player';
  if (p.hp <= 0) {
    downPed(p, dir, !melee);
    if (byPlayer) {
      if (p.kind === 'ranger') {
        G.stats.rangers++; G.mstate.rangers = (G.mstate.rangers || 0) + 1;
        dropPickup('clipboard', p.x + dir.z * 0.9, p.z - dir.x * 0.9, 2 + Math.floor(R() * 3));
        if (p.weapon && isGun(p.weapon)) dropPickup('w:' + p.weapon, p.x - dir.z * 0.9, p.z + dir.x * 0.9, WEAP[p.weapon].start / 2 | 0, 90);
        else dropPickup('cash', p.x - dir.z * 0.9, p.z + dir.x * 0.9, Math.round(rand(20, 80)) * 100);
        popup(p, 'D2D-LER AUSGESCHALTET!', 'warn');
      } else if (p.cop) { crime(2, 'Polizist niedergestreckt', true); if (R() < 0.6) dropPickup('w:' + (p.weapon || 'pistole'), p.x - dir.z, p.z + dir.x, 12, 90); }
      else { if (R() < 0.5) dropPickup('cash', p.x + dir.x, p.z + dir.z, Math.round(rand(5, 35)) * 100); if (G.time - W.lastCrime > 3) { W.lastCrime = G.time; crime(1, melee ? 'Körperverletzung' : 'Schusswaffengebrauch'); } }
    }
  } else if (byPlayer) {
    if (p.cop && G.wanted < 3) crime(2, 'Angriff auf Polizei', true);
    if (p.kind === 'ranger' && !p.hostile && R() < 0.7) rangerAggro(p, false);
    else if (!p.hostile && !p.cop) { p.state = 'flee'; p.flee = 8; p.sit = null; p.yOff = 0; label(p, pick(R, ['Aua!', 'Hilfe!', 'Nicht schießen!', 'Spinnst du?!']), 1.2, 'bubble'); }
  }
}
function downPed(p, dir, shot) {
  knockDown(p, p.x - dir.x, p.z - dir.z, shot ? 2.2 : 5);
  p.sit = null; p.yOff = 0; p.aimT = 0;
  if (shot) { p.out = true; if (p.stars) p.stars.visible = false; if (BLOOD) setTimeout(() => { if (p.out) bloodPool(p.x - Math.sin(p.h) * 0.9, p.z - Math.cos(p.h) * 0.9, 1.15); }, 700); }
  if (p.hostile) { p.hostile = false; }
}
// Treffer an Autos: Funken, Rauch, Feuer, Explosion
function damageVehicle(v, dmg, at, shooter) {
  if (v.exploded) { sparks(at, 4, 1); return; }
  v.hp -= dmg * (v.police ? 0.8 : 1); sparks(at, 8, 1.2); AU.sfx.metal(Math.hypot(at.x - player.x, at.z - player.z));
  if (shooter === 'player') {
    if (v.ai && v.driver === 'ai') { v.ai.speed = Math.min(v.T.maxV * 0.75, 26); v.ai.panicT = 8; }
    if (v.police && G.wanted < 2) crime(2, 'Schüsse auf Polizeiauto', true);
  }
  if (v.hp <= 0 && !v.burnT && !v.exploded) {
    v.hp = 0; v.dead = true; v.burnT = rand(3.5, 5.5);
    if (v === G.car) help('Dein Auto brennt! Sofort aussteigen!', 3);
    else if (v.driver === 'ai' || v.driver === 'cop') bailOut(v);
  }
}
function bailOut(v) {
  const lx = Math.cos(v.h), lz = -Math.sin(v.h);
  const p = spawnPed(v.police ? 'cop' : 'civ', v.x + lx * (v.T.wid / 2 + 0.8), v.z + lz * (v.T.wid / 2 + 0.8), null);
  p.beach = false; p.ring = null; p.state = 'flee'; p.flee = 10; p.temp = 30; p.cop = v.police && false;
  label(p, pick(R, ['Es brennt!', 'Weg hier!', 'Mein Auto!']), 1.6, 'bubble');
  v.ai = null; v.driver = 'none'; setDriver(v.m, 'none'); v.siren = false;
}
let BURNT = null;
function explode(v) {
  v.exploded = true; v.burnT = 0; v.smolderT = 25; v.dead = true; v.hp = 0;
  const at = new THREE.Vector3(v.x, v.y + 1, v.z), dist = Math.hypot(v.x - player.x, v.z - player.z);
  AU.sfx.explosion(dist); shake(clamp(1.4 - dist / 40, 0.15, 1.4));
  fireball(at); sparks(at, 40, 4); dust(at, 14); muzzleFlash(new THREE.Vector3(at.x, at.y + 1.4, at.z), 9);
  flashLight(at, 45, 0.5, 0xffa040);
  if (!BURNT) BURNT = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.95, metalness: 0.2 });
  v.m.paintMesh.material = BURNT; if (v.m.body) v.m.body.traverse(o => { if (o.isMesh && o.material && o.material.userData?.paint) o.material = BURNT; });
  v.vx += (R() - 0.5) * 2; v.vz += (R() - 0.5) * 2;
  if (v === G.car) { hurt(200); }
  // Umgebung
  for (const p of peds) { const d = Math.hypot(p.x - v.x, p.z - v.z); if (d < 7 && p.state !== 'down') { p.hp = 0; downPed(p, new THREE.Vector3(p.x - v.x, 0, p.z - v.z).normalize(), d < 4); } else if (d < 40 && !p.hostile) { p.state = 'flee'; p.flee = 10; } }
  if (!G.car && dist < 7) { hurt(70 * (1 - dist / 7) + 10); player.downT = 2; player.fall = 0; player.vx = (player.x - v.x) / (dist || 1) * 6; player.vz = (player.z - v.z) / (dist || 1) * 6; }
  for (const o of vehicles) if (o !== v && !o.exploded) { const d = Math.hypot(o.x - v.x, o.z - v.z); if (d < 7) { o.hp -= 500 * (1 - d / 7); o.vx += (o.x - v.x) / (d || 1) * 4; o.vz += (o.z - v.z) / (d || 1) * 4; if (o.hp <= 0 && !o.burnT) { o.hp = 0; o.dead = true; o.burnT = rand(1.5, 3); } } }
  if (G.time - W.lastCrime > 2 && dist < 120) { W.lastCrime = G.time; crime(1, 'Auto in die Luft gejagt'); }
}
function restoreVehicle(v) {
  if (!v.exploded && !v.burnT) return;
  v.exploded = false; v.burnT = 0; v.smolderT = 0; v.m.paintMesh.material = paintMat(v.m.color);
  if (v.m.body) v.m.body.traverse(o => { if (o.isMesh && o.material === BURNT && o.userData.paintMat) o.material = o.userData.paintMat; });
}
const _engV = new THREE.Vector3();
function stepCarFx(dt) {
  for (const v of vehicles) {
    const d = Math.hypot(v.x - player.x, v.z - player.z);
    if (v.burnT > 0) { v.burnT -= dt; if (v.burnT <= 0) { explode(v); continue; } }
    if (d > 90) continue;
    const r = v.hp / v.T.hp, eng = _engV.set(v.x + Math.sin(v.h) * v.T.len * 0.32, v.y + v.T.h * 0.8, v.z + Math.cos(v.h) * v.T.len * 0.32);
    v.fxT = (v.fxT || 0) - dt;
    if (v.fxT > 0) continue;
    if (v.burnT > 0 || (v.exploded && v.smolderT > 0)) { v.fxT = 0.05; if (v.burnT > 0 || v.smolderT > 18) fire(eng, v.exploded ? 1.4 : 1); smoke(eng, v.exploded ? 1.3 : 1, 0.12); if (v.exploded) v.smolderT -= 0.05; }
    else if (r < 0.2) { v.fxT = 0.07; smoke(eng, 1, 0.16); }
    else if (r < 0.45) { v.fxT = 0.14; smoke(eng, 0.7, 0.55); }
  }
}
// ---------------------------------------------------------------- Partikel, Leuchtspuren, Mündungsfeuer, Blut
const PART_N = 900;
function makeParticles(blending) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(PART_N * 3), col = new Float32Array(PART_N * 4), size = new Float32Array(PART_N);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('pcol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('psize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 400 } }, transparent: true, depthWrite: false, blending,
    vertexShader: 'attribute vec4 pcol; attribute float psize; uniform float scale; varying vec4 vC; void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(psize * scale / max(0.1, -mv.z), 1.0, 256.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c)*4.0; if (d > 1.0) discard; float a = vC.a * (1.0 - d) * (1.0 - d); gl_FragColor = vec4(vC.rgb, a); }',
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  return { pts, geo, pos, col, size, list: [] };
}
const PADD = makeParticles(THREE.AdditiveBlending), PNORM = makeParticles(THREE.NormalBlending);
function emit(sys, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0) {
  if (sys.list.length >= PART_N) sys.list.shift();
  sys.list.push({ x, y, z, vx, vy, vz, t: 0, life, s0, s1, r, g, b, a, grav, drag });
}
function stepParticles(dt) {
  const scale = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];
  for (const sys of [PADD, PNORM]) {
    sys.pts.material.uniforms.scale.value = scale;
    let n = 0; const L = sys.list;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.t += dt; if (p.t >= p.life) continue;
      p.vy -= p.grav * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.grav > 0 && p.y < 0.03) { p.y = 0.03; p.vx *= 0.3; p.vz *= 0.3; p.vy = 0; }
      const f = p.t / p.life;
      sys.pos[n * 3] = p.x; sys.pos[n * 3 + 1] = p.y; sys.pos[n * 3 + 2] = p.z;
      sys.col[n * 4] = p.r; sys.col[n * 4 + 1] = p.g; sys.col[n * 4 + 2] = p.b; sys.col[n * 4 + 3] = p.a * (1 - f);
      sys.size[n] = p.s0 + (p.s1 - p.s0) * f; L[n] = p; n++;
    }
    L.length = n;
    sys.geo.setDrawRange(0, n);
    for (const a of ['position', 'pcol', 'psize']) { sys.geo.attributes[a].needsUpdate = true; }
  }
}
function sparks(at, n, power = 1) { for (let k = 0; k < n; k++) emit(PADD, at.x, at.y, at.z, (R() - 0.5) * 6 * power, R() * 4 * power, (R() - 0.5) * 6 * power, rand(0.15, 0.4), 0.06, 0.02, 3.5, 2.2, 0.9, 1, 9, 1); }
function dust(at, n) { for (let k = 0; k < n; k++) emit(PNORM, at.x, at.y, at.z, (R() - 0.5) * 1.5, R() * 1.2, (R() - 0.5) * 1.5, rand(0.4, 0.9), 0.15, 0.6, 0.62, 0.58, 0.52, 0.55, 0, 2); }
function smoke(at, s = 1, thin = 0.3) { const c = 0.12 + thin * 0.5; emit(PNORM, at.x + (R() - 0.5) * 0.4, at.y, at.z + (R() - 0.5) * 0.4, (R() - 0.5) * 0.6, rand(1.2, 2.2), (R() - 0.5) * 0.6, rand(1.6, 2.6), 0.5 * s, 2.4 * s, c, c, c * 1.05, 0.5, -0.2, 0.6); }
function fire(at, s = 1) { emit(PADD, at.x + (R() - 0.5) * 0.7 * s, at.y + R() * 0.2, at.z + (R() - 0.5) * 0.7 * s, (R() - 0.5) * 0.5, rand(1.5, 3), (R() - 0.5) * 0.5, rand(0.35, 0.7), 0.7 * s, 0.25 * s, 3.2, 1.3, 0.35, 0.8, -1, 0.5); }
function fireball(at) {
  for (let k = 0; k < 55; k++) { const a = R() * 6.28, e = R() * 1.4, sp = rand(2, 9), o = rand(0.8, 1.6); emit(PADD, at.x + Math.cos(a) * o, at.y + 0.6 + Math.sin(e) * o, at.z + Math.sin(a) * o, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * 0.8 + 1, Math.sin(a) * Math.cos(e) * sp, rand(0.5, 1.1), 1.3, 2.6, 2.2, rand(0.6, 1.1), 0.12, 0.42, -0.5, 2.5); }
  for (let k = 0; k < 30; k++) emit(PNORM, at.x + (R() - 0.5) * 3, at.y + 1.2 + R() * 1.5, at.z + (R() - 0.5) * 3, (R() - 0.5) * 3, rand(2, 5), (R() - 0.5) * 3, rand(2.5, 4), 1.4, 4.5, 0.09, 0.08, 0.08, 0.75, -0.3, 0.9);
}
function bloodSpray(at, dir, n, onPlayer) {
  if (!BLOOD) { dust(at, 3); return; }
  for (let k = 0; k < n; k++) emit(PNORM, at.x, at.y, at.z, dir.x * rand(0.5, 2.5) + (R() - 0.5) * 1.6, rand(0.2, 2.2), dir.z * rand(0.5, 2.5) + (R() - 0.5) * 1.6, rand(0.4, 0.8), 0.05, 0.035, 0.38, 0.015, 0.02, 0.95, 9.8, 0.4);
  if (!onPlayer && R() < 0.7) bloodPool(at.x + dir.x * rand(0.6, 1.4), at.z + dir.z * rand(0.6, 1.4), rand(0.35, 0.6));
}
// Boden-Decals (verblassen nach ~30 s)
const DECALS = [], DECAL_N = 36;
let decalTex = null;
function makeDecalTex() {
  const texs = [];
  for (let v = 0; v < 3; v++) {
    const c = canvas(128, 128), g = c.getContext('2d'), r = rng(77 + v * 13);
    g.fillStyle = '#5a0408';
    for (let k = 0; k < 9; k++) { const a = r() * 6.28, d = r() * 26, rad = 12 + r() * 22; g.globalAlpha = 0.75 + r() * 0.25; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rad, 0, 7); g.fill(); }
    for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = 34 + r() * 26; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + r() * 5, 0, 7); g.fill(); }
    const t = tex(c); texs.push(t);
  }
  return texs;
}
function bloodPool(x, z, size = 1) {
  if (!BLOOD) return;
  if (!decalTex) decalTex = makeDecalTex();
  let d = DECALS.length < DECAL_N ? null : DECALS.shift();
  if (!d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: decalTex[DECALS.length % 3], transparent: true, depthWrite: false, roughness: 0.25, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.renderOrder = 2; m.receiveShadow = true; scene.add(m); d = { m };
  }
  d.m.visible = true; d.m.position.set(x, surfaceY(x, z) + 0.03, z); d.m.rotation.y = R() * 6.28; d.t = 0; d.size = size; d.m.scale.setScalar(0.1); d.m.material.opacity = 0.92;
  DECALS.push(d);
}
function stepDecals(dt) {
  for (const d of DECALS) {
    if (!d.m.visible) continue; d.t += dt;
    d.m.scale.setScalar(d.size * Math.min(1, 0.2 + d.t / 1.6));
    if (d.t > 22) d.m.material.opacity = 0.92 * Math.max(0, 1 - (d.t - 22) / 10);
    if (d.t > 32 || !BLOOD) d.m.visible = false;
  }
}
// Leuchtspuren
const TRACERS = [];
const tracerGeo = new THREE.BoxGeometry(0.025, 0.025, 1).translate(0, 0, -0.5);
const tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
function tracer(o, e, mine) {
  let t = TRACERS.find(t => !t.m.visible);
  if (!t) { if (TRACERS.length > 40) return; t = { m: new THREE.Mesh(tracerGeo, tracerMat) }; t.m.frustumCulled = false; scene.add(t.m); TRACERS.push(t); }
  t.o = o.clone(); t.e = e.clone(); t.L = o.distanceTo(e); t.t = 0; t.m.visible = true;
  t.m.position.copy(o); t.m.lookAt(e);
}
function stepTracers(dt) {
  for (const t of TRACERS) {
    if (!t.m.visible) continue; t.t += dt;
    const run = t.t * 420, head = Math.min(t.L, run), tail = Math.min(t.L, Math.max(0, run - 5));
    if (tail >= t.L - 0.01) { t.m.visible = false; continue; }
    t.m.position.copy(t.o).lerp(t.e, head / t.L); t.m.scale.set(1, 1, Math.max(0.05, head - tail));
  }
}
// Mündungsfeuer + kurzes Licht
const flashMat = new THREE.SpriteMaterial({ map: radialTex('rgba(255,250,220,1)', 'rgba(255,170,60,.55)'), color: new THREE.Color(4, 2.6, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const FLASHES = [];
let FLASH_LIGHT = null;
ensureFlashLight();
function ensureFlashLight() { if (!FLASH_LIGHT && Q.flashLight) { FLASH_LIGHT = new THREE.PointLight(0xffb060, 0, 14, 2); scene.add(FLASH_LIGHT); } }
function muzzleFlash(at, s = 1) {
  let f = FLASHES.find(f => !f.visible);
  if (!f) { f = new THREE.Sprite(flashMat); scene.add(f); FLASHES.push(f); }
  f.visible = true; f.position.copy(at); f.scale.setScalar((0.35 + R() * 0.2) * s); f.material.rotation = R() * 6; f.userData.t = 0.05;
  flashLight(at, 25 * s, 0.06, 0xffb060);
  emit(PADD, at.x, at.y, at.z, 0, 0.3, 0, 0.08, 0.25 * s, 0.05, 4, 2.5, 1, 1);
}
function flashLight(at, I, dur, col) { ensureFlashLight(); if (!FLASH_LIGHT) return; FLASH_LIGHT.position.copy(at); FLASH_LIGHT.color.set(col); FLASH_LIGHT.intensity = I; FLASH_LIGHT.userData = { I, t: dur, d: dur }; FLASH_LIGHT.distance = I > 50 ? 40 : 14; }
function stepFlashes(dt) {
  for (const f of FLASHES) if (f.visible) { f.userData.t -= dt; if (f.userData.t <= 0) f.visible = false; }
  if (FLASH_LIGHT && FLASH_LIGHT.intensity > 0) { const u = FLASH_LIGHT.userData; u.t -= dt; FLASH_LIGHT.intensity = u.t > 0 ? u.I * (u.t / u.d) : 0; }
}
// ---------------------------------------------------------------- Angriff des Spielers (Fäuste, Schlagstock, Schusswaffen)
function updateAim(dt) {
  const k = curW(), gun = isGun(k);
  if (W.lock && (!aimable(W.lock) || Math.hypot(W.lock.x - player.x, W.lock.z - player.z) > 55 || !peds.includes(W.lock))) W.lock = null;
  const aimingDesk = !isTouch && W.aimHeld;
  if (!gun || G.car || player.downT > 0) { W.aimT = 0; W.aimedFrames = 0; return; }
  if (W.lock) {
    const p = W.lock; W.aimPt.set(p.x, p.y + 1.25, p.z); W.aimT = Math.max(W.aimT, 0.3);
    // Kamera folgt dem Ziel sanft
    const want = Math.atan2(p.x - player.x, p.z - player.z); if (G.time - inp.lastCam > 0.6) cam.yaw += angDiff(cam.yaw, want) * Math.min(1, dt * 3);
  } else if (!isTouch) {
    // Fadenkreuz in Bildmitte: Strahl von der Kamera
    camera.getWorldDirection(_cd); const o = camera.position;
    let best = 90; const d = _cd;
    for (const p of peds) { if (!aimable(p)) continue; const t = rayCyl(o, d, p.x, p.y, p.z, 0.45, 1.85); if (t > 0 && t < best) best = t; }
    for (const v of vehicles) { if (v === G.car) continue; for (const [cx, cz] of carCircles(v)) { const t = rayCyl(o, d, cx, v.y, cz, v.T.wid / 2, v.T.h); if (t > 0 && t < best) best = t; } }
    best = Math.min(best, rayWorld(o, d, best));
    W.aimPt.copy(o).addScaledVector(d, Math.max(best, cam.dist + 1.5));
    if (aimingDesk) W.aimT = Math.max(W.aimT, 0.3);
  } else {
    // Touch ohne Lock: Auto-Aim auf das beste Ziel im Blickfeld
    const t = findTarget(WEAP[k].range * 0.7, 0.75, player.h) || findTarget(WEAP[k].range * 0.7, 0.75, cam.yaw);
    if (t) W.aimPt.set(t.x, t.y + 1.25, t.z); else W.aimPt.set(player.x + Math.sin(player.h) * 20, player.y + 1.3, player.z + Math.cos(player.h) * 20);
  }
  W.aimT = Math.max(0, W.aimT - dt);
  W.aimedFrames = W.aimT > 0 ? (W.aimedFrames || 0) + 1 : 0;
  if (W.aimT > 0) { const want = Math.atan2(W.aimPt.x - player.x, W.aimPt.z - player.z); player.h += angDiff(player.h, want) * Math.min(1, dt * 16); }
}
function playerAttack(dt) {
  W.cd = Math.max(0, W.cd - dt); W.recoil = Math.max(0, W.recoil - dt * 7); W.swingT = Math.max(0, W.swingT - dt);
  const k = curW(), P = player;
  updateAim(dt);
  if (G.car || P.downT > 0 || G.deadT > 0 || W.wheel) { inp.punch = false; return; }
  const want = inp.punch || W.fireHeld;
  if (isGun(k)) {
    if (want && W.cd <= 0) { if (WEAP[k].auto || inp.punch || W.cd <= 0) fireWeapon(); }
  } else if (want && P.punchCD <= 0) {
    if (k === 'schlagstock') { W.swingT = 0.4; P.punchCD = 0.55; doPunch(2, 2.6, true); }
    else { P.punchT = 0.32; P.punchCD = 0.42; doPunch(1, 2.3, false); }
  }
  inp.punch = false;
}
// ---------------------------------------------------------------- AMMU-NETZ
const AMMU = world.pois.ammu;
const ammuMarker = AMMU ? (() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 40, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.0, 0.15), transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); m.position.set(AMMU.x, 0.2, AMMU.z); scene.add(m); return m; })() : null;
let ammuCD = 0;
function stepAmmu(dt) {
  if (!AMMU) return; ammuCD = Math.max(0, ammuCD - dt);
  ammuMarker.scale.y = 1 + Math.sin(G.time * 3) * 0.3;
  const d = Math.hypot(player.x - AMMU.x, player.z - AMMU.z);
  if (d > 2.6) ammuCD = Math.min(ammuCD, 0.5);
  if (!G.car && d < 1.6 && ammuCD <= 0 && G.deadT <= 0) {
    if (G.wanted > 0) { help('AMMU-NETZ: „Mit Fahndung bedienen wir dich nicht. Komm ohne Sterne wieder.“', 3); ammuCD = 6; return; }
    openAmmu();
  }
}
function openAmmu() { G.paused = true; ammuCD = 1e9; AU.sfx.click(); renderAmmu(); $('ammu').classList.add('on'); }
function closeAmmu() { $('ammu').classList.remove('on'); G.paused = false; last = performance.now(); ammuCD = 1e9; }
function renderAmmu() {
  $('ammuList').innerHTML = WKEYS.map(k => {
    const w = WEAP[k], own = INV.slots.find(s => s && s.k === k);
    const bw = own ? '<button class="abtn" disabled>Im Inventar</button>' : `<button class="abtn" data-buy="${k}" ${G.money < w.price ? 'disabled' : ''}>Kaufen · ${fmtEUR(w.price)}</button>`;
    const ba = isGun(k) ? `<button class="abtn" data-ammo="${k}" ${!own || G.money < w.ammoPrice ? 'disabled' : ''}>+${w.ammoN} Schuss · ${fmtEUR(w.ammoPrice)}</button>` : '';
    return `<li><img src="${weaponIcon(k)}" alt=""><div><b>${w.name}</b><span>${WDESC[k]}</span>${own && isGun(k) ? `<em>${own.ammo} Schuss</em>` : ''}</div><p>${bw}${ba}</p></li>`;
  }).join('');
  $('ammuMoney').textContent = fmtEURc(G.money);
  $('ammuFull').textContent = INV.slots.every(Boolean) ? 'Inventar voll (3 Waffen + Fäuste): Ein Kauf tauscht die gehaltene Waffe aus.' : '';
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-buy],[data-ammo],#ammuClose,#btnBlood'); if (!t) return;
  if (t.id === 'ammuClose') { closeAmmu(); return; }
  if (t.id === 'btnBlood') { BLOOD = !BLOOD; persistInv(); t.textContent = BLOOD ? '🩸 Blut: AN' : '🩸 Blut: AUS'; AU.sfx.click(); return; }
  if (t.dataset.buy) { const k = t.dataset.buy, w = WEAP[k]; if (G.money < w.price) return; G.money -= w.price; moneyPop(-w.price); giveWeapon(k, w.start || 1); AU.sfx.cash(); renderAmmu(); persist(); }
  if (t.dataset.ammo) { const k = t.dataset.ammo, w = WEAP[k], s = INV.slots.find(s => s && s.k === k); if (!s || G.money < w.ammoPrice) return; G.money -= w.ammoPrice; moneyPop(-w.ammoPrice); s.ammo += w.ammoN; AU.sfx.reload(); updateWeaponHud(); renderAmmu(); persistInv(); }
});
// Waffen in der Welt (respawnen nach dem Aufheben)
const WSPAWN = [];
{
  const sp = world.contractSpots.slice().sort((a, b) => Math.hypot(a[0] - SPAWN.x, a[1] - SPAWN.z) - Math.hypot(b[0] - SPAWN.x, b[1] - SPAWN.z));
  [['schlagstock', 2], ['pistole', 6], ['uzi', 24], ['schrotflinte', 48], ['pistole', 75], ['uzi', 110], ['schrotflinte', 140]].forEach(([k, i]) => { const s = sp[Math.min(i, sp.length - 1)]; WSPAWN.push({ k, x: s[0] - 1.4, z: s[1] + 1.4, p: null, t: 0, first: true }); });
}
function stepWeaponSpawns(dt) {
  for (const w of WSPAWN) {
    if (w.p && pickups.includes(w.p)) continue;
    w.p = null; w.t -= dt;
    if (w.t <= 0 && (w.first || Math.hypot(w.x - player.x, w.z - player.z) > 40)) { w.first = false; w.p = dropPickup('w:' + w.k, w.x, w.z, WEAP[w.k].start || 1, 1e9); w.t = 90; }
  }
}

// ---------------------------------------------------------------- D2D-ler-Angriffe & Polizei zu Fuß
const RANGER_SHOUTS = ['Hey, Magenta! Das ist unser Revier!', 'Verschwinde aus unserem Gebiet, Telekom!', 'Hier unterschreibt keiner bei dir!', 'D2D-ler, Angriff! Der Magenta-Typ wildert in unserem Revier!', 'Dein Glasfaser-Gelaber nervt! Jetzt gibt’s was auf die Ohren!', 'Das ist unsere Straße, Freundchen!', 'Schnapp ihn dir! Der klaut unsere Kunden!'];
let rangerCD = 20, rangerTick = 0;
function rangerAggro(p, shout = true) {
  if (p.out || p.state === 'down') return;
  p.hostile = true; p.state = 'attack'; p.atkCD = rand(0.4, 0.9); p.sit = null; p.yOff = 0;
  const m = G.mission || 0;
  if (!p.weapon) { const r = R(); p.weapon = m >= 4 && r < 0.22 ? 'pistole' : m >= 2 && r < 0.45 ? 'schlagstock' : null; if (p.weapon && p.ch.human) setHumanWeapon(p.ch, p.weapon); }
  if (shout) { const line = pick(R, RANGER_SHOUTS); label(p, line, 2.8, 'bubble shout'); if (!G.car) AU.shout(line); }
}
function stepRangerz(dt) {
  rangerCD -= dt; rangerTick -= dt;
  if (rangerCD > 0 || rangerTick > 0 || G.car || G.deadT > 0) return;
  rangerTick = 1;
  const near = peds.filter(p => p.kind === 'ranger' && !p.hostile && !p.out && p.state !== 'down' && p.state !== 'getup' && Math.hypot(p.x - player.x, p.z - player.z) < 15);
  if (!near.length || R() > 0.4) return;
  near.sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
  const lead = near[0], group = [lead];
  for (const p of peds) if (group.length < 3 && p !== lead && p.kind === 'ranger' && !p.hostile && !p.out && p.state !== 'down' && Math.hypot(p.x - lead.x, p.z - lead.z) < 25) group.push(p);
  // Verstärkung aus dem Hauseingang (Gruppe von 2–3)
  const want = R() < 0.35 ? 1 : R() < 0.6 ? 2 : 3;
  while (group.length < want) {
    const a = R() * 6.28, x = lead.x + Math.cos(a) * 2.5, z = lead.z + Math.sin(a) * 2.5;
    if (circleHit(x, z, 0.4, _hit)) { group.push(spawnPed('ranger', lead.x + 0.8, lead.z + 0.8, null)); } else group.push(spawnPed('ranger', x, z, null));
    const np = group[group.length - 1]; np.temp = 60; np.beach = false;
  }
  group.forEach((p, i) => rangerAggro(p, i === 0));
  rangerCD = rand(45, 80) - Math.min(20, (G.mission || 0) * 3);
  help(group.length > 1 ? `${group.length} D2D-ler greifen dich an! Wehr dich – oder renn!` : 'Ein D2D-ler greift dich an! Wehr dich – oder renn!', 3);
}
// Feindliche Figur greift den Spieler an (D2D-ler & Polizei)
function stepHostile(p, dt) {
  const dx = player.x - p.x, dz = player.z - p.z, d = Math.hypot(dx, dz);
  const giveUp = p.cop ? G.wanted === 0 : (G.car || d > 40 || G.deadT > 0);
  if (giveUp) {
    p.hostile = false; p.state = p.cop ? 'flee' : p.ring ? 'walk' : 'idle'; p.flee = 4; p.aimT = 0;
    if (p.kind === 'ranger' && p.ch.human) { setHumanWeapon(p.ch, null); p.weapon = null; }
    if (p.ring) p.u = ringNearest(p.ring, p.x, p.z);
    if (p.cop) p.temp = Math.min(p.temp ?? 20, 6);
    return [p.x + Math.sin(p.h), p.z + Math.cos(p.h), 0];
  }
  p.atkCD -= dt; p.look = _lookV.set(player.x, player.y + 1.6, player.z);
  const armed = p.weapon && isGun(p.weapon) && (p.cop ? G.wanted >= 3 : true);
  if (armed) {
    const los = !lineBlocked(p.x, p.z, player.x, player.z, 2) && d < 38;
    let tx = player.x, tz = player.z, spd = 4.3;
    if (los && d < 16) { spd = d < 7 ? 0 : 1.4; tx = p.x + dx; tz = p.z + dz; p.h += angDiff(p.h, Math.atan2(dx, dz)) * Math.min(1, dt * 10); }
    if (los && d < 30) {
      p.aimT = 0.4; (p.aimAt || (p.aimAt = new THREE.Vector3())).set(player.x, player.y + 1.2, player.z);
      if (p.atkCD <= 0) npcFire(p, d);
    }
    return [tx, tz, spd];
  }
  // Nahkampf
  if (d > 1.15) return [player.x, player.z, p.cop ? 4.6 : 4.4];
  p.h = Math.atan2(dx, dz);
  if (p.cop) { // Festnahme
    G.copGrab = true; return [p.x, p.z, 0];
  }
  if (p.atkCD <= 0 && player.downT <= 0) {
    const bat = p.weapon === 'schlagstock';
    p.atkCD = bat ? rand(1.3, 1.9) : rand(1.1, 1.7); if (bat) p.swingT = 0.45; else p.punchT = 0.35;
    AU.sfx.whoosh();
    setTimeout(() => {
      if (p.state === 'down' || p.out || Math.hypot(player.x - p.x, player.z - p.z) > 1.8 || G.car) return;
      hurt(bat ? 9 : 4); player.hitT = 0.3; AU.sfx.punch(); shake(bat ? 0.35 : 0.2);
      player.x += Math.sin(p.h) * 0.25; player.z += Math.cos(p.h) * 0.25;
      if (bat && BLOOD && R() < 0.4) bloodSpray(new THREE.Vector3(player.x, player.y + 1.5, player.z), new THREE.Vector3(Math.sin(p.h), 0, Math.cos(p.h)), 4, true);
    }, bat ? 220 : 160);
  }
  return [p.x, p.z, 0];
}
const _lookV = new THREE.Vector3(), _npcO = new THREE.Vector3(), _npcD = new THREE.Vector3();
function npcFire(p, d) {
  const swat = p.kind === 'swat', w = WEAP[p.weapon] || WEAP.pistole;
  p.atkCD = swat ? (p.burst = (p.burst || 0) + 1) % 4 ? 0.12 : rand(0.9, 1.4) : rand(0.8, 1.5);
  p.recoil = 1;
  if (p.ch.human && p.ch.weapon) muzzleWorld(p.ch, _npcO); else _npcO.set(p.x + Math.sin(p.h) * 0.6, p.y + 1.4, p.z + Math.cos(p.h) * 0.6);
  // Trefferchance sinkt mit Entfernung und Tempo des Spielers
  const pv = G.car ? Math.hypot(G.car.vx, G.car.vz) : Math.hypot(player.vx, player.vy || 0, player.vz);
  const hitC = clamp(0.62 - d * 0.018 - pv * 0.02 + G.wanted * 0.03, 0.1, 0.7);
  const tgt = new THREE.Vector3(player.x, player.y + (G.car ? 1.0 : 1.3), player.z);
  if (R() > hitC) { tgt.x += (R() - 0.5) * 3; tgt.y += (R() - 0.3) * 1.5; tgt.z += (R() - 0.5) * 3; }
  _npcD.subVectors(tgt, _npcO).normalize();
  traceShot(_npcO.clone(), _npcD.clone(), 60, { dmg: 1.2, carDmg: 12, npcDmg: p.cop ? (swat ? 5 : 7) : 5 }, p);
  muzzleFlash(_npcO, swat ? 0.8 : 1);
  AU.sfx.shot(swat ? 'uzi' : 'pistole', d);
}
// Polizisten steigen aus, wenn der Wagen in der Nähe hält
function deployCops(c) {
  if (c.deployed || copPeds() >= 6) return;
  c.deployed = true;
  const lx = Math.cos(c.h), lz = -Math.sin(c.h);
  for (const s of c.kind === 'swat' ? [1, -1, 1] : [1, -1]) {
    const p = spawnPed(c.kind === 'swat' ? 'swat' : 'cop', c.x + lx * s * (c.T.wid / 2 + 0.7), c.z + lz * s * (c.T.wid / 2 + 0.7), null);
    p.cop = true; p.temp = 1e9; p.beach = false; p.hp = c.kind === 'swat' ? 6 : 4; p.maxHp = p.hp; p.hostile = true; p.state = 'attack'; p.atkCD = rand(0.6, 1.4); p.car = c;
    p.weapon = c.kind === 'swat' ? 'uzi' : 'pistole'; if (p.ch.human) setHumanWeapon(p.ch, p.weapon);
  }
  if (c.ai) c.ai.stunT = 1e9;
  AU.policeRadio(pick(R, ['Einheit vor Ort, steigen aus!', 'Hände hoch! Polizei!', 'Keine Bewegung, Magenta!']));
}
function copPeds() { return peds.filter(p => p.cop && !p.out).length; }
function stepCopDeploy() {
  if (G.wanted === 0) { for (const c of vehicles) if (c.deployed && c.ai && !peds.some(p => p.car === c && !p.out && Math.hypot(p.x - c.x, p.z - c.z) > 3)) { c.deployed = false; c.ai.stunT = 0; } return; }
  for (const c of vehicles) {
    if (!c.police || c.driver !== 'cop' || c.deployed) continue;
    const d = Math.hypot(c.x - player.x, c.z - player.z), sp = Math.hypot(c.vx, c.vz);
    if (d < 24 && sp < 3.5 && (!G.car || G.wanted >= 3)) deployCops(c);
  }
}
// ---------------------------------------------------------------- Belebte Stadt: Bänke, Liegen, Clubs, Shops
const AMB_SPOTS = [];
for (const [x, z, ry] of world.benchSpots) AMB_SPOTS.push({ type: 'bench', x, z, ry, peds: [] });
for (let i = 0; i < world.loungerSpots.length; i += 2) { const [x, z] = world.loungerSpots[i]; AMB_SPOTS.push({ type: 'lounger', x, z, ry: 0, peds: [] }); }
for (const [x, z, ry, ocean] of world.clubSpots) AMB_SPOTS.push({ type: 'club', x, z, ry, ocean, peds: [] });
for (const s of world.shops) if (!s.hq) AMB_SPOTS.push({ type: 'shop', x: s.x, z: s.z, ry: s.ry, peds: [] });
let ambT = 0;
function ambCap() { return Math.round((isMobile ? 34 : 50) * Q.dens); }
function ambCount() { let n = 0; for (const s of AMB_SPOTS) n += s.peds.length; return n; }
function spawnAmb(s) {
  const night = TOD.nightF > 0.5, list = [];
  if (s.type === 'bench') {
    const n = R() < 0.35 ? 2 : 1;
    for (let k = 0; k < n; k++) { const off = n === 2 ? (k ? 0.42 : -0.42) : rand(-0.4, 0.4); list.push({ kind: night ? 'night' : 'civ', x: s.x + Math.cos(s.ry) * off - Math.sin(s.ry) * 0.12, z: s.z - Math.sin(s.ry) * off - Math.cos(s.ry) * 0.12, h: s.ry, state: 'sit', yOff: -0.47 }); }
  } else if (s.type === 'lounger') {
    if (night) return;
    list.push({ kind: 'tourist', x: s.x, z: s.z + 0.95, h: 0, state: 'lie', yOff: 0.42 });
    if (R() < 0.5) list.push({ kind: 'tourist', x: s.x - 2.6, z: s.z + 0.95, h: 0, state: 'lie', yOff: 0.42 });
  } else if (s.type === 'club') {
    const n = night ? 3 + Math.floor(R() * 4) : (R() < 0.5 ? 2 : 0);
    for (let k = 0; k < n; k++) { const a = k / n * 6.28 + R() * 0.5, r = 1.1 + R() * 0.6; list.push({ kind: night ? 'night' : 'civ', x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, h: Math.atan2(-Math.cos(a), -Math.sin(a)), state: night && R() < 0.65 ? 'dance' : 'idle', chat: true }); }
  } else if (s.type === 'shop') {
    const n = 1 + Math.floor(R() * 3);
    const bx = s.x + Math.cos(s.ry) * 3.2, bz = s.z - Math.sin(s.ry) * 3.2;
    for (let k = 0; k < n; k++) { const a = k / n * 6.28, r = 0.8; list.push({ kind: 'civ', x: bx + Math.cos(a) * r, z: bz + Math.sin(a) * r, h: Math.atan2(-Math.cos(a), -Math.sin(a)), state: 'idle', chat: n > 1 }); }
  }
  for (const o of list) {
    const p = spawnPed(o.kind, o.x, o.z, null);
    p.beach = false; p.amb = s; p.state = o.state; p.home = o.state; p.h = o.h; p.yOff = o.yOff || 0; p.chat = o.chat; p.t = R() * 10;
    if (o.state === 'sit') p.sit = 'bench';
    s.peds.push(p);
  }
}
function removePed(p) { scene.remove(p.ch.root); if (p.stars) scene.remove(p.stars); const i = peds.indexOf(p); if (i >= 0) peds.splice(i, 1); if (W.lock === p) W.lock = null; }
function stepAmbient(dt) {
  ambT -= dt; if (ambT > 0) return; ambT = 0.7;
  const px = player.x, pz = player.z, cap = ambCap();
  let n = ambCount();
  for (const s of AMB_SPOTS) {
    const d = Math.hypot(s.x - px, s.z - pz);
    if (s.peds.length) {
      if (d > 150) { for (const p of s.peds) removePed(p); s.peds = []; n = ambCount(); }
      else s.peds = s.peds.filter(p => peds.includes(p));
      continue;
    }
    if (n >= cap || d > 115 || d < 18) continue;
    if (inView(s.x, s.z, 3) && d < 70) continue; // kein Aufploppen im Blickfeld
    s.cool = (s.cool || 0) - 0.7; if (s.cool > 0) continue;
    const prob = s.type === 'club' ? (TOD.nightF > 0.5 ? 0.9 : 0.25) : s.type === 'bench' ? 0.45 : s.type === 'lounger' ? 0.55 : 0.5;
    s.cool = 20;
    if (R() < prob) { spawnAmb(s); n = ambCount(); }
  }
}
// ---------------------------------------------------------------- Ampeln
const TL = new Map();
{
  const heads = [];
  for (const n of NODES) {
    if (n.nb.length < 3 || n.x < -300) continue;
    const tl = { n, off: R() * 20, cycle: 22, state: -1 };
    TL.set(n.id, tl);
    // Ampelkopf je Zufahrt (Fahrtrichtung d): rechts vor der Kreuzung
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!n.nb.some(id => { const m = NODES[id]; return Math.sign(n.x - m.x) === dx && Math.sign(n.z - m.z) === dz; })) continue;
      const rx = -dz, rz = dx, k = RHW + 1.0;
      heads.push({ tl, ax: dx !== 0 ? 0 : 1, x: n.x - dx * k + rx * k, z: n.z - dz * k + rz * k, ry: Math.atan2(-dx, -dz) });
    }
  }
  const poleG = new THREE.CylinderGeometry(0.07, 0.08, 3.4, 8).translate(0, 1.7, 0);
  const boxG = new THREE.BoxGeometry(0.34, 0.95, 0.26).translate(0, 3.3, 0);
  const lampG = new THREE.SphereGeometry(0.095, 10, 8);
  const darkM = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.55, metalness: 0.4 });
  const pole = new THREE.InstancedMesh(poleG, darkM, heads.length), box = new THREE.InstancedMesh(boxG, darkM, heads.length);
  const lamps = new THREE.InstancedMesh(lampG, new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.length * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  heads.forEach((h, i) => {
    m4.compose(v.set(h.x, 0, h.z), q.setFromEuler(e.set(0, h.ry, 0)), one); pole.setMatrixAt(i, m4); box.setMatrixAt(i, m4);
    for (let k = 0; k < 3; k++) { const lx = h.x + Math.sin(h.ry) * 0.14, lz = h.z + Math.cos(h.ry) * 0.14; m4.compose(v.set(lx, 3.62 - k * 0.3, lz), q, one); lamps.setMatrixAt(i * 3 + k, m4); lamps.setColorAt(i * 3 + k, new THREE.Color(0.05, 0.05, 0.05)); }
    h.i = i;
  });
  pole.castShadow = box.castShadow = true;
  scene.add(pole, box, lamps);
  for (const h of heads) (h.tl.heads || (h.tl.heads = [])).push(h);
  TL.lamps = lamps;
}
// Phase je Achse: 0 = grün, 1 = gelb, 2 = rot (inkl. Räumzeit)
function tlPhase(tl, ax) {
  const t = (G.time + tl.off) % tl.cycle, half = tl.cycle / 2, tt = ax === 0 ? t : (t + half) % tl.cycle;
  return tt < half - 3 ? 0 : tt < half - 1 ? 1 : 2;
}
const TLC = [new THREE.Color(0.2, 4, 0.6), new THREE.Color(4, 2.4, 0.1), new THREE.Color(4.5, 0.2, 0.15)], TLOFF = new THREE.Color(0.06, 0.06, 0.06);
function stepTrafficLights() {
  let dirty = false;
  for (const tl of TL.values()) {
    const s = tlPhase(tl, 0) * 3 + tlPhase(tl, 1);
    if (s === tl.state) continue; tl.state = s; dirty = true;
    for (const h of tl.heads) { const ph = tlPhase(tl, h.ax); for (let k = 0; k < 3; k++) TL.lamps.setColorAt(h.i * 3 + k, (k === 0 && ph === 2) || (k === 1 && ph === 1) || (k === 2 && ph === 0) ? TLC[2 - k] : TLOFF); }
  }
  if (dirty) TL.lamps.instanceColor.needsUpdate = true;
}

// Ein-/Aussteigen
function nearestEnterable() {
  let best = null, bd = 1e9;
  for (const v of vehicles) {
    if (v.sinking) continue;
    const d = Math.hypot(v.x - player.x, v.z - player.z);
    if (d < v.T.len / 2 + 2.2 && d < bd) { best = v; bd = d; }
  }
  return best;
}
function enterExit() {
  if (G.deadT > 0) return;
  AU.initAudio();
  if (G.car) {
    const v = G.car, sp = Math.hypot(v.vx, v.vz);
    if (sp > 7) { help('Zum Aussteigen erst langsamer werden.'); return; }
    // links aussteigen (Fahrerseite), sonst rechts
    const lx = Math.cos(v.h), lz = -Math.sin(v.h);
    let ex = v.x + lx * (v.T.wid / 2 + 0.7), ez = v.z + lz * (v.T.wid / 2 + 0.7);
    if (circleHit(ex, ez, 0.4, _hit)) { ex = v.x - lx * (v.T.wid / 2 + 0.7); ez = v.z - lz * (v.T.wid / 2 + 0.7); }
    placePlayer(ex, ez, v.h);
    setDriver(v.m, 'none'); v.driver = 'none'; v.thr = 0; v.hb = true; v.steer = 0;
    G.car = null; G.mode = 'foot'; AU.sfx.door(); AU.radioOn(false); AU.engine(false, 0, 0, 0);
    updateControls(); return;
  }
  if (player.downT > 0) return;
  const v = nearestEnterable(); if (!v) return;
  if (v.driver === 'ai' || v.driver === 'cop') {
    // Fahrer rauszerren
    const lx = Math.cos(v.h), lz = -Math.sin(v.h);
    const p = spawnPed(v.police ? 'cop' : 'civ', v.x + lx * (v.T.wid / 2 + 0.8), v.z + lz * (v.T.wid / 2 + 0.8), null);
    p.beach = false; p.ring = null; p.state = 'flee'; p.flee = 10; p.temp = 30;
    label(p, pick(R, ['Mein Auto!', 'Hey! Das ist meins!', 'Hilfe, Autodieb!', 'Ich ruf die Polizei!']), 2, 'bubble');
    G.stats.stolen++;
    if (v.police) crime(2, 'Polizeiauto gestohlen', true);
    else if (policeNear(v.x, v.z, 70)) crime(1, 'Autodiebstahl');
  } else G.stats.stolen += 0;
  v.ai = null; v.driver = 'player'; setDriver(v.m, 'player');
  G.car = v; G.mode = 'car'; v.hb = false; v.dead = v.hp <= 0;
  player.ch.root.visible = false;
  AU.sfx.door(); AU.setStation(AU.GENRE_STATION[v.T.genre] ?? 0); AU.radioOn(true); showStation(); setTimeout(() => { if (G.car === v) AU.jingle(); }, 900);
  W.lock = null; W.fireHeld = false;
  if (v.kind === 'sport') G.mstate.sport = true;
  updateControls();
  help(`${v.T.name} – ${isTouch ? 'Joystick: Gas/Lenken · ⛔ Handbremse' : 'W/S Gas/Bremse · A/D Lenken · Leertaste Handbremse · R Radio'}`);
}
function onPlayerCarSinks(v) {
  setTimeout(() => {
    if (G.car !== v) return;
    G.car = null; G.mode = 'foot'; AU.radioOn(false); AU.engine(false, 0, 0, 0);
    placePlayer(Math.min(v.x, 310), clamp(v.z, LAND.z0 + 4, LAND.z1 - 4)); if (!onLand(player.x, player.z)) placePlayer(GRID[0] + 4, 4);
    help('Platsch! Das Auto ist abgesoffen.'); updateControls();
  }, 1200);
}

// ---------------------------------------------------------------- Fahndung & Polizei
function policeNear(x, z, r) { return vehicles.some(v => v.police && v.driver === 'cop' && Math.hypot(v.x - x, v.z - z) < r); }
const POLICE_LINES = [
  'Zentrale an alle Einheiten: Verdächtiger im Magenta-Polo. Vorsicht, wirkt sehr überzeugend.',
  'Einheit zwölf an Zentrale: Wir verfolgen einen Telekom-Mitarbeiter. Er hat offenbar Glasfaser dabei.',
  'Zentrale: Alle Einheiten zum Ocean Drive. Täter flüchtet mit gestohlenen Verträgen.',
  'Achtung, Verdächtiger ist schneller als jedes Kupferkabel.',
  'Einheit sieben: Wir brauchen Verstärkung. Der Typ hat Highspeed vor Ort.',
];
function crime(n, what, always = false) {
  const before = G.wanted;
  G.wanted = clamp(Math.max(G.wanted, 1) + (G.wanted > 0 ? n : n - 1), 0, 5);
  if (G.wanted > 5) G.wanted = 5;
  G.lastSeen = G.time; G.evadeT = 0;
  if (G.wanted > before) {
    AU.sfx.star(); flash('star');
    if (G.wanted >= 2 && before < 2) AU.policeRadio(pick(R, POLICE_LINES));
    help(`Fahndungslevel ${'★'.repeat(G.wanted)} – ${what}`);
    G.mstate.hadWanted = Math.max(G.mstate.hadWanted || 0, G.wanted);
  }
  persist();
}
function desiredCops() { return [0, 2, 3, 5, 6, 8][G.wanted]; }
let copSpawnT = 0;
function managePolice(dt) {
  const cops = vehicles.filter(v => v.police && v.driver === 'cop');
  const px = player.x, pz = player.z;
  // Sicht
  if (G.wanted > 0) {
    let seen = false;
    for (const c of cops) { const d = Math.hypot(c.x - px, c.z - pz); if (d < 30 || (d < 95 && !lineBlocked(c.x, c.z, px, pz, 2))) { seen = true; break; } }
    if (seen) { G.lastSeen = G.time; G.evadeT = 0; } else G.evadeT = G.time - G.lastSeen;
    const need = 7 + G.wanted * 2.5;
    if (G.evadeT > need) {
      G.wanted = 0; G.stats.escapes++; G.mstate.escaped = (G.mstate.escaped || 0) + 1;
      help('Fahndung eingestellt. Du bist entkommen!'); AU.sfx.mission(); AU.policeRadio('Zentrale an alle: Fahndung eingestellt. Der Magenta-Typ ist weg.'); persist();
    }
    // Festnahme
    let close = false;
    for (const c of cops) { const d = Math.hypot(c.x - px, c.z - pz), cs = Math.hypot(c.vx, c.vz); if (d < (G.car ? 7.5 : 6.5) && cs < 6) close = true; }
    const pspeed = G.car ? Math.hypot(G.car.vx, G.car.vz) : 0;
    if (G.copGrab && !G.car) close = true;
    if (close && pspeed < 3 && G.deadT <= 0) { G.bustT += dt; if (G.bustT > (G.car ? 2.6 : 1.6)) busted(); } else G.bustT = Math.max(0, G.bustT - dt * 2);
  } else G.bustT = 0;
  // Spawnen
  copSpawnT -= dt;
  if (cops.length < desiredCops() && copSpawnT <= 0) {
    copSpawnT = 2.2;
    const kind = G.wanted >= 4 && R() < 0.45 ? 'swat' : 'police';
    const v = spawnVehicle(kind, 0, 0, 0, { driver: 'cop' });
    if (!placeOnRoad(v, px, pz, 90, 200, 'police')) removeVehicle(v);
    else { v.driver = 'cop'; setDriver(v.m, 'cop'); v.siren = true; }
  }
  // Überzählige / ohne Fahndung abziehen
  for (const c of cops) {
    c.siren = G.wanted > 0;
    if (c.ai) c.ai.mode = 'police';
    const d = Math.hypot(c.x - px, c.z - pz);
    if ((G.wanted === 0 || cops.length > desiredCops() + 1) && d > 140 && !inView(c.x, c.z, 4)) { removeVehicle(c); }
    else if (G.wanted === 0 && c.ai) c.ai.mode = 'traffic';
  }
  // Streife ohne Fahndung: 2 Polizeiautos im Verkehr
  const patrol = vehicles.filter(v => v.police).length;
  if (G.wanted === 0 && patrol < 2 && copSpawnT <= 0) { copSpawnT = 5; const v = spawnVehicle('police', 0, 0, 0, { driver: 'cop' }); if (!placeOnRoad(v, px, pz, 120, 240, 'traffic')) removeVehicle(v); }
}
function busted() {
  G.deadT = 3.5; G.bustT = 0;
  const loss = Math.round(G.money * 0.1);
  G.money -= loss; const lostC = G.contracts.length; G.contracts = [];
  big('VERHAFTET', `−${fmtEUR(loss)}${lostC ? ` · ${lostC} Verträge beschlagnahmt` : ''}`, 'bust');
  AU.sfx.fail(); AU.policeRadio('Zentrale: Verdächtiger festgenommen. Die Verträge sind sichergestellt.');
  G.respawnAt = { x: -80 + 14, z: -80 + 9 };
}
function wasted() {
  G.deadT = 3.5;
  const loss = Math.round(G.money * 0.1);
  G.money -= loss; const lostC = G.contracts.length; G.contracts = [];
  big('AUSGEKNOCKT', `−${fmtEUR(loss)} Behandlungskosten${lostC ? ` · ${lostC} Verträge verloren` : ''}`, 'dead');
  AU.sfx.fail(); G.respawnAt = world.pois.hospital;
}
function respawn() {
  if (G.car) { setDriver(G.car.m, 'none'); G.car.driver = 'none'; G.car = null; }
  G.mode = 'foot'; G.wanted = 0; G.health = 100; G.evadeT = 0;
  for (const v of vehicles.filter(v => v.police && v.driver === 'cop')) removeVehicle(v);
  placePlayer(G.respawnAt.x, G.respawnAt.z, 0); player.downT = 0; player.fall = 0;
  AU.radioOn(false); AU.engine(false, 0, 0, 0); cam.init = false; updateControls(); persist();
}

// ---------------------------------------------------------------- Pickups
const pickups = [];
const pickupTex = {};
function contractTexture() {
  return pickupTex.c || (pickupTex.c = signTex((g, W, H) => {
    g.fillStyle = '#fff'; roundRect(g, 4, 4, W - 8, H - 8, 14); g.fill(); g.fillStyle = '#E20074'; g.fillRect(4, 4, W - 8, 46);
    drawT(g, 12, 8, 38, '#fff'); g.textAlign = 'left'; fitText(g, 'VERTRAG', 58, 28, W - 70, 30, 900, '#fff');
    g.fillStyle = '#c8c8d0'; for (let k = 0; k < 7; k++) g.fillRect(22, 74 + k * 18, W - 44 - (k % 3) * 30, 7);
    g.strokeStyle = '#1a3a8a'; g.lineWidth = 4; g.beginPath(); g.moveTo(30, H - 40); g.bezierCurveTo(60, H - 70, 80, H - 10, 120, H - 45); g.bezierCurveTo(140, H - 60, 150, H - 30, 180, H - 42); g.stroke();
  }, 220, 280));
}
function makePickupMesh(kind) {
  const grp = new THREE.Group();
  if (kind === 'contract' || kind === 'clipboard') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.79), new THREE.MeshBasicMaterial({ map: contractTexture(), side: THREE.DoubleSide, color: new THREE.Color(1.25, 1.25, 1.25) }));
    m.position.y = 1.0; grp.add(m);
    if (kind === 'clipboard') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.04), new THREE.MeshStandardMaterial({ color: 0x8a5a2a })); b.position.set(0, 1.0, -0.03); grp.add(b); }
  } else if (kind === 'cash') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.28), new THREE.MeshStandardMaterial({ color: 0x3fae5a, roughness: 0.6, emissive: 0x1a6a2a, emissiveIntensity: 0.6 })); m.position.y = 0.6; grp.add(m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.19, 0.29), new THREE.MeshBasicMaterial({ color: 0xffffff })); b.position.y = 0.6; grp.add(b);
  } else if (kind.startsWith('w:')) {
    const k = kind.slice(2), m = weaponModel(k), g = new THREE.Group();
    m.scale.setScalar(k === 'schrotflinte' ? 1.15 : k === 'schlagstock' ? 1.6 : 2.0); m.rotation.set(0, Math.PI / 2, k === 'schlagstock' ? 0 : -0.15); g.add(m); g.position.y = 1.0; grp.add(g);
  } else if (kind === 'health') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 16), new THREE.MeshStandardMaterial({ color: 0xE20074, metalness: 0.7, roughness: 0.25, emissive: 0x500028 })); m.position.y = 0.8; grp.add(m);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: kind.startsWith('w:') ? new THREE.Color(2.6, 1.2, 0.15) : kind === 'cash' ? new THREE.Color(0.5, 2.2, 0.8) : kind === 'health' ? new THREE.Color(2.5, 0.6, 1.4) : new THREE.Color(2.6, 0.2, 1.3), transparent: true, opacity: 0.85, depthWrite: false }));
  ring.position.y = 0.17; grp.add(ring);
  return grp;
}
function dropPickup(kind, x, z, n, life = 60) {
  for (let k = 0; k < 3 && circleHit(x, z, 0.9, _hit); k++) { x += _hit.x; z += _hit.z; }
  const m = makePickupMesh(kind); m.position.set(x, surfaceY(x, z), z); scene.add(m);
  const p = { kind, x, z, n, mesh: m, life, t: R() * 6 }; pickups.push(p); return p;
}
function spawnContracts() {
  const want = 16;
  const live = pickups.filter(p => p.kind === 'contract').length;
  for (let k = live; k < want; k++) {
    const spots = world.contractSpots.filter(([x, z]) => { const d = Math.hypot(x - player.x, z - player.z); return d > 25 && d < 260 && !pickups.some(p => Math.hypot(p.x - x, p.z - z) < 5); });
    if (!spots.length) break; const [x, z] = pick(R, spots); dropPickup('contract', x, z, 1, 1e9);
  }
  if (pickups.filter(p => p.kind === 'health').length < 4) { const [x, z] = pick(R, world.contractSpots); dropPickup('health', x + 1.5, z, 1, 1e9); }
}
function randomTariff() {
  const list = TARIFFS.filter(t => CATEGORIES[t.cat].brand === 'telekom');
  // günstige Tarife häufiger
  for (let k = 0; k < 5; k++) { const t = pick(R, list); const v = t.eur + t.ap; if (R() < 1.25 - v / 16000) return t; }
  return pick(R, list);
}
function addContracts(n, src) {
  for (let k = 0; k < n; k++) { const t = randomTariff(); G.contracts.push(t.id); }
  G.mstate.collected = (G.mstate.collected || 0) + n;
  AU.sfx.pickup(); flash('contract');
  help(`+${n} ${n === 1 ? 'Vertrag' : 'Verträge'} (${src}). Bring ${G.contracts.length === 1 ? 'ihn' : 'sie'} zum Telekom Shop 🅃 für Provision!`);
  persist();
}
function addMoney(c, why, at) { G.money += c; G.stats.earned += Math.max(0, c); AU.sfx.cash(); moneyPop(c); if (at) popup(at, (c >= 0 ? '+' : '') + fmtEURc(c), 'money'); persist(); }
function stepPickups(dt) {
  for (let k = pickups.length - 1; k >= 0; k--) {
    const p = pickups[k]; p.t += dt; p.life -= dt;
    const m = p.mesh, d = Math.hypot(p.x - player.x, p.z - player.z);
    m.visible = d < 160;
    if (m.visible) { m.children[0].rotation.y = p.t * 1.8; m.children[0].position.y = (p.kind === 'cash' ? 0.6 : p.kind === 'health' ? 0.8 : 1.0) + Math.sin(p.t * 2.4) * 0.12; if (m.children[1] && p.kind === 'clipboard') { m.children[1].rotation.y = p.t * 1.8; m.children[1].position.y = m.children[0].position.y; } }
    const reach = G.car ? 2.8 : 1.3, wpn = p.kind.startsWith('w:');
    if (p.noPick > 0 && d > 1.8) p.noPick = 0;
    if (d < reach && G.deadT <= 0 && !(p.kind === 'health' && G.health >= 100) && !(wpn && (G.car || p.noPick > 0))) {
      if (wpn) giveWeapon(p.kind.slice(2), p.n); else
      if (p.kind === 'contract') addContracts(1, 'Glasfaser-Vertrag');
      else if (p.kind === 'clipboard') { addContracts(p.n, 'D2D-Klemmbrett'); G.mstate.clipboards = (G.mstate.clipboards || 0) + 1; }
      else if (p.kind === 'cash') addMoney(p.n, 'Bargeld', p);
      else if (p.kind === 'health') { G.health = Math.min(100, G.health + 50); AU.sfx.pickup(); help('Magenta Mate! +50 Gesundheit'); }
      scene.remove(m); pickups.splice(k, 1); continue;
    }
    if (p.life <= 0) { scene.remove(m); pickups.splice(k, 1); }
  }
}

// ---------------------------------------------------------------- Shops: Überfall & Abgabe
const shopMarkers = [];
for (const s of world.shops) {
  const isT = s.key === 'telekom';
  const col = isT ? new THREE.Color(1.3, 0.08, 0.65) : new THREE.Color(1.25, 0.85, 0.05);
  const grp = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.6, 40, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, side: THREE.FrontSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  cyl.position.y = 0.8; grp.add(cyl);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.36, 1.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.position.y = 0.18; grp.add(ring);
  // Symbol darüber
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex((g, W, H) => { if (isT) drawT(g, 8, 8, W - 16, '#fff', '#E20074'); else { g.fillStyle = '#ffb000'; g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 6, 0, 7); g.fill(); g.fillStyle = '#1a1030'; g.font = `900 ${W * 0.55}px ${FONT}`; g.fillText('€', W / 2, H * 0.54); } }, 128, 128), transparent: true }));
  icon.scale.set(0.9, 0.9, 1); icon.position.y = 2.6; grp.add(icon);
  grp.position.set(s.x, surfaceY(s.x, s.z), s.z); scene.add(grp);
  s.marker = grp; s.cyl = cyl; shopMarkers.push(s);
}
// Lackiererei-Marker
const sprayMarker = (() => { const p = world.pois.spray; const m = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.3, 40, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 2.4), transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); m.position.set(p.x, 0.2, p.z); scene.add(m); return m; })();
const ctx = { rob: null, robT: 0, deliverCD: 0, sprayCD: 0, nearShop: null };
function stepShops(dt) {
  ctx.nearShop = null; ctx.rob = null;
  ctx.deliverCD = Math.max(0, ctx.deliverCD - dt); ctx.sprayCD = Math.max(0, ctx.sprayCD - dt);
  const px = player.x, pz = player.z;
  for (const s of shopMarkers) {
    s.cooldown = Math.max(0, s.cooldown - dt);
    const isT = s.key === 'telekom';
    s.marker.visible = Math.hypot(s.x - px, s.z - pz) < 220;
    if (s.marker.visible) { s.cyl.material.opacity = (isT ? 0.22 : s.cooldown > 0 ? 0.04 : 0.22) + Math.sin(G.time * 4) * 0.06; s.marker.children[2].position.y = 2.6 + Math.sin(G.time * 2) * 0.15; s.marker.children[2].material.opacity = !isT && s.cooldown > 0 ? 0.3 : 1; }
    const d = Math.hypot(s.x - px, s.z - pz);
    if (d > (G.car ? 3.2 : 1.7)) continue;
    ctx.nearShop = s;
    if (isT) {
      if (G.contracts.length && ctx.deliverCD <= 0 && (!G.car || Math.hypot(G.car.vx, G.car.vz) < 9)) deliver(s);
    } else if (!G.car && s.cooldown <= 0) ctx.rob = s;
  }
  // Überfall (halten)
  if (ctx.rob && (inp.actHeld || (TEST && window.__mvRob))) {
    if (ctx.robShop !== ctx.rob) { ctx.robShop = ctx.rob; ctx.robT = 0; AU.speak(pick(R, ['Das ist ein Überfall! Alle Verträge her!', 'Hände hoch! Ab sofort gibt es hier nur noch Telekom!', 'Kasse auf! Und die Kundendaten auch!']), 1.1, 1); }
    ctx.robT += dt; if (Math.floor(ctx.robT * 6) !== Math.floor((ctx.robT - dt) * 6)) AU.sfx.robTick();
    if (ctx.robT >= 3.5) robDone(ctx.rob);
  } else { ctx.robT = Math.max(0, ctx.robT - dt * 2); if (!ctx.rob) ctx.robShop = null; }
  // Lackiererei
  const sp = world.pois.spray;
  sprayMarker.material.opacity = 0.35 + Math.sin(G.time * 3) * 0.15;
  if (G.car && Math.hypot(G.car.x - sp.x, G.car.z - sp.z) < 4.5 && ctx.sprayCD <= 0) spray();
}
function robDone(s) {
  ctx.robT = 0; ctx.robShop = null; s.cooldown = 240;
  const cash = Math.round(rand(250, 700)) * 100, n = 2 + Math.floor(R() * 3);
  G.stats.robbed++; G.stats.kinds[s.key] = (G.stats.kinds[s.key] || 0) + 1; G.mstate['rob_' + s.key] = true;
  addMoney(cash, 'Kasse', s); addContracts(n, `${s.name}-Kundenkartei`);
  crime(2, `Überfall auf ${s.name}`, true);
  AU.policeRadio(`Zentrale an alle Einheiten: Überfall auf ${s.name.replace('₀', ' Null')}. Täter trägt Magenta.`);
  big(`${s.name.toUpperCase()} AUSGERAUBT`, `+${fmtEUR(cash)} · +${n} Verträge`, 'win');
}
function deliver(s) {
  ctx.deliverCD = 1.5;
  const n = G.contracts.length; let sum = 0;
  for (const id of G.contracts) { const t = TARIFFS[id]; sum += t.eur + t.ap; }
  if (s.hq) sum = Math.round(sum * 1.25);
  G.contracts = []; G.stats.delivered += n; G.mstate.delivered = (G.mstate.delivered || 0) + n;
  addMoney(sum, 'Provision', s);
  big('PROVISION', `${n} ${n === 1 ? 'Vertrag' : 'Verträge'} abgegeben · +${fmtEURc(sum)}${s.hq ? ' (HQ-Bonus +25 %)' : ''}`, 'win');
  AU.sfx.mission();
}
function spray() {
  ctx.sprayCD = 6;
  if (G.wanted === 0 && G.car.hp >= G.car.T.hp) { help('Magenta Lackiererei: Komm wieder, wenn du gesucht wirst oder dein Auto Beulen hat.'); return; }
  const cost = 25000;
  if (G.money < cost) { help(`Lackierung kostet ${fmtEUR(cost)} – du hast zu wenig Provision.`); return; }
  if (policeNear(G.car.x, G.car.z, 35)) { help('Die Polizei sieht zu! Erst abhängen, dann lackieren.'); return; }
  G.money -= cost; moneyPop(-cost);
  const cols = [0xE20074, 0x19c6e6, 0xffffff, 0x111111, 0xffb000, 0x3ddc84, 0x8a2be2];
  G.car.m.paintMesh.material = paintMat(pick(R, cols)); G.car.hp = G.car.T.hp; G.car.dead = false;
  if (G.wanted) { G.wanted = 0; G.stats.escapes++; G.mstate.escaped = (G.mstate.escaped || 0) + 1; }
  if (G.car.kind === 'sport') G.mstate.sprayedSport = true;
  big('NEUE FARBE', 'Fahndung eingestellt · Auto repariert · −250 €', 'win'); AU.sfx.cash(); persist();
}

// ---------------------------------------------------------------- Aufträge
const shopsOf = key => world.shops.filter(s => s.key === key);
const nearestOf = list => { let b = null, bd = 1e9; for (const s of list) { const d = Math.hypot(s.x - player.x, s.z - player.z); if (d < bd) { bd = d; b = s; } } return b; };
const MISSIONS = [
  { title: 'Erste Schicht', reward: 25000, steps: [
    { txt: () => `Sammle 3 Glasfaser-Verträge (${Math.min(3, G.mstate.collected || 0)}/3). Sie schweben magenta leuchtend auf den Gehwegen.`, done: () => (G.mstate.collected || 0) >= 3, target: () => nearestOf(pickups.filter(p => p.kind === 'contract')) },
    { txt: () => 'Bring die Verträge zu einem Telekom Shop 🅃 und kassiere deine Provision.', done: () => (G.mstate.delivered || 0) >= 1, target: () => nearestOf(shopsOf('telekom')) } ] },
  { title: 'Drückerkolonne', reward: 40000, steps: [
    { txt: () => `In den Wohnvierteln laufen D2D-ler herum (gelbe Weste). Hau 2 um und schnapp dir ihre Klemmbretter (${Math.min(2, G.mstate.clipboards || 0)}/2).`, done: () => (G.mstate.clipboards || 0) >= 2, target: () => nearestOf(peds.filter(p => p.kind === 'ranger' && p.state !== 'down').concat(pickups.filter(p => p.kind === 'clipboard'))) } ] },
  { title: 'Konkurrenz-Check', reward: 50000, steps: [
    { txt: () => `Überfalle einen Vodafohn-Shop: Stell dich in den gelben €-Marker und halte ${isTouch ? '💰 AUSRAUBEN' : 'E'} gedrückt.`, done: () => !!G.mstate.rob_vodafohn, target: () => nearestOf(shopsOf('vodafohn')) } ] },
  { title: 'Heißes Pflaster', reward: 60000, steps: [
    { txt: () => G.wanted ? 'Häng die Polizei ab: Raus aus ihrer Sicht – oder ab in die Magenta Lackiererei.' : 'Hol dir mindestens 2 Fahndungssterne (z. B. Shop-Überfall) …', done: () => (G.mstate.hadWanted || 0) >= 2 && (G.mstate.escaped || 0) >= 1 && G.wanted === 0, target: () => G.wanted ? world.pois.spray : nearestOf(world.shops.filter(s => s.key !== 'telekom' && s.cooldown <= 0)) } ] },
  { title: 'Fluchtwagen', reward: 80000, steps: [
    { txt: () => 'Klau dir einen Magenta GT (Sportwagen).', done: () => G.car && G.car.kind === 'sport', target: () => nearestOf(vehicles.filter(v => v.kind === 'sport')) },
    { txt: () => 'Bring den Magenta GT zur Magenta Lackiererei am Strand (Ocean Drive).', done: () => (G.car && G.car.kind === 'sport' && Math.hypot(G.car.x - world.pois.spray.x, G.car.z - world.pois.spray.z) < 5) || G.mstate.sprayedSport, target: () => world.pois.spray } ] },
  { title: 'Monopol', reward: 150000, steps: [
    { txt: () => { const k = ['o0', 'eins', 'kongstar'].filter(k => G.mstate['rob_' + k]).length; return `Überfalle je einen Shop von O₀ Zwei, 1&Eins und Kongstar (${k}/3).`; }, done: () => ['o0', 'eins', 'kongstar'].every(k => G.mstate['rob_' + k]), target: () => nearestOf(world.shops.filter(s => ['o0', 'eins', 'kongstar'].includes(s.key) && !G.mstate['rob_' + s.key])) } ] },
  { title: 'Glasfaser-König', reward: 500000, steps: [
    { txt: () => `Gib insgesamt 25 Verträge ab (${Math.min(25, G.stats.delivered)}/25). Tipp: Das Telekom-Campus-HQ auf der Insel zahlt 25 % Bonus.`, done: () => G.stats.delivered >= 25, target: () => G.contracts.length >= 5 ? world.shops.find(s => s.hq) : nearestOf(pickups.filter(p => p.kind === 'contract')) } ] },
];
G.mstep = SAVE.mstep || 0;
function missionStep() {
  const M = MISSIONS[G.mission]; if (!M) return null;
  return M.steps[G.mstep] || null;
}
function updateMissions() {
  const M = MISSIONS[G.mission];
  if (!M) { $('misTitle').textContent = 'FREIES SPIEL'; $('misText').textContent = `Alle Aufträge erledigt! Sammle weiter Provision – Rekord: ${fmtEUR(G.stats.earned)}`; return; }
  const st = M.steps[G.mstep];
  if (st && st.done()) {
    G.mstep++;
    if (G.mstep >= M.steps.length) {
      G.money += M.reward; G.stats.earned += M.reward; moneyPop(M.reward);
      big('AUFTRAG ERFÜLLT', `${M.title} · +${fmtEUR(M.reward)} Bonus`, 'win'); AU.sfx.mission();
      G.mission++; G.mstep = 0; G.mstate = { collectedBase: 0 };
      // Fortschritt, der schon vorher passiert ist, nicht doppelt verlangen
      if (G.mission === 1) G.mstate.clipboards = 0;
      persist();
    } else { persist(); AU.sfx.pickup(); }
  }
  const M2 = MISSIONS[G.mission], st2 = M2 && M2.steps[G.mstep];
  $('misTitle').textContent = M2 ? `AUFTRAG ${G.mission + 1}/${MISSIONS.length}: ${M2.title.toUpperCase()}` : 'FREIES SPIEL';
  $('misText').textContent = st2 ? st2.txt() : '';
}
function missionTarget() { const st = missionStep(); if (!st) return null; try { return st.target(); } catch (e) { return null; } }

// ---------------------------------------------------------------- HUD / Meldungen
let helpT = 0;
function help(t, dur = 4.5) { $('help').textContent = t; $('help').classList.add('on'); helpT = dur; }
let bigT = 0;
function big(title, sub, cls) { const b = $('big'); b.className = 'on ' + cls; $('bigT').textContent = title; $('bigS').textContent = sub || ''; bigT = 3.2; }
function flash(kind) { const f = $('flash'); f.className = ''; void f.offsetWidth; f.className = 'f-' + kind; }
function moneyPop(c) { const el = $('moneyPop'); el.textContent = (c >= 0 ? '+' : '−') + fmtEURc(Math.abs(c)); el.className = c >= 0 ? 'on' : 'on neg'; clearTimeout(moneyPop.t); moneyPop.t = setTimeout(() => el.className = '', 1800); }
// Welt-Labels (HTML, gestochen scharf)
const labels = [];
const labelLayer = $('labels');
function label(obj, text, dur, cls) {
  let L = labels.find(l => l.obj === obj && l.cls === cls);
  if (!L) { const el = document.createElement('div'); el.className = 'wl ' + cls; labelLayer.appendChild(el); L = { el, obj, cls }; labels.push(L); }
  L.el.textContent = text; L.t = dur; L.dur = dur; L.y = cls === 'money' || cls === 'warn' ? 2.2 : cls === 'tag' ? 2.02 : 2.5;
}
function popup(obj, text, cls) { const o = { x: obj.x, z: obj.z, y: obj.y ?? 0 }; label(o, text, 1.8, cls); }
const _v3 = new THREE.Vector3();
function updateLabels(dt) {
  for (let k = labels.length - 1; k >= 0; k--) {
    const L = labels[k]; L.t -= dt;
    if (L.t <= 0) { L.el.remove(); labels.splice(k, 1); continue; }
    const rise = L.cls === 'money' || L.cls === 'warn' ? (1 - L.t / L.dur) * 1.2 : 0;
    _v3.set(L.obj.x, (L.obj.y || 0) + L.y + rise, L.obj.z).project(camera);
    const vis = _v3.z < 1 && Math.abs(_v3.x) < 1.1 && Math.abs(_v3.y) < 1.1;
    L.el.style.display = vis ? '' : 'none';
    if (vis) L.el.style.transform = `translate(-50%,-100%) translate(${(_v3.x * 0.5 + 0.5) * (lastVW || innerWidth)}px,${(-_v3.y * 0.5 + 0.5) * (lastVH || innerHeight)}px)`;
    L.el.style.opacity = Math.min(1, L.t * 3);
  }
  // D2D-ler-Namensschilder in der Nähe
  for (const p of peds) {
    if (p.kind !== 'ranger' || p.state === 'down') continue;
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (d < 22 && !labels.find(l => l.obj === p && l.cls === 'tag')) label(p, 'D2D-LER', 0.6, 'tag');
    else { const l = labels.find(l => l.obj === p && l.cls === 'tag'); if (l && d < 22) l.t = 0.6; }
    if (d < 7 && G.time - p.said > 9 && !G.car) { p.said = G.time; label(p, pick(R, ['Haben Sie schon Glasfaser? Unterschreiben Sie einfach hier!', 'Nur eine Unterschrift – ist auch gar nicht verbindlich!', 'Ich komme von Ihrem Netzbetreiber … sozusagen.', 'Telekom? Oh nein. Wechseln Sie lieber zu uns!', 'Psst – 24 Monate Laufzeit sind doch fast nix!']), 3.2, 'bubble'); }
  }
}
const STAR_EL = $('stars');
let lastHud = '';
function updateHUD() {
  const d = new Date(), hh = TOD.forced != null ? Math.floor(TOD.hour) : d.getHours(), mm = TOD.forced != null ? Math.floor((TOD.hour % 1) * 60) : d.getMinutes();
  const s = `${hh}|${mm}|${G.money}|${G.wanted}|${Math.round(G.health)}|${G.contracts.length}|${G.evadeT > 2 ? 1 : 0}`;
  if (s !== lastHud) {
    lastHud = s;
    $('clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('money').textContent = fmtEURc(G.money);
    let st = ''; for (let k = 0; k < 5; k++) st += `<i class="${k < G.wanted ? 'on' : ''}">★</i>`;
    STAR_EL.innerHTML = st; STAR_EL.classList.toggle('blink', G.wanted > 0 && G.evadeT > 2);
    $('hpBar').style.width = G.health + '%'; $('hpBar').classList.toggle('low', G.health < 30);
    $('contracts').textContent = G.contracts.length;
    $('contractsBox').classList.toggle('has', G.contracts.length > 0);
  }
  // Auto-HUD
  if (G.car) {
    const kmh = Math.round(Math.abs(G.car.speed || 0) * 3.6);
    $('speed').textContent = kmh; $('carName').textContent = G.car.T.name;
    $('carHp').style.width = clamp(G.car.hp / G.car.T.hp * 100, 0, 100) + '%';
  }
  // Kontext-Taste
  let act = '';
  if (G.car) act = 'AUSSTEIGEN';
  else { const v = nearestEnterable(); if (v) act = v.driver === 'ai' || v.driver === 'cop' ? 'AUTO KLAUEN' : 'EINSTEIGEN'; }
  $('bEnter').textContent = act ? (isTouch ? (G.car ? '🚪' : '🚗') + ' ' + act : '') : '';
  $('bEnter').classList.toggle('hide', !act);
  $('keyHint').textContent = !isTouch && act ? `F – ${act}` : '';
  const robbing = ctx.rob && !G.car;
  $('bAct').classList.toggle('hide', !robbing);
  $('robBar').classList.toggle('on', robbing || ctx.robT > 0);
  $('robFill').style.width = clamp(ctx.robT / 3.5 * 100, 0, 100) + '%';
  $('robTxt').textContent = robbing ? `${ctx.rob.name} ausrauben – ${isTouch ? '💰 halten' : 'E halten'}` : '';
  $('bustBar').style.opacity = G.bustT > 0.05 ? 1 : 0; $('bustFill').style.width = clamp(G.bustT / (G.car ? 2.6 : 1.6) * 100, 0, 100) + '%';
}
function updateControls() {
  document.body.classList.toggle('incar', !!G.car);
  if (G.car) { W.lock = null; closeWheel(false); }
  updateWeaponHud();
  $('carHud').classList.toggle('on', !!G.car);
}
function showStation() { const s = AU.STATIONS[AU.A.station], tr = AU.A.track; const el = $('radio'); el.innerHTML = `<b>📻 ${s.name}</b><span>${s.sub}</span>${tr ? `<i>♪ ${tr.artist} – ${tr.title}</i>` : ''}`; el.classList.add('on'); clearTimeout(showStation.t); showStation.t = setTimeout(() => el.classList.remove('on'), 2600); }
function nextStation() { if (!G.car) return; AU.setStation((AU.A.station + 1) % AU.STATIONS.length); showStation(); AU.jingle(); persist(); }

// ---------------------------------------------------------------- Minimap & Karte
const MAP = { x0: -760, x1: 380, z0: -320, z1: 320, k: 2 };
const mapImg = canvas((MAP.x1 - MAP.x0) * MAP.k, (MAP.z1 - MAP.z0) * MAP.k);
{
  const g = mapImg.getContext('2d'), k = MAP.k, X = x => (x - MAP.x0) * k, Z = z => (z - MAP.z0) * k;
  g.fillStyle = '#2c7fa3'; g.fillRect(0, 0, mapImg.width, mapImg.height);
  g.fillStyle = '#4a4f5c'; g.fillRect(X(LAND.x0), Z(LAND.z0), (BEACH_X - LAND.x0) * k, (LAND.z1 - LAND.z0) * k);
  g.fillStyle = '#e3cf98'; g.fillRect(X(BEACH_X), Z(LAND.z0), (324 - BEACH_X) * k, (LAND.z1 - LAND.z0) * k);
  g.fillStyle = '#4a4f5c'; g.fillRect(X(ISLAND.x0), Z(ISLAND.z0), (ISLAND.x1 - ISLAND.x0) * k, (ISLAND.z1 - ISLAND.z0) * k);
  for (const rg of world.rings) { g.fillStyle = rg.kind === 'P' ? '#3f7d3a' : rg.kind === 'R' ? '#5a6150' : '#5a5f6c'; g.fillRect(X(rg.x0 - 2), Z(rg.z0 - 2), (rg.x1 - rg.x0 + 4) * k, (rg.z1 - rg.z0 + 4) * k); }
  g.fillStyle = '#8a8fa0'; for (const c of world.colliders) if (c.kind === 'b' && c.h > 3) g.fillRect(X(c.x0), Z(c.z0), (c.x1 - c.x0) * k, (c.z1 - c.z0) * k);
  g.strokeStyle = '#e8e8ee'; g.lineWidth = 11 * k; g.lineCap = 'square';
  for (const [ax, az, bx, bz] of world.roadsMap) { g.beginPath(); g.moveTo(X(ax), Z(az)); g.lineTo(X(bx), Z(bz)); g.stroke(); }
  g.strokeStyle = '#ffffff'; g.lineWidth = 9 * k;
  for (const [ax, az, bx, bz] of world.roadsMap) { g.beginPath(); g.moveTo(X(ax), Z(az)); g.lineTo(X(bx), Z(bz)); g.stroke(); }
}
const mm = $('minimap'), mg = mm.getContext('2d');
function sizeMinimap() { const s = mm.clientWidth || 150; mm.width = Math.round(s * Math.min(3, DPR)); mm.height = mm.width; }
function blipList() {
  const L = [];
  for (const s of world.shops) L.push({ x: s.x, z: s.z, t: s.key === 'telekom' ? 'T' : 'shop', c: BRANDS[s.key].map, dim: s.key !== 'telekom' && s.cooldown > 0 });
  L.push({ x: world.pois.spray.x, z: world.pois.spray.z, t: 'spray' });
  for (const v of vehicles) if (v.police && v.driver === 'cop' && G.wanted > 0) L.push({ x: v.x, z: v.z, t: 'cop' });
  for (const p of peds) if (p.kind === 'ranger' && p.state !== 'down') L.push({ x: p.x, z: p.z, t: 'ranger' });
  for (const p of pickups) if (p.kind === 'contract' || p.kind === 'clipboard') L.push({ x: p.x, z: p.z, t: 'contract' });
  return L;
}
function drawBlip(g, b, x, y, s) {
  if (b.t === 'T') { drawT(g, x - 7 * s, y - 7 * s, 14 * s, '#fff', '#E20074'); }
  else if (b.t === 'shop') { g.globalAlpha = b.dim ? 0.35 : 1; g.fillStyle = '#1a1030'; g.beginPath(); g.arc(x, y, 7 * s, 0, 7); g.fill(); g.fillStyle = b.c; g.beginPath(); g.arc(x, y, 5.5 * s, 0, 7); g.fill(); g.fillStyle = '#1a1030'; g.font = `900 ${8 * s}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('€', x, y + 0.5 * s); g.globalAlpha = 1; }
  else if (b.t === 'spray') { g.fillStyle = '#19c6e6'; g.fillRect(x - 6 * s, y - 6 * s, 12 * s, 12 * s); g.fillStyle = '#fff'; g.font = `900 ${9 * s}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('L', x, y + 0.5 * s); }
  else if (b.t === 'cop') { g.fillStyle = (G.time * 4 | 0) % 2 ? '#ff2a2a' : '#2a6aff'; g.beginPath(); g.arc(x, y, 5 * s, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5 * s; g.stroke(); }
  else if (b.t === 'ranger') { g.fillStyle = '#d4ff1a'; g.beginPath(); g.arc(x, y, 4 * s, 0, 7); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 1 * s; g.stroke(); }
  else if (b.t === 'contract') { g.fillStyle = '#fff'; g.fillRect(x - 2.5 * s, y - 3.2 * s, 5 * s, 6.4 * s); g.fillStyle = '#E20074'; g.fillRect(x - 2.5 * s, y - 3.2 * s, 5 * s, 1.6 * s); }
}
function drawMinimap() {
  const W = mm.width, s = W / 150, g = mg, R0 = W / 2;
  const range = G.car ? 190 : 120, k = R0 / range; // px pro m
  g.save(); g.clearRect(0, 0, W, W);
  g.beginPath(); g.arc(R0, R0, R0 - 1, 0, 7); g.clip();
  g.fillStyle = '#2c7fa3'; g.fillRect(0, 0, W, W);
  g.translate(R0, R0); g.rotate(cam.yaw + Math.PI);
  const sc = k / MAP.k; g.scale(sc, sc);
  g.drawImage(mapImg, -(player.x - MAP.x0) * MAP.k, -(player.z - MAP.z0) * MAP.k);
  g.restore();
  // Blips (Bildschirmkoordinaten)
  const cy = Math.cos(cam.yaw + Math.PI), sy = Math.sin(cam.yaw + Math.PI);
  const toS = (x, z) => { const dx = (x - player.x) * k, dz = (z - player.z) * k; return [R0 + dx * cy - dz * sy, R0 + dx * sy + dz * cy]; };
  g.save(); g.beginPath(); g.arc(R0, R0, R0 - 1, 0, 7); g.clip();
  for (const b of blipList()) { const [x, y] = toS(b.x, b.z); if (Math.hypot(x - R0, y - R0) < R0 - 4 * s) drawBlip(g, b, x, y, s); }
  g.restore();
  // Auftragsziel (am Rand fixiert)
  const t = missionTarget();
  if (t) {
    let [x, y] = toS(t.x, t.z); const dx = x - R0, dy = y - R0, d = Math.hypot(dx, dy), m = R0 - 9 * s;
    if (d > m) { x = R0 + dx / d * m; y = R0 + dy / d * m; }
    g.fillStyle = '#ffd400'; g.strokeStyle = '#1a1030'; g.lineWidth = 2 * s; g.beginPath(); g.arc(x, y, 6.5 * s, 0, 7); g.fill(); g.stroke();
  }
  // Spieler-Pfeil
  const ph = player.h - cam.yaw;
  g.save(); g.translate(R0, R0); g.rotate(-ph);
  g.fillStyle = '#fff'; g.strokeStyle = '#E20074'; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(0, -9 * s); g.lineTo(6.5 * s, 7 * s); g.lineTo(0, 3.5 * s); g.lineTo(-6.5 * s, 7 * s); g.closePath(); g.fill(); g.stroke();
  g.restore();
  // Norden
  const [nx, ny] = [R0 + Math.sin(-(cam.yaw + Math.PI)) * 0 , 0];
  g.lineWidth = 3 * s; g.strokeStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(R0, R0, R0 - 1.5 * s, 0, 7); g.stroke();
  // Fahndungsring
  if (G.wanted > 0) { g.strokeStyle = (G.time * 3 | 0) % 2 ? 'rgba(255,40,40,.9)' : 'rgba(40,110,255,.9)'; g.lineWidth = 4 * s; g.beginPath(); g.arc(R0, R0, R0 - 3 * s, 0, 7); g.stroke(); }
}
function drawBigMap(cv) {
  const s = Math.min(3, DPR), W = cv.clientWidth * s, H = cv.clientHeight * s; cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), k = Math.min(W / (MAP.x1 - MAP.x0), H / (MAP.z1 - MAP.z0));
  const ox = (W - (MAP.x1 - MAP.x0) * k) / 2, oz = (H - (MAP.z1 - MAP.z0) * k) / 2;
  g.fillStyle = '#2c7fa3'; g.fillRect(0, 0, W, H);
  g.drawImage(mapImg, ox, oz, (MAP.x1 - MAP.x0) * k, (MAP.z1 - MAP.z0) * k);
  const toS = (x, z) => [ox + (x - MAP.x0) * k, oz + (z - MAP.z0) * k];
  const bs = s * 0.9;
  for (const b of blipList()) { const [x, y] = toS(b.x, b.z); drawBlip(g, b, x, y, bs); }
  const t = missionTarget(); if (t) { const [x, y] = toS(t.x, t.z); g.fillStyle = '#ffd400'; g.strokeStyle = '#1a1030'; g.lineWidth = 2 * s; g.beginPath(); g.arc(x, y, 7 * s, 0, 7); g.fill(); g.stroke(); }
  const [px, py] = toS(player.x, player.z);
  g.save(); g.translate(px, py); g.rotate(Math.PI - player.h); g.fillStyle = '#fff'; g.strokeStyle = '#E20074'; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(0, -10 * s); g.lineTo(7 * s, 8 * s); g.lineTo(0, 4 * s); g.lineTo(-7 * s, 8 * s); g.closePath(); g.fill(); g.stroke(); g.restore();
  g.font = `800 ${13 * s}px ${FONT}`; g.fillStyle = '#fff'; g.textAlign = 'center';
  const lbl = (t, x, z) => { const [a, b] = toS(x, z); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4 * s; g.strokeText(t, a, b); g.fillText(t, a, b); };
  lbl('OCEAN DRIVE', 240, -262); lbl('DOWNTOWN', -160, -40); lbl('STRAND', 300, 290 - 330); lbl('TELEKOM CAMPUS', -643, -100); lbl('MAGENTA-DAMM', -420, -16);
}

// ---------------------------------------------------------------- Handy-Menü
function togglePhone() { if ($('phone').classList.contains('on')) closePhone(); else openPhone('home'); }
function openPhone(page) {
  if (!G.started) return;
  G.paused = true; $('phone').classList.add('on'); document.exitPointerLock?.();
  showPhonePage(page);
}
function closePhone() { $('phone').classList.remove('on'); G.paused = false; last = performance.now(); }
function showPhonePage(page) {
  for (const el of document.querySelectorAll('.ppage')) el.classList.toggle('on', el.id === 'pp-' + page);
  if (page === 'map') requestAnimationFrame(() => drawBigMap($('bigmap')));
  if (page === 'missions') {
    $('missionList').innerHTML = MISSIONS.map((m, i) => `<li class="${i < G.mission ? 'done' : i === G.mission ? 'cur' : ''}"><b>${i < G.mission ? '✔' : i === G.mission ? '▶' : '•'} ${m.title}</b><span>${i === G.mission && m.steps[G.mstep] ? m.steps[G.mstep].txt() : i < G.mission ? 'Erledigt' : 'Gesperrt'}</span><em>${fmtEUR(m.reward)}</em></li>`).join('');
  }
  if (page === 'stats') {
    const S = G.stats;
    $('statList').innerHTML = [['Provision gesamt', fmtEURc(S.earned)], ['Kontostand', fmtEURc(G.money)], ['Verträge abgegeben', S.delivered], ['Verträge dabei', G.contracts.length], ['Shops ausgeraubt', S.robbed], ['D2D-ler umgehauen', S.rangers], ['Autos geklaut', S.stolen], ['Polizei abgehängt', S.escapes], ['Schläge', S.punches]].map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
  }
  if (page === 'radio') $('stationList').innerHTML = AU.STATIONS.map((s, i) => `<button class="pbtn ${i === AU.A.station ? 'sel' : ''}" data-st="${i}"><b>${s.name}</b><span>${s.sub}</span></button>`).join('');
  if (page === 'settings') { for (const b of document.querySelectorAll('[data-q]')) b.classList.toggle('sel', b.dataset.q === qSel); $('btnMute').textContent = AU.A.on ? '🔊 Ton: AN' : '🔇 Ton: AUS'; $('btnBlood').textContent = BLOOD ? '🩸 Blut: AN' : '🩸 Blut: AUS'; $('prInfo').textContent = `Auflösung: ${glCanvas.width}×${glCanvas.height} px (${pr.toFixed(2)}×)`; }
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-page],[data-st],[data-q],#btnMute,#btnClose,#btnReset,#phoneBack');
  if (!t) return; AU.sfx.click();
  if (t.dataset.page) showPhonePage(t.dataset.page);
  else if (t.dataset.st) { AU.setStation(+t.dataset.st); showPhonePage('radio'); persist(); if (G.car) { AU.radioOn(true); AU.jingle(); } }
  else if (t.dataset.q) { applyQuality(t.dataset.q); showPhonePage('settings'); }
  else if (t.id === 'btnMute') { AU.setMuted(AU.A.on); showPhonePage('settings'); persist(); }
  else if (t.id === 'btnClose') closePhone();
  else if (t.id === 'phoneBack') showPhonePage('home');
  else if (t.id === 'btnReset') { if (confirm('Spielstand wirklich löschen?')) { localStorage.removeItem('magentaVice.v1'); location.reload(); } }
});
$('hudPhone').addEventListener('click', e => { e.stopPropagation(); AU.initAudio(); togglePhone(); });

// ---------------------------------------------------------------- Bevölkerung
function populate() {
  // Verkehr
  // ~40 % Sportwagen, Cabrios und Supersportwagen in knalligen Farben
  const mix = ['sport', 'sedan', 'hyper', 'taxi', 'cabrio', 'tkvan', 'sedan', 'muscle', 'pickup', 'speedster', 'tktruck', 'ecoupe', 'rivalvan', 'taxi', 'sedan', 'sport', 'tkvan', 'cabrio', 'sedan', 'hyper', 'muscle', 'sedan', 'speedster', 'taxi', 'ecoupe'];
  const nTraffic = Math.round((isMobile ? 36 : 48) * Q.dens);
  for (let k = 0; k < nTraffic; k++) { const v = spawnVehicle(mix[k % mix.length], 0, 0, 0, { driver: 'ai' }); v.driver = 'ai'; setDriver(v.m, 'civ'); if (!placeOnRoad(v, player.x, player.z, 25, k % 3 === 0 ? 120 : 230, 'traffic', false)) removeVehicle(v); }
  // Dichter Verkehr auf Ocean Drive und Damm
  for (let k = 0; k < Math.round(10 * Q.dens); k++) { const v = spawnVehicle(mix[(k * 7) % mix.length], 0, 0, 0, { driver: 'ai' }); v.driver = 'ai'; setDriver(v.m, 'civ'); if (!placeOnEdge(v, k % 3 === 2 ? 'cause' : 'ocean')) removeVehicle(v); }
  // Am Straßenrand geparkte Autos
  const pk = ['sport', 'cabrio', 'sedan', 'hyper', 'taxi', 'muscle', 'sedan', 'pickup', 'speedster', 'tkvan', 'ecoupe'];
  for (let k = 0, placed = 0; k < 200 && placed < Math.round(26 * Q.dens); k++) {
    const [a, b] = world.edges[Math.floor(R() * world.edges.length)], A = NODES[a], Bn = NODES[b];
    if (A.x < -300 || Bn.x < -300) continue;
    const L = Math.hypot(Bn.x - A.x, Bn.z - A.z), t = rand(0.22, 0.78), [rx, rz] = rightOf(Bn.x - A.x, Bn.z - A.z);
    const x = lerp(A.x, Bn.x, t) + rx * (RHW - 1.15), z = lerp(A.z, Bn.z, t) + rz * (RHW - 1.15);
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 14 || vehicles.some(o => Math.hypot(o.x - x, o.z - z) < 7) || circleHit(x, z, 1.2, _hit)) continue;
    const v = spawnVehicle(pk[placed % pk.length], x, z, Math.atan2(Bn.x - A.x, Bn.z - A.z), {}); v.parked = true; placed++;
  }
  // Geparkte Autos (u. a. Magenta GT direkt beim Start)
  const park = [['sport', 244.6, SPAWN.z - 9, Math.PI, 0], ['tkvan', 244.6, SPAWN.z + 14, Math.PI, 0], ['hyper', 244.6, SPAWN.z + 26, Math.PI, 0], ['cabrio', 244.6, SPAWN.z - 21, Math.PI, 0], ['sedan', 80 + 8.5, 40, 0, 2], ['sport', 240 + 9, -60, Math.PI, 2], ['tktruck', -80 + 9, -120, 0, 0], ['taxi', 160 - 8.5, 120, Math.PI, 0], ['sport', -594 + 6, 30, Math.PI / 2, 5], ['pickup', 0 - 8.5, -200, 0, 0], ['sedan', -160 + 9, 200, Math.PI, 3], ['sport', 249, 150, 0, 1]];
  for (const [kind, x, z, h, c] of park) { const v = spawnVehicle(kind, x, z, h, { color: c }); v.parked = true; }
  // Fußgänger
  const nPed = Math.round((isMobile ? 50 : 68) * Q.dens);
  const nearRings = world.rings.filter(rg => rg.kind !== 'R');
  const ringsBy = nearRings.slice().sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - player.x, (a.z0 + a.z1) / 2 - player.z) - Math.hypot((b.x0 + b.x1) / 2 - player.x, (b.z0 + b.z1) / 2 - player.z));
  for (let k = 0; k < nPed; k++) {
    const rg = k % 2 ? pick(R, nearRings) : ringsBy[Math.floor(R() * Math.min(12, ringsBy.length))], u = R() * 240, [x, z] = ringPoint(rg, u);
    const jog = R() < 0.12, p = spawnPed(jog ? 'tourist' : 'civ', x, z, rg); p.u = u; if (jog) p.speed = rand(2.9, 3.4);
    if (!jog && R() < 0.3) { const q = spawnPed('civ', x, z, rg); q.u = u - p.dir * 1.1; q.dir = p.dir; q.speed = p.speed; } // Pärchen/Gruppen
  }
  for (let k = 0; k < Math.round(22 * Q.dens); k++) { const [x, z] = pick(R, world.beachSpots); const p = spawnPed('tourist', x + 2, z + 3, null); if (R() < 0.15) p.speed = rand(2.8, 3.3); }
  for (let k = 0; k < 9; k++) { const rg = world.resRings[k % world.resRings.length], u = R() * 240, [x, z] = ringPoint(rg, u); const p = spawnPed('ranger', x, z, rg); p.u = u; }
  spawnContracts();
}

// ---------------------------------------------------------------- Hauptschleife
let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0, fpsShown = 0, recycleT = 0, saveT = 0, missionT = 0, mapT = 0;
const shadowTarget = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (TEST && window.__mvFixedDT) dt = window.__mvFixedDT;
  fpsAcc += dt; fpsN++;
  if (!G.started || G.paused) { if (G.started) { composer.render(); } else renderMenuScene(dt); return; }
  if (TEST && window.__mvFixedDT) { G.time += dt; step(dt); }
  else if (TEST) { // Headless-Tests: Simulation in Echtzeit auch bei wenigen fps
    let rt = Math.min(3, (now - (frame.lt || now)) / 1000) || dt; frame.lt = now;
    while (rt > 0.001) { const d = Math.min(0.05, rt); rt -= d; G.time += d; step(d); }
  } else { G.time += dt; step(dt); }
  render(dt);
  // Dynamische Auflösung (hält ≥ ~45 fps, nie über Qualitäts-Maximum)
  fpsT += dt;
  if (fpsT > 2.5) {
    const fps = fpsN / fpsAcc; fpsShown = fps; fpsAcc = 0; fpsN = 0; fpsT = 0;
    if (!fixedPR && !TEST) {
      let np = pr;
      if (fps < 40 && pr > Q.minPR) np = Math.max(Q.minPR, pr - 0.25);
      else if (fps > 57 && pr < Math.min(DPR, Q.maxPR)) np = Math.min(Math.min(DPR, Q.maxPR), pr + 0.25);
      if (np !== pr) { pr = np; onResize(); }
    }
    $('fps').textContent = `${Math.round(fps)} fps · ${pr.toFixed(2)}× · ${renderer.info.render.calls} dc`;
  }
}
function step(dt) {
  if (W.wheel) dt *= 0.3; // Zeitlupe im Waffenrad
  G.copGrab = false;
  if (G.deadT > 0) { G.deadT -= dt; if (G.deadT <= 0) respawn(); }
  // Frustum für Spawns
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frustum.setFromProjectionMatrix(_pm);
  if (G.deadT <= 0) stepPlayer(dt);
  for (const v of vehicles) if (v.ai && (v.driver === 'ai' || v.driver === 'cop')) aiDrive(v, dt);
  // Physik in 2 Teilschritten (stabile Kollisionen)
  const sub = 2;
  for (let s = 0; s < sub; s++) { for (const v of vehicles) { if (v.parked && !v.ai && v !== G.car && Math.hypot(v.vx, v.vz) < 0.05) continue; stepVehicle(v, dt / sub); } collideVehicles(); }
  for (const v of vehicles) if (v !== G.car && !v.ai && v.driver === 'none') { v.thr = 0; v.hb = true; v.steer = 0; }
  // Fahrzeuge vs. Fußgänger
  for (const v of vehicles) {
    const sp = Math.hypot(v.vx, v.vz); if (sp < 4) continue;
    for (const p of peds) {
      if (p.state === 'down' || Math.abs(p.x - v.x) > 5 || Math.abs(p.z - v.z) > 5) continue;
      for (const [cx, cz] of carCircles(v)) if (Math.hypot(p.x - cx, p.z - cz) < v.T.wid / 2 + 0.35) {
        p.hp = 0; knockDown(p, v.x - v.vx, v.z - v.vz, sp * 0.6); AU.sfx.punch(); AU.sfx.boing();
        if (v === G.car) { if (p.kind === 'ranger') { G.stats.rangers++; G.mstate.rangers = (G.mstate.rangers || 0) + 1; dropPickup('clipboard', p.x, p.z, 2 + Math.floor(R() * 2)); } if (policeNear(v.x, v.z, 60)) crime(1, 'Fußgänger umgefahren'); }
        break;
      }
    }
  }
  const px = player.x, pz = player.z;
  for (const p of peds) stepPed(p, dt, Math.abs(p.x - px) < 110 && Math.abs(p.z - pz) < 110);
  managePolice(dt);
  stepCopDeploy(); stepRangerz(dt); stepAmbient(dt); stepTrafficLights();
  stepCarFx(dt); stepParticles(dt); stepTracers(dt); stepFlashes(dt); stepDecals(dt);
  stepWeaponSpawns(dt); stepAmmu(dt); stepCabrioSeats(dt);
  stepPickups(dt);
  stepShops(dt);
  // Polizeilichter
  for (const v of vehicles) if (v.m.bar) { const on = v.siren; const ph = (G.time * 6 + v.id) % 2 < 1; v.m.bar.userData.rl.material.color.setScalar(0).setRGB(on ? (ph ? 5 : 0.3) : 0.6, 0.1, 0.1); v.m.bar.userData.bl.material.color.setRGB(0.1, 0.3, on ? (ph ? 0.4 : 6) : 0.8); }
  // Recycling (Verkehr & Fußgänger in Spielernähe halten)
  recycleT -= dt;
  if (recycleT <= 0) {
    recycleT = 0.5;
    for (const v of vehicles) {
      if (v === G.car || v.police) continue;
      const d = Math.hypot(v.x - px, v.z - pz);
      if (v.driver === 'ai' && (d > 210 || v.sinking > 3 || (v.dead && d > 60 && !inView(v.x, v.z)))) { if (!inView(v.x, v.z, 4) || d > 400) { restoreVehicle(v); placeOnRoad(v, px, pz, 60, 170); } }
      else if (v.exploded && d > 70 && !inView(v.x, v.z, 4)) { restoreVehicle(v); v.parked = false; v.driver = 'ai'; setDriver(v.m, 'civ'); placeOnRoad(v, px, pz, 90, 230); }
      else if (v.driver === 'none' && !v.parked && (d > 300 || v.sinking > 3)) { if (!inView(v.x, v.z, 4)) { v.driver = 'ai'; setDriver(v.m, 'civ'); placeOnRoad(v, px, pz, 90, 230); } }
      else if (v.sinking > 4 && v.parked) { v.parked = false; v.driver = 'ai'; setDriver(v.m, 'civ'); placeOnRoad(v, px, pz, 90, 230); }
    }
    for (let k = peds.length - 1; k >= 0; k--) {
      const p = peds[k], d = Math.hypot(p.x - px, p.z - pz);
      if (p.amb) continue;
      if (p.temp != null) { p.temp -= 0.5; if ((p.temp <= 0 || (p.out && p.t > 25)) && (d > 40 || !inView(p.x, p.z))) removePed(p); continue; }
      if (p.out && p.t > 25 && (d > 50 || !inView(p.x, p.z))) { respawnPed(p); continue; }
      if (d > (Q.pedVis + 70) && !p.beach) respawnPed(p);
    }
    spawnContracts();
  }
  // Audio
  if (G.car) {
    const v = G.car, sp = Math.abs(v.speed || 0);
    AU.engine(true, clamp(sp / v.T.maxV, 0, 1) * 3 % 1.2 + sp / v.T.maxV * 0.8, Math.abs(v.thr), v.skid || 0);
  } else AU.engine(false, 0, 0, 0);
  let sir = 0; for (const v of vehicles) if (v.siren) sir = Math.max(sir, 1 - Math.hypot(v.x - px, v.z - pz) / 160);
  AU.siren(sir);
  AU.ambience(clamp(1 - Math.abs(px - 320) / 120, 0, 1), clamp(1 - Math.abs(px - 80) / 300, 0, 1), TOD.nightF, G.car ? 0 : 1);
  missionT -= dt; if (missionT <= 0) { missionT = 0.25; updateMissions(); }
  saveT -= dt; if (saveT <= 0) { saveT = 5; persist(); }
  if (G.health < 100 && G.deadT <= 0) G.health = Math.min(100, G.health + dt * 0.8);
  helpT -= dt; if (helpT <= 0) $('help').classList.remove('on');
  bigT -= dt; if (bigT <= 0) $('big').classList.remove('on');
  if (world.water.normalMap) { world.water.normalMap.offset.x += dt * 0.004; world.water.normalMap.offset.y += dt * 0.0025; }
  if (world.waterN2) { world.waterN2.offset.x -= dt * 0.006; world.waterN2.offset.y += dt * 0.004; }
  if (world.foam) world.foam.material.opacity = 0.55 + Math.sin(G.time * 0.9) * 0.3;
}
function render(dt) {
  updateCamera(dt);
  if (updateTOD(scene, false) || true) {
    // Sonnen-/Mondlicht folgt dem Spieler (Schattenbereich), auf Texel einrasten
    const L = TOD.lightDir || TOD.dir;
    const tx = camera.position.x + Math.sin(cam.yaw) * Q.shadowR * 0.45, tz = camera.position.z + Math.cos(cam.yaw) * Q.shadowR * 0.45;
    const texel = (2 * Q.shadowR) / Q.shadow;
    shadowTarget.set(Math.round(tx / texel) * texel, 0, Math.round(tz / texel) * texel);
    sunL.target.position.copy(shadowTarget); sunL.position.copy(shadowTarget).addScaledVector(L, 200);
  }
  sky.dome && sky.dome.position.set(camera.position.x, 0, camera.position.z);
  for (const v of vehicles) { const lit = TOD.lampF > 0.05, dc = distToCam(v); v.m.root.visible = dc < Q.carVis || v === G.car; v.m.beam.visible = lit && dc < 120; if (v.m.lodG) { setCarLod(v.m, dc > Q.carLod && v !== G.car); if (v.m.lod && v.m.lodPaint.material !== v.m.paintMesh.material) v.m.lodPaint.material = v.m.paintMesh.material; } }
  sharedMats().beam.opacity = TOD.lampF * lerp(0.5, 0.18, TOD.dayF);
  renderer.info.reset();
  composer.render();
  updateLabels(dt);
  { const lm = $('lockMark'), on = W.lock && !G.car; if (on) { _v3.set(W.lock.x, W.lock.y + 1.2, W.lock.z).project(camera); if (_v3.z < 1) { lm.style.left = ((_v3.x + 1) / 2 * 100) + '%'; lm.style.top = ((1 - _v3.y) / 2 * 100) + '%'; } } lm.classList.toggle('on', !!on && _v3.z < 1); $('bAim').classList.toggle('on', !!W.lock); }
  updateHUD();
  mapT -= dt; if (mapT <= 0) { mapT = 1 / 30; drawMinimap(); }
}

// ---------------------------------------------------------------- Startbildschirm
let menuT = 0;
function renderMenuScene(dt) {
  menuT += dt;
  // Kameraflug über den Ocean Drive
  const a = menuT * 0.05;
  camera.position.set(200 + Math.cos(a) * 140, 55 + Math.sin(menuT * 0.1) * 8, Math.sin(a) * 160);
  camera.lookAt(150, 10, 0);
  sky.dome.position.set(camera.position.x, 0, camera.position.z);
  updateTOD(scene, false);
  sunL.target.position.set(150, 0, 0); sunL.position.copy(sunL.target.position).addScaledVector(TOD.lightDir || TOD.dir, 200);
  composer.render();
}
function start() {
  if (G.started) return;
  AU.initAudio(); AU.setStation(SAVE.station || 0); if (SAVE.muted) AU.setMuted(true);
  G.started = true; $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  document.body.classList.add('playing');
  cam.yaw = player.h; cam.init = false;
  updateControls(); sizeMinimap();
  if (G.wanted > 0) { G.lastSeen = G.time; help(`Willkommen zurück! Du wirst noch gesucht (${'★'.repeat(G.wanted)}).`); }
  else help(isTouch ? 'Links: Joystick bewegen · Rechts wischen: Kamera · 👊 schlagen · 🚗 einsteigen/klauen · 📱 Menü' : 'WASD laufen · Shift rennen · Maus schauen · Klick/Q schlagen · F einsteigen/klauen · E halten: ausrauben · Tab: Handy', 7);
  last = performance.now();
}
$('btnPlay').addEventListener('click', start);
$('btnPlay').textContent = SAVE.money ? '▶ WEITERSPIELEN' : '▶ SPIELEN';
if (SAVE.money) $('saveInfo').textContent = `Spielstand: ${fmtEURc(SAVE.money)} Provision · Auftrag ${Math.min((SAVE.mission || 0) + 1, MISSIONS.length)}/${MISSIONS.length}`;
$('verLbl').textContent = 'Version ' + VERSION;
{ // HEKO-Logo im Titel
  const c = $('hekoTitle'), s = Math.min(3, DPR); c.width = 260 * s; c.height = 64 * s; const g = c.getContext('2d');
  drawHeko(g, 0, (c.height - c.width * HEKO_RATIO) / 2, c.width, '#ffffff', '#19c6ff');
}

populate();
onResize(true);
$('loading').classList.add('hidden'); $('btnPlay').disabled = false;
requestAnimationFrame(frame);

// ---------------------------------------------------------------- Test-/Debug-API
Object.assign(window.__mv, {
  player, vehicles, peds, pickups, world, cam, scene, camera, renderer, ctx: ctx, MISSIONS,
  start, enterExit, crime, setHour: h => { TOD.forced = h; TOD.envKey = ''; return updateTOD(scene, true) && window.__tod; },
  teleport: (x, z, h = 0) => { if (G.car) { G.car.x = x; G.car.z = z; G.car.h = h; G.car.vx = G.car.vz = 0; } placePlayer(x, z, h); cam.yaw = h; cam.init = false; },
  nearestEnterable, shops: world.shops, punch: () => { inp.punch = true; },
  W, INV, WEAP, giveWeapon, selectSlot, cycleWeapon, openWheel, closeWheel, fireWeapon, toggleLock, spawnPed, bloodPool, explode, damageVehicle, rangerAggro, AU, TL, AMB_SPOTS, openAmmu, closeAmmu, stepRangerz: () => { rangerCD = 0; rangerTick = 0; }, rangerPause: s => { rangerCD = s; }, setBlood: b => { BLOOD = b; }, blood: () => BLOOD,
  dbgParts: () => [PADD.list.length, PNORM.list.length, PADD.list.slice(0, 3).map(q => [+q.x.toFixed(1), +q.y.toFixed(1), +q.z.toFixed(1), +q.t.toFixed(2), q.life])],
  sim: (sec, dt = 1 / 30) => { for (let t = 0; t < sec; t += dt) { G.time += dt; step(dt); } },
  spawnVehicle, placeOnRoad, setAI, quality: k => applyQuality(k), fps: () => fpsShown, pr: () => pr,
  state: () => ({ mode: G.car ? 'car' : 'foot', car: G.car && G.car.kind, speed: G.car ? +(G.car.speed || 0).toFixed(2) : 0, wanted: G.wanted, money: G.money, contracts: G.contracts.length, health: G.health, cops: vehicles.filter(v => v.police && v.driver === 'cop').length, mission: G.mission, mstep: G.mstep, x: +player.x.toFixed(1), z: +player.z.toFixed(1), robT: ctx.robT, deadT: G.deadT }),
});
