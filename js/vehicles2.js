// Magenta Vice – detaillierte prozedurale Fahrzeuge (Limousine, Taxi, Polizei, Transporter, Lkw, Pick-up)
// Karosserie aus Seitenprofil (ExtrudeGeometry mit Fase), echte Radläufe, Glas, Chrom, Felgen, Lichter;
// Lackierung/Beschriftung als Canvas-Texturen, die exakt auf die Profilkontur zugeschnitten sind.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { signTex, drawT, fitText, FONT, roundRect, canvas, tex } from './util.js?v=20261031-2315';

export const V2KINDS = new Set(['sedan', 'taxi', 'police', 'tkvan', 'rivalvan', 'swat', 'tktruck', 'pickup']);
const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), Vv = new THREE.Vector3(), Sv = new THREE.Vector3(), Eu = new THREE.Euler();
function prep(geo, color = 0xffffff, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(M4.compose(Vv.set(x, y, z), Qt.setFromEuler(Eu.set(rx, ry, rz)), Sv.set(1, 1, 1)));
  const n = g.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const merge = a => a.length ? mergeGeometries(a) : new THREE.BufferGeometry();
let DET = 1;

// ---------- Profil-Werkzeuge (Koordinaten: z = Längsachse, y = Höhe) ----------
class Prof {
  constructor(z, y) { this.p = [[z, y]]; this.marks = {}; }
  get last() { return this.p[this.p.length - 1]; }
  l(z, y) { this.p.push([z, y]); return this; }
  q(cz, cy, z, y, n) { n = n || (DET ? 6 : 3); const [z0, y0] = this.last; for (let i = 1; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; this.p.push([a * z0 + b * cz + c * z, a * y0 + b * cy + c * y]); } return this; }
  arch(az, yc, ra) { const yb = this.last[1], dy = yb - yc, dx = Math.sqrt(ra * ra - dy * dy), n = DET ? 14 : 8; this.l(az - dx, yb); const a0 = Math.atan2(dy, -dx), a1 = Math.atan2(dy, dx) - 2 * Math.PI; for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.p.push([az + Math.cos(a) * ra, yc + Math.sin(a) * ra]); } return this; }
  mark(k) { this.marks[k] = this.p.length - 1; return this; }
  seg(a, b) { return this.p.slice(this.marks[a], this.marks[b] + 1); }
}
function zAt(pts, y, front) { // äußerste z-Koordinate der Kontur bei Höhe y
  let best = front ? -1e9 : 1e9;
  for (let i = 0; i < pts.length; i++) { const [z0, y0] = pts[i], [z1, y1] = pts[(i + 1) % pts.length]; if ((y0 - y) * (y1 - y) > 0 || y0 === y1) continue; const z = z0 + (z1 - z0) * (y - y0) / (y1 - y0); best = front ? Math.max(best, z) : Math.min(best, z); }
  return best;
}
// Kontur entlang x extrudieren (Breite = Gesamtbreite inkl. Fase), weiche Normalen
function extrudeX(pts, width, bt = 0.06, bs = 0.05, taper = null) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const depth = Math.max(0.02, width - 2 * bt);
  let g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: DET ? 3 : 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  if (taper) applyTaper(g, taper);
  g.computeVertexNormals();
  return g;
}
function applyTaper(g, t) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > t.y0) p.setX(i, p.getX(i) * (1 - t.k * Math.min(1, (y - t.y0) / (t.y1 - t.y0)))); } p.needsUpdate = true; }
// flaches Fenster (Polygon) auf der Seitenfläche bei |x| = hx, nach außen versetzt
function sideGlass(poly, hx, taper) {
  const out = [];
  for (const s of [-1, 1]) {
    const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1]))));
    g.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2); // Normale nach außen
    // ShapeGeometry liegt in xy -> nach Drehung: x -> ∓z; korrigieren, damit z = Profil-z
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const zz = s > 0 ? -p.getZ(i) : p.getZ(i); p.setXYZ(i, s * hx, p.getY(i), zz); }
    if (taper) applyTaper(g, taper);
    g.deleteAttribute('normal'); g.computeVertexNormals();
    // Normalen nach außen erzwingen
    const nr = g.attributes.normal; if (nr.getX(0) * s < 0) { const ix = g.index; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); } g.computeVertexNormals(); }
    out.push(prep(g, 0xffffff));
  }
  return out;
}
// Scheibe entlang eines Profilabschnitts (Front-/Heckscheibe), um off nach außen versetzt
function stripGlass(seg, hw, off, taper, trim0 = 0, trim1 = 0) {
  const pts = seg.slice(trim0, seg.length - trim1), n = pts.length, pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dz = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dz, dy) || 1;
    const nz = dy / L, ny = -dz / L, z = pts[i][0] + nz * off, y = pts[i][1] + ny * off;
    pos.push(-hw, y, z, hw, y, z);
    if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  if (taper) applyTaper(g, taper);
  g.computeVertexNormals();
  // Ausrichtung prüfen (Normale soll nach außen zeigen)
  const c = pts[Math.floor(n / 2)], cn = g.attributes.normal, i0 = Math.floor(n / 2) * 2, a = pts[Math.max(0, Math.floor(n / 2) - 1)], b = pts[Math.min(n - 1, Math.floor(n / 2) + 1)];
  const wantZ = (b[1] - a[1]), wantY = -(b[0] - a[0]);
  if (cn.getZ(i0) * wantZ + cn.getY(i0) * wantY < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  void c; return prep(g, 0xffffff);
}

