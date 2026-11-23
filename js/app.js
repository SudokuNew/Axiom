/* Axiom app: 画面遷移・演習の進行・テンキー・記録。
 * 単元の中身は js/units/*.js、共通の道具は js/core.js にある。ここは「画面」だけを担当する。 */
(function () {
  const A = globalThis.Axiom;
  const $ = (id) => document.getElementById(id);
  let state = A.load();
  let session = null; // 進行中の演習 {unit, level, items, answers, idx, t0, elapsed, seed}
  let input = '';
  let timer = null;

  /* ---------- 小物 ---------- */
  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const plain = (h) => String(h).replace(/<[^>]+>/g, '');
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    const el = $(id); if (el) el.scrollTop = 0;
  }
  const persist = () => A.save(state);
  const unitState = (id) => (state.units[id] = state.units[id] || { start: null, history: [] });
  const todayRecs = (id) => unitState(id).history.filter((h) => h.date === A.todayStr());

  /* ---------- ホーム ---------- */
  function streak() {
    const days = new Set();
    for (const id in state.units) state.units[id].history.forEach((h) => days.add(h.date));
    let n = 0, d = new Date();
    if (!days.has(A.todayStr())) d.setDate(d.getDate() - 1); // 今日まだなら昨日から数える
    for (;;) {
      const s = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!days.has(s)) break;
      n++; d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function nextUnit() { // まだ今日やっていない最初の単元（全部終わっていたら先頭）
    return A.unitOrder.find((id) => !todayRecs(id).length) || A.unitOrder[0];
  }
  function renderHome() {
    const t = new Date(), wd = '日月火水木金土'[t.getDay()];
    $('home-date').textContent = `${t.getMonth() + 1}月${t.getDate()}日（${wd}）`;
    $('streak-n').textContent = streak();
    const doneAll = A.unitOrder.every((id) => todayRecs(id).length);
    const nid = nextUnit(), nu = A.units[nid];
    const lv = A.levelFor(state, nid, A.todayStr());
    $('home-title').textContent = doneAll ? '今日は全部おわり！' : '今日の演習';
    $('home-sub').textContent = doneAll ? 'もう一度やって、さらに力をつけよう' : `${nu.name} ・ Lv${lv} ${nu.levels[lv - 1]}`;
    $('start-label').textContent = session ? 'つづきから' : doneAll ? 'もう1セット' : 'はじめる';
    $('start-meta').textContent = session ? `${A.units[session.unit].name} ${session.done + 1}/${session.items.length}問目` : `${state.settings.count}問`;
    $('unit-list').innerHTML = A.unitOrder.map((id) => {
      const u = A.units[id], l = A.levelFor(state, id, A.todayStr()), r = todayRecs(id);
      const last = r[r.length - 1];
      const info = last ? `<span class="done">✓ 今日 ${last.correct}/${last.total}</span>` : '今日はまだ';
      return `<button class="unit" data-id="${id}"><span class="ic">${u.icon}</span><span class="tx"><b>${u.name}</b><small>${info}</small></span><span class="lv l${l}">Lv${l} ${u.levels[l - 1]}</span></button>`;
    }).join('');
    document.querySelectorAll('.unit').forEach((b) => (b.onclick = () => startUnit(b.dataset.id)));
  }

  /* ---------- 背景の図形と正解の演出（見た目だけ。採点には関係しない） ---------- */
  let okCount = 0, combo = 0;
  const SVGNS = 'http://www.w3.org/2000/svg';
  // {n/k} の星型多角形の path。n=頂点数, k=飛ばす数, R=半径, rot=回転(度)
  function star(n, k, R, rot) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = ((i * k * 360) / n + rot - 90) * (Math.PI / 180);
      pts.push((R * Math.cos(a)).toFixed(2) + ',' + (R * Math.sin(a)).toFixed(2));
    }
    return 'M' + pts.join('L') + 'Z';
  }
  function ensureBg() {
    const quiz = $('quiz');
    if (quiz.querySelector('.qbg')) return;
    const circle = (r, cx, cy) => `<circle r="${r}" cx="${cx || 0}" cy="${cy || 0}"/>`;
    const petals = Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      return circle(22, (44 * Math.cos(a)).toFixed(2), (44 * Math.sin(a)).toFixed(2));
    }).join('');
    const ticks = Array.from({ length: 72 }, (_, i) => `<path d="M0,-${i % 6 === 0 ? 93 : 96}V-99" transform="rotate(${i * 5})"/>`).join('');
    const dots = Array.from({ length: 24 }, (_, i) => {
      const a = (i * 15 * Math.PI) / 180;
      return circle(i % 2 ? 0.9 : 1.5, (78 * Math.cos(a)).toFixed(2), (78 * Math.sin(a)).toFixed(2));
    }).join('');
    const div = document.createElement('div');
    div.className = 'qbg';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = `<svg viewBox="-100 -100 200 200" xmlns="${SVGNS}">
      <defs><linearGradient id="qbg-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4f6bff"/><stop offset=".55" stop-color="#7a5cff"/><stop offset="1" stop-color="#22c1c3"/></linearGradient></defs>
      <g class="l1" stroke="url(#qbg-grad)">
        <path d="${star(12, 5, 90, 0)}"/><path d="${star(12, 5, 90, 15)}" opacity=".5"/>
        <path d="${star(8, 3, 68, 0)}"/><path d="${star(6, 2, 46, 0)}"/><path d="${star(6, 2, 46, 30)}" opacity=".6"/>
        ${circle(90)}${circle(68)}${circle(46)}${circle(24)}<g opacity=".55">${petals}</g>
      </g>
      <g class="l2" stroke="url(#qbg-grad)">
        <path d="${star(10, 3, 84, 0)}"/><path d="${star(5, 2, 60, 18)}"/><path d="${star(9, 4, 38, 0)}" opacity=".7"/>
        ${circle(98)}${circle(80)}<g opacity=".8">${ticks}</g><g class="dots">${dots}</g>
      </g></svg>`;
    quiz.insertBefore(div, quiz.firstChild);
  }
  // 正解数が増えるほど、また連続で正解するほど明るくなる
  function setGlow() {
    const total = session ? session.items.length : 1;
    const g = 0.2 + 0.65 * Math.min(1, okCount / (total * 0.8)) + Math.min(0.15, combo * 0.015);
    $('quiz').style.setProperty('--glow', Math.min(1, g).toFixed(3));
  }
  function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function celebrate() {
    const body = document.querySelector('.qbody'), ans = $('q-answer');
    replay(ans, 'hit'); replay($('q-text'), 'shine'); replay(document.querySelector('.qbg'), 'pulse');
    const b = body.getBoundingClientRect(), r = ans.getBoundingClientRect();
    const cx = r.left - b.left + r.width / 2, cy = r.top - b.top + r.height / 2;
    const cols = ['#ffb629', '#22c1c3', '#4f6bff', '#19b36b'];
    if (body.querySelectorAll('.spark').length < 24) {
      for (let i = 0; i < 8; i++) {
        const s = document.createElement('i'), ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.4, d = 44 + Math.random() * 28;
        s.className = 'spark';
        s.style.cssText = `left:${cx}px;top:${cy}px;--dx:${(Math.cos(ang) * d * 1.7).toFixed(1)}px;--dy:${(Math.sin(ang) * d).toFixed(1)}px;background:${cols[i % 4]}`;
        s.addEventListener('animationend', () => s.remove());
        body.appendChild(s);
      }
    }
    if (combo > 0 && combo % 10 === 0) {
      const c = document.createElement('div');
      c.className = 'combo'; c.textContent = combo + ' 連続！';
      c.addEventListener('animationend', () => c.remove());
      body.appendChild(c);
    }
  }

  // まちがえたとき：控えめに揺れて「もう一度」と出す（正解の演出より静か）
  function nudge() {
    replay($('q-answer'), 'miss');
    const body = document.querySelector('.qbody');
    body.querySelectorAll('.combo').forEach((n) => n.remove());
    const c = document.createElement('div');
    c.className = 'combo again'; c.textContent = 'もう一度';
    c.addEventListener('animationend', () => c.remove());
    body.appendChild(c);
  }

  /* ---------- 演習の開始・再開 ---------- */
  function startUnit(id) {
    if (session && session.unit !== id && !confirm('途中の演習があります。やり直しますか？')) return resume();
    if (session && session.unit === id) return resume();
    const us = unitState(id);
    if (!us.start) us.start = A.todayStr();
    const level = A.levelFor(state, id, A.todayStr());
    const n = us.history.filter((h) => h.date === A.todayStr()).length;
    const seed = `${A.todayStr()}|${id}|${level}|${n}`;
    const items = A.buildSession(id, level, state.settings.count, seed);
    // order: 出す順番 / pos: いま何番目か / done: 正解できた数 / tries: 解答ボタンを押した回数
    // miss: 問題番号→まちがえた回数 / first: 問題番号→はじめのまちがった答え
    session = { unit: id, level, items, order: items.map((_, i) => i), pos: 0, done: 0, tries: 0, miss: {}, first: {}, elapsed: 0, seed };
    persist2();
    openQuiz();
  }
  function persist2() { state.session = session; persist(); }
  function resume() { openQuiz(); }
  function openQuiz() {
    input = '';
    buildKeypad();
    ensureBg();
    document.querySelectorAll('.spark, .combo').forEach((n) => n.remove()); // 前回の演出の残りを消す
    // 再開のときも、ここまでの正解数から背景の明るさを復元する
    okCount = session.done; combo = 0;
    setGlow();
    show('quiz');
    session.tStart = Date.now() - session.elapsed * 1000;
    clearInterval(timer);
    timer = setInterval(tick, 500);
    renderQ();
  }
  function tick() {
    if (!session) return;
    session.elapsed = (Date.now() - session.tStart) / 1000;
    $('q-time').textContent = fmtTime(session.elapsed);
  }

  /* ---------- 出題画面 ---------- */
  function renderQ() {
    const u = A.units[session.unit], i = session.order[session.pos], it = session.items[i];
    const misses = session.miss[i] || 0;
    $('q-unit').textContent = `${u.name} ・ Lv${session.level} ${u.levels[session.level - 1]}` + (misses ? ' ・ やり直し' : '');
    $('q-now').textContent = Math.min(session.done + 1, session.items.length);
    $('q-total').textContent = session.items.length;
    $('bar-fill').style.width = (session.done / session.items.length) * 100 + '%';
    $('q-text').innerHTML = it.q;
    // 2回まちがえた問題は、答えを見せる（それを打って正解にする）。出しっぱなしで詰まらないように
    $('q-hint').textContent = misses >= 2 ? `答え：${it.a}` : session.pos < 3 ? u.hint : '';
    setInput('');
  }
  function setInput(v) { input = v; $('q-input').textContent = v; }
  function press(k) {
    if (k.act === 'back') return setInput(input.slice(0, -1));
    if (k.act === 'clear') return setInput('');
    if (k.act === 'enter') return submit();
    if (input.length < 24) setInput(input + k.k);
  }
  function buildKeypad() {
    const u = A.units[session.unit];
    const pad = $('keypad');
    pad.innerHTML = '';
    pad.dataset.unit = u.id;
    u.keypad.forEach((row) => {
      const r = document.createElement('div'); r.className = 'krow';
      row.forEach((k) => {
        const b = document.createElement('button');
        b.className = 'key ' + (k.cls || ''); b.textContent = k.k; b.type = 'button';
        if (k.w) b.style.gridColumn = 'span ' + k.w;
        // 指を置いた瞬間に反応させる（click より速い）
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(k); });
        r.appendChild(b);
      });
      pad.appendChild(r);
    });
  }
  function submit() {
    const i = session.order[session.pos], it = session.items[i];
    const ok = !!input && A.units[session.unit].check(input, it.d); // 空のまま決定＝パス（不正解）
    session.tries = (session.tries || 0) + 1;
    if (ok) {
      session.done++; session.pos++; okCount = session.done; combo++;
      if (session.pos >= session.order.length) return finish();
      setGlow();
      celebrate(); // 一発で正解でも、やり直して正解でも、同じ演出
    } else {
      session.miss[i] = (session.miss[i] || 0) + 1;
      if (!(i in session.first)) session.first[i] = input;
      combo = 0;
      // 次へは進まない。その場で同じ問題を、正解するまで解き直す
      setGlow();
      nudge();
    }
    persist2();
    renderQ();
  }

  /* ---------- 終了・採点 ---------- */
  function finish() {
    clearInterval(timer);
    document.querySelectorAll('.spark, .combo').forEach((n) => n.remove());
    tick();
    const s = session, u = A.units[s.unit];
    // 最後はぜんぶ正解している。成績は「一発で正解できた数」で数え、まちがえた問題は見直し用に残す
    const wrong = [];
    s.items.forEach((it, i) => {
      if (s.miss[i]) wrong.push({ q: it.q, you: s.first[i], a: it.a, n: s.miss[i] });
    });
    const total = s.items.length, correct = total - wrong.length, sec = Math.round(s.elapsed);
    const us = unitState(s.unit);
    us.history.push({ date: A.todayStr(), level: s.level, total, correct, sec, tries: s.tries || s.order.length });
    if (us.history.length > 400) us.history.splice(0, us.history.length - 400);
    state.session = null; session = null;
    persist();
    renderResult(u, { level: s.level, total, correct, sec, wrong });
    show('result');
    lastUnit = s.unit;
  }
  let lastUnit = null;
  function renderResult(u, r) {
    const rate = Math.round((r.correct / r.total) * 100);
    $('r-unit').textContent = `${u.name} ・ Lv${r.level} ${u.levels[r.level - 1]}`;
    $('r-correct').textContent = r.correct;
    $('r-total').textContent = r.total;
    $('r-rate').textContent = `一発正解 ${rate}%`;
    $('r-time').textContent = fmtTime(r.sec);
    $('r-per').textContent = (r.sec / r.total).toFixed(1) + '秒';
    $('r-msg').textContent = rate === 100 ? 'パーフェクト！すべて一発で正解' : rate >= 90 ? 'すばらしい！まちがいを見直そう' : rate >= 70 ? 'いい調子。まちがいを見直そう' : 'ここからが伸びどころ。見直して、もう一度';
    $('r-wrong-title').style.display = '';
    $('r-wrong').innerHTML = r.wrong.length
      ? r.wrong.map((w) => `<li><div class="q">${w.q}</div><div>はじめの答え：<span class="ya">${w.you ? plain(w.you) : '（無回答）'}</span>（${w.n}回まちがえた）</div><div>正解：<span class="ca">${w.a}</span></div></li>`).join('')
      : '<li class="none">全問、一発で正解！</li>';
  }

  /* ---------- 設定 ---------- */
  function renderSettings() {
    const cnt = [50, 100, 150, 200, 300];
    $('set-count').innerHTML = cnt.map((n) => `<button data-n="${n}" class="${state.settings.count === n ? 'on' : ''}">${n}問</button>`).join('');
    $('set-count').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.settings.count = Number(b.dataset.n); persist(); renderSettings(); }));
    const lvs = [['auto', '自動'], ['1', 'Lv1 基礎'], ['2', 'Lv2 工夫'], ['3', 'Lv3 入試']];
    $('set-level').innerHTML = lvs.map(([v, t]) => `<button data-v="${v}" class="${String(state.settings.level) === v ? 'on' : ''}">${t}</button>`).join('');
    $('set-level').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.settings.level = b.dataset.v; persist(); renderSettings(); }));
    $('set-starts').innerHTML = A.unitOrder.map((id) => {
      const us = unitState(id);
      return `<div class="start-row"><span>${A.units[id].name}</span><input type="date" data-id="${id}" value="${us.start || ''}"></div>`;
    }).join('');
    $('set-starts').querySelectorAll('input').forEach((i) => (i.onchange = () => { unitState(i.dataset.id).start = i.value || null; persist(); toast('保存しました'); }));
  }

  /* ---------- イベント ---------- */
  $('btn-start').onclick = () => (session ? resume() : startUnit(nextUnit()));
  $('btn-settings').onclick = () => { renderSettings(); show('settings'); };
  $('btn-settings-close').onclick = () => { renderHome(); show('home'); };
  $('btn-home').onclick = () => { renderHome(); show('home'); };
  $('btn-again').onclick = () => startUnit(lastUnit || nextUnit());
  $('btn-quit').onclick = () => {
    if (!confirm('ここで中断します。つづきは、あとでできます。')) return;
    clearInterval(timer); tick(); persist2(); renderHome(); show('home');
  };
  $('btn-export').onclick = async () => {
    const txt = JSON.stringify(state);
    $('backup-text').value = txt;
    try { await navigator.clipboard.writeText(txt); $('backup-msg').textContent = 'コピーしました。メモなどに貼って保管してください。'; }
    catch (e) { $('backup-text').select(); $('backup-msg').textContent = '下の文字をコピーして保管してください。'; }
  };
  $('btn-import').onclick = () => {
    try {
      const s = JSON.parse($('backup-text').value);
      if (!s || s.v !== 1 || typeof s.units !== 'object') throw new Error('bad');
      state = Object.assign(A.defaultState(), s); session = null; state.session = null; persist();
      $('backup-msg').textContent = '読み込みました。'; renderSettings();
    } catch (e) { $('backup-msg').textContent = '読み込めませんでした。書き出した文字をそのまま貼ってください。'; }
  };
  $('btn-reload').onclick = async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* 非対応なら普通に再読込 */ }
    location.reload();
  };

  // Windows のキーボード操作（テンキーと同じ動き）
  const KEYMAP = { Enter: { act: 'enter' }, Backspace: { act: 'back' }, Delete: { act: 'clear' }, Escape: { act: 'clear' },
    '-': { k: '−' }, '+': { k: '+' }, ',': { k: ',' }, '/': { k: '/' }, '(': { k: '(' }, ')': { k: ')' }, r: { k: '√' }, p: { k: '±' } };
  document.addEventListener('keydown', (e) => {
    if (!$('quiz').classList.contains('active') || !session || e.ctrlKey || e.metaKey) return;
    let k = null;
    if (/^[0-9]$/.test(e.key)) k = { k: e.key };
    else if (KEYMAP[e.key]) k = KEYMAP[e.key];
    if (!k) return;
    // その単元のテンキーにないキーは無視
    const u = A.units[session.unit];
    if (k.k && !u.keypad.some((row) => row.some((x) => x.k === k.k))) return;
    e.preventDefault(); press(k);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && session) { tick(); persist2(); } });

  /* ---------- 起動 ---------- */
  if (state.session && state.session.order && state.session.unit in A.units) {
    session = state.session; // 前回の途中から再開できる
  } else if (state.session) {
    state.session = null; persist(); // 古い形式（v0.2 まで）の途中データは破棄する
  }
  renderHome();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
