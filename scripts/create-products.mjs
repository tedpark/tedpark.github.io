#!/usr/bin/env node
/**
 * create-products.mjs
 * 
 * Lemon Squeezy 대시보드를 자동화하여 6개 상품을 생성합니다.
 * 
 * 사용법:
 *   LS_EMAIL=<email> LS_PASSWORD=<password> node scripts/create-products.mjs
 * 
 * 또는 .ls_env에 추가:
 *   export LS_EMAIL="itstedpark@gmail.com"
 *   export LS_PASSWORD="your-password"
 * 
 *   source .ls_env && node scripts/create-products.mjs
 */

import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = join(__dirname, '../src/routes/books/+page.svelte');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const EMAIL = process.env.LS_EMAIL;
const PASSWORD = process.env.LS_PASSWORD;
const API_KEY = process.env.LS_API_KEY;

if (!EMAIL || !PASSWORD) {
  console.error(`
❌  로그인 정보가 없습니다.

사용법:
  LS_EMAIL=itstedpark@gmail.com LS_PASSWORD=<password> \\
  LS_API_KEY=<api-key> node scripts/create-products.mjs

또는 .ls_env에 추가 후:
  source .ls_env && node scripts/create-products.mjs
`);
  process.exit(1);
}

// ─── 상품 정의 ────────────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    key: 'tauri2_ko',
    name: 'Vibe Coding Tauri 2 (한국어)',
    description: 'AI 에이전트와 반복 루프로 저녁 한두 시간만으로 Tauri 2 앱 4개 + TUI 앱 2개를 완성한 실전 기록. Tauri 2 · Rust · SvelteKit · DuckDB. 18 챕터 PDF.',
    price: '17.00',
  },
  {
    key: 'tauri2_en',
    name: 'Vibe Coding Tauri 2 (English)',
    description: 'A hands-on record of building 4 Tauri 2 desktop apps + 2 TUI apps in evening sessions using an AI agent loop. Tauri 2 · Rust · SvelteKit · DuckDB. 18 chapters PDF.',
    price: '17.00',
  },
  {
    key: 'tauri2_ja',
    name: 'Vibe Coding Tauri 2 (日本語)',
    description: 'AIエージェントのループを使い、夜の1〜2時間でTauri 2アプリ4本とTUIアプリ2本を完成させた実践記録。Tauri 2 · Rust · SvelteKit · DuckDB。18チャプターPDF。',
    price: '17.00',
  },
  {
    key: 'quant_ko',
    name: 'Stock Trading AI 실전 구현 (한국어)',
    description: 'OOS Sharpe 3.716, IBKR 라이브 32 페어. HMM 레짐 분류기 · SAC RL · FastAPI · Rust TUI. Python · HMM · SAC RL · IBKR · FastAPI. 27 챕터 PDF.',
    price: '22.00',
  },
  {
    key: 'quant_en',
    name: 'Stock Trading AI (English)',
    description: 'OOS Sharpe 3.716, live on IBKR with 32 pairs. HMM regime classifier · SAC RL · FastAPI · Rust TUI. Python · HMM · SAC RL · IBKR · FastAPI. 27 chapters PDF.',
    price: '22.00',
  },
  {
    key: 'quant_ja',
    name: 'Stock Trading AI 実践実装 (日本語)',
    description: 'OOSシャープ比3.716、IBKR本番稼働中32ペア。HMMレジーム分類 · SAC RL · FastAPI · Rust TUI。Python · HMM · SAC RL · IBKR · FastAPI。27チャプターPDF。',
    price: '22.00',
  },
];

