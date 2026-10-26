// 3Dのカイリュー：球やカプセルを「なめらかにくっつけた形（SDF）」を面にして作る。
// 体・しっぽ・足・うでは別々のメッシュにして、関節のところで動かす。前は +z、上は +y、身長 約1.0。
import * as THREE from 'three';

// ───────── SDF の道具 ─────────
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
function sdEll(px, py, pz, c, r) {
  const ax = (px - c[0]) / r[0], ay = (py - c[1]) / r[1], az = (pz - c[2]) / r[2];
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const bx = ax / r[0], by = ay / r[1], bz = az / r[2];
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz) || 1e-6;
  return k0 * (k0 - 1) / k1;
}
function sdCone(px, py, pz, a, b, ra, rb) { // 太さが変わるカプセル
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

// ───────── Surface Nets（SDF → なめらかな面） ─────────
function polygonize(f, lo, hi, step) {
  const nx = Math.ceil((hi[0] - lo[0]) / step) + 1, ny = Math.ceil((hi[1] - lo[1]) / step) + 1, nz = Math.ceil((hi[2] - lo[2]) / step) + 1;
  const F = new Float32Array(nx * ny * nz);
  const idx = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[idx(i, j, k)] = f(lo[0] + i * step, lo[1] + j * step, lo[2] + k * step);
  const vid = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const [a, b, d] = corners[c]; cv[c] = F[idx(i + a, j + b, k + d)]; if (cv[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [e0, e1] of edges) {
      const a0 = cv[e0] < 0, a1 = cv[e1] < 0;
      if (a0 === a1) continue;
      const t = cv[e0] / (cv[e0] - cv[e1]);
      const c0 = corners[e0], c1 = corners[e1];
      sx += c0[0] + (c1[0] - c0[0]) * t; sy += c0[1] + (c1[1] - c0[1]) * t; sz += c0[2] + (c1[2] - c0[2]) * t; n++;
    }
    vid[idx(i, j, k)] = pos.length / 3;
    pos.push(lo[0] + (i + sx / n) * step, lo[1] + (j + sy / n) * step, lo[2] + (k + sz / n) * step);
  }
  const ind = [];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = F[idx(i, j, k)] < 0;
    // x の辺
    if (s0 !== (F[idx(i + 1, j, k)] < 0)) quad(vid[idx(i, j - 1, k - 1)], vid[idx(i, j, k - 1)], vid[idx(i, j, k)], vid[idx(i, j - 1, k)], s0);
    if (s0 !== (F[idx(i, j + 1, k)] < 0)) quad(vid[idx(i - 1, j, k - 1)], vid[idx(i - 1, j, k)], vid[idx(i, j, k)], vid[idx(i, j, k - 1)], s0);
    if (s0 !== (F[idx(i, j, k + 1)] < 0)) quad(vid[idx(i - 1, j - 1, k)], vid[idx(i, j - 1, k)], vid[idx(i, j, k)], vid[idx(i - 1, j, k)], s0);
  }
  function quad(a, b, c, d, flip) {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) ind.push(a, b, c, a, c, d); else ind.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ind);
  // 法線は SDF の傾きから（なめらか）
  const nrm = new Float32Array(pos.length), e = step * 0.5;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; nrm[i] = gx / l; nrm[i + 1] = gy / l; nrm[i + 2] = gz / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return g;
}
function paint(g, fn, bellyFn) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, col = new Float32Array(p.length), c = new THREE.Color();
  const bel = new Float32Array(p.length / 3 * 2);
  for (let i = 0, j = 0; i < p.length; i += 3, j += 2) {
    fn(p[i], p[i + 1], p[i + 2], n[i], n[i + 1], n[i + 2], c); col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
    const b = bellyFn ? bellyFn(p[i], p[i + 1], p[i + 2], n[i], n[i + 1], n[i + 2]) : [-1, 0];
    bel[j] = b[0]; bel[j + 1] = b[1];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aBelly', new THREE.BufferAttribute(bel, 2));
  return g;
}

