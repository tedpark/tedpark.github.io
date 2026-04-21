---
title: "AI로 전자책 2권 만들고 Gumroad에서 파는 법 — 처음부터 끝까지"
subtitle: "커버 추출, 6개 상품 API 자동화, LemonSqueezy 대신 Gumroad를 선택한 이유까지."
date: "2026-04-21"
tags: ["Ebook", "Gumroad", "SvelteKit", "GitHub Pages", "Automation", "Side Project"]
summary: "전자책 두 권을 만들고 Gumroad에 올려서 판매까지 자동화한 과정을 정리했다. PDF 빌드 스크립트, 커버 이미지 추출, Gumroad API로 상품 6개(언어별 3개씩) 자동 등록, GitHub Pages 정적 호스팅 연동까지. LemonSqueezy가 더 유명하지만 API 문제로 Gumroad를 쓴 이유도 솔직하게 썼다."
lang: ko
---

> **TL;DR.** 전자책 2권 × 언어 3개 = Gumroad 상품 6개를 스크립트 한 방에 등록했다.
> 커버 이미지는 PDF 첫 페이지에서 추출, 샘플 PDF는 GitHub Pages에 올려서 링크.
> LemonSqueezy API가 베타 제한이 있어 Gumroad로 전환 — 이게 결과적으로 더 낫다.

---

## 배경 — 왜 전자책이었나

코딩하면서 쌓인 내용이 두 종류였다.

하나는 **Tauri 2 + AI 에이전트 루프**로 앱을 만드는 방법. 저녁 한두 시간씩 AI와 대화하면서 앱 6개를 완성하는 패턴이 잡혔다.

다른 하나는 **퀀트 트레이딩 시스템 전체**. HMM 레짐 분류기, SAC RL 포지션 사이징, 통계적 차익거래 32 페어 — IBKR에서 실제로 돌아가는 시스템. OOS Sharpe 3.716이 나왔고, 이걸 처음부터 끝까지 설명하는 책이 없었다.

둘 다 글로 쓰면 의미가 있겠다 싶었다. PDF로 만들어서 팔면 더 좋고.

---

## 책 소개

### Vibe Coding Tauri 2

**태그:** Tauri 2 · Rust · SvelteKit · AI Agent

AI 에이전트와 반복 루프(요청 → 구현 → 검증)를 사용해서 Tauri 2 데스크톱 앱 4개와 Rust TUI 앱 2개를 만든 기록이다. 총 18챕터.

- ReadBooks.ai — Claude API + pdfjs로 PDF를 번역하는 데스크톱 앱
- Mandai — Mandala Chart × GTD × Pomodoro 생산성 앱
- Rust TUI 대시보드 2종 (Ratatui + Tokio)
- Trading Monitor — IBKR 실시간 P&L 앱

"시간이 없어서 오히려 6개를 만들었다"는 게 이 책의 핵심이다. 코드 한 줄 한 줄 쓰는 대신 AI가 반복 루프를 돌리고, 나는 방향을 잡는다.

### Stock Trading AI 실전 구현

**태그:** Python · HMM · SAC RL · IBKR · FastAPI

OOS Sharpe 3.716, IBKR 라이브 32 페어. 실제 운영 중인 퀀트 시스템의 전체 아키텍처를 27챕터에 담았다.

- HMM 레짐 분류기 → 전략 라우터
- SAC RL 에이전트 포지션 사이징 (엔트로피 최대화)
- XGBoost + LightGBM + CatBoost + TFT 앙상블
- FastAPI + MongoDB (Beanie) + Redis 서비스 레이어
- IBKR ib-async 실시간 주문 실행 + Rust TUI 모니터링

이런 시스템의 전체 그림을 처음부터 끝까지 다루는 한국어 책이 없었다. 핵심 소스코드가 챕터마다 포함된다.

---

## PDF 빌드 — Pandoc + pdflatex

책 원고는 Markdown으로 썼다. 빌드는 Pandoc이다.

```bash
pandoc \
  --pdf-engine=lualatex \
  --template=template.tex \
  -o output/stock-trading-ai.pdf \
  manuscript/*.md
```

챕터별 `.md` 파일들을 순서대로 합쳐서 PDF 하나로 뽑는다. 메타데이터(제목, 저자, 언어)는 `metadata.yaml`에 분리했다.

