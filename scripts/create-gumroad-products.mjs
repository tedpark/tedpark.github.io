#!/usr/bin/env node
/**
 * Gumroad 상품 자동 생성 스크립트
 * 
 * 사용법:
 *   export GUMROAD_ACCESS_TOKEN="your_token_here"
 *   node scripts/create-gumroad-products.mjs
 * 
 * 토큰 발급: https://app.gumroad.com/settings/advanced → Generate Access Token
 */

const ACCESS_TOKEN = process.env.GUMROAD_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ GUMROAD_ACCESS_TOKEN 환경변수가 없습니다.');
  console.error('   export GUMROAD_ACCESS_TOKEN="your_token_here"');
  process.exit(1);
}

const PRODUCTS = [
  {
    key: 'tauri2_ko',
    name: 'Vibe Coding Tauri 2 (한국어)',
    description: 'Tauri 2 앱 개발을 AI와 함께 빠르게 완성하는 실전 가이드 (한국어)',
    price: 1700,   // cents → $17.00
    native_type: 'ebook',
    custom_permalink: 'tauri2-ko',
  },
  {
    key: 'tauri2_en',
    name: 'Vibe Coding Tauri 2 (English)',
    description: 'Build Tauri 2 apps fast with AI — a practical hands-on guide (English)',
    price: 1700,
    native_type: 'ebook',
    custom_permalink: 'tauri2-en',
  },
  {
    key: 'tauri2_ja',
    name: 'Vibe Coding Tauri 2 (日本語)',
    description: 'AIと一緒にTauri 2アプリを速く作る実践ガイド (日本語)',
    price: 1700,
    native_type: 'ebook',
    custom_permalink: 'tauri2-ja',
  },
  {
    key: 'quant_ko',
    name: 'Stock Trading AI 실전 구현 (한국어)',
    description: 'HMM, 칼만 필터, SAC 강화학습으로 만드는 실전 퀀트 트레이딩 시스템 (한국어)',
    price: 2200,   // cents → $22.00
    native_type: 'ebook',
    custom_permalink: 'stock-trading-ai-ko',
  },
  {
    key: 'quant_en',
    name: 'Stock Trading AI (English)',
    description: 'Build a quant trading system with HMM, Kalman filter & SAC reinforcement learning (English)',
    price: 2200,
    native_type: 'ebook',
    custom_permalink: 'stock-trading-ai-en',
  },
  {
    key: 'quant_ja',
    name: 'Stock Trading AI 実践実装 (日本語)',
    description: 'HMM・カルマンフィルター・SAC強化学習で作るクオンツトレーディングシステム (日本語)',
    price: 2200,
    native_type: 'ebook',
    custom_permalink: 'stock-trading-ai-ja',
  },
];

async function createProduct(product) {
  const body = new URLSearchParams({
    access_token: ACCESS_TOKEN,
    native_type: product.native_type,
    name: product.name,
    description: product.description,
    price: String(product.price),
    price_currency_type: 'usd',
    custom_permalink: product.custom_permalink,
  });

  const res = await fetch('https://api.gumroad.com/v2/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || JSON.stringify(data));
  }
  return data.product;
}

async function getProduct(productId) {
  const res = await fetch(`https://api.gumroad.com/v2/products/${productId}?access_token=${ACCESS_TOKEN}`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || JSON.stringify(data));
  }
  return data.product;
}

async function main() {
  console.log('🚀 Gumroad 상품 생성 시작 (draft)...\n');

  const results = {};

  for (const product of PRODUCTS) {
    process.stdout.write(`  생성 중: ${product.name} ... `);
    try {
      const created = await createProduct(product);
      // enable은 결제수단 연결 후 대시보드에서 가능 — draft로 생성 후 short_url 확보
      const fetched = await getProduct(created.id);
      const url = fetched.short_url || `https://app.gumroad.com/products/${created.id}`;
      results[product.key] = { id: created.id, url };
      console.log(`✅ ${url}`);
    } catch (err) {
      console.log(`❌ 실패: ${err.message}`);
      results[product.key] = { error: err.message };
    }
  }

  console.log('\n========================================');
  console.log('📋 생성 결과 (+page.svelte에 복사):');
  console.log('========================================\n');

  const tauri2 = results.tauri2_ko?.url && results.tauri2_en?.url && results.tauri2_ja?.url;
  const quant = results.quant_ko?.url && results.quant_en?.url && results.quant_ja?.url;

  console.log('\n⚠️  상품은 draft 상태입니다.');
  console.log('   결제수단 연결 후 대시보드에서 publish 하세요: https://app.gumroad.com/products\n');

  if (tauri2 && quant) {
    console.log(`const GR: Record<string, Record<Lang, string>> = {
  tauri2: {
    ko: '${results.tauri2_ko.url}',
    en: '${results.tauri2_en.url}',
    ja: '${results.tauri2_ja.url}'
  },
  quant: {
    ko: '${results.quant_ko.url}',
    en: '${results.quant_en.url}',
    ja: '${results.quant_ja.url}'
  }
};`);
  } else {
    console.log('일부 상품 생성 실패. 아래 개별 결과 참조:');
    for (const [key, val] of Object.entries(results)) {
      if (val.url) {
        console.log(`  ${key}: ${val.url}`);
      } else {
        console.log(`  ${key}: ❌ ${val.error}`);
      }
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