// ---------- Räder ----------
const wheelCache = {};
function wheelGeo(r, w, style) {
  const key = r + '|' + w + '|' + style + '|' + DET; if (wheelCache[key]) return wheelCache[key];
  const seg = DET ? 26 : 16, h = w / 2;
  const prof = [[r * 0.66, -h], [r * 0.84, -h - 0.012], [r * 0.95, -h + 0.006], [r, -h + 0.045], [r, h - 0.045], [r * 0.95, h - 0.006], [r * 0.84, h + 0.012], [r * 0.66, h]].map(p => new THREE.Vector2(p[0], p[1]));
  const tire = new THREE.LatheGeometry(prof, seg).rotateZ(-Math.PI / 2);
  const tParts = [prep(tire, 0x161616)];
  // Profilrillen
  for (const s of [-0.35, 0, 0.35]) tParts.push(prep(new THREE.CylinderGeometry(r * 1.002, r * 1.002, 0.012, seg, 1, true).rotateZ(Math.PI / 2), 0x0a0a0a, s * h, 0, 0));
  const tireG = merge(tParts);
  const col = { alloy: 0xc9ced6, dark: 0x30333a, steel: 0x9aa0a8, truck: 0xb8bcc2 }[style] || 0xc0c4ca;
  const ri = r * 0.66, x0 = h * 0.62; // Felgenaußenseite bei +x
  const parts = [];
  parts.push(prep(new THREE.CylinderGeometry(ri, ri, w * 0.86, seg, 1, true).rotateZ(Math.PI / 2), 0x3a3d42)); // Felgenbett
  parts.push(prep(new THREE.CylinderGeometry(ri * 0.98, ri * 0.98, 0.01, seg).rotateZ(Math.PI / 2), 0x18191c, -h * 0.3, 0, 0)); // Rückwand
  parts.push(prep(new THREE.TorusGeometry(ri * 0.985, 0.018, 5, seg).rotateY(Math.PI / 2), col, x0 + 0.01, 0, 0)); // Felgenhorn
  parts.push(prep(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.025, 20).rotateZ(Math.PI / 2), 0x6a6c70, -h * 0.05, 0, 0)); // Bremsscheibe
  parts.push(prep(new THREE.BoxGeometry(0.06, r * 0.22, r * 0.3), style === 'dark' ? 0xc81e1e : 0x404448, -h * 0.02, r * 0.3, -r * 0.06)); // Bremssattel
  if (style === 'steel' || style === 'truck') {
    parts.push(prep(new THREE.CylinderGeometry(ri * 0.92, ri * 0.8, 0.05, seg).rotateZ(-Math.PI / 2), col, x0 - 0.02, 0, 0));
    const holes = style === 'truck' ? 8 : 6;
    for (let k = 0; k < holes; k++) { const a = k / holes * Math.PI * 2; parts.push(prep(new THREE.CylinderGeometry(r * 0.06, r * 0.06, 0.012, 10).rotateZ(Math.PI / 2), 0x202226, x0 + 0.005, Math.cos(a) * ri * 0.62, Math.sin(a) * ri * 0.62)); }
    parts.push(prep(new THREE.CylinderGeometry(ri * 0.34, ri * 0.4, 0.07, 16).rotateZ(-Math.PI / 2), style === 'truck' ? 0x8a8e94 : 0xd8dce0, x0 + 0.02, 0, 0));
  } else {
    const n = 5;
    for (let k = 0; k < n; k++) for (const off of [-0.11, 0.11]) {
      const sp = new THREE.BoxGeometry(0.045, ri * 0.72, ri * 0.11); sp.translate(0, ri * 0.5, 0); sp.rotateZ(0); sp.rotateX(k / n * Math.PI * 2 + off);
      parts.push(prep(sp, col, x0 - 0.012, 0, 0));
    }
    parts.push(prep(new THREE.CylinderGeometry(ri * 0.26, ri * 0.3, 0.06, 18).rotateZ(-Math.PI / 2), col, x0 - 0.005, 0, 0));
    parts.push(prep(new THREE.CylinderGeometry(ri * 0.1, ri * 0.1, 0.01, 12).rotateZ(Math.PI / 2), 0x18191c, x0 + 0.03, 0, 0));
  }
  return (wheelCache[key] = { tire: tireG, rim: merge(parts) });
}

// ---------- Beschriftungs-Texturen (seitlich, auf die Kontur zugeschnitten) ----------
const texCache = {};
function sideTex(key, pts, L, Hc, draw) {
  if (texCache[key]) return texCache[key];
  const CW = DET ? 1536 : 768, CH = Math.round(CW * Hc / L / 4) * 4, hl = L / 2;
  const res = [];
  for (const flip of [false, true]) { // flip=false: rechte Seite (x>0)
    const c = canvas(CW, CH), g = c.getContext('2d'); g.textBaseline = 'middle'; g.textAlign = 'center';
    const X = z => (flip ? (z + hl) : (hl - z)) / L * CW, Y = y => (1 - y / Hc) * CH, S = m => m / L * CW;
    g.save(); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.closePath(); g.clip();
    draw(g, { X, Y, S, flip, CW, CH, dir: flip ? 1 : -1 });
    g.restore();
    res.push(tex(c));
  }
  return (texCache[key] = res);
}
// Hilfen zum Zeichnen in Weltkoordinaten
function seam(g, P, pts) { g.strokeStyle = 'rgba(8,8,10,.62)'; g.lineWidth = Math.max(2, P.S(0.012)); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(P.X(p[0]), P.Y(p[1])) : g.moveTo(P.X(p[0]), P.Y(p[1]))); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = Math.max(1, P.S(0.005)); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(P.X(p[0]) + 2, P.Y(p[1])) : g.moveTo(P.X(p[0]) + 2, P.Y(p[1]))); g.stroke(); }
function handle(g, P, z, y) { const w = P.S(0.2), h = P.S(0.045), x = P.X(z) - w / 2, yy = P.Y(y) - h / 2; const gr = g.createLinearGradient(0, yy, 0, yy + h); gr.addColorStop(0, '#f2f4f6'); gr.addColorStop(0.5, '#9aa0a8'); gr.addColorStop(1, '#2a2c30'); g.fillStyle = gr; roundRect(g, x, yy, w, h, h / 2); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; roundRect(g, x + 2, yy + h, w - 4, h * 0.35, h / 4); g.fill(); }
function band(g, P, y0, y1, fill) { g.fillStyle = fill; g.fillRect(0, P.Y(y1), P.CW, P.Y(y0) - P.Y(y1)); }
function textAt(g, P, txt, z, y, hM, maxWM, weight, color, align = 'center') { g.textAlign = align; fitText(g, txt, P.X(z), P.Y(y), P.S(maxWM), P.S(hM), weight, color); g.textAlign = 'center'; }
function bodyShade(g, P, yTop) { // dezenter Glanz-/Schattenverlauf an der Flanke
  const gr = g.createLinearGradient(0, P.Y(yTop), 0, P.Y(0.2)); gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(0.35, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.22)'); g.fillStyle = gr; g.fillRect(0, 0, P.CW, P.CH);
}
let plateT = null;
function plateTex() { return plateT || (plateT = signTex((g, W, H) => { g.fillStyle = '#f4f4f0'; roundRect(g, 2, 2, W - 4, H - 4, 10); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 4; roundRect(g, 4, 4, W - 8, H - 8, 9); g.stroke(); g.fillStyle = '#1a3fb0'; g.fillRect(6, 6, H * 0.42, H - 12); g.fillStyle = '#ffd400'; g.font = `700 ${H * 0.16}px ${FONT}`; g.fillText('★', 6 + H * 0.21, H * 0.32); g.fillStyle = '#fff'; g.font = `700 ${H * 0.22}px ${FONT}`; g.fillText('D', 6 + H * 0.21, H * 0.72); fitText(g, 'MV·T 2026', W / 2 + H * 0.2, H * 0.54, W - H * 0.7, H * 0.62, 800, '#111'); }, 512, 112)); }

