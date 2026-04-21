// check-products.mjs — list existing products in the store
const API_KEY = process.env.LS_API_KEY;
const STORE_ID = process.env.LS_STORE_ID;

const res = await fetch(`https://api.lemonsqueezy.com/v1/products?filter[store_id]=${STORE_ID}`, {
  headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/vnd.api+json' }
});
const d = await res.json();
const products = d.data || [];
if (products.length === 0) {
  console.log('상품 없음 — 대시보드에서 먼저 생성 필요');
} else {
  for (const p of products) {
    console.log(`ID=${p.id}  slug=${p.attributes.slug}  name=${p.attributes.name}  status=${p.attributes.status}`);
  }
}
