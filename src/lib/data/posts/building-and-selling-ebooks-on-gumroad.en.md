---
title: "Building and Selling Two Ebooks on Gumroad — From Zero to 6 Live Products"
subtitle: "Cover extraction, 6-product API automation, and why I chose Gumroad over LemonSqueezy."
date: "2026-04-21"
tags: ["Ebook", "Gumroad", "SvelteKit", "GitHub Pages", "Automation", "Side Project"]
summary: "A step-by-step account of building two technical ebooks, automating 6 Gumroad products (two books × three languages) with Node.js scripts, extracting cover images from PDF first pages with pdftoppm, hosting samples on GitHub Pages, and why LemonSqueezy's API limitations pushed me to Gumroad."
lang: en
---

> **TL;DR.** Two books × three languages = 6 Gumroad products, all registered via API scripts. Cover images extracted from PDF page 1 with `pdftoppm`, sample PDFs hosted on GitHub Pages. LemonSqueezy has a better-looking UI but its file upload API is gated — Gumroad's presign → S3 → complete flow works without restrictions.

---

## Why ebooks

I had two distinct bodies of knowledge that deserved to be written down.

The first: building apps with a **Tauri 2 + AI agent loop**. Working in short evening sessions with an AI agent, repeating a request–implement–verify cycle, I completed six apps.

The second: a **complete quant trading system**. HMM regime classifier, SAC RL position sizing, 32-pair statistical arbitrage — running live on IBKR. OOS Sharpe 3.716. There was no book that walked through this kind of system end to end.

Both were worth writing. Making them PDF products meant they could also generate income.

---

## The books

### Vibe Coding Tauri 2

**Tags:** Tauri 2 · Rust · SvelteKit · AI Agent

A hands-on record of building 4 Tauri 2 desktop apps + 2 Rust TUI apps using an AI agent request–implement–verify loop. 18 chapters.

- ReadBooks.ai — PDF translation app using Claude API + pdfjs
- Mandai — Mandala Chart × GTD × Pomodoro productivity app
- Rust TUI dashboards ×2 (Ratatui + Tokio)
- Trading Monitor — IBKR live P&L Tauri 2 app

The premise: when you have no time, an AI agent loop lets you ship more, not less.

### Stock Trading AI — Practical Implementation

**Tags:** Python · HMM · SAC RL · IBKR · FastAPI

OOS Sharpe 3.716, live on IBKR with 32 pairs. The complete architecture of a running quant system in 27 chapters.

- HMM regime classifier → strategy router
- SAC RL agent for position sizing (maximum entropy)
- XGBoost + LightGBM + CatBoost + TFT ensemble
- FastAPI + MongoDB (Beanie) + Redis service layer
- IBKR ib-async live order execution + Rust TUI monitoring

Core Python source code is included in each chapter.

---

## PDF build — Pandoc + LuaLaTeX

The manuscript is Markdown. Pandoc builds the PDF.

```bash
pandoc \
  --pdf-engine=lualatex \
  --template=template.tex \
  -o output/stock-trading-ai.pdf \
  manuscript/*.md
```

Chapter `.md` files are merged in order into a single PDF. Metadata (title, author, language) lives in `metadata.yaml`.

Separate build scripts handle each language. Japanese required a dedicated `preamble-ja.tex` for font handling.

```
build.sh          # Korean
build-en.sh       # English
build-ja.sh       # Japanese
build-sample.sh   # Sample PDF (first 3 chapters)
```

---

## Why Gumroad instead of LemonSqueezy

LemonSqueezy was the first choice. Better-looking UI, digital product focused, automatic VAT handling for 100+ countries.

The problem: **LemonSqueezy's file upload API is in beta and gated.** The endpoint exists, but regular accounts can't use it. Uploading PDFs to 6 products by hand isn't sustainable.

**Gumroad's API** doesn't have this restriction. File uploads use a presigned URL flow through S3:

```
GET /v2/products/:id/files/prepare_upload  →  presigned S3 URL
PUT [presigned URL]                         →  S3 direct upload
POST /v2/products/:id/files/complete_multipart  →  finalize
```

Cover images are also API-registerable:

```
POST /v2/products/:id/covers  →  { "url": "https://..." }
```

Pass a public URL and Gumroad fetches it. I hosted cover images on GitHub Pages and passed those URLs.