// ---------- Fahrzeug-Definitionen ----------
function defSedan(T) {
  const L = T.len, W = T.wid, hl = L / 2, wb = T.wb, r = 0.34, ra = r + 0.075, yb = 0.3;
  const low = new Prof(-hl + 0.06, yb).arch(-wb / 2, r, ra).arch(wb / 2, r, ra).l(hl - 0.1, yb)
    .q(hl + 0.03, yb + 0.02, hl + 0.04, 0.5).q(hl + 0.05, 0.7, hl - 0.12, 0.76).q(hl - 0.8, 0.86, 0.95, 0.9).l(-1.72, 0.92)
    .q(-hl + 0.12, 0.935, -hl, 0.86).q(-hl - 0.05, 0.78, -hl - 0.03, 0.55).q(-hl - 0.02, yb + 0.02, -hl + 0.06, yb);
  const cab = new Prof(1.05, 0.86).mark('w0').q(0.56, 1.2, 0.16, 1.38).mark('w1').q(0.05, 1.435, -0.16, 1.435).l(-0.86, 1.425).mark('r0').q(-1.06, 1.415, -1.2, 1.32).mark('r1').q(-1.56, 1.05, -1.86, 0.88).mark('r2');
  const Wc = W * 0.86, taper = { y0: 0.9, y1: 1.44, k: 0.13 };
  return { kind: 'car', L, W, hl, r, ra, yb, wb, low: low.p, cab, Wc, taper, belt: 0.9, roofY: 1.435, ww: 0.235, hlY: 0.66, tlY: 0.78, grY: 0.52, plF: 0.42, plR: 0.6,
    winF: [[0.84, 0.95], [0.24, 1.33], [-0.34, 1.345], [-0.34, 0.95]], winR: [[-0.44, 0.95], [-0.44, 1.345], [-0.86, 1.345], [-1.04, 1.3], [-1.5, 0.95]],
    seams: [[[0.98, 0.9], [0.98, 0.62], [0.9, 0.36]], [[-0.38, 0.9], [-0.38, 0.32]], [[-1.38, 0.9], [-1.42, 0.7], [-1.1, 0.48]]], handles: [[0.55, 0.8], [-0.62, 0.8]],
    drv: [0.38, 0.47, -0.25], mirrorZ: 0.86, mirrorY: 0.98 };
}
function defVan(T, kind) {
  const L = T.len, W = T.wid, H = T.h, hl = L / 2, wb = T.wb, r = kind === 'swat' ? 0.42 : kind === 'rivalvan' ? 0.39 : 0.36, ra = r + 0.08, yb = 0.34;
  const p = new Prof(-hl + 0.07, yb).arch(-wb / 2, r, ra).arch(wb / 2, r, ra).l(hl - 0.08, yb)
    .q(hl + 0.03, yb + 0.01, hl + 0.03, 0.56).q(hl + 0.04, 0.88, hl - 0.28, 0.98).q(hl - 0.56, 1.04, hl - 0.8, 1.1).mark('w0')
    .q(hl - 1.18, 1.5 + (H - 1.95) * 0.5, hl - 1.46, H - 0.08).mark('w1').q(hl - 1.58, H, hl - 1.8, H).l(-hl + 0.14, H).q(-hl, H, -hl, H - 0.14).l(-hl, 0.46).q(-hl, yb, -hl + 0.07, yb);
  const taper = { y0: 1.15, y1: H, k: 0.06 };
  const sd0 = hl - 2.2, sd1 = hl - 3.35, yTop = H - 0.12;
  return { kind: 'van', L, W, H, hl, r, ra, yb, wb, low: p.p, prof: p, taper, belt: 1.12, roofY: H, ww: kind === 'swat' ? 0.28 : 0.255, hlY: 0.78, tlY: 0.95, grY: 0.66, plF: 0.48, plR: 0.55,
    winF: [[hl - 0.96, 1.18], [hl - 1.48, yTop - 0.06], [hl - 2.08, yTop - 0.06], [hl - 2.08, 1.18]],
    winS: kind === 'rivalvan' ? null : null,
    seams: [[[hl - 0.86, 1.1], [hl - 0.86, 0.66], [hl - 0.62, 0.38]], [[hl - 2.14, yTop], [hl - 2.14, 0.36]], [[sd0, yTop - 0.02], [sd0, 0.36]], [[sd1, yTop - 0.02], [sd1, 0.36]], [[sd1 - 0.02, 1.24], [-hl + 0.02, 1.24]]],
    handles: [[hl - 1.0, 1.0], [sd0 - 0.16, 1.02]], sd0, sd1,
    drv: [0.4, 0.72, hl - 1.85], mirrorZ: hl - 0.95, mirrorY: 1.32 };
}
function defTruck(T) {
  const L = T.len, W = T.wid, H = T.h, hl = L / 2, wb = T.wb, r = 0.5, ra = r + 0.08, yb = 0.56, cabL = 2.0, cz = hl - cabL;
  const p = new Prof(cz, yb).arch(hl - (L / 2 - wb / 2) , r, ra).l(hl - 0.08, yb).q(hl + 0.03, yb, hl + 0.03, 0.8).l(hl + 0.03, 1.5).q(hl + 0.02, 1.64, hl - 0.06, 1.7).mark('w0')
    .q(hl - 0.2, 2.2, hl - 0.3, 2.62).mark('w1').q(hl - 0.36, 2.78, hl - 0.6, 2.78).l(cz + 0.08, 2.78).q(cz, 2.78, cz, 2.7).l(cz, yb);
  const taper = { y0: 1.7, y1: 2.78, k: 0.05 };
  return { kind: 'truck', L, W, H, hl, r, ra, yb, wb, low: p.p, prof: p, taper, cabL, cz, belt: 1.7, roofY: 2.78, ww: 0.32, hlY: 0.92, tlY: 0.9, grY: 1.15, plF: 0.66, plR: 0.85,
    winF: [[hl - 0.2, 1.8], [hl - 0.42, 2.6], [hl - 1.25, 2.6], [hl - 1.25, 1.8]],
    seams: [[[hl - 0.12, 1.7], [hl - 0.12, 0.8]], [[hl - 1.34, 2.66], [hl - 1.34, 0.62]]], handles: [[hl - 1.2, 1.62]],
    drv: [0.45, 1.2, hl - 0.95], mirrorZ: hl - 0.25, mirrorY: 2.05 };
}
function defPickup(T) {
  const L = T.len, W = T.wid, hl = L / 2, wb = T.wb, r = 0.4, ra = r + 0.08, yb = 0.38, bed = 1.1;
  const low = new Prof(-hl + 0.05, yb).arch(-wb / 2, r, ra).arch(wb / 2, r, ra).l(hl - 0.08, yb)
    .q(hl + 0.04, yb, hl + 0.04, 0.62).q(hl + 0.05, 0.98, hl - 0.18, 1.04).q(hl - 0.7, 1.08, hl - 1.3, 1.1).l(-hl + 0.06, bed).q(-hl, bed, -hl, bed - 0.08).l(-hl, 0.5).q(-hl, yb, -hl + 0.05, yb);
  const z0 = hl - 1.3, cab = new Prof(z0 + 0.04, 1.06).mark('w0').q(z0 - 0.38, 1.55, z0 - 0.62, 1.78).mark('w1').q(z0 - 0.7, 1.84, z0 - 0.85, 1.84).l(z0 - 1.7, 1.84).mark('r0').q(z0 - 1.78, 1.84, z0 - 1.8, 1.74).l(z0 - 1.82, 1.06).mark('r2');
  const Wc = W * 0.9, taper = { y0: 1.1, y1: 1.84, k: 0.08 };
  return { kind: 'pickup', L, W, hl, r, ra, yb, wb, low: low.p, cab, Wc, taper, belt: 1.1, roofY: 1.84, ww: 0.27, hlY: 0.84, tlY: 0.86, grY: 0.74, plF: 0.5, plR: 0.62, bedZ: [-hl + 0.1, z0 - 1.88],
    winF: [[z0 - 0.08, 1.16], [z0 - 0.6, 1.74], [z0 - 0.88, 1.775], [z0 - 0.88, 1.16]], winR: [[z0 - 0.98, 1.16], [z0 - 0.98, 1.775], [z0 - 1.66, 1.775], [z0 - 1.66, 1.16]],
    seams: [[[z0 + 0.0, 1.1], [z0 + 0.0, 0.7], [z0 + 0.12, 0.42]], [[z0 - 0.93, 1.1], [z0 - 0.93, 0.4]], [[z0 - 1.78, 1.1], [z0 - 1.78, 0.62]]], handles: [[z0 - 0.42, 1.0], [z0 - 1.3, 1.0]],
    drv: [0.4, 0.82, z0 - 0.72], mirrorZ: z0 - 0.12, mirrorY: 1.22 };
}

