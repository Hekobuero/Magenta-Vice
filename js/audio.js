// Magenta Vice – prozedurales Audio (WebAudio) + Sprachausgabe
let ctx = null, master, musicBus, sfxBus, engineBus, comp;
export const A = { on: true, musicVol: 0.5, station: 0, playing: false };
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  engineBus = ctx.createGain(); engineBus.gain.value = 0; engineBus.connect(master);
  // Delay für Musik (80er-Hall)
  const dl = ctx.createDelay(1); dl.delayTime.value = 0.36; const fb = ctx.createGain(); fb.gain.value = 0.32; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  musicBus.fx = ctx.createGain(); musicBus.fx.gain.value = 0.35; musicBus.fx.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicBus);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  buildEngine(); buildSiren(); buildAmbience();
  setInterval(schedule, 50);
}
export function setMuted(m) { A.on = !m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); }
let noiseBuf;
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
export function engine(on, rpm, load, skid) {
  if (!ctx || !eng) return; const t = ctx.currentTime;
  engineBus.gain.setTargetAtTime(on ? 0.22 : 0, t, 0.1);
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
// ---------- Umgebung (Meer / Stadt) ----------
let amb = null;
function buildAmbience() {
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const g = ctx.createGain(); g.gain.value = 0;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  ns.connect(lp); lp.connect(g); g.connect(master); ns.start(); amb = { g };
}
export function ambience(sea) { if (amb) amb.g.gain.setTargetAtTime(0.02 + sea * 0.09, ctx.currentTime, 0.5); }

// ---------- Radio ----------
export const STATIONS = [
  { name: 'MAGENTA FM', sub: '80s Synthwave · Miami Nights', bpm: 104, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], style: 'synth', seed: 3 },
  { name: 'GLASFASER BEATS', sub: 'House mit Lichtgeschwindigkeit', bpm: 124, root: 48, scale: [0, 2, 3, 5, 7, 9, 10], style: 'house', seed: 7 },
  { name: 'RADIO FUNKLOCH', sub: '8-Bit Chiptunes', bpm: 144, root: 52, scale: [0, 2, 4, 5, 7, 9, 11], style: 'chip', seed: 11 },
  { name: 'VERTRIEB TALK', sub: 'Talk & Werbung', bpm: 90, root: 50, scale: [0, 2, 4, 7, 9], style: 'talk', seed: 5 },
];
const JINGLES = [
  ['Magenta F M. Die heißesten Hits aus Miami. Mit Glasfaser im Ohr.', 'Sie hören Magenta F M. Achtzig Prozent Synthesizer, hundert Prozent Netz.'],
  ['Glasfaser Beats. Bässe mit Lichtgeschwindigkeit.', 'Glasfaser Beats. Wir pingen tiefer als die Konkurrenz.'],
  ['Radio Funkloch. Der Sender, den man nur mit Telekom empfängt.', 'Radio Funkloch. Acht Bit, null Ausfall.'],
  ['Vertrieb Talk. Heute im Studio: Warum Vodafohn-Kunden immer im Keller telefonieren.', 'Werbung: Wechseln Sie jetzt zu Kongstar. Billig. Und so. Kleingedrucktes inklusive.', 'Werbung: O Null Zwei. Funkloch? Wir nennen es digitale Entgiftung.', 'Werbung: Eins und Eins. Unsere Warteschleife hat jetzt auch Glasfaser.', 'Werbung: Heko Büroservice. Ihr Partner im Vertrieb. Mehr Verträge, mehr Provision.', 'Verkehrsmeldung: Auf dem Ocean Drive fahren Telekom-Trucks mit Glasfaser im Gepäck. Bitte Abstand halten.', 'Tipp der Stunde: Ein Vertrag am Tag hält die Konkurrenz auf Abstand. Highspeed vor Ort Punkt de.'],
];
let nextNote = 0, step = 0, pat = null, lastSpeak = 0;
function mkRng(s) { let x = s; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e6) / 1e6; }; }
function makePattern(st) {
  const r = mkRng(st.seed * 9973 + 17), sc = st.scale;
  const prog = st.style === 'chip' ? [0, 5, 3, 4] : st.style === 'house' ? [0, 0, 5, 3] : [0, 5, 3, 6];
  const lead = []; for (let k = 0; k < 64; k++) lead.push(r() < (st.style === 'chip' ? 0.75 : 0.45) ? Math.floor(r() * 8) : -1);
  const bassRh = []; for (let k = 0; k < 16; k++) bassRh.push(st.style === 'synth' ? 1 : st.style === 'house' ? (k % 4 === 2 ? 1 : r() < 0.25 ? 1 : 0) : (k % 2 === 0 ? 1 : 0));
  return { prog, lead, bassRh, sc };
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
function deg(st, d, oct = 0) { const sc = st.scale; const o = Math.floor(d / sc.length); return st.root + sc[((d % sc.length) + sc.length) % sc.length] + 12 * (o + oct); }
export function setStation(i) { A.station = i; pat = makePattern(STATIONS[i]); step = 0; if (ctx) nextNote = ctx.currentTime + 0.1; }
export function radioOn(on) {
  if (!ctx) return; A.playing = on;
  musicBus.gain.setTargetAtTime(on ? A.musicVol * 0.55 : 0, ctx.currentTime, 0.15);
  if (!on) speechSynthesis?.cancel?.();
}
export function jingle() { const j = JINGLES[A.station]; speak(j[Math.floor(Math.random() * j.length)], 1.05, 1); }
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices().filter(v => /^de/i.test(v.lang)); } catch (e) { } }
if (typeof speechSynthesis !== 'undefined') { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
export function speak(text, rate = 1, pitch = 1, vol = 1) {
  try {
    if (typeof speechSynthesis === 'undefined' || !A.on) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = rate; u.pitch = pitch; u.volume = vol;
    if (voices.length) u.voice = voices[0];
    speechSynthesis.speak(u); lastSpeak = performance.now();
  } catch (e) { }
}
export function policeRadio(text) {
  if (!ctx) return; const t = ctx.currentTime;
  noise(t, 0.25, 2200, 'bandpass', 3, 0.15); tone(t + 0.02, 0.08, 1800, 'square', 0.05);
  speak(text, 1.15, 0.8, 0.9);
}
function schedule() {
  if (!ctx || !A.playing || !pat) return;
  const st = STATIONS[A.station], spb = 60 / st.bpm / 4; // 16tel
  if (nextNote < ctx.currentTime - 0.2) nextNote = ctx.currentTime + 0.05;
  while (nextNote < ctx.currentTime + 0.15) { playStep(st, step, nextNote, spb); nextNote += spb; step++; }
  // Talk-Sender spricht öfter, Musiksender ab und zu Jingle
  const now = performance.now();
  if (now - lastSpeak > (st.style === 'talk' ? 16000 : 60000)) jingle();
}
function playStep(st, s, t, spb) {
  const bar = Math.floor(s / 16) % 4, i = s % 16, chord = pat.prog[bar];
  const B = musicBus, talk = st.style === 'talk';
  const v = talk ? 0.35 : 1;
  // Drums
  if (st.style === 'house') {
    if (i % 4 === 0) kick(t, 0.9 * v);
    if (i % 4 === 2) noise(t, 0.05, 8000, 'highpass', 1, 0.12 * v, B);
    if (i === 4 || i === 12) clap(t, v);
  } else if (st.style === 'chip') {
    if (i % 8 === 0) tone(t, 0.08, 120, 'square', 0.2 * v, B, 50);
    if (i % 8 === 4) noise(t, 0.08, 3000, 'bandpass', 1, 0.15 * v, B);
    if (i % 2 === 0) noise(t, 0.02, 9000, 'highpass', 1, 0.05 * v, B);
  } else if (!talk) {
    if (i === 0 || i === 8 || i === 10) kick(t, 0.8);
    if (i === 4 || i === 12) { noise(t, 0.35, 1800, 'bandpass', 0.6, 0.35, B); noise(t, 0.4, 1800, 'bandpass', 0.6, 0.2, B.fx); }
    if (i % 2 === 0) noise(t, 0.03, 9000, 'highpass', 1, 0.05, B);
  }
  // Bass
  if (pat.bassRh[i]) {
    const n = deg(st, chord, -1) + (st.style === 'synth' && i % 2 ? 12 : 0);
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = st.style === 'chip' ? 'triangle' : 'sawtooth'; o.frequency.value = midi(n);
    f.type = 'lowpass'; f.frequency.setValueAtTime(st.style === 'house' ? 900 : 1400, t); f.frequency.exponentialRampToValueAtTime(220, t + spb * 1.6); f.Q.value = 6;
    g.gain.setValueAtTime(0.22 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + spb * 1.8);
    o.connect(f); f.connect(g); g.connect(B); o.start(t); o.stop(t + spb * 2);
  }
  // Pads / Akkorde
  if (i === 0 && st.style !== 'chip') {
    for (const d of [0, 2, 4]) {
      const n = deg(st, chord + d, 0);
      for (const det of [-8, 8]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det; f.type = 'lowpass'; f.frequency.value = st.style === 'house' ? 1600 : 1100;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035 * v, t + spb * 4); g.gain.linearRampToValueAtTime(0.0001, t + spb * 16);
        o.connect(f); f.connect(g); g.connect(B); g.connect(B.fx); o.start(t); o.stop(t + spb * 16.1);
      }
    }
  }
  // Lead
  const li = (Math.floor(s / 2) + bar * 8) % 64, ln = pat.lead[li];
  if (!talk && ln >= 0 && (st.style === 'chip' ? true : i % 2 === 0)) {
    const n = deg(st, chord + ln, st.style === 'chip' ? 1 : 1);
    const g = tone(t, spb * (st.style === 'chip' ? 1.6 : 2.6), midi(n), st.style === 'chip' ? 'square' : 'sawtooth', st.style === 'chip' ? 0.05 : 0.045, B);
    if (st.style !== 'chip') g.connect(B.fx);
  }
  if (talk && i === 0 && bar % 2 === 0) tone(t, spb * 6, midi(deg(st, chord, 1)), 'triangle', 0.05, B);
}
function kick(t, v) { tone(t, 0.3, 150, 'sine', 0.8 * v, musicBus, 42); }
function clap(t, v) { for (let k = 0; k < 3; k++) noise(t + k * 0.01, 0.12, 1500, 'bandpass', 1.2, 0.18 * v, musicBus); }
export function audioTime() { return ctx ? ctx.currentTime : 0; }
