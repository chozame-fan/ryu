// マップ：街（外）と家の中。地面は「タイルごとの丸い色のかたまり」を重ねて角を丸くし、
// 8×8タイルずつ画像にためて描く。木・家などの立っている物は y の順に人物と一緒に描く。

const T = 32; // 1タイルの大きさ（ワールド座標）
const G = {
  GRASS: 0, PATH: 1, SAND: 2, SHALLOW: 3, DEEP: 4, DARK: 5, ROCKY: 6, LAVA: 7, FLOWER: 8, TALL: 9,
  BRIDGE: 10, PLAZA: 11, FLOOR: 20, WALL: 21, RUG: 22,
};
const WATER = (g) => g === G.SHALLOW || g === G.DEEP;

// 決まった乱数（毎回同じ街になる）
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function makeMap(name, w, h) {
  return {
    name, w, h,
    ter: new Uint8Array(w * h),
    obj: new Array(w * h).fill(null),   // 1タイルの物（木・岩・しげみ…）
    solid: new Uint8Array(w * h),
    buildings: [], signs: {}, lamps: [], chunks: new Map(),
    get(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? -1 : this.ter[y * w + x]; },
    set(x, y, g) { if (x >= 0 && y >= 0 && x < w && y < h) this.ter[y * w + x] = g; },
    o(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? null : this.obj[y * w + x]; },
    put(x, y, o) { if (x >= 0 && y >= 0 && x < w && y < h) this.obj[y * w + x] = o; },
  };
}