// ---------- Beschriftungen ----------
function livery(kind, D, sub, liveryTex) {
  const P0 = D.low, Hc = (D.H || D.roofY) + 0.05;
  const key = kind + ':' + sub + ':' + DET;
  return sideTex(key, P0, D.L, Hc, (g, P) => {
    const hl = D.hl;
    if (kind === 'taxi') { // Schachbrett-Band + Schrift
      const y0 = 0.6, h = 0.1, n = Math.ceil(D.L / h);
      for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f6f6f2'; g.fillRect(P.X(-hl + i * h) - (P.flip ? 0 : P.S(h)), P.Y(y0 + (j + 1) * h / 2), P.S(h) + 1, P.S(h / 2) + 1); }
      textAt(g, P, 'TAXI', 0.35, 0.47, 0.17, 1.0, 900, '#111');
      textAt(g, P, 'MIAMI CAB · 305-MAGENTA', -0.6, 0.45, 0.07, 1.4, 800, '#222');
      textAt(g, P, '17', -1.2, 0.8, 0.09, 0.3, 900, '#111');
    } else if (kind === 'police') {
      band(g, P, 0.3, 0.74, '#1a47b8'); band(g, P, 0.6, 0.64, '#c8e04a');
      textAt(g, P, 'POLIZEI', -0.05, 0.47, 0.2, 1.7, 900, '#fff');
      textAt(g, P, '110', -1.75, 0.8, 0.08, 0.3, 900, '#1a47b8');
    } else if (kind === 'tkvan') {
      const gr = g.createLinearGradient(0, P.Y(D.H), 0, P.Y(0.3)); gr.addColorStop(0, '#ff3aa0'); gr.addColorStop(1, '#c8005f'); g.globalAlpha = 0.35; g.fillStyle = gr; g.fillRect(0, 0, P.CW, P.CH); g.globalAlpha = 1;
      const tz = (D.sd0 + D.sd1) / 2, ts = 0.82; drawT(g, P.X(tz) - P.S(ts) / 2, P.Y(1.62) - P.S(ts) / 2, P.S(ts), '#fff');
      textAt(g, P, 'Telekom', D.sd1 - 0.12 - (P.flip ? 0 : 0), 1.62, 0.36, 1.25, 900, '#fff', P.flip ? 'right' : 'left');
      g.save(); g.textAlign = P.flip ? 'right' : 'left'; fitText(g, 'Glasfaser · 5G · MagentaTV', P.X(D.sd1 - 0.12), P.Y(1.33), P.S(1.3), P.S(0.12), 700, '#ffe0f0'); g.restore();
      band(g, P, 0.36, 0.5, 'rgba(255,255,255,.92)');
      textAt(g, P, 'Erleben, was verbindet.', D.sd1 + 0.2, 0.43, 0.09, 1.9, 800, '#E20074');
      textAt(g, P, 'telekom.de', hl - 1.5, 0.43, 0.08, 0.9, 800, '#E20074');
    } else if (kind === 'rivalvan') {
      if (sub % 2 === 0) { const cz = D.sd0 - 0.4; g.fillStyle = '#fff'; g.beginPath(); g.arc(P.X(cz), P.Y(1.5), P.S(0.32), 0, 7); g.fill(); g.fillStyle = '#d40000'; g.font = `900 ${P.S(0.4)}px ${FONT}`; g.fillText('V', P.X(cz), P.Y(1.49)); textAt(g, P, 'Vodafohn', D.sd1 - 0.6, 1.55, 0.36, 2.0, 900, '#fff'); textAt(g, P, 'Netz? Manchmal.', D.sd1 - 0.6, 1.24, 0.13, 2.0, 700, '#ffd0d0'); }
      else { textAt(g, P, 'O₀ Zwei', D.sd1 - 0.3, 1.55, 0.4, 2.4, 900, '#fff'); textAt(g, P, 'Funkloch-Spezialisten', D.sd1 - 0.3, 1.22, 0.13, 2.4, 700, '#bcd0ff'); }
    } else if (kind === 'swat') {
      band(g, P, 0.62, 0.68, '#2a5bd8'); textAt(g, P, 'POLIZEI', -0.6, 1.5, 0.3, 2.2, 900, '#fff'); textAt(g, P, 'SEK', -0.6, 1.12, 0.2, 1.0, 900, '#9fb4ff');
    } else if (kind === 'tktruck') {
      band(g, P, 0.6, 0.86, '#E20074'); drawT(g, P.X(D.hl - 0.72) - P.S(0.5) / 2, P.Y(1.32) - P.S(0.5) / 2, P.S(0.5), '#fff', '#E20074');
    } else if (kind === 'pickup') {
      band(g, P, 0.58, 0.68, '#ff7a00'); textAt(g, P, 'GLASFASER-TIEFBAU', -0.6, 0.86, 0.13, 2.4, 900, '#E20074');
    }
    for (const s of D.seams) seam(g, P, s);
    for (const [z, y] of D.handles) handle(g, P, z, y);
    // Tankdeckel
    if (D.kind !== 'truck') { const z = -D.wb / 2 - 0.62 * (D.kind === 'van' ? 1 : 0.9), y = D.belt - 0.14; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = Math.max(2, P.S(0.008)); roundRect(g, P.X(z) - P.S(0.09), P.Y(y) - P.S(0.08), P.S(0.18), P.S(0.16), P.S(0.03)); g.stroke(); }
    bodyShade(g, P, D.belt + 0.4);
  });
}

