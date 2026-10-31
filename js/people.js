// Magenta Vice – Menschen aus echten Modellen (Microsoft Rocketbox, MIT) mit Skelett-Animation
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { ASSETS, PEOPLE } from './assets.js?v=20261031-2130';

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const ID = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

// Welche Modelle für welche Rolle
const POOL = {
  player: ['player'], ranger: ['ranger-m', 'ranger-m', 'ranger-f'], cop: ['cop-m'], swat: ['swat'],
  civ: ['m1', 'm2', 'm3', 'm4', 'm5', 'biz-m', 'f1', 'f2', 'f3', 'f4', 'f5'],
  tourist: ['beach-m', 'beach-f', 'beach-m', 'beach-f', 'm1', 'f4', 'f5'],
  night: ['f5', 'f3', 'm2', 'm5', 'f1', 'm1', 'biz-m', 'f2'],
};
export function humanAvailable() { return !!ASSETS.people.player; }

// Waffen-Modelle (normiert: Lauf → +Z, oben → +Y, Griff im Ursprung)
const WCFG = {
  pistole: { file: 'pistole', len: 0.25, ry: -Math.PI / 2, grip: [0.0, -0.32, -0.28] },
  uzi: { file: 'uzi', len: 0.5, ry: -Math.PI / 2, grip: [0.0, -0.25, -0.02] },
  schrotflinte: { file: 'schrotflinte', len: 1.02, ry: Math.PI, grip: [0.0, -0.1, -0.24] },
};
const wCache = {};
export function weaponModel(kind) {
  if (kind === 'schlagstock') return batonModel();
  const c = WCFG[kind], g = ASSETS.weapons[c && c.file];
  if (!g) return fallbackGun(kind);
  if (!wCache[kind]) {
    const src = g.scene.clone(true);
    const holder = new THREE.Group(); src.rotation.y = c.ry; holder.add(src); holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder), size = box.getSize(_v1), s = c.len / size.z;
    src.scale.setScalar(s); src.rotation.y = c.ry; holder.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(holder), sz = b2.getSize(new THREE.Vector3()), ctr = b2.getCenter(new THREE.Vector3());
    // Griff in den Ursprung legen (Bruchteile der Größe relativ zur Mitte)
    src.position.set(-ctr.x - c.grip[0] * sz.x, -ctr.y - c.grip[1] * sz.y, -ctr.z - c.grip[2] * sz.z);
    src.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material) { o.material = o.material.clone(); o.material.envMapIntensity = 1.2; } } });
    holder.userData.muzzle = new THREE.Vector3(0, (0.22 - c.grip[1]) * sz.y, sz.z * (0.5 - c.grip[2]));
    wCache[kind] = holder;
  }
  const o = wCache[kind].clone(true); o.userData.muzzle = wCache[kind].userData.muzzle.clone(); return o;
}
let batonGeo = null;
function batonModel() {
  if (!batonGeo) {
    const shaft = new THREE.CylinderGeometry(0.016, 0.019, 0.5, 14).translate(0, 0.25, 0);
    const grip = new THREE.CylinderGeometry(0.021, 0.021, 0.16, 14).translate(0, 0.02, 0);
    const side = new THREE.CylinderGeometry(0.013, 0.013, 0.11, 10).rotateZ(Math.PI / 2).translate(0.055, 0.1, 0);
    batonGeo = [shaft, grip, side];
  }
  const g = new THREE.Group();
  const m1 = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.35, metalness: 0.2 }), m2 = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.85 });
  const parts = [new THREE.Mesh(batonGeo[0], m1), new THREE.Mesh(batonGeo[1], m2), new THREE.Mesh(batonGeo[2], m1)];
  const inner = new THREE.Group(); inner.add(...parts); inner.rotation.x = Math.PI / 2; g.add(inner);
  parts.forEach(p => p.castShadow = true); g.userData.muzzle = new THREE.Vector3(0, 0, 0.5); return g;
}
function fallbackGun(kind) {
  const g = new THREE.Group(), L = kind === 'schrotflinte' ? 0.95 : kind === 'uzi' ? 0.45 : 0.22;
  const m = new THREE.MeshStandardMaterial({ color: 0x222428, metalness: 0.6, roughness: 0.4 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, L), m); b.position.z = L * 0.35; g.add(b);
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.05), m); h.position.y = -0.06; g.add(h);
  g.userData.muzzle = new THREE.Vector3(0, 0.02, L * 0.85); return g;
}

