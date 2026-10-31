// MAGENTA VICE – Open-World-Parodie im Telekommunikations-Vertrieb · von HEKO präsentiert
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { clamp, lerp, smooth, rng, pick, angDiff, canvas, tex, signTex, drawT, fitText, FONT, setAniso, fmtEUR, fmtEURc, radialTex, roundRect, drawHeko, HEKO_RATIO } from './util.js?v=20261031-1630';
import { world, buildWorld, buildSky, updateTOD, TOD, GRID, RHW, PED_OFF, LAND, ISLAND, CAUSE, BEACH_X, DEEP_X, BRANDS, circleHit, queryColliders, lineBlocked, surfaceY, isDeep, onLand, sky } from './world.js?v=20261031-1630';
import { makeVehicle, makeCharacter, poseCharacter, setDriver, VTYPES, paintMat, sharedMats, setDetail } from './models.js?v=20261031-1630';
import * as AU from './audio.js?v=20261031-1630';
import { TARIFFS, CATEGORIES } from './tarife.js?v=20261031-1630';

export const VERSION = '20261031-1630';
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
  hoch: { label: 'HOCH', maxPR: 2.5, minPR: 1.5, shadow: 4096, bloom: 1, samples: 4, shadowR: 80, ao: 1 },
  mittel: { label: 'MITTEL', maxPR: 2.0, minPR: 1.25, shadow: 2048, bloom: 1, samples: 4, shadowR: 65, ao: 0 },
  niedrig: { label: 'NIEDRIG', maxPR: 1.5, minPR: 0.75, shadow: 1024, bloom: 0, samples: 2, shadowR: 50, ao: 0 },
};
const isMobileUA = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const autoQ = () => isMobileUA ? 'mittel' : 'hoch';
let SAVE = loadSave();
let qSel = { ultra: 'hoch', spar: 'niedrig' }[PARAMS.get('q') || SAVE.quality] || PARAMS.get('q') || SAVE.quality || 'auto';
if (qSel !== 'auto' && !QUALITY[qSel]) qSel = 'auto';
let qKey = qSel === 'auto' ? autoQ() : qSel;
let Q = QUALITY[qKey];
const DPR = window.devicePixelRatio || 1;
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
  const w = innerWidth, h = innerHeight;
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
  composer.dispose?.(); setupComposer(); onResize();
}
function onResize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  composer.setPixelRatio(pr); composer.setSize(w, h);
  sizeMinimap(); document.body.classList.toggle('portrait', h > w);
}
addEventListener('resize', onResize);

// ---------------------------------------------------------------- Welt
const forcedHour = PARAMS.has('hour') ? clamp(parseFloat(PARAMS.get('hour')) || 0, 0, 24) : null;
TOD.forced = forcedHour;
setDetail(isMobile ? 0 : 1);
buildWorld(scene);
buildSky(scene, renderer, sunL, hemi, isMobile);
setupComposer();
updateTOD(scene, true);

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
  const ch = makeCharacter(kind, R);
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
    if (p.t > 4.2) { p.state = 'getup'; p.t = 0; if (p.stars) p.stars.visible = false; }
  } else if (p.state === 'getup') {
    p.fall = Math.max(0, p.fall - dt * 2);
    if (p.fall <= 0) { p.state = 'flee'; p.t = 0; p.flee = 8; p.hp = p.kind === 'ranger' ? 3 : 2; }
  } else {
    let tx, tz, spd = p.speed;
    if (p.state === 'flee') {
      p.flee -= dt; const dx = p.x - player.x, dz = p.z - player.z, l = Math.hypot(dx, dz) || 1;
      tx = p.x + dx / l * 5; tz = p.z + dz / l * 5; spd = 4.2;
      if (p.flee <= 0) { p.state = 'walk'; if (p.ring) p.u = ringNearest(p.ring, p.x, p.z); }
    } else if (p.state === 'talk') {
      p.talkT -= dt; spd = 0; tx = p.x + Math.sin(p.h); tz = p.z + Math.cos(p.h);
      if (p.talkT <= 0) p.state = 'walk';
    } else if (p.ring) {
      if (p.u == null) p.u = ringNearest(p.ring, p.x, p.z);
      p.u += p.dir * spd * dt;
      [tx, tz] = ringPoint(p.ring, p.u + p.dir * 1.5);
      // Rangerz bleiben an Haustüren stehen
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
      if (p.state === 'flee' || !p.ring) { p.x += Math.sin(p.h) * mv; p.z += Math.cos(p.h) * mv; }
      else { [p.x, p.z] = ringPoint(p.ring, p.u); }
    }
    p.phase += dt * spd * 4.2;
    p.cur = spd;
  }
  // Kollision mit Gebäuden
  if (circleHit(p.x, p.z, 0.35, _hit)) { p.x += _hit.x; p.z += _hit.z; if (p.state === 'flee' && R() < 0.05) p.h += 1.5; }
  if (p.x > DEEP_X - 8) p.x = DEEP_X - 8;
  p.y += (surfaceY(p.x, p.z) - p.y) * Math.min(1, dt * 10);
  if (near) {
    ch.root.visible = true;
    ch.root.position.set(p.x, p.y, p.z); ch.root.rotation.y = p.h;
    p.hitT = Math.max(0, p.hitT - dt);
    poseCharacter(ch, p.phase, p.state === 'talk' ? 0 : clamp((p.cur || 0) / 2.5, 0.4, 1.3), 0, p.fall, p.state === 'talk' ? p.t : 0);
    if (p.hitT > 0) ch.body.rotation.x = -0.4 * p.hitT / 0.3;
    else ch.body.rotation.x = 0;
  } else ch.root.visible = false;
}
function respawnPed(p) {
  // weit weg → neu in der Nähe des Spielers
  if (p.kind === 'ranger') { const rg = pick(R, world.resRings.filter(rg => Math.hypot((rg.x0 + rg.x1) / 2 - player.x, (rg.z0 + rg.z1) / 2 - player.z) < 260)) || pick(R, world.resRings); p.ring = rg; }
  else if (!p.beach) p.ring = pick(R, world.rings.filter(rg => { const d = Math.hypot((rg.x0 + rg.x1) / 2 - player.x, (rg.z0 + rg.z1) / 2 - player.z); return d > 70 && d < 200; })) || p.ring;
  if (p.ring) { p.u = R() * 200; [p.x, p.z] = ringPoint(p.ring, p.u); }
  p.state = 'walk'; p.fall = 0; p.hp = p.kind === 'ranger' ? 3 : 2; if (p.stars) p.stars.visible = false;
}

