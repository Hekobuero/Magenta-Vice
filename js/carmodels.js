// Magenta Vice – Sportwagen/Cabrio aus echtem 3D-Modell (Khronos „Car Concept“, CC BY 4.0)
// Zur Laufzeit: Teile pro Material zusammenfassen (wenige Draw-Calls), Räder als eigene Drehgruppen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ASSETS } from './assets.js?v=20261101-1000';

const tpl = {};
function safeMerge(arr) {
  if (arr.length === 1) return arr[0];
  const allIdx = arr.every(g => g.index);
  const list = allIdx ? arr : arr.map(g => g.index ? g.toNonIndexed() : g);
  return mergeGeometries(list) || list[0];
}
function toFloat(geo) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = geo.attributes[name]; if (!a) continue;
    const n = a.count, s = a.itemSize, arr = new Float32Array(n * s);
    for (let i = 0; i < n; i++) { arr[i * s] = a.getX(i); if (s > 1) arr[i * s + 1] = a.getY(i); if (s > 2) arr[i * s + 2] = a.getZ(i); }
    g.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  if (geo.index) g.setIndex(Array.from(geo.index.array));
  return g;
}
export function carTemplate(name, targetLen, ref = null) {
  const key = name + targetLen;
  if (tpl[key]) return tpl[key];
  const gltf = ASSETS.cars[name]; if (!gltf) return null;
  if (ref && !ref.norm) return null;
  const scene = gltf.scene; scene.updateMatrixWorld(true);
  const wheelRoots = [];
  scene.traverse(o => { if (/^Wheel(Front|Rear)(L|R)$/.test(o.name)) wheelRoots.push(o); });
  const inWheel = o => { for (let p = o; p; p = p.parent) if (wheelRoots.includes(p)) return p; return null; };
  const groups = new Map(); const wheelGroups = new Map();
  const box = new THREE.Box3();
  const m = new THREE.Matrix4(), rot = new THREE.Matrix4();
  scene.traverse(o => {
    if (!o.isMesh) return;
    const wr = inWheel(o);
    let g = toFloat(o.geometry);
    if (wr) {
      // Rad-Geometrie relativ zum Radmittelpunkt, ohne Schauraum-Lenkeinschlag
      const parentRot = rot.extractRotation(wr.parent.matrixWorld);
      m.copy(wr.matrixWorld).invert().multiply(o.matrixWorld).premultiply(parentRot);
      g.applyMatrix4(m);
      const list = wheelGroups.get(wr) || new Map(); wheelGroups.set(wr, list);
      const arr = list.get(o.material) || []; arr.push(g); list.set(o.material, arr);
    } else {
      g.applyMatrix4(o.matrixWorld);
      const arr = groups.get(o.material) || []; arr.push(g); groups.set(o.material, arr);
      g.computeBoundingBox(); box.union(g.boundingBox);
    }
  });
  // Normieren: Länge → targetLen, Mitte auf 0, Boden auf Radunterkante
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const s = targetLen / size.z;
  if (ref) { // Fern-LOD: exakt dieselbe Normierung wie das Hauptmodell
    const N = ref.norm, body = [];
    for (const [mat, arr] of groups) { const geo = safeMerge(arr); geo.translate(-N.ctr.x, -N.ctr.y, -N.ctr.z); geo.scale(N.s, N.s, N.s); geo.translate(0, -N.minY, 0); body.push({ geo, mat, name: mat.name || '' }); }
    const T = { body, wheels: [], lod: true }; compact(T); tpl[key] = T; return T;
  }
  let wheelR = 0.38 * s, minY = Infinity;
  const wheels = [];
  for (const wr of wheelRoots) {
    const c = new THREE.Vector3().setFromMatrixPosition(wr.matrixWorld);
    const list = wheelGroups.get(wr); if (!list) continue;
    const parts = [];
    let wb = new THREE.Box3();
    for (const [mat, arr] of list) { const geo = safeMerge(arr); geo.scale(s, s, s); geo.computeBoundingBox(); wb.union(geo.boundingBox); parts.push({ geo, mat }); }
    const r = (wb.max.y - wb.min.y) / 2; wheelR = r;
    const pos = c.sub(ctr).multiplyScalar(s);
    minY = Math.min(minY, pos.y - r);
    wheels.push({ pos, parts, front: /Front/.test(wr.name), left: /L$/.test(wr.name), r });
  }
  const body = [];
  for (const [mat, arr] of groups) { const geo = safeMerge(arr); geo.translate(-ctr.x, -ctr.y, -ctr.z); geo.scale(s, s, s); body.push({ geo, mat, name: mat.name || '' }); }
  if (!isFinite(minY)) minY = -size.y * s / 2;
  for (const b of body) b.geo.translate(0, -minY, 0);
  for (const w of wheels) w.pos.y -= minY;
  const T = { body, wheels, len: size.z * s, wid: size.x * s, h: size.y * s - minY - size.y * s / 2, wheelR, norm: { ctr: ctr.clone(), s, minY } };
  compact(T);
  tpl[key] = T; return T;
}
// Wenige Draw-Calls: Kleinteile (Innenraum, Grill, Felgen …) mit eingebrannten Vertex-Farben zusammenfassen
function colored(geo, mat) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const n = g.attributes.position.count, c = new Float32Array(n * 3), col = (mat && mat.color) ? mat.color : new THREE.Color(0x222222);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
const KEEP = /^Paint 1|^Paint 2|Glass|Headlight/i, LIGHT = /Brakelight|Signallight/i;
function compact(T) {
  const misc = [], lights = [], keep = [];
  for (const b of T.body) {
    if (KEEP.test(b.name)) keep.push(b);
    else if (LIGHT.test(b.name)) { const m = b.mat; const g = colored(b.geo, { color: /Brake/i.test(b.name) ? new THREE.Color(1.6, 0.05, 0.05) : new THREE.Color(1.6, 0.6, 0.05) }); lights.push(g); }
    else misc.push(colored(b.geo, b.mat));
  }
  const body = keep.slice();
  if (misc.length) body.push({ geo: mergeGeometries(misc), mat: null, name: '__misc' });
  if (lights.length) body.push({ geo: mergeGeometries(lights), mat: null, name: '__lights' });
  T.body = body;
  for (const w of T.wheels) { const g = mergeGeometries(w.parts.map(p => colored(p.geo, p.mat))); w.parts = [{ geo: g, mat: null, name: '__wheel' }]; }
}
// Gemeinsame Materialien für die Modell-Autos
const shared = {};
export function carMats(M) {
  if (shared.glass) return shared;
  shared.glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0f16, roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.55, envMapIntensity: 1.6, depthWrite: false });
  shared.dark = new THREE.MeshPhysicalMaterial({ color: 0x0b0c0f, roughness: 0.3, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.1 });
  shared.head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.4 });
  shared.tail = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1010, emissiveIntensity: 0.6, roughness: 0.2 });
  shared.signal = new THREE.MeshStandardMaterial({ color: 0x402000, emissive: 0xff8a00, emissiveIntensity: 0.2, roughness: 0.2 });
  shared.misc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.45, envMapIntensity: 1.1 });
  shared.wheel = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55, envMapIntensity: 1.1 });
  shared.lights = new THREE.MeshBasicMaterial({ vertexColors: true });
  return shared;
}
