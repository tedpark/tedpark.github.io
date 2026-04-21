#!/usr/bin/env node
/**
 * Gumroad 커버 이미지 등록 (GitHub Pages 공개 URL 사용)
 * 
 * GitHub Pages 배포 후 실행:
 * covers URL: https://tedpark.github.io/covers/xxx.jpg
 */

const TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('❌ GUMROAD_ACCESS_TOKEN 환경변수 없음');
  process.exit(1);
}

const COVER_BASE = 'https://tedpark.github.io/covers';

const COVERS = [
  { productId: 'djTHAqjPOYmbOFX_9S0Xaw==', name: 'Tauri2 KO', url: `${COVER_BASE}/tauri2-ko-cover.jpg` },
  { productId: 'TVcfR6XC2lS6nfN28LGSAg==', name: 'Tauri2 EN', url: `${COVER_BASE}/tauri2-en-cover.jpg` },
  { productId: 'ICFiOtKXhmQrSwqYtJcsUw==', name: 'Tauri2 JA', url: `${COVER_BASE}/tauri2-ja-cover.jpg` },
  { productId: 'snUyudrXoHmaTNrwHcCYhg==', name: 'Quant KO',  url: `${COVER_BASE}/quant-ko-cover.jpg` },
  { productId: '2qczS_DfK0_pxAoGC439kg==', name: 'Quant EN',  url: `${COVER_BASE}/quant-en-cover.jpg` },
  { productId: 'C6rqVzKe4oV_fKepAQfNOw==', name: 'Quant JA',  url: `${COVER_BASE}/quant-ja-cover.jpg` },
];

async function checkPublicUrl(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.status === 200;
  } catch {
    return false;
  }
}

async function attachCover(productId, coverUrl) {
  const params = new URLSearchParams({
    access_token: TOKEN,
    url: coverUrl,
  });
  const res = await fetch(`https://api.gumroad.com/v2/products/${encodeURIComponent(productId)}/covers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const d = await res.json();
  return d;
}

async function main() {
  console.log('🖼️  Gumroad 커버 이미지 등록 (GitHub Pages URL)\n');

  // 공개 URL 접근 가능 여부 먼저 확인
  console.log('🔍 GitHub Pages URL 접근 확인...');
  const accessible = await checkPublicUrl(COVERS[0].url);
  if (!accessible) {
    console.error(`❌ GitHub Pages가 아직 배포 중입니다.`);
    console.error(`   URL: ${COVERS[0].url}`);
    console.error(`   배포 완료 후 다시 실행하세요. (보통 2~5분 소요)`);
    process.exit(1);
  }
  console.log('✅ GitHub Pages 접근 가능\n');

  for (const item of COVERS) {
    console.log(`📘 ${item.name}`);
    process.stdout.write(`   POST covers... `);
    try {
      const d = await attachCover(item.productId, item.url);
      if (d.success !== false) {
        console.log('ok');
        console.log(`   ✅ 완료\n`);
      } else {
        console.log('failed');
        console.error(`   ❌ ${d.message}\n`);
      }
    } catch (err) {
      console.error(`failed\n   ❌ ${err.message}\n`);
    }
  }

  console.log('✅ 커버 등록 완료');
}

main();
