// ちびリューのまち（3D版）：本体（時間・セーブ・歩く・家と街・ごはん・たからもの）
import * as THREE from 'three';
import { createKairyu, softMat, addOutline } from './kairyu3d.js';
import { buildWorld3D, buildHome3D } from './world3d.js';
(() => {
  const Q = new URLSearchParams(location.search);
  const TEST = Q.has('test');
  const SAVE_KEY = TEST ? 'ryu-test' : 'ryu-v1';
  const $ = (id) => document.getElementById(id);
  const cv = $('c'), fx = $('fx'), ctx = fx.getContext('2d');

  // ───────── セーブ ─────────
  const fresh = () => ({
    v: 1, name: '', stage: 'egg', eggTaps: 0, growth: 0, time: 7 * 60,
    food: 70, energy: 90, love: 30, bag: { oren: 3, momon: 1 }, shells: 0, shellTaken: {},
    bush: {}, found: {}, places: {}, shopDay: -1, where: 'home', px: 6, py: 6, speed: 0, sound: true, lastReal: Date.now(),
  });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || {}); } catch (e) { S = fresh(); }
  function save() { S.lastReal = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
  // 閉じていたあいだの時間（最大1日ぶん、メーターは下がりすぎない）
  {
    const away = Math.min(1440, Math.max(0, (Date.now() - (S.lastReal || Date.now())) / 1000 * SPEEDS[0].rate));
    if (away > 1 && S.stage !== 'egg') {
      S.time += away; S.growth += away * 0.6;
      S.food = Math.max(15, S.food - away * 0.045); S.energy = Math.min(100, S.energy + away * 0.03); S.love = Math.max(10, S.love - away * 0.003);
    }
  }

  // ───────── マップと主人公 ─────────
  const MAPS = { town: buildTown(), home: buildHome() };
  let M = MAPS[S.where] || MAPS.home;
  const P = { x: S.px, y: S.py, fx: S.px, fy: S.py, tx: S.px, ty: S.py, prog: 1, face: 1, dir: [0, 1], path: [], pending: null, walkT: 0, expr: 'n', exprT: 0, blinkT: 2, hop: 0, say: null, fly: 0 };
  if (!passable(M, Math.round(P.x), Math.round(P.y), true)) { P.x = P.fx = P.tx = 6; P.y = P.fy = P.ty = 6; M = MAPS.home; S.where = 'home'; }

  const stageIdx = () => STAGES.findIndex(s => s.id === S.stage);
  const canFly = () => S.stage === 'adult';
  const hour = () => (S.time / 60) % 24;
  const day = () => Math.floor(S.time / 1440) + 1;
  const isNight = () => { const h = hour(); return h >= 19 || h < 5; };
  function darkness() {
    const h = hour();
    if (h >= 7 && h < 17) return 0;
    if (h >= 17 && h < 19.5) return (h - 17) / 2.5;
    if (h >= 19.5 || h < 4.5) return 1;
    return 1 - (h - 4.5) / 2.5;
  }

  // ───────── 3D の準備 ─────────
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: TEST });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 500);
  const hemi = new THREE.HemisphereLight('#fffaf0', '#a8c890', 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3dc', 2.0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const lampLights = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight('#ffc970', 0, 7, 1.4); scene.add(l); return l; });
  const playerLight = new THREE.PointLight('#ffe2b0', 0, 5, 1.4); scene.add(playerLight);

  let VW = 0, VH = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    VW = innerWidth; VH = innerHeight;
    renderer.setPixelRatio(DPR); renderer.setSize(VW, VH, false);
    fx.width = Math.round(VW * DPR); fx.height = Math.round(VH * DPR);
    camera.aspect = VW / VH; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ───────── 入力 ─────────
  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); P.path = []; P.pending = null; e.preventDefault(); }
    if (k === ' ' || k === 'enter' || k === 'z') { if (talkOpen) { const b = $('tBtns').querySelector('button'); if (b) b.click(); } else doAct(); e.preventDefault(); }
    if (k === 'escape') { closeTalk(); closeModal(); }
    unlockAudio();
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  function keyDir() {
    if (keys.has('arrowup') || keys.has('w')) return [0, -1];
    if (keys.has('arrowdown') || keys.has('s')) return [0, 1];
    if (keys.has('arrowleft') || keys.has('a')) return [-1, 0];
    if (keys.has('arrowright') || keys.has('d')) return [1, 0];
    return null;
  }
  let audioOk = false;
  function unlockAudio() { if (audioOk) return; audioOk = true; SND.resume(); SND.setOn(S.sound); }

  // 画面 → 地面（タイル）
  const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmpV = new THREE.Vector3();
  function toGround(sx, sy) {
    ray.setFromCamera({ x: sx / VW * 2 - 1, y: -(sy / VH) * 2 + 1 }, camera);
    return ray.ray.intersectPlane(groundPlane, tmpV) ? { x: tmpV.x, z: tmpV.z } : null;
  }
  function toScreen(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x + 1) / 2 * VW, y: (1 - tmpV.y) / 2 * VH, ok: tmpV.z < 1 }; }

  cv.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (talkOpen || modalOpen || busy) return;
    // 自分をタップ → なでる
    const sc = stageScale(), base = toScreen(K.root.position.x, Math.max(0, K.root.position.y), K.root.position.z), top = toScreen(K.root.position.x, K.root.position.y + sc * 1.05, K.root.position.z);
    const hgt = Math.abs(base.y - top.y);
    if (Math.abs(e.clientX - base.x) < hgt * 0.42 && e.clientY < base.y + 8 && e.clientY > top.y - 6) { if (S.stage === 'egg') warmEgg(); else pet(); return; }
    if (S.stage === 'egg') { toast('たまごを タップして あたためよう'); return; }
    const w = toGround(e.clientX, e.clientY); if (!w) return;
    const tx = Math.floor(w.x), ty = Math.floor(w.z);
    const it = interactAt(tx, ty);
    if (it && it.walkOn) { goTo(tx, ty); ping(w.x, w.z); return; }
    if (it) { goNear(tx, ty, it); return; }
    goTo(tx, ty);
    ping(w.x, w.z);
  });

  // ───────── 道さがし（BFS） ─────────
  function bfs(sx, sy, goal, maxN = 6000) {
    const W = M.w, prev = new Int32Array(M.w * M.h).fill(-1), q = [sx + sy * W];
    prev[q[0]] = q[0];
    let n = 0;
    while (q.length && n++ < maxN) {
      const cur = q.shift(), cx = cur % W, cy = (cur / W) | 0;
      if (goal(cx, cy)) { const path = []; let c = cur; while (c !== prev[c]) { path.push([c % W, (c / W) | 0]); c = prev[c]; } return path.reverse(); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, k = nx + ny * W;
        if (nx < 0 || ny < 0 || nx >= W || ny >= M.h || prev[k] !== -1) continue;
        if (!passable(M, nx, ny, canFly())) continue;
        prev[k] = cur; q.push(k);
      }
    }
    return null;
  }
  function goTo(tx, ty) {
    if (!passable(M, tx, ty, canFly())) {
      if (M.get(tx, ty) === G.DEEP && !canFly()) toast('ふかい うみは まだ こわい… おとなに なったら とべるよ');
      return;
    }
    const p = bfs(Math.round(P.tx), Math.round(P.ty), (x, y) => x === tx && y === ty);
    if (p) { P.path = p; P.pending = null; }
  }
  function goNear(tx, ty, it) {
    const px = Math.round(P.tx), py = Math.round(P.ty);
    const adj = (x, y) => Math.abs(x - tx) + Math.abs(y - ty) === 1;
    if (adj(px, py) && P.prog >= 1) { faceTo(tx, ty); it.act(); return; }
    const p = bfs(px, py, adj);
    if (p) { P.path = p; P.pending = { tx, ty, it }; } else toast('そこには いけない みたい');
  }
  function faceTo(tx, ty) { const dx = tx - Math.round(P.x), dy = ty - Math.round(P.y); P.dir = [Math.sign(dx), Math.sign(dy)]; if (dx) P.face = Math.sign(dx); }

  // ───────── 調べられる物 ─────────
  function interactAt(x, y) {
    const o = M.o(x, y);
    if (M.name === 'home') {
      if (o && (o.t === 'tub' || o.t === 'tubPart')) return { label: '🛁 ねる', act: askSleep };
      if (o && o.t === 'bowl') return { label: '🍓 ごはん', act: openBag };
      if (o && o.t === 'toybox') return { label: '⚽ あそぶ', act: playBall };
      if (o && o.t === 'shelf') return { label: '🔍 しらべる', act: () => talkSimple('📚', 'ほんだな', 'ドラゴンの えほんが ならんでいる。\nおおきくなった カイリューは うみの うえを とんで ひとを たすけるんだって。') };
      if (o && o.t === 'plant') return { label: '🔍 しらべる', act: () => talkSimple('🪴', 'うえきばち', 'みずを もらって いきいき している。') };
      if (o && o.t === 'cushion') return { label: '🔍 しらべる', act: () => talkSimple('🛋️', 'クッション', 'ふかふか。ちびリューの おきにいり。') };
      return null;
    }
    if (o && o.t === 'bush') return { label: ripe(o) ? '🍓 とる' : '🔍 みる', act: () => pickBush(o) };
    if (o && o.t === 'sign') return { label: '📜 よむ', act: () => talkSimple('📜', 'かんばん', M.signs[y * M.w + x]) };
    if (o && (o.t === 'fountain' || o.t === 'fountainPart')) return { label: '⛲ のぞく', act: () => { SND.fx.splash(); talkSimple('⛲', 'ふんすい', 'みずが きらきら。\nちびリューが うつっている。'); } };
    if (o && o.t === 'grave') return { label: '🔍 しらべる', act: () => talkSimple('🪦', 'ふるい いし', isNight() ? 'ひんやり… どこかで あおい ひが ゆれた きがする。' : 'こけが はえた ふるい いし。') };
    const b = buildingAt(M, x, y);
    if (b && b.door && b.door[0] === x && b.door[1] === y) {
      if (b.kind === 'home') return { label: '🏠 はいる', walkOn: 1, act: () => goTo(x, y) };
      if (b.kind === 'shop') return { label: '🧺 はいる', act: shop };
      if (b.kind === 'mansion') return { label: '🚪 しらべる', act: () => talkSimple('🚪', 'おやしきの とびら', isNight() ? 'カタカタ… とびらの むこうで なにかが わらった きがする。\n…かぎが かかっている。' : 'かぎが かかっている。\nまどから ほこりっぽい へやが みえる。') };
      return { label: '🚪 ノック', act: () => talkSimple('🏡', 'よその いえ', isNight() ? 'あかりが ついている。みんな ゆうごはん みたい。' : 'るすの ようだ。') };
    }
    if (b) return null;
    const tr = treasureAt(x, y);
    if (tr) return { label: '✨ ひろう', walkOn: 1, act: () => goTo(x, y) };
    return null;
  }
  function treasureVisible(t) { return !S.found[t.id] && (!t.night || isNight()); }
  function treasureAt(x, y) { return M.name === 'town' && TREASURES.find(t => t.x === x && t.y === y && treasureVisible(t)); }
  function ripe(o) { const t = S.bush[o.key]; return t == null || S.time - t >= 1440 * 0.75; }

  // ───────── 行動 ─────────
  let busy = false;
  function setExpr(x, sec) { P.expr = x; P.exprT = sec; }
  function pet() {
    setExpr('h', 1.3); P.hop = 1; S.love = Math.min(100, S.love + 1.5);
    hearts(P.x, P.y, 2); SND.fx.heart();
    if (Math.random() < 0.35) { SND.fx.cry('kairyu'); say(['リュー♪', 'きゅう〜', 'えへへ', 'もっと〜'][Math.floor(Math.random() * 4)]); }
  }
  function warmEgg() {
    if (S.stage !== 'egg') return;
    S.eggTaps++; P.hop = 1; SND.fx.tap();
    burst(P.x, P.y - 0.6, '💛', 1);
    if (S.eggTaps === 3 || S.eggTaps === 6) { SND.fx.crack(); toast(S.eggTaps === 3 ? 'ピシッ… たまごが うごいた！' : 'パキパキ… もうすこし！'); }
    if (S.eggTaps >= 9) hatch();
  }
  function hatch() {
    S.stage = 'baby'; S.food = 70; S.energy = 90;
    SND.fx.crack(); setTimeout(() => SND.fx.fanfare(), 250);
    for (let i = 0; i < 14; i++) burst(P.x, P.y - 0.6, ['✨', '⭐', '💛'][i % 3], 1);
    setExpr('h', 3); P.hop = 1;
    setTimeout(() => { SND.fx.cry('kairyu'); say('リュー！'); }, 900);
    toast(`${S.name}が うまれた！ タップで なでて あげよう`, 4);
    updateHUD(); save();
  }
  function feed(id) {
    if (!S.bag[id]) return;
    if (S.food >= 97) { say('おなか いっぱい'); toast('おなか いっぱい みたい'); return; }
    S.bag[id]--; if (!S.bag[id]) delete S.bag[id];
    const b = BERRIES[id];
    S.food = Math.min(100, S.food + b.food);
    S.love = Math.min(100, S.love + (id === 'oren' ? 4 : 2));
    setExpr('o', 1.4); SND.fx.eat();
    burst(P.x, P.y - 0.9, '🍓', 0);
    setTimeout(() => { setExpr('h', 1.4); hearts(P.x, P.y, id === 'oren' ? 3 : 1); SND.fx.heart(); say(id === 'oren' ? 'だいすき！' : 'おいしい♪'); }, 1400);
    updateHUD();
  }
  let lastSing = -99;
  function sing() {
    if (S.stage === 'egg') { toast('たまごに うたを きかせた… なかで うごいた きがする'); warmEgg(); return; }
    const now = performance.now() / 1000;
    if (now - lastSing < 6) return;
    lastSing = now;
    setExpr('o', 5.5);
    const dur = SND.fx.song() || 5;
    for (let i = 0; i < 9; i++) setTimeout(() => burst(P.x + (Math.random() - 0.5) * 0.6, P.y - 1.2, ['🎵', '🎶'][i % 2], 2), i * 550);
    S.love = Math.min(100, S.love + 3);
    setTimeout(() => { setExpr('h', 1.2); }, dur * 1000);
    updateHUD();
  }
  function pickBush(o) {
    if (!ripe(o)) { talkSimple('🌿', 'きのみの しげみ', 'まだ みが なっていない。\nあしたに なったら また きてみよう。'); return; }
    const n = 1 + (hash2(day(), o.key.length + Number(o.key.split(',')[0]), 3) < 0.5 ? 1 : 0);
    S.bag[o.berry] = (S.bag[o.berry] || 0) + n;
    S.bush[o.key] = S.time;
    SND.fx.pop(); P.hop = 1; setExpr('h', 1);
    const [bx, by] = o.key.split(',').map(Number);
    burst(bx, by, '🫐', 0);
    toast(`${BERRIES[o.berry].name}を ${n}こ てにいれた！`);
    updateHUD(); save();
  }
  function findTreasure(t) {
    S.found[t.id] = S.time;
    SND.fx.fanfare(); setExpr('h', 2.5); P.hop = 1;
    for (let i = 0; i < 10; i++) burst(t.x, t.y, ['✨', t.icon][i % 2], 1);
    const n = Object.keys(S.found).length;
    talkSimple(t.icon, t.name, `${t.name}を みつけた！\n${t.desc}\n（たからもの ${n} / ${TREASURES.length}）`);
    if (n === TREASURES.length) setTimeout(() => { SND.fx.fanfare(); toast('たからものを ぜんぶ あつめた！ すごい！', 5); }, 2500);
    save();
  }
  function shop() {
    const d = day();
    if (S.shopDay === d) { talkSimple('👵', 'きのみやの おばあさん', 'きょうの おすそわけは もう わたしたよ。\nまた あした おいで。'); return; }
    S.shopDay = d;
    const got = { oren: 2 };
    for (let i = 0; i < 2; i++) { const id = BERRY_IDS[Math.floor(hash2(d, i, 21) * BERRY_IDS.length)]; got[id] = (got[id] || 0) + 1; }
    for (const [k, v] of Object.entries(got)) S.bag[k] = (S.bag[k] || 0) + v;
    SND.fx.pop();
    talkSimple('👵', 'きのみやの おばあさん', `あらあら、${S.name}ちゃん。きょうの おすそわけだよ。\n` + Object.entries(got).map(([k, v]) => `${BERRIES[k].name}×${v}`).join('、') + ' を もらった！');
    save();
  }
  function askSleep() {
    if (S.stage === 'egg') return;
    const night = hour() >= 18 || hour() < 6;
    talk({ icon: '🛁', name: 'みずの ベッド', text: night ? 'もう よるだね。ねむる？' : 'ちょっと おひるね する？', btns: [
      { t: '💤 ねる', main: 1, f: () => { closeTalk(); sleep(night); } }, { t: 'まだ おきてる', f: closeTalk }] });
  }
  function sleep(night) {
    busy = true; P.path = [];
    P.x = P.fx = P.tx = 3; P.y = P.fy = P.ty = 4; P.prog = 1; P.face = 1;
    setExpr('s', 99);
    const f = $('fade'); f.textContent = night ? '💤 おやすみなさい…' : '💤 すやすや…'; f.classList.add('on');
    SND.fx.sparkle();
    setTimeout(() => {
      let add = 3 * 60;
      if (night) { const h = hour(); add = ((24 - h + 7) % 24) * 60; if (add < 60) add += 1440; }
      S.time += add; S.growth += add * 0.5;
      S.food = Math.max(12, S.food - add * 0.02); S.energy = 100; S.love = Math.min(100, S.love + 3);
      checkGrow(true);
      f.textContent = night ? `☀️ ${day()}にちめの あさ！` : '☀️ すっきり！';
    }, 1500);
    setTimeout(() => { f.classList.remove('on'); busy = false; setExpr('h', 2); P.hop = 1; updateHUD(); save(); }, 3200);
  }
  // ボールあそび（家の中）
  let ball = null;
  function playBall() {
    if (S.energy < 10) { say('つかれた…'); toast('つかれている みたい。ねかせて あげよう'); return; }
    ball = { n: 3, x: P.x, y: P.y, fx: P.x, fy: P.y, tx: 0, ty: 0, t: 1, h: 0 };
    kickBall();
  }
  function kickBall() {
    const free = [];
    for (let y = 3; y < M.h - 1; y++) for (let x = 1; x < M.w - 1; x++) if (passable(M, x, y) && Math.hypot(x - P.x, y - P.y) > 2.5) free.push([x, y]);
    const [tx, ty] = free[Math.floor(Math.random() * free.length)];
    Object.assign(ball, { fx: ball.x, fy: ball.y, tx, ty, t: 0 });
    SND.fx.tap();
  }
  function updateBall(dt) {
    if (!ball) return;
    if (ball.t < 1) {
      ball.t = Math.min(1, ball.t + dt * 1.4);
      const e = ball.t;
      ball.x = ball.fx + (ball.tx - ball.fx) * e; ball.y = ball.fy + (ball.ty - ball.fy) * e;
      ball.h = Math.abs(Math.sin(e * Math.PI * 2)) * (1 - e) * 1.2;
      if (ball.t >= 1) { SND.fx.tap(); const p = bfs(Math.round(P.tx), Math.round(P.ty), (x, y) => x === ball.tx && y === ball.ty); if (p) P.path = p; }
    } else if (Math.hypot(P.x - ball.x, P.y - ball.y) < 0.6 && P.prog >= 1 && !P.path.length) {
      ball.n--; hearts(P.x, P.y, 1); SND.fx.heart(); setExpr('h', 0.8); P.hop = 1;
      S.energy = Math.max(0, S.energy - 2.5); S.love = Math.min(100, S.love + 3.5);
      if (ball.n > 0) kickBall(); else { ball = null; say('たのしかった！'); updateHUD(); }
    }
  }

  // ───────── はなしかけ ─────────
  let talkOpen = false;
  function talk({ icon, img, name, text, btns }) {
    talkOpen = true;
    const face = $('tFace');
    face.innerHTML = img ? `<img src="${img}" alt="">` : `<span style="font-size:52px">${icon || '💬'}</span>`;
    $('tName').textContent = name; $('tHearts').textContent = '';
    $('tText').textContent = text;
    const bb = $('tBtns'); bb.innerHTML = '';
    for (const b of btns) { const e = document.createElement('button'); e.className = 'tb' + (b.main ? ' main' : ''); e.textContent = b.t; e.onclick = () => { SND.fx.tap(); b.f(); }; bb.append(e); }
    $('talk').classList.add('show');
  }
  function talkSimple(icon, name, text) { talk({ icon, name, text, btns: [{ t: 'とじる', main: 1, f: closeTalk }] }); }
  function closeTalk() { talkOpen = false; $('talk').classList.remove('show'); }

  // ───────── モーダル（バッグ・てちょう・せってい・なまえ） ─────────
  let modalOpen = false;
  function modal(html) { modalOpen = true; $('mBody').innerHTML = html; $('modal').classList.add('show'); }
  function closeModal() { modalOpen = false; $('modal').classList.remove('show'); }
  $('modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });
  function openBag() {
    if (S.stage === 'egg') { toast('うまれたら ごはんを あげよう'); return; }
    const ids = BERRY_IDS.filter(id => S.bag[id]);
    modal(`<h2>🎒 バッグ <button onclick="RYU.closeModal()">✕</button></h2>
      ${ids.length ? '' : '<p>きのみが ない… まちの しげみや きのみやで もらおう。</p>'}
      ${ids.map(id => { const b = BERRIES[id]; return `<div class="berry"><div class="dot" style="background:${b.color}"></div><div class="info"><b>${b.name}</b> ×${S.bag[id]}<br>${b.desc}</div><button class="tb main" onclick="RYU.feed('${id}')">あげる</button></div>`; }).join('')}
      <div class="lbl">🐚 かいがら ${S.shells}こ　｜　🍓 おなか ${Math.round(S.food)} / 100</div>`);
  }
  function openNote() {
    const n = Object.keys(S.found).length;
    modal(`<h2>📖 たんけん てちょう <button onclick="RYU.closeModal()">✕</button></h2>
      <div class="lbl" style="margin-top:0">たからもの ${n} / ${TREASURES.length}</div>
      <div class="grid">${TREASURES.map(t => S.found[t.id]
        ? `<div class="cell"><div style="font-size:44px;line-height:64px">${t.icon}</div>${t.name}<div class="hint">${t.desc}</div></div>`
        : `<div class="cell unk"><div style="font-size:44px;line-height:64px;filter:grayscale(1) opacity(.35)">❔</div>？？？<div class="hint">${t.hint}${t.night ? '（よるだけ）' : ''}</div></div>`).join('')}</div>
      <div class="lbl">いった ばしょ ${PLACES.filter(p => S.places[p.id]).length} / ${PLACES.length}</div>
      <div class="row">${PLACES.map(p => `<span class="tb" style="box-shadow:none;${S.places[p.id] ? '' : 'opacity:.35'}">${S.places[p.id] ? p.name : '？？？'}</span>`).join('')}</div>
      <div class="lbl">${S.name}の きろく：${day()}にちめ・${STAGES[stageIdx()].name}・🐚 ${S.shells}こ</div>`);
  }
  function openSettings() {
    modal(`<h2>⚙ せってい <button onclick="RYU.closeModal()">✕</button></h2>
      <div class="lbl">じかんの はやさ</div>
      <div class="row">${SPEEDS.map((s, i) => `<button class="tb ${S.speed === i ? 'main' : ''}" onclick="RYU.setSpeed(${i})">${s.label}（1にち ${Math.round(1440 / s.rate / 60 * 10) / 10}ふん）</button>`).join('')}</div>
      <div class="lbl">なまえ</div>
      <div class="row"><button class="tb" onclick="RYU.rename()">✏️ なまえを かえる</button></div>
      <div class="lbl">そうさ：タップした ところへ あるく ／ PCは やじるしキー＋スペース</div>
      ${TEST ? `<div class="lbl">🛠 かいはつよう</div><div class="row">
        <button class="tb" onclick="RYU.dev('grow')">つぎの すがたへ</button><button class="tb" onclick="RYU.dev('night')">よるに する</button><button class="tb" onclick="RYU.dev('day')">ひるに する</button>
        <button class="tb" onclick="RYU.dev('full')">メーター まんたん</button><button class="tb" onclick="RYU.dev('berry')">きのみ ふやす</button></div>` : ''}
      <div class="lbl">さいしょから</div>
      <div class="row"><button class="tb" id="bReset" onclick="RYU.reset(this)">🥚 さいしょから やりなおす</button></div>`);
  }
  function askName(first) {
    modal(`<h2>${first ? '🥚 たまごを みつけた！' : '✏️ なまえ'}</h2>
      ${first ? '<p style="margin:0 0 10px;font-size:14px;line-height:1.6">いえの クッションの うえに、オレンジいろの もようの たまごが ある。<br>なかで ドラゴンの あかちゃんが ねむっている みたい。なまえを つけてあげよう。</p>' : ''}
      <input class="nm" id="nmIn" maxlength="8" value="${S.name || 'リュー'}">
      <div class="row" style="justify-content:center;margin-top:12px"><button class="tb main" style="font-size:16px;padding:9px 22px" onclick="RYU.setName()">けってい</button></div>`);
    setTimeout(() => { const i = $('nmIn'); i.focus(); i.select(); i.onkeydown = (e) => { if (e.key === 'Enter') window.RYU.setName(); }; }, 50);
  }

  // ───────── HUD ─────────
  function updateHUD() {
    $('hName').textContent = S.name || '？？？';
    $('hStage').textContent = STAGES[stageIdx()].name;
    const h = hour(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
    const icon = isNight() ? '🌙' : h < 7 ? '🌅' : h >= 17 ? '🌇' : '☀️';
    $('hTime').textContent = `${day()}にちめ ${hh}:${String(mm).padStart(2, '0')} ${icon}`;
    $('mFood').style.width = S.food + '%'; $('mEnergy').style.width = S.energy + '%'; $('mLove').style.width = S.love + '%';
    $('bSpeed').textContent = '⏩ ' + SPEEDS[S.speed].label;
    $('bSound').textContent = S.sound ? '🔊' : '🔇';
  }
  let toastT = 0;
  function toast(t, sec = 2.6) { const e = $('toast'); e.textContent = t; e.classList.add('show'); toastT = sec; }
  let zoneT = 0;
  function zoneBanner(t) { const e = $('zone'); e.textContent = t; e.classList.add('show'); zoneT = 2.4; }

  // ───────── 場所 ─────────
  function zoneAt(x, y) {
    if (M.name === 'home') return 'home';
    if (Math.hypot(x - 64, y - 60) < 5.2) return 'island';
    const g = M.get(x, y);
    if (x <= 27 && y < 8) return 'flower';
    if (x <= 27 && y < 44) return 'forest';
    if (WATER(g)) return 'sea';
    if (g === G.SAND || g === G.BRIDGE) return 'beach';
    if (x >= 58) return 'rocky';
    if (x >= 31 && x <= 56 && y <= 15) return 'spooky';
    return 'town';
  }
  let curZone = '';
  function checkZone() {
    const z = zoneAt(Math.round(P.x), Math.round(P.y));
    if (z === curZone) return;
    curZone = z;
    const p = PLACES.find(p => p.id === z);
    if (!S.places[z]) { S.places[z] = S.time; if (z !== 'home') { SND.fx.sparkle(); zoneBanner('🗺️ はじめての ばしょ：' + p.name); return; } }
    if (z !== 'home') zoneBanner(p.name);
  }

  // ───────── 成長 ─────────
  function checkGrow(quiet) {
    let up = null;
    if (S.stage === 'baby' && S.growth >= GROW_AT.child) up = 'child';
    else if (S.stage === 'child' && S.growth >= GROW_AT.adult) up = 'adult';
    if (!up) return;
    S.stage = up;
    const msg = up === 'child' ? `${S.name}が ひとまわり おおきく なった！` : `${S.name}が りっぱな おとなに なった！\nつばさが つよくなって、ふかい うみの うえも とべるように なったよ。`;
    const go = () => { SND.fx.fanfare(); for (let i = 0; i < 12; i++) burst(P.x, P.y - 0.8, ['✨', '⭐'][i % 2], 1); setExpr('h', 3); P.hop = 1; talkSimple('🎉', 'せいちょう', msg); };
    if (quiet) setTimeout(go, 3300); else go();
    save();
  }

  // ───────── パーティクル・ふきだし（3Dの位置に、画面の上で絵文字を出す） ─────────
  const parts = [];
  function burst(x, y, ch, kind) {
    // kind 0: ぽんと上へ 1: 四方へ 2: ふわふわ上へ（音符）
    const a = Math.random() * Math.PI * 2, h = S.stage === 'egg' ? 0.6 : stageScale() * 0.9;
    parts.push({ ax: x + 0.5, ah: h, az: y + 0.5, x: 0, y: 0, vx: kind === 1 ? Math.cos(a) * 110 : (Math.random() - 0.5) * 50, vy: kind === 1 ? Math.sin(a) * 110 - 70 : -110, g: kind === 2 ? -15 : kind === 0 ? 110 : 60, ch, life: kind === 2 ? 2.2 : 1.2, t: 0, sz: kind === 2 ? 26 : 24 });
  }
  function hearts(x, y, n) { for (let i = 0; i < n; i++) setTimeout(() => parts.push({ ax: x + 0.5 + (Math.random() - 0.5) * 0.5, ah: stageScale() * 1.05, az: y + 0.5, x: 0, y: 0, vx: (Math.random() - 0.5) * 30, vy: -80, g: -8, ch: '💗', life: 1.3, t: 0, sz: 22 }), i * 160); }
  function ping(wx, wz) { parts.push({ ax: wx, ah: 0.02, az: wz, x: 0, y: 0, ring: 1, t: 0, life: 0.5 }); }
  function say(t) { P.say = { t, life: 2.2 }; }

  // ───────── 動き ─────────
  function stageSpeed() { return { egg: 0, baby: 3.0, child: 3.8, adult: 4.6 }[S.stage]; }
  function step(dt) {
    if (S.stage === 'egg' || busy) return;
    if (P.prog < 1) {
      let sp = stageSpeed();
      if (S.energy < 10) sp *= 0.6;
      const g = M.get(P.tx, P.ty);
      if (WATER(g) && !P.fly) sp *= 0.85;
      P.prog = Math.min(1, P.prog + dt * sp);
      const e = P.prog;
      P.x = P.fx + (P.tx - P.fx) * e; P.y = P.fy + (P.ty - P.fy) * e;
      P.walkT += dt * sp;
      if (P.prog >= 1) arrive();
      return;
    }
    let d = keyDir();
    if (!d && P.path.length) {
      const [nx, ny] = P.path[0];
      d = [nx - P.tx, ny - P.ty];
      if (Math.abs(d[0]) + Math.abs(d[1]) !== 1) { P.path = []; d = null; }
    }
    if (!d) {
      if (P.pending) { const p = P.pending; P.pending = null; faceTo(p.tx, p.ty); if (p.it) p.it.act(); }
      return;
    }
    if (d[0]) P.face = d[0];
    P.dir = d;
    const nx = P.tx + d[0], ny = P.ty + d[1];
    if (!passable(M, nx, ny, canFly())) {
      P.path = [];
      if (M.get(nx, ny) === G.DEEP && !canFly() && !keyBumpT) { toast('ふかい うみは まだ こわい… おとなに なったら とべるよ'); keyBumpT = 2; }
      return;
    }
    if (P.path.length) P.path.shift();
    P.fx = P.tx; P.fy = P.ty; P.tx = nx; P.ty = ny; P.prog = 0;
    if (WATER(M.get(nx, ny)) && !WATER(M.get(P.fx, P.fy)) && !(canFly() && M.get(nx, ny) === G.DEEP)) SND.fx.splash();
  }
  let keyBumpT = 0;
  function arrive() {
    const x = P.tx, y = P.ty;
    // 家に入る・出る
    if (M.name === 'town') {
      const b = buildingAt(M, x, y);
      if (b && b.kind === 'home' && b.door[0] === x && b.door[1] === y) { enter('home'); return; }
      const o = M.o(x, y);
      if (o && o.t === 'shell' && !S.shellTaken[o.key || `${x},${y}`]) { S.shellTaken[`${x},${y}`] = 1; S.shells++; SND.fx.pop(); burst(x, y, '🐚', 0); toast(`かいがらを ひろった！（${S.shells}こ）`); }
      const t = TREASURES.find(t => t.x === x && t.y === y && treasureVisible(t) && !S.found[t.id]);
      if (t) { P.path = []; findTreasure(t); }
    } else if (M.name === 'home' && x === M.door[0] && y === M.door[1]) { enter('town'); return; }
    checkZone();
  }
  function enter(where) {
    busy = true; SND.fx.door();
    const f = $('fade'); f.textContent = ''; f.classList.add('on');
    setTimeout(() => {
      M = MAPS[where]; S.where = where; camSnap = true;
      const [x, y] = where === 'home' ? [6, 8] : [35, 26];
      P.x = P.fx = P.tx = x; P.y = P.fy = P.ty = y; P.prog = 1; P.path = []; P.pending = null;
      P.dir = where === 'home' ? [0, -1] : [0, 1];
      ball = null; curZone = '';
      checkZone(); save();
      f.classList.remove('on'); busy = false;
    }, 450);
  }

  // 時間とメーター
  let saveT = 0;
  function tickTime(dt) {
    if (S.stage === 'egg' || busy) { if (S.stage === 'egg') S.time += dt * SPEEDS[S.speed].rate * 0.25; return; }
    const dm = dt * SPEEDS[S.speed].rate;
    S.time += dm;
    const moving = P.prog < 1;
    S.food = Math.max(0, S.food - dm * 0.045);
    const drain = M.name === 'home' ? 0.004 : moving ? (P.fly ? 0.07 : WATER(M.get(P.tx, P.ty)) ? 0.075 : 0.055) : 0.012;
    S.energy = Math.max(0, S.energy - dm * drain);
    S.love = Math.max(0, S.love - dm * 0.0025);
    if (S.food > 10) S.growth += dm;
    checkGrow(false);
  }
  let moodT = 8;
  function mood(dt) {
    moodT -= dt;
    if (moodT > 0 || S.stage === 'egg') return;
    moodT = 14 + Math.random() * 10;
    if (S.food < 20) { say('おなか すいた…'); return; }
    if (S.energy < 12) { say('ねむい…'); return; }
    if (S.love < 15) { say('かまって〜'); return; }
  }

  // ───────── 3D の世界とカイリュー ─────────
  const W3 = { town: buildWorld3D(MAPS.town, renderer, S), home: buildHome3D(MAPS.home, renderer) };
  scene.add(W3.town.group, W3.home.group);
  const K = createKairyu(); scene.add(K.root);
  K.root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  // たまご
  const egg = (() => {
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI; pts.push(new THREE.Vector2(Math.sin(t) * 0.3 * (1 + 0.12 * Math.cos(t)), 0.42 - Math.cos(t) * 0.42)); }
    const g = new THREE.LatheGeometry(pts, 40); g.deleteAttribute('uv');
    const p = g.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
    const cream = new THREE.Color('#fbf3dc'), org = new THREE.Color('#eaa24e'), teal = new THREE.Color('#5ec8c9');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const band = Math.abs(y - 0.36 - Math.sin(a * 3) * 0.035) < 0.055;
      const spot = (Math.abs(y - 0.6) < 0.05 && Math.cos(a * 4) > 0.8) || (Math.abs(y - 0.16) < 0.04 && Math.cos(a * 4 + 1.5) > 0.8);
      col.copy(band ? org : spot ? teal : cream); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, softMat({ belly: false })); m.castShadow = true;
    const grp = new THREE.Group(); grp.add(m); addOutline(m, 0.018);
    return grp;
  })();
  scene.add(egg);
  // たからものの光
  const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.25, 'rgba(255,240,170,0.8)'); gr.addColorStop(1, 'rgba(255,230,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? 10 : 50; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const trSprites = TREASURES.map(t => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(t.x + 0.5, 0.45, t.y + 0.5); s.scale.setScalar(0.9); W3.town.group.add(s); return s; });
  // 水の輪・ボール
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
  const rings = [0, 1].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), ringMat.clone()); r.rotation.x = -Math.PI / 2; r.visible = false; scene.add(r); return r; });
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), softMat({ belly: false, vertexColors: false, color: '#ff6b8a' })); ballMesh.castShadow = true; ballMesh.visible = false; scene.add(ballMesh); addOutline(ballMesh, 0.02);

  const stageScale = () => ({ egg: 1.2, baby: 1.25, child: 1.55, adult: 1.95 })[S.stage];
  const camTarget = new THREE.Vector3(P.x + 0.5, 0.6, P.y + 0.5);
  let yawNow = 0, lastExpr = '', camSnap = true;
  const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

  function render(dt = 0.016) {
    const tnow = performance.now() / 1000;
    const home = M.name === 'home';
    const dk = darkness(), night = home ? dk * 0.45 : dk;
    W3.town.group.visible = !home; W3.home.group.visible = home;
    // 光（昼・夕方・夜）
    const h = hour(), dusk = h >= 16 && h < 19.5 ? Math.sin((h - 16) / 3.5 * Math.PI) : 0;
    hemi.color.copy(lerpC('#fffaf0', '#7080c8', night)); hemi.groundColor.copy(lerpC('#b8d0a0', '#2a3060', night));
    hemi.intensity = 1.75 - night * 1.15;
    sun.color.copy(lerpC('#fff3dc', '#ffb070', dusk * 0.8)).lerp(new THREE.Color('#90a4ff'), night);
    sun.intensity = 2.0 - night * 1.65;
    scene.background = home ? new THREE.Color('#3a2e40') : lerpC('#9ad8f0', '#18204a', night);
    W3.town.update(tnow, night); W3.home.update(tnow, dk);
    // カイリューの位置
    const sc = stageScale();
    const px = P.x + 0.5, pz = P.y + 0.5;
    const moving = P.prog < 1;
    const g = M.get(P.tx, P.ty), gFrom = M.get(P.fx, P.fy);
    const flying = canFly() && (g === G.DEEP || gFrom === G.DEEP);
    P.fly += ((flying ? 1 : 0) - P.fly) * Math.min(1, dt * 4);
    const swimNow = !flying && P.fly < 0.2 && !home && WATER(M.get(Math.round(P.x), Math.round(P.y)));
    let y = P.fly * 0.95 * sc + Math.sin(tnow * 4) * 0.06 * P.fly;
    if (swimNow) y -= 0.36 * sc;
    if (P.hop > 0) y += Math.sin((1 - P.hop) * Math.PI) * 0.25;
    const isEgg = S.stage === 'egg';
    K.root.visible = !isEgg; egg.visible = isEgg;
    if (isEgg) {
      egg.position.set(px, 0, pz);
      egg.rotation.z = P.hop > 0 ? Math.sin(P.hop * 20) * 0.2 * P.hop : Math.sin(tnow * 1.3) * 0.03;
    } else {
      K.root.position.set(px, y, pz);
      K.root.scale.setScalar(sc);
      const want = Math.atan2(P.dir[0], P.dir[1]);
      let d = want - yawNow; d = Math.atan2(Math.sin(d), Math.cos(d));
      yawNow += d * Math.min(1, dt * 10);
      K.root.rotation.y = yawNow;
      let ex = P.expr;
      if (P.exprT <= 0) ex = 'n';
      if (ex === 'n' && (P.blinkT < 0.13 || (S.energy < 8 && !moving))) ex = 'b';
      if (ex !== lastExpr) { K.setExpr(ex); lastExpr = ex; }
      K.update(dt, { moving: moving && !busy, speed: stageSpeed(), swim: swimNow, fly: P.fly > 0.5, sleep: P.expr === 's' && P.exprT > 0 });
      if (P.fly > 0.5 && Math.sin(tnow * 14) > 0.97) SND.fx.flap();
    }
    // 水の輪
    rings.forEach((r, i) => {
      r.visible = swimNow;
      if (!swimNow) return;
      const k = (tnow * 0.8 + i * 0.5) % 1;
      r.position.set(px, 0.03, pz); r.scale.setScalar(sc * (0.32 + k * 0.3)); r.material.opacity = (1 - k) * 0.8;
    });
    // ボール
    ballMesh.visible = !!ball && home;
    if (ball) ballMesh.position.set(ball.x + 0.5, 0.16 + ball.h, ball.y + 0.5);
    // たからもの・しげみ・かいがら
    if (!home) {
      TREASURES.forEach((t, i) => { const s = trSprites[i]; s.visible = treasureVisible(t); if (s.visible) { s.position.y = 0.45 + Math.sin(tnow * 2.5 + i) * 0.08; s.material.rotation = tnow * 0.8; s.scale.setScalar(0.8 + Math.sin(tnow * 3 + i) * 0.12); } });
      for (const k in W3.town.bushObjs) { const [bx, by] = k.split(',').map(Number); W3.town.bushObjs[k].visible = ripe(M.o(bx, by)); }
      for (const k in W3.town.shellObjs) W3.town.shellObjs[k].visible = !S.shellTaken[k];
    }
    // カメラ（ななめ上から）
    const want = home ? new THREE.Vector3(6.5, 0, 5.7) : new THREE.Vector3(px, 0.5, pz);
    camTarget.lerp(want, camSnap ? 1 : Math.min(1, dt * 5)); camSnap = false;
    const asp = VW / VH, tf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const pitch = home ? 0.9 : 0.78;
    let dist = home ? Math.max(14.2 / (2 * tf * asp), 10.5 * Math.sin(pitch) / (2 * tf)) : asp >= 1 ? 14.5 / (2 * tf * Math.min(asp, 1.5)) : 9.5 / (2 * tf * asp);
    if (!home) dist = Math.min(dist, 9.5 / (2 * tf * 0.42));
    camera.position.set(camTarget.x, camTarget.y + Math.sin(pitch) * dist, camTarget.z + Math.cos(pitch) * dist);
    camera.lookAt(camTarget);
    sun.position.set(camTarget.x + 6, 14, camTarget.z + 5); sun.target.position.copy(camTarget);
    // 夜のあかり
    if (!home && night > 0.05) {
      const near = M.lamps.map(([lx, ly]) => [lx, ly, (lx - P.x) ** 2 + (ly - P.y) ** 2]).sort((a, b) => a[2] - b[2]);
      lampLights.forEach((l, i) => { const L = near[i]; if (L) { l.position.set(L[0] + 0.5, 1.6, L[1] + 0.5); l.intensity = 3.5 * night; } else l.intensity = 0; });
    } else lampLights.forEach(l => l.intensity = 0);
    playerLight.position.set(px, 1.3, pz + 0.4); playerLight.intensity = (home ? 0.8 : 1.4) * night;
    renderer.render(scene, camera);
    drawOverlay(dt);
  }

  // 画面の上の絵文字・ふきだし・タップの輪
  function drawOverlay() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of parts) {
      const a = 1 - p.t / p.life;
      const s = toScreen(p.ax, p.ah, p.az); if (!s.ok) continue;
      if (p.ring) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s.x, s.y, 8 + p.t * 60, 4 + p.t * 30, 0, 0, 7); ctx.stroke(); continue; }
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.font = `${p.sz}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.fillText(p.ch, s.x + p.x, s.y + p.y);
    }
    ctx.globalAlpha = 1;
    if (P.say) {
      const s = toScreen(K.root.position.x, K.root.position.y + stageScale() * 1.22, K.root.position.z);
      ctx.font = 'bold 14px "M PLUS Rounded 1c",sans-serif';
      const w = ctx.measureText(P.say.t).width + 22, X = s.x, Y = s.y;
      ctx.globalAlpha = Math.min(1, P.say.life * 3);
      ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#3b2d3a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(X - w / 2, Y - 28, w, 28, 12); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X - 6, Y - 1.5); ctx.lineTo(X, Y + 7); ctx.lineTo(X + 6, Y - 1.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(X - 6, Y); ctx.lineTo(X, Y + 7); ctx.lineTo(X + 6, Y); ctx.stroke();
      ctx.fillStyle = '#3b2d3a'; ctx.fillText(P.say.t, X, Y - 13.5);
      ctx.globalAlpha = 1;
    }
    if (P.expr === 's' && P.exprT > 0) { const s = toScreen(K.root.position.x + 0.3, K.root.position.y + stageScale() * 1.1, K.root.position.z); ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#c9d3ff'; const t = performance.now() / 1000; ctx.fillText('Z', s.x + Math.sin(t * 2) * 3, s.y - (t * 14 % 20)); }
  }

  // ───────── 行動ボタン ─────────
  function frontTarget() {
    if (S.stage === 'egg') return { label: '🤲 あたためる', act: warmEgg };
    if (P.prog < 1) return null;
    const x = Math.round(P.x), y = Math.round(P.y);
    const dirs = [P.dir, [0, -1], [1, 0], [-1, 0], [0, 1]];
    for (const [dx, dy] of dirs) { if (!dx && !dy) continue; const it = interactAt(x + dx, y + dy); if (it) return { ...it, tx: x + dx, ty: y + dy }; }
    return null;
  }
  let actCur = null;
  function updateAct() {
    const t = talkOpen || modalOpen || busy ? null : frontTarget();
    const e = $('act');
    if (!t) { if (actCur) { e.classList.remove('show'); actCur = null; } return; }
    if (!actCur || actCur.label !== t.label) { e.textContent = t.label; e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); }
    actCur = t;
  }
  function doAct() { if (actCur) { if (actCur.tx != null) faceTo(actCur.tx, actCur.ty); actCur.act(); } }
  $('act').onclick = () => { unlockAudio(); doAct(); };
  $('bBag').onclick = () => { unlockAudio(); SND.fx.tap(); openBag(); };
  $('bSing').onclick = () => { unlockAudio(); sing(); };
  $('bDex').onclick = () => { unlockAudio(); SND.fx.tap(); openNote(); };
  $('bSet').onclick = () => { unlockAudio(); SND.fx.tap(); openSettings(); };
  $('bSpeed').onclick = () => { unlockAudio(); S.speed = (S.speed + 1) % (TEST ? 3 : 2); updateHUD(); toast('じかんの はやさ：' + SPEEDS[S.speed].label); };
  $('bSound').onclick = () => { unlockAudio(); S.sound = !S.sound; SND.setOn(S.sound); updateHUD(); };
  $('talk').addEventListener('pointerdown', (e) => e.stopPropagation());

  // ───────── ループ ─────────
  let last = performance.now(), hudT = 0;
  function frame(dt) {
    tickTime(dt);
    step(dt);
    updateBall(dt);
    if (P.exprT > 0) P.exprT -= dt;
    P.blinkT -= dt; if (P.blinkT < 0) P.blinkT = 2.5 + Math.random() * 3;
    if (P.hop > 0) P.hop = Math.max(0, P.hop - dt * 2.2);
    if (P.say) { P.say.life -= dt; if (P.say.life <= 0) P.say = null; }
    if (keyBumpT > 0) keyBumpT -= dt;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; if (!p.ring) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } if (p.t >= p.life) parts.splice(i, 1); }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
    if (zoneT > 0) { zoneT -= dt; if (zoneT <= 0) $('zone').classList.remove('show'); }
    mood(dt);
    hudT -= dt; if (hudT <= 0) { hudT = 0.5; updateHUD(); updateAct(); }
    saveT += dt; if (saveT > 5) { saveT = 0; Object.assign(S, { px: P.tx, py: P.ty }); save(); }
    if (audioOk) SND.bgm(M.name === 'home' ? 'home' : isNight() ? 'night' : 'town');
  }
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!window.__pause) frame(dt);
    render(dt);
    requestAnimationFrame(loop);
  }
  addEventListener('beforeunload', () => { Object.assign(S, { px: P.tx, py: P.ty }); save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { Object.assign(S, { px: P.tx, py: P.ty }); save(); } });

  // ───────── 外から呼ぶ用 ─────────
  window.RYU = {
    closeModal, feed: (id) => { closeModal(); feed(id); },
    setSpeed: (i) => { S.speed = i; updateHUD(); openSettings(); },
    rename: () => askName(false),
    setName: () => { const v = ($('nmIn').value || '').trim() || 'リュー'; const first = !S.name; S.name = v; closeModal(); updateHUD(); save(); if (first) toast('たまごを タップして あたためよう', 4); },
    reset: (b) => { if (b.dataset.ok) { localStorage.removeItem(SAVE_KEY); S = null; location.reload(); return; } b.dataset.ok = 1; b.textContent = '⚠ もういちど おすと けします'; },
    dev: (k) => {
      if (k === 'grow') { if (S.stage === 'egg') hatch(); else { S.growth = S.stage === 'baby' ? GROW_AT.child : GROW_AT.adult; checkGrow(false); } }
      if (k === 'night') S.time = Math.floor(S.time / 1440) * 1440 + 21 * 60;
      if (k === 'day') S.time = Math.floor(S.time / 1440) * 1440 + 10 * 60;
      if (k === 'full') Object.assign(S, { food: 100, energy: 100, love: 100 });
      if (k === 'berry') for (const id of BERRY_IDS) S.bag[id] = (S.bag[id] || 0) + 5;
      updateHUD(); closeModal();
    },
  };
  // 確認用
  window.__r = {
    get S() { return S; }, P, get M() { return M; }, renderer, scene, camera, K,
    frame: (dt = 1 / 30, n = 1) => { for (let i = 0; i < n; i++) { frame(dt); render(dt); } },
    tp: (x, y, where) => { if (where && where !== M.name) { M = MAPS[where]; S.where = where; } P.x = P.fx = P.tx = x; P.y = P.fy = P.ty = y; P.prog = 1; P.path = []; camSnap = true; checkZone(); },
    setHour: (h) => { S.time = Math.floor(S.time / 1440) * 1440 + h * 60; },
    stage: (s) => { S.stage = s; if (s !== 'egg') S.name = S.name || 'リュー'; },
    goTo, bfs, MAPS,
  };

  // ───────── はじめる ─────────
  resize();
  ART.preload().then(() => {
    $('loading').remove();
    updateHUD(); checkZone();
    if (!S.name) askName(true);
    requestAnimationFrame(loop);
  });
})();