// ───────── 街をつくる ─────────
function buildTown() {
  const W = 80, H = 64;
  const m = makeMap('town', W, H);
  const shoreY = (x) => 48 + Math.sin(x * 0.21) * 0.9 + (noise2(x * 0.2, 3.3, 7) - 0.5) * 1.6;
  const deepY = (x) => shoreY(x) + 4 + noise2(x * 0.15, 9.1, 8) * 2.2;
  const circ = (cx, cy, r, f) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r) f(x, y, d); } };
  const rect = (x0, y0, x1, y1, f) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(x, y); };

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let g = G.GRASS;
    const sy = shoreY(x);
    if (y > sy + 0.5) g = y > deepY(x) ? G.DEEP : G.SHALLOW;
    else if (y > sy - 4 + noise2(x * 0.3, 1, 2) * 1.5) g = G.SAND;
    else if (x <= 27 && y <= 7) g = (hash2(x, y, 3) < 0.55 || noise2(x * 0.3, y * 0.3, 4) > 0.5) ? G.FLOWER : G.GRASS;
    else if (x >= 31 && x <= 56 && y <= 15) g = G.DARK;
    else if (x >= 60 && y <= 45) g = G.ROCKY;
    m.ter[y * W + x] = g;
  }
  // 島（ふしぎな しま）
  circ(64, 60, 7.5, (x, y, d) => { if (d > 4.6 && y > shoreY(x) + 1.5) m.set(x, y, G.DEEP); });
  circ(64, 60, 4.6, (x, y) => m.set(x, y, G.SHALLOW));
  circ(64, 60, 3.3, (x, y) => m.set(x, y, G.SAND));
  circ(64, 59.6, 1.6, (x, y) => m.set(x, y, G.GRASS));
  // 森の池
  circ(20, 13, 4.4, (x, y) => m.set(x, y, G.SAND));
  circ(20, 13, 3.1, (x, y) => m.set(x, y, G.SHALLOW));
  // ようがん
  circ(73, 10, 3.2, (x, y) => m.set(x, y, G.LAVA));
  circ(76, 15, 1.8, (x, y) => m.set(x, y, G.LAVA));
  // はらっぱ（ピカチュウ）と ひだまり（フシギダネ）
  circ(12, 19, 5.5, (x, y, d) => m.set(x, y, d < 4.5 && hash2(x, y, 5) < 0.7 ? G.TALL : G.GRASS));
  circ(15, 37, 4.5, (x, y) => m.set(x, y, hash2(x, y, 6) < 0.35 ? G.FLOWER : G.GRASS));
  // 道
  for (let x = 2; x <= 78; x++) { m.set(x, 29, G.PATH); m.set(x, 30, G.PATH); }
  for (let y = 14; y <= 46; y++) if (m.get(42, y) !== G.SHALLOW) { m.set(42, y, G.PATH); m.set(43, y, G.PATH); }
  { let px = null; for (let y = 3; y <= 29; y++) { const x = Math.round(14 + Math.sin(y * 0.35) * 1.5); for (let xx = Math.min(px ?? x, x); xx <= Math.max(px ?? x, x); xx++) m.set(xx, y, G.PATH); px = x; } }
  for (let y = 7; y <= 14; y++) { m.set(42, y, G.PATH); m.set(43, y, G.PATH); }
  for (let x = 30; x <= 42; x++) m.set(x, 44, G.PATH);
  for (let y = 31; y <= 44; y++) m.set(30, y, G.PATH);
  for (let x = 60; x <= 74; x++) { const y = Math.round(29 - (x - 60) * 0.0 + Math.sin(x * 0.5) * 0.4); m.set(x, y, G.PATH); }
  { let px = null; for (let y = 16; y <= 38; y++) { const x = Math.round(68 + Math.sin(y * 0.4)); for (let xx = Math.min(px ?? x, x); xx <= Math.max(px ?? x, x); xx++) m.set(xx, y, G.PATH); px = x; } }
  // ひろば
  circ(42.5, 35.5, 4.2, (x, y) => m.set(x, y, G.PLAZA));
  // さんばし
  for (let y = 46; y <= 53; y++) { m.set(42, y, G.BRIDGE); m.set(43, y, G.BRIDGE); }

  // 建物
  const bld = (b) => { m.buildings.push(b); rect(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, (x, y) => { m.set(x, y, G.GRASS); }); if (b.door) { const [dx, dy] = b.door; for (let y = dy + 1; y <= 28; y++) if (m.get(dx, y) !== G.PATH) m.set(dx, y, G.PATH); else break; } };
  bld({ id: 'home', kind: 'home', x: 32, y: 21, w: 6, h: 5, door: [35, 25], label: 'ちびリューの いえ' });
  bld({ id: 'shop', kind: 'shop', x: 47, y: 21, w: 6, h: 5, door: [49, 25], label: 'きのみや' });
  bld({ id: 'house2', kind: 'house', x: 32, y: 34, w: 5, h: 4, door: [34, 37], color: '#6f9ed8' });
  bld({ id: 'house3', kind: 'house', x: 49, y: 34, w: 5, h: 4, door: [51, 37], color: '#e0a64e' });
  bld({ id: 'mansion', kind: 'mansion', x: 38, y: 1, w: 10, h: 6, door: [42, 6], label: 'ふるい おやしき' });
  for (const [x, y] of [[34, 38], [34, 39], [51, 38], [51, 39]]) m.set(x, y, G.PATH);
  for (let x = 34; x <= 51; x++) if (m.get(x, 40) !== G.PLAZA) m.set(x, 40, G.PATH);

  // 物をおく
  const free = (x, y) => !m.o(x, y) && !m.buildings.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  const near = (x, y, g, r = 1) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (m.get(x + i, y + j) === g) return true; return false; };
  const keepClear = new Set();
  const clear = (cx, cy, r) => circ(cx, cy, r, (x, y) => keepClear.add(y * W + x));
  clear(12, 19, 4); clear(15, 37, 3.5); clear(20, 13, 4.6); clear(64, 60, 1.2); clear(44, 10, 3);
  for (const m2 of MONS) clear(m2.home[0], m2.home[1], 1.5);
  for (const t of TREASURES) clear(t.x, t.y, 1.2);

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const g = m.get(x, y), k = y * W + x;
    if (!free(x, y) || keepClear.has(k)) continue;
    if (g === G.PATH || g === G.PLAZA || g === G.BRIDGE || WATER(g) || g === G.LAVA) continue;
    if (near(x, y, G.PATH, 0) || (near(x, y, G.PATH, 1) && g !== G.ROCKY)) continue;
    const r = hash2(x, y, 11);
    const edge = x < 2 || x > W - 3 || y < 2;
    if (edge && !WATER(g) && g !== G.SAND) { m.put(x, y, { t: hash2(x, y, 2) < 0.5 ? 'pine' : 'tree' }); continue; }
    if (g === G.SAND) {
      const isl = Math.hypot(x - 64, y - 60) < 5;
      if ((isl && r < 0.22) || (!isl && r < 0.035 && y < shoreY(x) - 1.5)) m.put(x, y, { t: 'palm' });
      else if (r > 0.975) m.put(x, y, { t: 'shell' });
      continue;
    }
    if (x <= 27 && y >= 8 && y <= 45) { // 森
      const n = noise2(x * 0.22, y * 0.22, 12);
      if (n > 0.36 && r < 0.78) m.put(x, y, { t: r < 0.35 ? 'pine' : 'tree' });
      else if (r > 0.94) m.put(x, y, { t: 'stump' });
      continue;
    }
    if (x <= 27 && y < 8) { if (r < 0.06) m.put(x, y, { t: 'tree' }); continue; }
    if (g === G.DARK) { if (r < 0.08) m.put(x, y, { t: 'deadtree' }); else if (r > 0.96) m.put(x, y, { t: 'rock' }); continue; }
    if (g === G.ROCKY) { if (r < 0.1) m.put(x, y, { t: 'rock' }); else if (r < 0.13) m.put(x, y, { t: 'pine' }); continue; }
    // 町のまわり
    const inTown = x >= 29 && x <= 56 && y >= 16 && y <= 44;
    if (!inTown && r < 0.12) m.put(x, y, { t: r < 0.04 ? 'pine' : 'tree' });
    else if (inTown && r < 0.015) m.put(x, y, { t: 'tree' });
  }
  // 町と岩山のあいだのがけ（カビゴンのところだけ道がある）
  for (let y = 0; y < H; y++) for (let x = 57; x <= 59; x++) {
    if (y === 29 || y === 30) continue;
    const g = m.get(x, y);
    if (g === G.DEEP) continue;
    m.put(x, y, { t: 'cliff' }); if (g === G.PATH) m.set(x, y, G.GRASS);
  }
  // 池のまわりの木を少し
  // おやしきのまわり：はか
  for (const [x, y] of [[36, 9], [38, 11], [36, 13], [48, 9], [50, 11], [48, 13], [52, 9], [34, 11]]) m.put(x, y, { t: 'grave' });
  // ひろばの噴水
  for (const [x, y] of [[42, 35], [43, 35], [42, 36], [43, 36]]) m.put(x, y, { t: 'fountainPart' });
  m.put(42, 35, { t: 'fountain' });
  // 柵と花だん
  for (let x = 31; x <= 38; x++) if (!m.o(x, 27) && m.get(x, 27) !== G.PATH) m.put(x, 27, { t: 'fence' });
  for (let x = 46; x <= 53; x++) if (!m.o(x, 27) && m.get(x, 27) !== G.PATH) m.put(x, 27, { t: 'fence' });
  for (const [x, y] of [[31, 24], [39, 24], [46, 24], [54, 24]]) m.put(x, y, { t: 'flowerpot' });
  // 街灯
  for (const [x, y] of [[40, 28], [45, 28], [33, 31], [52, 31], [41, 40], [44, 40], [40, 17], [45, 17], [30, 33], [62, 31], [41, 46]]) { m.put(x, y, { t: 'lamp' }); m.lamps.push([x, y]); }
  // 看板
  const sign = (x, y, text) => { m.put(x, y, { t: 'sign' }); m.signs[y * W + x] = text; };
  sign(36, 28, 'ちびリューの いえ\nいつでも かえって おいで。');
  sign(44, 16, 'きた：ふるい おやしき\nよるに なると… あおい ひが ゆれる。');
  sign(28, 31, 'にし：ささやきの もり\nおくに いけと はらっぱが ある。');
  sign(56, 28, 'ひがし：ほのおの いわやま\nあしもとの ようがんに きをつけて。');
  sign(44, 45, 'みなみ：さざなみ ビーチ\nふかい うみは おとなに なって とべるように なってから。');
  sign(15, 9, 'きたにし：おはなばたけ\nよつばを さがして みよう。');
  sign(61, 46, '？？？\nうみの むこうに ちいさな しまが みえる。');
  sign(19, 30, 'もりの みち\nきたへ すすむと いけが あるよ。');

  // きのみの しげみ
  const bush = (x, y, b) => { m.set(x, y, m.get(x, y) === G.PATH ? G.GRASS : m.get(x, y)); m.put(x, y, { t: 'bush', berry: b, key: `${x},${y}` }); };
  [[37, 31, 'oren'], [31, 26, 'oren'], [53, 32, 'momon'], [10, 34, 'momon'], [19, 41, 'momon'], [8, 21, 'nana'], [17, 24, 'nana'], [8, 5, 'momon'], [22, 4, 'momon'],
   [30, 46, 'oren'], [51, 46, 'nana'], [64, 14, 'kurabo'], [70, 25, 'kurabo'], [66, 38, 'kurabo'], [36, 12, 'chigo'], [53, 7, 'chigo'], [62, 60, 'oren'], [24, 16, 'oren']].forEach(a => bush(...a));

  finalize(m);
  return m;
}