// ---------- Bau ----------
const geoCache = {};
function buildGeo(kind, T) {
  const D = kind === 'tkvan' || kind === 'rivalvan' || kind === 'swat' ? defVan(T, kind) : kind === 'tktruck' ? defTruck(T) : kind === 'pickup' ? defPickup(T) : defSedan(T);
  const paint = [], trim = [], glass = [], lights = [], chrome = [], tail = [];
  const W = D.W, hl = D.hl, bs = 0.05, bt = 0.06, dark = 0x17181b, plast = 0x222428;
  const RB = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, DET ? 2 : 1, Math.min(r, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005));
  // Karosserie
  paint.push(prep(extrudeX(D.low, W, bt, bs, D.kind === 'van' || D.kind === 'truck' ? D.taper : null)));
  if (D.cab) paint.push(prep(extrudeX(D.cab.p, D.Wc, bt, bs, D.taper)));
  // Fenster
  const sideHX = (D.cab ? D.Wc : W) / 2 + 0.012;
  glass.push(...sideGlass(D.winF, sideHX, D.taper)); if (D.winR) glass.push(...sideGlass(D.winR, sideHX, D.taper));
  const src = D.cab || D.prof, hwG = (D.cab ? D.Wc : W) / 2 - bt - 0.05;
  glass.push(stripGlass(src.seg('w0', 'w1'), hwG, bs + 0.012, D.taper, 1, 1));
  if (D.cab && D.cab.marks.r1) glass.push(stripGlass(D.cab.seg('r0', 'r2'), hwG, bs + 0.012, D.taper, 2, 1));
  else if (D.kind === 'pickup') { const z = D.cab.marks.r0, pt = D.cab.p; const zr = pt[z][0] - 0.12 + 0.0; glass.push(prep(new THREE.PlaneGeometry(D.Wc * 0.66, 0.42), 0xffffff, 0, 1.52, zr - bs - 0.012, 0, Math.PI, 0)); void zr; }
  if (D.kind === 'van') glass.push(prep(new THREE.PlaneGeometry(W * 0.32, 0.55), 0xffffff, -W * 0.2, D.H - 0.55, -hl - bs - 0.012, 0, Math.PI, 0), prep(new THREE.PlaneGeometry(W * 0.32, 0.55), 0xffffff, W * 0.2, D.H - 0.55, -hl - bs - 0.012, 0, Math.PI, 0));
  if (D.kind === 'truck') glass.push(prep(new THREE.PlaneGeometry(W * 0.5, 0.3), 0xffffff, 0, 2.3, D.cz - bs - 0.012, 0, Math.PI, 0));
  // Front/Heck
  const fz = y => zAt(D.low, y, true) + bs, rz = y => zAt(D.low, y, false) - bs;
  const hlx = W / 2 - (D.kind === 'car' ? 0.4 : 0.36);
  for (const s of [-1, 1]) {
    const zf = fz(D.hlY);
    lights.push(prep(RB(0.4, D.kind === 'car' ? 0.12 : 0.2, 0.12, 0.04), 0xfff8ea, s * hlx, D.hlY, zf - 0.045));
    chrome.push(prep(RB(0.46, D.kind === 'car' ? 0.16 : 0.25, 0.1, 0.05), 0x9aa0a8, s * hlx, D.hlY, zf - 0.06));
    lights.push(prep(RB(0.1, 0.05, 0.08, 0.02), 0xffa21a, s * (hlx + 0.27), D.hlY - 0.02, zf - 0.07)); // Blinker
    const zr = rz(D.tlY);
    tail.push(prep(RB(D.kind === 'car' ? 0.5 : 0.22, D.kind === 'car' ? 0.13 : 0.42, 0.1, 0.03), 0xff1a1a, s * (W / 2 - (D.kind === 'car' ? 0.36 : 0.2)), D.tlY, zr + 0.04));
    trim.push(prep(RB(0.1, D.kind === 'car' ? 0.12 : 0.14, 0.24, 0.03), dark, s * ((D.cab ? D.Wc : W * (1 - D.taper.k * 0.2)) / 2 + 0.06), D.mirrorY, D.mirrorZ)); // Spiegel
    trim.push(prep(new THREE.BoxGeometry(0.1, 0.035, 0.035), dark, s * ((D.cab ? D.Wc : W) / 2 + 0.01), D.mirrorY - 0.05, D.mirrorZ + 0.03));
  }
  // Kühlergrill
  const gz = fz(D.grY), gw = D.kind === 'truck' ? W * 0.62 : D.kind === 'van' ? W * 0.5 : W * 0.42, gh = D.kind === 'truck' ? 0.6 : D.kind === 'van' ? 0.2 : 0.13;
  trim.push(prep(RB(gw, gh, 0.06, 0.03), 0x0c0d0f, 0, D.grY, gz - 0.02));
  chrome.push(prep(RB(gw + 0.05, gh + 0.04, 0.05, 0.03), 0xb8bec6, 0, D.grY, gz - 0.035));
  for (let k = 1; k < (D.kind === 'truck' ? 6 : 3); k++) chrome.push(prep(new THREE.BoxGeometry(gw * 0.94, 0.012, 0.012), 0x8a9098, 0, D.grY - gh / 2 + gh * k / (D.kind === 'truck' ? 6 : 3), gz + 0.012));
  // Stoßfänger-Lippen, Schweller, Unterboden
  const yb = D.yb;
  trim.push(prep(RB(W * 0.96, 0.12, 0.2, 0.05), plast, 0, yb + 0.05, fz(yb + 0.08) - 0.07));
  trim.push(prep(RB(W * 0.96, 0.14, 0.2, 0.05), plast, 0, yb + 0.06, rz(yb + 0.08) + 0.07));
  trim.push(prep(RB(gw * 0.9, 0.08, 0.04, 0.02), 0x0a0a0a, 0, yb + 0.16, fz(yb + 0.16) - 0.01));
  const sill0 = D.kind === 'truck' ? D.cz + 0.2 : -D.wb / 2 + D.ra + 0.05, sill1 = D.wb / 2 - D.ra - 0.05;
  if (sill1 > sill0) for (const s of [-1, 1]) trim.push(prep(RB(0.06, 0.1, sill1 - sill0, 0.03), plast, s * (W / 2 + 0.01), yb + 0.04, (sill0 + sill1) / 2));
  trim.push(prep(new THREE.BoxGeometry(W * 0.72, 0.08, D.L * 0.9), 0x0d0d0f, 0, yb - 0.02, 0));
  // Radhäuser (dunkle Innenkästen gegen Durchblick)
  const axles = D.kind === 'truck' ? [hl - (D.L / 2 - D.wb / 2), -D.wb / 2] : [-D.wb / 2, D.wb / 2];
  for (const az of axles) trim.push(prep(new THREE.BoxGeometry(W - 2 * (D.ww + 0.07), D.ra * 1.5, D.ra * 2.05), 0x08080a, 0, D.r + D.ra * 0.15, az));
  // Kennzeichen
  const plate = [prep(new THREE.PlaneGeometry(0.52, 0.115), 0xffffff, 0, D.plF, fz(D.plF) + 0.006), prep(new THREE.PlaneGeometry(0.52, 0.115), 0xffffff, 0, D.plR, rz(D.plR) - 0.006, 0, Math.PI, 0)];
  // Auspuff
  trim.push(prep(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10).rotateX(Math.PI / 2), 0x55585c, W * 0.3, yb + 0.02, rz(yb + 0.1) + 0.05));
  // Typ-spezifisches
  if (D.kind === 'truck') {
    const boxL = D.L - D.cabL - 0.12, boxH = D.H - 0.78, bz = -hl + boxL / 2;
    trim.push(prep(RB(W + 0.06, boxH, boxL, 0.07), 0xf6f7f8, 0, 0.78 + boxH / 2, bz));
    trim.push(prep(new THREE.BoxGeometry(W * 0.86, 0.22, D.L * 0.96), 0x1b1c1f, 0, 0.66, 0)); // Rahmen
    for (const s of [-1, 1]) trim.push(prep(RB(0.06, 0.1, boxL - 0.2, 0.03), 0xc2c6cc, s * (W / 2 + 0.02), 0.82, bz)); // Unterfahrschutz
    for (let k = 0; k < 4; k++) chrome.push(prep(new THREE.BoxGeometry(0.03, boxH - 0.1, 0.04), 0xa8acb2, 0, 0.78 + boxH / 2, -hl - 0.025 + 0, 0, 0, 0)), chrome[chrome.length - 1].translate((k - 1.5) * W * 0.24, 0, 0);
    for (const s of [-0.4, 0.4]) chrome.push(prep(new THREE.BoxGeometry(0.06, 0.06, boxL * 0.9), 0xc8ccd2, s, D.H + 0.12, bz));
    for (let k = 0; k < 9; k++) chrome.push(prep(new THREE.BoxGeometry(0.8, 0.04, 0.05), 0xc8ccd2, 0, D.H + 0.12, -hl + 0.4 + k * boxL * 0.1));
    trim.push(prep(RB(W * 0.9, 0.25, 0.5, 0.06), 0xf6f7f8, 0, D.roofY + 0.1, hl - 0.85)); // Windabweiser
    for (const s of [-1, 1]) lights.push(prep(new THREE.BoxGeometry(0.12, 0.06, 0.06), 0xffa21a, s * 0.5, D.roofY + 0.25, hl - 0.66));
    for (const s of [-1, 1]) for (const z of [-hl + 0.5, -hl + 1.7, -hl + 2.9]) lights.push(prep(new THREE.BoxGeometry(0.02, 0.05, 0.1), 0xffa21a, s * (W / 2 + 0.035), 0.83, z));
  }
  if (D.kind === 'pickup') {
    const [b0, b1] = D.bedZ; trim.push(prep(new THREE.BoxGeometry(W - 0.14, 0.02, b1 - b0), 0x1c1d20, 0, D.belt + 0.06, (b0 + b1) / 2));
    for (const s of [-1, 1]) paint.push(prep(RB(0.08, 0.12, b1 - b0 + 0.06, 0.03), 0xffffff, s * (W / 2 - 0.04), D.belt + 0.06, (b0 + b1) / 2));
    paint.push(prep(RB(W, 0.12, 0.08, 0.03), 0xffffff, 0, D.belt + 0.06, b0 - 0.02));
    for (const s of [-1, 1]) chrome.push(prep(new THREE.CylinderGeometry(0.03, 0.03, b1 - b0 - 0.2, 10).rotateX(Math.PI / 2), 0xc8ccd2, s * (W / 2 - 0.05), D.belt + 0.42, (b0 + b1) / 2), prep(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8), 0xc8ccd2, s * (W / 2 - 0.05), D.belt + 0.26, b1 - 0.12), prep(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8), 0xc8ccd2, s * (W / 2 - 0.05), D.belt + 0.26, b0 + 0.12));
    const zc = (b0 + b1) / 2 + 0.1; trim.push(prep(new THREE.CylinderGeometry(0.58, 0.58, 0.9, 20).rotateZ(Math.PI / 2), 0xa86a3a, 0, D.belt + 0.66, zc), prep(new THREE.CylinderGeometry(0.42, 0.42, 0.92, 20).rotateZ(Math.PI / 2), 0xff7a00, 0, D.belt + 0.66, zc));
  }
  if (kind === 'tkvan' || kind === 'swat') { // Dachträger
    for (const s of [-1, 1]) chrome.push(prep(new THREE.BoxGeometry(0.05, 0.05, D.L * 0.62), 0x9aa0a8, s * W * 0.38, D.roofY + 0.12, -D.L * 0.12));
    for (let k = 0; k < 4; k++) chrome.push(prep(new THREE.BoxGeometry(W * 0.8, 0.04, 0.05), 0x9aa0a8, 0, D.roofY + 0.1, D.L * 0.18 - k * D.L * 0.2));
    if (kind === 'tkvan') { for (const s of [-0.22, 0.22]) chrome.push(prep(new THREE.BoxGeometry(0.05, 0.05, D.L * 0.55), 0xd8dade, s, D.roofY + 0.18, -D.L * 0.12)); for (let k = 0; k < 8; k++) chrome.push(prep(new THREE.BoxGeometry(0.44, 0.03, 0.04), 0xd8dade, 0, D.roofY + 0.18, -D.L * 0.12 - D.L * 0.25 + k * D.L * 0.07)); }
  }
  if (D.kind === 'van') { for (const s of [-1, 1]) trim.push(prep(new THREE.BoxGeometry(0.03, 0.05, D.sd0 - D.sd1 + 0.6), 0x2a2c30, s * (W / 2 * (1 - D.taper.k * 0.05) + 0.015), 1.24, (D.sd0 + D.sd1) / 2 - 0.3)); }
  const wg = wheelGeo(D.r, D.ww, kind === 'police' || kind === 'swat' ? 'dark' : kind === 'taxi' || kind === 'tkvan' || kind === 'rivalvan' ? 'steel' : kind === 'tktruck' ? 'truck' : 'alloy');
  return { D, paint: merge(paint), trim: merge(trim), glass: merge(glass), lights: merge(lights), tail: merge(tail), chrome: merge(chrome), plate: merge(plate), wg };
}