// ───────── 色 ─────────
const C = {
  org: new THREE.Color('#eaa24e'), orgD: new THREE.Color('#d98f3e'), cream: new THREE.Color('#fbebb5'), line: new THREE.Color('#1d1a1f'),
  teal: new THREE.Color('#5ec8c9'), eye: new THREE.Color('#1b1517'), claw: new THREE.Color('#fffaf2'),
};
// THREE.Color は文字列から作ると自動でリニアに変換される（二重に変換しない）

// 材質：ステッカーのような「ベタぬり＋かげ1段」のトゥーン。おなかの色・しまはシェーダーで描く
let GRAD = null;
function gradMap() {
  if (GRAD) return GRAD;
  const d = new Uint8Array([168, 168, 168, 255, 228, 228, 228, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  return GRAD;
}
export function softMat(opts = {}) {
  const belly = opts.belly !== false; delete opts.belly;
  delete opts.roughness; delete opts.metalness;
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradMap(), ...opts });
  m.onBeforeCompile = (sh) => {
    if (!belly) return;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aBelly; varying vec2 vBelly;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBelly = aBelly;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vBelly;`).replace('#include <color_fragment>', `#include <color_fragment>
      {
        float fb = fwidth(vBelly.x) + 1e-5;
        float inB = smoothstep(-fb, fb, vBelly.x);
        float edge = 1.0 - smoothstep(fb * 1.5, fb * 3.2, abs(vBelly.x));
        float sp = vBelly.y / 0.046;
        float fs = fwidth(sp) + 1e-4;
        float dl = abs(fract(sp) - 0.5);
        float line = smoothstep(0.37 - fs, 0.37 + fs, dl);
        vec3 cream = vec3(${C.cream.r.toFixed(4)}, ${C.cream.g.toFixed(4)}, ${C.cream.b.toFixed(4)});
        vec3 ink = vec3(${C.line.r.toFixed(4)}, ${C.line.g.toFixed(4)}, ${C.line.b.toFixed(4)});
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(cream, ink, line), inB);
        diffuseColor.rgb = mix(diffuseColor.rgb, ink, edge * step(0.0, vBelly.x + fb * 3.2) * step(-0.5, -abs(vBelly.y) + 10.0));
      }`);
  };
  return m;
}
// 黒いふち線（裏返した一回り大きい形）。かどのある形も割れないよう、同じ位置の頂点の法線をならす
const OUT_MATS = new Map();
export function outlineMat(w) {
  const k = w.toFixed(4);
  if (OUT_MATS.has(k)) return OUT_MATS.get(k);
  const m = new THREE.MeshBasicMaterial({ color: '#1d1a1f', side: THREE.BackSide });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(aOutN) * ${w.toFixed(4)};`).replace('#include <common>', '#include <common>\nattribute vec3 aOutN;'); };
  OUT_MATS.set(k, m);
  return m;
}
export function outlineGeo(g) {
  if (g.userData.outline) return g.userData.outline;
  const p = new THREE.BufferGeometry(); p.setAttribute('position', g.attributes.position); if (g.index) p.setIndex(g.index);
  const nn = (g.index ? p.toNonIndexed() : p.clone());
  const pos = nn.attributes.position, n = pos.count, key = (i) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  nn.computeVertexNormals();
  const acc = new Map(), nr = nn.attributes.normal;
  for (let i = 0; i < n; i++) { const k = key(i); const a = acc.get(k) || [0, 0, 0]; a[0] += nr.getX(i); a[1] += nr.getY(i); a[2] += nr.getZ(i); acc.set(k, a); }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = acc.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1; out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l; }
  nn.setAttribute('aOutN', new THREE.BufferAttribute(out, 3));
  g.userData.outline = nn;
  return nn;
}
export function addOutline(mesh, w) {
  const geo = outlineGeo(mesh.geometry);
  let o;
  if (mesh.isInstancedMesh) { o = new THREE.InstancedMesh(geo, outlineMat(w), mesh.count); o.instanceMatrix = mesh.instanceMatrix; }
  else o = new THREE.Mesh(geo, outlineMat(w));
  o.castShadow = false; o.receiveShadow = false; o.raycast = () => {};
  mesh.add ? (mesh.isInstancedMesh ? mesh.parent.add(o) : mesh.add(o)) : null;
  return o;
}

