#!/usr/bin/env node
/**
 * Gumroad 상품에 커버 이미지 업로드
 * presign → S3 upload → cover 연결
 */

import { readFileSync, statSync } from 'fs';

const TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('❌ GUMROAD_ACCESS_TOKEN 환경변수 없음');
  process.exit(1);
}

const COVERS = [
  { productId: 'djTHAqjPOYmbOFX_9S0Xaw==', name: 'Tauri2 KO', file: '/tmp/gumroad-covers/tauri2-ko-cover.jpg' },
  { productId: 'TVcfR6XC2lS6nfN28LGSAg==', name: 'Tauri2 EN', file: '/tmp/gumroad-covers/tauri2-en-cover.jpg' },
  { productId: 'ICFiOtKXhmQrSwqYtJcsUw==', name: 'Tauri2 JA', file: '/tmp/gumroad-covers/tauri2-ja-cover.jpg' },
  { productId: 'snUyudrXoHmaTNrwHcCYhg==', name: 'Quant KO',  file: '/tmp/gumroad-covers/quant-ko-cover.jpg' },
  { productId: '2qczS_DfK0_pxAoGC439kg==', name: 'Quant EN',  file: '/tmp/gumroad-covers/quant-en-cover.jpg' },
  { productId: 'C6rqVzKe4oV_fKepAQfNOw==', name: 'Quant JA',  file: '/tmp/gumroad-covers/quant-ja-cover.jpg' },
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
  return d;
}

async function uploadToS3(presignedUrl, buffer) {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    body: buffer,
    headers: { 'Content-Type': 'image/jpeg' },
  });
  if (!res.ok) throw new Error('S3 upload failed: ' + res.status);
  return res.headers.get('etag');
}

async function completeUpload(uploadId, key, parts) {
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

async function attachCover(productId, coverUrl) {
  const pairs = [
    `access_token=${encodeURIComponent(TOKEN)}`,
    `covers[][url]=${encodeURIComponent(coverUrl)}`,
  ];
  const res = await fetch(`https://api.gumroad.com/v2/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: pairs.join('&'),
  });
  const d = await res.json();
  if (!d.success) throw new Error('cover attach failed: ' + JSON.stringify(d));
  return d.product;
}

async function main() {
  console.log('🖼️  Gumroad 커버 이미지 업로드 시작...\n');

  for (const item of COVERS) {
    console.log(`\n📘 ${item.name}`);
    const buf = readFileSync(item.file);
    const fileSize = buf.length;
    const filename = item.file.split('/').pop();
    console.log(`   파일: ${filename} (${Math.round(fileSize / 1024)}KB)`);

    try {
      // 1. Presign
      process.stdout.write('   presign... ');
      const pd = await presign(filename, fileSize);
      console.log('ok');

      // 2. S3 upload (single part — images are small)
      process.stdout.write('   S3 upload... ');
      const part = pd.parts[0];
      const etag = await uploadToS3(part.presigned_url, buf);
      console.log('ok');

      // 3. Complete
      process.stdout.write('   complete... ');
      const coverUrl = await completeUpload(pd.upload_id, pd.key, [{ part_number: part.part_number, etag }]);
      console.log('ok');

      // 4. Attach to product
      process.stdout.write('   attach cover... ');
      const product = await attachCover(item.productId, coverUrl);
      console.log('ok');
      console.log(`   커버 수: ${product.covers?.length || 0}`);
      console.log(`   ✅ 완료`);
    } catch (err) {
      console.error(`   ❌ 실패: ${err.message}`);
    }
  }

  console.log('\n✅ 커버 업로드 완료');
}

main();
