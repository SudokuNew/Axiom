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
    $('start-meta').textContent = session ? `${A.units[session.unit].name} ${session.idx + 1}/${session.items.length}問目` : `${state.settings.count}問`;
    $('unit-list').innerHTML = A.unitOrder.map((id) => {
      const u = A.units[id], l = A.levelFor(state, id, A.todayStr()), r = todayRecs(id);
      const last = r[r.length - 1];
      const info = last ? `<span class="done">✓ 今日 ${last.correct}/${last.total}</span>` : '今日はまだ';
      return `<button class="unit" data-id="${id}"><span class="ic">${u.icon}</span><span class="tx"><b>${u.name}</b><small>${info}</small></span><span class="lv l${l}">Lv${l} ${u.levels[l - 1]}</span></button>`;
    }).join('');
    document.querySelectorAll('.unit').forEach((b) => (b.onclick = () => startUnit(b.dataset.id)));
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
    session = { unit: id, level, items, answers: [], idx: 0, elapsed: 0, seed };
    persist2();
    openQuiz();
  }
  function persist2() { state.session = session; persist(); }
  function resume() { openQuiz(); }
  function openQuiz() {
    input = '';
    buildKeypad();
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
    const u = A.units[session.unit], it = session.items[session.idx];
    $('q-unit').textContent = `${u.name} ・ Lv${session.level} ${u.levels[session.level - 1]}`;
    $('q-now').textContent = session.idx + 1;
    $('q-total').textContent = session.items.length;
    $('bar-fill').style.width = (session.idx / session.items.length) * 100 + '%';
    $('q-text').innerHTML = it.q;
    $('q-hint').textContent = session.idx < 3 ? u.hint : '';
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
    session.answers[session.idx] = input; // 空のまま決定＝パス（不正解）
    session.idx++;
    if (session.idx >= session.items.length) return finish();
    persist2();
    renderQ();
  }

  /* ---------- 終了・採点 ---------- */
  function finish() {
    clearInterval(timer);
    tick();
    const s = session, u = A.units[s.unit];
    const wrong = [];
    let correct = 0;
    s.items.forEach((it, i) => {
      const ans = s.answers[i] || '';
      if (ans && u.check(ans, it.d)) correct++;
      else wrong.push({ q: it.q, you: ans, a: it.a });
    });
    const total = s.items.length, sec = Math.round(s.elapsed);
    const us = unitState(s.unit);
    us.history.push({ date: A.todayStr(), level: s.level, total, correct, sec });
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
    $('r-rate').textContent = `正答率 ${rate}%`;
    $('r-time').textContent = fmtTime(r.sec);
    $('r-per').textContent = (r.sec / r.total).toFixed(1) + '秒';
    $('r-msg').textContent = rate === 100 ? 'パーフェクト！' : rate >= 90 ? 'すばらしい！あと少し' : rate >= 70 ? 'いい調子。まちがいを見直そう' : 'ここからが伸びどころ。見直して、もう一度';
    $('r-wrong-title').style.display = '';
    $('r-wrong').innerHTML = r.wrong.length
      ? r.wrong.map((w) => `<li><div class="q">${w.q}</div><div>あなたの答え：<span class="ya">${w.you ? plain(w.you) : '（無回答）'}</span></div><div>正解：<span class="ca">${w.a}</span></div></li>`).join('')
      : '<li class="none">全問正解！</li>';
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
  if (state.session && state.session.items && state.session.unit in A.units) {
    session = state.session; // 前回の途中から再開できる
  }
  renderHome();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
