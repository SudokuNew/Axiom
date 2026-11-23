/* 単元: 二次方程式
 * Lv1 基礎（因数分解で解ける・x²=k）／Lv2 工夫（平方完成・たすき掛け・移項・解の公式）／Lv3 入試（置き換え・分数方程式・解と係数・文章題）
 * 問題を増やす・難しくするときは、下の L1 / L2 / L3 の表に生成関数を足すだけでよい。 */
(function () {
  const A = globalThis.Axiom;
  const m = A.minus;

  /* ---- 表示用ヘルパー ---- */
  function termStr(co, v, first) {
    if (co === 0) return '';
    const abs = Math.abs(co);
    const body = v && abs === 1 ? v : String(abs) + v;
    if (first) return (co < 0 ? '−' : '') + body;
    return ' ' + (co < 0 ? '−' : '+') + ' ' + body;
  }
  function poly(a, b, c) {
    let out = '', first = true;
    for (const [co, v] of [[a, 'x²'], [b, 'x'], [c, '']]) {
      const t = termStr(co, v, first);
      if (t) { out += t; first = false; }
    }
    return out || '0';
  }
  const lin = (p) => (p < 0 ? 'x − ' + -p : 'x + ' + p); // x+p
  const fr = (n, d) => `<span class="fr"><span>${n}</span><span>${d}</span></span>`;
  const sent = (s) => `<span class="jp">${s}</span>`;

  /* ---- 解の計算（係数から答えを作る）---- */
  function rootAns(p, k, r, d) { // x = (p ± k√r) / d
    const g = A.gcd(A.gcd(p, k), d) || 1;
    p /= g; k /= g; d /= g;
    const rad = (k === 1 ? '' : String(k)) + '√' + r;
    if (d === 1) return p === 0 ? '±' + rad : m(p) + '±' + rad;
    return p === 0 ? '±' + rad + '/' + d : '(' + m(p) + '±' + rad + ')/' + d;
  }
  function solveQuad(a, b, c) {
    const D = b * b - 4 * a * c;
    if (D < 0) return null;
    if (A.isSquare(D)) {
      const s = Math.sqrt(D);
      const r1 = A.F.make(-b - s, 2 * a), r2 = A.F.make(-b + s, 2 * a);
      const list = A.F.eq(r1, r2) ? [r1] : [r1, r2].sort((x, y) => A.F.val(x) - A.F.val(y));
      return { r: list.map(A.F.val), ans: list.map(A.F.str).join(',') };
    }
    const { k, r } = A.simplifySqrt(D);
    const ra = Math.sqrt(D);
    const sg = a > 0 ? 1 : -1;
    return {
      r: [(-b - ra) / (2 * a), (-b + ra) / (2 * a)].sort((x, y) => x - y),
      ans: rootAns(-b * sg, k, r, 2 * a * sg),
    };
  }
  // 係数 a,b,c と表示用HTML q から問題を作る（解なしなら null）
  function make(q, a, b, c) {
    const s = solveQuad(a, b, c);
    return s ? { q, a: s.ans, d: { r: s.r, e: [a, b, c] } } : null;
  }
  // 解を直接指定して作る（解と係数・文章題など、方程式の形をとらないもの）
  const single = (q, val) => ({ q, a: m(val), d: { r: [val] } });

  /* ---- Lv1 基礎 ---- */
  const L1 = [
    [4, (g) => { const p = g.nonZero(-9, 9), q = g.nonZero(-9, 9); const b = -(p + q), c = p * q; return make(poly(1, b, c) + ' = 0', 1, b, c); }],
    [2, (g) => { const k = g.int(1, 15) ** 2; return make(`x² = ${k}`, 1, 0, -k); }],
    [1, (g) => { const k = g.pick([2, 3, 5, 6, 7, 8, 10, 12, 18, 20, 24, 27, 32, 45, 48, 50]); return make(`x² = ${k}`, 1, 0, -k); }],
    [1.5, (g) => { const a = g.pick([1, 1, 2, 3]), b = g.nonZero(-12, 12); return make(poly(a, b, 0) + ' = 0', a, b, 0); }],
    [1, (g) => { const p = g.nonZero(-9, 9), q = g.nonZero(-9, 9); return make(`(${lin(p)})(${lin(q)}) = 0`, 1, p + q, p * q); }],
    [1, (g) => { const p = g.nonZero(-8, 8), k = g.int(1, 9); return make(`(${lin(p)})² = ${k * k}`, 1, 2 * p, p * p - k * k); }],
  ];

  /* ---- Lv2 工夫 ---- */
  const L2 = [
    [3, (g) => { const b = 2 * g.nonZero(-8, 8), c = g.int(1, 90); return make(`${poly(1, b, 0)} = ${c}`, 1, b, -c); }], // x²+2x=69
    [3, (g) => {
      const a1 = g.int(1, 5), a2 = g.int(1, 4), b1 = g.nonZero(-9, 9), b2 = g.nonZero(-9, 9);
      if (a1 * a2 < 2) return null;
      const A2 = a1 * a2, B = a1 * b2 + a2 * b1, C = b1 * b2;
      return make(poly(A2, B, C) + ' = 0', A2, B, C);
    }],
    [2, (g) => { // 移項が必要
      const p = g.nonZero(-8, 8), q = g.nonZero(-8, 8), d = g.nonZero(-6, 6), e = g.nonZero(-12, 12);
      const S = -(p + q), P = p * q;
      return make(`${poly(1, S + d, P + e)} = ${poly(0, d, e)}`, 1, S, P);
    }],
    [2, (g) => { const a = g.int(1, 3), b = g.nonZero(-9, 9), c = g.nonZero(-9, 9); return make(poly(a, b, c) + ' = 0', a, b, c); }],
    [1, (g) => { const p = g.nonZero(-7, 7), k = g.int(2, 30); return make(`(${lin(p)})² = ${k}`, 1, 2 * p, p * p - k); }],
  ];

  /* ---- Lv3 入試（高レベル）---- */
  const L3 = [
    [3, (g) => { const a = g.int(2, 6), b = g.nonZero(-20, 20), c = g.nonZero(-15, 15); return make(poly(a, b, c) + ' = 0', a, b, c); }],
    [2, (g) => { // 置き換え (x+p)²+q(x+p)+r=0
      const p = g.nonZero(-6, 6), u = g.nonZero(-9, 9), v = g.nonZero(-9, 9);
      const q = -(u + v), r = u * v;
      const qpart = q === 0 ? '' : ` ${q < 0 ? '−' : '+'} ${Math.abs(q) === 1 ? '' : Math.abs(q)}(${lin(p)})`;
      return make(`(${lin(p)})²${qpart} ${r < 0 ? '−' : '+'} ${Math.abs(r)} = 0`, 1, 2 * p + q, p * p + p * q + r);
    }],
    [2, (g) => { const a = g.nonZero(-9, 9), b = g.nonZero(-9, 9), c = g.int(1, 40); return make(`(${lin(a)})(${lin(b)}) = ${c}`, 1, a + b, a * b - c); }],
    [1.5, (g) => { // 分数方程式 x + k/x = s
      const u = g.nonZero(-9, 9), v = g.nonZero(-9, 9), s = u + v, k = u * v;
      return make(`x ${k < 0 ? '−' : '+'} ${fr(Math.abs(k), 'x')} = ${s}`, 1, -s, k);
    }],
    [1, (g) => { // 解と係数の関係
      const b = g.nonZero(-9, 9), c = g.nonZero(-9, 9);
      if (b * b - 4 * c <= 0) return null;
      return g.chance(0.5)
        ? single(`${sent('x² ' + (b < 0 ? '−' : '+') + ' ' + Math.abs(b) + 'x ' + (c < 0 ? '−' : '+') + ' ' + Math.abs(c) + ' = 0 の2つの解を α, β とするとき、α² + β² の値は？')}`, b * b - 2 * c)
        : single(`${sent('x² ' + (b < 0 ? '−' : '+') + ' ' + Math.abs(b) + 'x ' + (c < 0 ? '−' : '+') + ' ' + Math.abs(c) + ' = 0 の2つの解を α, β とするとき、(α − β)² の値は？')}`, b * b - 4 * c);
    }],
    [1, (g) => { // 解から係数
      const p = g.nonZero(-9, 9), q = g.nonZero(-9, 9);
      return single(sent(`x² + ax + b = 0 の2つの解が ${m(p)}, ${m(q)} のとき、a + b の値は？`), -(p + q) + p * q);
    }],
    [1, (g) => { // 文章題（正の解）
      const mm = g.int(3, 15), k = g.int(1, mm - 1);
      return single(sent(`正の数 x を2乗した数から x の ${k} 倍を引くと ${mm * (mm - k)} になる。x の値は？`), mm);
    }],
  ];

  const TABLES = { 1: L1, 2: L2, 3: L3 };
  function generate(level, rng) {
    for (let t = 0; t < 50; t++) {
      const p = rng.weighted(TABLES[level])(rng);
      if (p) return p;
    }
    throw new Error('quadratic: generate failed');
  }
  function check(input, d) {
    try { return A.sameSet(A.parseSet(input), d.r); } catch (e) { return false; }
  }

  A.registerUnit({
    id: 'quad',
    name: '二次方程式',
    icon: 'x²',
    levels: ['基礎', '工夫', '入試'],
    hint: '解が2つのときは「,」で区切る（例 −3,2）。√ と ± も使える（例 −1±√70）。',
    // 専用テンキー: 1キー = {k:表示/入力, act:特殊動作, w:横幅, cls:色}
    keypad: [
      [{ k: '7' }, { k: '8' }, { k: '9' }, { k: '⌫', act: 'back', cls: 'fn' }],
      [{ k: '4' }, { k: '5' }, { k: '6' }, { k: 'AC', act: 'clear', cls: 'fn' }],
      [{ k: '1' }, { k: '2' }, { k: '3' }, { k: '−', cls: 'op' }],
      [{ k: '0' }, { k: ',', cls: 'op' }, { k: '±', cls: 'op' }, { k: '√', cls: 'op' }],
      [{ k: '(', cls: 'op' }, { k: ')', cls: 'op' }, { k: '/', cls: 'op' }, { k: '決定', act: 'enter', cls: 'go' }],
    ],
    generate,
    check,
  });
})();
