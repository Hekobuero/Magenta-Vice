// Magenta Vice – Fahrzeug- und Figurenmodelle (prozedural)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { signTex, drawT, fitText, FONT, roundRect, radialTex } from './util.js?v=20261101-1000';
import { carTemplate, carMats } from './carmodels.js?v=20261101-1000';
import { V2KINDS, makeVehicle2, setV2Lod } from './vehicles2.js?v=20261101-1000';

const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), Vv = new THREE.Vector3(), Sv = new THREE.Vector3(), Eu = new THREE.Euler();
function colored(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(M4.compose(Vv.set(x, y, z), Qt.setFromEuler(Eu.set(rx, ry, rz)), Sv.set(sx, sy, sz)));
  const n = g.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const merge = a => mergeGeometries(a);

// ---------------- Materialien (geteilt) ----------------
const MATS = {};
export function sharedMats() {
  if (MATS.trim) return MATS;
  MATS.trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
  MATS.glass = new THREE.MeshPhysicalMaterial({ color: 0x0b131d, roughness: 0.03, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8 });
  MATS.rim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.85, envMapIntensity: 1.4 });
  MATS.lights = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) });
  MATS.char = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });
  MATS.red = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.2) });
  MATS.blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.5, 4.5) });
  MATS.beam = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,255,255,.95)', 'rgba(255,255,255,.35)'), color: 0xfff1d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  return MATS;
}
const paintCache = new Map();
export function paintMat(hex) {
  let m = paintCache.get(hex);
  if (!m) { m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.32, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.35 }); paintCache.set(hex, m); }
  return m;
}