---

## Automating 6 products

Two books × three languages (Korean/English/Japanese) = 6 products. Manual management doesn't scale. Everything became a script.

### Product creation (`create-gumroad-products.mjs`)

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
  console.log(p.key, data.product.id);  // save these IDs
}
```

### PDF upload (`upload-gumroad-files.mjs`)

Three-step upload:

```js
// 1. Get presigned URL
const { upload_url, key } = await gumroadApi(
  `GET /v2/products/${productId}/files/prepare_upload?filename=book.pdf`
);

// 2. Upload directly to S3
await fetch(upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf' },
  body: fs.createReadStream(filePath)
});

// 3. Mark complete
await gumroadApi(`POST /v2/products/${productId}/files/complete_multipart`, { key });
```

Gotcha: the `filename` parameter in `prepare_upload` is required. Omitting it results in an "unnamed" file in the Gumroad dashboard.

### Cover image extraction (`upload-gumroad-covers.mjs`)

Covers come from the first page of each PDF:

```bash
pdftoppm -r 150 -png -f 1 -l 1 book.pdf cover
convert cover-1.png -quality 85 cover.jpg
```

These JPEGs go into `static/covers/` and get pushed to GitHub Pages. The public URL goes to the Gumroad API:

```js
await fetch(`https://api.gumroad.com/v2/products/${productId}/covers`, {
  method: 'POST',
  body: new URLSearchParams({
    access_token: TOKEN,
    url: `https://tedpark.github.io/covers/${key}-cover.jpg`
  })
});
```

### Description updates (`update-gumroad-descriptions.mjs`)

HTML descriptions are managed as JS objects. When wording needs to change, edit the object and re-run the script — all 6 products update at once.

```js
for (const [key, html] of Object.entries(descriptions)) {
  await gumroadApi(`PUT /v2/products/${PRODUCT_IDS[key]}`, { description: html });
}
```

This came in handy immediately. "Full Python source code included" → "Core Python source code included" was a one-line edit that propagated to all three quant products in one run.

---

## Sample PDFs on GitHub Pages

Sample PDFs (first 3 chapters) are hosted on GitHub Pages rather than attached to Gumroad products.

Two reasons:
1. Gumroad sample files are awkward to share publicly before purchase
2. GitHub Pages is `static/` folder → commit → done

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

The Gumroad description includes a direct link:

```html
<p>
  <a href="https://tedpark.github.io/sample/quant-en-sample.pdf">
    📄 Free sample (3 chapters)
  </a>
</p>
```

---

## Final structure

```
tedpark.github.io/
├── src/routes/books/+page.svelte   # sales page with KO/EN/JA switcher
├── static/
│   ├── sample/                     # 6 sample PDFs
│   └── covers/                     # 6 cover JPEGs
└── scripts/
    ├── create-gumroad-products.mjs
    ├── upload-gumroad-files.mjs
    ├── upload-gumroad-covers.mjs
    └── update-gumroad-descriptions.mjs
```

The `/books` page is SvelteKit with a language switcher (KO / EN / JA). Each language has its own Gumroad link and price (₩28,000 / $22 / ¥3,200 for the quant book).

---

## Final state

| Product | Price | Status |
|---|---|---|
| Vibe Coding Tauri 2 (Korean) | ₩22,000 | ✅ Live |
| Vibe Coding Tauri 2 (English) | $17 | ✅ Live |
| Vibe Coding Tauri 2 (Japanese) | ¥2,500 | ✅ Live |
| Stock Trading AI (Korean) | ₩28,000 | ✅ Live |
| Stock Trading AI (English) | $22 | ✅ Live |
| Stock Trading AI (Japanese) | ¥3,200 | ✅ Live |

---

## Retrospective

**What worked well:**
- Gumroad's API is reliable. The presign → S3 → complete flow never failed once correctly wired.
- GitHub Pages as a CDN for cover images and sample PDFs is clean and free.
- Managing descriptions as code means consistent updates across all 6 products with one command.

**What I'd do differently from day one:**
- Check LemonSqueezy's API limitations before building around it.
- Always pass `filename` to `prepare_upload` — the "unnamed file" bug cost time.
- Extract cover images with `pdftoppm` from the start; it's one command.

Both books are available [here](/books).