// ─── 상품 생성 (Puppeteer) ────────────────────────────────────────────────────
async function createProduct(page, product) {
  console.log(`\n  Creating: ${product.name}`);

  // Navigate to new product page
  await page.goto('https://app.lemonsqueezy.com/products/create', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // Check if redirected to login (session expired)
  if (page.url().includes('/login')) {
    throw new Error('Session expired — please re-login');
  }

  // ─── Product name ──────────────────────────────────────────────────────────
  const nameSelectors = [
    'input[name="name"]',
    'input[placeholder*="name" i]',
    'input[placeholder*="product" i]',
    '#name',
  ];
  let nameInput = null;
  for (const sel of nameSelectors) {
    nameInput = await page.$(sel);
    if (nameInput) break;
  }
  if (!nameInput) {
    // Take a screenshot to debug
    await page.screenshot({ path: `/tmp/ls-debug-${product.key}.png` });
    throw new Error(`Could not find name input on product create page. Screenshot saved to /tmp/ls-debug-${product.key}.png`);
  }
  await nameInput.click({ clickCount: 3 });
  await nameInput.type(product.name);
  console.log(`    ✓ Name filled`);

  // ─── Price ─────────────────────────────────────────────────────────────────
  const priceSelectors = [
    'input[name="price"]',
    'input[placeholder*="price" i]',
    'input[placeholder*="0.00"]',
    '#price',
  ];
  let priceInput = null;
  for (const sel of priceSelectors) {
    priceInput = await page.$(sel);
    if (priceInput) break;
  }
  if (priceInput) {
    await priceInput.click({ clickCount: 3 });
    await priceInput.type(product.price);
    console.log(`    ✓ Price filled: $${product.price}`);
  } else {
    console.log(`    ⚠ Price input not found — will set manually`);
  }

  // ─── Description ───────────────────────────────────────────────────────────
  const descSelectors = [
    'textarea[name="description"]',
    '[contenteditable="true"]',
    '.ProseMirror',
    'textarea',
  ];
  let descInput = null;
  for (const sel of descSelectors) {
    descInput = await page.$(sel);
    if (descInput) break;
  }
  if (descInput) {
    await descInput.click();
    await page.keyboard.selectAll();
    await descInput.type(product.description);
    console.log(`    ✓ Description filled`);
  }

  // ─── Save / Submit ─────────────────────────────────────────────────────────
  const submitSelectors = [
    'button[type="submit"]',
    'button:has-text("Save")',
    'button:has-text("Create")',
    'button:has-text("Publish")',
  ];
  let submitBtn = null;
  for (const sel of submitSelectors) {
    try {
      submitBtn = await page.$(sel);
      if (submitBtn) break;
    } catch {}
  }

  // If no specific button found, try finding a primary action button
  if (!submitBtn) {
    const buttons = await page.$$('button[type="submit"], button.btn-primary, button.btn--primary');
    submitBtn = buttons[0] || null;
  }

  if (!submitBtn) {
    await page.screenshot({ path: `/tmp/ls-submit-debug-${product.key}.png` });
    throw new Error(`Could not find submit button. Screenshot at /tmp/ls-submit-debug-${product.key}.png`);
  }

  await submitBtn.click();
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

  // Get current URL (should be the product page)
  const currentUrl = page.url();
  console.log(`    ✓ Saved. URL: ${currentUrl}`);

  // ─── Extract buy_now_url ───────────────────────────────────────────────────
  // Try to get the product ID from the URL pattern /products/{id}
  const productIdMatch = currentUrl.match(/\/products\/(\d+)/);
  if (!productIdMatch) {
    console.log(`    ⚠ Could not extract product ID from URL. Fetching via API...`);
  }

  // Get buy_now_url via API
  let buyUrl = null;
  if (API_KEY) {
    await new Promise(r => setTimeout(r, 2000)); // wait for API to sync
    const res = await fetch(`https://api.lemonsqueezy.com/v1/products?filter[store_id]=166088&sort=-createdAt`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/vnd.api+json' }
    });
    const data = await res.json();
    // Find the most recently created product matching our name
    const found = data.data?.find(p => p.attributes.name === product.name);
    if (found) {
      buyUrl = found.attributes.buy_now_url;
      console.log(`    ✓ Buy URL: ${buyUrl}`);
    }
  }

  if (!buyUrl) {
    // Try to find a "Copy link" or "View product" URL on the page
    try {
      const linkEl = await page.$('a[href*="lemonsqueezy.com/checkout"], a[href*="/buy/"]');
      if (linkEl) {
        buyUrl = await page.evaluate(el => el.href, linkEl);
        console.log(`    ✓ Buy URL from page: ${buyUrl}`);
      }
    } catch {}
  }

  return buyUrl;
}