let MAT2 = null;
function mats2(M) {
  if (MAT2) return MAT2;
  MAT2 = {
    chrome: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 1.0, envMapIntensity: 1.6 }),
    tail: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.1, emissive: 0x8a0000, emissiveIntensity: 1.2 }),
    head: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.3, emissive: 0xfff2d8, emissiveIntensity: 1.6 }),
    plate: new THREE.MeshStandardMaterial({ map: plateTex(), roughness: 0.5, metalness: 0.1 }),
    tire: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    glass: M.glass,
  };
  return MAT2;
}
export function makeVehicle2(kind, colorIdx, ctx) {
  const { T, M, paintMat, getDriverGeo, liveryTex, detail: dLevel } = ctx; DET = dLevel;
  const k = kind + DET; if (!geoCache[k]) geoCache[k] = buildGeo(kind, T);
  const G = geoCache[k], D = G.D, X = mats2(M);
  const color = T.colors[colorIdx % T.colors.length];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paintM = paintMat(color);
  const mk = (geo, m, shadow = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = shadow; o.receiveShadow = false; body.add(o); return o; };
  const paintMesh = mk(G.paint, paintM); mk(G.trim, M.trim); const gl = mk(G.glass, X.glass, false); gl.renderOrder = 2;
  const lightMesh = mk(G.lights, X.head, false); mk(G.tail, X.tail, false); const detail = [mk(G.chrome, X.chrome), mk(G.plate, X.plate, false)];
  // Räder
  const wheels = [], wx = D.W / 2 - D.ww / 2 - 0.03;
  const axles = D.kind === 'truck' ? [D.hl - (D.L / 2 - D.wb / 2), -D.wb / 2] : [D.wb / 2, -D.wb / 2];
  for (const az of axles) for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * wx, D.r, az);
    const w = new THREE.Mesh(G.wg.tire, X.tire); w.castShadow = true; const rm = new THREE.Mesh(G.wg.rim, X.chrome); rm.scale.x = sx; w.add(rm); detail.push(rm);
    piv.add(w); root.add(piv); wheels.push({ piv, w, front: az > 0 });
  }
  // Seitenbeschriftung (zugeschnitten auf die Kontur)
  const decals = [], tx = livery(kind, D, colorIdx, liveryTex), Hc = (D.H || D.roofY) + 0.05;
  for (const [i, s] of [[0, 1], [1, -1]]) {
    const dm = new THREE.MeshPhysicalMaterial({ map: tx[i], transparent: true, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(D.L, Hc), dm); p.position.set(s * (D.W / 2 + 0.004), Hc / 2, 0); p.rotation.y = s * Math.PI / 2; p.renderOrder = 1;
    if (D.taper && (D.kind === 'van' || D.kind === 'truck')) { // Plane an die geneigte Flanke anpassen
      const g = p.geometry, pa = g.attributes.position; for (let j = 0; j < pa.count; j++) { const y = pa.getY(j) + Hc / 2; if (y > D.taper.y0) pa.setZ(j, -D.W / 2 * D.taper.k * Math.min(1, (y - D.taper.y0) / (D.taper.y1 - D.taper.y0))); } g.computeVertexNormals();
    }
    body.add(p); decals.push(p);
  }
  if (kind === 'tktruck') { // Kofferaufbau-Werbung
    const lt = liveryTex('tktruck'), boxL = D.L - D.cabL - 0.12, boxH = D.H - 0.78, w = boxL - 0.3, h = Math.min(boxH - 0.2, w * 400 / 1024);
    const dm = new THREE.MeshStandardMaterial({ map: lt, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dm); p.position.set(s * (D.W / 2 + 0.035), 0.78 + boxH / 2, -D.hl + boxL / 2); p.rotation.y = s * Math.PI / 2; body.add(p); decals.push(p); }
  }
  // Dachaufbauten
  let bar = null;
  if (kind === 'police' || kind === 'swat') {
    bar = new THREE.Group(); const y = D.roofY + 0.05 + 0.06, z = kind === 'police' ? -0.42 : D.hl - 1.9;
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.24, 0.07, 0.32, 2, 0.03), M.trim); base.position.set(0, y - 0.06, z); bar.add(base);
    const rl = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.1, 0.27, 2, 0.04), M.red.clone()); rl.position.set(-0.31, y, z);
    const bl = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.1, 0.27, 2, 0.04), M.blue.clone()); bl.position.set(0.31, y, z);
    const mid = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.09, 0.25, 2, 0.03), M.lights); mid.position.set(0, y, z);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.09), new THREE.MeshBasicMaterial({ map: signTex((g, W2, H2) => { g.fillStyle = '#0d2a7a'; g.fillRect(0, 0, W2, H2); fitText(g, 'POLIZEI', W2 / 2, H2 * 0.55, W2 * 0.9, H2 * 0.8, 900, '#fff'); }, 256, 48) }));
    sign.position.set(0, y + 0.1, z + 0.02); const sb = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.11, 0.03), M.trim); sb.position.set(0, y + 0.1, z); bar.add(sb, sign);
    bar.add(rl, bl, mid); bar.userData = { rl, bl }; body.add(bar);
    if (kind === 'police') { const hood = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.24), new THREE.MeshBasicMaterial({ map: liveryTex('police'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); hood.rotation.x = -Math.PI / 2 - 0.06; hood.position.set(0, 0.9 + 0.05 + 0.012, 1.7); body.add(hood); decals.push(hood); }
  }
  if (kind === 'taxi') {
    const s = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.2, 0.28, 2, 0.06), new THREE.MeshStandardMaterial({ color: 0xfff4cc, emissive: 0xffd040, emissiveIntensity: 0.9, roughness: 0.3 }));
    const y = D.roofY + 0.05 + 0.11, z = -0.4; s.position.set(0, y, z); s.castShadow = true; body.add(s);
    const st = signTex((g, W2, H2) => { g.fillStyle = '#ffd21a'; roundRect(g, 0, 0, W2, H2, 18); g.fill(); fitText(g, 'TAXI', W2 / 2, H2 * 0.56, W2 * 0.86, H2 * 0.82, 900, '#111'); }, 256, 80);
    for (const sz of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.16), new THREE.MeshBasicMaterial({ map: st, color: new THREE.Color(1.5, 1.5, 1.5) })); p.position.set(0, y, z + sz * 0.142); if (sz < 0) p.rotation.y = Math.PI; body.add(p); }
  }
  if (kind === 'tkvan' || kind === 'tktruck') { // T-Logo vorn
    const t = signTex((g, W2, H2) => { drawT(g, 0, 0, W2, '#fff', '#E20074'); }, 128, 128);
    const y = kind === 'tktruck' ? 1.55 : D.grY + 0.22, z = zAt(D.low, y, true) + 0.05 + 0.015;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 })); p.position.set(0, y, z); body.add(p);
  }
  // Fahrer
  const driver = new THREE.Mesh(getDriverGeo(kind === 'police' || kind === 'swat' ? 'cop' : 'civ'), M.char);
  driver.position.set(D.drv[0], D.drv[1], D.drv[2]); driver.scale.setScalar(0.92); body.add(driver);
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(7, 13).rotateX(-Math.PI / 2), M.beam); beam.position.set(0, 0.07, D.L / 2 + 6.5); beam.renderOrder = 3; root.add(beam);
  return { root, body, wheels, paintMesh, lightMesh, bar, driver, beam, kind, type: T, color, decals, v2: true, wheelR: D.r, detail, lod: false };
}
// Fern-Detailstufe: Felgen, Chrom und Kennzeichen ausblenden
export function setV2Lod(m, far) {
  if (m.lod === far) return; m.lod = far;
  for (const o of m.detail) o.visible = !far;
}
