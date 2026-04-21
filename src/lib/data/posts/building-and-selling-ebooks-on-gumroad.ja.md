---
title: "Gumroadで電子書籍2冊を作って販売するまで — 全工程の記録"
subtitle: "カバー画像の抽出、6商品のAPI自動化、LemonSqueezyではなくGumroadを選んだ理由。"
date: "2026-04-21"
tags: ["Ebook", "Gumroad", "SvelteKit", "GitHub Pages", "Automation", "Side Project"]
summary: "技術書を2冊作りGumroadで販売するまでの全工程を記録した。PDFビルドスクリプト、カバー画像の抽出、Gumroad APIを使った6商品（言語別3商品ずつ）の自動登録、GitHub Pagesとの連携まで。LemonSqueezyのAPIに制限があってGumroadに切り替えた経緯も正直に書いた。"
lang: ja
---

> **TL;DR.** 2冊 × 3言語 = Gumroad商品6点をスクリプト一発で登録。カバー画像はPDF1ページ目から`pdftoppm`で抽出、サンプルPDFはGitHub Pagesでホスティング。LemonSqueezyはUIが良いがファイルアップロードAPIがベータ制限付き — Gumroadのpresign → S3 → completeフローは制限なしで使える。

---

## なぜ電子書籍だったか

書き残すべき知識が2種類あった。

ひとつは **Tauri 2 + AIエージェントループ** でアプリを作る方法。夜の短いセッションでAIエージェントと対話しながら、リクエスト→実装→検証のサイクルを回してアプリを6本完成させたパターン。

もうひとつは **クオンツトレーディングシステムの全体像**。HMMレジーム分類器、SAC RLポジションサイジング、32ペアの統計的裁定取引 — IBKRで実際に稼働中。OOSシャープ比3.716。このような規模のシステムを最初から最後まで解説した本が存在しなかった。

どちらも文章にする価値がある。PDF商品にすれば収入も生まれる。

---

## 書籍紹介

### Vibe Coding Tauri 2

**タグ:** Tauri 2 · Rust · SvelteKit · AIエージェント

AIエージェントのリクエスト→実装→検証ループを使い、Tauri 2デスクトップアプリ4本 + Rust TUIアプリ2本を作成した実践記録。全18章。

- ReadBooks.ai — Claude API + pdfjsを使ったPDF翻訳デスクトップアプリ
- Mandai — Mandalaチャート × GTD × Pomodoroの生産性アプリ
- Rust TUIダッシュボード ×2（Ratatui + Tokio）
- Trading Monitor — IBKR リアルタイムP&L Tauri 2アプリ

「時間がないからこそ、AIエージェントループで6本作れた」というのがこの本の核心。

### Stock Trading AI 実践実装

**タグ:** Python · HMM · SAC RL · IBKR · FastAPI

OOSシャープ比3.716、IBKRで32ペア稼働中。実際に動くクオンツシステムの全アーキテクチャを27章に収録。

- HMMレジーム分類器 → 戦略ルーター
- SAC RLエージェントによるポジションサイジング（エントロピー最大化）
- XGBoost + LightGBM + CatBoost + TFTアンサンブル
- FastAPI + MongoDB（Beanie）+ Redisサービスレイヤー
- IBKR ib-async リアルタイム注文執行 + Rust TUIモニタリング

各章に主要なPythonソースコードを収録。

---

## PDFビルド — Pandoc + LuaLaTeX

原稿はMarkdownで書いた。ビルドはPandoc。

```bash
pandoc \
  --pdf-engine=lualatex \
  --template=template.tex \
  -o output/stock-trading-ai.pdf \
  manuscript/*.md
```

章ごとの`.md`ファイルを順番に結合してPDF一本に出力する。メタデータ（タイトル、著者、言語）は`metadata.yaml`に分離。

言語別にビルドスクリプトを用意した。日本語はフォント処理のため`preamble-ja.tex`を別途作成。

```
build.sh          # 韓国語
build-en.sh       # 英語
build-ja.sh       # 日本語
build-sample.sh   # サンプルPDF（最初の3章）
```

---

## LemonSqueezyではなくGumroadを選んだ理由

最初はLemonSqueezyを使おうとした。UIが洗練されていて、デジタル商品販売に特化しており、100カ国以上のVAT自動処理も魅力だった。

問題が判明した。**LemonSqueezyのファイルアップロードAPIがベータ制限付き**で、一般アカウントでは使えない。6商品にPDFを手動でアップロードするのは持続不可能。

**Gumroad API**にはその制限がない。S3へのpresigned URLを使うファイルアップロードフローが完全に開放されている。

```
GET /v2/products/:id/files/prepare_upload  →  presigned S3 URL取得
PUT [presigned URL]                         →  S3に直接PUT
POST /v2/products/:id/files/complete_multipart  →  アップロード完了処理
```

カバー画像もAPIで登録できる。

```
POST /v2/products/:id/covers  →  { "url": "https://..." }
```

公開URLを渡すとGumroadが取得してくれる。GitHub Pagesにホストしたカバー画像のURLを渡した。

---

## 6商品の自動化構造

2冊 × 3言語 = 6商品。手動管理は破綻する。全部スクリプト化した。

### 商品作成（`create-gumroad-products.mjs`）

