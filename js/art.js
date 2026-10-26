// キャラクターの絵（SVGで描いて画像にしてから使う）
// どの子も「右を向いた3/4の向き・頭が大きいデフォルメ・こげ茶の太い線」でそろえる。
// 足もとは y=94 。expr：n ふつう / b まばたき / h にっこり / s ねむり / o 口をあける

const ART = (() => {
  const OL = '#1d1a1f';
  const SW = 3.2;

  const st = (fill, w = SW) => `fill="${fill}" stroke="${OL}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const E = (cx, cy, rx, ry, fill, w) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${st(fill, w)}/>`;
  const En = (cx, cy, rx, ry, fill, op = 1) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${op}"/>`;
  const P = (d, fill, w) => `<path d="${d}" ${st(fill, w)}/>`;
  const Pn = (d, fill, op = 1) => `<path d="${d}" fill="${fill}" opacity="${op}"/>`;
  const L = (d, w = SW, c = OL) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

  // 目：ステッカー風（まっ黒のたまご形＋たての白い光＋小さな点）
  function eye(cx, cy, s, expr, _iris, style = '', lid = '#f4a6ba') {
    if (expr === 'b' || expr === 's') return L(`M${cx - 4.2 * s},${cy} Q${cx},${cy + 3.4 * s} ${cx + 4.2 * s},${cy}`, 2.8);
    if (expr === 'h') return L(`M${cx - 4.4 * s},${cy + 1.5 * s} Q${cx},${cy - 4.6 * s} ${cx + 4.4 * s},${cy + 1.5 * s}`, 3);
    if (style === 'dot') { // コダックの「ぽかん」目
      return E(cx, cy, 4.6 * s, 4.8 * s, '#fff', 2.2) + En(cx + 0.3 * s, cy + 0.2 * s, 1.1 * s, 1.2 * s, OL);
    }
    const rx = 3.9 * s, ry = 5.4 * s;
    let out = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${OL}"/>`;
    out += En(cx - 1.3 * s, cy - 1.4 * s, 1.15 * s, 2.6 * s, '#fff');
    out += En(cx + 1.5 * s, cy + 2.8 * s, 0.75 * s, 0.75 * s, '#fff');
    if (style === 'sleepy') out += `<path d="M${cx - rx - 1},${cy - ry - 1} L${cx + rx + 1},${cy - ry - 1} L${cx + rx + 1},${cy - 0.6 * s} Q${cx},${cy + 0.4 * s} ${cx - rx - 1},${cy - 0.6 * s}Z" fill="${lid}"/>` + L(`M${cx - rx},${cy - 0.6 * s} Q${cx},${cy + 0.4 * s} ${cx + rx},${cy - 0.6 * s}`, 2.4);
    return out;
  }
  function blush() { return ''; }
  function mouth(cx, cy, expr, s = 1, kind = 'smile') {
    if (expr === 'o') return E(cx, cy + 0.5, 2.8 * s, 3.2 * s, '#b8323f', 2.2) + En(cx, cy + 1.8 * s, 1.7 * s, 1.2 * s, '#ff8aa0');
    if (expr === 'h') return P(`M${cx - 4 * s},${cy - 1} Q${cx},${cy + 6.5 * s} ${cx + 4 * s},${cy - 1}Z`, '#b8323f', 2.2) + En(cx, cy + 2.4 * s, 2 * s, 1.3 * s, '#ff8aa0');
    if (expr === 's') return L(`M${cx - 1.6 * s},${cy} Q${cx},${cy + 1.2 * s} ${cx + 1.6 * s},${cy}`, 2.2);
    if (kind === 'w') return L(`M${cx - 3.6 * s},${cy - 0.6} Q${cx - 1.8 * s},${cy + 2.4 * s} ${cx},${cy} Q${cx + 1.8 * s},${cy + 2.4 * s} ${cx + 3.6 * s},${cy - 0.6}`, 2.4);
    return L(`M${cx - 2.8 * s},${cy - 0.5} Q${cx},${cy + 2.6 * s} ${cx + 2.8 * s},${cy - 0.5}`, 2.4);
  }
  // 2つの形をくっつけて、外がわだけに線を引く
  function union(shapes, fill) {
    return shapes.map(sh => sh.replace('/>', ` fill="${fill}" stroke="${OL}" stroke-width="${SW * 2}"/>`)).join('') + shapes.map(sh => sh.replace('/>', ` fill="${fill}"/>`)).join('');
  }

  // ───────── ちびカイリュー（主人公） ─────────
  // 参考：ステッカーのカイリュー。左向きで描いて最後に左右反転して右向きにする。
  const KO = '#eba24c', KC = '#fbe8a6', KT = '#5ec8c9';
  function kairyu(stage, expr) {
    if (stage === 'egg') return egg(expr);
    const g = {
      baby:  { bs: 0.62, hs: 1.08, hdy: 25, ws: 0.55, ant: 0.38, horn: 0.6, all: 1 },
      child: { bs: 0.8,  hs: 1.0,  hdy: 13, ws: 0.78, ant: 0.7, horn: 0.85, all: 0.97 },
      adult: { bs: 1.0,  hs: 0.8, hdy: -1,  ws: 1.0,  ant: 1.0,  horn: 1.0, all: 0.94 },
    }.adult; // 参考画像のカイリューそのまま（成長しても形は同じで、大きさだけ変わる）
    let body = '';
    // しっぽ（右うしろへ）
    body += P('M60,88 C80,88 92,76 97,52 C90,66 80,72 62,72Z', KO);
    body += Pn('M64,86 C80,86 90,76 95,58 C90,72 80,80 64,81Z', KC);
    body += L('M70,86.5 L71,81 M77,85 L78,79.5 M84,81 L85.5,76 M89,75 L91,70.5 M93,66 L95,62', 1.8);
    // つばさ（うしろ・上）
    const wing = (d1, d2, ox, oy) => `<g transform="translate(${ox},${oy}) scale(${g.ws}) translate(${-ox},${-oy})">${P(d1, KO)}${Pn(d2, KT)}</g>`;
    body += wing('M58,48 C68,34 82,22 95,18 C93,34 89,48 82,58 C77,53 70,52 62,55Z', 'M63,48 C71,37 82,28 90,25 C89,37 85,47 81,53 C76,50 70,49 65,51Z', 60, 50);
    body += wing('M38,58 C28,50 16,50 6,54 C10,62 16,68 24,72 C28,67 34,65 40,65Z', 'M36,59 C28,54 19,54 11,56 C15,61 19,65 24,68 C28,65 32,63 37,63Z', 38, 60);
    // からだ
    body += E(48, 67, 22, 26, KO);
    // おなか（よこじま）
    const bx = 42, by = 68, brx = 14.5, bry = 22.5;
    body += E(bx, by, brx, bry, KC, 2.4);
    for (let y = by - bry + 5; y < by + bry - 2; y += 4.6) {
      const hw = brx * Math.sqrt(Math.max(0, 1 - ((y - by) / bry) ** 2)) - 0.8;
      body += L(`M${bx - hw},${y} L${bx + hw},${y}`, 2);
    }
    // あし
    body += E(37, 91, 9, 4.6, KO); body += E(61, 91, 9, 4.6, KO);
    for (const x of [30, 34]) body += Pn(`M${x},93 L${x + 1.5},89.5 L${x + 3},93Z`, '#fff');
    for (const x of [62, 66]) body += Pn(`M${x},93 L${x + 1.5},89.5 L${x + 3},93Z`, '#fff');
    // うで
    body += P('M30,56 C22,62 17,70 17,76 C21,77 26,72 31,65Z', KO);
    body += Pn('M17,75 L15.5,79 L19,76.5Z', '#fff'); body += Pn('M20,75.5 L19.5,79.5 L22,76Z', '#fff');
    body += P('M61,56 C66,64 68,72 66,80 C63,81 60,76 59,68Z', KO);
    body += Pn('M62,79 L63,83 L64.5,79.5Z', '#fff'); body += Pn('M65,79 L66.5,82.5 L67,78.5Z', '#fff');
    // あたま
    let head = '';
    const a = g.ant;
    const antL = `M38,20 C34,${18 - 8 * a} ${30 - 6 * a},${16 - 8 * a} ${26 - 4 * a},${18 - 6 * a} C${22 - 4 * a},${19 - 6 * a} ${20 - 4 * a},${12 - 8 * a} ${23 - 4 * a},${8 - 8 * a}`;
    const antR = `M55,20 C59,${18 - 8 * a} ${63 + 6 * a},${16 - 8 * a} ${67 + 4 * a},${18 - 6 * a} C${71 + 4 * a},${19 - 6 * a} ${73 + 4 * a},${12 - 8 * a} ${70 + 4 * a},${8 - 8 * a}`;
    head += L(antL, 4.2 + SW * 2) + L(antL, 4.2, KC);
    head += L(antR, 4.2 + SW * 2) + L(antR, 4.2, KC);
    head += `<g transform="translate(47,20) scale(${g.horn}) translate(-47,-20)">${P('M41,21 L47,8 L53,21Z', KO)}</g>`;
    head += union(['<ellipse cx="47" cy="36" rx="24" ry="20"/>', '<ellipse cx="30" cy="45" rx="13" ry="9.5"/>'], KO);
    head += En(52, 26, 8, 4, '#fff', 0.25);
    head += En(20, 44, 1.2, 1.4, OL); head += En(25, 45.5, 1.2, 1.4, OL);
    head += `<ellipse cx="24.5" cy="33" rx="2.4" ry="5" fill="${OL}"/>`;
    head += eye(47, 34, 1.35, expr);
    if (expr === 'o' || expr === 'h') head += P('M24,51 Q31,58 38,51 Q31,53 24,51Z', '#b8323f', 2.2);
    else head += L('M26,51 Q33,54 40,50', 2.4);
    let s = '';
    s += `<g transform="translate(48,94) scale(${g.bs}) translate(-48,-94)">${body}</g>`;
    s += `<g transform="translate(0,${g.hdy}) translate(46,40) scale(${g.hs}) translate(-46,-40)">${head}</g>`;
    return `<g transform="translate(100,0) scale(-1,1) translate(50,95) scale(${g.all}) translate(-50,-95)">${s}</g>`;
  }
  function egg(expr) {
    let s = '';
    s += P('M50,12 C70,12 80,46 80,64 C80,84 66,94 50,94 C34,94 20,84 20,64 C20,46 30,12 50,12Z', '#fbf3dc');
    s += Pn('M24,58 C34,52 40,62 50,58 C60,54 66,62 77,56 C79,62 80,66 80,68 C66,74 58,66 50,70 C40,74 32,66 21,72 C20,66 21,62 24,58Z', KO);
    s += Pn('M38,28 Q44,22 48,28 Q44,34 38,28Z', KT);
    s += Pn('M58,22 Q64,16 68,22 Q64,28 58,22Z', KT);
    s += Pn('M56,82 Q62,77 66,82 Q62,87 56,82Z', KT);
    s += En(36, 36, 5, 10, '#fff', 0.7);
    if (expr === 'crack1' || expr === 'crack2') s += L('M30,46 L38,52 L44,44 L52,54 L58,46 L66,52 L72,44', 2.6);
    if (expr === 'crack2') s += L('M34,70 L42,64 L48,72 L56,64', 2.4);
    return s;
  }

  // ───────── なかまになるポケモン（デフォルメ） ─────────
  const D = {};

  D.fushigidane = (x) => {
    const B = '#8ad6bd', Bd = '#5aa58f', G = '#6bc177', Gd = '#3f8e4e';
    let s = '';
    s += E(28, 88, 6, 5, B); s += E(70, 89, 6, 5, B);
    s += E(48, 74, 28, 17, B);
    s += P('M16,70 C10,50 24,30 38,36 C48,40 50,58 40,70 C32,76 20,76 16,70Z', G);
    s += L('M24,40 C28,52 30,62 30,72', 2, Gd); s += L('M38,38 C34,50 34,60 36,70', 2, Gd);
    s += Pn('M20,48 C24,40 30,38 33,40 C28,44 24,48 22,54Z', '#fff', 0.3);
    s += E(40, 90, 6, 5, B); s += E(60, 90, 6, 5, B);
    s += P('M44,40 L44,26 L54,34Z', B); s += P('M70,32 L78,22 L80,38Z', B);
    s += E(62, 52, 24, 19, B);
    s += Pn('M46,40 L52,38 L50,44Z', Bd); s += Pn('M70,40 L76,42 L72,46Z', Bd); s += Pn('M30,72 L36,70 L34,76Z', Bd); s += Pn('M56,66 L62,68 L58,72Z', Bd);
    s += eye(55, 52, 1.1, x, '#c8354a'); s += eye(73, 51, 0.95, x, '#c8354a');
    s += blush(49, 60); s += blush(80, 59, 0.8);
    s += mouth(65, 60, x, 1.2);
    return s;
  };

  D.hitokage = (x) => {
    const O = '#f8a254', C = '#fde3a3';
    let s = '';
    s += P('M36,80 C24,82 16,74 16,62 C16,58 22,58 22,62 C22,70 28,74 36,74Z', O);
    s += P('M18,62 C8,54 14,40 20,34 C22,44 30,46 26,56 C25,60 22,62 18,62Z', '#ff6a3d', 2);
    s += Pn('M19,58 C14,52 17,46 20,42 C22,48 25,50 23,55Z', '#ffd84a');
    s += E(42, 91, 7, 4.5, O); s += E(58, 91, 7, 4.5, O);
    s += E(50, 74, 17, 18, O);
    s += En(54, 77, 10, 12, C);
    s += E(38, 70, 4, 6, O); s += E(64, 70, 4, 6, O);
    s += E(55, 44, 23, 20, O);
    s += En(46, 33, 8, 4, '#fff', 0.35);
    s += eye(50, 45, 1.1, x, '#2e62b0'); s += eye(66, 44, 0.95, x, '#2e62b0');
    s += blush(43, 53); s += blush(73, 52, 0.8);
    s += mouth(59, 53, x, 1.1);
    return s;
  };

  D.zenigame = (x) => {
    const B = '#93d6f2', Sh = '#c48a50', C = '#f3e09a';
    let s = '';
    s += P('M26,84 C14,86 10,76 16,72 C20,70 24,74 20,78 C24,80 26,80 28,78Z', B);
    s += E(42, 72, 20, 21, Sh);
    s += Pn('M26,64 C30,56 40,54 46,58 C40,58 32,60 28,66Z', '#fff', 0.3);
    s += E(42, 91, 7, 4.5, B); s += E(58, 91, 7, 4.5, B);
    s += E(51, 75, 16, 17, B);
    s += P('M44,62 C52,60 60,62 64,68 C64,78 60,88 52,90 C46,88 44,78 44,62Z', C, 2);
    s += L('M45,72 L63,72 M46,81 L61,81', 1.6, '#b8a35a');
    s += E(36, 72, 4, 6, B); s += E(66, 70, 4, 6, B);
    s += E(56, 44, 23, 20, B);
    s += En(47, 33, 8, 4, '#fff', 0.35);
    s += eye(51, 45, 1.1, x, '#8a3a2c'); s += eye(67, 44, 0.95, x, '#8a3a2c');
    s += blush(44, 53); s += blush(74, 52, 0.8);
    s += mouth(60, 53, x, 1.1);
    return s;
  };

  D.pikachu = (x) => {
    const Y = '#ffd84d', Br = '#8b5a2b';
    let s = '';
    s += P('M34,76 L26,70 L32,64 L20,56 L28,50 L14,36 L36,46 L30,52 L40,58 L34,62 L42,70Z', Y, 2.2);
    s += Pn('M34,76 L26,70 L30,66 L38,72Z', Br);
    s += E(42, 91, 7, 4.5, Y); s += E(58, 91, 7, 4.5, Y);
    s += E(50, 74, 17, 17, Y);
    s += Pn('M36,66 Q42,64 44,68 Q40,70 36,70Z', Br, 0.85);
    s += E(38, 72, 4, 5.5, Y); s += E(64, 72, 4, 5.5, Y);
    s += P('M40,36 C34,24 30,14 26,6 C38,10 48,22 50,32Z', Y);
    s += P('M26,6 C29,9 31,12 32,15 C30,15 28,14 27,12Z', '#2b1f2e', 1.6);
    s += P('M64,32 C70,22 78,14 86,8 C84,20 78,30 72,36Z', Y);
    s += P('M86,8 C85,12 84,15 82,17 C81,15 81,12 82,11Z', '#2b1f2e', 1.6);
    s += E(55, 46, 23, 19, Y);
    s += En(47, 35, 8, 4, '#fff', 0.4);
    s += eye(50, 45, 1.05, x, '#3a2a2a'); s += eye(66, 44, 0.92, x, '#3a2a2a');
    s += E(40, 54, 4.6, 4.2, '#f2584a', 1.8); s += E(76, 53, 3.8, 4, '#f2584a', 1.8);
    s += mouth(59, 53, x, 1.05, 'w');
    return s;
  };

  D.purin = (x) => {
    const Pk = '#f9b6cb';
    let s = '';
    s += E(40, 92, 6, 3.6, Pk); s += E(60, 92, 6, 3.6, Pk);
    s += P('M28,40 L26,22 L40,32Z', Pk); s += Pn('M29,36 L28,26 L36,32Z', '#5a3d52');
    s += P('M66,30 L78,20 L76,40Z', Pk); s += Pn('M70,30 L76,25 L75,36Z', '#5a3d52');
    s += E(51, 62, 31, 30, Pk);
    s += P('M48,32 C42,22 52,14 60,20 C64,24 60,30 54,28 C58,26 58,22 54,22 C48,24 50,30 52,34Z', Pk, 2.2);
    s += En(40, 44, 9, 5, '#fff', 0.45);
    s += E(22, 64, 4, 6, Pk); s += E(81, 62, 4, 6, Pk);
    s += eye(43, 58, 1.35, x, '#2f9e9a'); s += eye(64, 57, 1.2, x, '#2f9e9a');
    s += blush(35, 70); s += blush(72, 69);
    s += mouth(54, 70, x, 1.1);
    return s;
  };

  D.gengar = (x) => {
    const Pu = '#7f64b0', Pud = '#5f4790';
    let s = '';
    s += E(38, 91, 8, 4.5, Pu); s += E(64, 91, 8, 4.5, Pu);
    s += P('M18,62 L8,52 L20,52 L12,40 L24,44 L22,30 L34,38 L36,26 L46,34 L50,22 L56,32 L62,26 L64,36 L74,30 L74,42 L86,40 L80,52 L90,58 L80,64 C82,80 70,90 50,90 C30,90 18,80 18,62Z', Pu);
    s += P('M30,36 L22,14 L42,30Z', Pu); s += P('M64,30 L80,10 L76,36Z', Pu);
    s += Pn('M34,34 L28,20 L38,30Z', Pud); s += Pn('M68,30 L77,18 L74,34Z', Pud);
    s += E(14, 66, 5, 6, Pu); s += E(86, 66, 5, 6, Pu);
    s += En(36, 46, 9, 5, '#fff', 0.2);
    if (x === 'b' || x === 's' || x === 'h') { s += eye(40, 52, 1.2, x); s += eye(62, 51, 1.1, x); }
    else {
      s += P('M30,50 C32,42 44,42 48,50 C46,58 34,60 30,50Z', '#ff5263', 2);
      s += P('M54,50 C56,42 68,42 72,48 C70,58 58,60 54,50Z', '#ff5263', 2);
      s += En(42, 48, 2.2, 2.2, '#fff'); s += En(66, 47, 2.2, 2.2, '#fff');
      s += En(38, 52, 2.6, 3.4, '#5b0f1f'); s += En(62, 51, 2.6, 3.4, '#5b0f1f');
      s += En(42, 48, 1.5, 1.5, '#fff'); s += En(66, 47, 1.5, 1.5, '#fff');
    }
    if (x === 'o' || x === 'h') s += P('M32,64 Q50,82 70,64 Q50,72 32,64Z', '#a3343f', 2);
    else {
      s += P('M30,62 Q50,78 72,62 Q50,68 30,62Z', '#fff', 2.2);
      s += L('M38,64 L39,68 M46,66 L46,71 M54,66 L54,71 M62,64 L61,68', 1.4);
    }
    return s;
  };

  D.kodakku = (x) => {
    const Y = '#ffd96b', Bk = '#f9e7b2';
    let s = '';
    s += E(42, 91, 8, 4.5, Bk); s += E(58, 91, 8, 4.5, Bk);
    s += E(50, 74, 18, 17, Y);
    s += E(36, 70, 4.5, 6, Y); s += E(64, 70, 4.5, 6, Y);
    s += L('M52,26 Q50,16 46,14 M56,26 Q57,16 54,12 M60,27 Q64,18 62,14', 2.4);
    s += E(55, 46, 24, 21, Y);
    s += En(46, 34, 8, 4, '#fff', 0.4);
    s += P('M60,54 C64,48 82,48 86,54 C84,60 66,62 60,58Z', Bk, 2.2);
    s += L('M63,56 Q74,58 84,55', 1.6, '#c9b67a');
    s += eye(48, 44, 1.05, x === 'n' || x === 'o' ? 'n' : x, '#000', x === 'n' || x === 'o' ? 'dot' : '');
    s += eye(66, 43, 0.92, x === 'n' || x === 'o' ? 'n' : x, '#000', x === 'n' || x === 'o' ? 'dot' : '');
    s += blush(42, 54, 0.9);
    return s;
  };

  D.yadon = (x) => {
    const Pk = '#f4a6ba', C = '#fae6cb';
    let s = '';
    s += P('M18,76 C6,74 6,60 14,58 C20,58 20,66 16,66 C14,70 18,72 22,72Z', Pk);
    s += E(13, 60, 4, 3.5, '#fff', 2);
    s += E(30, 89, 6, 5, Pk); s += E(66, 89, 6, 5, Pk);
    s += E(46, 75, 28, 15, Pk);
    s += E(40, 90, 6, 4.5, C); s += E(56, 90, 6, 4.5, C);
    s += E(52, 36, 6, 6, Pk); s += E(74, 34, 5, 5.5, Pk);
    s += E(62, 50, 21, 18, Pk);
    s += En(54, 40, 8, 4, '#fff', 0.35);
    s += E(75, 60, 13, 9, C);
    if (x === 'n' || x === 'o') {
      s += eye(56, 49, 1.05, 'n', '#3a2a3a', 'sleepy', Pk) + eye(71, 48, 0.92, 'n', '#3a2a3a', 'sleepy', Pk);
    } else { s += eye(56, 49, 1.05, x); s += eye(71, 48, 0.92, x); }
    s += blush(50, 57, 0.9);
    s += mouth(77, 61, x === 'n' ? 'n' : x, 1.2);
    return s;
  };

  D.eevee = (x) => {
    const Br = '#c98e57', Brd = '#8d5b34', C = '#f6e7c8';
    let s = '';
    s += P('M32,78 C16,78 10,62 16,50 C20,44 30,48 30,56 C30,64 34,70 38,72Z', Br);
    s += P('M16,50 C12,56 13,62 16,66 C20,62 22,56 22,50 C20,48 18,48 16,50Z', C, 2);
    s += E(40, 91, 6, 4.5, Br); s += E(60, 91, 6, 4.5, Br);
    s += E(48, 78, 18, 13, Br);
    s += P('M36,64 C34,56 44,56 46,60 C48,54 56,54 58,60 C62,56 70,60 66,66 C70,72 62,78 56,76 C52,80 44,80 40,76 C34,76 32,70 36,64Z', C, 2.2);
    s += P('M44,38 C40,26 36,16 34,6 C46,10 52,22 54,32Z', Br); s += Pn('M44,34 C41,26 39,18 38,12 C45,16 49,24 50,30Z', Brd);
    s += P('M64,32 C70,22 78,12 88,6 C86,20 80,30 74,38Z', Br); s += Pn('M67,32 C72,24 78,17 84,12 C83,21 79,28 74,34Z', Brd);
    s += E(59, 47, 21, 18, Br);
    s += En(52, 36, 8, 4, '#fff', 0.35);
    s += eye(53, 47, 1.05, x, '#6a3a22'); s += eye(68, 46, 0.92, x, '#6a3a22');
    s += blush(47, 55, 0.9); s += blush(76, 54, 0.75);
    s += mouth(62, 55, x, 1, 'w');
    return s;
  };

  D.kabigon = (x) => {
    const Bl = '#45758c', C = '#f2e6c9';
    let s = '';
    s += E(30, 89, 11, 7, C); s += E(70, 89, 11, 7, C);
    s += En(30, 90, 5, 3.5, '#b08c64'); s += En(70, 90, 5, 3.5, '#b08c64');
    s += P('M24,30 L28,16 L38,26Z', Bl); s += P('M62,26 L72,16 L76,30Z', Bl);
    s += E(50, 60, 38, 32, Bl);
    s += E(52, 70, 28, 21, C, 2.2);
    s += P('M34,40 C34,28 68,28 70,40 C70,50 60,54 52,54 C42,54 34,50 34,40Z', C, 2.2);
    s += E(14, 60, 6, 9, Bl); s += E(88, 58, 6, 9, Bl);
    s += En(36, 34, 7, 3, '#fff', 0.25);
    if (x === 'n') { s += L('M40,40 L48,40 M56,40 L64,40', 2.4); } else { s += eye(44, 40, 1, x); s += eye(60, 40, 1, x); }
    s += blush(38, 46, 0.8); s += blush(66, 46, 0.8);
    s += x === 'o' || x === 'h' ? mouth(52, 47, x, 1.2) : L('M46,47 Q52,50 58,47', 2.2);
    return s;
  };

  D.rokon = (x) => {
    const R = '#da6a40', Rl = '#f09a5c', C = '#fbd7a8';
    let s = '';
    for (const [tx, ty, r] of [[16, 56, 9], [22, 46, 9], [30, 40, 8], [14, 68, 8]]) {
      s += P(`M36,72 C${tx + 4},${ty + 14} ${tx - r},${ty + 4} ${tx},${ty - r} C${tx + r},${ty - r * 0.6} ${tx + r * 0.6},${ty + 6} ${tx + 2},${ty + 4} C${tx + 8},${ty + 10} ${tx + 14},${ty + 14} 40,70Z`, Rl, 2.2);
    }
    s += E(42, 91, 5.5, 4.5, R); s += E(58, 91, 5.5, 4.5, R);
    s += E(48, 78, 16, 12, R);
    s += En(54, 80, 8, 7, C, 0.6);
    s += P('M48,40 L42,20 L58,34Z', R); s += Pn('M49,36 L45,26 L54,33Z', '#6b2a20');
    s += P('M68,34 L82,18 L80,42Z', R); s += Pn('M71,34 L79,24 L78,38Z', '#6b2a20');
    s += E(62, 51, 19, 17, R);
    s += P('M52,36 C50,26 60,24 62,30 C66,24 74,30 70,36 C66,40 56,40 52,36Z', Rl, 2);
    s += L('M56,34 Q58,30 61,33 M63,34 Q66,30 68,34', 1.5);
    s += eye(56, 51, 1, x, '#5a2a1a'); s += eye(70, 50, 0.9, x, '#5a2a1a');
    s += blush(51, 59, 0.85); s += blush(77, 58, 0.7);
    s += mouth(64, 59, x, 1);
    return s;
  };

  D.miniryu = (x) => {
    const B = '#6aa8ea', W = '#f7f7fb';
    let s = '';
    const coil = 'M20,84 C8,80 10,64 24,66 C40,68 44,88 62,86 C74,85 76,72 68,62';
    s += L(coil, 13 + SW * 2) + L(coil, 13, B);
    s += L('M24,86 C36,90 50,92 60,90', 3, W);
    s += E(18, 84, 4, 3, W, 2.4);
    s += P('M54,40 L42,30 L48,46Z', W); s += P('M80,38 L92,28 L88,44Z', W);
    s += E(66, 48, 19, 17, B);
    s += En(60, 38, 7, 3.5, '#fff', 0.3);
    s += E(78, 56, 8, 6, W, 2.4);
    s += E(64, 33, 3, 3, W, 2);
    s += eye(62, 48, 1.1, x); s += eye(75, 46, 0.95, x);
    s += mouth(80, 57, x, 0.9);
    return s;
  };

  D.mew = (x) => {
    const Pk = '#f8bad1';
    let s = '';
    s += L('M40,72 C20,80 10,66 14,50 C18,36 30,30 26,18', 3.6 + SW * 2, OL);
    s += L('M40,72 C20,80 10,66 14,50 C18,36 30,30 26,18', 3.6, Pk);
    s += E(26, 16, 5, 6.5, Pk, 2.2);
    s += E(46, 82, 5, 6, Pk); s += E(58, 82, 5, 6, Pk);
    s += E(51, 68, 12, 14, Pk);
    s += E(40, 64, 3.5, 5, Pk); s += E(64, 62, 3.5, 5, Pk);
    s += P('M38,30 L36,16 L48,26Z', Pk); s += P('M66,26 L76,16 L74,32Z', Pk);
    s += E(56, 42, 22, 19, Pk);
    s += En(48, 31, 8, 4, '#fff', 0.45);
    s += eye(49, 43, 1.3, x, '#2f73e0'); s += eye(66, 42, 1.15, x, '#2f73e0');
    s += blush(43, 51, 0.9); s += blush(74, 50, 0.8);
    s += mouth(59, 52, x, 0.9);
    return s;
  };

  // art/kairyu.svg（2049×2868、右向き）を正方形の箱に入れ、足もとを y=94% にそろえる
  let KSVG = '';
  function kairyuSVG(x) {
    const body = KSVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    let ov = '';
    const O = '#17150f', OR = '#dc9d49';
    if (x === 'b' || x === 's' || x === 'h') {
      ov += `<ellipse cx="1290" cy="780" rx="134" ry="196" fill="${OR}"/><ellipse cx="1834" cy="700" rx="14" ry="26" fill="${O}"/>`;
      ov += x === 'h'
        ? `<path d="M1165,850 Q1290,640 1415,850" fill="none" stroke="${O}" stroke-width="34" stroke-linecap="round"/>`
        : `<path d="M1165,790 Q1290,905 1415,790" fill="none" stroke="${O}" stroke-width="32" stroke-linecap="round"/>`;
    }
    if (x === 'o' || x === 'h') {
      ov += `<path d="M1235,1150 Q1330,1300 1440,1165 Q1335,1205 1235,1150Z" fill="#b8323f" stroke="${O}" stroke-width="22" stroke-linejoin="round"/>`;
      ov += `<ellipse cx="1340" cy="1215" rx="45" ry="20" fill="#ff8aa0"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-643 -267 3335 3335" width="100" height="100">${body}${ov}</svg>`;
  }

  function svgOf(id, a, b) {
    if (id === 'kairyu' && a !== 'egg' && KSVG) return kairyuSVG(b);
    const body = id === 'kairyu' ? kairyu(a, b) : D[id](a);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${body}</svg>`;
  }

  // 画像を作ってためておく（くっきり見えるように大きめの解像度で）
  const cache = new Map();
  const RES = 384;
  function load(key, svg) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        cache.set(key, sticker(img)); res();
      };
      img.onerror = () => { console.warn('art fail', key); res(); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  // ステッカーのような白いふちをつける
  function sticker(img) {
    const pad = 14, c = document.createElement('canvas');
    c.width = c.height = RES;
    const g = c.getContext('2d');
    const t = document.createElement('canvas'); t.width = t.height = RES;
    const tg = t.getContext('2d');
    tg.drawImage(img, pad, pad, RES - pad * 2, RES - pad * 2);
    tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#fff'; tg.fillRect(0, 0, RES, RES);
    const r = 8;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.drawImage(t, Math.cos(a) * r, Math.sin(a) * r); }
    g.drawImage(img, pad, pad, RES - pad * 2, RES - pad * 2);
    return c;
  }
  const EXPRS = ['n', 'b', 'h', 's', 'o'];
  async function preload() {
    const jobs = [];
    // 主人公は参考画像をなぞったベクター画像（art/kairyu.svg）に表情を重ねて使う
    KSVG = await fetch('art/kairyu.svg').then(r => r.text());
    for (const x of EXPRS) { const sv = kairyuSVG(x); for (const st of ['baby', 'child', 'adult']) jobs.push(load(`kairyu|${st}|${x}`, sv)); }
    for (const x of ['n', 'crack1', 'crack2']) jobs.push(load(`kairyu|egg|${x}`, svgOf('kairyu', 'egg', x)));
    // ほかのポケモンは今は出さないので読みこまない
    await Promise.all(jobs);
  }
  function get(id, expr = 'n', stage) {
    const k = id === 'kairyu' ? `kairyu|${stage}|${expr}` : `${id}|${expr}`;
    return cache.get(k) || cache.get(id === 'kairyu' ? `kairyu|${stage}|n` : `${id}|n`);
  }
  // HTMLに置く用（なかま一覧・会話の顔）
  function dataURL(id, expr = 'n', stage) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(id === 'kairyu' ? svgOf('kairyu', stage, expr) : svgOf(id, expr));
  }
  return { preload, get, dataURL, svgOf, ids: Object.keys(D) };
})();
