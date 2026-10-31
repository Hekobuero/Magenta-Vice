// Magenta Vice – Stadt, Strand, Wasser, Himmel & Tageszeit
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { clamp, lerp, smooth, rng, pick, canvas, tex, roundRect, drawHeko, drawT, fitText, FONT, HEKO_RATIO,
  roadTex, crossTex, sidewalkTex, barkTex, grassTex, sandTex, waterNormalTex, radialTex, windowTex, signTex, noiseCanvas } from './util.js?v=20261031-1730';

export const GRID = [-240, -160, -80, 0, 80, 160, 240];
export const RHW = 6;            // halbe Fahrbahnbreite
export const SWO = 10;           // Grundstückskante (Fahrbahnmitte + 10 m)
export const PED_OFF = 8;        // Gehweg-Mitte
export const LAND = { x0: -280, x1: 322, z0: -280, z1: 280 };
export const ISLAND = { x0: -730, x1: -556, z0: -90, z1: 90 };
export const CAUSE = { x0: -556, x1: -280, hw: 7.5 };
export const BEACH_X = 254, SHORE_X = 322, DEEP_X = 345;

// Bezirke [j][i] (j = Nord→Süd, i = West→Ost)
const DIST = [
  'RRRPDD',
  'HHRRDD',
  'HHSPDD',
  'HHSHDD',
  'RHRRDD',
  'RRRPDD',
];
export const BRANDS = {
  telekom: { name: 'Telekom Shop', short: 'Telekom', bg: '#E20074', fg: '#ffffff', map: '#ff3fa0' },
  vodafohn: { name: 'Vodafohn', short: 'Vodafohn', bg: '#d40000', fg: '#ffffff', map: '#ff3030' },
  o0: { name: 'O₀ Zwei', short: 'O₀ Zwei', bg: '#0a2a9c', fg: '#ffffff', map: '#4f7cff' },
  eins: { name: '1&Eins', short: '1&Eins', bg: '#0a4fb4', fg: '#ffffff', map: '#3fa9ff' },
  kongstar: { name: 'Kongstar', short: 'Kongstar', bg: '#2a1f3d', fg: '#ffd400', map: '#ffd400' },
};
const HOTEL_NAMES = ['HOTEL MAGENTA', 'THE GLASFASER', 'COLONY 5G', 'NETZWERK INN', 'HOTEL HOTSPOT', 'OCEAN FIBER', 'THE ROUTER', 'CARDOZO CLOUD', 'BANDBREITE', 'LTE BEACH', 'SURF & ROUTER', 'MAGENTA PALMS', 'HOTEL FUNKMAST', 'THE TARIF', 'PING PALACE', 'THE UPLINK', 'GIGABIT GRAND', 'HOTEL ROAMING', 'BREAKPOINT', 'THE WLAN'];
const PASTELS = [0xf7c6d9, 0xbfeee0, 0xffd9b8, 0xd9cdf7, 0xbfe3ff, 0xfff1c2, 0xffffff, 0xf9d0e8, 0xc9f2d4, 0xffc7b0];
const NEON = [0xff2a9d, 0x19e6ff, 0xa24bff, 0x3dffb5, 0xff7a2a, 0xff2a9d, 0x19e6ff];

export const world = {
  colliders: [], hash: new Map(), nodes: [], edges: [], rings: [], beachSpots: [], shops: [], pois: {}, roadsMap: [], bldMap: [],
  contractSpots: [], parkSpots: [], resRings: [], mats: {}, signMats: [], neonMat: null, glassMat: null, decoMat: null, lampPool: null, water: null,
};
const CELL = 16;
function addCollider(x0, x1, z0, z1, h = 10, kind = 'b') {
  const c = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), h, kind };
  const id = world.colliders.push(c) - 1;
  for (let cx = Math.floor(c.x0 / CELL); cx <= Math.floor(c.x1 / CELL); cx++) for (let cz = Math.floor(c.z0 / CELL); cz <= Math.floor(c.z1 / CELL); cz++) {
    const k = cx * 10007 + cz; let a = world.hash.get(k); if (!a) world.hash.set(k, a = []); a.push(id);
  }
  return c;
}
const _q = [], _seen = new Set();
export function queryColliders(x, z, r) {
  _q.length = 0; _seen.clear();
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
    const a = world.hash.get(cx * 10007 + cz); if (!a) continue;
    for (const id of a) if (!_seen.has(id)) { _seen.add(id); _q.push(world.colliders[id]); }
  }
  return _q;
}
// Kreis vs. AABBs → Push-Vektor (oder null)
export function circleHit(x, z, r, out) {
  let hit = false; out.x = 0; out.z = 0; out.n = 0;
  for (const c of queryColliders(x + out.x, z + out.z, r)) {
    const px = x + out.x, pz = z + out.z;
    const qx = clamp(px, c.x0, c.x1), qz = clamp(pz, c.z0, c.z1);
    let dx = px - qx, dz = pz - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    let nx, nz, pen;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
    else { // Mittelpunkt innen
      const l = px - c.x0, rr = c.x1 - px, t = pz - c.z0, b = c.z1 - pz, m = Math.min(l, rr, t, b);
      if (m === l) { nx = -1; nz = 0; } else if (m === rr) { nx = 1; nz = 0; } else if (m === t) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
      pen = m + r;
    }
    out.x += nx * pen; out.z += nz * pen; out.nx = nx; out.nz = nz; hit = true; out.n++;
  }
  if (hit) { const l = Math.hypot(out.x, out.z) || 1; out.nx = out.x / l; out.nz = out.z / l; }
  return hit;
}
// Sichtlinie (Gebäude) – Strahl gegen AABBs, in 4-m-Schritten über das Hash
export function lineBlocked(ax, az, bx, bz, minH = 3) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), n = Math.ceil(L / 4);
  for (let k = 1; k < n; k++) {
    const x = ax + dx * k / n, z = az + dz * k / n;
    for (const c of queryColliders(x, z, 0.1)) if (c.h >= minH && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return true;
  }
  return false;
}
export function onLand(x, z) {
  if (x >= LAND.x0 && x <= SHORE_X + 14 && z >= LAND.z0 && z <= LAND.z1) return true;
  if (x >= ISLAND.x0 && x <= ISLAND.x1 && z >= ISLAND.z0 && z <= ISLAND.z1) return true;
  if (x >= CAUSE.x0 - 2 && x <= CAUSE.x1 + 2 && Math.abs(z) <= CAUSE.hw) return true;
  return false;
}
export function groundY(x, z) {
  if (x > SHORE_X - 10 && x < DEEP_X + 40 && z > LAND.z0 && z < LAND.z1) return lerp(0.1, -2.6, smooth(SHORE_X - 10, DEEP_X + 6, x));
  return 0;
}
export function onRoad(x, z) {
  if (x >= CAUSE.x0 - 2 && x <= GRID[0] && Math.abs(z) <= RHW) return true;
  if (x < LAND.x0 - 1) return x >= ISLAND.x0 && x <= ISLAND.x1 && z >= ISLAND.z0 && z <= ISLAND.z1;
  if (x > GRID[6] + RHW || z < GRID[0] - RHW || z > GRID[6] + RHW || x < GRID[0] - RHW) return false;
  for (const g of GRID) { if (Math.abs(x - g) < RHW || Math.abs(z - g) < RHW) return true; }
  return false;
}
export function surfaceY(x, z) {
  if (x > BEACH_X) return groundY(x, z);
  if (onRoad(x, z)) return 0;
  return 0.14;
}
export function isDeep(x, z) { return !onLand(x, z) || (x > DEEP_X - 4 && z > LAND.z0 - 1 && z < LAND.z1 + 1); }

