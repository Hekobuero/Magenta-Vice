// Magenta Vice – Hilfsfunktionen & prozedurale Texturen
import * as THREE from 'three';

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const rng = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; };
export const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
export const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
export const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';
export const MAGENTA = '#E20074';

let maxAniso = 8;
export function setAniso(a) { maxAniso = a; }
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------- Logos (Vektor) ----------
const HEKO_W = 414.88, HEKO_H = 101.83;
const HEKO_NAVY = ["M0,95.73c0,6.1,6.1,6.1,6.1,6.1h7.95c.07,0,5.82-.05,6.07-5.73V61.06h57.07v35.03c.25,5.69,6,5.73,6.07,5.73h7.95s6.1,0,6.1-6.1V6.1C97.32,0,91.22,0,91.22,0h-7.94s-5.83,.02-6.08,5.73V40.77H20.12V5.73C19.87,.02,14.05,0,14.05,0H6.1S0,0,0,6.1V95.73H0Z", "M211.98,95.73c0,6.1,6.1,6.1,6.1,6.1h8.11c.07,0,5.96-.04,6.08-5.92v-29.47l45.14,33.98c1.08,.72,2.48,1.39,3.77,1.41h26.07c1.31-.27,3.48-1.32-3.38-6.02l-12.62-9.05h-.03l-51.49-35.76,51.44-35.84-.03,.02,12.73-9.08C312.38,.16,306.89,0,306.49,0h-24.35c-1.83,0-3.65,.69-5.02,1.68-.62,.44-1.46,1.06-2.2,1.61l-42.64,32.1V5.92C232.15,.01,226.19,0,226.19,0h-8.11S211.98,0,211.98,6.1V95.73h0Z", "M414.88,81.53v-24.87h-20.12v24.87h-60.54V20.3h24.55s-.03,0-.03,0V0h-24.53c-5.78,0-10.58,2.05-14.4,6.16-3.82,4.11-5.72,8.82-5.72,14.14v61.24c0,2.43,.23,4.68,.69,6.77,2.2,9.02,8.67,13.53,19.43,13.53h60.54c13.41,0,20.12-6.77,20.12-20.3", "M189.92,101.83s6.1,0,6.1-6.1v-8.11c0-5.27-4.55-5.99-5.79-6.08h-16.29s-38.29,0-38.29,0v-20.47h14.46v.03h31.38v-.03h8.96c1.49-.17,5.57-1.07,5.57-6.06v-8.13c0-5.69-5.3-6.07-6.02-6.1h-8.51s-31.32,0-31.32,0h0s-.06-.01-.06-.01v.02h-14.46V20.3h14.46v.02h.06s31.32-.01,31.32-.01h0s8.52,0,8.52,0c.77-.03,6-.44,6-6.1V6.1C196.02,0,189.92,0,189.92,0h-39.75s-28.72,0-28.72,0c0,0-6.1,0-6.1,6.1V95.73c0,6.1,6.1,6.1,6.1,6.1h68.46Z"];
const HEKO_BLUE = "M414.88,50.91V20.3c0-5.55-1.94-10.32-5.81-14.31C405.19,2,400.42,0,394.76,0h-30.27V20.3h30.27v30.62h20.12Z";
let hp = null;
export const HEKO_RATIO = HEKO_H / HEKO_W;
export function drawHeko(g, x, y, w, navy = '#262455', blue = '#009fe3') {
  if (!hp) hp = { navy: HEKO_NAVY.map(d => new Path2D(d)), blue: new Path2D(HEKO_BLUE) };
  const k = w / HEKO_W; g.save(); g.translate(x, y); g.scale(k, k);
  g.fillStyle = navy; for (const p of hp.navy) g.fill(p); g.fillStyle = blue; g.fill(hp.blue); g.restore();
}
// Telekom-T in einer 100×100-Box
export function drawT(g, x, y, size, color = '#fff', bg = null) {
  const k = size / 100; g.save(); g.translate(x, y); g.scale(k, k);
  if (bg) { g.fillStyle = bg; roundRect(g, 0, 0, 100, 100, 14); g.fill(); }
  g.fillStyle = color; g.fill(new Path2D('M20 22h60v14H57v48H43V36H20z')); g.fillRect(18, 52, 13, 13); g.fillRect(69, 52, 13, 13); g.restore();
}
export function fitText(g, txt, x, y, maxW, size, weight, color, italic = false) {
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;
  const tw = g.measureText(txt).width; if (tw > maxW) { size *= maxW / tw; g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`; }
  if (color) g.fillStyle = color; g.fillText(txt, x, y); return size;
}

// ---------- Basistexturen (hochauflösend, mit Normal-/Rauheits-Maps) ----------
export function noiseCanvas(w, h, base, amp, seed = 1, blobs = 0) {
  const c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  octaves(g, w, h, seed, amp / 255 * 0.9);
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  for (let k = 0; k < blobs; k++) { g.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * w, r() * h, 4 + r() * w * 0.06, 3 + r() * h * 0.035, r() * 3, 0, 7); g.fill(); }
  return c;
}
// Weiche Mehr-Oktaven-Flecken (kachelbar): kleine Zufallsbilder hochskaliert
function octaves(g, w, h, seed, alpha = 0.12) {
  const r = rng(seed * 31 + 7);
  for (const n of [8, 16, 32, 64]) {
    const c = canvas(n, n), cg = c.getContext('2d'), id = cg.createImageData(n, n);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    cg.putImageData(id, 0, 0);
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = 'overlay'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, w, h); g.restore();
  }
}
// Höhenbild (Graustufen-Canvas) → Normal-Map
export function normalFromHeight(hc, strength = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h), og = out.getContext('2d'), id = og.createImageData(w, h), d = id.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  og.putImageData(id, 0, 0);
  return tex(out, { repeat: true, linear: true });
}
function grain(g, w, h, seed, amp) {
  const r = rng(seed), id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
}
function asphaltBase(W, H, seed) {
  const c = canvas(W, H), g = c.getContext('2d'), hc = canvas(W, H), hg = hc.getContext('2d'), r = rng(seed);
  g.fillStyle = '#4b4e55'; g.fillRect(0, 0, W, H); octaves(g, W, H, seed, 0.16);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, W, H);
  // Splitt
  for (let k = 0; k < W * H / 30; k++) { const x = r() * W, y = r() * H, s = 0.6 + r() * 1.6, v = r(); g.fillStyle = v < 0.5 ? `rgba(20,20,24,${0.3 + r() * 0.4})` : `rgba(150,150,150,${0.15 + r() * 0.25})`; g.fillRect(x, y, s, s); hg.fillStyle = v < 0.5 ? 'rgba(40,40,40,.6)' : 'rgba(200,200,200,.6)'; hg.fillRect(x, y, s, s); }
  // Flickstellen & Risse
  for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '25,26,30' : '70,72,78'},${0.25 + r() * 0.2})`; const x = r() * W, y = r() * H; g.fillRect(x, y, 60 + r() * 160, 40 + r() * 120); }
  g.strokeStyle = 'rgba(15,15,18,.55)'; hg.strokeStyle = 'rgba(0,0,0,.8)';
  for (let k = 0; k < 9; k++) { let x = r() * W, y = r() * H; g.lineWidth = hg.lineWidth = 1 + r() * 1.5; g.beginPath(); hg.beginPath(); g.moveTo(x, y); hg.moveTo(x, y); for (let s = 0; s < 14; s++) { x += (r() - 0.5) * 40; y += (r() - 0.3) * 26; g.lineTo(x, y); hg.lineTo(x, y); } g.stroke(); hg.stroke(); }
  return { c, g, hc, hg, r };
}
export function asphaltTex() { const A = asphaltBase(1024, 1024, 7); return { map: tex(A.c, { repeat: true }), normalMap: normalFromHeight(A.hc, 3) }; }
// Fahrbahn 12 m breit (1024 px = 12 m), Kacheln entlang v
export function roadTex() {
  const W = 1024, H = 1024, A = asphaltBase(W, H, 11), { g, hg, r } = A;
  // Reifenspuren
  for (const x of [190, 330, 694, 834]) { const gr = g.createLinearGradient(x - 50, 0, x + 50, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 50, 0, 100, H); }
  const line = (x, w, col, dash) => { for (let y = 0; y < H; y += dash ? 256 : H) { const L = dash ? 150 : H; g.fillStyle = col; g.fillRect(x, y, w, L); hg.fillStyle = 'rgba(255,255,255,.35)'; hg.fillRect(x, y, w, L); } };
  line(42, 14, '#e9e7df', false); line(W - 56, 14, '#e9e7df', false);
  line(W / 2 - 16, 10, '#f0bf2a', false); line(W / 2 + 6, 10, '#f0bf2a', false);
  // Abnutzung der Markierungen
  for (let k = 0; k < 2500; k++) { const x = r() * W, y = r() * H; g.fillStyle = 'rgba(60,62,68,.5)'; g.fillRect(x, y, 2 + r() * 3, 2 + r() * 3); }
  // Gully
  g.fillStyle = '#2a2b2e'; g.fillRect(64, 600, 40, 70); g.fillStyle = '#18191b'; for (let k = 0; k < 6; k++) g.fillRect(68, 606 + k * 11, 32, 5);
  return { map: tex(A.c, { repeat: true }), normalMap: normalFromHeight(A.hc, 3) };
}
export function crossTex() {
  const W = 1024, A = asphaltBase(W, W, 13), { g, hg } = A;
  for (let s = 0; s < 4; s++) { g.save(); hg.save(); for (const q of [g, hg]) { q.translate(W / 2, W / 2); q.rotate(s * Math.PI / 2); } g.fillStyle = '#eae8e2'; hg.fillStyle = 'rgba(255,255,255,.4)'; for (let k = -5; k <= 5; k++) { g.fillRect(k * 76 - 22, 410, 44, 92); hg.fillRect(k * 76 - 22, 410, 44, 92); } g.restore(); hg.restore(); }
  return { map: tex(A.c), normalMap: normalFromHeight(A.hc, 3) };
}
// Gehwegplatten: 1024 px = 4 m, 4×4 Platten
export function sidewalkTex() {
  const W = 1024, c = canvas(W, W), g = c.getContext('2d'), hc = canvas(W, W), hg = hc.getContext('2d'), r = rng(21);
  g.fillStyle = '#8a8378'; g.fillRect(0, 0, W, W); hg.fillStyle = '#202020'; hg.fillRect(0, 0, W, W);
  const T = W / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 196 + (r() - 0.5) * 20, x0 = x * T + 3, y0 = y * T + 3, s = T - 6;
    g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(x0, y0, s, s);
    const gr = hg.createLinearGradient(x0, y0, x0 + s, y0 + s); gr.addColorStop(0, '#e8e8e8'); gr.addColorStop(1, '#c8c8c8');
    hg.fillStyle = gr; roundRect(hg, x0, y0, s, s, 8); hg.fill();
  }
  octaves(g, W, W, 21, 0.1); grain(g, W, W, 22, 14);
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(60,50,40,${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * W, r() * W, 10 + r() * 50, 6 + r() * 30, r() * 3, 0, 7); g.fill(); }
  return { map: tex(c, { repeat: true }), normalMap: normalFromHeight(hc, 2.5) };
}
export function grassTex() {
  const W = 1024, c = noiseCanvas(W, W, '#55803c', 26, 31), g = c.getContext('2d'), r = rng(5);
  octaves(g, W, W, 33, 0.35);
  for (let k = 0; k < 26000; k++) { const x = r() * W, y = r() * W; g.strokeStyle = `rgba(${50 + r() * 70},${85 + r() * 60},${25 + r() * 35},.6)`; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 4 - r() * 6); g.stroke(); }
  return { map: tex(c, { repeat: true }) };
}
export function sandTex() {
  const W = 1024, c = noiseCanvas(W, W, '#e6d3a6', 22, 41), g = c.getContext('2d'), hc = canvas(W, W), hg = hc.getContext('2d'), r = rng(9);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, W, W);
  for (let k = 0; k < 160; k++) { const x = r() * W, y = r() * W, L = 60 + r() * 140; for (const [q, col] of [[g, `rgba(170,140,95,${0.08 + r() * 0.08})`], [hg, 'rgba(255,255,255,.35)']]) { q.strokeStyle = col; q.lineWidth = 3 + r() * 4; q.beginPath(); q.moveTo(x, y); q.bezierCurveTo(x + L * 0.3, y - 8, x + L * 0.6, y + 8, x + L, y); q.stroke(); } }
  for (let k = 0; k < 9000; k++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(120,95,60,.3)'; g.fillRect(r() * W, r() * W, 1.5, 1.5); }
  hg.filter = 'blur(3px)'; hg.drawImage(hc, 0, 0); hg.filter = 'none';
  return { map: tex(c, { repeat: true }), normalMap: normalFromHeight(hc, 4) };
}
// Wasser-Normalmap (prozedural, kachelbar)
export function waterNormalTex(seed = 77, N = 512) {
  const c = canvas(N, N), g = c.getContext('2d'), id = g.createImageData(N, N), d = id.data;
  const waves = []; const r = rng(seed);
  for (let k = 0; k < 22; k++) waves.push({ fx: Math.round((r() - 0.5) * (6 + k * 2)), fy: Math.round((r() - 0.5) * (6 + k * 2)) || 1, a: 0.7 / (1 + k * 0.35), p: r() * 7 });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) { const ph = 2 * Math.PI * (w.fx * x + w.fy * y) / N + w.p; const c2 = Math.cos(ph) * w.a; dx += c2 * w.fx; dy += c2 * w.fy; }
    const nx = -dx * 0.035, ny = -dy * 0.035, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return tex(c, { repeat: true, linear: true });
}
// Palmenrinde: Ringe + Fasern (256×512)
export function barkTex() {
  const W = 256, H = 512, c = canvas(W, H), g = c.getContext('2d'), hc = canvas(W, H), hg = hc.getContext('2d'), r = rng(17);
  g.fillStyle = '#8a6c4c'; g.fillRect(0, 0, W, H); hg.fillStyle = '#808080'; hg.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 32) {
    const j = (r() - 0.5) * 6;
    const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, '#5a4430'); gr.addColorStop(0.25, '#9a7a56'); gr.addColorStop(0.8, '#7a5e40'); gr.addColorStop(1, '#4a3622');
    g.fillStyle = gr; g.fillRect(0, y + j, W, 32);
    const hgr = hg.createLinearGradient(0, y, 0, y + 32); hgr.addColorStop(0, '#202020'); hgr.addColorStop(0.3, '#e0e0e0'); hgr.addColorStop(1, '#303030');
    hg.fillStyle = hgr; hg.fillRect(0, y + j, W, 32);
  }
  for (let k = 0; k < 900; k++) { const x = r() * W, y = r() * H; g.strokeStyle = `rgba(${r() < 0.5 ? '40,28,16' : '180,150,110'},.35)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + 6 + r() * 10); g.stroke(); }
  grain(g, W, H, 18, 18);
  return { map: tex(c, { repeat: true }), normalMap: normalFromHeight(hc, 3) };
}
export function radialTex(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.35)') {
  const c = canvas(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, mid); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c);
}
// Fassaden: 8×8 Kacheln (1 Kachel = 1 Fensterachse × 1 Geschoss, 128 px)
// Ausgabe: Farbe, Leuchtfenster (Nacht), ORM (G = Rauheit, B = Metall) und Normal-Map
export function windowTex(kind, seed) {
  const C = 128, NC = 8, W = C * NC, r = rng(seed);
  const c = canvas(W, W), g = c.getContext('2d'), e = canvas(W, W), eg = e.getContext('2d'), o = canvas(W, W), og = o.getContext('2d'), hc = canvas(W, W), hg = hc.getContext('2d');
  eg.fillStyle = '#000'; eg.fillRect(0, 0, W, W);
  const glass = kind === 'glass';
  // Grundfläche
  if (glass) { g.fillStyle = '#9aa4b0'; og.fillStyle = 'rgb(0,90,230)'; } else { g.fillStyle = '#f1ebe1'; og.fillStyle = 'rgb(0,225,0)'; }
  g.fillRect(0, 0, W, W); og.fillRect(0, 0, W, W); hg.fillStyle = '#909090'; hg.fillRect(0, 0, W, W);
  if (!glass) { octaves(g, W, W, seed, 0.08); grain(g, W, W, seed + 1, 10); }
  for (let ty = 0; ty < NC; ty++) for (let tx = 0; tx < NC; tx++) {
    const x0 = tx * C, y0 = ty * C;
    let wx, wy, ww, wh;
    if (glass) {
      wx = x0 + 5; wy = y0 + 7; ww = C - 10; wh = C - 20;
      // Brüstungsband
      g.fillStyle = '#7d8794'; g.fillRect(x0, y0 + C - 13, C, 13); og.fillStyle = 'rgb(0,110,200)'; og.fillRect(x0, y0 + C - 13, C, 13);
      const gr = g.createLinearGradient(wx, wy, wx + ww * 0.6, wy + wh); const tone = 0.95 + r() * 0.1;
      gr.addColorStop(0, `rgb(${40 * tone},${70 * tone},${100 * tone})`); gr.addColorStop(0.55, `rgb(${85 * tone},${120 * tone},${155 * tone})`); gr.addColorStop(1, `rgb(${30 * tone},${52 * tone},${78 * tone})`);
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      og.fillStyle = 'rgb(0,18,255)'; og.fillRect(wx, wy, ww, wh);
      hg.fillStyle = '#6a6a6a'; hg.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#c3cad2'; g.fillRect(x0 + C / 2 - 1.5, wy, 3, wh); hg.fillStyle = '#b0b0b0'; hg.fillRect(x0 + C / 2 - 1.5, wy, 3, wh);
    } else {
      wx = x0 + 30; wy = y0 + 24; ww = C - 60; wh = C - 50;
      // Faschen (Rahmen) + Fensterbank
      g.fillStyle = '#fbf8f2'; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12); hg.fillStyle = '#b8b8b8'; hg.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      g.fillStyle = '#d9d2c6'; g.fillRect(wx - 9, wy + wh + 4, ww + 18, 7); hg.fillStyle = '#d0d0d0'; hg.fillRect(wx - 9, wy + wh + 4, ww + 18, 7);
      const gr = g.createLinearGradient(wx, wy, wx, wy + wh); gr.addColorStop(0, '#2c4258'); gr.addColorStop(0.5, '#5d7e9a'); gr.addColorStop(1, '#263a4d');
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh); og.fillStyle = 'rgb(0,20,200)'; og.fillRect(wx, wy, ww, wh);
      hg.fillStyle = '#3a3a3a'; hg.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#f4f1ea'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh * 0.38, ww, 3);
      hg.fillStyle = '#8a8a8a'; hg.fillRect(wx + ww / 2 - 2, wy, 4, wh); hg.fillRect(wx, wy + wh * 0.38, ww, 3);
      // Art-déco-Zierband unter der Decke
      g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(x0, y0 + C - 6, C, 6);
      g.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 4; k++) g.fillRect(x0 + 8 + k * 32, y0 + 6, 16, 4);
    }
    // Spiegelung/Vorhänge
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + ww * 0.35, wy); g.lineTo(wx + ww * 0.1, wy + wh); g.lineTo(wx, wy + wh); g.fill();
    if (!glass && r() < 0.3) { g.fillStyle = `rgba(${200 + r() * 55},${180 + r() * 60},${150 + r() * 80},.55)`; g.fillRect(wx + (r() < 0.5 ? 0 : ww * 0.55), wy, ww * 0.45, wh); }
    const litP = 0.25 + 0.35 * Math.sin(ty * 1.7 + seed) * Math.sin(tx * 0.9 + ty * 0.3) + 0.15;
    if (r() < litP) {
      const col = pick(r, ['#ffd9a0', '#ffe8c0', '#fff2d8', '#cfe4ff', '#ffc890', '#ffb0d8']);
      const gr2 = eg.createRadialGradient(wx + ww / 2, wy + wh * 0.4, 2, wx + ww / 2, wy + wh * 0.5, ww * 0.8); gr2.addColorStop(0, col); gr2.addColorStop(1, 'rgba(90,60,40,1)');
      eg.fillStyle = gr2; eg.fillRect(wx, wy, ww, wh);
    }
  }
  // (0,0)-Ecke = Dachfarbe (für Dach-UVs)
  g.fillStyle = glass ? '#6f7882' : '#a9a49b'; g.fillRect(0, 0, 4, 4); og.fillStyle = 'rgb(0,200,40)'; og.fillRect(0, 0, 4, 4); hg.fillStyle = '#909090'; hg.fillRect(0, 0, 4, 4); eg.fillStyle = '#000'; eg.fillRect(0, 0, 4, 4);
  const orm = tex(o, { repeat: true, linear: true });
  return { map: tex(c, { repeat: true }), emissiveMap: tex(e, { repeat: true }), orm, normalMap: normalFromHeight(hc, 2.2) };
}
export function signTex(draw, w = 1024, h = 256) {
  const c = canvas(w, h), g = c.getContext('2d'); g.textBaseline = 'middle'; g.textAlign = 'center';
  draw(g, w, h); return tex(c);
}
export function fmtEUR(cents) { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(cents / 100)) + ' €'; }
export function fmtEURc(cents) { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100) + ' €'; }
