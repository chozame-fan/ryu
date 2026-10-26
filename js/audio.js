// 音：すべてその場で合成（著作権のある音は使わない）
const SND = (() => {
  let ac = null, out = null, bgmGain = null, on = true, bgmTimer = null, bgmMode = '';
  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor();
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    out = ac.createGain(); out.gain.value = 0.55;
    out.connect(lp); lp.connect(comp); comp.connect(ac.destination);
    // かるい残響
    const len = ac.sampleRate * 1.2, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * 0.5; }
    const conv = ac.createConvolver(); conv.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.22;
    out.connect(conv); conv.connect(wet); wet.connect(comp);
    bgmGain = ac.createGain(); bgmGain.gain.value = 0.16; bgmGain.connect(out);
  }
  function resume() { init(); if (ac.state === 'suspended') ac.resume(); }
  const now = () => ac.currentTime;

  // 鉄琴のような音（FM）
  function bell(f, t = 0, dur = 0.6, vol = 0.25, dest) {
    if (!ac || !on) return;
    const t0 = now() + t, o = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    o.frequency.value = f; m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 1.2, t0); mg.gain.exponentialRampToValueAtTime(1, t0 + dur);
    m.connect(mg); mg.connect(o.frequency);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(dest || out); o.start(t0); m.start(t0); o.stop(t0 + dur + 0.05); m.stop(t0 + dur + 0.05);
  }
  function tone(f, t, dur, vol, type = 'sine', f2, dest) {
    if (!ac || !on) return;
    const t0 = now() + t, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(dest || out); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t, dur, vol, freq = 1200, q = 1, type = 'bandpass') {
    if (!ac || !on) return;
    const t0 = now() + t, n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = b;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t0);
  }
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12);

  const fx = {
    step() { noise(0, 0.05, 0.05, 900, 2); },
    splash() { noise(0, 0.25, 0.12, 1600, 0.8); tone(500, 0.02, 0.12, 0.05, 'sine', 900); },
    pop() { tone(520, 0, 0.12, 0.2, 'sine', 1100); bell(N(84), 0.05, 0.3, 0.08); },
    tap() { tone(700, 0, 0.06, 0.1, 'triangle', 500); },
    heart() { bell(N(88), 0, 0.5, 0.12); bell(N(91), 0.08, 0.6, 0.1); },
    eat() { for (let i = 0; i < 3; i++) noise(i * 0.16, 0.07, 0.12, 2200, 3); },
    door() { tone(180, 0, 0.12, 0.15, 'triangle', 140); noise(0.02, 0.1, 0.08, 400, 1); },
    crack() { noise(0, 0.08, 0.25, 3000, 2); noise(0.06, 0.06, 0.18, 2400, 2); },
    sparkle() { [84, 88, 91, 96].forEach((n, i) => bell(N(n), i * 0.07, 0.5, 0.09)); },
    fanfare() { [[72, 0], [76, 0.14], [79, 0.28], [84, 0.42], [79, 0.62], [84, 0.76]].forEach(([n, t]) => { bell(N(n), t, 0.7, 0.16); tone(N(n - 12), t, 0.3, 0.06, 'triangle'); }); },
    no() { tone(320, 0, 0.12, 0.12, 'triangle', 260); tone(260, 0.13, 0.18, 0.12, 'triangle', 200); },
    poof() { noise(0, 0.35, 0.18, 700, 0.6, 'lowpass'); tone(600, 0, 0.3, 0.05, 'sine', 200); },
    flap() { noise(0, 0.12, 0.1, 500, 0.7, 'lowpass'); },
    // ちびリューのうた（やさしいメロディ）
    song() {
      const mel = [[72, 0.5], [74, 0.25], [76, 0.25], [79, 0.75], [76, 0.25], [74, 0.5], [72, 0.5], [69, 0.5], [72, 1], [74, 0.5], [76, 0.5], [79, 0.5], [81, 0.5], [79, 1.5]];
      let t = 0;
      for (const [n, d] of mel) {
        const t0 = now() + t, o = ac.createOscillator(), v = ac.createOscillator(), vg = ac.createGain(), g = ac.createGain();
        if (!on) return 0;
        o.frequency.value = N(n); v.frequency.value = 5.5; vg.gain.value = 4; v.connect(vg); vg.connect(o.frequency);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.13, t0 + 0.06); g.gain.setValueAtTime(0.13, t0 + d * 0.38 * 2 - 0.05); g.gain.exponentialRampToValueAtTime(0.001, t0 + d * 0.38 * 2 + 0.2);
        o.connect(g); g.connect(out); o.start(t0); v.start(t0); o.stop(t0 + d * 0.76 + 0.3); v.stop(t0 + d * 0.76 + 0.3);
        bell(N(n - 12), t, 0.6, 0.04);
        t += d * 0.38 * 2;
      }
      return t;
    },
    // なきごえ（ポケモンごとに高さとリズムを変える）
    cry(id) {
      const P = { kairyu: [520, 2], fushigidane: [620, 2], hitokage: [760, 2], zenigame: [700, 2], pikachu: [980, 3], purin: [880, 2], gengar: [300, 3], kodakku: [560, 1], yadon: [260, 1], eevee: [900, 2], kabigon: [160, 2], rokon: [820, 1], miniryu: [720, 2], mew: [1300, 2] }[id] || [600, 2];
      for (let i = 0; i < P[1]; i++) {
        const f = P[0] * (1 + (i % 2 ? -0.12 : 0.08));
        tone(f, i * 0.16, 0.18, 0.12, id === 'gengar' ? 'sawtooth' : 'triangle', f * (i === P[1] - 1 ? 1.3 : 0.9));
        tone(f * 2, i * 0.16, 0.12, 0.03, 'sine');
      }
    },
  };

  // BGM：昼はやさしいアルペジオ、夜はしずかなオルゴール
  function bgm(mode) {
    if (!ac || mode === bgmMode) return;
    bgmMode = mode; clearInterval(bgmTimer);
    if (!mode) return;
    const prog = mode === 'night' ? [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] : mode === 'home' ? [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]] : [[60, 64, 67], [65, 69, 72], [57, 60, 64], [55, 59, 62]];
    const beat = mode === 'night' ? 0.55 : 0.36;
    let bar = 0;
    const play = () => {
      if (!on) return;
      const ch = prog[bar % prog.length];
      const pat = [0, 1, 2, 1, 0, 2, 1, 2];
      pat.forEach((k, i) => bell(N(ch[k] + 12), i * beat, beat * 2.2, mode === 'night' ? 0.07 : 0.06, bgmGain));
      tone(N(ch[0] - 12), 0, beat * 7, 0.07, 'triangle', null, bgmGain);
      if (mode === 'town' && bar % 2 === 0) [ch[2] + 24, ch[1] + 24].forEach((n, i) => bell(N(n), (i * 3 + 2) * beat, beat * 3, 0.035, bgmGain));
      bar++;
    };
    play();
    bgmTimer = setInterval(play, beat * 8 * 1000);
  }
  return {
    resume, fx: new Proxy(fx, { get: (o, k) => (...a) => { if (ac && on) return o[k](...a); return 0; } }),
    bgm, setOn(v) { on = v; if (!v) { clearInterval(bgmTimer); bgmMode = ''; } }, get on() { return on; },
  };
})();