// ---------------- Batching ----------------
class Batch {
  constructor(chunk = 120) { this.buckets = new Map(); this.chunk = chunk; }
  add(geo, m, color) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    const n = g.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(color ?? 0xffffff);
    for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    g.computeBoundingBox(); const bb = g.boundingBox;
    const big = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) > this.chunk;
    const key = big ? 'big' : Math.floor((bb.min.x + bb.max.x) / 2 / this.chunk) + ',' + Math.floor((bb.min.z + bb.max.z) / 2 / this.chunk);
    let a = this.buckets.get(key); if (!a) this.buckets.set(key, a = []); a.push(g);
  }
  mesh(mat, shadow = true) {
    if (!this.buckets.size) return null;
    const grp = new THREE.Group();
    for (const geos of this.buckets.values()) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = shadow; m.receiveShadow = true;
      m.matrixAutoUpdate = false; m.updateMatrix(); grp.add(m);
    }
    grp.material = mat; return grp;
  }
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();
function mat(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) { return M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), S.set(sx, sy, sz)).clone(); }
// Box mit Fassaden-UVs (Kachel = 1 Fensterachse × 1 Geschoss; Textur hat 8×8 Kacheln)
function facadeBox(w, h, d, axis, floor, ou = 0, ov = 0) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const faces = [[d, h], [d, h], null, null, [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (!faces[f]) { uv.setXY(i, 0.003, 0.997); continue; }
    const [fw, fh] = faces[f];
    uv.setXY(i, ou + uv.getX(i) * Math.max(1, Math.round(fw / axis)) / 8, ov + uv.getY(i) * Math.max(1, Math.round(fh / floor)) / 8);
  }
  return g;
}
function prism(w, h, d) { // Satteldach (First entlang x)
  const g = new THREE.BufferGeometry(), hw = w / 2, hd = d / 2;
  const p = [-hw, 0, -hd, hw, 0, -hd, hw, h, 0, -hw, 0, -hd, hw, h, 0, -hw, h, 0,
    hw, 0, hd, -hw, 0, hd, -hw, h, 0, hw, 0, hd, -hw, h, 0, hw, h, 0,
    -hw, 0, hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, hw, 0, hd, hw, h, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
}

// ---------------- Beschilderung ----------------
function brandMark(g, key, x, y, s) {
  const B = BRANDS[key];
  if (key === 'telekom') drawT(g, x, y, s, '#fff');
  else if (key === 'vodafohn') { g.fillStyle = '#fff'; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.44, 0, 7); g.fill(); g.fillStyle = B.bg; g.font = `900 ${s * 0.62}px ${FONT}`; g.textAlign = 'center'; g.fillText('V', x + s / 2, y + s * 0.54); }
  else if (key === 'o0') { g.strokeStyle = '#fff'; g.lineWidth = s * 0.07; for (const [cx, cy, r] of [[0.38, 0.55, 0.28], [0.72, 0.3, 0.14], [0.8, 0.68, 0.09]]) { g.beginPath(); g.arc(x + s * cx, y + s * cy, s * r, 0, 7); g.stroke(); } }
  else if (key === 'eins') { g.fillStyle = '#fff'; roundRect(g, x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, s * 0.16); g.fill(); g.fillStyle = B.bg; g.font = `900 ${s * 0.5}px ${FONT}`; g.textAlign = 'center'; g.fillText('1&1', x + s / 2, y + s * 0.53); }
  else if (key === 'kongstar') { g.fillStyle = B.fg; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? s * 0.2 : s * 0.46; g.lineTo(x + s / 2 + Math.cos(a) * r, y + s / 2 + Math.sin(a) * r); } g.closePath(); g.fill(); }
}
function shopSignTex(key) {
  const B = BRANDS[key];
  return signTex((g, w, h) => {
    g.fillStyle = B.bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 0, w, h * 0.08);
    brandMark(g, key, h * 0.14, h * 0.14, h * 0.72);
    g.textAlign = 'left'; fitText(g, B.name, h * 1.02, h * 0.53, w - h * 1.15, h * 0.52, 900, B.fg);
  }, 1024, 192);
}
function billboardTex(i) {
  const ads = [
    g => { bgGrad(g, '#E20074', '#7a0040'); drawT(g, 40, 50, 160, '#fff'); txt(g, 'GLASFASER', 230, 105, 760, 112, 900, '#fff'); txt(g, 'Lichtgeschwindigkeit fürs Zuhause', 232, 205, 760, 46, 700, '#ffd6ea'); txt(g, 'highspeedvorort.de', 232, 270, 760, 40, 800, '#fff'); },
    g => { bgGrad(g, '#141032', '#3a0a5a'); txt(g, '5G', 50, 150, 300, 220, 900, '#ff2a9d'); txt(g, 'Überall. Sogar am Strand.', 360, 120, 620, 64, 900, '#fff'); txt(g, 'Das beste Netz – Telekom', 362, 210, 620, 42, 700, '#19e6ff'); drawT(g, 880, 230, 90, '#fff', '#E20074'); },
    g => { bgGrad(g, '#0d0d18', '#E20074'); txt(g, 'MagentaTV', 50, 110, 900, 120, 900, '#fff'); txt(g, 'Serien bis zum Sonnenaufgang', 52, 220, 900, 54, 700, '#ffe3f1'); },
    g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 1024, 320); drawHeko(g, 50, 70, 520); g.fillStyle = '#E20074'; g.fillRect(0, 270, 1024, 50); txt(g, 'HEKO Büroservice', 610, 110, 390, 52, 900, '#262455'); txt(g, 'Ihr Vertriebspartner', 610, 175, 390, 40, 700, '#009fe3'); txt(g, 'präsentiert: MAGENTA VICE', 30, 296, 960, 32, 800, '#fff'); },
    g => { bgGrad(g, '#d40000', '#7a0000'); txt(g, 'Vodafohn', 50, 110, 900, 120, 900, '#fff'); txt(g, 'Wir haben Netz. Manchmal.', 52, 225, 900, 58, 700, '#ffdede'); },
    g => { bgGrad(g, '#0a2a9c', '#04104a'); txt(g, 'O₀ Zwei', 50, 110, 900, 120, 900, '#fff'); txt(g, 'Funkloch? Wir nennen es Pause.', 52, 225, 900, 54, 700, '#bcd0ff'); },
    g => { bgGrad(g, '#0a4fb4', '#062a66'); txt(g, '1&Eins', 50, 110, 900, 120, 900, '#fff'); txt(g, 'Warteschleife inklusive.', 52, 225, 900, 58, 700, '#d5e8ff'); },
    g => { bgGrad(g, '#2a1f3d', '#120a1e'); txt(g, 'KONGSTAR', 50, 110, 900, 120, 900, '#ffd400'); txt(g, 'Billig. Und so.', 52, 225, 900, 58, 700, '#fff'); },
    g => { bgGrad(g, '#ff7a2a', '#E20074'); txt(g, 'highspeedvorort.de', 50, 120, 940, 104, 900, '#fff'); txt(g, 'Glasfaser vor Ort – jetzt prüfen!', 52, 230, 940, 52, 700, '#fff'); },
    g => { bgGrad(g, '#05343f', '#0a6d7a'); txt(g, 'MagentaZuhause', 50, 110, 940, 104, 900, '#fff'); txt(g, 'WLAN bis ans Meer', 52, 225, 940, 58, 700, '#bff7ff'); drawT(g, 880, 210, 90, '#fff', '#E20074'); },
  ];
  function bgGrad(g, a, b) { const gr = g.createLinearGradient(0, 0, 1024, 320); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 1024, 320); }
  function txt(g, s, x, y, mw, size, wt, col) { g.textAlign = 'left'; fitText(g, s, x, y, mw, size, wt, col); }
  return signTex((g) => ads[i % ads.length](g), 1024, 320);
}
function neonTextTex(text, color) {
  return signTex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = `italic 900 ${h * 0.62}px ${FONT}`;
    const tw = g.measureText(text).width, sc = Math.min(1, (w * 0.94) / tw);
    g.save(); g.translate(w / 2, h / 2); g.scale(sc, 1);
    g.shadowColor = color; g.shadowBlur = h * 0.18; g.fillStyle = color; g.fillText(text, 0, 0);
    g.shadowBlur = h * 0.05; g.fillStyle = '#fff'; g.fillText(text, 0, 0); g.restore();
  }, 1024, 160);
}