// ---------------------------------------------------------------- Mensch erzeugen
let cloneN = 0;
export function makeHuman(kind, r = Math.random, forceKey) {
  const list = POOL[kind] || POOL.civ;
  const key = forceKey || list[Math.floor(r() * list.length) % list.length];
  const gltf = ASSETS.people[key] || ASSETS.people.m1;
  const meta = PEOPLE[key] || { sex: 'm' };
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const model = skClone(gltf.scene); root.add(model);
  const meshes = [];
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; meshes.push(o); // Sichtbarkeit steuert main.js je Figur
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m.userData.mvTuned) { m.userData.mvTuned = true; m.envMapIntensity = 0.55; if (m.roughness !== undefined) m.roughness = Math.max(0.55, m.roughness); }
        if (/helmet/i.test(m.name || '') && kind === 'ranger') o.visible = false; // D2D-ler ohne Bauhelm
      }
    }
  });
  const B = n => model.getObjectByName('Bip01_' + n);
  const bones = {
    hips: B('Pelvis'), spine: B('Spine1'), spine2: B('Spine2'), neck: B('Neck'), head: B('Head'),
    rCla: B('R_Clavicle'), rArm: B('R_UpperArm'), rFore: B('R_Forearm'), rHand: B('R_Hand'), rFing: B('R_Finger2'),
    lCla: B('L_Clavicle'), lArm: B('L_UpperArm'), lFore: B('L_Forearm'), lHand: B('L_Hand'), lFing: B('L_Finger2'),
    rThigh: B('R_Thigh'), rCalf: B('R_Calf'), rFoot: B('R_Foot'), lThigh: B('L_Thigh'), lCalf: B('L_Calf'), lFoot: B('L_Foot'),
  };
  const mixer = new THREE.AnimationMixer(model);
  const A = ASSETS.anims[meta.sex] || ASSETS.anims.m, actions = {};
  for (const c of ['idle', 'walk', 'run', 'dance']) if (A[c]) { const a = mixer.clipAction(A[c]); a.play(); a.setEffectiveWeight(c === 'idle' ? 1 : 0); a.time = r() * A[c].duration; actions[c] = a; }
  const h = {
    root, model, kind, key, sex: meta.sex, mixer, actions, bones, meshes, w: { idle: 1, walk: 0, run: 0, dance: 0 },
    acc: 0, frameSkip: 0, weapon: null, weaponKind: null, prop: null, human: true, id: ++cloneN,
    hitT: 0, look: null, shadow: true,
  };
  // D2D-ler: Klemmbrett in der linken Hand + Westen-Aufdruck
  if (kind === 'ranger') { attachClipboard(h); attachVestBadge(h); }
  if (key === 'player') fixShirtLogo(meshes);
  return h;
}
// Rückenlogo des Spieler-Hemds steht in der UV-Karte auf dem Kopf -> Bereich einmalig vertikal spiegeln
function fixShirtLogo(meshes) {
  for (const o of meshes) {
    const m = o.material;
    if (!m || !/body/i.test(m.name || '') || !m.map || m.userData.mvShirt) continue;
    m.userData.mvShirt = true;
    try {
      const img = m.map.image, W = img.width, H = img.height, f = W / 1024;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const x = 428 * f, y = 166 * f, w = 168 * f, hh = 168 * f;
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = hh;
      tmp.getContext('2d').drawImage(c, x, y, w, hh, 0, 0, w, hh);
      g.save(); g.translate(0, y * 2 + hh); g.scale(1, -1); g.drawImage(tmp, x, y); g.restore();
      const t = new THREE.CanvasTexture(c);
      t.flipY = m.map.flipY; t.colorSpace = m.map.colorSpace; t.wrapS = m.map.wrapS; t.wrapT = m.map.wrapT; t.anisotropy = m.map.anisotropy;
      m.map = t; m.needsUpdate = true;
    } catch (e) { /* Logo bleibt wie es ist */ }
  }
}
// "D2D"-Aufdruck auf Rücken (groß) und Brust (klein) der Warnweste, am Brustwirbel befestigt
let badgeMat = null;
function badgeMaterial() {
  if (badgeMat) return badgeMat;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#16181c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 86px Arial Black, Arial, sans-serif'; g.fillText('D2D', 128, 58);
  g.fillRect(28, 104, 200, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  badgeMat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.35, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  return badgeMat;
}
const _ray = new THREE.Raycaster();
function attachVestBadge(h) {
  const sp = h.bones.spine2 || h.bones.spine; if (!sp) return;
  h.root.updateMatrixWorld(true);
  for (const o of h.meshes) if (o.isSkinnedMesh) o.skeleton.update();
  const rootInv = _m2.copy(h.root.matrixWorld).invert();
  const sl = _v1.setFromMatrixPosition(sp.matrixWorld).applyMatrix4(rootInv); // Wirbel im Figurenraum
  const body = h.meshes.filter(o => o.visible);
  for (const [dir, size, dy] of [[-1, 0.27, 0.0], [1, 0.085, 0.04]]) {
    const y = sl.y + dy, x = dir > 0 ? -0.09 : 0;
    const from = new THREE.Vector3(x, y, dir * 0.8).applyMatrix4(h.root.matrixWorld);
    const to = new THREE.Vector3(x, y, 0).applyMatrix4(h.root.matrixWorld);
    _ray.set(from, to.clone().sub(from).normalize()); _ray.far = 0.8;
    const hit = _ray.intersectObjects(body, false)[0];
    const zSurf = hit ? hit.point.clone().applyMatrix4(rootInv).z : dir * 0.14;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size / 2), badgeMaterial());
    plane.position.set(x, y, zSurf + dir * 0.012);
    if (dir < 0) plane.rotation.y = Math.PI;
    plane.renderOrder = 2;
    // in Knochen-Raum umrechnen und anhängen
    plane.updateMatrix();
    const world = plane.matrix.clone().premultiply(h.root.matrixWorld);
    const local = _m1.copy(sp.matrixWorld).invert().multiply(world);
    local.decompose(plane.position, plane.quaternion, plane.scale);
    sp.add(plane);
  }
}
let clipMat = null;
function attachClipboard(h) {
  if (!h.bones.lHand) return;
  if (!clipMat) clipMat = [new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.8, roughness: 0.3 })];
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.012), clipMat[0]);
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.27, 0.004), clipMat[1]); paper.position.set(0, -0.012, 0.008);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.02), clipMat[2]); clip.position.set(0, 0.15, 0.01);
  g.add(board, paper, clip); board.castShadow = true;
  attachToBone(h, h.bones.lHand, h.bones.lFore, g, { along: 0.12, side: 0, normal: 'out' });
  h.prop = g;
}
// Objekt fest an Handknochen hängen. Ausrichtung wird einmal in der Bindungspose bestimmt:
// +Z des Objekts zeigt entlang des Unterarms (aus der Hand heraus), +Y nach oben.
function attachToBone(h, hand, fore, obj, o = {}) {
  h.model.updateMatrixWorld(true);
  const hp = _v1.setFromMatrixPosition(hand.matrixWorld), fp = _v2.setFromMatrixPosition(fore.matrixWorld);
  const dir = _v3.subVectors(hp, fp).normalize();
  const rootInv = _m2.copy(h.root.matrixWorld).invert();
  // Richtung im Modellraum der Figur
  const dLocal = dir.clone().transformDirection(rootInv);
  let up = new THREE.Vector3(0, 1, 0); if (Math.abs(dLocal.dot(up)) > 0.9) up.set(0, 0, 1);
  const x = new THREE.Vector3().crossVectors(up, dLocal).normalize(); const y = new THREE.Vector3().crossVectors(dLocal, x).normalize();
  const basis = new THREE.Matrix4().makeBasis(x, y, dLocal);
  if (o.normal === 'out') basis.multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)); // Brett flach in der Hand
  const pos = hp.clone().addScaledVector(dir, o.along || 0.05).applyMatrix4(rootInv);
  pos.y -= o.drop || 0;
  const desired = basis.setPosition(pos).premultiply(h.root.matrixWorld);
  const local = _m1.copy(hand.matrixWorld).invert().multiply(desired);
  local.decompose(obj.position, obj.quaternion, obj.scale);
  hand.add(obj);
}
export function setHumanWeapon(h, kind) {
  if (h.weaponKind === kind) return;
  if (h.weapon) { h.weapon.parent && h.weapon.parent.remove(h.weapon); h.weapon = null; }
  h.weaponKind = kind;
  if (!kind || kind === 'faust' || !h.bones.rHand) return;
  const w = weaponModel(kind);
  // In Bindungspose ausrichten
  const saved = [];
  h.model.traverse(o => { if (o.isBone) saved.push([o, o.quaternion.clone(), o.position.clone()]); });
  for (const m of h.meshes) if (m.skeleton) { m.skeleton.pose(); break; }
  h.model.updateMatrixWorld(true);
  attachToBone(h, h.bones.rHand, h.bones.rFore, w, { along: kind === 'schlagstock' ? 0.04 : 0.06 });
  for (const [b, q, p] of saved) { b.quaternion.copy(q); b.position.copy(p); }
  h.weapon = w;
}
export function muzzleWorld(h, out) {
  if (!h.weapon) { h.bones.rHand.updateWorldMatrix(true, false); return out.setFromMatrixPosition(h.bones.rHand.matrixWorld); }
  h.weapon.updateWorldMatrix(true, false);
  return out.copy(h.weapon.userData.muzzle).applyMatrix4(h.weapon.matrixWorld);
}