// ───────── 家の中 ─────────
function buildHome() {
  const W = 13, H = 10;
  const m = makeMap('home', W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m.ter[y * W + x] = (y < 2 || y === H - 1 || x === 0 || x === W - 1) ? G.WALL : G.FLOOR;
  for (let y = 4; y <= 7; y++) for (let x = 4; x <= 8; x++) if (Math.hypot((x - 6) / 2.6, (y - 5.5) / 1.9) < 1.05) m.ter[y * W + x] = G.RUG;
  m.set(6, H - 1, G.FLOOR); // げんかん
  m.door = [6, H - 1];
  m.put(2, 2, { t: 'tub' }); m.put(3, 2, { t: 'tubPart' }); m.put(2, 3, { t: 'tubPart' }); m.put(3, 3, { t: 'tubPart' });
  m.put(9, 2, { t: 'bowl' });
  m.put(11, 2, { t: 'toybox' });
  m.put(1, 8, { t: 'plant' }); m.put(11, 8, { t: 'plant' });
  m.put(6, 2, { t: 'shelf' });
  m.put(1, 5, { t: 'cushion' });
  m.windows = [[3.5, 0.3], [9.5, 0.3]];
  finalize(m);
  return m;
}

function finalize(m) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const k = y * m.w + x, g = m.ter[k], o = m.obj[k];
    let s = 0;
    if (g === G.LAVA || g === G.WALL) s = 1;
    if (o && !['shell', 'flowerpotX'].includes(o.t)) s = 1;
    m.solid[k] = s;
  }
  for (const b of m.buildings) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    if (b.door && b.kind === 'home' && x === b.door[0] && y === b.door[1]) continue;
    m.solid[y * m.w + x] = 1;
  }
}

// プレイヤーが通れるか（deep＝おとなだけ）
function passable(m, x, y, canDeep) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  const k = y * m.w + x;
  if (m.solid[k]) return false;
  const g = m.ter[k];
  if (g === G.DEEP && !canDeep) return false;
  return true;
}
function buildingAt(m, x, y) { return m.buildings.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h); }

// ───────── 地面の色 ─────────
const PAL = {
  [G.GRASS]: ['#9fd77a', '#9cd477'], [G.FLOWER]: ['#a4da7e', '#a1d77b'], [G.TALL]: ['#84c565', '#80c161'],
  [G.PATH]: ['#ecd9a8', '#e9d5a3'], [G.PLAZA]: ['#e9e1d0', '#e2d9c6'], [G.SAND]: ['#f6e6b4', '#f4e3af'],
  [G.SHALLOW]: ['#7fd6ea', '#7fd6ea'], [G.DEEP]: ['#3f9fd2', '#3f9fd2'], [G.DARK]: ['#8c88a6', '#8985a3'],
  [G.ROCKY]: ['#d7b48d', '#d3b089'], [G.LAVA]: ['#ff7a3d', '#f06a33'], [G.BRIDGE]: ['#b78456', '#a97a4e'],
  [G.FLOOR]: ['#e9c99a', '#e2c08f'], [G.WALL]: ['#f7dfe0', '#f2d6d8'], [G.RUG]: ['#bfe3f2', '#b5dcee'],
};
// 重ねる順（あとの物ほど上）
const LAYERS = [G.GRASS, G.FLOWER, G.TALL, G.DARK, G.ROCKY, G.SAND, G.PATH, G.PLAZA, G.SHALLOW, G.DEEP, G.LAVA, G.BRIDGE];