// ---------------- Aufbau ----------------
export function buildWorld(scene, Q_) {
  const r = rng(20261031);
  const root = new THREE.Group(); scene.add(root);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  // Materialien
  const RT = roadTex(), CT = crossTex(), SWT = sidewalkTex(), GT = grassTex(), ST = sandTex();
  const roadM = std({ map: RT.map, normalMap: RT.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.86 });
  const crossM = std({ map: CT.map, normalMap: CT.normalMap, roughness: 0.86 });
  const swM = std({ map: SWT.map, normalMap: SWT.normalMap, roughness: 0.9, vertexColors: true });
  GT.map.repeat.set(10, 10); const grassM = std({ map: GT.map, roughness: 1 });
  const sandM = std({ map: ST.map, normalMap: ST.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.95 });
  world.roadMats = [roadM, crossM];
  const glassW = windowTex('glass', 3), decoW = windowTex('plaster', 5);
  const glassM = std({ map: glassW.map, emissiveMap: glassW.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, roughnessMap: glassW.orm, metalnessMap: glassW.orm, roughness: 1, metalness: 1, normalMap: glassW.normalMap, envMapIntensity: 1.3 });
  const decoM = std({ map: decoW.map, emissiveMap: decoW.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, roughnessMap: decoW.orm, metalnessMap: decoW.orm, roughness: 1, metalness: 1, normalMap: decoW.normalMap, normalScale: new THREE.Vector2(1.2, 1.2) });
  const plainM = std({ vertexColors: true, roughness: 0.8 });
  const neonM = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.5, 1.5, 1.5) });
  world.glassMat = glassM; world.decoMat = decoM; world.neonMat = neonM;
  const B = { road: new Batch(), cross: new Batch(), sw: new Batch(), grass: new Batch(), glass: new Batch(), deco: new Batch(), plain: new Batch(), neon: new Batch(), sand: new Batch() };
  const palms = [], lamps = [], signs = [];

  // ---- Boden: Grundfläche Land
  B.plain.add(new THREE.BoxGeometry(LAND.x1 - LAND.x0 - (LAND.x1 - BEACH_X), 1, LAND.z1 - LAND.z0), mat((LAND.x0 + BEACH_X) / 2, -0.52, 0), 0x7a7468);
  // Strand (Sand fällt ins Meer ab)
  {
    const g = new THREE.PlaneGeometry(DEEP_X + 60 - BEACH_X, LAND.z1 - LAND.z0 + 40, 48, 8).rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k) + (DEEP_X + 60 + BEACH_X) / 2, z = p.getZ(k); p.setY(k, groundY(x, z) + 0.02); uv.setXY(k, x / 9, z / 9); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, sandM); m.position.x = (DEEP_X + 60 + BEACH_X) / 2; m.receiveShadow = true; root.add(m);
  }
  // Insel-Grund
  B.plain.add(new THREE.BoxGeometry(ISLAND.x1 - ISLAND.x0, 2, ISLAND.z1 - ISLAND.z0), mat((ISLAND.x0 + ISLAND.x1) / 2, -1.02, 0), 0x7a7468);
  // Ufermauern
  const wallC = 0xd8d2c4;
  const wall = (x0, x1, z0, z1) => { B.plain.add(new THREE.BoxGeometry(x1 - x0, 2.6, z1 - z0), mat((x0 + x1) / 2, -0.8, (z0 + z1) / 2), wallC); addCollider(x0, x1, z0, z1, 1, 'wall'); };
  wall(LAND.x0 - 1, BEACH_X, LAND.z0 - 1, LAND.z0); wall(LAND.x0 - 1, BEACH_X, LAND.z1, LAND.z1 + 1);
  wall(LAND.x0 - 1, LAND.x0, LAND.z0, -CAUSE.hw); wall(LAND.x0 - 1, LAND.x0, CAUSE.hw, LAND.z1);
  wall(ISLAND.x0 - 1, ISLAND.x1 + 1, ISLAND.z0 - 1, ISLAND.z0); wall(ISLAND.x0 - 1, ISLAND.x1 + 1, ISLAND.z1, ISLAND.z1 + 1);
  wall(ISLAND.x0 - 1, ISLAND.x0, ISLAND.z0, ISLAND.z1); wall(ISLAND.x1, ISLAND.x1 + 1, ISLAND.z0, -CAUSE.hw); wall(ISLAND.x1, ISLAND.x1 + 1, CAUSE.hw, ISLAND.z1);
  // Strand-Seitenbegrenzung (Wellenbrecher)
  for (const z of [LAND.z0 - 1, LAND.z1]) { B.plain.add(new THREE.BoxGeometry(DEEP_X + 20 - BEACH_X, 2.2, 1.6), mat((DEEP_X + 20 + BEACH_X) / 2, 0.1, z + 0.5), 0x8a8478); addCollider(BEACH_X, DEEP_X + 20, z, z + 1, 1, 'wall'); }

  // ---- Straßennetz (Graph)
  const N = world.nodes, Eg = world.edges;
  const nodeAt = (x, z) => { let n = N.find(n => n.x === x && n.z === z); if (!n) { n = { id: N.length, x, z, nb: [] }; N.push(n); } return n; };
  const link = (a, b) => { a.nb.push(b.id); b.nb.push(a.id); Eg.push([a.id, b.id]); };
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) nodeAt(GRID[i], GRID[j]);
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { if (i < 6) link(nodeAt(GRID[i], GRID[j]), nodeAt(GRID[i + 1], GRID[j])); if (j < 6) link(nodeAt(GRID[i], GRID[j]), nodeAt(GRID[i], GRID[j + 1])); }
  const iA = nodeAt(-580, -60), iB = nodeAt(-580, 0), iC = nodeAt(-580, 60), iD = nodeAt(-706, 60), iE = nodeAt(-706, -60);
  link(nodeAt(-240, 0), iB); link(iA, iB); link(iB, iC); link(iC, iD); link(iD, iE); link(iE, iA);
  // Fahrbahnen rendern
  for (const [a, b] of Eg) {
    const A = N[a], Bn = N[b], dx = Bn.x - A.x, dz = Bn.z - A.z, L = Math.hypot(dx, dz), len = L - 2 * RHW;
    const g = new THREE.PlaneGeometry(2 * RHW, len).rotateX(-Math.PI / 2), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * len / 12);
    const ry = Math.atan2(dx, dz);
    B.road.add(g, mat((A.x + Bn.x) / 2, 0.02, (A.z + Bn.z) / 2, ry));
    world.roadsMap.push([A.x, A.z, Bn.x, Bn.z]);
  }
  for (const n of N) B.cross.add(new THREE.PlaneGeometry(2 * RHW, 2 * RHW).rotateX(-Math.PI / 2), mat(n.x, 0.021, n.z));
  // Damm/Brücke über die Bucht
  {
    const len = CAUSE.x1 - CAUSE.x0;
    B.plain.add(new THREE.BoxGeometry(len, 1.2, 2 * CAUSE.hw), mat((CAUSE.x0 + CAUSE.x1) / 2, -0.6, 0), 0x9a958c);
    for (const s of [-1, 1]) {
      B.plain.add(new THREE.BoxGeometry(len, 0.9, 0.5), mat((CAUSE.x0 + CAUSE.x1) / 2, 0.45, s * (CAUSE.hw - 0.25)), 0xf2efe8);
      B.neon.add(new THREE.BoxGeometry(len, 0.08, 0.08), mat((CAUSE.x0 + CAUSE.x1) / 2, 0.92, s * (CAUSE.hw - 0.25)), 0xff2a9d);
      addCollider(CAUSE.x0, CAUSE.x1, s > 0 ? CAUSE.hw - 0.5 : -CAUSE.hw, s > 0 ? CAUSE.hw : -CAUSE.hw + 0.5, 1, 'wall');
    }
    for (let x = CAUSE.x0 + 10; x < CAUSE.x1; x += 22) B.plain.add(new THREE.BoxGeometry(3, 6, 10), mat(x, -3.6, 0), 0x8a857c);
    for (let x = CAUSE.x0 + 20; x < CAUSE.x1 - 10; x += 44) for (const s of [-1, 1]) lamps.push([x, s * (CAUSE.hw - 0.6), s > 0 ? Math.PI : 0, true]);
  }

  // ---- Gehwege (Ringe um jeden Block) inkl. Bordstein
  const swGeo = (w, d) => { const g = new THREE.BoxGeometry(w, 0.14, d), uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 4, uv.getY(k) * d / 4); return g; };
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const x0 = GRID[i] + RHW, x1 = GRID[i + 1] - RHW, z0 = GRID[j] + RHW, z1 = GRID[j + 1] - RHW, w = x1 - x0, d = z1 - z0;
    B.sw.add(swGeo(w, d), mat((x0 + x1) / 2, 0.07, (z0 + z1) / 2), 0xffffff);
  }
  // Randstreifen außen (Promenade West/Nord/Süd) + Ocean-Drive-Promenade
  const strip = (x0, x1, z0, z1, c = 0xffffff) => B.sw.add(swGeo(x1 - x0, z1 - z0), mat((x0 + x1) / 2, 0.07, (z0 + z1) / 2), c);
  strip(LAND.x0, GRID[0] - RHW, LAND.z0, -RHW); strip(LAND.x0, GRID[0] - RHW, RHW, LAND.z1); strip(GRID[0] - RHW, BEACH_X, LAND.z0, GRID[0] - RHW); strip(GRID[0] - RHW, BEACH_X, GRID[6] + RHW, LAND.z1);
  strip(GRID[6] + RHW, BEACH_X, GRID[0] - RHW, GRID[6] + RHW, 0xfff0f6);
  // Insel-Platz
  B.sw.add(swGeo(ISLAND.x1 - ISLAND.x0, ISLAND.z1 - ISLAND.z0), mat((ISLAND.x0 + ISLAND.x1) / 2, -0.06, 0), 0xe9e3d8);

  // Rangers-/Fußgänger-Ringe
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const ring = { i, j, x0: GRID[i] + PED_OFF, x1: GRID[i + 1] - PED_OFF, z0: GRID[j] + PED_OFF, z1: GRID[j + 1] - PED_OFF, kind: DIST[j][i] };
    world.rings.push(ring); if (ring.kind === 'R') world.resRings.push(ring);
  }

  // ---- Laternen entlang aller Straßen
  for (const [a, b] of Eg) {
    const A = N[a], Bn = N[b], dx = Bn.x - A.x, dz = Bn.z - A.z, L = Math.hypot(dx, dz);
    if (A.x < -300 || Bn.x < -300) continue;
    const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
    for (let s = 14; s < L - 10; s += 27) for (const side of [-1, 1]) {
      const x = A.x + ux * s + nx * side * (RHW + 1.0), z = A.z + uz * s + nz * side * (RHW + 1.0);
      lamps.push([x, z, Math.atan2(-nx * side, -nz * side)]);
    }
  }
  // Insel-Ringstraße Laternen
  for (const [ax, az, bx, bz] of [[-580, -60, -580, 60], [-580, 60, -706, 60], [-706, 60, -706, -60], [-706, -60, -580, -60]]) {
    const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
    for (let s = 16; s < L - 10; s += 28) { const x = ax + ux * s - nx * (RHW + 1), z = az + uz * s - nz * (RHW + 1); lamps.push([x, z, Math.atan2(nx, nz)]); }
  }

  // ---- Gebäude
  const allotShops = [ // [i, j, Seite, Marke]   Seite: 0=N(-z) 1=S(+z) 2=W(-x) 3=O(+x)
    [2, 2, 1, 'telekom'], [5, 2, 3, 'telekom'], [1, 4, 0, 'telekom'],
    [2, 3, 0, 'vodafohn'], [4, 4, 2, 'vodafohn'], [0, 1, 3, 'vodafohn'],
    [5, 4, 3, 'o0'], [2, 1, 2, 'o0'],
    [4, 1, 0, 'eins'], [1, 2, 1, 'eins'],
    [3, 4, 1, 'kongstar'], [5, 0, 3, 'kongstar'], [0, 4, 3, 'kongstar'],
  ];
  const shopAt = {}; for (const s of allotShops) shopAt[`${s[0]},${s[1]},${s[2]}`] = s[3];
  const towerIdx = { heko: [1, 2], tk: [0, 3] };
  let hotelK = 0;

  function addSign(texture, w, h, x, y, z, ry, glow = 1, bb = false) {
    const m = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0.25 * glow, roughness: 0.5 });
    m.userData.glow = glow; world.signMats.push(m);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); s.position.set(x, y, z); s.rotation.y = ry; root.add(s); signs.push(s);
    if (bb) { // Rückseite + Gestell
      B.plain.add(new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.3), mat(x - Math.sin(ry) * 0.17, y, z - Math.cos(ry) * 0.17, ry), 0x2a2a30);
    }
    return s;
  }
  function neonText(text, color, w, h, x, y, z, ry) {
    const t = neonTextTex(text, color);
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: new THREE.Color(1, 1, 1) });
    m.userData.neon = true; world.signMats.push(m);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); s.position.set(x, y, z); s.rotation.y = ry; root.add(s);
  }
  // Ausrichtung je Seite: Fassadennormale zeigt zur Straße
  const sideInfo = [{ nx: 0, nz: -1, ry: Math.PI }, { nx: 0, nz: 1, ry: 0 }, { nx: -1, nz: 0, ry: -Math.PI / 2 }, { nx: 1, nz: 0, ry: Math.PI / 2 }];

  function shopBuilding(key, cx, cz, side, w, d) {
    const si = sideInfo[side], Bk = BRANDS[key];
    const h = 6.5, rot = si.ry;
    // Gebäude-Körper (Achse: Front entlang lokaler x)
    const bw = (side < 2) ? w : d, bd = (side < 2) ? d : w;
    B.deco.add(facadeBox(bw, h + 4, bd, 3.5, 3.6, 0, 0.5), mat(cx, (h + 4) / 2, cz), key === 'telekom' ? 0xffffff : 0xf0ece6);
    addCollider(cx - bw / 2, cx + bw / 2, cz - bd / 2, cz + bd / 2, h + 4);
    const fw = side < 2 ? w : d, fx = cx + si.nx * ((side < 2 ? d : w) / 2 + 0.06), fz = cz + si.nz * ((side < 2 ? d : w) / 2 + 0.06);
    // Schaufenster (dunkles Glas, innen beleuchtet)
    const shopGlass = signTex((g, W, H) => {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d2a38'); gr.addColorStop(1, '#3d5468'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.85)'; for (let k = 0; k < 6; k++) g.fillRect(40 + k * 160, 40, 90, 14);
      g.fillStyle = Bk.bg; for (let k = 0; k < 5; k++) { roundRect(g, 70 + k * 190, H * 0.45, 120, H * 0.38, 10); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.9)'; for (let k = 0; k < 5; k++) { roundRect(g, 92 + k * 190, H * 0.5, 76, H * 0.22, 8); g.fill(); }
      g.strokeStyle = '#c8ccd2'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10); g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.3, 0); g.lineTo(W * 0.1, H); g.lineTo(0, H); g.fill();
    }, 1024, 256);
    addSign(shopGlass, fw - 1.2, 3.4, fx, 1.85, fz, rot, 0.8);
    addSign(shopSignTex(key), fw - 0.6, (fw - 0.6) * 192 / 1024, fx + si.nx * 0.02, 4.6, fz + si.nz * 0.02, rot, 2.2);
    // Markise
    B.plain.add(new THREE.BoxGeometry(fw - 0.4, 0.14, 1.6), mat(fx + si.nx * 0.8, 3.65, fz + si.nz * 0.8, rot), new THREE.Color(Bk.bg).getHex());
    B.neon.add(new THREE.BoxGeometry(fw - 0.4, 0.06, 0.06), mat(fx + si.nx * 1.6, 3.62, fz + si.nz * 1.6, rot), key === 'telekom' ? 0xff2a9d : new THREE.Color(Bk.map).getHex());
    // Dachaufbau mit Logo-Würfel bei Telekom
    if (key === 'telekom') {
      const tl = signTex((g, W, H) => { g.fillStyle = '#E20074'; g.fillRect(0, 0, W, H); drawT(g, W * 0.12, H * 0.12, W * 0.76, '#fff'); }, 256, 256);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; addSign(tl, 3, 3, cx + Math.sin(a) * 1.51, h + 4 + 2, cz + Math.cos(a) * 1.51, a, 2.4); }
    }
    const mx = fx + si.nx * 2.2, mz = fz + si.nz * 2.2;
    const shop = { key, name: Bk.name, x: mx, z: mz, fx, fz, ry: rot, cooldown: 0, side };
    world.shops.push(shop);
    return shop;
  }

  function decoBuilding(x, z, w, d, side, ocean) {
    const floors = 3 + Math.floor(r() * (ocean ? 3 : 2)), fh = 3.4, h = floors * fh + 1.2;
    const col = pick(r, PASTELS), si = sideInfo[side];
    B.deco.add(facadeBox(w, h, d, 3.6, fh, Math.floor(r() * 8) / 8, Math.floor(r() * 8) / 8), mat(x, h / 2, z), col);
    addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h);
    // Gesimse ("Eyebrows") rundum
    for (let f = 1; f <= floors; f++) B.plain.add(new THREE.BoxGeometry(w + 0.7, 0.22, d + 0.7), mat(x, f * fh - 0.1, z), 0xffffff);
    B.plain.add(new THREE.BoxGeometry(w + 0.3, 1.0, d + 0.3), mat(x, h + 0.2, z), col);
    // Mittelfinne zur Straße mit Neon
    const fx = x + si.nx * (side < 2 ? d / 2 : w / 2), fz = z + si.nz * (side < 2 ? d / 2 : w / 2);
    const finH = h + 3.5, rot = si.ry;
    B.plain.add(new THREE.BoxGeometry(1.4, finH, 1.4), mat(fx + si.nx * 0.5, finH / 2, fz + si.nz * 0.5, rot), 0xffffff);
    const nc = pick(r, NEON);
    for (const s of [-1, 1]) {
      const ox = Math.cos(rot) * s * 0.74, oz = -Math.sin(rot) * s * 0.74;
      B.neon.add(new THREE.BoxGeometry(0.09, finH - 0.4, 0.09), mat(fx + si.nx * 1.22 + ox, finH / 2, fz + si.nz * 1.22 + oz, rot), nc);
    }
    // Neon-Band unter der Attika
    const nc2 = pick(r, NEON);
    B.neon.add(new THREE.BoxGeometry(side < 2 ? w : 0.08, 0.1, side < 2 ? 0.08 : d), mat(x + si.nx * (w / 2 + 0.2), h - 0.35, z + si.nz * (d / 2 + 0.2)), nc2);
    // Senkrechter Hotelname an der Finne
    if (r() < 0.75) {
      const name = HOTEL_NAMES[hotelK++ % HOTEL_NAMES.length];
      neonText(name, '#' + new THREE.Color(nc).getHexString(), Math.min(w * 0.85, 12), 1.9, fx + si.nx * 0.05 + (side < 2 ? 0 : 0), h + 1.4, fz + si.nz * 0.05, rot);
    }
    // Vordach + Veranda
    if (ocean) B.plain.add(new THREE.BoxGeometry(side < 2 ? w * 0.8 : 3, 0.16, side < 2 ? 3 : d * 0.8), mat(x + si.nx * ((side < 2 ? 0 : w / 2) + 1.5), 3.2, z + si.nz * ((side < 2 ? d / 2 : 0) + 1.5)), 0xffffff);
  }
  function tower(x, z, w, d, h, special) {
    const col = pick(r, [0xdfe8f2, 0xc9d7e6, 0xe9e2f2, 0xd2f0ee, 0xf2e2ea, 0xffffff]);
    B.glass.add(facadeBox(w, h, d, 3.2, 3.6, Math.floor(r() * 8) / 8, Math.floor(r() * 8) / 8), mat(x, h / 2, z), col);
    addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h);
    // Sockel
    B.plain.add(new THREE.BoxGeometry(w + 1.2, 5, d + 1.2), mat(x, 2.5, z), 0xe8e4dc);
    // Krone
    if (r() < 0.6) { B.glass.add(facadeBox(w * 0.7, h * 0.12, d * 0.7, 3.2, 3.6), mat(x, h + h * 0.06, z), col); }
    const nc = pick(r, NEON);
    for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.neon.add(new THREE.BoxGeometry(0.12, h - 6, 0.12), mat(x + ox * (w / 2 + 0.05), h / 2 + 3, z + oz * (d / 2 + 0.05)), nc);
    B.neon.add(new THREE.BoxGeometry(w + 0.3, 0.14, d + 0.3), mat(x, h - 0.2, z), nc);
    // Flugwarnlicht
    B.neon.add(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(x, h + (h * 0.12) + 0.6, z), 0xff2020);
    if (special === 'heko') {
      const t = signTex((g, W, H) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); const iw = W * 0.86; drawHeko(g, (W - iw) / 2, (H - iw * HEKO_RATIO) / 2, iw); }, 1024, 300);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, rr = (k % 2 ? w : d) / 2 + 0.08; addSign(t, (k % 2 ? d : w) * 0.9, (k % 2 ? d : w) * 0.9 * 300 / 1024, x + Math.sin(a) * rr, h - 4, z + Math.cos(a) * rr, a, 1.8); }
      world.pois.heko = { x, z, h };
    }
    if (special === 'tk') {
      const t = signTex((g, W, H) => { g.fillStyle = '#E20074'; g.fillRect(0, 0, W, H); drawT(g, W * 0.1, H * 0.1, W * 0.8, '#fff'); }, 512, 512);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, rr = (k % 2 ? w : d) / 2 + 0.08, s = Math.min(w, d) * 0.8; addSign(t, s, s, x + Math.sin(a) * rr, h - s / 2 - 2, z + Math.cos(a) * rr, a, 2.6); }
    }
    if (!special && r() < 0.45) { // Dach-Billboard
      const bw = Math.min(w, 16), bh = bw * 320 / 1024, ry = r() < 0.5 ? 0 : Math.PI / 2;
      addSign(billboardTex(Math.floor(r() * 10)), bw, bh, x, h + bh / 2 + 1.6, z, ry, 1.6, true);
      B.plain.add(new THREE.BoxGeometry(0.3, 1.8, 0.3), mat(x, h + 0.9, z), 0x333333);
    }
  }
  function house(x, z, w, d, ry) {
    const col = pick(r, PASTELS), h = 3.4 + (r() < 0.3 ? 3.2 : 0);
    B.deco.add(facadeBox(w, h, d, 3.6, 3.3, Math.floor(r() * 8) / 8, 0), mat(x, h / 2, z, ry), col);
    const rw = ry ? d : w, rd = ry ? w : d;
    addCollider(x - rw / 2, x + rw / 2, z - rd / 2, z + rd / 2, h);
    B.plain.add(prism(w + 0.8, 2.0, d + 0.8), mat(x, h, z, ry), pick(r, [0xc7643c, 0xb5523a, 0xd7774a]));
    // Tür
    B.plain.add(new THREE.BoxGeometry(1.1, 2.1, 0.12), mat(x + Math.sin(ry) * (d / 2 + 0.03), 1.05, z + Math.cos(ry) * (d / 2 + 0.03), ry), 0x6b4a2e);
  }

  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const kind = DIST[j][i];
    const x0 = GRID[i] + SWO, x1 = GRID[i + 1] - SWO, z0 = GRID[j] + SWO, z1 = GRID[j + 1] - SWO, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // Läden zuerst
    const shopSides = [0, 1, 2, 3].filter(s => shopAt[`${i},${j},${s}`]);
    for (const s of shopSides) {
      const key = shopAt[`${i},${j},${s}`], w = 18, d = 14;
      const sx = s === 2 ? x0 + d / 2 : s === 3 ? x1 - d / 2 : cx + (r() - 0.5) * 8;
      const sz = s === 0 ? z0 + d / 2 : s === 1 ? z1 - d / 2 : cz + (r() - 0.5) * 8;
      shopBuilding(key, sx, sz, s, w, d);
    }
    const blockedSide = s => shopSides.includes(s);
    if (kind === 'H') {
      const special = (i === towerIdx.heko[0] && j === towerIdx.heko[1]) ? 'heko' : (i === towerIdx.tk[0] && j === towerIdx.tk[1]) ? 'tk' : null;
      const subs = [[x0 + 14, z0 + 14], [x1 - 14, z0 + 14], [x0 + 14, z1 - 14], [x1 - 14, z1 - 14]];
      subs.forEach(([sx, sz], k) => {
        if (shopSides.length && ((shopSides.includes(0) && sz < cz) || (shopSides.includes(1) && sz > cz) || (shopSides.includes(2) && sx < cx) || (shopSides.includes(3) && sx > cx))) {
          // nur niedriger Turm hinter dem Laden
          if (r() < 0.5) return;
        }
        if (special && k === 0) { tower(cx, cz, 26, 26, special === 'heko' ? 96 : 120, special); return; }
        if (special) return;
        tower(sx, sz, 20 + r() * 6, 20 + r() * 6, 28 + r() * 70, null);
      });
      if (special) { // Vorplatz-Palmen
        for (const [px, pz] of [[x0 + 4, z0 + 4], [x1 - 4, z0 + 4], [x0 + 4, z1 - 4], [x1 - 4, z1 - 4]]) palms.push([px, pz, 0.9 + r() * 0.3]);
      }
    } else if (kind === 'D') {
      const ocean = i === 5;
      for (const s of [0, 1, 2, 3]) {
        if (blockedSide(s)) continue;
        const d = 16;
        if (s < 2) { // N/S: über volle Breite
          let x = x0; while (x < x1 - 8) { const w = Math.min(x1 - x, 13 + r() * 9); if (x1 - x - w < 8) { decoBuilding((x + x1) / 2, s === 0 ? z0 + d / 2 : z1 - d / 2, x1 - x, d, s, ocean); break; } decoBuilding(x + w / 2, s === 0 ? z0 + d / 2 : z1 - d / 2, w - 0.6, d, s, ocean); x += w; }
        } else {
          let z = z0 + d + 1; const zz1 = z1 - d - 1;
          while (z < zz1 - 6) { const w = Math.min(zz1 - z, 12 + r() * 8); decoBuilding(s === 2 ? x0 + d / 2 : x1 - d / 2, z + w / 2, d, w - 0.6, s, ocean); z += w; }
        }
      }
      palms.push([cx, cz, 1.1], [cx + 6, cz - 5, 0.9]);
    } else if (kind === 'R') {
      // 3×3 Häuser mit Gärten
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        if (a === 1 && b === 1) { palms.push([cx, cz, 1.0]); continue; }
        const hx = x0 + 10 + a * 20, hz = z0 + 10 + b * 20;
        if ((blockedSide(0) && b === 0) || (blockedSide(1) && b === 2) || (blockedSide(2) && a === 0) || (blockedSide(3) && a === 2)) continue;
        const ry = b === 0 ? Math.PI : b === 2 ? 0 : a === 0 ? -Math.PI / 2 : Math.PI / 2;
        house(hx, hz, 11, 9, ry === Math.PI ? 0 : ry === -Math.PI / 2 ? Math.PI / 2 : ry);
        if (r() < 0.7) palms.push([hx + (r() - 0.5) * 14, hz + (r() < 0.5 ? -7 : 7), 0.7 + r() * 0.4]);
      }
      B.grass.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mat(cx, 0.145, cz));
    } else if (kind === 'P') {
      B.grass.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mat(cx, 0.145, cz));
      for (let k = 0; k < 14; k++) palms.push([x0 + 4 + r() * 52, z0 + 4 + r() * 52, 0.8 + r() * 0.5]);
      // Brunnen
      B.plain.add(new THREE.CylinderGeometry(5, 5.4, 0.8, 32), mat(cx, 0.4, cz), 0xf2efe8);
      B.neon.add(new THREE.CylinderGeometry(4.3, 4.3, 0.1, 32), mat(cx, 0.78, cz), 0x19e6ff);
      addCollider(cx - 4.6, cx + 4.6, cz - 4.6, cz + 4.6, 0.8);
      world.parkSpots.push([cx, cz]);
      // Parkplakat
      addSign(billboardTex(Math.floor(r() * 10)), 12, 12 * 320 / 1024, cx, 5.5, z0 + 2, 0, 1.6, true);
      B.plain.add(new THREE.BoxGeometry(0.4, 4, 0.4), mat(cx, 2, z0 + 1.8), 0x333333);
    } else if (kind === 'S') {
      // Einkaufszentrum "MAGENTA MALL"
      const w = 40, d = 34, h = 12;
      B.deco.add(facadeBox(w, h, d, 4, 4), mat(cx, h / 2, cz), 0xfdf3f8); addCollider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h);
      B.neon.add(new THREE.BoxGeometry(w + 0.2, 0.18, d + 0.2), mat(cx, h - 0.4, cz), 0xff2a9d);
      neonText('MAGENTA MALL', '#ff2a9d', 26, 3.2, cx, h + 1.8, cz + d / 2 + 0.1, 0);
      neonText('MAGENTA MALL', '#19e6ff', 26, 3.2, cx, h + 1.8, cz - d / 2 - 0.1, Math.PI);
    }
  }

  // ---- HEKO-Bürohaus am Ocean Drive Nord (Bilboard) & Insel-HQ
  {
    const x = -643, z = 0;
    const h = 150, w = 30;
    B.glass.add(facadeBox(w, h, w, 3.2, 3.6), mat(x, h / 2, z), 0xffe6f2); addCollider(x - w / 2, x + w / 2, z - w / 2, z + w / 2, h);
    B.glass.add(facadeBox(w * 2.2, 14, w * 0.9, 3.2, 3.6), mat(x, 7, z), 0xffffff); addCollider(x - w * 1.1, x + w * 1.1, z - w * 0.45, z + w * 0.45, 14);
    const t = signTex((g, W, H) => { g.fillStyle = '#E20074'; g.fillRect(0, 0, W, H); drawT(g, W * 0.1, H * 0.1, W * 0.8, '#fff'); }, 512, 512);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; addSign(t, 24, 24, x + Math.sin(a) * (w / 2 + 0.08), h - 16, z + Math.cos(a) * (w / 2 + 0.08), a, 2.8); }
    for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.neon.add(new THREE.BoxGeometry(0.3, h, 0.3), mat(x + ox * (w / 2 + 0.1), h / 2, z + oz * (w / 2 + 0.1)), 0xff2a9d);
    neonText('TELEKOM CAMPUS', '#ff2a9d', 40, 4.5, x, 17.5, z + w * 0.45 + 0.1, 0);
    neonText('TELEKOM CAMPUS', '#ff2a9d', 40, 4.5, x + w * 1.1 + 0.1, 17.5, z, Math.PI / 2);
    world.pois.hq = { x: -594, z: 0 };
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; palms.push([x + Math.cos(a) * 66, z + Math.sin(a) * 74, 0.9 + r() * 0.4]); }
    world.shops.push({ key: 'telekom', name: 'Telekom Campus (HQ)', x: -594, z: 22, fx: -600, fz: 22, ry: Math.PI / 2, cooldown: 0, side: 3, hq: true });
  }
  // Billboards am Damm
  for (let k = 0; k < 4; k++) {
    const x = CAUSE.x0 + 50 + k * 60, s = k % 2 ? 1 : -1;
    addSign(billboardTex(k * 3 + 1), 16, 5, x, 7.5, s * (CAUSE.hw + 3), s > 0 ? Math.PI : 0, 1.6, true);
    B.plain.add(new THREE.BoxGeometry(0.5, 6, 0.5), mat(x, 2, s * (CAUSE.hw + 3.2)), 0x333333);
  }
  // HEKO-Billboard am Ocean Drive
  addSign(billboardTex(3), 18, 18 * 320 / 1024, 262, 8, -150, -Math.PI / 2, 1.6, true);
  B.plain.add(new THREE.BoxGeometry(0.5, 6, 0.5), mat(262.3, 3, -150), 0x333333);
  addSign(billboardTex(8), 18, 18 * 320 / 1024, 262, 8, 120, -Math.PI / 2, 1.6, true);
  B.plain.add(new THREE.BoxGeometry(0.5, 6, 0.5), mat(262.3, 3, 120), 0x333333);
  world.pois.hekoBoard = { x: 262, z: -150 };

  // ---- Strand: Palmen, Rettungstürme, Schirme
  for (let z = LAND.z0 + 8; z < LAND.z1 - 4; z += 11) { palms.push([BEACH_X + 2 + r() * 2, z + r() * 4, 0.95 + r() * 0.35]); if (r() < 0.5) palms.push([BEACH_X + 14 + r() * 14, z + r() * 6, 0.8 + r() * 0.4]); }
  const towerCols = [0xff7ab8, 0x58e0ff, 0xffd84a, 0x8affc2, 0xc59bff];
  for (let k = 0; k < 6; k++) {
    const x = 296, z = -230 + k * 92, c = towerCols[k % 5];
    for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.plain.add(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), mat(x + ox * 1.3, 1.2, z + oz * 1.3), 0xf4f0e8);
    B.plain.add(new THREE.BoxGeometry(3.4, 2.4, 3.4), mat(x, 3.6, z), c);
    B.plain.add(new THREE.BoxGeometry(3.6, 0.3, 3.6), mat(x, 4.95, z), 0xffffff);
    B.plain.add(prism(4, 1.0, 4), mat(x, 5.1, z), c);
    B.plain.add(new THREE.BoxGeometry(1.2, 0.12, 3.6), mat(x - 2.6, 1.8, z, 0), 0xf4f0e8);
    addCollider(x - 1.8, x + 1.8, z - 1.8, z + 1.8, 5);
  }
  // Sonnenschirme (Magenta mit T-Farben) + Liegen
  const umbM = new THREE.MeshStandardMaterial({ color: 0xE20074, roughness: 0.6, side: THREE.DoubleSide });
  const umbGeo = new THREE.ConeGeometry(1.9, 0.7, 12, 1, true).translate(0, 2.4, 0);
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 5).translate(0, 1.25, 0);
  const umbCount = 46, umb = new THREE.InstancedMesh(umbGeo, umbM, umbCount), pole = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }), umbCount);
  const lounger = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.3, 1.9).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), umbCount * 2);
  for (let k = 0; k < umbCount; k++) {
    const x = 272 + r() * 30, z = LAND.z0 + 14 + r() * (LAND.z1 - LAND.z0 - 28);
    const m = mat(x, 0, z, r() * 6); umb.setMatrixAt(k, m); pole.setMatrixAt(k, m);
    umb.setColorAt(k, new THREE.Color(k % 3 === 0 ? 0xffffff : k % 3 === 1 ? 0xE20074 : 0x19c6e6));
    lounger.setMatrixAt(k * 2, mat(x + 1.3, 0, z + 0.3, 0)); lounger.setMatrixAt(k * 2 + 1, mat(x - 1.3, 0, z + 0.3, 0));
    world.beachSpots.push([x, z]);
  }
  umb.castShadow = pole.castShadow = lounger.castShadow = true; lounger.receiveShadow = true;
  root.add(umb, pole, lounger);

  // ---- Palmen (instanziert)
  {
    const tb = [], fb = [];
    const trunkCurve = (t) => new THREE.Vector3(Math.sin(t * 1.2) * 0.9 * t + Math.pow(t, 3) * 0.5, t * 9, 0);
    const paint = (g, c) => { const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let k = 0; k < n; k++) col.set([c.r, c.g, c.b], k * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
    // Stamm: durchgehende, gebogene Röhre mit Rinden-UVs
    {
      const curve = new THREE.CatmullRomCurve3([0, 0.2, 0.4, 0.6, 0.8, 1].map(trunkCurve));
      const tg0 = new THREE.TubeGeometry(curve, 12, 0.26, 9, false), p = tg0.attributes.position, uv = tg0.attributes.uv;
      for (let k = 0; k < p.count; k++) { const t = uv.getX(k), c = curve.getPointAt(Math.min(1, t)), sc = 1.18 - t * 0.38 + (t < 0.06 ? (0.06 - t) * 4 : 0); p.setXYZ(k, c.x + (p.getX(k) - c.x) * sc, p.getY(k), c.z + (p.getZ(k) - c.z) * sc); uv.setXY(k, uv.getY(k) * 2, t * 9); }
      tg0.computeVertexNormals(); tb.push(paint(tg0.toNonIndexed(), new THREE.Color(1, 1, 1)));
    }
    const top = trunkCurve(1);
    // Wedel: Mittelrippe + gefiederte Blättchen
    const NF = 12;
    for (let f = 0; f < NF; f++) {
      const ang = f / NF * Math.PI * 2 + (f % 2) * 0.2, tilt = f % 3 === 0 ? 0.9 : f % 3 === 1 ? 0 : -0.5, pos = [], cols = [];
      const L = 3.8 + (f % 4) * 0.25, segs = 8, cA = new THREE.Color(0x2c6a26), cB = new THREE.Color(0x6bb83f), cR = new THREE.Color(0x8a9a4a);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const spine = (t) => { const d = t * L, y = top.y + t * (0.9 + tilt) - Math.pow(t, 1.8) * (2.6 + tilt * 0.6); return [top.x + ca * d, y, top.z + sa * d]; };
      const push = (v, c) => { pos.push(...v); cols.push(c.r, c.g, c.b); };
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs, tm = (t0 + t1) / 2, a0 = spine(t0), a1 = spine(t1), am = spine(tm);
        // Rippe (schmales Band)
        const w = 0.05 * (1 - t0);
        const r0 = [a0[0] - sa * w, a0[1], a0[2] + ca * w], l0 = [a0[0] + sa * w, a0[1], a0[2] - ca * w], r1 = [a1[0] - sa * w * 0.6, a1[1], a1[2] + ca * w * 0.6], l1 = [a1[0] + sa * w * 0.6, a1[1], a1[2] - ca * w * 0.6];
        push(l0, cR); push(r0, cR); push(r1, cR); push(l0, cR); push(r1, cR); push(l1, cR);
        // Blättchen links/rechts (zwei je Segment)
        const lw = Math.sin(Math.PI * Math.min(1, tm * 1.08)) * 0.95 + 0.12;
        for (const side of [-1, 1]) for (const [u0, u1] of [[t0, tm], [tm, t1]]) {
          const b0 = spine(u0), b1 = spine(u1), um = u1 + (u1 - u0) * 0.9, tip = spine(Math.min(1, um));
          const px = -sa * side * lw, pz = ca * side * lw, hang = -lw * 0.45;
          const T = [tip[0] + px, tip[1] + hang, tip[2] + pz];
          const shade = new THREE.Color().copy(cA).lerp(cB, 0.35 + 0.5 * u0 + (side > 0 ? 0.1 : 0));
          push(b0, cA); push(b1, cA); push(T, shade);
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); fb.push(g);
    }
    // Kokosnüsse
    for (let k = 0; k < 4; k++) { const s2 = new THREE.SphereGeometry(0.17, 6, 4); s2.translate(top.x + Math.cos(k * 1.6) * 0.26, top.y - 0.2, top.z + Math.sin(k * 1.6) * 0.26); paint(s2, new THREE.Color(0.25, 0.18, 0.07)); tb.push(s2.toNonIndexed()); }
    for (const g of fb) { if (g.attributes.uv) g.deleteAttribute('uv'); }
    const tg = mergeGeometries(tb), fg = mergeGeometries(fb);
    const BK = barkTex(); const tmM = new THREE.MeshStandardMaterial({ vertexColors: true, map: BK.map, normalMap: BK.normalMap, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.92 });
    const fmM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.6 });
    const chunks = new Map();
    for (const pl of palms) { const k = Math.floor(pl[0] / 160) + ',' + Math.floor(pl[1] / 160); let a = chunks.get(k); if (!a) chunks.set(k, a = []); a.push(pl); }
    for (const list of chunks.values()) {
      const tm = new THREE.InstancedMesh(tg, tmM, list.length), fm = new THREE.InstancedMesh(fg, fmM, list.length);
      list.forEach(([x, z, s], k) => { const m = mat(x, groundY(x, z) + 0.1, z, r() * 6.28, s, s, s); tm.setMatrixAt(k, m); fm.setMatrixAt(k, m); if (s > 0.85 && x < BEACH_X + 1) addCollider(x - 0.35, x + 0.35, z - 0.35, z + 0.35, 6, 'palm'); });
      tm.computeBoundingSphere(); fm.computeBoundingSphere();
      tm.castShadow = fm.castShadow = true; root.add(tm, fm);
    }
    world.palmCount = palms.length;
  }

  // ---- Laternen (instanziert) + Lichtkegel/Lichtpfützen
  {
    const n = lamps.length;
    const poleM = new THREE.MeshStandardMaterial({ color: 0x3c4048, roughness: 0.5, metalness: 0.6 });
    const headM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.6) });
    const poolM = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,.4)'), color: 0xffcf8a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const P = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.14, 7, 6).translate(0, 3.5, 0), poleM, n);
    const A = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 2.4).translate(0, 7, 1.15), poleM, n);
    const H = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.14, 0.9).translate(0, 6.92, 2.2), headM, n);
    const PL = new THREE.InstancedMesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2).translate(0, 0.06, 2.6), poolM, n);
    lamps.forEach(([x, z, ry], k) => { const m = mat(x, 0, z, ry); P.setMatrixAt(k, m); A.setMatrixAt(k, m); H.setMatrixAt(k, m); PL.setMatrixAt(k, m); addCollider(x - 0.18, x + 0.18, z - 0.18, z + 0.18, 7, 'lamp'); });
    P.castShadow = true; PL.renderOrder = 2;
    root.add(P, A, H, PL);
    world.lampHead = headM; world.lampPool = poolM; world.lampCount = n;
  }

  // ---- Batches in Meshes
  const meshes = [
    B.road.mesh(roadM, false), B.cross.mesh(crossM, false), B.sw.mesh(swM, false), B.grass.mesh(grassM, false),
    B.glass.mesh(glassM), B.deco.mesh(decoM), B.plain.mesh(plainM), B.neon.mesh(neonM, false),
  ].filter(Boolean);
  for (const m of meshes) root.add(m);
  for (const g of meshes) for (const m of g.children) {
    if (m.material === roadM || m.material === crossM || m.material === swM || m.material === grassM) m.castShadow = false;
    if (m.material === neonM) m.receiveShadow = false;
  }

  // ---- Wasser
  {
    const nt = waterNormalTex(77); nt.repeat.set(90, 90);
    const nt2 = waterNormalTex(131); nt2.repeat.set(23, 23);
    const wm = new THREE.MeshPhysicalMaterial({ color: 0x1aa6b8, roughness: 0.12, metalness: 0.0, normalMap: nt, normalScale: new THREE.Vector2(0.45, 0.45), clearcoat: 1, clearcoatRoughness: 0.03, clearcoatNormalMap: nt2, clearcoatNormalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.94, envMapIntensity: 1.2 });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), wm); w.position.set(0, -0.55, 0); w.receiveShadow = true; w.renderOrder = 1;
    root.add(w); world.water = wm; world.waterN2 = nt2;
    // Brandungsschaum
    const fc = canvas(64, 256), fg = fc.getContext('2d'), gr = fg.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    fg.fillStyle = gr; fg.fillRect(0, 0, 64, 256);
    const foamM = new THREE.MeshBasicMaterial({ map: tex(fc), transparent: true, depthWrite: false, opacity: 0.8 });
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(6, LAND.z1 - LAND.z0 + 30).rotateX(-Math.PI / 2), foamM);
    foam.position.set(324, -0.5, 0); foam.renderOrder = 2; root.add(foam); world.foam = foam;
    world.shoreX = BEACH_X + (SHORE_X - BEACH_X);
  }

  // Vertragsorte (für Glasfaser-Verträge zum Einsammeln)
  for (const rg of world.rings) for (let k = 0; k < 2; k++) {
    const t = r(); const side = Math.floor(r() * 4);
    const x = side === 0 || side === 1 ? lerp(rg.x0, rg.x1, t) : side === 2 ? rg.x0 : rg.x1;
    const z = side === 2 || side === 3 ? lerp(rg.z0, rg.z1, t) : side === 0 ? rg.z0 : rg.z1;
    world.contractSpots.push([x, z]);
  }
  for (const [x, z] of world.beachSpots.slice(0, 10)) world.contractSpots.push([x + 2, z + 2]);

  // Sonder-Orte
  world.pois.spray = { x: 160 + 0, z: 80 + 0 };
  world.pois.hospital = { x: -80 + 8, z: 80 + 8 };
  world.pois.spawn = { x: 250, z: 26 };
  // Lackiererei: Gebäude mit Tor auf Kreuzung (160,80)-Block Süd-Ost? → eigener Pavillon auf dem Strand-Parkplatz
  {
    const x = 262, z = 40;
    B.plain.add(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat(x, 0, z), 0);
    const g = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xE20074, roughness: 0.4 }));
    roof.position.set(0, 5, 0); roof.castShadow = true; g.add(roof);
    for (const [ox, oz] of [[-4.6, -5.6], [4.6, -5.6], [-4.6, 5.6], [4.6, 5.6]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff })); p.position.set(ox, 2.5, oz); g.add(p); addCollider(x + ox - 0.25, x + ox + 0.25, z + oz - 0.25, z + oz + 0.25, 5); }
    g.position.set(x, 0, z); root.add(g);
    const t = signTex((g2, W, H) => { g2.fillStyle = '#1a1030'; g2.fillRect(0, 0, W, H); drawT(g2, 20, 20, H - 40, '#fff', '#E20074'); g2.textAlign = 'left'; fitText(g2, 'MAGENTA LACKIEREREI', H + 10, H * 0.38, W - H - 30, H * 0.3, 900, '#ff2a9d', true); fitText(g2, 'Neue Farbe – keine Fahndung', H + 10, H * 0.74, W - H - 30, H * 0.2, 700, '#19e6ff'); }, 1024, 200);
    addSign(t, 10, 2, x - 5.1, 6.2, z, -Math.PI / 2, 2.2);
    world.pois.spray = { x, z };
    world.parkSpots.push([x, z - 20], [x, z + 30]);
  }
  world.root = root;
  return world;
}