// Knochen in Weltrichtung drehen (unabhängig von den lokalen Achsen des Bip-Skeletts)
const _pd = new THREE.Vector3();
function pointBone(bone, child, dirW, w = 1) {
  if (!bone || !child || w <= 0.001) return;
  _pd.copy(dirW);
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(false, false);
  const a = _v1.setFromMatrixPosition(bone.matrixWorld), b = _v2.setFromMatrixPosition(child.matrixWorld);
  const cur = _v3.subVectors(b, a); if (cur.lengthSq() < 1e-8) return; cur.normalize();
  _q1.setFromUnitVectors(cur, _pd.normalize());
  if (w < 1) _q1.copy(_q3.identity().slerp(_q1, w));
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  bone.parent.getWorldQuaternion(_q3); bone.quaternion.copy(_q3.invert().multiply(_q2));
  bone.updateWorldMatrix(false, false); child.updateWorldMatrix(false, false);
}
// Zwei-Knochen-IK (Oberarm/Unterarm) mit Pol-Richtung für den Ellbogen
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _T = new THREE.Vector3(), _D = new THREE.Vector3(), _P = new THREE.Vector3();
function ik2(arm, fore, hand, target, pole) {
  if (!arm || !fore || !hand) return;
  arm.updateWorldMatrix(true, false); fore.updateWorldMatrix(false, false); hand.updateWorldMatrix(false, false);
  _S.setFromMatrixPosition(arm.matrixWorld); _E.setFromMatrixPosition(fore.matrixWorld); _T.setFromMatrixPosition(hand.matrixWorld);
  const L1 = _S.distanceTo(_E), L2 = _E.distanceTo(_T);
  _D.subVectors(target, _S); let d = _D.length(); _D.normalize(); d = Math.min(d, (L1 + L2) * 0.999); d = Math.max(d, Math.abs(L1 - L2) + 1e-3);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  _P.copy(pole).addScaledVector(_D, -pole.dot(_D)); if (_P.lengthSq() < 1e-6) _P.set(0, -1, 0); _P.normalize();
  const elbow = _E.copy(_S).addScaledVector(_D, a).addScaledVector(_P, hgt);
  pointBone(arm, fore, _T.subVectors(elbow, _S), 1);
  const ep = new THREE.Vector3().setFromMatrixPosition(fore.matrixWorld);
  pointBone(fore, hand, _T.subVectors(target, ep), 1);
}
function rotateBoneWorld(bone, axisW, ang) {
  if (!bone || Math.abs(ang) < 1e-4) return;
  bone.updateWorldMatrix(true, false);
  _q1.setFromAxisAngle(axisW, ang);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  bone.parent.getWorldQuaternion(_q3); bone.quaternion.copy(_q3.invert().multiply(_q2));
  bone.updateWorldMatrix(false, false);
}

