// 3Dの街と家の中：2Dのマップデータ（map.js）から立体を組み立てる。1タイル＝1、タイル(x,y) → (x+0.5, 0, y+0.5)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { softMat, addOutline } from './kairyu3d.js';
const OLW = 0.03; // 背景の物のふち線の太さ

const col = (c) => new THREE.Color(c);
// 部品を作る：形に色をつけて動かす
function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], jitter = 0 } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
  g.applyMatrix4(m);
  const n = g.attributes.position.count, c = col(color), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = jitter ? 1 + (Math.sin(i * 12.9898) * 0.5) * jitter : 1;
    a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const merge = (list) => mergeGeometries(list, false);
function lumpy(r, detail, amt, seed) { // でこぼこの球（岩・葉っぱ）
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (Math.sin(x * 7.1 + seed) * Math.cos(y * 6.3 + seed * 2) * Math.sin(z * 5.7 + seed * 3)) * amt;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

// ───────── 物の形（1回だけ作る） ─────────
const SHAPES = {};
function shapes() {
  if (SHAPES.tree) return SHAPES;
  const cyl = (r1, r2, h, n = 10) => new THREE.CylinderGeometry(r1, r2, h, n);
  const sph = (r, a = 16, b = 12) => new THREE.SphereGeometry(r, a, b);
  SHAPES.tree = merge([
    part(cyl(0.09, 0.13, 0.7), '#9b6a44', { p: [0, 0.35, 0] }),
    part(lumpy(0.62, 2, 0.06, 1), '#5fb85c', { p: [0, 1.15, 0], s: [1, 0.92, 1] }),
    part(lumpy(0.42, 2, 0.08, 2), '#6cc464', { p: [0.38, 0.88, 0.12] }),
    part(lumpy(0.4, 2, 0.08, 3), '#58ad55', { p: [-0.36, 0.9, -0.08] }),
    part(lumpy(0.3, 1, 0.08, 4), '#7fd474', { p: [0.08, 1.58, 0.1] }),
  ]);
  SHAPES.pine = merge([
    part(cyl(0.08, 0.11, 0.5), '#8e5f3c', { p: [0, 0.25, 0] }),
    part(new THREE.ConeGeometry(0.62, 0.8, 12), '#3f9a68', { p: [0, 0.75, 0] }),
    part(new THREE.ConeGeometry(0.48, 0.7, 12), '#47a872', { p: [0, 1.15, 0] }),
    part(new THREE.ConeGeometry(0.32, 0.6, 12), '#52b57c', { p: [0, 1.52, 0] }),
  ]);
  const palm = [];
  for (let i = 0; i < 5; i++) palm.push(part(cyl(0.075 - i * 0.006, 0.085 - i * 0.006, 0.36), i % 2 ? '#c49460' : '#b5854f', { p: [i * i * 0.012, 0.18 + i * 0.33, 0], r: [0, 0, -i * 0.06] }));
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; palm.push(part(sph(0.5, 10, 6), i % 2 ? '#5cbf6a' : '#4fb05f', { p: [0.3 + Math.cos(a) * 0.42, 1.7 - 0.12, Math.sin(a) * 0.42], r: [0, -a, -0.35], s: [1, 0.08, 0.3] })); }
  palm.push(part(sph(0.08), '#8b5a33', { p: [0.24, 1.6, 0.08] }), part(sph(0.08), '#8b5a33', { p: [0.36, 1.6, -0.06] }));
  SHAPES.palm = merge(palm);
  SHAPES.deadtree = merge([
    part(cyl(0.07, 0.12, 1.1, 7), '#6e5c6e', { p: [0, 0.55, 0] }),
    part(cyl(0.04, 0.06, 0.6, 6), '#6e5c6e', { p: [-0.22, 1.0, 0], r: [0, 0, 0.9] }),
    part(cyl(0.035, 0.05, 0.5, 6), '#6e5c6e', { p: [0.2, 1.1, 0.05], r: [0.2, 0, -0.8] }),
    part(cyl(0.03, 0.045, 0.4, 6), '#6e5c6e', { p: [0.02, 1.3, -0.1], r: [-0.5, 0, 0.1] }),
  ]);
  SHAPES.stump = merge([part(cyl(0.2, 0.24, 0.25, 12), '#9b6a44', { p: [0, 0.125, 0] }), part(cyl(0.19, 0.19, 0.01, 12), '#e2b98a', { p: [0, 0.255, 0] })]);
  SHAPES.rock = merge([part(lumpy(0.36, 1, 0.12, 5), '#b6aeb8', { p: [0, 0.2, 0], s: [1, 0.7, 0.9] })]);
  SHAPES.cliff = merge([part(lumpy(0.62, 1, 0.14, 6), '#a99487', { p: [0, 0.45, 0], s: [0.95, 1.0, 0.95] }), part(lumpy(0.35, 1, 0.12, 7), '#bba597', { p: [0.15, 0.95, 0.1] })]);
  SHAPES.grave = merge([
    part(new THREE.BoxGeometry(0.42, 0.5, 0.14), '#a6a2b8', { p: [0, 0.25, 0] }),
    part(cyl(0.21, 0.21, 0.14, 16), '#a6a2b8', { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0] }),
    part(new THREE.BoxGeometry(0.05, 0.26, 0.02), '#7d7893', { p: [0, 0.45, 0.075] }),
    part(new THREE.BoxGeometry(0.18, 0.05, 0.02), '#7d7893', { p: [0, 0.5, 0.075] }),
    part(new THREE.BoxGeometry(0.5, 0.06, 0.24), '#8f8aa3', { p: [0, 0.03, 0] }),
  ]);
  SHAPES.sign = merge([part(new THREE.BoxGeometry(0.08, 0.6, 0.08), '#9b6a44', { p: [0, 0.3, 0] }), part(new THREE.BoxGeometry(0.62, 0.38, 0.06), '#d9a46a', { p: [0, 0.62, 0.02] }), part(new THREE.BoxGeometry(0.5, 0.04, 0.01), '#a8764a', { p: [0, 0.66, 0.055] }), part(new THREE.BoxGeometry(0.36, 0.04, 0.01), '#a8764a', { p: [-0.05, 0.57, 0.055] })]);
  SHAPES.lampPost = merge([part(cyl(0.035, 0.05, 1.5, 8), '#4f5a6e', { p: [0, 0.75, 0] }), part(cyl(0.12, 0.14, 0.08, 8), '#4f5a6e', { p: [0, 0.04, 0] }), part(new THREE.ConeGeometry(0.16, 0.12, 8), '#4f5a6e', { p: [0, 1.82, 0] })]);
  SHAPES.lampGlass = new THREE.CylinderGeometry(0.1, 0.08, 0.24, 8); SHAPES.lampGlass.translate(0, 1.64, 0);
  SHAPES.fence = merge([
    part(new THREE.BoxGeometry(0.08, 0.42, 0.08), '#fff7ea', { p: [-0.32, 0.21, 0] }), part(new THREE.BoxGeometry(0.08, 0.42, 0.08), '#fff7ea', { p: [0.32, 0.21, 0] }),
    part(new THREE.BoxGeometry(1.0, 0.06, 0.05), '#fff7ea', { p: [0, 0.3, 0] }), part(new THREE.BoxGeometry(1.0, 0.06, 0.05), '#fff7ea', { p: [0, 0.15, 0] }),
  ]);
  SHAPES.flowerpot = merge([part(cyl(0.18, 0.13, 0.26, 12), '#d9825a', { p: [0, 0.13, 0] }), part(sph(0.1), '#ff8fb1', { p: [-0.08, 0.32, 0] }), part(sph(0.1), '#fff3a6', { p: [0.08, 0.34, 0.04] }), part(sph(0.1), '#c9a6ff', { p: [0, 0.4, -0.06] }), part(sph(0.15), '#5fb35a', { p: [0, 0.26, 0], s: [1, 0.5, 1] })]);
  SHAPES.shell = merge([part(new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#ffd6e0', { p: [0, 0, 0], s: [1, 0.6, 1.1] })]);
  SHAPES.bush = merge([part(lumpy(0.36, 2, 0.06, 8), '#4fa456', { p: [0, 0.3, 0] }), part(lumpy(0.26, 1, 0.08, 9), '#5cb560', { p: [0.24, 0.22, 0.08] }), part(lumpy(0.25, 1, 0.08, 10), '#479c4f', { p: [-0.24, 0.22, -0.04] })]);
  SHAPES.berry = new THREE.SphereGeometry(0.075, 12, 8);
  SHAPES.fountain = merge([
    part(cyl(1.0, 1.05, 0.3, 28), '#c9c2d6', { p: [0, 0.15, 0] }), part(cyl(0.88, 0.88, 0.02, 28), '#8fdcf0', { p: [0, 0.28, 0] }),
    part(cyl(0.12, 0.16, 0.8, 12), '#c9c2d6', { p: [0, 0.6, 0] }), part(cyl(0.42, 0.3, 0.12, 20), '#c9c2d6', { p: [0, 0.98, 0] }), part(cyl(0.36, 0.36, 0.02, 20), '#8fdcf0', { p: [0, 1.04, 0] }),
    part(new THREE.SphereGeometry(0.12, 12, 8), '#e9fbff', { p: [0, 1.15, 0], s: [1, 1.6, 1] }),
  ]);
  return SHAPES;
}

// ───────── 建物 ─────────
function textTexture(text, w, h, bg, fg) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 18); g.fill();
  g.strokeStyle = '#3b2d3a'; g.lineWidth = 6; g.stroke();
  g.fillStyle = fg; g.font = `800 ${h * 0.5}px "M PLUS Rounded 1c", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function building(b, mats) {
  const grp = new THREE.Group();
  const W = b.w - 0.3, D = b.h - 0.5, X = b.x + b.w / 2, Z = b.y + b.h / 2 - 0.1;
  const wallH = b.kind === 'mansion' ? 2.2 : 1.55;
  const wallC = b.kind === 'mansion' ? '#b9b2c9' : '#fff4e2';
  const roofC = b.kind === 'home' ? '#ff8a7a' : b.kind === 'shop' ? '#7fcf8a' : b.kind === 'mansion' ? '#6e5d8e' : b.color;
  const geos = [];
  geos.push(part(new THREE.BoxGeometry(W, wallH, D), wallC, { p: [0, wallH / 2, 0] }));
  geos.push(part(new THREE.BoxGeometry(W + 0.08, 0.14, D + 0.08), '#d9cdb8', { p: [0, 0.07, 0] }));
  // 屋根（三角）
  const rh = b.kind === 'mansion' ? 1.4 : 1.1;
  const sh = new THREE.Shape(); sh.moveTo(-D / 2 - 0.3, 0); sh.lineTo(0, rh); sh.lineTo(D / 2 + 0.3, 0); sh.lineTo(-D / 2 - 0.3, 0);
  const roof = new THREE.ExtrudeGeometry(sh, { depth: W + 0.4, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 2 });
  roof.translate(0, 0, -(W + 0.4) / 2); roof.rotateY(Math.PI / 2);
  geos.push(part(roof, roofC, { p: [0, wallH - 0.02, 0] }));
  if (b.kind === 'home') geos.push(part(new THREE.BoxGeometry(0.32, 0.7, 0.32), '#c97a6a', { p: [W * 0.28, wallH + 0.7, -D * 0.15] }));
  if (b.kind === 'mansion') for (const sx of [-1, 1]) {
    geos.push(part(new THREE.CylinderGeometry(0.5, 0.55, wallH + 0.8, 12), '#a89fbb', { p: [sx * (W / 2 - 0.2), (wallH + 0.8) / 2, D / 2 - 0.4] }));
    geos.push(part(new THREE.ConeGeometry(0.7, 1.2, 12), '#5a4b78', { p: [sx * (W / 2 - 0.2), wallH + 0.8 + 0.6, D / 2 - 0.4] }));
  }
  // ドア
  if (b.door) {
    const dx = b.door[0] + 0.5 - X;
    geos.push(part(new THREE.BoxGeometry(0.62, 1.0, 0.08), b.kind === 'mansion' ? '#4a3a5a' : '#b0784e', { p: [dx, 0.5, D / 2 + 0.03] }));
    geos.push(part(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 16, 1, false, 0, Math.PI), b.kind === 'mansion' ? '#4a3a5a' : '#b0784e', { p: [dx, 1.0, D / 2 + 0.03], r: [Math.PI / 2, 0, Math.PI / 2] }));
    geos.push(part(new THREE.SphereGeometry(0.04, 8, 6), '#ffd34d', { p: [dx + 0.18, 0.5, D / 2 + 0.09] }));
    geos.push(part(new THREE.BoxGeometry(0.9, 0.06, 0.5), '#cdbfa6', { p: [dx, 0.03, D / 2 + 0.3] }));
  }
  const body = new THREE.Mesh(merge(geos), mats.std); body.castShadow = body.receiveShadow = true; grp.add(body); addOutline(body, OLW);
  // まど（夜に光る）
  const wins = b.w >= 8 ? [0.15, 0.32, 0.68, 0.85] : [0.2, 0.8];
  const wgeo = [];
  for (const f of wins) {
    const wx = -W / 2 + W * f;
    if (b.door && Math.abs(wx - (b.door[0] + 0.5 - X)) < 0.6) continue;
    wgeo.push(part(new THREE.BoxGeometry(0.5, 0.5, 0.04), '#ffffff', { p: [wx, wallH * 0.58, D / 2 + 0.02] }));
    if (b.kind === 'mansion') wgeo.push(part(new THREE.BoxGeometry(0.5, 0.5, 0.04), '#ffffff', { p: [wx, wallH * 0.58 + 0.75, D / 2 + 0.02] }));
  }
  if (wgeo.length) {
    const wm = new THREE.Mesh(merge(wgeo), mats.window); grp.add(wm);
    const frame = merge(wgeo.map(g => { const c = g.clone(); c.scale(1, 1, 1); return c; }));
    const fm = new THREE.Mesh(frame, mats.frame); fm.scale.set(1.18, 1.18, 0.6); // 枠は少し大きく、うしろに
    fm.position.z = -0.01; fm.position.y = 0; grp.add(fm); fm.renderOrder = -1;
    // 十字の桟
    const bars = [];
    for (const g of wgeo) { g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3()); bars.push(part(new THREE.BoxGeometry(0.04, 0.5, 0.02), '#4a3a45', { p: [c.x, c.y, c.z + 0.03] }), part(new THREE.BoxGeometry(0.5, 0.04, 0.02), '#4a3a45', { p: [c.x, c.y, c.z + 0.03] })); }
    grp.add(new THREE.Mesh(merge(bars), mats.std));
  }
  if (b.kind === 'shop') {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ map: textTexture('きのみや', 320, 100, '#fff8e8', '#c0485a'), transparent: true }));
    s.position.set(0, wallH + 0.15, D / 2 + 0.18); s.rotation.x = -0.25; grp.add(s);
    // しましまのひさし
    const aw = [];
    for (let i = 0; i < 8; i++) aw.push(part(new THREE.BoxGeometry(W / 8, 0.05, 0.5), i % 2 ? '#ffffff' : '#ff8fb1', { p: [-W / 2 + W / 16 + i * W / 8, wallH * 0.86, D / 2 + 0.22], r: [0.35, 0, 0] }));
    const am = new THREE.Mesh(merge(aw), mats.std); am.castShadow = true; grp.add(am); addOutline(am, OLW * 0.6);
  }
  if (b.kind === 'home') { // カイリュー色のポスト
    const post = new THREE.Mesh(merge([part(new THREE.BoxGeometry(0.06, 0.7, 0.06), '#4f5a6e', { p: [0, 0.35, 0] }), part(new THREE.BoxGeometry(0.3, 0.24, 0.22), '#f7b45a', { p: [0, 0.8, 0] })]), mats.std);
    post.position.set(W / 2 + 0.25, 0, D / 2 + 0.2); post.castShadow = true; grp.add(post); addOutline(post, OLW * 0.7);
  }
  grp.position.set(X, 0, Z);
  return grp;
}

// ───────── 地面（2Dの地面の絵を大きな1枚にしてはる） ─────────
function groundTexture(m, maxTex) {
  const scale = Math.min(2, maxTex / (Math.max(m.w, m.h) * T));
  const c = document.createElement('canvas');
  c.width = Math.round(m.w * T * scale); c.height = Math.round(m.h * T * scale);
  const g = c.getContext('2d');
  const px = CH * T * scale;
  for (let cy = 0; cy * CH < m.h; cy++) for (let cx = 0; cx * CH < m.w; cx++) g.drawImage(drawChunk(m, cx, cy, scale), cx * px, cy * px);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function waterMask(m) {
  const c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
  const g = c.getContext('2d'); const id = g.createImageData(m.w, m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const t = m.get(x, y), k = (y * m.w + x) * 4; id.data[k] = WATER(t) ? 255 : 0; id.data[k + 1] = t === G.LAVA ? 255 : 0; id.data[k + 3] = 255; }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; return t;
}
function waterMaterial(mask, w, h) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMask: { value: mask }, uT: { value: 0 }, uSize: { value: new THREE.Vector2(w, h) }, uNight: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D uMask; uniform float uT; uniform vec2 uSize; uniform float uNight; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        vec4 mk = texture2D(uMask, uv);
        float m = mk.r, lv = mk.g;
        vec2 p = vec2(uv.x, 1.0 - uv.y) * uSize;
        if (lv > 0.5) { // ようがん
          float g = n(p * 1.5 + uT * 0.4) * 0.6 + n(p * 3.0 - uT * 0.3) * 0.4;
          gl_FragColor = vec4(vec3(1.0, 0.55 + g * 0.35, 0.15 + g * 0.2), (0.35 + g * 0.35) * smoothstep(0.5, 0.9, lv));
          return;
        }
        if (m < 0.5) discard;
        float w1 = n(p * 1.3 + vec2(uT * 0.35, uT * 0.2));
        float w2 = n(p * 2.6 - vec2(uT * 0.25, -uT * 0.3));
        float ridge = 1.0 - abs(w1 + w2 - 1.0) * 2.0;
        float s = smoothstep(0.82, 0.97, ridge);
        float edge = smoothstep(0.5, 0.95, m);
        vec3 c = mix(vec3(1.0), vec3(0.8, 0.9, 1.0), uNight);
        gl_FragColor = vec4(c, s * 0.42 * edge + 0.04);
      }`,
  });
}