// ---------------------------------------------------------------- Spieler
const player = { x: 0, z: 0, y: 0, h: 0, vx: 0, vz: 0, ch: makeCharacter('player'), phase: 0, punchT: 0, punchCD: 0, fall: 0, downT: 0, sprint: false };
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
  if (e.code === 'KeyR') nextStation();
  if (e.code === 'KeyH') AU.sfx.horn();
  if (e.code === 'KeyM') { openPhone('map'); }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyE') inp.actHeld = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// Maus: Klick = Schlag, Ziehen/Pointer-Lock = Kamera
glCanvas.addEventListener('mousedown', e => {
  if (!G.started || G.paused || isTouch) return;
  if (document.pointerLockElement !== glCanvas && !TEST) { glCanvas.requestPointerLock?.(); }
  if (e.button === 0) inp.punch = true;
});
addEventListener('mousemove', e => { if (document.pointerLockElement === glCanvas) { inp.camDX += e.movementX; inp.camDY += e.movementY; inp.lastCam = G.time; } });
// Touch: virtueller Joystick links, Kamera-Wischen rechts
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, look = { id: null, x: 0, y: 0 };
const joyEl = $('joy'), joyKnob = $('joyKnob');
function onTouchStart(e) {
  if (!G.started || G.paused) return;
  for (const t of e.changedTouches) {
    if (t.target.closest && t.target.closest('.tbtn, #hudPhone, #phone, .chip')) continue;
    if (t.clientX < innerWidth * 0.42 && joy.id === null) { joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0; joyEl.style.left = t.clientX + 'px'; joyEl.style.top = t.clientY + 'px'; joyEl.classList.add('on'); }
    else if (look.id === null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; }
  }
  e.preventDefault();
}
function onTouchMove(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { const dx = t.clientX - joy.ox, dy = t.clientY - joy.oy, l = Math.hypot(dx, dy), m = 55, k = l > m ? m / l : 1; joy.x = dx * k / m; joy.y = dy * k / m; joyKnob.style.transform = `translate(${dx * k}px,${dy * k}px)`; }
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
holdBtn('bPunch', () => { if (G.car) inp.hb = true; else inp.punch = true; }, () => { inp.hb = false; });
holdBtn('bEnter', () => enterExit());
holdBtn('bSprint', () => { if (G.car) AU.sfx.horn(); else inp.sprint = true; }, () => { inp.sprint = false; });
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
    const sprint = keys.ShiftLeft || keys.ShiftRight || inp.sprint || (joy.id !== null && Math.hypot(joy.x, joy.y) > 0.98);
    const spd = (sprint ? 6.6 : 3.0) * Math.min(1, Math.hypot(mx, my) * 1.2);
    if (Math.hypot(mx, my) > 0.08) {
      // relativ zur Kamera
      const a = cam.yaw, fx = Math.sin(a), fz = Math.cos(a), rx = -fz, rz = fx;
      const dx = fx * -my + rx * mx, dz = fz * -my + rz * mx, l = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz); P.h += angDiff(P.h, want) * Math.min(1, dt * 12);
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
  if (inp.punch && P.punchCD <= 0 && P.downT <= 0) { P.punchT = 0.32; P.punchCD = 0.42; doPunch(); }
  inp.punch = false;
  ch.root.position.set(P.x, P.y, P.z); ch.root.rotation.y = P.h;
  poseCharacter(ch, P.phase, clamp((P.curSpeed || 0) / 3, 0, 1.4), P.punchT > 0 ? 1 - P.punchT / 0.32 : 0, P.fall);
}
function doPunch() {
  AU.sfx.whoosh(); G.stats.punches++;
  const fx = Math.sin(player.h), fz = Math.cos(player.h);
  let best = null, bd = 2.3;
  for (const p of peds) {
    if (p.state === 'down' || p.state === 'getup') continue;
    const dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz);
    if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.35) { best = p; bd = d; }
  }
  if (!best) return;
  setTimeout(() => AU.sfx.punch(), 90);
  best.hp--; best.hitT = 0.3; best.h = Math.atan2(-fx, -fz);
  { const dx = best.x - player.x, dz = best.z - player.z, d = Math.hypot(dx, dz) || 1; player.h = Math.atan2(dx, dz); if (d > 1.0) { player.x += dx / d * Math.min(0.5, d - 1.0); player.z += dz / d * Math.min(0.5, d - 1.0); } best.x += dx / d * 0.18; best.z += dz / d * 0.18; }
  shake(0.15);
  if (best.kind === 'ranger') label(best, pick(R, ['Aua! Mein Klemmbrett!', 'Hey! Ich mach nur meinen Job!', 'Das melde ich meinem Teamleiter!', 'Wollen Sie nicht doch unterschreiben?']), 1.6, 'bubble');
  else label(best, pick(R, ['Aua!', 'Hey!', 'Spinnst du?!', 'Hilfe!']), 1.2, 'bubble');
  if (best.hp <= 0) {
    knockDown(best, player.x, player.z, 5); AU.sfx.boing();
    if (best.kind === 'ranger') {
      G.stats.rangers++; G.mstate.rangers = (G.mstate.rangers || 0) + 1;
      dropPickup('clipboard', best.x - fx * 0.2 + fz * 0.9, best.z - fz * 0.2 - fx * 0.9, 2 + Math.floor(R() * 3));
      dropPickup('cash', best.x - fx * 0.2 - fz * 0.9, best.z - fz * 0.2 + fx * 0.9, Math.round(rand(20, 80)) * 100);
      popup(best, 'RANGERZ AUSGEKNOCKT!', 'warn');
    } else if (R() < 0.6) dropPickup('cash', best.x + fx, best.z + fz, Math.round(rand(5, 35)) * 100);
    if (policeNear(player.x, player.z, 60)) crime(1, 'Körperverletzung');
  } else if (best.kind !== 'ranger' && R() < 0.5) { best.state = 'flee'; best.flee = 6; }
  // Umstehende fliehen
  for (const p of peds) if (p !== best && p.state === 'walk' && Math.hypot(p.x - player.x, p.z - player.z) < 14 && R() < 0.7) { p.state = 'flee'; p.flee = 5; }
}
function hurt(n) {
  if (G.deadT > 0) return;
  G.health = Math.max(0, G.health - n); flash('hurt');
  if (G.health <= 0) wasted();
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
    const p = spawnPed(v.police ? 'civ' : 'civ', v.x + lx * (v.T.wid / 2 + 0.8), v.z + lz * (v.T.wid / 2 + 0.8), null);
    p.beach = false; p.ring = null; p.state = 'flee'; p.flee = 10; p.temp = 30;
    label(p, pick(R, ['Mein Auto!', 'Hey! Das ist meins!', 'Hilfe, Autodieb!', 'Ich ruf die Polizei!']), 2, 'bubble');
    G.stats.stolen++;
    if (v.police) crime(2, 'Polizeiauto gestohlen', true);
    else if (policeNear(v.x, v.z, 70)) crime(1, 'Autodiebstahl');
  } else G.stats.stolen += 0;
  v.ai = null; v.driver = 'player'; setDriver(v.m, 'player');
  G.car = v; G.mode = 'car'; v.hb = false; v.dead = v.hp <= 0;
  player.ch.root.visible = false;
  AU.sfx.door(); AU.radioOn(true); showStation();
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
  } else if (kind === 'health') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 16), new THREE.MeshStandardMaterial({ color: 0xE20074, metalness: 0.7, roughness: 0.25, emissive: 0x500028 })); m.position.y = 0.8; grp.add(m);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: kind === 'cash' ? new THREE.Color(0.5, 2.2, 0.8) : kind === 'health' ? new THREE.Color(2.5, 0.6, 1.4) : new THREE.Color(2.6, 0.2, 1.3), transparent: true, opacity: 0.85, depthWrite: false }));
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
    const reach = G.car ? 2.8 : 1.3;
    if (d < reach && G.deadT <= 0 && !(p.kind === 'health' && G.health >= 100)) {
      if (p.kind === 'contract') addContracts(1, 'Glasfaser-Vertrag');
      else if (p.kind === 'clipboard') { addContracts(p.n, 'Rangerz-Klemmbrett'); G.mstate.clipboards = (G.mstate.clipboards || 0) + 1; }
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
    { txt: () => `In den Wohnvierteln laufen Rangerz-Drücker herum (gelbe Weste). Hau 2 um und schnapp dir ihre Klemmbretter (${Math.min(2, G.mstate.clipboards || 0)}/2).`, done: () => (G.mstate.clipboards || 0) >= 2, target: () => nearestOf(peds.filter(p => p.kind === 'ranger' && p.state !== 'down').concat(pickups.filter(p => p.kind === 'clipboard'))) } ] },
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
    if (vis) L.el.style.transform = `translate(-50%,-100%) translate(${(_v3.x * 0.5 + 0.5) * innerWidth}px,${(-_v3.y * 0.5 + 0.5) * innerHeight}px)`;
    L.el.style.opacity = Math.min(1, L.t * 3);
  }
  // Rangerz-Namensschilder in der Nähe
  for (const p of peds) {
    if (p.kind !== 'ranger' || p.state === 'down') continue;
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (d < 22 && !labels.find(l => l.obj === p && l.cls === 'tag')) label(p, 'RANGERZ', 0.6, 'tag');
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
  $('bPunch').textContent = G.car ? '⛔' : '👊'; $('bPunch').title = G.car ? 'Handbremse' : 'Schlagen';
  $('bSprint').textContent = G.car ? '📯' : '🏃';
  $('carHud').classList.toggle('on', !!G.car);
}
function showStation() { const s = AU.STATIONS[AU.A.station]; const el = $('radio'); el.innerHTML = `<b>📻 ${s.name}</b><span>${s.sub}</span>`; el.classList.add('on'); clearTimeout(showStation.t); showStation.t = setTimeout(() => el.classList.remove('on'), 2600); }
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
    $('statList').innerHTML = [['Provision gesamt', fmtEURc(S.earned)], ['Kontostand', fmtEURc(G.money)], ['Verträge abgegeben', S.delivered], ['Verträge dabei', G.contracts.length], ['Shops ausgeraubt', S.robbed], ['Rangerz umgehauen', S.rangers], ['Autos geklaut', S.stolen], ['Polizei abgehängt', S.escapes], ['Schläge', S.punches]].map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
  }
  if (page === 'radio') $('stationList').innerHTML = AU.STATIONS.map((s, i) => `<button class="pbtn ${i === AU.A.station ? 'sel' : ''}" data-st="${i}"><b>${s.name}</b><span>${s.sub}</span></button>`).join('');
  if (page === 'settings') { for (const b of document.querySelectorAll('[data-q]')) b.classList.toggle('sel', b.dataset.q === qSel); $('btnMute').textContent = AU.A.on ? '🔊 Ton: AN' : '🔇 Ton: AUS'; $('prInfo').textContent = `Auflösung: ${Math.round(innerWidth * pr)}×${Math.round(innerHeight * pr)} px (${pr.toFixed(2)}×)`; }
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
  const mix = ['sedan', 'sedan', 'taxi', 'tkvan', 'tktruck', 'sport', 'pickup', 'rivalvan', 'sedan', 'taxi', 'tkvan', 'sport', 'sedan', 'tktruck', 'pickup', 'sedan', 'rivalvan', 'taxi', 'sedan', 'tkvan', 'sport', 'sedan'];
  const nTraffic = isMobile ? 18 : 22;
  for (let k = 0; k < nTraffic; k++) { const v = spawnVehicle(mix[k % mix.length], 0, 0, 0, { driver: 'ai' }); v.driver = 'ai'; setDriver(v.m, 'civ'); if (!placeOnRoad(v, player.x, player.z, 25, 230, 'traffic', false)) removeVehicle(v); }
  // Geparkte Autos (u. a. Magenta GT direkt beim Start)
  const park = [['sport', 244.6, SPAWN.z - 9, Math.PI, 0], ['tkvan', 244.6, SPAWN.z + 14, Math.PI, 0], ['sedan', 80 + 8.5, 40, 0, 2], ['sport', 240 + 9, -60, Math.PI, 2], ['tktruck', -80 + 9, -120, 0, 0], ['taxi', 160 - 8.5, 120, Math.PI, 0], ['sport', -594 + 6, 30, Math.PI / 2, 5], ['pickup', 0 - 8.5, -200, 0, 0], ['sedan', -160 + 9, 200, Math.PI, 3], ['sport', 249, 150, 0, 1]];
  for (const [kind, x, z, h, c] of park) { const v = spawnVehicle(kind, x, z, h, { color: c }); v.parked = true; }
  // Fußgänger
  const nPed = isMobile ? 22 : 30;
  const nearRings = world.rings.filter(rg => rg.kind !== 'R');
  for (let k = 0; k < nPed; k++) { const rg = pick(R, nearRings), u = R() * 240, [x, z] = ringPoint(rg, u); const p = spawnPed('civ', x, z, rg); p.u = u; }
  for (let k = 0; k < 10; k++) { const [x, z] = pick(R, world.beachSpots); spawnPed('tourist', x + 2, z + 3, null); }
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
  if (TEST) { // Headless-Tests: Simulation in Echtzeit auch bei wenigen fps
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
      if (v.driver === 'ai' && (d > 280 || v.sinking > 3 || (v.dead && d > 60 && !inView(v.x, v.z)))) { if (!inView(v.x, v.z, 4) || d > 400) placeOnRoad(v, px, pz, 70, 230); }
      else if (v.driver === 'none' && !v.parked && (d > 300 || v.sinking > 3)) { if (!inView(v.x, v.z, 4)) { v.driver = 'ai'; setDriver(v.m, 'civ'); placeOnRoad(v, px, pz, 90, 230); } }
      else if (v.sinking > 4 && v.parked) { v.parked = false; v.driver = 'ai'; setDriver(v.m, 'civ'); placeOnRoad(v, px, pz, 90, 230); }
    }
    for (let k = peds.length - 1; k >= 0; k--) {
      const p = peds[k], d = Math.hypot(p.x - px, p.z - pz);
      if (p.temp != null) { p.temp -= 0.5; if (p.temp <= 0 && (d > 40 || !inView(p.x, p.z))) { scene.remove(p.ch.root); if (p.stars) scene.remove(p.stars); peds.splice(k, 1); } continue; }
      if (d > 230 && !p.beach) respawnPed(p);
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
  AU.ambience(clamp(1 - Math.abs(px - 320) / 120, 0, 1));
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
  for (const v of vehicles) { const lit = TOD.lampF > 0.05; v.m.beam.visible = lit && distToCam(v) < 120; }
  sharedMats().beam.opacity = TOD.lampF * lerp(0.5, 0.18, TOD.dayF);
  renderer.info.reset();
  composer.render();
  updateLabels(dt);
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
onResize();
$('loading').classList.add('hidden'); $('btnPlay').disabled = false;
requestAnimationFrame(frame);

// ---------------------------------------------------------------- Test-/Debug-API
Object.assign(window.__mv, {
  player, vehicles, peds, pickups, world, cam, scene, camera, renderer, ctx: ctx, MISSIONS,
  start, enterExit, crime, setHour: h => { TOD.forced = h; TOD.envKey = ''; return updateTOD(scene, true) && window.__tod; },
  teleport: (x, z, h = 0) => { if (G.car) { G.car.x = x; G.car.z = z; G.car.h = h; G.car.vx = G.car.vz = 0; } placePlayer(x, z, h); cam.yaw = h; cam.init = false; },
  nearestEnterable, shops: world.shops, punch: () => { inp.punch = true; },
  spawnVehicle, placeOnRoad, setAI, quality: k => applyQuality(k), fps: () => fpsShown, pr: () => pr,
  state: () => ({ mode: G.car ? 'car' : 'foot', car: G.car && G.car.kind, speed: G.car ? +(G.car.speed || 0).toFixed(2) : 0, wanted: G.wanted, money: G.money, contracts: G.contracts.length, health: G.health, cops: vehicles.filter(v => v.police && v.driver === 'cop').length, mission: G.mission, mstep: G.mstep, x: +player.x.toFixed(1), z: +player.z.toFixed(1), robT: ctx.robT, deadT: G.deadT }),
});
