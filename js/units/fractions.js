/* 単元: 分数の計算（正負の数・四則・累乗）
 * Lv1 基礎（2項）／Lv2 工夫（3項・負の数・2乗）／Lv3 入試（4項・かっこの入れ子・2乗）
 * 答えは「既約分数（仮分数）か整数」。約分していない答えは不正解にする。 */
(function () {
  const A = globalThis.Axiom;
  const F = A.F;

  const PREC = { '+': 1, '−': 1, '×': 2, '÷': 2 };
  const APPLY = { '+': F.add, '−': F.sub, '×': F.mul, '÷': F.div };

  function leaf(g, maxD, allowNeg) {
    for (;;) {
      const f = F.make(g.int(1, maxD + 3), g.int(2, maxD));
      if (f.d === 1) continue;
      return { f: allowNeg && g.chance(0.3) ? F.make(-f.n, f.d) : f, prec: 3, neg: false,
        h: null, leaf: true };
    }
  }
  const leafHtml = (n) => (n.f.n < 0 ? `(${F.html(n.f)})` : F.html(n.f));
  const html = (n) => (n.leaf ? leafHtml(n) : n.h);

  function bin(op, L, R) {
    const wrapL = !L.leaf && L.prec < PREC[op];
    const wrapR = !R.leaf && (R.prec < PREC[op] || (R.prec === PREC[op] && (op === '−' || op === '÷')));
    const lh = wrapL ? `(${html(L)})` : html(L);
    const rh = wrapR ? `(${html(R)})` : html(R);
    return { f: APPLY[op](L.f, R.f), prec: PREC[op], leaf: false, h: `${lh} ${op} ${rh}` };
  }
  function square(n) { // (…)²
    const inner = n.leaf ? F.html(n.f) : html(n);
    return { f: F.mul(n.f, n.f), prec: 3, leaf: false, h: `(${inner})<sup>2</sup>` };
  }
  function tree(g, leaves, cfg) {
    if (leaves === 1) {
      const lf = leaf(g, cfg.maxD, cfg.neg);
      return cfg.sq && g.chance(cfg.sq) ? square(lf) : lf;
    }
    const l = g.int(1, leaves - 1);
    const op = g.pick(cfg.ops);
    return bin(op, tree(g, l, cfg), tree(g, leaves - l, cfg));
  }

  const CFG = {
    1: { leaves: [2, 2], maxD: 9, neg: false, sq: 0, ops: ['+', '−', '×', '÷'], size: 200 },
    2: { leaves: [3, 3], maxD: 9, neg: true, sq: 0.15, ops: ['+', '−', '×', '÷'], size: 300 },
    3: { leaves: [4, 4], maxD: 12, neg: true, sq: 0.25, ops: ['+', '−', '×', '÷'], size: 400 },
  };

  function generate(level, rng) {
    const cfg = CFG[level];
    for (let t = 0; t < 200; t++) {
      try {
        const n = tree(rng, rng.int(cfg.leaves[0], cfg.leaves[1]), cfg);
        if (n.leaf) continue;
        const f = n.f;
        if (Math.abs(f.n) > cfg.size || f.d > cfg.size) continue;
        if (level === 1 && f.n < 0) continue;     // 基礎は負の答えを出さない
        if (level >= 2 && f.n === 0) continue;
        return { q: n.h, a: F.str(f), d: { n: f.n, d: f.d } };
      } catch (e) { /* 0で割った等はやり直し */ }
    }
    throw new Error('fractions: generate failed');
  }

  function check(input, d) {
    const s = String(input).replace(/\s+/g, '').replace(/[−ー－]/g, '-');
    const mt = /^(-?\d+)(?:\/(\d+))?$/.exec(s);
    if (!mt) return false;
    const n = Number(mt[1]), den = mt[2] === undefined ? 1 : Number(mt[2]);
    if (den === 0) return false;
    if (A.gcd(n, den) !== 1 && !(n === 0 && den === 1)) return false; // 約分していない
    return F.eq(F.make(n, den), d);
  }

  A.registerUnit({
    id: 'frac',
    name: '分数の計算',
    icon: '½',
    levels: ['基礎', '工夫', '入試'],
    hint: '約分して、仮分数か整数で答える（例 7/4、−3/5、2）。',
    keypad: [
      [{ k: '7' }, { k: '8' }, { k: '9' }, { k: '⌫', act: 'back', cls: 'fn' }],
      [{ k: '4' }, { k: '5' }, { k: '6' }, { k: 'AC', act: 'clear', cls: 'fn' }],
      [{ k: '1' }, { k: '2' }, { k: '3' }, { k: '−', cls: 'op' }],
      [{ k: '0' }, { k: '/', cls: 'op' }, { k: '決定', act: 'enter', cls: 'go', w: 2 }],
    ],
    generate,
    check,
  });
})();