// ───────── 街ぜんぶを組み立てる ─────────
export function buildWorld3D(m, renderer, S) {
  const sh = shapes();
  const group = new THREE.Group();
  const mats = {
    std: softMat({ belly: false }),
    window: new THREE.MeshStandardMaterial({ color: '#bfe7ff', emissive: '#ffd27a', emissiveIntensity: 0, roughness: 0.2 }),
    frame: new THREE.MeshStandardMaterial({ color: '#4a3a45', roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#fff6c8', emissive: '#ffcf6a', emissiveIntensity: 0.2, roughness: 0.3 }),
    berry: new THREE.MeshStandardMaterial({ roughness: 0.35 }),
  };
  const maxTex = Math.min(renderer.capabilities.maxTextureSize, 4096);
  // 地面
  const gt = groundTexture(m, maxTex); gt.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.h), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(m.w / 2, 0, m.h / 2); ground.receiveShadow = true; group.add(ground);
  // 水
  let water = null;
  if (m.name === 'town') {
    water = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.h), waterMaterial(waterMask(m), m.w, m.h));
    water.rotation.x = -Math.PI / 2; water.position.set(m.w / 2, 0.015, m.h / 2); water.renderOrder = 2; group.add(water);
    // まわりの海
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#3f9fd2', roughness: 0.6 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(m.w / 2, -0.02, m.h / 2); sea.receiveShadow = true; group.add(sea);
  }
  // 物をタイプごとにまとめて置く（InstancedMesh）
  const byType = {};
  const bushes = [], shells = [], lamps = [], signs = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const o = m.o(x, y); if (!o) continue;
    const r = hash2(x, y, 77);
    if (o.t === 'bush') { bushes.push({ o, x, y }); continue; }
    if (o.t === 'shell') { shells.push({ x, y, key: `${x},${y}` }); continue; }
    if (o.t === 'lamp') { lamps.push([x, y]); }
    (byType[o.t] = byType[o.t] || []).push({ x, y, r });
  }
  const dummy = new THREE.Object3D();
  const inst = (geo, list, mat, fn, shadow = true) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { dummy.position.set(it.x + 0.5, 0, it.y + 0.5); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); fn && fn(dummy, it, i); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.castShadow = shadow; im.receiveShadow = true; group.add(im); if (shadow) addOutline(im, OLW); return im;
  };
  const tint = (im, list, f) => { if (!im) return; const c = new THREE.Color(); list.forEach((it, i) => { f(c, it); im.setColorAt(i, c); }); im.instanceColor.needsUpdate = true; };
  const rotS = (d, it, s0 = 0.9, s1 = 0.25) => { d.rotation.y = it.r * 6.28; const s = s0 + it.r * s1; d.scale.set(s, s, s); };
  const trees = inst(sh.tree, byType.tree || [], mats.std, (d, it) => rotS(d, it, 0.85, 0.35));
  tint(trees, byType.tree || [], (c, it) => c.setHSL(0, 0, 1).offsetHSL(0, 0, 0).multiplyScalar(0.92 + it.r * 0.16));
  inst(sh.pine, byType.pine || [], mats.std, (d, it) => rotS(d, it, 0.85, 0.4));
  inst(sh.palm, byType.palm || [], mats.std, (d, it) => rotS(d, it, 0.85, 0.3));
  inst(sh.deadtree, byType.deadtree || [], mats.std, (d, it) => rotS(d, it, 0.9, 0.3));
  inst(sh.stump, byType.stump || [], mats.std, (d, it) => rotS(d, it));
  inst(sh.rock, byType.rock || [], mats.std, (d, it) => rotS(d, it, 0.8, 0.6));
  inst(sh.cliff, byType.cliff || [], mats.std, (d, it) => { d.rotation.y = it.r * 6.28; d.scale.set(1.15, 0.9 + it.r * 0.7, 1.15); });
  inst(sh.grave, byType.grave || [], mats.std, (d, it) => { d.rotation.y = (it.r - 0.5) * 0.3; });
  inst(sh.sign, byType.sign || [], mats.std, null);
  inst(sh.flowerpot, byType.flowerpot || [], mats.std, null);
  inst(sh.fence, byType.fence || [], mats.std, (d, it) => { d.position.z -= 0.3; });
  inst(sh.lampPost, lamps.map(([x, y]) => ({ x, y })), mats.std, null);
  const glass = inst(sh.lampGlass, lamps.map(([x, y]) => ({ x, y })), mats.glass, null, false);
  const fountain = (byType.fountain || [])[0];
  if (fountain) { const f = new THREE.Mesh(sh.fountain, mats.std); f.position.set(fountain.x + 1, 0, fountain.y + 1); f.castShadow = f.receiveShadow = true; group.add(f); addOutline(f, OLW); }
  // かいがら（1つずつ、拾ったら消す）
  const shellObjs = {};
  for (const s of shells) { const o = new THREE.Mesh(sh.shell, mats.std); addOutline(o, 0.02); o.position.set(s.x + 0.5 + (hash2(s.x, s.y, 4) - 0.5) * 0.4, 0, s.y + 0.5); o.rotation.y = hash2(s.x, s.y, 5) * 6; group.add(o); shellObjs[s.key] = o; }
  // きのみのしげみ
  const bushObjs = {};
  for (const b of bushes) {
    const g = new THREE.Group(); g.position.set(b.x + 0.5, 0, b.y + 0.5); g.rotation.y = hash2(b.x, b.y, 6) * 6;
    const bm = new THREE.Mesh(sh.bush, mats.std); bm.castShadow = bm.receiveShadow = true; g.add(bm); addOutline(bm, OLW);
    const bc = new THREE.MeshStandardMaterial({ color: BERRIES[b.o.berry].color, roughness: 0.3 });
    const berries = new THREE.Group();
    for (const [x, y, z] of [[0.2, 0.42, 0.22], [-0.15, 0.5, 0.2], [0.28, 0.25, -0.1], [-0.3, 0.3, 0.1], [0.02, 0.6, -0.05]]) { const s = new THREE.Mesh(sh.berry, bc); s.position.set(x, y, z); berries.add(s); addOutline(s, 0.015); }
    g.add(berries); group.add(g);
    bushObjs[b.o.key] = berries;
  }
  // 建物
  for (const b of m.buildings) { const bg = building(b, mats); group.add(bg); }

  return {
    group, water, mats, bushObjs, shellObjs, lamps,
    update(t, night) {
      if (water) { water.material.uniforms.uT.value = t; water.material.uniforms.uNight.value = night; }
      mats.window.emissiveIntensity = night * 1.4; mats.window.color.set(night > 0.5 ? '#ffe9a0' : '#bfe7ff');
      mats.glass.emissiveIntensity = 0.2 + night * 2.2;
    },
  };
}