영어/일본어 버전도 별도 빌드 스크립트가 있다. 일본어는 폰트 처리 때문에 `preamble-ja.tex`를 따로 뒀다.

```
build.sh       # 한국어
build-en.sh    # 영어
build-ja.sh    # 일본어
build-sample.sh  # 샘플 PDF (앞 3챕터)
```

---

## LemonSqueezy 대신 Gumroad를 쓴 이유

처음에는 **LemonSqueezy**를 쓰려고 했다. UI가 예쁘고, 디지털 상품 판매에 특화되어 있고, VAT 처리도 자동이라 좋다는 평이 많았다.

그런데 문제가 생겼다. **LemonSqueezy API가 파일 업로드를 지원하지 않는다.** 정확히는, 파일 업로드 엔드포인트가 있긴 한데 베타 제한이 걸려 있어서 일반 사용자는 쓸 수 없었다. 상품 6개에 PDF를 하나씩 손으로 올리는 건 말이 안 된다.

**Gumroad API**는 달랐다. 파일 presigned URL 방식으로 S3에 직접 업로드한 뒤 상품에 연결하는 흐름이 완전히 열려 있다.

```
GET /v2/products/:id/files/prepare_upload  →  presigned S3 URL 받기
PUT [presigned URL]  →  S3에 직접 PUT
POST /v2/products/:id/files/complete_multipart  →  업로드 완료 처리
```

커버 이미지도 API로 등록할 수 있다.

```
POST /v2/products/:id/covers  →  { "url": "https://..." }
```

공개 URL을 넘기면 Gumroad가 가져간다. GitHub Pages에 올린 커버 이미지 URL을 넘겼다.

---

## 상품 6개 자동 등록 구조

책 2권 × 언어 3개(한국어/영어/일본어) = 상품 6개.

손으로 하나씩 등록하면 실수가 난다. 설명문 업데이트할 때마다 6번 반복하면 금방 지친다. 그래서 처음부터 스크립트로 만들었다.

### 상품 생성 (`create-gumroad-products.mjs`)

```js
const products = [
  { key: 'tauri2_ko', name: 'Vibe Coding Tauri 2 (한국어)', price: 17_00, permalink: 'tauri2-ko' },
  { key: 'tauri2_en', name: 'Vibe Coding Tauri 2 (English)', price: 17_00, permalink: 'tauri2-en' },
  // ...
];

for (const p of products) {
  const res = await fetch('https://api.gumroad.com/v2/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      access_token: TOKEN,
      name: p.name,
      price: p.price,
      custom_permalink: p.permalink,
    })
  });
  const data = await res.json();
  console.log(p.key, data.product.id);  // ID 저장해야 함
}
```

처음 실행하면 각 상품의 ID가 나온다. 이 ID를 나머지 스크립트에서 재사용한다.

### PDF 업로드 (`upload-gumroad-files.mjs`)

Gumroad 파일 업로드는 3단계다.

1. presigned URL 요청
2. S3에 직접 PUT
3. 완료 처리

```js
// 1. presign
const { upload_url, key } = await gumroadApi(
  `GET /v2/products/${productId}/files/prepare_upload?filename=book.pdf`
);

// 2. S3 PUT
await fetch(upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf' },
  body: fs.createReadStream(filePath)
});

// 3. complete
await gumroadApi(`POST /v2/products/${productId}/files/complete_multipart`, { key });
```

파일 이름이 "unnamed"로 나오는 문제가 있었다. `prepare_upload`에 `filename` 파라미터를 제대로 넘겨야 한다. 처음에 이걸 빠뜨려서 Gumroad 대시보드에 "unnamed" 파일이 생겼다.

### 커버 이미지 등록 (`upload-gumroad-covers.mjs`)

커버 이미지는 PDF 첫 페이지에서 추출했다. `pdftoppm` 으로 한 방에 된다.

```bash
pdftoppm -r 150 -png -f 1 -l 1 book.pdf cover
# → cover-1.png 생성
convert cover-1.png -quality 85 cover.jpg
```

이 JPEG를 `static/covers/` 에 넣고 GitHub Pages에 올린다. 그 URL을 Gumroad API에 넘기면 끝.