// ─── Update +page.svelte ──────────────────────────────────────────────────────
function updatePageSvelte(urls) {
  let content = readFileSync(PAGE_PATH, 'utf-8');

  const newBlock = `// ─── Lemon Squeezy product checkout URLs (auto-generated by create-products.mjs)
	const LS: Record<string, Record<Lang, string>> = {
		tauri2: {
			ko: '${urls.tauri2_ko || 'TODO_TAURI2_KO'}',
			en: '${urls.tauri2_en || 'TODO_TAURI2_EN'}',
			ja: '${urls.tauri2_ja || 'TODO_TAURI2_JA'}'
		},
		quant: {
			ko: '${urls.quant_ko || 'TODO_QUANT_KO'}',
			en: '${urls.quant_en || 'TODO_QUANT_EN'}',
			ja: '${urls.quant_ja || 'TODO_QUANT_JA'}'
		}
	};`;

  content = content.replace(
    /\/\/ ─── Lemon Squeezy product checkout URLs[\s\S]*?const LS: Record<string, Record<Lang, string>> = \{[\s\S]*?\};/,
    newBlock
  );

  writeFileSync(PAGE_PATH, content, 'utf-8');
  console.log(`\n✅  ${PAGE_PATH} 업데이트 완료`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🍋  Lemon Squeezy 상품 자동 생성 시작\n');
  console.log(`   Email: ${EMAIL}`);
  console.log(`   Products: ${PRODUCTS.length}개\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,  // headful so you can see what's happening
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    // ─── Login ──────────────────────────────────────────────────────────────
    console.log('   Logging in...');
    await page.goto('https://app.lemonsqueezy.com/login', { waitUntil: 'networkidle2' });

    // Fill email
    await page.waitForSelector('input[type="email"], input[name="email"]');
    const emailInput = await page.$('input[type="email"], input[name="email"]');
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(EMAIL);

    // Fill password
    const passInput = await page.$('input[type="password"], input[name="password"]');
    await passInput.click({ clickCount: 3 });
    await passInput.type(PASSWORD);

    // Submit
    const loginBtn = await page.$('button[type="submit"]');
    await loginBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

    const afterLoginUrl = page.url();
    console.log(`   Login complete. URL: ${afterLoginUrl}`);

    if (afterLoginUrl.includes('/login')) {
      throw new Error('Login failed — wrong email/password?');
    }
    console.log('   ✓ Logged in\n');

    // ─── Create products ─────────────────────────────────────────────────────
    const urls = {};
    for (const product of PRODUCTS) {
      const url = await createProduct(page, product);
      if (url) urls[product.key] = url;
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log('\n─── 생성된 URL ──────────────────────────────────────────────');
    for (const [key, url] of Object.entries(urls)) {
      console.log(`  ${key.padEnd(12)}: ${url || '(not captured)'}`);
    }

    // Update page if we have URLs
    const hasUrls = Object.keys(urls).length > 0;
    if (hasUrls) {
      updatePageSvelte(urls);
    }

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  완료! ${Object.keys(urls).length}/${PRODUCTS.length}개 상품 생성됨.

다음 단계:
  npm run build && git add -A && git commit -m "feat: add Lemon Squeezy products" && git push
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  } catch (e) {
    console.error(`\n❌  오류: ${e.message}`);
    await page.screenshot({ path: '/tmp/ls-error.png' });
    console.error('   스크린샷: /tmp/ls-error.png');
  } finally {
    await browser.close();
  }
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
