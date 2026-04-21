#!/usr/bin/env node
/**
 * Gumroad 상품에 PDF 파일 업로드
 * 4단계: presign → S3 multipart upload → complete → attach to product
 */

import { readFileSync, statSync } from 'fs';

const TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('❌ GUMROAD_ACCESS_TOKEN 환경변수 없음');
  process.exit(1);
}

const PART_SIZE = 100 * 1024 * 1024; // 100MB per part

// 상품 ID → 파일 매핑
const UPLOADS = [
  {
    productId: 'djTHAqjPOYmbOFX_9S0Xaw==',
    name: 'Vibe Coding Tauri 2 (한국어)',
    file: '/Users/ted/bitlocal/book/tauri2-app/output/tauri2-in-production-ko.pdf',
  },
  {
    productId: 'TVcfR6XC2lS6nfN28LGSAg==',
    name: 'Vibe Coding Tauri 2 (English)',
    file: '/Users/ted/bitlocal/book/tauri2-app/output/tauri2-in-production-en.pdf',
  },
  {
    productId: 'ICFiOtKXhmQrSwqYtJcsUw==',
    name: 'Vibe Coding Tauri 2 (日本語)',
    file: '/Users/ted/bitlocal/book/tauri2-app/output/tauri2-in-production-ja.pdf',
  },
  {
    productId: 'snUyudrXoHmaTNrwHcCYhg==',
    name: 'Stock Trading AI 실전 구현 (한국어)',
    file: '/Users/ted/bitlocal/book/stock-trading-ai/output/python-quant-trading-ai-ko.pdf',
  },
  {
    productId: '2qczS_DfK0_pxAoGC439kg==',
    name: 'Stock Trading AI (English)',
    file: '/Users/ted/bitlocal/book/stock-trading-ai/output/python-quant-trading-ai-en.pdf',
  },
  {
    productId: 'C6rqVzKe4oV_fKepAQfNOw==',
    name: 'Stock Trading AI 実践実装 (日本語)',
    file: '/Users/ted/bitlocal/book/stock-trading-ai/output/python-quant-trading-ai-ja.pdf',
  },
];

async function presign(filename, fileSize) {
  const body = new URLSearchParams({
    access_token: TOKEN,
    filename,
    file_size: String(fileSize),
  });
  const res = await fetch('https://api.gumroad.com/v2/files/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const d = await res.json();
  if (!d.success) throw new Error('presign failed: ' + JSON.stringify(d));
  return d; // { upload_id, key, file_url, parts }
}

async function uploadPart(presignedUrl, buffer) {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    body: buffer,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (!res.ok) throw new Error('S3 upload failed: ' + res.status);
  const etag = res.headers.get('etag');
  return etag;
}

async function completeUpload(uploadId, key, parts) {
  // Build raw body manually — Gumroad requires parts[][part_number] bracket notation
  const pairs = [
    `access_token=${encodeURIComponent(TOKEN)}`,
    `upload_id=${encodeURIComponent(uploadId)}`,
    `key=${encodeURIComponent(key)}`,
  ];
  parts.forEach(p => {
    pairs.push(`parts[][part_number]=${encodeURIComponent(p.part_number)}`);
    pairs.push(`parts[][etag]=${encodeURIComponent(p.etag)}`);
  });
  const res = await fetch('https://api.gumroad.com/v2/files/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: pairs.join('&'),
  });
  const d = await res.json();
  if (!d.success) throw new Error('complete failed: ' + JSON.stringify(d));
  return d.file_url;
}

async function attachFile(productId, fileUrl) {
  const body = new URLSearchParams({
    access_token: TOKEN,
    'files[][url]': fileUrl,
  });
  const res = await fetch(`https://api.gumroad.com/v2/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const d = await res.json();
  if (!d.success) throw new Error('attach failed: ' + JSON.stringify(d));
  return d.product;
}

async function uploadFile(filePath) {
  const fileBuffer = readFileSync(filePath);
  const fileSize = fileBuffer.length;
  const filename = filePath.split('/').pop();

  // 1. Presign
  process.stdout.write(`    presign... `);
  const presignData = await presign(filename, fileSize);
  console.log('ok');

  // 2. Upload parts to S3
  const parts = presignData.parts;
  const completedParts = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const start = (part.part_number - 1) * PART_SIZE;
    const end = Math.min(start + PART_SIZE, fileSize);
    const chunk = fileBuffer.slice(start, end);
    process.stdout.write(`    S3 part ${part.part_number}/${parts.length} (${Math.round(chunk.length / 1024 / 1024)}MB)... `);
    const etag = await uploadPart(part.presigned_url, chunk);
    completedParts.push({ part_number: part.part_number, etag });
    console.log('ok');
  }

  // 3. Complete
  process.stdout.write(`    complete... `);
  const fileUrl = await completeUpload(presignData.upload_id, presignData.key, completedParts);
  console.log('ok');

  return fileUrl;
}

async function main() {
  console.log('📎 Gumroad 파일 업로드 시작...\n');

  for (const item of UPLOADS) {
    console.log(`\n📘 ${item.name}`);
    const fileSize = statSync(item.file).size;
    console.log(`   파일: ${item.file.split('/').pop()} (${Math.round(fileSize / 1024 / 1024 * 10) / 10}MB)`);

    try {
      const fileUrl = await uploadFile(item.file);
      process.stdout.write(`    attach... `);
      await attachFile(item.productId, fileUrl);
      console.log('ok');
      console.log(`   ✅ 완료`);
    } catch (err) {
      console.log(`\n   ❌ 실패: ${err.message}`);
    }
  }

  console.log('\n\n✅ 모든 업로드 완료!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