```js
await fetch(`https://api.gumroad.com/v2/products/${productId}/covers`, {
  method: 'POST',
  body: new URLSearchParams({
    access_token: TOKEN,
    url: `https://tedpark.github.io/covers/${key}-cover.jpg`
  })
});
```

### 설명문 업데이트 (`update-gumroad-descriptions.mjs`)

언어별로 HTML 설명문을 객체로 관리한다. 변경이 필요하면 파일 수정 후 스크립트 한 번 실행하면 6개 모두 반영된다.

```js
const descriptions = {
  tauri2_ko: `<h2>Vibe Coding Tauri 2</h2>...`,
  tauri2_en: `<h2>Vibe Coding Tauri 2</h2>...`,
  // ...
};

for (const [key, html] of Object.entries(descriptions)) {
  await gumroadApi(`PUT /v2/products/${PRODUCT_IDS[key]}`, {
    description: html
  });
}
```

처음에 언어별 설명을 조금씩 다르게 쓰고, 나중에 표현이 마음에 안 들어서 수정했다. "Python 전체 소스코드 포함" → "핵심 Python 소스코드 포함"으로 고치는 작업도 이 스크립트 수정 한 번으로 끝났다.

---

## GitHub Pages + 샘플 PDF 연동

샘플 PDF(앞 3챕터)는 Gumroad에 올리는 대신 GitHub Pages에서 직접 호스팅했다.

이유는 두 가지다:
1. Gumroad 샘플 파일은 구매 전에 URL 공유가 복잡하다
2. GitHub Pages는 그냥 `static/` 폴더에 파일 넣으면 끝

```
static/
  sample/
    tauri2-ko-sample.pdf
    tauri2-en-sample.pdf
    tauri2-ja-sample.pdf
    quant-ko-sample.pdf
    quant-en-sample.pdf
    quant-ja-sample.pdf
  covers/
    tauri2-ko-cover.jpg
    ...
```

Gumroad 설명문에 샘플 링크를 HTML로 포함했다.

```html
<p>
  <a href="https://tedpark.github.io/sample/quant-ko-sample.pdf">
    📄 샘플 PDF 미리보기 (무료)
  </a>
</p>
```

---

## 최종 구조

```
tedpark.github.io/
├── src/
│   └── routes/
│       └── books/+page.svelte   # 책 판매 페이지 (언어 스위처 포함)
├── static/
│   ├── sample/                  # 샘플 PDF 6개
│   └── covers/                  # 커버 이미지 6개
└── scripts/
    ├── create-gumroad-products.mjs
    ├── upload-gumroad-files.mjs
    ├── upload-gumroad-covers.mjs
    └── update-gumroad-descriptions.mjs
```

책 페이지(`/books`)는 SvelteKit으로 만들었다. 언어 스위처(KO / EN / JA)가 있고, 각 언어마다 다른 Gumroad 링크로 연결된다. 가격도 언어별로 다르다(₩28,000 / $22 / ¥3,200).

---

## 최종 결과

| 상품 | 가격 | 상태 |
|---|---|---|
| Vibe Coding Tauri 2 (한국어) | ₩22,000 | ✅ 판매 중 |
| Vibe Coding Tauri 2 (English) | $17 | ✅ 판매 중 |
| Vibe Coding Tauri 2 (日本語) | ¥2,500 | ✅ 판매 중 |
| Stock Trading AI 실전 구현 (한국어) | ₩28,000 | ✅ 판매 중 |
| Stock Trading AI (English) | $22 | ✅ 판매 중 |
| Stock Trading AI 実践実装 (日本語) | ¥3,200 | ✅ 판매 중 |

PDF, 커버 이미지, 설명문 — 6개 모두 자동화 스크립트로 관리된다.

---

## 회고

**잘 된 것들:**
- Gumroad API가 예상보다 잘 되어 있다. presign → S3 → complete 흐름이 안정적이다.
- GitHub Pages를 CDN처럼 쓰는 패턴이 깔끔하다. 커버 이미지, 샘플 PDF 모두 여기에 호스팅.
- 설명문 스크립트 덕분에 나중에 표현을 수정할 때 6개를 한 번에 바꿀 수 있었다.

**처음부터 알았으면 좋았을 것들:**
- LemonSqueezy API 파일 업로드 제한 — 사전에 확인했으면 시간을 아꼈을 것이다.
- Gumroad `prepare_upload`에 `filename` 파라미터 필수 — 빠뜨리면 "unnamed" 파일이 생긴다.
- 커버 이미지는 처음부터 `pdftoppm`으로 추출하는 게 가장 빠르다.

책 페이지와 두 권의 책은 [이쪽](/books)에서 확인할 수 있다.