// ───────── 部品の形 ─────────
// 体（胴・首・頭・はな）
function bodySDF(x, y, z) {
  let d = sdEll(x, y, z, [0, 0.36, 0], [0.235, 0.29, 0.21]);
  d = smin(d, sdEll(x, y, z, [0, 0.22, -0.01], [0.245, 0.2, 0.215]), 0.08);
  d = smin(d, sdEll(x, y, z, [0, 0.6, 0.03], [0.15, 0.13, 0.14]), 0.1);
  const head = smin(sdEll(x, y, z, [0, 0.79, 0.02], [0.215, 0.185, 0.19]), sdEll(x, y, z, [0, 0.735, 0.17], [0.145, 0.108, 0.125]), 0.07);
  d = smin(d, head, 0.07);
  return d;
}
function bodyColor(x, y, z, nx, ny, nz, c) {
  c.copy(C.org);
  if (ny < -0.55 && y < 0.15) c.copy(C.orgD);
}
// おなか（前・のどから足のつけねまで）：正なら おなか。2つめは しまの位置
function bodyBelly(x, y, z) {
  let b = z - 0.035 - Math.abs(x) * 0.95;
  b = Math.min(b, (y - 0.05) * 0.6, (0.665 - y) * 0.6, Math.max(0.6 - y, 0.135 - z));
  return [b, y - 0.08 + 0.026];
}
// しっぽ（つけねが原点）
function tailSDF(x, y, z) {
  let d = sdCone(x, y, z, [0, 0.0, 0.02], [0, 0.03, -0.24], 0.1, 0.075);
  d = smin(d, sdCone(x, y, z, [0, 0.03, -0.24], [0, 0.12, -0.42], 0.075, 0.045), 0.04);
  d = smin(d, sdCone(x, y, z, [0, 0.12, -0.42], [0, 0.27, -0.5], 0.045, 0.012), 0.03);
  return d;
}
function tailColor(x, y, z, nx, ny, nz, c) { c.copy(C.org); }
function tailBelly(x, y, z, nx, ny, nz) { return [Math.min(-ny - 0.35, (-z - 0.08)) * 0.1, -z * 1.4]; }
// 足（こかんが原点）
function legSDF(x, y, z) {
  let d = sdEll(x, y, z, [0, -0.07, 0], [0.105, 0.12, 0.11]);
  d = smin(d, sdEll(x, y, z, [0.005, -0.17, 0.045], [0.085, 0.045, 0.115]), 0.05);
  return d;
}
// うで（かたが原点）
function armSDF(x, y, z) {
  let d = sdCone(x, y, z, [0, 0, 0], [0.05, -0.12, 0.06], 0.05, 0.04);
  d = smin(d, sdEll(x, y, z, [0.055, -0.135, 0.07], [0.042, 0.035, 0.042]), 0.03);
  return d;
}

let CACHE = null;
function buildGeoms() {
  if (CACHE) return CACHE;
  const body = paint(polygonize(bodySDF, [-0.28, -0.02, -0.25], [0.28, 1.0, 0.33], 0.0085), bodyColor, bodyBelly);
  const tail = paint(polygonize(tailSDF, [-0.12, -0.12, -0.56], [0.12, 0.3, 0.14], 0.0085), tailColor, tailBelly);
  const leg = paint(polygonize(legSDF, [-0.12, -0.23, -0.13], [0.13, 0.07, 0.18], 0.0075), (x, y, z, nx, ny, nz, c) => c.copy(ny < -0.6 && y < -0.19 ? C.orgD : C.org));
  const arm = paint(polygonize(armSDF, [-0.07, -0.19, -0.07], [0.12, 0.07, 0.13], 0.006), (x, y, z, nx, ny, nz, c) => c.copy(C.org));
  CACHE = { body, tail, leg, arm };
  return CACHE;
}