const CH = 8; // チャンクのタイル数
function drawChunk(m, cx, cy, scale) {
  const c = document.createElement('canvas');
  const px = CH * T;
  c.width = c.height = Math.ceil(px * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.translate(-cx * px, -cy * px);
  const x0 = cx * CH - 1, y0 = cy * CH - 1, x1 = x0 + CH + 1, y1 = y0 + CH + 1;
  if (m.name === 'home') { drawHomeGround(m, g, x0, y0, x1, y1); return c; }
  g.fillStyle = PAL[G.GRASS][0];
  g.fillRect(cx * px, cy * px, px, px);
  for (const L of LAYERS) {
    if (L === G.SHALLOW) { // 波うちぎわの白い泡
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const t = m.get(x, y); if (WATER(t)) tileShape(g, m, x, y, G.SHALLOW, 3); }
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let t = m.get(x, y);
      if (t === -1) continue;
      if (L === G.SHALLOW && t === G.DEEP) t = G.SHALLOW;
      if (L === G.SAND && (WATER(t) || t === G.BRIDGE)) t = G.SAND; // 水の下も砂
      if (t !== L) continue;
      const pal = PAL[L];
      g.fillStyle = hash2(x, y, 1) < 0.5 ? pal[0] : pal[1];
      if (L === G.GRASS) g.fillRect(x * T, y * T, T, T);
      else if (L === G.BRIDGE) g.fillRect(x * T, y * T - 1, T, T + 2);
      else tileShape(g, m, x, y, L, 0);
    }
    if (L === G.DEEP) { // 深いところに少し暗いゆらぎ
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.get(x, y) === G.DEEP && hash2(x, y, 31) < 0.3) { g.fillStyle = 'rgba(30,90,160,0.18)'; blob(g, x + 0.2, y + 0.1, 0.4); }
    }
  }
  // 大きめの色むら（草地）
  for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {
    const t = m.get(x, y);
    if (t !== G.GRASS && t !== G.FLOWER && t !== G.TALL) continue;
    const n = noise2(x * 0.18, y * 0.18, 40);
    if (n > 0.6) { g.fillStyle = `rgba(120,190,90,${(n - 0.6) * 0.5})`; g.fillRect(x * T, y * T, T, T); }
    else if (n < 0.35) { g.fillStyle = `rgba(200,240,150,${(0.35 - n) * 0.45})`; g.fillRect(x * T, y * T, T, T); }
  }
  // こまかい模様
  for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {
    const t = m.get(x, y), X = x * T, Y = y * T, r = hash2(x, y, 9);
    if (t === G.GRASS || t === G.FLOWER || t === G.TALL) {
      g.strokeStyle = t === G.TALL ? '#5ea446' : '#7dbb5c'; g.lineWidth = 1.4; g.lineCap = 'round';
      const n = t === G.TALL ? 7 : 2;
      for (let i = 0; i < n; i++) {
        const bx = X + hash2(x, y, 20 + i) * T, by = Y + 4 + hash2(x, y, 40 + i) * (T - 4);
        const hgt = t === G.TALL ? 9 : 4;
        g.beginPath(); g.moveTo(bx - 2, by); g.quadraticCurveTo(bx - 2, by - hgt * 0.6, bx - 3, by - hgt); g.moveTo(bx + 1, by); g.quadraticCurveTo(bx + 1, by - hgt * 0.7, bx + 3, by - hgt * 0.9); g.stroke();
      }
      if (t === G.FLOWER || (t === G.GRASS && r > 0.93)) {
        const cols = ['#ff8fb1', '#fff3a6', '#ffffff', '#c9a6ff', '#ffb36b'];
        const k = t === G.FLOWER ? 3 : 1;
        for (let i = 0; i < k; i++) flower(g, X + 5 + hash2(x, y, 60 + i) * (T - 10), Y + 6 + hash2(x, y, 70 + i) * (T - 12), cols[Math.floor(hash2(x, y, 80 + i) * cols.length)]);
      }
    } else if (t === G.PATH && r > 0.6) {
      g.fillStyle = '#d6c08c'; g.beginPath(); g.ellipse(X + r * T, Y + hash2(x, y, 5) * T, 2.2, 1.6, 0, 0, 7); g.fill();
    } else if (t === G.SAND && r > 0.7) {
      g.fillStyle = '#e5cf8e'; g.beginPath(); g.arc(X + hash2(x, y, 3) * T, Y + r * T, 1.3, 0, 7); g.fill();
    } else if (t === G.PLAZA) {
      g.strokeStyle = 'rgba(160,140,110,0.35)'; g.lineWidth = 1; g.strokeRect(X + 1, Y + 1, T - 2, T - 2);
    } else if (t === G.DARK && r > 0.75) {
      g.fillStyle = '#76718f'; g.beginPath(); g.ellipse(X + r * T, Y + hash2(x, y, 5) * T, 3, 2, 0, 0, 7); g.fill();
    } else if (t === G.ROCKY && r > 0.6) {
      g.fillStyle = '#c29c74'; g.beginPath(); g.ellipse(X + r * T, Y + hash2(x, y, 5) * T, 3, 2, 0, 0, 7); g.fill();
    } else if (t === G.BRIDGE) {
      g.strokeStyle = '#8a5f3a'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(X, Y + i * 8 + 4); g.lineTo(X + T, Y + i * 8 + 4); } g.stroke();
    }
  }
  return c;
}
// 同じ種類どうしはつなげ、外がわの角だけ丸める（オートタイル風）
function sameLayer(L, t) { return t === L || (L === G.SAND && (WATER(t) || t === G.BRIDGE || t === G.LAVA)) || (L === G.SHALLOW && t === G.DEEP) || (L === G.PATH && t === G.PLAZA) || t === -1 && L !== G.PATH; }
function tileShape(g, m, x, y, L, grow) {
  const S = (dx, dy) => sameLayer(L, m.get(x + dx, y + dy));
  const u = S(0, -1), d = S(0, 1), l = S(-1, 0), r = S(1, 0);
  const R = T * 0.5;
  const rad = [!u && !l ? R : 0, !u && !r ? R : 0, !d && !r ? R : 0, !d && !l ? R : 0];
  const e = grow;
  g.beginPath();
  g.roundRect(x * T - (l ? 0.5 : e), y * T - (u ? 0.5 : e), T + (l ? 0.5 : e) + (r ? 0.5 : e), T + (u ? 0.5 : e) + (d ? 0.5 : e), rad);
  g.fill();
}
function blob(g, x, y, r) {
  const cx = (x + 0.5) * T, cy = (y + 0.5) * T;
  g.beginPath();
  g.roundRect((x + 0.5 - r) * T, (y + 0.5 - r) * T, 2 * r * T, 2 * r * T, r * T * 0.85);
  g.fill();
}
function flower(g, x, y, c) {
  g.fillStyle = c;
  for (let i = 0; i < 5; i++) { const a = i * 1.2566; g.beginPath(); g.arc(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.9, 0, 7); g.fill(); }
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill();
}
function drawHomeGround(m, g, x0, y0, x1, y1) {
  g.fillStyle = '#5b4a5e'; g.fillRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
  for (let y = Math.max(0, y0); y <= Math.min(m.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(m.w - 1, x1); x++) {
    const t = m.get(x, y), X = x * T, Y = y * T;
    if (t === G.WALL) {
      if (y < 2) { g.fillStyle = y === 0 ? '#f7dfe0' : '#f3d3d6'; g.fillRect(X, Y, T, T); g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(X + 8 + i * 16, Y + (y === 0 ? 10 : 20), 2, 0, 7); g.fill(); } if (y === 1) { g.fillStyle = '#d9a3a8'; g.fillRect(X, Y + T - 6, T, 6); } }
      else { g.fillStyle = '#c79d72'; g.fillRect(X, Y, T, T); g.fillStyle = '#b38b62'; g.fillRect(X, Y, T, 5); }
    } else {
      g.fillStyle = (x + y) % 2 ? '#ecca99' : '#e6c38f'; g.fillRect(X, Y, T, T);
      g.strokeStyle = 'rgba(160,110,60,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X, Y + 0.5); g.lineTo(X + T, Y + 0.5); g.moveTo(X + (y % 2 ? 10 : 22), Y); g.lineTo(X + (y % 2 ? 10 : 22), Y + T); g.stroke();
      if (x === m.door[0] && y === m.door[1]) { g.fillStyle = '#9b6b4a'; g.beginPath(); g.roundRect(X + 3, Y + 4, T - 6, T - 8, 6); g.fill(); g.fillStyle = '#b8845e'; g.beginPath(); g.roundRect(X + 6, Y + 7, T - 12, T - 14, 4); g.fill(); }
    }
  }
  // ラグ
  g.fillStyle = '#9fd2ec'; g.beginPath(); g.ellipse(6.5 * T, 6 * T, 2.7 * T, 1.9 * T, 0, 0, 7); g.fill();
  g.fillStyle = '#c6e8f6'; g.beginPath(); g.ellipse(6.5 * T, 6 * T, 2.2 * T, 1.45 * T, 0, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([5, 5]); g.beginPath(); g.ellipse(6.5 * T, 6 * T, 2.45 * T, 1.68 * T, 0, 0, 7); g.stroke(); g.setLineDash([]);
}

// ───────── 立っている物の絵（1回描いてためる） ─────────
const SPR = new Map();
function sprite(key, w, h, scale, draw) {
  const k = key + '@' + scale.toFixed(2);
  let c = SPR.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
    const g = c.getContext('2d'); g.scale(scale, scale); g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g, w, h);
    SPR.set(k, c);
  }
  return c;
}
const OLC = '#4a3a45';
function ol(g, w = 2) { g.strokeStyle = OLC; g.lineWidth = w; g.stroke(); }
function el(g, x, y, rx, ry, fill, stroke = true) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fillStyle = fill; g.fill(); if (stroke) ol(g); }