```js
const products = [
  { key: 'tauri2_ko', name: 'Vibe Coding Tauri 2 (한국어)', price: 17_00, permalink: 'tauri2-ko' },
  { key: 'tauri2_en', name: 'Vibe Coding Tauri 2 (English)', price: 17_00, permalink: 'tauri2-en' },
  // ...
];

for (const p of products) {
  const res = await fetch('https://api.gumroad.com/v2/products', {
    method: 'POST',
    body: new URLSearchParams({ access_token: TOKEN, name: p.name, price: p.price, custom_permalink: p.permalink })
  });
  const data = await res.json();
  console.log(p.key, data.product.id);  // IDを保存する
}
```

### PDFアップロード（`upload-gumroad-files.mjs`）

3ステップのアップロード：

```js
// 1. presigned URL取得
const { upload_url, key } = await gumroadApi(
  `GET /v2/products/${productId}/files/prepare_upload?filename=book.pdf`
);

// 2. S3に直接アップロード
await fetch(upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf' },
  body: fs.createReadStream(filePath)
});

// 3. 完了処理
await gumroadApi(`POST /v2/products/${productId}/files/complete_multipart`, { key });
```

注意点：`prepare_upload`の`filename`パラメータは必須。省略するとGumroadダッシュボードに「unnamed」ファイルが作られる。

### カバー画像の抽出（`upload-gumroad-covers.mjs`）

カバー画像はPDFの1ページ目から抽出。`pdftoppm`で一発。

```bash
pdftoppm -r 150 -png -f 1 -l 1 book.pdf cover
convert cover-1.png -quality 85 cover.jpg
```

このJPEGを`static/covers/`に置いてGitHub Pagesで公開。そのURLをGumroad APIに渡す。

```js
await fetch(`https://api.gumroad.com/v2/products/${productId}/covers`, {
  method: 'POST',
  body: new URLSearchParams({
    access_token: TOKEN,
    url: `https://tedpark.github.io/covers/${key}-cover.jpg`
  })
});
```

### 説明文の更新（`update-gumroad-descriptions.mjs`）

HTML説明文はJSオブジェクトで管理。変更が必要な場合はオブジェクトを編集してスクリプトを実行するだけ — 6商品が一括更新される。

```js
for (const [key, html] of Object.entries(descriptions)) {
  await gumroadApi(`PUT /v2/products/${PRODUCT_IDS[key]}`, { description: html });
}
```

「Pythonソースコード完全収録」→「Python主要ソースコード収録」への修正も、1行の編集でクオンツ本3商品に即時反映できた。

---

## GitHub Pagesでサンプル配信

サンプルPDF（最初の3章）はGumroad商品に添付せず、GitHub Pagesで直接ホストした。

理由は2つ：
1. Gumroadのサンプルファイルは購入前の公開URLシェアが複雑
2. GitHub Pagesは`static/`にファイルを置いてコミットするだけ

```
static/
  sample/
    tauri2-ko-sample.pdf
    tauri2-en-sample.pdf
    tauri2-ja-sample.pdf
    quant-ko-sample.pdf
    quant-en-sample.pdf
    quant-ja-sample.pdf
```

Gumroad説明文にHTMLで直接リンクを埋め込んだ。

```html
<p>
  <a href="https://tedpark.github.io/sample/quant-ja-sample.pdf">
    📄 サンプルPDF（無料・3章分）
  </a>
</p>
```

---

## 最終構成

```
tedpark.github.io/
├── src/routes/books/+page.svelte   # 販売ページ（KO/EN/JA切り替え付き）
├── static/
│   ├── sample/                     # サンプルPDF 6本
│   └── covers/                     # カバー画像JPEG 6枚
└── scripts/
    ├── create-gumroad-products.mjs
    ├── upload-gumroad-files.mjs
    ├── upload-gumroad-covers.mjs
    └── update-gumroad-descriptions.mjs
```

`/books`ページはSvelteKit製で言語スイッチャー（KO / EN / JA）付き。言語ごとに異なるGumroadリンクと価格（クオンツ本：₩28,000 / $22 / ¥3,200）に対応。

---

## 最終結果

| 商品 | 価格 | 状態 |
|---|---|---|
| Vibe Coding Tauri 2（韓国語） | ₩22,000 | ✅ 販売中 |
| Vibe Coding Tauri 2（English） | $17 | ✅ 販売中 |
| Vibe Coding Tauri 2（日本語） | ¥2,500 | ✅ 販売中 |
| Stock Trading AI（韓国語） | ₩28,000 | ✅ 販売中 |
| Stock Trading AI（English） | $22 | ✅ 販売中 |
| Stock Trading AI 実践実装（日本語） | ¥3,200 | ✅ 販売中 |

---

## 振り返り

**うまくいったこと：**
- GumroadのAPIは安定していた。presign → S3 → completeのフローは正しく実装すれば確実に動く。
- カバー画像とサンプルPDFをGitHub PagesでCDN代わりに使うパターンはシンプルで無料。
- 説明文をコードとして管理することで、後から表現を修正するときに6商品を一括更新できた。

**最初から知っておけばよかったこと：**
- LemonSqueezyのAPI制限 — 事前に確認していれば時間を節約できた。
- `prepare_upload`に`filename`パラメータが必須 — 省略すると「unnamed」ファイルが生成される。
- カバー画像は最初から`pdftoppm`で抽出するのが最速。

両書籍は[こちら](/books)から確認できます。