// つばさ：外わく（オレンジ）と まく（みずいろ）
function wingGeoms() {
  const outer = new THREE.Shape();
  outer.moveTo(0, 0);
  outer.bezierCurveTo(0.06, 0.12, 0.2, 0.26, 0.34, 0.3);
  outer.bezierCurveTo(0.33, 0.22, 0.31, 0.12, 0.27, 0.04);
  outer.quadraticCurveTo(0.22, 0.06, 0.19, 0.0);
  outer.quadraticCurveTo(0.14, 0.02, 0.11, -0.05);
  outer.quadraticCurveTo(0.06, -0.03, 0.02, -0.06);
  outer.lineTo(0, 0);
  const inner = new THREE.Shape();
  inner.moveTo(0.03, 0.0);
  inner.bezierCurveTo(0.08, 0.1, 0.19, 0.21, 0.3, 0.255);
  inner.bezierCurveTo(0.295, 0.19, 0.28, 0.12, 0.255, 0.07);
  inner.quadraticCurveTo(0.215, 0.085, 0.185, 0.03);
  inner.quadraticCurveTo(0.14, 0.045, 0.11, -0.02);
  inner.quadraticCurveTo(0.07, -0.005, 0.035, -0.03);
  inner.lineTo(0.03, 0);
  const o = new THREE.ExtrudeGeometry(outer, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 });
  o.translate(0, 0, -0.007);
  const i1 = new THREE.ShapeGeometry(inner, 16); i1.translate(0, 0, 0.0142);
  const i2 = new THREE.ShapeGeometry(inner, 16); i2.rotateY(Math.PI); i2.scale(-1, 1, 1); i2.translate(0, 0, -0.0142);
  return { o, i1, i2 };
}

