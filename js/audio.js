// Magenta Vice – prozedurales Audio (WebAudio) + Sprachausgabe
// Alle Musikstücke werden live im Browser erzeugt (keine fremden Songs, keine Samples).
let ctx = null, master, musicBus, musicDuck, sfxBus, engineBus, comp, verb, verbSend, ambBus;
export const A = { on: true, musicVol: 0.5, station: 0, playing: false, track: null, errors: 0, notes: 0, speech: 0 };
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = A.on ? 0.9 : 0; master.connect(comp);
  // Musik: Bus → Duck (für DJ-Ansagen) → Master; Hall als Send
  musicDuck = ctx.createGain(); musicDuck.gain.value = 1; musicDuck.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(musicDuck);
  verb = ctx.createConvolver(); verb.buffer = impulse(1.8, 2.6); verbSend = ctx.createGain(); verbSend.gain.value = 1; verbSend.connect(verb);
  const verbOut = ctx.createGain(); verbOut.gain.value = 0.32; verb.connect(verbOut); verbOut.connect(musicBus);
  // Delay (Synthwave-Echo)
  const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
  dl.delayTime.value = 0.36; fb.gain.value = 0.3; lp.type = 'lowpass'; lp.frequency.value = 2600;
  musicBus.fx = ctx.createGain(); musicBus.fx.gain.value = 0.35; musicBus.fx.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicBus);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  engineBus = ctx.createGain(); engineBus.gain.value = 0; engineBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  brownBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const b = brownBuf.getChannelData(0); let last = 0; for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
  distCurve = makeCurve(18); hardCurve = makeCurve(60);
  buildEngine(); buildSiren(); buildAmbience();
  setInterval(schedule, 50);
}
function impulse(sec, decay) {
  const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return buf;
}
function makeCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
export function setMuted(m) { A.on = !m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); if (m) try { speechSynthesis.cancel(); } catch (e) { } }
let noiseBuf, brownBuf, distCurve, hardCurve;
function noise(t, dur, f0, type = 'bandpass', q = 1, vol = 0.3, bus = sfxBus, f1) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); return g;
}
function tone(t, dur, freq, type = 'square', vol = 0.2, bus = sfxBus, f1, att = 0.005) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05); return g;
}
// ---------- SFX ----------
const dv = d => Math.max(0, 1 - (d || 0) / 140);
export const sfx = {
  punch() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.12, 900, 'lowpass', 1, 0.6); tone(t, 0.12, 160, 'sine', 0.5, sfxBus, 60); },
  whoosh() { if (!ctx) return; noise(ctx.currentTime, 0.18, 600, 'bandpass', 2, 0.15, sfxBus, 2400); },
  boing() { if (!ctx) return; tone(ctx.currentTime, 0.35, 300, 'sine', 0.25, sfxBus, 900); },
  cash() { if (!ctx) return; const t = ctx.currentTime; tone(t, 0.12, 1318, 'square', 0.12); tone(t + 0.08, 0.35, 2093, 'square', 0.12); noise(t, 0.08, 4000, 'highpass', 1, 0.12); },
  pickup() { if (!ctx) return; const t = ctx.currentTime; [784, 988, 1318].forEach((f, k) => tone(t + k * 0.06, 0.16, f, 'square', 0.1)); },
  crash(v = 1) { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.4, 500, 'lowpass', 0.7, 0.5 * v); noise(t, 0.25, 3000, 'bandpass', 1, 0.25 * v); tone(t, 0.2, 90, 'triangle', 0.3 * v, sfxBus, 40); },
  door() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.08, 300, 'lowpass', 1, 0.4); tone(t, 0.08, 120, 'square', 0.1, sfxBus, 80); },
  horn() { if (!ctx) return; const t = ctx.currentTime; tone(t, 0.45, 392, 'sawtooth', 0.12, sfxBus, null, 0.01); tone(t, 0.45, 494, 'sawtooth', 0.1, sfxBus, null, 0.01); },
  star() { if (!ctx) return; const t = ctx.currentTime; tone(t, 0.18, 880, 'square', 0.1); tone(t + 0.12, 0.25, 660, 'square', 0.1); },
  mission() { if (!ctx) return; const t = ctx.currentTime; [523, 659, 784, 1046, 784, 1046].forEach((f, k) => tone(t + k * 0.1, 0.22, f, 'square', 0.1)); },
  fail() { if (!ctx) return; const t = ctx.currentTime; [392, 330, 262, 196].forEach((f, k) => tone(t + k * 0.16, 0.3, f, 'triangle', 0.18)); },
  click() { if (!ctx) return; tone(ctx.currentTime, 0.05, 1200, 'square', 0.06); },
  splash() { if (!ctx) return; noise(ctx.currentTime, 0.9, 1200, 'lowpass', 0.5, 0.5, sfxBus, 300); },
  robTick() { if (!ctx) return; tone(ctx.currentTime, 0.05, 1500, 'square', 0.05); },
  // Waffen (Entfernung d in Metern dämpft und filtert)
  shot(kind, d = 0) {
    if (!ctx) return; const t = ctx.currentTime, v = dv(d); if (v <= 0.01) return;
    const far = d > 30, lpF = far ? 2200 : 9000;
    if (kind === 'schrotflinte') { noise(t, 0.45, lpF, 'lowpass', 0.7, 0.9 * v, sfxBus, 300); tone(t, 0.35, 110, 'sine', 0.9 * v, sfxBus, 32); noise(t, 0.06, 2500, 'bandpass', 0.8, 0.6 * v); }
    else if (kind === 'uzi') { noise(t, 0.11, lpF, 'lowpass', 0.8, 0.55 * v, sfxBus, 900); tone(t, 0.08, 150, 'sine', 0.45 * v, sfxBus, 60); noise(t, 0.03, 4200, 'bandpass', 1.2, 0.35 * v); }
    else { noise(t, 0.2, lpF, 'lowpass', 0.8, 0.75 * v, sfxBus, 500); tone(t, 0.16, 140, 'sine', 0.7 * v, sfxBus, 45); noise(t, 0.04, 3200, 'bandpass', 1, 0.5 * v); if (!far) noise(t + 0.05, 0.5, 1800, 'bandpass', 0.5, 0.08 * v, sfxBus, 600); }
  },
  empty() { if (!ctx) return; const t = ctx.currentTime; tone(t, 0.04, 2400, 'square', 0.08); noise(t, 0.03, 5000, 'highpass', 1, 0.1); },
  reload() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.05, 2500, 'bandpass', 2, 0.2); noise(t + 0.18, 0.06, 1800, 'bandpass', 2, 0.25); },
  ricochet(d = 0) { if (!ctx) return; const t = ctx.currentTime, v = dv(d) * 0.5; if (v < 0.02) return; tone(t, 0.18, 2600 + Math.random() * 1500, 'sine', 0.12 * v, sfxBus, 900); noise(t, 0.04, 4000, 'bandpass', 2, 0.2 * v); },
  metal(d = 0) { if (!ctx) return; const t = ctx.currentTime, v = dv(d); tone(t, 0.12, 820 + Math.random() * 300, 'triangle', 0.18 * v, sfxBus, 500); noise(t, 0.05, 3000, 'bandpass', 1.5, 0.3 * v); },
  thud(d = 0) { if (!ctx) return; const t = ctx.currentTime, v = dv(d); noise(t, 0.09, 600, 'lowpass', 1, 0.45 * v); tone(t, 0.08, 120, 'sine', 0.3 * v, sfxBus, 70); },
  explosion(d = 0) {
    if (!ctx) return; const t = ctx.currentTime, v = Math.max(0.15, dv(d * 0.6));
    noise(t, 1.8, 1400, 'lowpass', 0.6, 1.2 * v, sfxBus, 70); tone(t, 1.2, 70, 'sine', 1.1 * v, sfxBus, 24); noise(t, 0.12, 3000, 'bandpass', 0.6, 0.7 * v);
    for (let k = 0; k < 6; k++) noise(t + 0.15 + Math.random() * 0.9, 0.08, 2000 + Math.random() * 2000, 'bandpass', 1, 0.12 * v);
  },
  wheel() { if (!ctx) return; const t = ctx.currentTime; tone(t, 0.06, 660, 'sine', 0.08); tone(t + 0.04, 0.08, 990, 'sine', 0.06); },
};
// ---------- Motor ----------
let eng = null;
function buildEngine() {
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = -1200 + 7; lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.5;
  o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.gain.value = 0.18; g.connect(engineBus); o1.start(); o2.start();
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 800; const ng = ctx.createGain(); ng.gain.value = 0; ns.connect(nf); nf.connect(ng); ng.connect(engineBus); ns.start();
  eng = { o1, o2, lp, ng };
}
// Motor und Radio ausbalancieren: Läuft Musik, wird der Motor leiser; bei hohem Tempo hebt das Radio leicht an
export function engine(on, rpm, load, skid) {
  if (!ctx || !eng) return; const t = ctx.currentTime;
  const radio = A.playing ? 1 : 0;
  engineBus.gain.setTargetAtTime(on ? (radio ? 0.11 + load * 0.05 : 0.22) : 0, t, 0.1);
  if (radio) musicBus.gain.setTargetAtTime(A.musicVol * (0.5 + Math.min(0.18, rpm * 0.1)), t, 0.4);
  const f = 38 + rpm * 120; eng.o1.frequency.setTargetAtTime(f, t, 0.05); eng.o2.frequency.setTargetAtTime(f, t, 0.05);
  eng.lp.frequency.setTargetAtTime(350 + load * 1400 + rpm * 500, t, 0.05);
  eng.ng.gain.setTargetAtTime(skid * 0.5, t, 0.05);
}
// ---------- Sirene ----------
let sir = null;
function buildSiren() {
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.value = 760; lfo.type = 'sine'; lfo.frequency.value = 0.55; lg.gain.value = 240; lfo.connect(lg); lg.connect(o.frequency);
  lp.type = 'lowpass'; lp.frequency.value = 1800; o.connect(lp); lp.connect(g); g.gain.value = 0; g.connect(master); o.start(); lfo.start();
  sir = { g, lp };
}
export function siren(vol) { if (!sir) return; sir.g.gain.setTargetAtTime(Math.min(0.09, vol * 0.09), ctx.currentTime, 0.2); }
// ---------- Umgebung: Meer, Stadtrauschen, Vögel (Tag), Zikaden (Nacht) ----------
let amb = null;
function buildAmbience() {
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const g = ctx.createGain(); g.gain.value = 0;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  ns.connect(lp); lp.connect(g); g.connect(ambBus); ns.start();
  const cs = ctx.createBufferSource(); cs.buffer = brownBuf; cs.loop = true;
  const clp = ctx.createBiquadFilter(); clp.type = 'lowpass'; clp.frequency.value = 420; const cg = ctx.createGain(); cg.gain.value = 0;
  cs.connect(clp); clp.connect(cg); cg.connect(ambBus); cs.start();
  amb = { g, cg, foot: 0, night: 0, city: 0, nextBird: 0 };
}
export function ambience(sea, city = 0.5, night = 0, foot = 1) {
  if (!amb) return; const t = ctx.currentTime;
  amb.g.gain.setTargetAtTime(0.02 + sea * 0.09, t, 0.5);
  amb.cg.gain.setTargetAtTime(foot ? 0.05 + city * 0.08 : 0.015, t, 0.6);
  amb.foot = foot; amb.night = night; amb.city = city;
}
function ambTick() {
  if (!amb || !amb.foot) return; const t = ctx.currentTime;
  if (t < amb.nextBird) return;
  if (amb.night > 0.5) { // Zikaden
    for (let k = 0; k < 6; k++) tone(t + k * 0.045, 0.03, 4300 + Math.random() * 300, 'sine', 0.012, ambBus);
    amb.nextBird = t + 0.6 + Math.random() * 1.6;
  } else { // Vögel & ferne Hupe
    if (Math.random() < 0.82) { const f = 2400 + Math.random() * 1800; for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) tone(t + k * 0.11, 0.08, f * (1 + Math.random() * 0.2), 'sine', 0.018, ambBus, f * 1.35); }
    else if (amb.city > 0.3) { tone(t, 0.3, 370, 'sawtooth', 0.008, ambBus); tone(t, 0.3, 466, 'sawtooth', 0.007, ambBus); }
    amb.nextBird = t + 1.5 + Math.random() * 4;
  }
}