// ───────── 家の中 ─────────
export function buildHome3D(m, renderer) {
  const group = new THREE.Group();
  const std = softMat({ belly: false });
  const maxTex = Math.min(renderer.capabilities.maxTextureSize, 4096);
  const gt = groundTexture(m, maxTex);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.h), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(m.w / 2, 0, m.h / 2); floor.receiveShadow = true; group.add(floor);
  const g = [];
  const WH = 2.2;
  // 壁（奥は高く、左右は低め、手前はふちだけ）
  g.push(part(new THREE.BoxGeometry(m.w, WH, 0.3), '#f7dfe0', { p: [m.w / 2, WH / 2, 1.85] }));
  g.push(part(new THREE.BoxGeometry(m.w, 0.25, 0.32), '#d9a3a8', { p: [m.w / 2, 0.125, 2.0] }));
  for (const sx of [0.85, m.w - 0.85]) g.push(part(new THREE.BoxGeometry(0.3, 1.1, m.h - 2.2), '#f3d3d6', { p: [sx, 0.55, (m.h - 2.2) / 2 + 2.0] }));
  g.push(part(new THREE.BoxGeometry(m.door[0] - 0.7, 0.35, 0.3), '#c79d72', { p: [(m.door[0] - 0.7) / 2 + 0.7, 0.175, m.h - 0.85] }));
  g.push(part(new THREE.BoxGeometry(m.w - m.door[0] - 1.7, 0.35, 0.3), '#c79d72', { p: [m.door[0] + 1 + (m.w - m.door[0] - 1.7) / 2, 0.175, m.h - 0.85] }));
  // 家具
  const cyl = (r1, r2, h, n = 24) => new THREE.CylinderGeometry(r1, r2, h, n);
  g.push(part(new THREE.TorusGeometry(0.88, 0.13, 12, 36), '#fbe9f0', { p: [3, 0.4, 3], r: [Math.PI / 2, 0, 0] }));
  g.push(part(cyl(0.95, 1.0, 0.4, 32), '#f4d9e4', { p: [3, 0.2, 3] }));
  g.push(part(cyl(0.84, 0.84, 0.02, 32), '#6fd0ec', { p: [3, 0.41, 3] }));
  g.push(part(new THREE.SphereGeometry(0.06, 8, 6), '#ffffff', { p: [2.6, 0.43, 2.8] }), part(new THREE.SphereGeometry(0.045, 8, 6), '#ffffff', { p: [2.75, 0.43, 3.3] }));
  g.push(part(new THREE.SphereGeometry(0.12, 12, 8), '#ffd34d', { p: [3.35, 0.47, 3.2], s: [1, 0.8, 1.2] }), part(new THREE.SphereGeometry(0.08, 12, 8), '#ffd34d', { p: [3.35, 0.6, 3.32] }), part(new THREE.ConeGeometry(0.03, 0.07, 8), '#ff8a3d', { p: [3.35, 0.59, 3.42], r: [Math.PI / 2, 0, 0] }));
  g.push(part(cyl(0.32, 0.24, 0.16), '#ff9fb6', { p: [9.5, 0.08, 2.5] }), part(new THREE.SphereGeometry(0.07, 10, 8), '#4f86e0', { p: [9.4, 0.18, 2.5] }), part(new THREE.SphereGeometry(0.07, 10, 8), '#f08cb0', { p: [9.58, 0.18, 2.45] }), part(new THREE.SphereGeometry(0.07, 10, 8), '#f2c63a', { p: [9.5, 0.19, 2.62] }));
  g.push(part(new THREE.BoxGeometry(0.8, 0.55, 0.6), '#ffcf6b', { p: [11.5, 0.275, 2.6] }), part(new THREE.BoxGeometry(0.86, 0.12, 0.66), '#ff9f6b', { p: [11.5, 0.6, 2.6] }), part(new THREE.SphereGeometry(0.16, 12, 8), '#ff6b8a', { p: [11.35, 0.78, 2.6] }), part(new THREE.SphereGeometry(0.13, 12, 8), '#6bc6ff', { p: [11.68, 0.75, 2.5] }));
  g.push(part(new THREE.BoxGeometry(0.9, 1.6, 0.4), '#c99566', { p: [6.5, 0.8, 2.25] }));
  for (const [x, y, c] of [[6.25, 0.6, '#ff8fb1'], [6.5, 0.6, '#6bc6ff'], [6.75, 0.6, '#ffd34d'], [6.3, 1.15, '#9fe08a'], [6.65, 1.15, '#c9a6ff']]) g.push(part(new THREE.BoxGeometry(0.16, 0.36, 0.25), c, { p: [x, y, 2.35] }));
  g.push(part(cyl(0.55, 0.6, 0.18), '#ffb6c9', { p: [1.6, 0.09, 5.5], s: [1, 1, 0.8] }));
  for (const [x, z] of [[1.5, 8.5], [11.5, 8.5]]) { g.push(part(cyl(0.25, 0.18, 0.4, 14), '#e8eef6', { p: [x, 0.2, z] })); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; g.push(part(new THREE.SphereGeometry(0.2, 10, 8), '#5fb35a', { p: [x + Math.cos(a) * 0.12, 0.62, z + Math.sin(a) * 0.12], s: [0.5, 1.4, 0.5], r: [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4] })); } }
  const mesh = new THREE.Mesh(merge(g), std); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); addOutline(mesh, 0.025);
  // まど（奥のかべ）
  const winMat = new THREE.MeshStandardMaterial({ color: '#a8e1ff', emissive: '#203060', emissiveIntensity: 0 });
  for (const wx of [3.5, 9.5]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 0.05), winMat); w.position.set(wx, 1.35, 2.02); group.add(w);
    const fr = new THREE.Mesh(merge([part(new THREE.BoxGeometry(1.45, 0.08, 0.08), '#ffffff', { p: [0, 0.54, 0] }), part(new THREE.BoxGeometry(1.45, 0.08, 0.08), '#ffffff', { p: [0, -0.54, 0] }), part(new THREE.BoxGeometry(0.08, 1.1, 0.08), '#ffffff', { p: [0, 0, 0] }), part(new THREE.BoxGeometry(0.4, 1.15, 0.06), '#ffb6c9', { p: [-0.85, 0, 0.02] }), part(new THREE.BoxGeometry(0.4, 1.15, 0.06), '#ffb6c9', { p: [0.85, 0, 0.02] })]), std);
    fr.position.set(wx, 1.35, 2.04); group.add(fr);
  }
  return { group, update(t, night) { winMat.color.set(night > 0.5 ? '#2c3a6e' : '#a8e1ff'); } };
}
