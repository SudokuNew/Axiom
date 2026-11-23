# AI_GUIDE — Axiom を改良する AI / 開発者向け説明書

このファイルと、直したいファイルを渡されたら、この説明に従って変更してください。
Axiom は **ビルド不要の静的 PWA**（HTML + CSS + 素の JavaScript）です。外部ライブラリ・CDN・npm は使いません（オフライン動作のため）。

## 目的

中学3年生が、中学数学の基礎計算を**毎日ひたすら解いて速くする**。ボタン1つで開始、自動丸つけ、単元別、週ごとに難度上昇。
難度の基準：公文式のような反復型、偏差値60前後〜入試レベル。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面（home / quiz / result / settings の4つの section） |
| `style.css` | 見た目。色は `:root` の変数 |
| `js/core.js` | 共通部品：乱数 `makeRng`、分数 `F`、解答パーサ `parseSet`、レベル判定 `levelFor`、保存 `load/save`、出題生成 `buildSession`、単元登録 `registerUnit` |
| `js/app.js` | 画面の動き（ホーム・演習・採点・設定）。単元の中身は知らない |
| `js/units/*.js` | **単元ごとに1ファイル**。問題生成・採点・テンキー配列を持つ |
| `sw.js` | オフライン用 Service Worker。**ファイルを変えたら `VERSION` を上げる** |
| `tests/test.js` | 自動テスト。`node tests/test.js` |

## 新しい単元の追加手順

1. `js/units/foo.js` を作り、`Axiom.registerUnit({...})` を呼ぶ（`quadratic.js` が見本）。
2. `index.html` の `<script src="js/units/foo.js">` を `app.js` の前に追加。
3. `sw.js` の `FILES` にパスを追加し、`VERSION` を上げる。
4. `tests/test.js` の読み込みリストに追加し、`node tests/test.js` が全部成功することを確認。

単元オブジェクトの契約：

```js
{
  id: 'foo',                 // 保存データのキー。一度決めたら変えない
  name: '単元名', icon: 'x²', // ホームのカード表示
  levels: ['基礎','工夫','入試'],
  hint: '最初の3問だけ出す入力のヒント',
  keypad: [ [ {k:'7'}, ... ], ... ],   // 行の配列。キー: {k:表示かつ入力文字, act:'back'|'clear'|'enter', cls:'op'|'fn'|'go', w:横幅の列数(全4列)}
  generate(level, rng) → { q:'問題のHTML', a:'模範解答の文字列', d:採点用データ(JSONにできるもの) },
  check(inputString, d) → boolean
}
```

- `level` は 1 / 2 / 3。`rng` は `core.js` の乱数（`rng.int(lo,hi)` `rng.pick(arr)` `rng.nonZero` `rng.weighted` `rng.chance`）。**`Math.random()` は使わない**（同じ種で同じ問題を再現するため）。
- `generate` は条件に合わなければ `null` を返してよい（呼び出し側が引き直す）。
- 採点は「入力を数値に直して `d` と比較」する。文字列の完全一致にしない。
- `q` は HTML。分数は `<span class="fr"><span>分子</span><span>分母</span></span>`、上付きは `<sup>`。
- マイナス記号は表示・入力とも `−`（U+2212）。`parseSet` は `-` `ー` も受け付ける。
- 問題の重複は `buildSession` が `q` で除外する。

## 難易度の調整

二次方程式は `quadratic.js` 先頭の `L1 / L2 / L3` 表（`[重み, 生成関数]` の配列）に生成関数を足す／重みを変えるだけ。
分数は `fractions.js` の `CFG`（項数・分母の大きさ・負の数・2乗の割合）。
週ごとのレベル進行は `core.js` の `levelFor`（現在：初回から7日ごとに Lv1→2→3）。

## 守ること

- 解答は**必ず検算可能**にする：生成した問題の模範解答が、自分の `check` で正解になること（`tests/test.js` が全単元・全レベルで400問ずつ検査する）。新単元でもこのテストが通ること。
- 入試レベルは**オリジナル問題**にする。過去問・問題集の文章をそのまま入れない（著作権）。
- 保存データ `localStorage['axiom.v1']` の形式を変えるときは、既存データを壊さない（バージョン `v` を上げて移行処理を書く）。
- スマホ（iPhone・縦画面）を最優先。テンキーは `pointerdown` で反応させる（速さのため）。
- 変更したら：`node tests/test.js` → ブラウザで通しで動作確認 → `sw.js` の `VERSION` を上げる。

## 今後の候補

単元の追加（範囲はユーザーが後日指定）、弱点の復習モード、単元ごとの記録グラフ、制限時間モード、解説表示。
