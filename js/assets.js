// Magenta Vice – Laden der 3D-Modelle (glTF/GLB, meshopt-komprimiert) mit Fortschritt
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const VERSION_TAG = new URL(import.meta.url).searchParams.get('v') || 'dev';

export const ASSETS = { people: {}, anims: { m: {}, f: {} }, cars: {}, weapons: {}, ok: false, bytes: 0, failed: [] };
// Personen: Microsoft Rocketbox (MIT) – siehe README › CREDITS
export const PEOPLE = {
  player: { file: 'player', sex: 'm' },
  'ranger-m': { file: 'ranger-m', sex: 'm' }, 'ranger-f': { file: 'ranger-f', sex: 'f' },
  'cop-m': { file: 'cop-m', sex: 'm' }, swat: { file: 'swat', sex: 'm' },
  m1: { file: 'm1', sex: 'm' }, m2: { file: 'm2', sex: 'm' }, m3: { file: 'm3', sex: 'm' }, m4: { file: 'm4', sex: 'm' }, m5: { file: 'm5', sex: 'm' }, 'biz-m': { file: 'biz-m', sex: 'm' },
  f1: { file: 'f1', sex: 'f' }, f2: { file: 'f2', sex: 'f' }, f3: { file: 'f3', sex: 'f' }, f4: { file: 'f4', sex: 'f' }, f5: { file: 'f5', sex: 'f' },
  'beach-m': { file: 'beach-m', sex: 'm' }, 'beach-f': { file: 'beach-f', sex: 'f' },
};
const CLIPS = ['idle', 'walk', 'run', 'dance'];
const CARS = ['hypergt', 'cabrio', 'hypergt-lod', 'cabrio-lod']; // *-lod: Fern-Detailstufe
const WEAPONS = ['pistole', 'uzi', 'schrotflinte'];

export async function loadAssets(onProgress, opts = {}) {
  const base = new URL('../assets/models/', import.meta.url).href;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const jobs = [];
  for (const k in PEOPLE) jobs.push({ url: `people/${PEOPLE[k].file}.glb`, set: g => ASSETS.people[k] = g, w: 300 });
  for (const s of ['m', 'f']) for (const c of CLIPS) jobs.push({ url: `anim/${s}-${c}.glb`, set: g => ASSETS.anims[s][c] = g.animations[0], w: c === 'dance' ? 170 : 40 });
  for (const c of CARS) jobs.push({ url: `cars/${c}.glb`, set: g => ASSETS.cars[c] = g, w: /lod/.test(c) ? 140 : 650 });
  for (const w of WEAPONS) jobs.push({ url: `weapons/${w}.glb`, set: g => ASSETS.weapons[w] = g, w: 30 });
  const total = jobs.reduce((a, j) => a + j.w, 0); let done = 0;
  const prog = new Map();
  const report = () => { let p = done; for (const v of prog.values()) p += v; onProgress && onProgress(Math.min(1, p / total)); };
  // max. 6 parallele Downloads
  let idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const j = jobs[idx++];
      try {
        const g = await loader.loadAsync(base + j.url + '?v=' + VERSION_TAG, e => { if (e.lengthComputable) { prog.set(j, j.w * e.loaded / e.total); report(); } });
        j.set(g);
      } catch (e) { console.warn('Modell fehlt:', j.url, e && e.message); ASSETS.failed.push(j.url); }
      prog.delete(j); done += j.w; report();
    }
  }
  await Promise.all(Array.from({ length: opts.parallel || 6 }, worker));
  ASSETS.ok = ASSETS.failed.length === 0;
  return ASSETS;
}