export function createKairyu() {
  const G = buildGeoms();
  const mat = softMat();
  const plain = (col, r = 0.55) => softMat({ vertexColors: false, color: col, roughness: r, belly: false });
  const root = new THREE.Group();     // 地面の位置
  const bodyG = new THREE.Group();    // 上下・かたむき
  root.add(bodyG);
  const body = new THREE.Mesh(G.body, mat); bodyG.add(body);
  const shadowMeshes = [body];

  // しっぽ
  const tailP = new THREE.Group(); tailP.position.set(0, 0.2, -0.15); bodyG.add(tailP);
  const tail = new THREE.Mesh(G.tail, mat); tailP.add(tail); shadowMeshes.push(tail);
  // 足
  const legs = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.125, 0.205, 0.0); bodyG.add(p); const m = new THREE.Mesh(G.leg, mat); m.scale.x = s; p.add(m); shadowMeshes.push(m); return p; });
  // うで
  const arms = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.2, 0.5, 0.07); bodyG.add(p); const m = new THREE.Mesh(G.arm, mat); m.scale.x = s; p.add(m); shadowMeshes.push(m); return p; });
  // つめ（足3・手3）
  const clawGeo = new THREE.ConeGeometry(0.014, 0.035, 8); clawGeo.rotateX(Math.PI / 2);
  const clawMat = plain('#fffaf2', 0.4);
  for (const [i, s] of [[0, -1], [1, 1]]) {
    for (let k = -1; k <= 1; k++) { const c = new THREE.Mesh(clawGeo, clawMat); c.position.set(s * (0.005 + k * 0.032), -0.19, 0.155 - Math.abs(k) * 0.012); legs[i].add(c); }
    for (let k = -1; k <= 1; k++) { const c = new THREE.Mesh(clawGeo, clawMat); c.scale.setScalar(0.75); c.position.set(s * (0.055 + k * 0.018), -0.16, 0.105); c.rotation.x = 0.6; arms[i].add(c); }
  }
  // つばさ
  const W = wingGeoms();
  const orgMat = plain('#eaa24e'), tealMat = plain('#5ec8c9', 0.5); tealMat.side = THREE.DoubleSide;
  const wings = [-1, 1].map(s => {
    const p = new THREE.Group(); p.position.set(s * 0.09, 0.56, -0.15); bodyG.add(p);
    const w = new THREE.Group(); p.add(w);
    w.add(new THREE.Mesh(W.o, orgMat), new THREE.Mesh(W.i1, tealMat), new THREE.Mesh(W.i2, tealMat));
    w.scale.set(s, 1, 1);
    p.userData.s = s;
    shadowMeshes.push(w.children[0]);
    return p;
  });
  // つの・しょっかく
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.085, 16), orgMat); horn.position.set(0, 0.995, 0.0); horn.rotation.x = -0.15; bodyG.add(horn);
  const creamMat = plain('#fbebb5', 0.5);
  for (const s of [-1, 1]) {
    const cur = new THREE.CatmullRomCurve3([v3(s * 0.06, 0.945, 0.0), v3(s * 0.13, 1.01, -0.01), v3(s * 0.2, 1.0, 0.0), v3(s * 0.235, 1.06, 0.0), v3(s * 0.22, 1.13, 0.01)]);
    const t = new THREE.Mesh(new THREE.TubeGeometry(cur, 24, 0.017, 10), creamMat); bodyG.add(t);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), creamMat); cap.position.copy(cur.getPoint(1)); bodyG.add(cap);
  }
  // 目：顔の表面に合わせて置く
  const HC = v3(0, 0.79, 0.02), HR = v3(0.215, 0.185, 0.19);
  const onHead = (dx, dy, dz, out = 0) => { const d = v3(dx, dy, dz).normalize(); return { p: v3(HC.x + d.x * HR.x, HC.y + d.y * HR.y, HC.z + d.z * HR.z), n: d }; };
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#1b1517', roughness: 0.25, metalness: 0 });
  const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyes = [-1, 1].map(s => {
    const { p, n } = onHead(s * 0.58, 0.22, 0.78);
    const g = new THREE.Group(); g.position.copy(p); g.lookAt(p.clone().add(n)); bodyG.add(g);
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), eyeMat); e.scale.set(0.05, 0.07, 0.02); g.add(e);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), whiteMat); h1.scale.set(0.014, 0.028, 0.007); h1.position.set(-s * 0.014, 0.024, 0.018); g.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), whiteMat); h2.scale.setScalar(0.007); h2.position.set(s * 0.017, -0.03, 0.017); g.add(h2);
    // にっこり目（＾）
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 8, 20, Math.PI * 0.85), eyeMat); arc.rotation.z = Math.PI * 0.075; arc.position.y = -0.012; arc.visible = false; g.add(arc);
    // とじた目（ー）
    const shut = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 8, 20, Math.PI * 0.7), eyeMat); shut.rotation.z = Math.PI + Math.PI * 0.15; shut.position.y = 0.02; shut.visible = false; g.add(shut);
    return { g, e, h1, h2, arc, shut };
  });
  // はなの あな
  const SC = v3(0, 0.735, 0.17), SR = v3(0.145, 0.108, 0.125);
  const onSnout = (dx, dy, dz) => { const d = v3(dx, dy, dz).normalize(); return v3(SC.x + d.x * SR.x, SC.y + d.y * SR.y, SC.z + d.z * SR.z); };
  for (const s of [-1, 1]) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), eyeMat); n.position.copy(onSnout(s * 0.32, 0.42, 0.85)); n.scale.set(1, 0.7, 0.6); bodyG.add(n); }
  // 口（にっこり線）と あけた口
  const smilePts = []; for (let i = 0; i <= 16; i++) { const t = -0.5 + i / 16 * 1.0; smilePts.push(onSnout(Math.sin(t) * 1.0, -0.36 + Math.abs(t) * 0.22, Math.cos(t))); }
  const smile = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts), 30, 0.0065, 6), eyeMat); bodyG.add(smile);
  const mouthO = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: '#9a2834', roughness: 0.5 }));
  mouthO.position.copy(onSnout(0, -0.42, 0.9)); mouthO.scale.set(0.05, 0.03, 0.02); mouthO.visible = false; bodyG.add(mouthO);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff8aa0', roughness: 0.5 }));
  tongue.scale.set(0.6, 0.45, 0.6); tongue.position.set(0, -0.35, 0.5); mouthO.add(tongue);

  for (const m of shadowMeshes) { m.castShadow = true; m.receiveShadow = false; }
  // ステッカー風の黒いふち
  const OW = 0.02;
  bodyG.traverse((o) => { if (o.isMesh && !o.userData.noOutline && o.material !== eyeMat && o.material !== whiteMat && o.material !== clawMat && o.geometry.type !== 'ShapeGeometry') o.userData.wantOutline = true; });
  const want = []; bodyG.traverse((o) => { if (o.userData.wantOutline) want.push(o); });
  for (const o of want) addOutline(o, o.geometry.type === 'TubeGeometry' ? OW * 0.7 : OW);
  body.receiveShadow = true;

  // ───────── 動き ─────────
  let t = 0, walk = 0, flap = 0;
  function setExpr(x) {
    for (const E of eyes) {
      const open = x === 'n' || x === 'o';
      E.e.visible = E.h1.visible = E.h2.visible = open;
      E.arc.visible = x === 'h'; E.shut.visible = x === 'b' || x === 's';
    }
    mouthO.visible = x === 'o' || x === 'h'; smile.visible = !mouthO.visible;
  }
  setExpr('n');
  // st: { moving, speed(タイル/秒), swim, fly, sleep, hop }
  function update(dt, st) {
    t += dt;
    if (st.moving) walk += dt * st.speed * 3.3; else walk += (Math.round(walk / Math.PI) * Math.PI - walk) * Math.min(1, dt * 8);
    const s = Math.sin(walk), c = Math.cos(walk);
    const amp = st.moving && !st.swim && !st.fly ? 1 : 0;
    // 足ぶみ
    legs[0].rotation.x = s * 0.55 * amp; legs[1].rotation.x = -s * 0.55 * amp;
    arms[0].rotation.x = -s * 0.45 * amp - (st.fly ? 0.6 : 0); arms[1].rotation.x = s * 0.45 * amp - (st.fly ? 0.6 : 0);
    arms[0].rotation.z = -0.15 - (st.swim ? 0.5 + Math.sin(t * 5) * 0.4 : 0); arms[1].rotation.z = 0.15 + (st.swim ? 0.5 + Math.sin(t * 5 + 1) * 0.4 : 0);
    // 体のゆれ
    const breathe = Math.sin(t * 2.2);
    bodyG.position.y = Math.abs(s) * 0.035 * amp + (st.moving ? 0 : breathe * 0.006);
    bodyG.rotation.z = s * 0.06 * amp;
    bodyG.rotation.x = (st.moving ? 0.08 : 0) + (st.fly ? 0.35 : 0);
    bodyG.scale.set(1 - breathe * 0.008, 1 + breathe * 0.012, 1 - breathe * 0.008);
    // しっぽ
    tailP.rotation.y = Math.sin(t * (st.moving ? 6 : 1.6)) * (st.moving ? 0.22 : 0.12);
    tailP.rotation.x = st.fly ? 0.4 : 0;
    // つばさ
    const fs = st.fly ? 14 : st.moving ? 0 : 1.2;
    flap += dt * fs;
    for (const w of wings) {
      const sg = w.userData.s;
      const base = st.fly ? 0.15 : 0.5;
      w.rotation.set(-0.15, sg * (0.62 + Math.sin(flap) * (st.fly ? 0.75 : 0.06)), sg * base);
    }
    // ねむり：まるくなる
    if (st.sleep) { bodyG.rotation.x = 0.25; bodyG.position.y -= 0.05; }
  }
  return { root, bodyG, update, setExpr, height: 1.12 };
}