// ---------------------------------------------------------------- Animation
// st: { speed (m/s), punch 0..1, fall 0..1, talk (s), aim: Vector3|null (Weltpunkt), weapon, dance, sit, hit 0..1, recoil 0..1, swing 0..1, far }
const WALK_V = 1.45, RUN_V = 4.2;
export function animateHuman(h, dt, st) {
  const sp = st.speed || 0;
  // Zielgewichte
  let tw = { idle: 0, walk: 0, run: 0, dance: 0 };
  if (st.dance && h.actions.dance) tw.dance = 1;
  else if (st.sit) tw.idle = 1;
  else if (sp < 0.12) tw.idle = 1;
  else if (sp < 2.4) { const k = Math.min(1, sp / 0.6); tw.walk = k; tw.idle = 1 - k; }
  else { const k = Math.min(1, (sp - 2.4) / 1.4); tw.run = k; tw.walk = 1 - k; }
  const kf = Math.min(1, dt * 7);
  for (const c in h.actions) {
    h.w[c] += ((tw[c] || 0) - h.w[c]) * kf; h.actions[c].setEffectiveWeight(h.w[c]);
  }
  if (h.actions.walk) h.actions.walk.setEffectiveTimeScale(Math.max(0.6, Math.min(1.8, sp / WALK_V)));
  if (h.actions.run) h.actions.run.setEffectiveTimeScale(Math.max(0.7, Math.min(1.5, sp / RUN_V)));
  // Entfernte Figuren seltener rechnen
  h.acc += dt;
  if (st.far) { if (++h.frameSkip < 4) return; h.frameSkip = 0; }
  h.mixer.update(h.acc); h.acc = 0;
  h.root.updateMatrixWorld(true);
  const b = h.bones;
  const me = h.root.matrixWorld.elements, fwd = _v4.set(me[8], 0, me[10]).normalize(); // Blickrichtung in Weltkoordinaten (auch im Auto)
  const F = new THREE.Vector3().copy(fwd), Rt = new THREE.Vector3(-F.z, 0, F.x); // rechts der Figur (Blickrichtung +Z → rechts = -X)
  // Treffer-Zucken
  if (st.hit > 0) rotateBoneWorld(b.spine, Rt, 0.45 * st.hit);
  // Sitzen (Bank / Cabrio)
  if (st.sit) {
    for (const [th, ca, fo] of [[b.rThigh, b.rCalf, b.rFoot], [b.lThigh, b.lCalf, b.lFoot]]) {
      pointBone(th, ca, _v1.copy(F).multiplyScalar(1).add(_v2.set(0, -0.08, 0)), 1);
      pointBone(ca, fo, _v1.copy(F).multiplyScalar(st.sit === 'car' ? 0.75 : 0.15).add(_v2.set(0, -1, 0)), 1);
    }
    if (st.sit === 'car') {
      for (const [ar, fo, ha, s] of [[b.rArm, b.rFore, b.rHand, 1], [b.lArm, b.lFore, b.lHand, -1]]) {
        pointBone(ar, fo, _v1.copy(F).multiplyScalar(0.9).add(_v2.set(0, -0.55, 0)).addScaledVector(Rt, s * 0.12), 1);
        pointBone(fo, ha, _v1.copy(F).multiplyScalar(1).add(_v2.set(0, 0.1, 0)).addScaledVector(Rt, -s * 0.25), 1);
      }
    }
  }
  // Zielen (Waffe): Arme zum Ziel
  if (st.aim) {
    const sh = _v2.setFromMatrixPosition(b.rArm.matrixWorld);
    const dir = new THREE.Vector3().subVectors(st.aim, sh).normalize();
    // Oberkörper leicht mitdrehen
    const kind = st.weapon;
    const two = kind === 'uzi' || kind === 'schrotflinte';
    const rec = st.recoil || 0;
    const d1 = dir.clone(); d1.y += rec * 0.18;
    pointBone(b.rArm, b.rFore, two ? d1.clone().add(new THREE.Vector3(0, -0.35, 0)).addScaledVector(Rt, 0.1) : d1, 1);
    pointBone(b.rFore, b.rHand, d1, 1);
    // linke Hand stützt (IK zum Vorderschaft bzw. zur Schusshand)
    b.rHand.updateWorldMatrix(false, false);
    const grip = new THREE.Vector3().setFromMatrixPosition(b.rHand.matrixWorld).addScaledVector(dir, two ? (kind === 'schrotflinte' ? 0.36 : 0.15) : 0.03).add(new THREE.Vector3(0, two ? 0.02 : -0.03, 0)).addScaledVector(Rt, two ? 0 : -0.04);
    ik2(b.lArm, b.lFore, b.lHand, grip, new THREE.Vector3(0, -1, 0).addScaledVector(Rt, -0.8));
  } else if (st.punch > 0) {
    // Schlag: rechter Arm schnellt nach vorn
    const p = Math.sin(Math.min(1, st.punch) * Math.PI);
    const tgt = new THREE.Vector3().copy(F).add(new THREE.Vector3(0, 0.12, 0)).addScaledVector(Rt, -0.15);
    pointBone(b.rArm, b.rFore, tgt, p); pointBone(b.rFore, b.rHand, tgt, p);
    rotateBoneWorld(b.spine, UP, -0.35 * p);
    // linke Deckung
    const guard = new THREE.Vector3().copy(F).add(new THREE.Vector3(0, 0.75, 0)).addScaledVector(Rt, 0.25);
    pointBone(b.lArm, b.lFore, new THREE.Vector3().copy(F).multiplyScalar(0.5).add(new THREE.Vector3(0, -0.8, 0)).addScaledVector(Rt, -0.35), p * 0.7);
    pointBone(b.lFore, b.lHand, guard, p * 0.7);
  } else if (st.swing > 0) {
    // Schlagstock/Baseballschläger: von oben-rechts nach vorn-unten
    const s = Math.min(1, st.swing), a = -1.2 + s * 2.2;
    const tgt = new THREE.Vector3().copy(F).multiplyScalar(Math.cos(a) * 0.4 + 0.6).add(new THREE.Vector3(0, Math.sin(-a) * 0.9, 0)).addScaledVector(Rt, 0.2 - s * 0.4);
    pointBone(b.rArm, b.rFore, tgt, 1); pointBone(b.rFore, b.rHand, tgt, 1);
    rotateBoneWorld(b.spine, UP, -0.5 * Math.sin(s * Math.PI));
  } else if (st.talk > 0) {
    const t = st.talk;
    pointBone(b.rFore, b.rHand, _v1.copy(F).add(_v2.set(0, 0.25 + Math.sin(t * 5) * 0.25, 0)).addScaledVector(Rt, Math.sin(t * 3) * 0.3), 0.85);
  } else if (st.flee && sp > 3) {
    // Panik: Hände hoch
    pointBone(b.rArm, b.rFore, _v1.set(0, 1, 0).addScaledVector(Rt, 0.5), 0.5);
    pointBone(b.lArm, b.lFore, _v1.set(0, 1, 0).addScaledVector(Rt, -0.5), 0.5);
  }
  // Kopf zum Blickziel
  if (st.look && b.head) {
    const hp = _v1.setFromMatrixPosition(b.head.matrixWorld), d = _v2.subVectors(st.look, hp); d.y = 0;
    const ang = Math.atan2(d.x, d.z) - Math.atan2(F.x, F.z); let a = Math.atan2(Math.sin(ang), Math.cos(ang)); a = Math.max(-1, Math.min(1, a));
    rotateBoneWorld(b.neck, UP, a * 0.5); rotateBoneWorld(b.head, UP, a * 0.4);
  }
  // Umfallen: ganze Figur um die Füße nach hinten kippen
  h.root.rotation.x = -(st.fall || 0) * Math.PI / 2 * 0.98;
}
export function setHumanShadow(h, on) { if (h.shadow === on) return; h.shadow = on; for (const m of h.meshes) m.castShadow = on; }