// ---------------- Fahrzeugtypen ----------------
export const VTYPES = {
  sport:   { name: 'Magenta GT', len: 4.5, wid: 2.0, h: 1.2, wb: 2.75, maxV: 64, acc: 15, grip: 7.5, steer: 0.62, mass: 1.1, hp: 900, colors: [0xE20074, 0xff2a9d, 0x19c6e6, 0xffffff, 0x111111, 0xffb000, 0x8a2be2], model: 'hypergt', mlen: 4.5, genre: 'jam', cls: 'Sportwagen' },
  hyper:   { name: 'Vice Hyper GT', len: 4.6, wid: 2.05, h: 1.18, wb: 2.85, maxV: 76, acc: 19, grip: 8.2, steer: 0.62, mass: 1.15, hp: 950, colors: [0xff3b30, 0x19c6e6, 0xffd400, 0x39ff14, 0xff7a00, 0xE20074, 0xf4f4f4, 0x8a2be2], model: 'hypergt', mlen: 4.6, mscale: [1.05, 0.95, 1], paint2: 0x0b0c0f, kit: 'wing', rim: [0.35, 0.35, 0.38], genre: 'elektro', cls: 'Supersportwagen' },
  cabrio:  { name: 'Vice Cabrio', len: 4.5, wid: 2.0, h: 1.1, wb: 2.75, maxV: 62, acc: 14, grip: 7.4, steer: 0.62, mass: 1.1, hp: 850, colors: [0xff2a9d, 0x19c6e6, 0xffd400, 0xff5a1a, 0xffffff, 0x2aff9d, 0xb04aff, 0xd40000], model: 'cabrio', mlen: 4.5, rim: [1.35, 1.35, 1.4], genre: 'jam', cls: 'Cabrio' },
  speedster: { name: 'Ocean Speedster', len: 4.25, wid: 2.0, h: 1.05, wb: 2.6, maxV: 66, acc: 15, grip: 7.8, steer: 0.64, mass: 1.0, hp: 820, colors: [0x19e6ff, 0xffffff, 0xff5fb8, 0xfff1c2, 0x2aff9d, 0xffb000], model: 'cabrio', mlen: 4.5, mscale: [1, 0.97, 0.94], paint2: 0xf4efe6, rim: [1.5, 1.25, 0.6], genre: 'jam', cls: 'Roadster' },
  muscle:  { name: 'Kabel Muscle', len: 4.75, wid: 2.1, h: 1.3, wb: 2.9, maxV: 60, acc: 16, grip: 6.6, steer: 0.58, mass: 1.35, hp: 1000, colors: [0xff5a1a, 0x101014, 0xd40000, 0xffd400, 0x1a3a8a, 0x2a6a3a], model: 'hypergt', mlen: 4.5, mscale: [1.05, 1.08, 1.055], paint2: 0x101014, kit: 'scoop', rim: [0.55, 0.55, 0.6], genre: 'rock', cls: 'Muscle-Car' },
  ecoupe:  { name: 'Glasfaser E-Coupé', len: 4.5, wid: 2.0, h: 1.15, wb: 2.75, maxV: 70, acc: 21, grip: 8.0, steer: 0.62, mass: 1.2, hp: 900, colors: [0xf4f6fa, 0x19c6e6, 0x8a2be2, 0x101418], model: 'hypergt', mlen: 4.5, mscale: [1, 0.96, 1], paint2: 0x0a0c12, kit: 'glow', rim: [0.9, 1.4, 1.6], genre: 'cyber', cls: 'Elektro-Sportwagen' },
  sedan:   { genre: 'groove', name: 'Limousine', len: 4.7, wid: 1.9, h: 1.5, wb: 2.8, maxV: 46, acc: 9.5, grip: 6.2, steer: 0.6, mass: 1.3, hp: 1000, colors: [0xdfe3e8, 0x3a4a6a, 0x9a1f2a, 0x2a2a2a, 0xc8b89a, 0x6a8a7a, 0xf4f4f4] },
  taxi:    { genre: 'jam', name: 'Miami Taxi', len: 4.8, wid: 1.9, h: 1.5, wb: 2.85, maxV: 45, acc: 9.5, grip: 6.2, steer: 0.6, mass: 1.3, hp: 1000, colors: [0xffc21a] },
  tkvan:   { genre: 'cyber', name: 'Telekom E-Caddy', len: 4.7, wid: 1.95, h: 1.95, wb: 2.9, maxV: 40, acc: 8, grip: 5.6, steer: 0.58, mass: 1.6, hp: 1100, colors: [0xE20074] },
  tktruck: { genre: 'rock', name: 'Telekom Service-Truck', len: 7.0, wid: 2.4, h: 3.0, wb: 4.2, maxV: 32, acc: 5.5, grip: 5.0, steer: 0.5, mass: 3.0, hp: 1600, colors: [0xffffff] },
  pickup:  { genre: 'rock', name: 'Glasfaser-Tiefbau', len: 5.4, wid: 2.05, h: 1.85, wb: 3.3, maxV: 40, acc: 8, grip: 5.6, steer: 0.55, mass: 1.9, hp: 1300, colors: [0xf2f2f2] },
  rivalvan:{ genre: 'rock', name: 'Konkurrenz-Transporter', len: 5.6, wid: 2.05, h: 2.4, wb: 3.5, maxV: 36, acc: 7, grip: 5.2, steer: 0.55, mass: 2.0, hp: 1200, colors: [0xd40000, 0x0a2a9c] },
  police:  { genre: 'jam', name: 'Polizei', len: 4.8, wid: 1.95, h: 1.5, wb: 2.85, maxV: 56, acc: 13, grip: 7.2, steer: 0.62, mass: 1.5, hp: 1400, colors: [0xf4f6fa] },
  swat:    { genre: 'rock', name: 'SEK-Transporter', len: 5.8, wid: 2.2, h: 2.6, wb: 3.6, maxV: 48, acc: 10, grip: 6.2, steer: 0.55, mass: 2.6, hp: 2200, colors: [0x15181e] },
};
const geoCache = {};
let DETAIL = 1; // 1 = Desktop, 0 = Handy (weniger Polygone)
export function setDetail(d) { DETAIL = d; }
function liveryTex(kind, sub) {
  if (kind === 'tktruck') return signTex((g, W, H) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.fillStyle = '#E20074'; g.fillRect(0, H * 0.72, W, H * 0.28); drawT(g, 30, 30, H * 0.58, '#fff', '#E20074'); g.textAlign = 'left'; fitText(g, 'GLASFASER', H * 0.7, H * 0.28, W - H * 0.8, H * 0.24, 900, '#E20074'); fitText(g, 'Wir bauen das Netz der Zukunft', H * 0.7, H * 0.52, W - H * 0.8, H * 0.12, 700, '#333'); fitText(g, 'highspeedvorort.de', 30, H * 0.86, W - 60, H * 0.13, 800, '#fff'); }, 1024, 400);
  if (kind === 'tkvan') return signTex((g, W, H) => { g.fillStyle = '#E20074'; g.fillRect(0, 0, W, H); drawT(g, 20, H * 0.15, H * 0.7, '#fff'); g.textAlign = 'left'; fitText(g, 'Telekom Service', H * 0.9, H * 0.42, W - H, H * 0.3, 900, '#fff'); fitText(g, '5G · Glasfaser · MagentaTV', H * 0.9, H * 0.74, W - H, H * 0.17, 700, '#ffd6ea'); }, 1024, 256);
  if (kind === 'police') return signTex((g, W, H) => { g.clearRect(0, 0, W, H); g.fillStyle = '#1446b8'; g.fillRect(0, H * 0.35, W, H * 0.4); g.fillStyle = '#fff'; g.font = `900 ${H * 0.32}px ${FONT}`; g.fillText('POLIZEI', W / 2, H * 0.56); }, 512, 128);
  if (kind === 'swat') return signTex((g, W, H) => { g.clearRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = `900 ${H * 0.42}px ${FONT}`; g.fillText('SEK', W / 2, H * 0.55); }, 256, 128);
  if (kind === 'taxi') return signTex((g, W, H) => { g.clearRect(0, 0, W, H); g.fillStyle = '#111'; for (let k = 0; k < 16; k++) g.fillRect(k * W / 16, (k % 2) * H * 0.2 + H * 0.6, W / 32, H * 0.2); g.font = `900 ${H * 0.36}px ${FONT}`; g.fillText('MIAMI CAB', W / 2, H * 0.36); }, 512, 128);
  if (kind === 'pickup') return signTex((g, W, H) => { g.clearRect(0, 0, W, H); g.fillStyle = '#ff7a00'; g.fillRect(0, H * 0.62, W, H * 0.16); g.fillStyle = '#E20074'; g.font = `900 ${H * 0.32}px ${FONT}`; g.fillText('GLASFASER-TIEFBAU', W / 2, H * 0.36); }, 512, 128);
  if (kind === 'rivalvan') return sub === 0 ? signTex((g, W, H) => { g.fillStyle = '#d40000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.beginPath(); g.arc(H * 0.5, H * 0.5, H * 0.34, 0, 7); g.fill(); g.fillStyle = '#d40000'; g.font = `900 ${H * 0.45}px ${FONT}`; g.fillText('V', H * 0.5, H * 0.53); g.textAlign = 'left'; fitText(g, 'Vodafohn', H * 0.95, H * 0.42, W - H, H * 0.36, 900, '#fff'); fitText(g, 'Netz? Manchmal.', H * 0.95, H * 0.75, W - H, H * 0.16, 700, '#ffd0d0'); }, 1024, 256)
    : signTex((g, W, H) => { g.fillStyle = '#0a2a9c'; g.fillRect(0, 0, W, H); g.textAlign = 'left'; fitText(g, 'O₀ Zwei', 40, H * 0.42, W - 80, H * 0.4, 900, '#fff'); fitText(g, 'Funkloch-Spezialisten', 40, H * 0.76, W - 80, H * 0.16, 700, '#bcd0ff'); }, 1024, 256);
  return null;
}
function buildVehicleGeo(kind) {
  const T = VTYPES[kind], L = T.len, W = T.wid, H = T.h;
  const paint = [], trim = [], glass = [], lights = [];
  const hl = 0xfff6e0, tl = 0xff1a1a, dark = 0x1a1c20, chrome = 0xc8ccd2;
  const RB = (w, h, d, r = 0.12) => new RoundedBoxGeometry(w, h, d, DETAIL ? 3 : 2, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  const clr = 0.32; // Bodenfreiheit
  if (kind === 'sport') {
    paint.push(colored(RB(W, 0.62, L, 0.22), 0xffffff, 0, clr + 0.31, 0));
    paint.push(colored(RB(W * 0.82, 0.12, L * 0.36, 0.06), 0xffffff, 0, clr + 0.98, -0.25));
    glass.push(colored(RB(W * 0.84, 0.42, L * 0.46, 0.14), 0xffffff, 0, clr + 0.78, -0.2));
    paint.push(colored(RB(W * 0.98, 0.1, 0.36, 0.04), 0xffffff, 0, clr + 0.86, -L / 2 + 0.2)); // Spoiler
    trim.push(colored(new THREE.BoxGeometry(0.08, 0.26, 0.08), dark, -0.6, clr + 0.66, -L / 2 + 0.25), colored(new THREE.BoxGeometry(0.08, 0.26, 0.08), dark, 0.6, clr + 0.66, -L / 2 + 0.25));
  } else if (kind === 'sedan' || kind === 'taxi' || kind === 'police') {
    paint.push(colored(RB(W, 0.72, L, 0.2), 0xffffff, 0, clr + 0.36, 0));
    glass.push(colored(RB(W * 0.86, 0.5, L * 0.5, 0.14), 0xffffff, 0, clr + 0.95, -0.15));
    paint.push(colored(RB(W * 0.84, 0.08, L * 0.4, 0.04), 0xffffff, 0, clr + 1.22, -0.18));
  } else if (kind === 'tkvan') {
    paint.push(colored(RB(W, 0.95, L, 0.18), 0xffffff, 0, clr + 0.48, 0));
    paint.push(colored(RB(W, 0.9, L * 0.72, 0.16), 0xffffff, 0, clr + 1.3, -L * 0.14));
    glass.push(colored(RB(W * 0.9, 0.62, 0.3, 0.06), 0xffffff, 0, clr + 1.32, L * 0.22 + 0.03, -0.35));
    glass.push(colored(new THREE.BoxGeometry(W * 1.005, 0.5, 0.9), 0xffffff, 0, clr + 1.38, L * 0.12));
  } else if (kind === 'tktruck' || kind === 'rivalvan' || kind === 'swat') {
    const cabL = kind === 'tktruck' ? 2.0 : 1.4, boxL = L - cabL - 0.15, boxH = H - 0.55;
    paint.push(colored(RB(W, 1.55, cabL, 0.18), 0xffffff, 0, clr + 0.95, L / 2 - cabL / 2));
    glass.push(colored(new THREE.BoxGeometry(W * 0.92, 0.7, 0.12), 0xffffff, 0, clr + 1.35, L / 2 + 0.01, -0.0));
    glass.push(colored(new THREE.BoxGeometry(W * 1.005, 0.6, cabL * 0.55), 0xffffff, 0, clr + 1.35, L / 2 - cabL * 0.42));
    const boxColor = kind === 'tktruck' ? 0xffffff : 0xffffff;
    (kind === 'tktruck' ? trim : paint).push(colored(RB(W + 0.08, boxH, boxL, 0.08), kind === 'tktruck' ? 0xfafafa : 0xffffff, 0, clr + 0.25 + boxH / 2, -L / 2 + boxL / 2));
    trim.push(colored(new THREE.BoxGeometry(W * 0.95, 0.25, L * 0.98), dark, 0, clr + 0.12, 0));
    if (kind === 'tktruck') { // Leiter auf dem Dach + Kabeltrommel-Halter
      for (const s of [-0.4, 0.4]) trim.push(colored(new THREE.BoxGeometry(0.06, 0.06, boxL * 0.9), chrome, s, clr + 0.25 + boxH + 0.12, -L / 2 + boxL / 2));
      for (let k = 0; k < 9; k++) trim.push(colored(new THREE.BoxGeometry(0.8, 0.04, 0.05), chrome, 0, clr + 0.25 + boxH + 0.12, -L / 2 + 0.4 + k * boxL * 0.1));
      paint.push(colored(new THREE.BoxGeometry(W * 0.98, 0.25, 0.1), 0xffffff, 0, clr + 1.85, L / 2 - cabL + 0.05));
    }
  } else if (kind === 'pickup') {
    paint.push(colored(RB(W, 0.85, L, 0.16), 0xffffff, 0, clr + 0.45, 0));
    paint.push(colored(RB(W, 0.75, L * 0.38, 0.14), 0xffffff, 0, clr + 1.2, L * 0.12));
    glass.push(colored(RB(W * 1.005, 0.52, L * 0.3, 0.1), 0xffffff, 0, clr + 1.26, L * 0.14));
    // Kabeltrommel auf der Ladefläche
    const drum = new THREE.CylinderGeometry(0.6, 0.6, 0.9, 16).rotateZ(Math.PI / 2);
    trim.push(colored(drum, 0xa86a3a, 0, clr + 1.4, -L * 0.25));
    trim.push(colored(new THREE.CylinderGeometry(0.42, 0.42, 0.92, 16).rotateZ(Math.PI / 2), 0xff7a00, 0, clr + 1.4, -L * 0.25));
    trim.push(colored(new THREE.BoxGeometry(W * 0.9, 0.06, L * 0.48), 0x333333, 0, clr + 0.9, -L * 0.24));
  }
  // Stoßfänger, Unterboden, Spiegel
  trim.push(colored(RB(W * 1.02, 0.26, 0.24, 0.08), dark, 0, clr + 0.14, L / 2 - 0.08));
  trim.push(colored(RB(W * 1.02, 0.26, 0.24, 0.08), dark, 0, clr + 0.14, -L / 2 + 0.08));
  trim.push(colored(new THREE.BoxGeometry(W * 0.9, 0.18, L * 0.8), 0x111111, 0, clr + 0.02, 0));
  if (kind !== 'sport') for (const s of [-1, 1]) trim.push(colored(new THREE.BoxGeometry(0.2, 0.12, 0.08), dark, s * (W / 2 + 0.08), clr + (H > 2 ? 1.25 : 0.9), L * (kind === 'tktruck' ? 0.38 : 0.18)));
  // Kühlergrill
  trim.push(colored(new THREE.BoxGeometry(W * 0.5, 0.16, 0.04), 0x0a0a0a, 0, clr + 0.42, L / 2 + 0.01));
  // Lichter
  const hy = kind === 'sport' ? clr + 0.42 : clr + (H > 2 ? 0.75 : 0.5);
  for (const s of [-1, 1]) {
    lights.push(colored(new THREE.BoxGeometry(0.44, 0.13, 0.08), hl, s * (W / 2 - 0.3), hy, L / 2 + 0.005));
    lights.push(colored(new THREE.BoxGeometry(0.4, 0.14, 0.08), tl, s * (W / 2 - 0.28), hy + 0.02, -L / 2 - 0.005));
  }
  // Rad-Geometrie
  const wr = kind === 'tktruck' || kind === 'swat' ? 0.5 : kind === 'sport' ? 0.36 : 0.38;
  const ww = kind === 'sport' ? 0.3 : 0.26;
  // Reifen (mit gerundeter Flanke) + Felge mit Speichen
  const tire = new THREE.TorusGeometry(wr - ww * 0.32, ww * 0.42, DETAIL ? 8 : 6, DETAIL ? 28 : 20).rotateY(Math.PI / 2); tire.scale(1, 1, 1);
  const tireTread = new THREE.CylinderGeometry(wr * 0.97, wr * 0.97, ww * 0.9, DETAIL ? 28 : 20, 1, true).rotateZ(Math.PI / 2);
  const rimC = kind === 'sport' ? 0xe8eaee : kind === 'police' || kind === 'swat' ? 0x2a2c30 : 0xb4bac2;
  const rimParts = [colored(new THREE.CylinderGeometry(wr * 0.64, wr * 0.64, ww * 0.7, 28).rotateZ(Math.PI / 2), 0x2a2a2e),
    colored(new THREE.TorusGeometry(wr * 0.62, wr * 0.05, 5, DETAIL ? 24 : 16).rotateY(Math.PI / 2), rimC, ww * 0.38, 0, 0),
    colored(new THREE.CylinderGeometry(wr * 0.13, wr * 0.15, ww * 0.84, 16).rotateZ(Math.PI / 2), rimC)];
  const nSp = kind === 'sport' ? 10 : 5;
  for (let k = 0; k < nSp; k++) for (const sx of [1]) {
    const sp = new THREE.BoxGeometry(0.035, wr * 0.5, kind === 'sport' ? 0.035 : 0.07); sp.translate(0, wr * 0.37, 0); sp.rotateX(k * Math.PI * 2 / nSp + (kind === 'sport' ? 0.12 * (k % 2) : 0)); sp.translate(sx * ww * 0.4, 0, 0);
    rimParts.push(colored(sp, rimC));
  }
  const wheel = merge([colored(tire, 0x151515), colored(tireTread, 0x111111), colored(new THREE.CylinderGeometry(wr * 0.58, wr * 0.58, ww * 0.95, 24).rotateZ(Math.PI / 2), 0x1a1a1a)]);
  const rim = merge(rimParts);
  return { paint: merge(paint), trim: merge(trim), glass: merge(glass), lights: merge(lights), wheel, rim, wr, ww, clr };
}
// Fahrer (Oberkörper) – Zivil / Spieler
const driverGeo = {};
function getDriverGeo(kind) {
  if (driverGeo[kind]) return driverGeo[kind];
  const shirt = kind === 'player' ? 0xE20074 : kind === 'cop' ? 0x1d3f8a : 0x5a6a8a;
  const g = merge([colored(new THREE.CapsuleGeometry(0.2, 0.32, 6, 16), shirt, 0, 0.3, 0, 0, 0, 0, 1.2, 1, 0.8), colored(new THREE.SphereGeometry(0.14, 24, 16), 0xd9a27a, 0, 0.78, 0), colored(new THREE.SphereGeometry(0.15, 24, 12, 0, 6.3, 0, 1.4), kind === 'cop' ? 0x1a2a50 : 0x2a1a10, 0, 0.82, -0.01)]);
  return (driverGeo[kind] = g);
}
export function makeVehicle(kind, colorIdx = 0) {
  const T = VTYPES[kind], M = sharedMats();
  if (T.model) { const mv = makeModelVehicle(kind, colorIdx); if (mv) return mv; }
  if (V2KINDS.has(kind)) return makeVehicle2(kind, colorIdx, { T, M, paintMat, getDriverGeo, liveryTex, detail: DETAIL });
  if (!geoCache[kind]) geoCache[kind] = buildVehicleGeo(kind);
  const G = geoCache[kind];
  const color = T.colors[colorIdx % T.colors.length];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paintM = paintMat(color);
  const mk = (geo, m, shadow = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = shadow; o.receiveShadow = false; body.add(o); return o; };
  const paintMesh = mk(G.paint, paintM); mk(G.trim, M.trim); mk(G.glass, M.glass); const lightMesh = mk(G.lights, M.lights, false);
  // Räder
  const wheels = [];
  const wx = T.wid / 2 - G.ww / 2 + 0.02, wz = T.wb / 2;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const piv = new THREE.Group(); piv.position.set(sx * wx, G.wr, sz * wz);
    const w = new THREE.Mesh(G.wheel, M.trim); w.castShadow = true; { const rm = new THREE.Mesh(G.rim, M.rim); rm.scale.x = sx; w.add(rm); } piv.add(w); root.add(piv); wheels.push({ piv, w, front: sz > 0 });
  }
  // Beschriftung
  const decals = [];
  const lt = liveryTex(kind, colorIdx);
  if (lt) {
    const dm = new THREE.MeshStandardMaterial({ map: lt, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -1 });
    let w, h, y, z;
    if (kind === 'tktruck') { w = T.len - 2.4; h = w * 400 / 1024; y = G.clr + 0.3 + (T.h - 0.55) / 2; z = -0.95; }
    else if (kind === 'tkvan') { w = T.len * 0.62; h = w * 256 / 1024; y = G.clr + 1.0; z = -0.35; }
    else if (kind === 'rivalvan') { w = T.len - 1.8; h = w * 256 / 1024; y = G.clr + 1.3; z = -0.7; }
    else if (kind === 'swat') { w = 2.4; h = 1.2; y = G.clr + 1.4; z = -0.7; }
    else if (kind === 'pickup') { w = 3.4; h = 0.85; y = G.clr + 0.5; z = 0.1; }
    else { w = T.len * 0.7; h = w / 4; y = G.clr + 0.48; z = 0; }
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dm); p.position.set(s * (T.wid / 2 + (kind === 'tktruck' || kind === 'rivalvan' || kind === 'swat' ? 0.06 : 0.015)), y, z); p.rotation.y = s * Math.PI / 2; body.add(p); decals.push(p); }
  }
  // Dachaufbauten
  let bar = null;
  if (kind === 'police' || kind === 'swat') {
    bar = new THREE.Group(); const y = kind === 'swat' ? T.h + 0.3 : G.clr + 1.34;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.32), M.trim); base.position.y = y - 0.08; bar.add(base);
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.28), M.red.clone()); rl.position.set(-0.3, y, 0);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.28), M.blue.clone()); bl.position.set(0.3, y, 0);
    bar.add(rl, bl); bar.userData = { rl, bl }; body.add(bar);
    if (kind === 'police') { const hood = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: liveryTex('police'), transparent: true })); hood.rotation.x = -Math.PI / 2; hood.position.set(0, G.clr + 0.73, T.len / 2 - 0.55); body.add(hood); }
  }
  if (kind === 'taxi') { const s = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.24, 0.3, 2, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.7, 0.6) })); s.position.set(0, G.clr + 1.38, -0.18); body.add(s); }
  if (kind === 'tktruck' || kind === 'tkvan') { // T-Logo auf Front
    const t = signTex((g, W, H) => { drawT(g, 0, 0, W, '#fff', '#E20074'); }, 128, 128);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: t })); p.position.set(0, G.clr + (kind === 'tktruck' ? 1.0 : 0.72), T.len / 2 + (kind === 'tktruck' ? 0.02 : 0.03)); body.add(p);
  }
  // Fahrer
  const driver = new THREE.Mesh(getDriverGeo(kind === 'police' || kind === 'swat' ? 'cop' : 'civ'), M.char);
  driver.position.set(0.4, G.clr + (T.h > 2 ? 0.75 : 0.32), kind === 'tktruck' ? T.len / 2 - 1.0 : 0.15); body.add(driver);
  // Scheinwerferkegel auf der Straße
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(7, 13).rotateX(-Math.PI / 2), M.beam); beam.position.set(0, 0.07 - 0, T.len / 2 + 6.5); beam.renderOrder = 3; root.add(beam);
  return { root, body, wheels, paintMesh, lightMesh, bar, driver, beam, kind, type: T, color };
}
// Varianten: Felgenfarbe, Heckflügel, Hutze, Unterboden-Neon
const rimCache = {};
function rimMat(rim, CM) {
  if (!rim) return CM.wheel;
  const k = rim.join(','); if (rimCache[k]) return rimCache[k];
  const m = CM.wheel.clone(); m.color.setRGB(rim[0], rim[1], rim[2]); return rimCache[k] = m;
}
let kitMats = null;
function addKit(T, body, tp, color) {
  if (!T.kit) return;
  if (!kitMats) kitMats = { carbon: new THREE.MeshPhysicalMaterial({ color: 0x111215, roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }) };
  const L = tp.len, H = tp.h;
  if (T.kit === 'wing') {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.34), kitMats.carbon); plate.position.set(0, H * 0.98, -L / 2 + 0.3); plate.rotation.x = -0.12;
    for (const sx of [-0.45, 0.45]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.16), kitMats.carbon); st.position.set(sx, H * 0.86, -L / 2 + 0.34); g.add(st); }
    for (const sx of [-0.86, 0.86]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.38), kitMats.carbon); ep.position.set(sx, H * 0.98, -L / 2 + 0.3); g.add(ep); }
    g.add(plate); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); body.add(g);
  } else if (T.kit === 'scoop') {
    const sc = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.8), kitMats.carbon); sc.position.set(0, H * 0.72, L / 2 - 1.15); sc.rotation.x = 0.06; sc.castShadow = true; body.add(sc);
  } else if (T.kit === 'glow') {
    const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 3.0), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(tp.wid * 1.05, L * 0.95).rotateX(-Math.PI / 2), gm); gl.position.y = 0.04; gl.renderOrder = 3; body.add(gl);
  }
}
// Modell-Fahrzeug (echtes 3D-Modell, s. carmodels.js)
function makeModelVehicle(kind, colorIdx) {
  const T = VTYPES[kind], tp = carTemplate(T.model, T.mlen); if (!tp) return null;
  const M = sharedMats(), CM = carMats(M);
  const color = T.colors[colorIdx % T.colors.length];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hiG = new THREE.Group(); body.add(hiG);
  const paintM = paintMat(color);
  let paintMesh = null, lightMesh = null, lodPaint = null;
  const pickMat = n => {
    if (/^Paint 1/.test(n)) return paintM;
    if (/^Paint 2/.test(n)) return T.paint2 != null ? paintMat(T.paint2) : CM.dark;
    if (/Glass/i.test(n)) return CM.glass;
    if (/Headlight/.test(n)) return CM.head;
    if (n === '__misc') return CM.misc;
    if (n === '__lights') return CM.lights;
    return null;
  };
  // Fern-Detailstufe (ca. 2,7k Dreiecke statt 25k) + einfache Räder
  const lt = carTemplate(T.model + '-lod', T.mlen, tp);
  let lodG = null;
  if (lt) {
    lodG = new THREE.Group(); lodG.visible = false; body.add(lodG);
    for (const p of lt.body) { const mat = pickMat(p.name) || p.mat; const o = new THREE.Mesh(p.geo, mat); o.castShadow = mat !== CM.glass; if (mat === CM.glass) o.renderOrder = 2; lodG.add(o); if (mat === paintM) lodPaint = o; }
  }
  for (const p of tp.body) {
    const n = p.name;
    let mat = p.mat;
    if (/^Paint 1/.test(n)) mat = paintM;
    else if (/^Paint 2/.test(n)) mat = T.paint2 != null ? paintMat(T.paint2) : CM.dark;
    else if (/Glass/i.test(n)) mat = CM.glass;
    else if (/Headlight/.test(n)) mat = CM.head;
    else if (/Brakelight/.test(n)) mat = CM.tail;
    else if (/Signallight/.test(n)) mat = CM.signal;
    else if (/^Interior 3/.test(n)) mat = M.trim;
    else if (n === '__misc') mat = CM.misc;
    else if (n === '__lights') mat = CM.lights;
    const o = new THREE.Mesh(p.geo, mat); o.castShadow = mat !== CM.glass; o.receiveShadow = false; hiG.add(o);
    if (mat === paintM) paintMesh = o; if (mat === CM.head) lightMesh = o;
    if (mat === CM.glass) o.renderOrder = 2;
  }
  const wheels = [];
  for (const w of tp.wheels) {
    const piv = new THREE.Group(); piv.position.copy(w.pos); if (T.mscale) { piv.position.x *= T.mscale[0]; piv.position.z *= T.mscale[2]; }
    const wm = new THREE.Group(); for (const p of w.parts) { const o = new THREE.Mesh(p.geo, p.mat || rimMat(T.rim, CM)); o.castShadow = true; wm.add(o); }
    piv.add(wm); root.add(piv); wheels.push({ piv, w: wm, front: w.front });
  }
  let lodW = null;
  if (lodG) {
    lodW = new THREE.Group(); lodW.visible = false; root.add(lodW);
    const wg = lodWheelGeo(tp.wheelR);
    for (const w of wheels) { const o = new THREE.Mesh(wg, CM.misc); o.position.copy(w.piv.position); lodW.add(o); }
  }
  if (T.mscale) body.scale.set(T.mscale[0], T.mscale[1], T.mscale[2]);
  addKit(T, body, tp, color);
  if (!paintMesh) paintMesh = new THREE.Mesh(new THREE.BufferGeometry(), paintM);
  if (!lightMesh) lightMesh = new THREE.Mesh(new THREE.BufferGeometry(), CM.head);
  const driver = new THREE.Mesh(getDriverGeo('civ'), M.char);
  driver.position.set(0.38, 0.2, -0.15); driver.scale.setScalar(0.92); body.add(driver);
  if (T.model === 'cabrio') driver.visible = false; // im Cabrio sitzt ein echtes Modell (main.js)
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(7, 13).rotateX(-Math.PI / 2), M.beam); beam.position.set(0, 0.07, T.len / 2 + 6.5); beam.renderOrder = 3; root.add(beam);
  return { root, body, wheels, paintMesh, lightMesh, bar: null, driver, beam, kind, type: T, color, model: true, wheelR: tp.wheelR, hiG, lodG, lodW, lodPaint, lod: false };
}
// Detailstufe umschalten (main.js, nach Kameradistanz)
export function setCarLod(m, far) {
  if (m.v2) return setV2Lod(m, far);
  if (!m.lodG || m.lod === far) return;
  m.lod = far; m.hiG.visible = !far; m.lodG.visible = far; m.lodW.visible = far;
  for (const w of m.wheels) w.piv.visible = !far;
  if (m.kit) m.kit.visible = !far;
}
const lodWheels = {};
function lodWheelGeo(r) {
  const k = r.toFixed(3); if (lodWheels[k]) return lodWheels[k];
  const g = new THREE.CylinderGeometry(r, r, 0.26, 14, 1).rotateZ(Math.PI / 2).toNonIndexed();
  const n = g.attributes.position.count, c = new Float32Array(n * 3), nr = g.attributes.normal;
  for (let i = 0; i < n; i++) { const cap = Math.abs(nr.getX(i)) > 0.9; const v = cap ? 0.42 : 0.035; c[i * 3] = v; c[i * 3 + 1] = v; c[i * 3 + 2] = v * 1.05; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return (lodWheels[k] = g);
}
export function setDriver(v, who) { v.driverWho = who; v.driver.visible = who !== 'none' && v.type.model !== 'cabrio'; if (who !== 'none') v.driver.geometry = getDriverGeo(who); }

// ---------------- Figuren ----------------
const SKINS = [0xf0c8a0, 0xd9a27a, 0xb07a52, 0x8a5a3a, 0x5e3a24, 0xffd8b8];
const HAIRS = [0x1a1210, 0x3a2414, 0x8a5a2a, 0xd8b060, 0x111111, 0x9a9a9a, 0xb03a1a];
export function makeCharacter(kind, r = Math.random) {
  const M = sharedMats();
  const skin = kind === 'player' ? 0xe8b48a : SKINS[Math.floor(r() * SKINS.length)];
  const hair = kind === 'player' ? 0x2a1a10 : HAIRS[Math.floor(r() * HAIRS.length)];
  let shirt, pants, shoes = 0x222222;
  if (kind === 'player') { shirt = 0xE20074; pants = 0x1d2233; shoes = 0x111111; }
  else if (kind === 'ranger') { shirt = 0x2b2f38; pants = 0x2b3a5a; shoes = 0x3a2a1a; }
  else { shirt = [0xff7ab8, 0x58e0ff, 0xffd84a, 0x8affc2, 0xffffff, 0xff8a3d, 0x6a5acd, 0x2a9d8f, 0xe63946][Math.floor(r() * 9)]; pants = [0x2a3a5a, 0xd8c8a8, 0x3a3a3a, 0x5a7aa8, 0xffffff][Math.floor(r() * 5)]; }
  const torsoParts = [
    colored(new THREE.CapsuleGeometry(0.2, 0.36, 6, 18), shirt, 0, 1.24, 0, 0, 0, 0, 1.25, 1, 0.78),
    colored(new THREE.BoxGeometry(0.44, 0.2, 0.26), pants, 0, 0.92, 0),
    colored(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 14), skin, 0, 1.56, 0),
    colored(new THREE.SphereGeometry(0.135, 28, 20), skin, 0, 1.72, 0, 0, 0, 0, 1, 1.12, 1),
    colored(new THREE.SphereGeometry(0.145, 28, 14, 0, 6.3, 0, 1.45), hair, 0, 1.75, -0.012),
    colored(new THREE.BoxGeometry(0.05, 0.025, 0.02), 0x111111, -0.05, 1.74, 0.125), colored(new THREE.BoxGeometry(0.05, 0.025, 0.02), 0x111111, 0.05, 1.74, 0.125),
    colored(new THREE.BoxGeometry(0.06, 0.02, 0.02), 0x8a3a2a, 0, 1.65, 0.128),
  ];
  if (kind === 'player') {
    // Polo-Kragen + Telekom-T auf Brust und Rücken + Namensschild
    torsoParts.push(colored(new THREE.TorusGeometry(0.1, 0.03, 6, 14), 0xc8005f, 0, 1.52, 0, Math.PI / 2));
    for (const s of [1, -1]) {
      const z = s * 0.165;
      torsoParts.push(colored(new THREE.BoxGeometry(0.2, 0.045, 0.012), 0xffffff, 0, 1.36, z));
      torsoParts.push(colored(new THREE.BoxGeometry(0.045, 0.2, 0.012), 0xffffff, 0, 1.25, z));
      torsoParts.push(colored(new THREE.BoxGeometry(0.04, 0.04, 0.012), 0xffffff, -0.085, 1.25, z), colored(new THREE.BoxGeometry(0.04, 0.04, 0.012), 0xffffff, 0.085, 1.25, z));
    }
    torsoParts.push(colored(new THREE.BoxGeometry(0.1, 0.035, 0.012), 0xffffff, 0.12, 1.42, 0.16));
    torsoParts.push(colored(new THREE.BoxGeometry(0.46, 0.04, 0.27), 0x111111, 0, 1.0, 0)); // Gürtel
  }
  if (kind === 'ranger') {
    // Signal-Weste + Reflexstreifen + Kappe
    torsoParts.push(colored(new THREE.CapsuleGeometry(0.21, 0.3, 6, 18), 0xd4ff1a, 0, 1.24, 0, 0, 0, 0, 1.27, 1, 0.82));
    torsoParts.push(colored(new THREE.BoxGeometry(0.54, 0.05, 0.36), 0xe8e8e8, 0, 1.12, 0), colored(new THREE.BoxGeometry(0.54, 0.05, 0.36), 0xe8e8e8, 0, 1.3, 0));
    torsoParts.push(colored(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14), 0xff7a00, 0, 1.84, 0), colored(new THREE.BoxGeometry(0.22, 0.03, 0.14), 0xff7a00, 0, 1.81, 0.14));
  }
  if (kind === 'tourist' && r() < 0.5) torsoParts.push(colored(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 14), 0xf2e2b0, 0, 1.86, 0), colored(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 12), 0xf2e2b0, 0, 1.92, 0));
  const root = new THREE.Group(), body = new THREE.Mesh(merge(torsoParts), M.char); root.rotation.order = 'YXZ';
  body.castShadow = true; root.add(body);
  const limb = (parts, px, py) => { const piv = new THREE.Group(); piv.position.set(px, py, 0); const m = new THREE.Mesh(merge(parts), M.char); m.castShadow = true; piv.add(m); root.add(piv); return piv; };
  const sleeve = kind === 'ranger' ? 0x2b2f38 : shirt;
  const armParts = s => [colored(new THREE.CapsuleGeometry(0.06, 0.2, 4, 12), sleeve, 0, -0.14, 0), colored(new THREE.CapsuleGeometry(0.05, 0.24, 4, 12), skin, 0, -0.42, 0), colored(new THREE.SphereGeometry(0.06, 14, 10), skin, 0, -0.6, 0.01)];
  const armL = limb(armParts(-1), -0.29, 1.47);
  const rArm = armParts(1);
  if (kind === 'ranger') rArm.push(colored(new THREE.BoxGeometry(0.24, 0.32, 0.02), 0x8a5a2a, 0.02, -0.56, 0.1), colored(new THREE.BoxGeometry(0.2, 0.26, 0.022), 0xffffff, 0.02, -0.57, 0.105));
  const armR = limb(rArm, 0.29, 1.47);
  const legParts = [colored(new THREE.CapsuleGeometry(0.085, 0.36, 4, 14), pants, 0, -0.24, 0), colored(new THREE.CapsuleGeometry(0.07, 0.34, 4, 14), kind === 'tourist' ? skin : pants, 0, -0.62, 0), colored(new THREE.BoxGeometry(0.12, 0.08, 0.26), shoes, 0, -0.86, 0.04)];
  const legL = limb(legParts, -0.11, 0.9), legR = limb(legParts, 0.11, 0.9);
  return { root, body, armL, armR, legL, legR, kind };
}
// Animation: walk = Phase, amp = Schrittweite 0..1, punch = 0..1, fallen = 0..1
export function poseCharacter(c, phase, amp, punch = 0, fallen = 0, talk = 0) {
  const s = Math.sin(phase) * amp;
  c.legL.rotation.x = s * 0.75; c.legR.rotation.x = -s * 0.75;
  c.armL.rotation.x = -s * 0.7; c.armR.rotation.x = s * 0.7;
  c.armL.rotation.z = -0.08; c.armR.rotation.z = 0.08;
  if (punch > 0) { const p = Math.sin(Math.min(1, punch) * Math.PI); c.armR.rotation.x = -1.55 * p; c.armR.rotation.z = 0.1; c.body.rotation.y = -0.35 * p; } else c.body.rotation.y = 0;
  if (talk > 0) { c.armR.rotation.x = -0.9 + Math.sin(talk * 6) * 0.15; c.armL.rotation.x = -0.4 + Math.sin(talk * 5) * 0.25; }
  c.body.position.y = Math.abs(Math.cos(phase)) * 0.04 * amp;
  c.root.children.forEach(o => { if (o !== c.body) o.position.y = (o === c.legL || o === c.legR ? 0.9 : 1.47) + c.body.position.y; });
  // umfallen: ganze Figur nach hinten kippen
  c.root.rotation.x = -fallen * Math.PI / 2;
}
