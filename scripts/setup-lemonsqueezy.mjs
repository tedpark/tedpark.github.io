#!/usr/bin/env node
/**
 * setup-lemonsqueezy.mjs
 *
 * Lemon Squeezy에 6개 상품을 생성하고 books/+page.svelte URL을 자동으로 업데이트합니다.
 *
 * 사용법:
 *   LS_API_KEY=<your-api-key> LS_STORE_ID=<your-store-id> node scripts/setup-lemonsqueezy.mjs
 *
 * API Key:  https://app.lemonsqueezy.com/settings/api  (Settings → API)
 * Store ID: https://app.lemonsqueezy.com/settings/store (숫자 ID, URL에서 확인 가능)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = join(__dirname, '../src/routes/books/+page.svelte');

// ─── Config ──────────────────────────────────────────────────────────────────
const API_KEY = process.env.LS_API_KEY;
const STORE_ID = process.env.LS_STORE_ID;

if (!API_KEY || !STORE_ID) {
  console.error(`
❌  환경 변수가 설정되지 않았습니다.

사용법:
  LS_API_KEY=<api-key> LS_STORE_ID=<store-id> node scripts/setup-lemonsqueezy.mjs

API Key:  https://app.lemonsqueezy.com/settings/api
Store ID: https://app.lemonsqueezy.com/settings/store (숫자 ID)
`);
  process.exit(1);
}

// ─── Product definitions ──────────────────────────────────────────────────────
const PRODUCTS = [
  {
    key: 'tauri2_ko',
    name: 'Vibe Coding Tauri 2 (한국어)',
    description: 'AI 에이전트와 반복 루프로 저녁 한두 시간만으로 Tauri 2 앱 4개 + TUI 앱 2개를 완성한 실전 기록. 18 챕터 PDF.',
    price_usd_cents: 1700,   // $17.00
    slug: 'vibe-coding-tauri2-ko',
  },
  {
    key: 'tauri2_en',
    name: 'Vibe Coding Tauri 2 (English)',
    description: 'A hands-on record of building 4 Tauri 2 desktop apps + 2 TUI apps in evening sessions using an AI agent loop. 18 chapters PDF.',
    price_usd_cents: 1700,   // $17.00
    slug: 'vibe-coding-tauri2-en',
  },
  {
    key: 'tauri2_ja',
    name: 'Vibe Coding Tauri 2 (日本語)',
    description: 'AIエージェントのループを使い、夜の1〜2時間でTauri 2アプリ4本とTUIアプリ2本を完成させた実践記録。18チャプターPDF。',
    price_usd_cents: 1700,   // $17.00 (~¥2,500)
    slug: 'vibe-coding-tauri2-ja',
  },
  {
    key: 'quant_ko',
    name: 'Stock Trading AI 실전 구현 (한국어)',
    description: 'OOS Sharpe 3.716, IBKR 라이브 32 페어. HMM 레짐 분류기부터 SAC RL 포지션 사이징까지 — 실제 운영 중인 시스템의 전체 아키텍처. 27 챕터 PDF.',
    price_usd_cents: 2200,   // $22.00
    slug: 'stock-trading-ai-ko',
  },
  {
    key: 'quant_en',
    name: 'Stock Trading AI (English)',
    description: 'OOS Sharpe 3.716, live on IBKR with 32 pairs. Complete architecture — HMM regime classifier, SAC RL position sizing, FastAPI, Rust TUI. 27 chapters PDF.',
    price_usd_cents: 2200,   // $22.00
    slug: 'stock-trading-ai-en',
  },
  {
    key: 'quant_ja',
    name: 'Stock Trading AI 実践実装 (日本語)',
    description: 'OOSシャープ比3.716、IBKR本番稼働中32ペア。HMMレジーム分類からSAC RLポジションサイジングまで実際に動くシステムの全アーキテクチャ。27チャプターPDF。',
    price_usd_cents: 2200,   // $22.00 (~¥3,200)
    slug: 'stock-trading-ai-ja',
  },
];

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/vnd.api+json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Create product + variant ─────────────────────────────────────────────────
async function createProduct(product) {
  console.log(`  Creating product: ${product.name} ...`);

  // 1. Create product
  const prodRes = await apiPost('/products', {
    data: {
      type: 'products',
      attributes: {
        name: product.name,
        description: product.description,
        slug: product.slug,
        status: 'published',
      },
      relationships: {
        store: {
          data: { type: 'stores', id: String(STORE_ID) },
        },
      },
    },
  });

  const productId = prodRes.data.id;
  console.log(`    ✓ Product created: ID=${productId}`);

  // 2. Update the default variant's price
  // Fetch variants for this product to get the default variant ID
  await new Promise(r => setTimeout(r, 800)); // brief pause for consistency
  const varRes = await apiGet(`/variants?filter[product_id]=${productId}`);
  const variantId = varRes.data[0]?.id;
  if (!variantId) throw new Error(`No variant found for product ${productId}`);

  // PATCH the variant price
  const patchRes = await fetch(`https://api.lemonsqueezy.com/v1/variants/${variantId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'variants',
        id: String(variantId),
        attributes: {
          price: product.price_usd_cents,
          is_subscription: false,
          pay_what_you_want: false,
        },
      },
    }),
  });
  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.warn(`    ⚠ Could not set price on variant ${variantId}: ${patchRes.status}: ${text}`);
  } else {
    console.log(`    ✓ Price set: $${(product.price_usd_cents / 100).toFixed(2)}`);
  }

  // 3. Get checkout URL — use store's slug-based buy link
  // Store URL format: https://{store-slug}.lemonsqueezy.com/buy/{product-uuid-or-variant-id}
  // The variant ID is the UUID used in checkout URLs
  const varDetails = await apiGet(`/variants/${variantId}`);
  const storeData = await apiGet(`/stores/${STORE_ID}`);
  const storeSlug = storeData.data.attributes.slug;
  const checkoutUrl = `https://${storeSlug}.lemonsqueezy.com/buy/${variantId}`;

  console.log(`    ✓ Checkout URL: ${checkoutUrl}`);
  return { key: product.key, url: checkoutUrl };
}

// ─── Update +page.svelte ──────────────────────────────────────────────────────
function updatePageSvelte(urls) {
  let content = readFileSync(PAGE_PATH, 'utf-8');

  const newLS = `const LS: Record<string, Record<Lang, string>> = {
		tauri2: {
			ko: '${urls.tauri2_ko}',
			en: '${urls.tauri2_en}',
			ja: '${urls.tauri2_ja}'
		},
		quant: {
			ko: '${urls.quant_ko}',
			en: '${urls.quant_en}',
			ja: '${urls.quant_ja}'
		}
	};`;

  // Replace the entire LS object
  content = content.replace(
    /\/\/ ─── Lemon Squeezy product checkout URLs.*?const LS: Record<string, Record<Lang, string>> = \{[\s\S]*?\};/,
    `// ─── Lemon Squeezy product checkout URLs (auto-generated by setup-lemonsqueezy.mjs)\n\t${newLS}`
  );

  writeFileSync(PAGE_PATH, content, 'utf-8');
  console.log(`\n✅  ${PAGE_PATH} 업데이트 완료`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🍋  Lemon Squeezy 상품 생성 시작\n');
  console.log(`   API Key: ${API_KEY.slice(0, 8)}...`);
  console.log(`   Store ID: ${STORE_ID}\n`);

  // Verify credentials
  try {
    const me = await apiGet('/users/me');
    console.log(`   계정 확인: ${me.data.attributes.email}\n`);
  } catch (e) {
    console.error('❌  API 인증 실패. API Key를 확인하세요.');
    console.error(e.message);
    process.exit(1);
  }

  const urls = {};
  for (const product of PRODUCTS) {
    try {
      const result = await createProduct(product);
      urls[result.key] = result.url;
      await new Promise(r => setTimeout(r, 500)); // rate limit 방지
    } catch (e) {
      console.error(`\n❌  ${product.name} 생성 실패:`, e.message);
      process.exit(1);
    }
  }

  console.log('\n─── 생성된 URL 목록 ─────────────────────────────────────────');
  for (const [key, url] of Object.entries(urls)) {
    console.log(`  ${key.padEnd(12)}: ${url}`);
  }

  updatePageSvelte(urls);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  완료! 6개 상품 생성 및 +page.svelte 업데이트 완료.

다음 단계:
  1. npm run build  →  빌드 확인
  2. git add -A && git commit -m "feat: add Lemon Squeezy products"
  3. git push
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
