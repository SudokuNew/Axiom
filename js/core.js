/* Axiom core: 乱数・分数・解答パーサ・保存・週レベル判定
 * 単元ファイルが共通で使う道具箱。ここは普段いじらなくてよい。 */
(function () {
  const A = (globalThis.Axiom = globalThis.Axiom || {});
  A.units = A.units || {};
  A.unitOrder = A.unitOrder || [];
  A.registerUnit = function (u) {
    A.units[u.id] = u;
    if (!A.unitOrder.includes(u.id)) A.unitOrder.push(u.id);
  };

  /* ---------- 乱数（同じ種なら同じ問題が出る） ---------- */
  function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  A.makeRng = function (seedStr) {
    let a = hashStr(String(seedStr));
    const next = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rng = {
      next,
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      nonZero: (lo, hi) => { let v; do { v = rng.int(lo, hi); } while (v === 0); return v; },
      // [[重み, 関数], ...] から重み付きで選ぶ
      weighted: (table) => {
        const total = table.reduce((s, t) => s + t[0], 0);
        let x = next() * total;
        for (const t of table) { x -= t[0]; if (x < 0) return t[1]; }
        return table[table.length - 1][1];
      },
    };
    return rng;
  };

  /* ---------- 数学の小道具 ---------- */
  A.gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
  A.isSquare = (n) => n >= 0 && Number.isInteger(Math.sqrt(n));
  // n = k^2 * r （rは平方因子なし）
  A.simplifySqrt = (n) => {
    let k = 1, r = n;
    for (let f = 2; f * f <= r; f++) while (r % (f * f) === 0) { r /= f * f; k *= f; }
    return { k, r };
  };
  A.minus = (n) => String(n).replace('-', '−'); // 表示用のマイナス

  /* ---------- 分数 {n,d} ---------- */
  const F = (A.F = {
    make(n, d = 1) {
      if (d === 0) throw new Error('div0');
      if (d < 0) { n = -n; d = -d; }
      const g = A.gcd(n, d) || 1;
      return { n: n / g, d: d / g };
    },
    add: (x, y) => F.make(x.n * y.d + y.n * x.d, x.d * y.d),
    sub: (x, y) => F.make(x.n * y.d - y.n * x.d, x.d * y.d),
    mul: (x, y) => F.make(x.n * y.n, x.d * y.d),
    div: (x, y) => { if (y.n === 0) throw new Error('div0'); return F.make(x.n * y.d, x.d * y.n); },
    eq: (x, y) => x.n === y.n && x.d === y.d,
    val: (x) => x.n / x.d,
    str: (x) => (x.d === 1 ? A.minus(x.n) : (x.n < 0 ? '−' : '') + Math.abs(x.n) + '/' + x.d),
    html(x) {
      const body = x.d === 1 ? String(Math.abs(x.n))
        : `<span class="fr"><span>${Math.abs(x.n)}</span><span>${x.d}</span></span>`;
      return (x.n < 0 ? '−' : '') + body;
    },
  });

  /* ---------- 解答パーサ ----------
   * 入力文字列 → 「値の集合（昇順・重複なし）」。
   * 使える記号: 数字 + − ± × / √ ( ) と区切りの , （小数点は使えない）
   * ± は2つの値に展開する。例 "(1±√5)/2" → [-0.618.., 1.618..] */
  function parseOne(src) {
    const s = src.replace(/\s+/g, '').replace(/[−ー－]/g, '-').replace(/＋/g, '+');
    let i = 0;
    const peek = () => s[i];
    const cross = (a, b, f) => { const o = []; for (const x of a) for (const y of b) o.push(f(x, y)); return o; };
    const isDigit = (c) => c !== undefined && c >= '0' && c <= '9';
    function factor() {
      const c = peek();
      if (c === '(') {
        i++; const v = expr();
        if (peek() !== ')') throw new Error('paren');
        i++; return v;
      }
      if (c === '√') {
        i++;
        return factor().map((x) => { if (x < 0) throw new Error('neg'); return Math.sqrt(x); });
      }
      if (isDigit(c)) {
        let j = i; while (isDigit(s[j])) j++;
        const v = Number(s.slice(i, j)); i = j; return [v];
      }
      throw new Error('syntax');
    }
    function term() {
      let vals = factor();
      for (;;) {
        const c = peek();
        if (c === '/') {
          i++; vals = cross(vals, factor(), (x, y) => { if (y === 0) throw new Error('div0'); return x / y; });
        } else if (c === '*' || c === '×') {
          i++; vals = cross(vals, factor(), (x, y) => x * y);
        } else if (c === '√' || c === '(' || isDigit(c)) {
          vals = cross(vals, factor(), (x, y) => x * y); // 2√3 や 2(…) の省略した掛け算
        } else break;
      }
      return vals;
    }
    function expr() {
      let vals;
      const c0 = peek();
      if (c0 === '-' || c0 === '+' || c0 === '±') {
        i++; const t = term();
        vals = c0 === '-' ? t.map((v) => -v) : c0 === '±' ? t.flatMap((v) => [v, -v]) : t;
      } else vals = term();
      for (;;) {
        const op = peek();
        if (op !== '+' && op !== '-' && op !== '±') break;
        i++; const r = term();
        if (op === '±') vals = vals.flatMap((x) => r.flatMap((y) => [x + y, x - y]));
        else vals = cross(vals, r, op === '+' ? (x, y) => x + y : (x, y) => x - y);
      }
      return vals;
    }
    const out = expr();
    if (i !== s.length) throw new Error('syntax');
    return out;
  }
  A.parseSet = function (src) {
    const parts = String(src).split(/[,、，;]/).filter((p) => p.trim() !== '');
    if (!parts.length) throw new Error('empty');
    let all = [];
    for (const p of parts) all = all.concat(parseOne(p));
    all.sort((a, b) => a - b);
    const out = [];
    for (const v of all) if (!out.length || Math.abs(v - out[out.length - 1]) > 1e-9) out.push(v);
    return out;
  };
  A.sameSet = (a, b) => a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) < 1e-9);

  /* ---------- 日付・週レベル ---------- */
  A.todayStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  A.daysBetween = (a, b) =>
    Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  // 1週目=Lv1(基礎) / 2週目=Lv2(工夫) / 3週目以降=Lv3(入試)。設定で固定も可能。
  A.levelFor = (state, unitId, today) => {
    const ov = state.settings.level;
    if (ov && ov !== 'auto') return Number(ov);
    const u = state.units[unitId];
    const start = u && u.start ? u.start : today;
    return Math.min(3, Math.floor(A.daysBetween(start, today) / 7) + 1);
  };

  /* ---------- 保存（端末内 localStorage） ---------- */
  const KEY = 'axiom.v1';
  A.defaultState = () => ({ v: 1, settings: { count: 100, level: 'auto' }, units: {}, session: null });
  A.load = () => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) {
        const d = A.defaultState();
        s.settings = Object.assign(d.settings, s.settings);
        s.units = s.units || {};
        return s;
      }
    } catch (e) { /* 初回や保存不可 */ }
    return A.defaultState();
  };
  A.save = (state) => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 容量超過など */ } };

  /* ---------- 問題セット生成 ---------- */
  A.buildSession = function (unitId, level, count, seed) {
    const unit = A.units[unitId];
    const rng = A.makeRng(seed);
    const items = [];
    const seen = new Set();
    let guard = 0;
    while (items.length < count && guard++ < count * 30) {
      const p = unit.generate(level, rng);
      if (!p || seen.has(p.q)) continue;
      seen.add(p.q);
      items.push({ q: p.q, a: p.a, d: p.d });
    }
    return items;
  };
})();