// =====================================================================
//  HIMMEL + TAGESZEIT (reale lokale Uhrzeit; ?hour=N erzwingt)
// =====================================================================
export const TOD = { hour: 12, sun: 40, dayF: 1, goldF: 0, nightF: 0, lampF: 0, winF: 0, forced: null, last: -1e9, dir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(), envLast: -1e9, envKey: '' };
function sunInfo(date, hour) {
  let rise, set, maxEl;
  if (TOD.forced != null) { rise = 6.0; set = 19.6; maxEl = 60; }
  else {
    const start = new Date(date.getFullYear(), 0, 1), doy = (date - start) / 864e5;
    const dayLen = 12 + 4.6 * Math.cos(2 * Math.PI * (doy - 172) / 365);
    const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset(), jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    const dst = date.getTimezoneOffset() < Math.max(jan, jul) ? 1 : 0, noon = 12.2 + dst;
    rise = noon - dayLen / 2; set = noon + dayLen / 2; maxEl = 15 + 47 * clamp((dayLen - 7.6) / 9.2, 0, 1);
  }
  let el, az;
  if (hour >= rise && hour <= set) { const ph = (hour - rise) / (set - rise); el = maxEl * Math.sin(Math.PI * ph); az = Math.PI * ph; }
  else { const nl = 24 - (set - rise), nh = ((hour - set) + 24) % 24, ph = nh / nl; el = -50 * Math.sin(Math.PI * ph); az = Math.PI + Math.PI * ph; }
  return { el, az };
}
const PAL = {
  day: { top: new THREE.Color(0x2f7fe0), hor: new THREE.Color(0xbfe6ff), hemiS: new THREE.Color(0xdff0ff), hemiG: new THREE.Color(0x8a7a60), hemiI: 0.85, sun: new THREE.Color(0xfff2dc), sunI: 2.6, water: new THREE.Color(0x14b3c4), env: 0.42, fog: new THREE.Color(0xcfe6f5) },
  gold: { top: new THREE.Color(0x3a2a8f), hor: new THREE.Color(0xff8a5c), hemiS: new THREE.Color(0xffb8c8), hemiG: new THREE.Color(0x4a3040), hemiI: 0.8, sun: new THREE.Color(0xff8a40), sunI: 2.4, water: new THREE.Color(0x5a3a7a), env: 0.38, fog: new THREE.Color(0xd88a8a) },
  night: { top: new THREE.Color(0x05041a), hor: new THREE.Color(0x2a1048), hemiS: new THREE.Color(0x5a5ab8), hemiG: new THREE.Color(0x1a1024), hemiI: 0.6, sun: new THREE.Color(0x9fb4ff), sunI: 0.45, water: new THREE.Color(0x0a1a3a), env: 0.2, fog: new THREE.Color(0x1d0f38) },
};
const c1 = new THREE.Color(), c2 = new THREE.Color();
function mix3(key, out) { out.copy(PAL.night[key]).lerp(PAL.day[key], TOD.dayF); return out.lerp(PAL.gold[key], TOD.goldF * 0.85); }
function mixN(key) { return lerp(lerp(PAL.night[key], PAL.day[key], TOD.dayF), PAL.gold[key], TOD.goldF * 0.85); }
export const sky = { dome: null, stars: null, sunDisc: null, moon: null, hemi: null, sunL: null, envScene: null, pmrem: null, envRT: null };
export function buildSky(scene, renderer, sunL, hemi, isMobile) {
  sky.hemi = hemi; sky.sunL = sunL;
  const geo = new THREE.SphereGeometry(1400, 32, 16);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const dm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, transparent: true });
  sky.dome = new THREE.Mesh(geo, dm); sky.dome.renderOrder = -10; sky.dome.frustumCulled = false; scene.add(sky.dome);
  // Physikalischer Himmel (Rayleigh/Mie) für Tag & Dämmerung
  const mkSky = (sc, disk = 1) => { const k = new Sky(); k.material = k.material.clone(); k.material.fragmentShader = k.material.fragmentShader.replace('vSunE * 19000.0 * Fex', `vSunE * ${(19000 * disk).toFixed(1)} * Fex`).replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( min(retColor * 0.6, vec3(' + (disk < 0.01 ? '1.2' : '1.0') + ')), 1.0 );'); k.scale.setScalar(sc); k.frustumCulled = false; k.renderOrder = -11; k.material.depthWrite = false; const u = k.material.uniforms; u.turbidity.value = 4.5; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.86; return k; };
  sky.sky = mkSky(1300, 0.15); sky.dome.add(sky.sky);
  const sp = [], r = rng(99);
  for (let k = 0; k < 1200; k++) { const a = r() * Math.PI * 2, y = 0.06 + r() * 0.94, h = Math.sqrt(1 - y * y); sp.push(Math.cos(a) * h * 1300, y * 1300, Math.sin(a) * h * 1300); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sky.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  sky.stars.renderOrder = -9; sky.stars.frustumCulled = false; sky.dome.add(sky.stars);
  sky.sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,255,240,1)', 'rgba(255,200,140,.45)'), color: new THREE.Color(2, 1.8, 1.5), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  const mc = canvas(128, 128), mg = mc.getContext('2d');
  mg.fillStyle = '#eef0ff'; mg.beginPath(); mg.arc(64, 64, 40, 0, 7); mg.fill();
  mg.fillStyle = 'rgba(150,160,190,.55)'; for (const [x, y, s] of [[52, 54, 9], [74, 70, 7], [60, 80, 5], [80, 50, 4]]) { mg.beginPath(); mg.arc(x, y, s, 0, 7); mg.fill(); }
  sky.moon = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ map: tex(mc), color: new THREE.Color(1.4, 1.4, 1.5), transparent: true, fog: false, depthWrite: false }));
  sky.sunDisc.renderOrder = sky.moon.renderOrder = -8; sky.dome.add(sky.sunDisc, sky.moon);
  // Wolken (Billboards am Himmel)
  const cc = canvas(256, 128), cg = cc.getContext('2d');
  for (let k = 0; k < 18; k++) { const x = 40 + r() * 176, y = 50 + r() * 40, s = 18 + r() * 30, gr = cg.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 256, 128); }
  cg.globalCompositeOperation = 'destination-in'; { const mk = cg.createRadialGradient(128, 70, 10, 128, 70, 120); mk.addColorStop(0, 'rgba(0,0,0,1)'); mk.addColorStop(0.7, 'rgba(0,0,0,.8)'); mk.addColorStop(1, 'rgba(0,0,0,0)'); cg.setTransform(1, 0, 0, 0.55, 0, 31.5); cg.fillStyle = mk; cg.fillRect(0, 0, 256, 256); cg.setTransform(1, 0, 0, 1, 0, 0); }
  const ct = tex(cc);
  const cm = new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
  sky.cloudMat = cm;
  for (let k = 0; k < 14; k++) {
    const a = r() * Math.PI * 2, el = 0.08 + r() * 0.22, d = 1250;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(260 + r() * 200, 90 + r() * 50), cm);
    c.position.set(Math.cos(a) * d * Math.cos(el), Math.sin(el) * d, Math.sin(a) * d * Math.cos(el)); c.lookAt(0, 0, 0); c.renderOrder = -7; sky.dome.add(c);
  }
  // Umgebungs-Szene für Reflexionen (Himmel-Gradient)
  sky.pmrem = new THREE.PMREMGenerator(renderer);
  sky.envScene = new THREE.Scene();
  const eg = new THREE.SphereGeometry(10, 32, 16); eg.setAttribute('color', geo.attributes.color.clone());
  sky.envDome = new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  sky.envScene.add(sky.envDome); sky.envDome.material.transparent = true; sky.envDome.renderOrder = 1;
  sky.envSky = mkSky(40, 0); sky.envScene.add(sky.envSky);
  // heller "Boden"-Ring für Fassaden-Reflexe
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 2, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x777777, side: THREE.BackSide })); ring.position.y = -1.2; sky.envScene.add(ring); sky.envRing = ring;
  sky.envSun = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.4, 4.4) })); sky.envScene.add(sky.envSun);
}
export function updateTOD(scene, force) {
  const now = performance.now();
  if (!force && now - TOD.last < 1000) return false;
  TOD.last = now;
  const d = new Date();
  const hour = TOD.forced != null ? TOD.forced : d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  const si = sunInfo(d, hour), s = si.el;
  Object.assign(TOD, { hour, sun: s, dayF: smooth(-6, 10, s), goldF: s > -9 ? clamp(1 - Math.abs(s - 4) / 12, 0, 1) : 0, nightF: 1 - smooth(-12, -3, s), lampF: 1 - smooth(2, 12, s), winF: 1 - smooth(0, 14, s) });
  const ce = Math.cos(s * Math.PI / 180), se = Math.sin(s * Math.PI / 180);
  // Sonne geht über dem Meer (Osten = +x) auf
  TOD.dir.set(Math.cos(si.az) * ce, se, -Math.sin(si.az) * ce * 0.6).normalize();
  TOD.moonDir.set(-0.4, 0.55, -0.6).normalize();
  const top = mix3('top', new THREE.Color()), hor = mix3('hor', new THREE.Color());
  const fogC = mix3('fog', new THREE.Color());
  scene.background = hor; scene.fog.color.copy(fogC);
  scene.fog.density = lerp(0.0022, 0.00085, TOD.dayF);
  mix3('hemiS', sky.hemi.color); mix3('hemiG', sky.hemi.groundColor); sky.hemi.intensity = mixN('hemiI');
  mix3('sun', sky.sunL.color); sky.sunL.intensity = mixN('sunI');
  TOD.lightDir = (s > -4 ? TOD.dir : TOD.moonDir).clone();
  const pos = sky.dome.geometry.attributes.position, col = sky.dome.geometry.attributes.color, v = new THREE.Vector3(), glow = new THREE.Color(0xff9a60), pink = new THREE.Color(0xff3aa0);
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k).normalize();
    const t = Math.pow(clamp(v.y, 0, 1), 0.5);
    c1.copy(fogC).lerp(hor, smooth(0, 0.08, v.y)).lerp(top, t);
    if (v.y < 0) c1.copy(fogC);
    const sd = Math.max(0, v.dot(TOD.dir));
    if (TOD.goldF > 0) { c1.lerp(glow, Math.pow(sd, 5) * TOD.goldF * 0.85); c1.lerp(pink, Math.pow(1 - Math.abs(v.y), 8) * TOD.goldF * 0.25); }
    if (TOD.nightF > 0) c1.lerp(pink, Math.pow(1 - clamp(v.y, 0, 1), 14) * TOD.nightF * 0.18); // Neon-Smog über der Stadt
    col.setXYZ(k, c1.r, c1.g, c1.b);
  }
  col.needsUpdate = true;
  sky.envDome.geometry.attributes.color.copy(col); sky.envDome.geometry.attributes.color.needsUpdate = true;
  sky.stars.material.opacity = TOD.nightF * 0.95;
  // Physikalischer Himmel: tagsüber dominant, nachts die eigene Kuppel (Sterne, Neon-Smog)
  const skyF = smooth(-9, -1, s);
  for (const k of [sky.sky, sky.envSky]) { const u = k.material.uniforms; u.sunPosition.value.copy(TOD.dir); u.rayleigh.value = lerp(2.4, 3.2, TOD.goldF); u.turbidity.value = lerp(2.2, 7, TOD.goldF); u.mieCoefficient.value = lerp(0.0035, 0.006, TOD.goldF); k.visible = skyF > 0.01; }
  sky.dome.material.opacity = 1 - skyF * 0.45; sky.envDome.material.opacity = 1 - skyF * 0.6;
  sky.sunDisc.visible = s > -6; sky.sunDisc.material.opacity = smooth(-6, 2, s) * 0.55;
  sky.sunDisc.position.copy(TOD.dir).multiplyScalar(1250); sky.sunDisc.lookAt(0, 0, 0);
  sky.moon.visible = TOD.nightF > 0.05; sky.moon.material.opacity = TOD.nightF;
  sky.moon.position.copy(TOD.moonDir).multiplyScalar(1200); sky.moon.lookAt(0, 0, 0);
  sky.cloudMat.color.copy(c2.setRGB(1, 1, 1).lerp(new THREE.Color(0x3a2a5a), TOD.nightF).lerp(new THREE.Color(0xffb0a0), TOD.goldF * 0.6));
  sky.cloudMat.opacity = 0.55 + TOD.dayF * 0.3;
  // Materialien
  const winOn = TOD.winF > 0.01;
  for (const m of [world.glassMat, world.decoMat]) m.emissiveIntensity = TOD.winF * (m === world.glassMat ? 1.3 : 1.1);
  world.neonMat.color.setScalar(lerp(1.15, 3.2, TOD.lampF));
  for (const m of world.signMats) {
    if (m.userData.neon) m.color.setScalar(lerp(1.1, 2.6, TOD.lampF));
    else m.emissiveIntensity = (0.15 + TOD.lampF * 0.55) * m.userData.glow;
  }
  world.lampHead.color.setRGB(1, 1, 1).lerp(c2.setRGB(2.6, 2.3, 1.7), TOD.lampF);
  world.lampPool.opacity = TOD.lampF * 0.55; world.lampPool.visible = TOD.lampF > 0.02;
  world.water.color.copy(mix3('water', new THREE.Color()));
  // Nasse, spiegelnde Straßen bei Nacht
  for (const m of world.roadMats) { m.roughness = lerp(0.86, 0.42, TOD.lampF); m.envMapIntensity = lerp(1, 2.2, TOD.lampF); }
  scene.environmentIntensity = mixN('env');
  sky.envSun.position.copy(TOD.dir).multiplyScalar(8); sky.envSun.visible = s > -3;
  sky.envRing.material.color.setScalar(lerp(0.06, 0.45, TOD.dayF));
  // Env-Map neu berechnen, wenn sich das Licht merklich ändert
  const key = Math.round(hour * 4) + '';
  if (key !== TOD.envKey) {
    TOD.envKey = key;
    if (sky.envRT) sky.envRT.dispose();
    sky.envRT = sky.pmrem.fromScene(sky.envScene, 0, 0.1, 100);
    scene.environment = sky.envRT.texture;
  }
  window.__tod = { hour: +hour.toFixed(2), sun: +s.toFixed(1), dayF: +TOD.dayF.toFixed(2), nightF: +TOD.nightF.toFixed(2), lampF: +TOD.lampF.toFixed(2) };
  return true;
}