const OBJ_ART = {
  tree: { w: 56, h: 72, draw(g, v) {
    const greens = [['#5fb35a', '#7fcf6a', '#4b9a4b'], ['#6cbd5b', '#8ed773', '#52a24e'], ['#56a85a', '#79c76c', '#428e48']][v % 3];
    g.fillStyle = '#9b6a44'; g.beginPath(); g.roundRect(23, 46, 10, 20, 3); g.fill(); ol(g);
    g.beginPath(); g.arc(28, 30, 22, 0, 7); g.arc(15, 38, 13, 0, 7); g.arc(41, 38, 13, 0, 7); g.fillStyle = greens[0]; g.fill(); ol(g);
    g.beginPath(); g.arc(28, 30, 22, 0, 7); g.arc(15, 38, 13, 0, 7); g.arc(41, 38, 13, 0, 7); g.fill();
    el(g, 22, 22, 9, 6, greens[1], false); el(g, 36, 30, 5, 3.5, greens[1], false);
    el(g, 30, 44, 12, 4, greens[2], false);
  } },
  pine: { w: 52, h: 76, draw(g) {
    g.fillStyle = '#8e5f3c'; g.beginPath(); g.roundRect(22, 56, 8, 14, 3); g.fill(); ol(g);
    const tri = (y, w2, c) => { g.beginPath(); g.moveTo(26, y); g.quadraticCurveTo(26 + w2 * 0.6, y + 12, 26 + w2, y + 22); g.quadraticCurveTo(26, y + 26, 26 - w2, y + 22); g.quadraticCurveTo(26 - w2 * 0.6, y + 12, 26, y); g.fillStyle = c; g.fill(); ol(g); };
    tri(28, 22, '#3f9a68'); tri(16, 17, '#47a872'); tri(4, 12, '#52b57c');
    el(g, 22, 18, 3, 6, '#7fd09c', false);
  } },
  palm: { w: 60, h: 78, draw(g) {
    g.beginPath(); g.moveTo(28, 70); g.quadraticCurveTo(24, 46, 32, 24); g.lineTo(37, 25); g.quadraticCurveTo(30, 46, 34, 70); g.closePath(); g.fillStyle = '#c49460'; g.fill(); ol(g);
    for (const [a, l] of [[-2.7, 24], [-0.4, 24], [-1.9, 20], [-1.1, 22], [2.6, 18], [0.5, 18]]) {
      g.beginPath(); g.moveTo(34, 24); g.quadraticCurveTo(34 + Math.cos(a) * l * 0.6, 24 + Math.sin(a) * l * 0.6 - 8, 34 + Math.cos(a) * l, 24 + Math.sin(a) * l + 6);
      g.quadraticCurveTo(34 + Math.cos(a) * l * 0.5, 24 + Math.sin(a) * l * 0.5, 34, 26); g.fillStyle = '#5cbf6a'; g.fill(); ol(g, 1.6);
    }
    el(g, 31, 28, 3.5, 3.5, '#8b5a33'); el(g, 37, 29, 3.5, 3.5, '#8b5a33');
  } },
  deadtree: { w: 52, h: 70, draw(g) {
    g.beginPath(); g.moveTo(22, 66); g.lineTo(24, 36); g.lineTo(12, 22); g.lineTo(16, 20); g.lineTo(26, 30); g.lineTo(28, 12); g.lineTo(32, 12); g.lineTo(31, 30); g.lineTo(40, 20); g.lineTo(43, 23); g.lineTo(32, 38); g.lineTo(31, 66); g.closePath();
    g.fillStyle = '#6e5c6e'; g.fill(); ol(g);
  } },
  stump: { w: 36, h: 34, draw(g) { g.fillStyle = '#9b6a44'; g.beginPath(); g.roundRect(8, 12, 20, 16, 4); g.fill(); ol(g); el(g, 18, 13, 10, 4, '#e2b98a'); g.beginPath(); g.ellipse(18, 13, 5, 2, 0, 0, 7); g.strokeStyle = '#b88a5e'; g.lineWidth = 1; g.stroke(); } },
  rock: { w: 40, h: 36, draw(g) { g.beginPath(); g.moveTo(5, 30); g.quadraticCurveTo(4, 12, 18, 9); g.quadraticCurveTo(34, 8, 36, 30); g.closePath(); g.fillStyle = '#b6aeb8'; g.fill(); ol(g); el(g, 16, 16, 6, 3, '#d9d3dc', false); } },
  cliff: { w: 40, h: 46, draw(g, v) { g.beginPath(); g.moveTo(1, 40); g.lineTo(3, 14 + v % 3 * 2); g.lineTo(14, 4 + v % 2 * 3); g.lineTo(28, 6); g.lineTo(38, 16); g.lineTo(39, 40); g.closePath(); g.fillStyle = '#a99487'; g.fill(); ol(g); g.fillStyle = '#c7b4a6'; g.beginPath(); g.moveTo(6, 16); g.lineTo(14, 8); g.lineTo(24, 10); g.lineTo(14, 18); g.fill(); g.strokeStyle = 'rgba(80,60,60,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(10, 26); g.lineTo(20, 30); g.moveTo(24, 22); g.lineTo(32, 30); g.stroke(); } },
  grave: { w: 34, h: 40, draw(g) { g.beginPath(); g.moveTo(7, 34); g.lineTo(7, 16); g.quadraticCurveTo(17, 2, 27, 16); g.lineTo(27, 34); g.closePath(); g.fillStyle = '#a6a2b8'; g.fill(); ol(g); g.strokeStyle = '#7d7893'; g.lineWidth = 2; g.beginPath(); g.moveTo(17, 14); g.lineTo(17, 26); g.moveTo(12, 18); g.lineTo(22, 18); g.stroke(); } },
  sign: { w: 36, h: 40, draw(g) { g.fillStyle = '#9b6a44'; g.fillRect(16, 20, 5, 16); g.strokeStyle = OLC; g.lineWidth = 2; g.strokeRect(16, 20, 5, 16); g.beginPath(); g.roundRect(4, 6, 28, 18, 3); g.fillStyle = '#d9a46a'; g.fill(); ol(g); g.strokeStyle = '#a8764a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(9, 12); g.lineTo(27, 12); g.moveTo(9, 17); g.lineTo(23, 17); g.stroke(); } },
  lamp: { w: 26, h: 64, draw(g) { g.fillStyle = '#4f5a6e'; g.fillRect(11, 16, 4, 44); g.beginPath(); g.roundRect(6, 56, 14, 6, 2); g.fill(); g.beginPath(); g.roundRect(5, 6, 16, 14, 4); g.fillStyle = '#fff6c8'; g.fill(); ol(g); g.beginPath(); g.moveTo(3, 7); g.lineTo(13, 1); g.lineTo(23, 7); g.closePath(); g.fillStyle = '#4f5a6e'; g.fill(); } },
  fence: { w: 32, h: 30, draw(g) { g.fillStyle = '#fff7ea'; g.strokeStyle = OLC; g.lineWidth = 1.6; for (const x of [4, 22]) { g.beginPath(); g.roundRect(x, 6, 6, 20, 2); g.fill(); g.stroke(); } g.beginPath(); g.roundRect(0, 11, 32, 4, 1); g.fill(); g.stroke(); g.beginPath(); g.roundRect(0, 19, 32, 4, 1); g.fill(); g.stroke(); } },
  flowerpot: { w: 32, h: 34, draw(g) { g.beginPath(); g.moveTo(8, 18); g.lineTo(24, 18); g.lineTo(21, 30); g.lineTo(11, 30); g.closePath(); g.fillStyle = '#d9825a'; g.fill(); ol(g); for (const [x, y, c] of [[11, 12, '#ff8fb1'], [21, 11, '#fff3a6'], [16, 7, '#c9a6ff']]) { el(g, x, y, 5, 5, c); el(g, x, y, 1.8, 1.8, '#ffd34d', false); } } },
  shell: { w: 24, h: 20, draw(g) { g.beginPath(); g.moveTo(5, 16); g.quadraticCurveTo(12, 0, 19, 16); g.closePath(); g.fillStyle = '#ffd6e0'; g.fill(); ol(g, 1.4); g.strokeStyle = '#e8a3b5'; g.lineWidth = 1; g.beginPath(); g.moveTo(12, 15); g.lineTo(12, 6); g.moveTo(9, 15); g.lineTo(8, 9); g.moveTo(15, 15); g.lineTo(16, 9); g.stroke(); } },
  fountain: { w: 72, h: 76, draw(g) {
    el(g, 36, 56, 32, 14, '#c9c2d6'); el(g, 36, 54, 27, 10, '#8fdcf0', false);
    g.fillStyle = '#c9c2d6'; g.beginPath(); g.roundRect(31, 26, 10, 28, 3); g.fill(); ol(g);
    el(g, 36, 28, 14, 5, '#c9c2d6'); el(g, 36, 27, 11, 3.2, '#8fdcf0', false);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(36, 8); g.quadraticCurveTo(26, 14, 24, 26); g.lineTo(27, 26); g.quadraticCurveTo(30, 16, 36, 12); g.quadraticCurveTo(42, 16, 45, 26); g.lineTo(48, 26); g.quadraticCurveTo(46, 14, 36, 8); g.fill();
  } },
  // 家の中
  tub: { w: 70, h: 70, draw(g) {
    el(g, 35, 42, 31, 22, '#fbe9f0'); el(g, 35, 40, 25, 16, '#8fdcf0', false);
    el(g, 28, 36, 8, 3, '#c7f0fa', false);
    g.fillStyle = '#fff'; for (const [x, y] of [[48, 30], [52, 36], [20, 48]]) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
    g.fillStyle = '#ffd34d'; g.beginPath(); g.ellipse(44, 46, 5, 4, 0, 0, 7); g.fill(); ol(g, 1.4); g.beginPath(); g.arc(47, 41, 3, 0, 7); g.fill(); ol(g, 1.4); g.fillStyle = '#ff8a3d'; g.fillRect(49, 40.5, 3, 1.6);
  } },
  bowl: { w: 36, h: 30, draw(g) { el(g, 18, 20, 14, 7, '#ff9fb6'); el(g, 18, 17, 11, 4, '#ffe3ea', false); for (const [x, c] of [[13, '#4f86e0'], [19, '#f08cb0'], [24, '#f2c63a']]) el(g, x, 15, 3, 3, c, false); } },
  toybox: { w: 38, h: 40, draw(g) { g.beginPath(); g.roundRect(5, 14, 28, 22, 4); g.fillStyle = '#ffcf6b'; g.fill(); ol(g); g.beginPath(); g.roundRect(3, 10, 32, 8, 3); g.fillStyle = '#ff9f6b'; g.fill(); ol(g); el(g, 13, 8, 6, 6, '#ff6b8a'); el(g, 26, 9, 5, 5, '#6bc6ff'); g.fillStyle = '#fff'; g.beginPath(); g.arc(19, 26, 3, 0, 7); g.fill(); } },
  plant: { w: 36, h: 48, draw(g) { for (const a of [-0.9, -0.3, 0.3, 0.9, 0]) { g.beginPath(); g.ellipse(18 + Math.sin(a) * 9, 20 - Math.cos(a) * 6, 5, 11, a, 0, 7); g.fillStyle = '#5fb35a'; g.fill(); ol(g, 1.6); } g.beginPath(); g.moveTo(8, 30); g.lineTo(28, 30); g.lineTo(25, 44); g.lineTo(11, 44); g.closePath(); g.fillStyle = '#e8eef6'; g.fill(); ol(g); } },
  shelf: { w: 34, h: 60, draw(g) { g.beginPath(); g.roundRect(3, 8, 28, 48, 3); g.fillStyle = '#c99566'; g.fill(); ol(g); g.fillStyle = '#a77a50'; g.fillRect(5, 24, 24, 3); g.fillRect(5, 40, 24, 3); for (const [x, y, c] of [[9, 16, '#ff8fb1'], [16, 15, '#6bc6ff'], [23, 17, '#ffd34d'], [10, 33, '#9fe08a'], [20, 32, '#c9a6ff']]) el(g, x, y, 3.5, 5, c, true); } },
  cushion: { w: 36, h: 30, draw(g) { el(g, 18, 18, 15, 9, '#ffb6c9'); el(g, 18, 16, 10, 5, '#ffd3df', false); } },
  bush: { w: 40, h: 38, draw(g, v, ripe, berry) {
    g.beginPath(); g.arc(20, 22, 13, 0, 7); g.arc(10, 26, 9, 0, 7); g.arc(30, 26, 9, 0, 7); g.fillStyle = '#4fa456'; g.fill(); ol(g);
    g.beginPath(); g.arc(20, 22, 13, 0, 7); g.arc(10, 26, 9, 0, 7); g.arc(30, 26, 9, 0, 7); g.fill();
    el(g, 16, 16, 6, 3.5, '#72c46c', false);
    if (ripe) { const b = BERRIES[berry]; for (const [x, y] of [[12, 22], [22, 15], [28, 25], [19, 28]]) { el(g, x, y, 4, 4, b.color); el(g, x - 1.2, y - 1.4, 1.3, 1.1, '#fff', false); } }
  } },
};

// 建物の絵
function drawBuilding(g, b, night) {
  const X = b.x * T, Y = b.y * T, Wd = b.w * T, Hd = b.h * T;
  const wallTop = Y + Hd * 0.42, base = Y + Hd;
  const k = b.kind;
  const wallC = k === 'mansion' ? '#b9b2c9' : '#fff4e2';
  const roofC = k === 'home' ? '#ff8a7a' : k === 'shop' ? '#7fcf8a' : k === 'mansion' ? '#6e5d8e' : b.color;
  // かべ
  g.beginPath(); g.roundRect(X + 4, wallTop, Wd - 8, base - wallTop - 2, 4); g.fillStyle = wallC; g.fill(); ol(g, 2.4);
  // 屋根
  g.beginPath(); g.moveTo(X - 6, wallTop + 10); g.lineTo(X + 14, Y - 6); g.lineTo(X + Wd - 14, Y - 6); g.lineTo(X + Wd + 6, wallTop + 10); g.closePath(); g.fillStyle = roofC; g.fill(); ol(g, 2.4);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.beginPath(); for (let i = 1; i < 4; i++) { const yy = Y - 6 + i * (wallTop + 16 - Y) / 4; g.moveTo(X - 6 + 20 * (1 - i / 4) + 4, yy); g.lineTo(X + Wd + 6 - 20 * (1 - i / 4) - 4, yy); } g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(X + 16, Y - 3); g.lineTo(X + Wd * 0.45, Y - 3); g.lineTo(X + Wd * 0.4, Y + 6); g.lineTo(X + 10, Y + 6); g.fill();
  // えんとつ
  if (k === 'home') { g.beginPath(); g.roundRect(X + Wd - 40, Y - 20, 14, 22, 2); g.fillStyle = '#c97a6a'; g.fill(); ol(g); }
  if (k === 'mansion') { for (const tx of [X + 10, X + Wd - 34]) { g.beginPath(); g.moveTo(tx, wallTop); g.lineTo(tx, Y - 4); g.lineTo(tx + 12, Y - 28); g.lineTo(tx + 24, Y - 4); g.lineTo(tx + 24, wallTop); g.fillStyle = '#5a4b78'; g.fill(); ol(g); } }
  // まど
  const winC = night ? '#ffe9a0' : '#bfe7ff';
  const wins = b.w >= 8 ? [0.18, 0.36, 0.64, 0.82] : [0.22, 0.78];
  for (const f of wins) {
    const wx = X + Wd * f - 10, wy = wallTop + 12;
    g.beginPath(); if (k === 'home') g.arc(wx + 10, wy + 10, 10, 0, 7); else g.roundRect(wx, wy, 20, 18, k === 'mansion' ? [10, 10, 0, 0] : 3);
    g.fillStyle = k === 'mansion' && !night ? '#4b4360' : winC; g.fill(); ol(g, 2);
    g.strokeStyle = OLC; g.lineWidth = 1.4; g.beginPath(); g.moveTo(wx + 10, wy + 1); g.lineTo(wx + 10, wy + 19); g.moveTo(wx + 1, wy + 10); g.lineTo(wx + 19, wy + 10); g.stroke();
  }
  // ドア
  if (b.door) {
    const dx = b.door[0] * T, dy = b.door[1] * T;
    g.beginPath(); g.roundRect(dx + 5, dy - 6, T - 10, T + 4, [10, 10, 2, 2]); g.fillStyle = k === 'mansion' ? '#4a3a5a' : '#b0784e'; g.fill(); ol(g, 2);
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(dx + T - 11, dy + 10, 2, 0, 7); g.fill();
  }
  // かんばん
  if (k === 'shop') {
    g.fillStyle = '#ff9fb6'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(X + 8 + i * (Wd - 16) / 6, wallTop); g.lineTo(X + 8 + (i + 1) * (Wd - 16) / 6, wallTop); g.lineTo(X + 8 + (i + 0.5) * (Wd - 16) / 6, wallTop + 9); g.closePath(); g.fillStyle = i % 2 ? '#fff' : '#ff8fb1'; g.fill(); }
    g.beginPath(); g.roundRect(X + Wd / 2 - 30, Y + 8, 60, 20, 6); g.fillStyle = '#fff8e8'; g.fill(); ol(g, 1.8);
    g.fillStyle = '#c0485a'; g.font = 'bold 12px "M PLUS Rounded 1c", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('きのみや', X + Wd / 2, Y + 18.5);
  }
  if (k === 'home') { // カイリュー色のポスト
    const px = X + Wd - 2, py = base - 22;
    g.fillStyle = '#4f5a6e'; g.fillRect(px + 4, py + 8, 3, 14); g.beginPath(); g.roundRect(px - 2, py - 4, 14, 12, [6, 6, 2, 2]); g.fillStyle = '#eba24c'; g.fill(); ol(g, 1.6);
  }
}

// 家の中の窓
function drawHomeWindows(g, m, night) {
  for (const [wx, wy] of m.windows) {
    const X = wx * T - 22, Y = wy * T + 4;
    g.beginPath(); g.roundRect(X, Y, 44, 34, 6); g.fillStyle = night ? '#2c3a6e' : '#a8e1ff'; g.fill(); ol(g, 2.4);
    if (night) { g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(X + 32, Y + 10, 5, 0, 7); g.fill(); }
    else { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(X + 14, Y + 12, 8, 4, 0, 0, 7); g.fill(); }
    g.strokeStyle = OLC; g.lineWidth = 1.6; g.beginPath(); g.moveTo(X + 22, Y); g.lineTo(X + 22, Y + 34); g.stroke();
    g.fillStyle = '#ffb6c9'; g.beginPath(); g.moveTo(X - 6, Y - 2); g.quadraticCurveTo(X + 4, Y + 18, X - 2, Y + 36); g.lineTo(X - 8, Y + 36); g.closePath(); g.fill(); ol(g, 1.4);
    g.beginPath(); g.moveTo(X + 50, Y - 2); g.quadraticCurveTo(X + 40, Y + 18, X + 46, Y + 36); g.lineTo(X + 52, Y + 36); g.closePath(); g.fill(); ol(g, 1.4);
  }
}
