// 実行: node tests/test.js   （問題生成・採点・パーサの自動テスト）
const path = require('path');
globalThis.Axiom = {};
['core.js', 'units/quadratic.js', 'units/fractions.js'].forEach((f) => require(path.join('..', 'js', f)));
const A = globalThis.Axiom;

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('NG:', msg); } };

/* --- パーサ --- */
const eqSet = (s, arr) => { try { return A.sameSet(A.parseSet(s), arr.slice().sort((a, b) => a - b)); } catch (e) { return false; } };
const r70 = Math.sqrt(70), r5 = Math.sqrt(5);
ok(eqSet('−1±√70', [-1 + r70, -1 - r70]), '±√');
ok(eqSet('(1±√5)/2', [(1 + r5) / 2, (1 - r5) / 2]), '(a±√b)/c');
ok(eqSet('2√3', [2 * Math.sqrt(3)]), '2√3');
ok(eqSet('±√8/2', [Math.sqrt(8) / 2, -Math.sqrt(8) / 2]), '±√8/2');
ok(eqSet('-3,2', [-3, 2]) && eqSet('2,−3', [-3, 2]) && eqSet('3,3', [3]), '区切りと順序');
ok(eqSet('−1/2', [-0.5]), '負の分数');
ok(!eqSet('1,2', [1]), '個数違いは不正解');
['', 'abc', '√−1', '1/0', '(1', '1+', '√'].forEach((s) => {
  let threw = false; try { A.parseSet(s); } catch (e) { threw = true; }
  ok(threw, '不正入力は例外: ' + JSON.stringify(s));
});

/* --- 各単元・各レベル --- */
const N = 400;
for (const id of A.unitOrder) {
  const u = A.units[id];
  for (const lv of [1, 2, 3]) {
    const items = A.buildSession(id, lv, N, `test|${id}|${lv}`);
    ok(items.length >= N * 0.95, `${id} Lv${lv}: ${items.length}/${N} 問生成`);
    let selfOk = 0, wrongRejected = 0, eqOk = 0, eqN = 0;
    for (const it of items) {
      if (u.check(it.a, it.d)) selfOk++; else console.log('  自答NG', id, lv, it.q, '->', it.a);
      if (!u.check('99999', it.d)) wrongRejected++;
      if (it.d && it.d.e) { // 方程式に解を代入して成り立つか
        eqN++;
        const [a, b, c] = it.d.e;
        if (it.d.r.every((x) => Math.abs(a * x * x + b * x + c) < 1e-6 * (1 + x * x * Math.abs(a)))) eqOk++;
        else console.log('  代入NG', it.q, it.d.r);
      }
    }
    ok(selfOk === items.length, `${id} Lv${lv}: 模範解答が自分の採点で正解 (${selfOk}/${items.length})`);
    ok(wrongRejected === items.length, `${id} Lv${lv}: でたらめ解答は不正解`);
    ok(eqOk === eqN, `${id} Lv${lv}: 解が方程式を満たす (${eqOk}/${eqN})`);
    console.log(`${id} Lv${lv}: 例 → ${items[0].q.replace(/<[^>]+>/g, '')}  答え ${items[0].a}`);
  }
}

/* --- 約分していない分数は不正解 --- */
const fr = A.units.frac;
ok(fr.check('3/4', { n: 3, d: 4 }) && !fr.check('6/8', { n: 3, d: 4 }) && fr.check('-1/2', { n: -1, d: 2 }), '分数の約分チェック');
ok(fr.check('2', { n: 2, d: 1 }) && !fr.check('4/2', { n: 2, d: 1 }), '整数と約分');

/* --- 同じ種なら同じ問題、種が違えば別 --- */
const s1 = A.buildSession('quad', 2, 30, 'x'), s2 = A.buildSession('quad', 2, 30, 'x'), s3 = A.buildSession('quad', 2, 30, 'y');
ok(JSON.stringify(s1) === JSON.stringify(s2), '再現性');
ok(JSON.stringify(s1) !== JSON.stringify(s3), '種が違えば別問題');

/* --- 週レベル --- */
const st = A.defaultState();
st.units.quad = { start: '2026-11-23', history: [] };
ok(A.levelFor(st, 'quad', '2026-11-23') === 1 && A.levelFor(st, 'quad', '2026-11-30') === 2 && A.levelFor(st, 'quad', '2026-12-07') === 3 && A.levelFor(st, 'quad', '2027-03-01') === 3, '週ごとのレベル');
st.settings.level = '2';
ok(A.levelFor(st, 'quad', '2026-11-23') === 2, 'レベル固定');

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