// ---------- Radio ----------
// Sender (Parodie-Namen). Genres: hiphop, trap, rnb, rock, synthwave, electro, cyber
export const STATIONS = [
  { name: 'MAGENTA JAM FM', sub: 'Hip-Hop & R&B · Nur Hits, kein Funkloch', styles: ['hiphop', 'trap', 'rnb', 'hiphop'], pitch: 0.95, rate: 1.1 },
  { name: 'Glasfaser Groove', sub: 'R&B, Soul & Slow Jams', styles: ['rnb', 'rnb', 'hiphop'], pitch: 1.1, rate: 0.95 },
  { name: 'T-Rock 5G', sub: 'Rock mit voller Bandbreite', styles: ['rock'], pitch: 0.8, rate: 1.05 },
  { name: 'Elektro Netz', sub: 'Electro & Synthwave · Ocean Drive 1986', styles: ['synthwave', 'electro'], pitch: 1.0, rate: 1.0 },
  { name: 'Cyber Tarif 2077', sub: 'Cyberpunk · Darksynth aus der Zukunft', styles: ['cyber'], pitch: 0.7, rate: 0.95 },
];
export const GENRE_STATION = { jam: 0, groove: 1, rock: 2, elektro: 3, cyber: 4 };
const ARTISTS = {
  hiphop: [['MC Bandbreite', 'Highspeed vor Ort'], ['Notorious D.S.L.', 'Kein Funkloch in meiner Hood'], ['Lil Router', 'Router im Benz'], ['Big Daddy Kabel', 'Unterschreib hier'], ['50 Mbit', 'Provision (Remix)'], ['Glasfaser Gang', 'Magenta Money']],
  trap: [['Young Ping', 'Ping unter zehn'], ['Lil Latenz', 'Drip im Datennetz'], ['Trap Tarif', 'Flatrate Flex']],
  rnb: [['Smooth Signal', 'Bleib verbunden'], ['Lady Latenz', 'Deine Bandbreite'], ['Velvet WLAN', 'Nachts im Netz'], ['Soulfaser', 'Nur du und mein Hotspot']],
  rock: [['Die Kupferkabel', 'Funkloch-Blues'], ['Netzausfall', 'Highway zur Glasfaser'], ['Mast & Furious', 'Ich bin dein Sendemast'], ['Die Toten Leitungen', 'Störung im Bereich']],
  synthwave: [['Neon Router', 'Ocean Drive 1986'], ['Synthwave Sendemast', 'Magenta Sunset'], ['Retro Roaming', 'Nachtfahrt']],
  electro: [['DJ Downlink', 'Glasfaser Nights'], ['Kraftnetz', 'Datenautobahn'], ['Bass Station Null', 'Upload']],
  cyber: [['Netrunner Nils', 'Firewall'], ['Ghost im Glasfaser', 'Datenstrom'], ['Chrome Kongstar', 'Neon-Abo'], ['Cyber Tarif', 'Vertragslaufzeit 2077']],
};
const DJ = [
  ['Yo, yo, yo! Magenta Jam F M! Der heißeste Hip-Hop der Stadt, schneller als jedes Kupferkabel.', 'Magenta Jam F M. Fenster runter, Bass hoch, Vertrag unterschreiben!', 'Ihr hört Magenta Jam F M. Nur Hits, kein Funkloch.'],
  ['Glasfaser Groove. Lehnt euch zurück, wir haben die Bandbreite für eure Gefühle.', 'Hier ist Glasfaser Groove. Smoother als ein Router ohne Störung.', 'Glasfaser Groove. Slow Jams für schnelle Leitungen.'],
  ['T Rock fünf G! Hier wird nicht gedrosselt!', 'Ihr hört T Rock fünf G. Gitarren mit voller Netzabdeckung!', 'T Rock fünf G. Lauter als jeder Sendemast!'],
  ['Elektro Netz. Neon an, Sonnenbrille auf, wir fahren den Ocean Drive entlang.', 'Ihr hört Elektro Netz. Synthesizer mit Lichtgeschwindigkeit.', 'Elektro Netz. Der Sound der Magenta-Nächte.'],
  ['Cyber Tarif zwei null sieben sieben. Willkommen in der Zukunft. Ihr Vertrag läuft noch hundert Jahre.', 'Hier ist Cyber Tarif zwei null sieben sieben. Upload eures Bewusstseins nur mit Glasfaser.', 'Cyber Tarif zwei null sieben sieben. Chrom, Neon, Netz.'],
];
const ADS = ['Werbung: Wechseln Sie jetzt zu Kongstar. Billig. Und so. Kleingedrucktes inklusive.', 'Werbung: O Null Zwei. Funkloch? Wir nennen es digitale Entgiftung.', 'Werbung: Eins und Eins. Unsere Warteschleife hat jetzt auch Glasfaser.', 'Werbung: Heko Büroservice. Ihr Partner im Vertrieb. Mehr Verträge, mehr Provision.', 'Werbung: Ammu-Netz am Strand. Waffen, Munition und Zielfernrohre mit fünf G.', 'Verkehrsmeldung: Auf dem Ocean Drive staut es sich wegen zu vieler Sportwagen. Bitte Abstand halten.'];
let nextNote = 0, step = 0, trk = null, lastSpeak = 0, trackN = 0;
function mkRng(s) { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e6) / 1e6; }; }
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
const STYLE = {
  hiphop: { bpm: [86, 96], scale: 'minor', swing: 0.58, progs: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 0, 5, 6]] },
  trap: { bpm: [136, 150], scale: 'minor', swing: 0.5, half: true, progs: [[0, 5, 0, 6], [0, 3, 5, 3]] },
  rnb: { bpm: [66, 78], scale: 'dorian', swing: 0.6, progs: [[1, 4, 0, 5], [0, 3, 1, 4], [5, 3, 0, 4]] },
  rock: { bpm: [118, 142], scale: 'minor', swing: 0.5, progs: [[0, 5, 6, 4], [0, 3, 4, 6], [0, 6, 5, 4]] },
  synthwave: { bpm: [100, 112], scale: 'minor', swing: 0.5, progs: [[0, 5, 3, 6], [0, 3, 5, 4]] },
  electro: { bpm: [122, 128], scale: 'minor', swing: 0.5, progs: [[0, 0, 5, 3], [0, 5, 3, 4]] },
  cyber: { bpm: [92, 108], scale: 'phryg', swing: 0.5, progs: [[0, 1, 0, 5], [0, 0, 1, 6]] },
};
function makeTrack(stIdx, n) {
  const st = STATIONS[stIdx], style = st.styles[n % st.styles.length], S = STYLE[style];
  const r = mkRng(stIdx * 7919 + n * 104729 + 13);
  const bpm = Math.round(S.bpm[0] + r() * (S.bpm[1] - S.bpm[0]));
  const root = 40 + Math.floor(r() * 7); // E2..A#2
  const prog = S.progs[Math.floor(r() * S.progs.length)];
  const hook = []; for (let k = 0; k < 32; k++) hook.push(r() < (style === 'cyber' || style === 'electro' ? 0.7 : 0.5) ? Math.floor(r() * 7) + (r() < 0.2 ? 7 : 0) : -1);
  const bassR = []; for (let k = 0; k < 16; k++) bassR.push(r());
  const art = ARTISTS[style][Math.floor(r() * ARTISTS[style].length)];
  const bars = Math.max(24, Math.round(85 / (240 / bpm) / 4) * 4); // ≈ 85–100 s
  return { style, S, bpm, root, scale: SCALES[S.scale], prog, hook, bassR, bars, artist: art[0], title: art[1], r, kickVar: Math.floor(r() * 3) };
}
function deg(T, d, oct = 0) { const sc = T.scale, o = Math.floor(d / sc.length); return T.root + sc[((d % sc.length) + sc.length) % sc.length] + 12 * (o + oct); }
export function setStation(i, announce = false) {
  A.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
  trackN = Math.floor(Math.random() * 6); trk = makeTrack(A.station, trackN); step = Math.floor(Math.random() * 8) * 16; // mitten im Song einsteigen
  A.track = { artist: trk.artist, title: trk.title, style: trk.style };
  if (ctx) nextNote = ctx.currentTime + 0.08;
  if (announce) jingle();
}
export function radioOn(on) {
  if (!ctx) return; A.playing = on;
  musicBus.gain.setTargetAtTime(on ? A.musicVol * 0.5 : 0, ctx.currentTime, 0.15);
  if (!on) { try { speechSynthesis.cancel(); } catch (e) { } musicDuck.gain.setTargetAtTime(1, ctx.currentTime, 0.1); }
}
export function jingle(extra) {
  const j = DJ[A.station], st = STATIONS[A.station];
  let txt = j[Math.floor(Math.random() * j.length)];
  if (trk && Math.random() < 0.7) txt += ` Jetzt: ${trk.artist} mit ${trk.title}.`;
  if (extra) txt = extra + ' ' + txt;
  djSpeak(txt, st.rate, st.pitch);
}
function djSpeak(text, rate, pitch) {
  if (!A.playing) return;
  speak(text, rate, pitch, 1);
  if (ctx) { const t = ctx.currentTime, dur = Math.min(9, 0.9 + text.length * 0.062); musicDuck.gain.setTargetAtTime(0.42, t, 0.08); musicDuck.gain.setTargetAtTime(1, t + dur, 0.4); }
}
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices().filter(v => /^de/i.test(v.lang)); } catch (e) { } }
if (typeof speechSynthesis !== 'undefined') { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
export function speak(text, rate = 1, pitch = 1, vol = 1) {
  try {
    if (typeof speechSynthesis === 'undefined' || !A.on) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = rate; u.pitch = pitch; u.volume = vol;
    if (voices.length) u.voice = voices[0];
    speechSynthesis.speak(u); lastSpeak = performance.now(); A.speech++;
  } catch (e) { }
}
export function shout(text) { speak(text, 1.18, 0.75, 1); }
export function policeRadio(text) {
  if (!ctx) return; const t = ctx.currentTime;
  noise(t, 0.25, 2200, 'bandpass', 3, 0.15); tone(t + 0.02, 0.08, 1800, 'square', 0.05);
  speak(text, 1.15, 0.8, 0.9);
}
function schedule() {
  if (!ctx) return;
  try { ambTick(); } catch (e) { A.errors++; }
  if (!A.playing || !trk) return;
  const spb = 60 / trk.bpm / 4; // 16tel
  if (nextNote < ctx.currentTime - 0.2) nextNote = ctx.currentTime + 0.05;
  while (nextNote < ctx.currentTime + 0.15) {
    try { playStep(trk, step, nextNote, spb); A.notes++; } catch (e) { A.errors++; }
    nextNote += spb; step++;
    if (step >= trk.bars * 16) { // nächster Song mit DJ-Ansage oder Werbung
      trackN++; trk = makeTrack(A.station, trackN); step = 0; A.track = { artist: trk.artist, title: trk.title, style: trk.style };
      if (Math.random() < 0.25) djSpeak(ADS[Math.floor(Math.random() * ADS.length)], 1.08, 1); else jingle();
    }
  }
}
// ---------- Instrumente ----------
function kick(t, v, f0 = 150, dur = 0.3) { tone(t, dur, f0, 'sine', 0.85 * v, musicBus, 42); }
function snare(t, v, tone0 = 190, len = 0.18) { noise(t, len, 1800, 'bandpass', 0.7, 0.32 * v, musicBus); tone(t, 0.08, tone0, 'triangle', 0.18 * v, musicBus, tone0 * 0.6); noise(t, len * 1.6, 2000, 'bandpass', 0.6, 0.12 * v, verbSend); }
function clap(t, v) { for (let k = 0; k < 3; k++) noise(t + k * 0.011, 0.12, 1500, 'bandpass', 1.2, 0.17 * v, musicBus); noise(t + 0.03, 0.3, 1500, 'bandpass', 1, 0.08 * v, verbSend); }
function hat(t, v, open = false) { noise(t, open ? 0.22 : 0.035, 8500, 'highpass', 1, (open ? 0.07 : 0.06) * v, musicBus); }
function rim(t, v) { tone(t, 0.04, 1700, 'square', 0.05 * v, musicBus); noise(t, 0.03, 3000, 'bandpass', 3, 0.08 * v, musicBus); }
function crash(t, v) { noise(t, 1.4, 6000, 'highpass', 0.6, 0.09 * v, musicBus); }
function sub808(t, n, dur, v, slideTo) {
  const o = ctx.createOscillator(), g = ctx.createGain(), ws = ctx.createWaveShaper(); ws.curve = distCurve;
  o.type = 'sine'; o.frequency.setValueAtTime(midi(n), t); if (slideTo) o.frequency.exponentialRampToValueAtTime(midi(slideTo), t + dur * 0.5);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42 * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(ws); ws.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
}
function bassNote(t, n, dur, v, type = 'sawtooth', cut = 1200, q = 5) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = type; o.frequency.value = midi(n);
  f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.18), t + dur); f.Q.value = q;
  g.gain.setValueAtTime(0.22 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.1);
  o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur * 1.2);
}
// E-Piano (Rhodes-artig): Grundton + kurz abklingender Oberton
function ep(t, n, dur, v) {
  const f = midi(n);
  const g = tone(t, dur, f, 'sine', 0.06 * v, musicBus, null, 0.008); g.connect(verbSend);
  tone(t, Math.min(0.5, dur), f * 2.01, 'sine', 0.025 * v, musicBus, null, 0.003);
  tone(t, 0.12, f * 4.2, 'sine', 0.012 * v, musicBus, null, 0.002);
}
function pad(t, n, dur, v, type = 'sawtooth', cut = 1300, send = true) {
  for (const det of [-9, 9]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = midi(n); o.detune.value = det; f.type = 'lowpass'; f.frequency.value = cut;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03 * v, t + dur * 0.25); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus); if (send) g.connect(verbSend); o.start(t); o.stop(t + dur + 0.05);
  }
}
function pluck(t, n, dur, v, type = 'triangle', fx = true) { const g = tone(t, dur, midi(n), type, 0.07 * v, musicBus, null, 0.003); if (fx) g.connect(musicBus.fx); }
function voxLead(t, n, dur, v) { // weiche "Gesangs"-Melodie (Sinus mit Vibrato + Formant)
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(midi(n) * 0.985, t); o.frequency.linearRampToValueAtTime(midi(n), t + 0.06);
  lfo.frequency.value = 5.2; lg.gain.value = 4; lfo.connect(lg); lg.connect(o.frequency);
  bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(bp); bp.connect(g); g.connect(musicBus); g.connect(verbSend); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
function guitar(t, n, dur, v, mute = false, power = true) { // verzerrte Powerchords
  const g = ctx.createGain(), ws = ctx.createWaveShaper(), cab = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter();
  ws.curve = hardCurve; cab.type = 'lowpass'; cab.frequency.value = mute ? 1500 : 3400; hp.type = 'highpass'; hp.frequency.value = 90;
  const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(0.32, t + 0.004); env.gain.exponentialRampToValueAtTime(0.001, t + (mute ? 0.13 : dur));
  for (const [iv, det] of power ? [[0, -6], [7, 5], [12, 3]] : [[0, -4], [0, 4]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n + iv); o.detune.value = det; o.connect(env); o.start(t); o.stop(t + dur + 0.05); }
  env.connect(ws); ws.connect(hp); hp.connect(cab); cab.connect(g); g.gain.value = 0.085 * v; g.connect(musicBus); if (!mute) g.connect(verbSend);
}
function acid(t, n, dur, v, cut) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = midi(n); f.type = 'lowpass'; f.Q.value = 14; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(180, t + dur);
  g.gain.setValueAtTime(0.12 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(musicBus); g.connect(musicBus.fx); o.start(t); o.stop(t + dur + 0.05);
}
function growl(t, n, dur, v) { // Cyberpunk-Bass: Säge → Verzerrung → wandernder Bandpass
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), ws = ctx.createWaveShaper(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = midi(n); o2.frequency.value = midi(n) * 0.5; ws.curve = hardCurve;
  bp.type = 'bandpass'; bp.Q.value = 4; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.5); bp.frequency.exponentialRampToValueAtTime(260, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(ws); o2.connect(ws); ws.connect(bp); bp.connect(g); g.connect(musicBus); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
// ---------- Sequenzer ----------
function playStep(T, s, t0, spb) {
  const bars = T.bars, bar = Math.floor(s / 16), i = s % 16, chord = T.prog[bar % 4];
  const sec = bar < 4 ? 'intro' : bar >= bars - 4 ? 'outro' : (Math.floor((bar - 4) / 8) % 2 ? 'hook' : 'verse');
  const v = sec === 'intro' || sec === 'outro' ? 0.6 : 1, hook = sec === 'hook', drums = sec !== 'intro' || bar >= 2;
  const t = t0 + (i % 2 ? (T.S.swing - 0.5) * 2 * spb : 0); // Swing auf Off-16teln
  const st = T.style, hl = T.hook[(bar % 2) * 16 + i];
  if (st === 'hiphop') {
    if (drums) {
      if (i === 0 || i === 10 || (T.kickVar === 1 && i === 7) || (T.kickVar === 2 && i === 3)) kick(t, v);
      if (i === 4 || i === 12) { snare(t, v); if (hook) clap(t, v * 0.7); }
      if (i % 2 === 0) hat(t, v * (i % 4 === 2 ? 0.7 : 1)); if (i === 14 && bar % 2) hat(t, v, true);
    }
    if (i === 0 || i === 10) sub808(t, deg(T, chord, -1), spb * 5, v);
    if (i === 0 || i === 6) for (const d of [0, 2, 4, 6]) ep(t + d * 0.006, deg(T, chord + d, 1), spb * (i === 0 ? 6 : 8), v * 0.9);
    if (hook && hl >= 0 && i % 2 === 0) pluck(t, deg(T, chord + hl, 2), spb * 2.2, v * 0.8, 'triangle');
    if (i === 0 && bar % 4 === 0) noise(t, 3.2, 3000, 'bandpass', 0.4, 0.008, musicBus); // Vinylknistern
  } else if (st === 'trap') {
    if (drums) {
      if (i === 0 || (i === 11 && T.kickVar) || (i === 14 && bar % 2)) kick(t, v, 120, 0.25);
      if (i === 8) { clap(t, v); snare(t, v * 0.6, 220, 0.12); }
      const roll = hook && bar % 2 === 1 && i >= 12;
      hat(t, v * (i % 2 ? 0.55 : 0.85)); if (roll) { hat(t + spb / 3, v * 0.5); hat(t + spb * 2 / 3, v * 0.5); }
    }
    if (i === 0 || (i === 11 && T.bassR[bar % 16] > 0.4)) sub808(t, deg(T, chord, -1), spb * 7, v * 1.1, i === 11 && T.bassR[i] > 0.6 ? deg(T, chord + 2, -1) : null);
    if (i === 0) pad(t, deg(T, chord, 1), spb * 16, v * 0.8, 'triangle', 1600);
    if (hl >= 0 && (hook || i % 4 === 0)) pluck(t, deg(T, chord + hl, 2), spb * 1.5, v * 0.7, 'sine');
  } else if (st === 'rnb') {
    if (drums) {
      if (i === 0 || i === 9 || (T.kickVar && i === 11)) kick(t, v * 0.75, 120, 0.35);
      if (i === 4 || i === 12) { rim(t, v); noise(t, 0.12, 2500, 'bandpass', 1, 0.08 * v, musicBus); }
      noise(t, 0.04, 6500, 'highpass', 1, (i % 2 ? 0.025 : 0.04) * v, musicBus); // Shaker
    }
    if (i === 0 || i === 9) bassNote(t, deg(T, chord, -1), spb * 6, v * 0.9, 'sine', 600, 1);
    if (i === 0) { for (const d of [0, 2, 4, 6, 8]) ep(t + d * 0.012, deg(T, chord + d, 1), spb * 14, v * 0.85); pad(t, deg(T, chord + 2, 1), spb * 16, v * 0.6, 'triangle', 1200); }
    if ((hook || sec === 'verse') && hl >= 0 && i % 4 === 0) voxLead(t, deg(T, chord + hl, 2), spb * 3.6, v * (hook ? 1 : 0.6));
  } else if (st === 'rock') {
    if (drums) {
      if (i === 0 || i === 8 || (T.kickVar && i === 10) || (hook && i === 6)) kick(t, v, 130, 0.22);
      if (i === 4 || i === 12) snare(t, v * 1.2, 200, 0.22);
      if (i % 2 === 0) hook ? noise(t, 0.25, 7000, 'highpass', 0.7, 0.05 * v, musicBus) : hat(t, v);
      if (i === 0 && (bar % 8 === 0 || (hook && bar % 4 === 0))) crash(t, v);
    }
    if (i % 2 === 0) bassNote(t, deg(T, chord, -1), spb * 1.8, v, 'square', 900, 2);
    if (hook) { if (i === 0 || i === 6 || i === 12) guitar(t, deg(T, chord, 0), spb * (i === 12 ? 4 : 6), v); if (hl >= 0 && i % 2 === 0 && bar % 2) guitar(t, deg(T, chord + hl, 1), spb * 2, v * 0.55, false, false); }
    else if (sec !== 'intro' || bar >= 2) { if (i % 2 === 0) guitar(t, deg(T, chord, 0), spb, v * 0.9, true); }
    else if (i === 0) guitar(t, deg(T, chord, 0), spb * 16, v * 0.8);
  } else if (st === 'synthwave') {
    if (drums) {
      if (i === 0 || i === 8 || i === 10) kick(t, v);
      if (i === 4 || i === 12) { noise(t, 0.35, 1800, 'bandpass', 0.6, 0.33 * v, musicBus); noise(t, 0.5, 1800, 'bandpass', 0.6, 0.2 * v, verbSend); }
      if (i % 2 === 0) hat(t, v * 0.8);
    }
    bassNote(t, deg(T, chord, -1) + (i % 2 ? 12 : 0), spb * 1.5, v, 'sawtooth', 1400, 6);
    if (i === 0) for (const d of [0, 2, 4]) pad(t, deg(T, chord + d, 0), spb * 16, v, 'sawtooth', 1100);
    if (hl >= 0 && i % 2 === 0 && sec !== 'intro') { const g = tone(t, spb * 2.6, midi(deg(T, chord + hl, 1)), 'sawtooth', 0.045 * v, musicBus); g.connect(musicBus.fx); }
  } else if (st === 'electro') {
    if (drums) {
      if (i % 4 === 0) kick(t, v * 1.05, 160, 0.28);
      if (i === 4 || i === 12) clap(t, v);
      if (i % 4 === 2) hat(t, v * 1.2, true); else if (i % 2) hat(t, v * 0.5);
    }
    if (i % 4 === 2 || (T.bassR[i] > 0.7)) bassNote(t, deg(T, chord, -1), spb * 1.4, v, 'sawtooth', 900, 8);
    if (hook) { if (i === 0 || i === 3 || i === 6 || i === 10) for (const d of [0, 2, 4]) { const g = tone(t, spb * 1.2, midi(deg(T, chord + d, 1)), 'sawtooth', 0.03 * v, musicBus); g.connect(verbSend); } }
    else if (hl >= 0) acid(t, deg(T, chord + hl, 0), spb * 1.2, v, 600 + 2400 * ((bar % 4) / 4 + i / 64));
  } else if (st === 'cyber') {
    if (drums) {
      if (i === 0 || i === 6 || i === 10 || (hook && i === 14)) kick(t, v * 1.1, 110, 0.3);
      if (i === 4 || i === 12) { snare(t, v * 1.2, 160, 0.25); tone(t, 0.12, 640, 'square', 0.05 * v, musicBus, 300); }
      if (i % 2 === 0) noise(t, 0.03, 7000, 'highpass', 2, 0.05 * v, musicBus);
    }
    if (i % 4 === 0 || (hook && i % 2 === 0)) growl(t, deg(T, chord, -1), spb * (hook ? 1.8 : 3.6), v);
    if (sec !== 'intro') { const a = [0, 2, 4, 7][i % 4]; pluck(t, deg(T, chord + a, 1 + (i % 8 >= 4 ? 1 : 0)), spb * 0.9, v * 0.6, 'square', true); }
    if (i === 0) pad(t, deg(T, chord, 0), spb * 16, v * 0.9, 'sawtooth', 700);
    if (hook && i === 8 && bar % 2) for (let k = 0; k < 4; k++) tone(t + k * spb / 4, spb / 5, midi(deg(T, chord + 4, 2)), 'square', 0.035 * v, musicBus); // Glitch-Stotterer
  }
}
export function audioTime() { return ctx ? ctx.currentTime : 0; }
export function debug() { return { ctx: ctx ? ctx.state : 'none', station: A.station, playing: A.playing, track: A.track, notes: A.notes, errors: A.errors, speech: A.speech }; }
