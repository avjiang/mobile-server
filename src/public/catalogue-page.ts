import { PublicCatalogue } from "./public.service";

/**
 * Server-rendered HTML for the public online catalogue (the page a buyer opens
 * from a shared link). Intentionally a tiny, self-contained, mobile-first page —
 * NOT the Flutter app (see docs/future/ONLINE_CATALOGUE.md §5/§6). No external
 * assets, no JS framework; image bytes come from Cloudflare R2 (images.bayaryuk.net).
 */

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function groupThousands(v: number): string {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatIDR(n: number): string {
  return "Rp " + groupThousands(Number(n) || 0);
}

function waHref(number: string | null, productName: string, price: number): string | null {
  if (!number) return null;
  const text = `Halo, saya tertarik dengan ${productName} (${formatIDR(price)}). Apakah tersedia?`;
  return `https://wa.me/${encodeURIComponent(number)}?text=${encodeURIComponent(text)}`;
}

const WA_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M.06 24l1.68-6.13A11.87 11.87 0 0 1 .12 11.9 11.9 11.9 0 0 1 12.06 0a11.82 11.82 0 0 1 8.41 3.49 11.82 11.82 0 0 1 3.48 8.41c0 6.56-5.34 11.9-11.9 11.9a11.9 11.9 0 0 1-5.7-1.45L.06 24zM6.6 20.13l.36.21a9.86 9.86 0 0 0 5.03 1.38h.01c5.45 0 9.89-4.43 9.89-9.88a9.82 9.82 0 0 0-2.9-6.99 9.82 9.82 0 0 0-6.98-2.9c-5.46 0-9.9 4.44-9.9 9.89a9.85 9.85 0 0 0 1.51 5.26l.24.38-1 3.63 3.74-.98zM17.2 14.3c-.07-.12-.27-.2-.56-.34-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.69.25-1.28.18-1.4z"/></svg>';

export function renderCataloguePage(catalogue: PublicCatalogue): string {
  const { business, products } = catalogue;
  const wa = business.whatsappNumber;

  const cards = products
    .map((p) => {
      const minVariantPrice =
        p.hasVariants && p.variants.length
          ? Math.min(...p.variants.map((v) => v.price))
          : null;
      const displayPrice = minVariantPrice != null ? minVariantPrice : p.price;
      const priceLabel =
        minVariantPrice != null
          ? `Mulai ${formatIDR(displayPrice)}`
          : formatIDR(displayPrice);

      const img = p.imageUrl
        ? `<img class="thumb" loading="lazy" src="${esc(p.imageUrl)}" alt="${esc(p.name)}">`
        : `<div class="thumb thumb--empty">${esc(p.name.slice(0, 1).toUpperCase())}</div>`;

      const variantChips =
        p.hasVariants && p.variants.length
          ? `<div class="variants">${p.variants
              .slice(0, 6)
              .map(
                (v) =>
                  `<span class="chip${v.inStock ? "" : " chip--out"}">${esc(v.name)}</span>`
              )
              .join("")}${p.variants.length > 6 ? `<span class="chip">+${p.variants.length - 6}</span>` : ""}</div>`
          : "";

      const href = waHref(wa, p.name, displayPrice);
      const button = href
        ? `<a class="wa" href="${esc(href)}" target="_blank" rel="noopener">${WA_ICON}<span>Tanya</span></a>`
        : "";

      return `<article class="card">
  ${img}
  <div class="body">
    ${p.categoryName ? `<span class="cat">${esc(p.categoryName)}</span>` : ""}
    <h2 class="name">${esc(p.name)}</h2>
    ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
    ${variantChips}
    <div class="foot">
      <span class="price">${esc(priceLabel)}</span>
      ${button}
    </div>
  </div>
</article>`;
    })
    .join("\n");

  const empty = `<div class="empty"><p>Belum ada produk yang tersedia saat ini.</p></div>`;

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<title>${esc(business.name)} — Katalog</title>
<meta name="description" content="Katalog produk ${esc(business.name)}">
<style>
  :root{ --red:#E53935; --ink:#1f2430; --muted:#6b7280; --line:#eceef2; --bg:#f6f7fb; --wa:#25D366; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); }
  header{ position:sticky; top:0; z-index:10; background:#fff; border-bottom:1px solid var(--line); padding:18px 16px; }
  header .wrap{ max-width:960px; margin:0 auto; display:flex; align-items:center; gap:12px; }
  .logo{ width:40px; height:40px; border-radius:10px; background:var(--red); color:#fff; display:grid; place-items:center; font-weight:700; font-size:18px; }
  header h1{ font-size:18px; margin:0; line-height:1.2; }
  header .sub{ font-size:12px; color:var(--muted); margin-top:2px; }
  main{ max-width:960px; margin:0 auto; padding:16px; }
  .grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:14px; }
  .card{ background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; }
  .thumb{ width:100%; aspect-ratio:1/1; object-fit:cover; background:#f0f1f5; display:block; }
  .thumb--empty{ display:grid; place-items:center; font-size:40px; font-weight:700; color:#cbd0da; }
  .body{ padding:12px; display:flex; flex-direction:column; gap:6px; flex:1; }
  .cat{ font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .name{ font-size:15px; margin:0; line-height:1.25; }
  .desc{ font-size:12px; color:var(--muted); margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .variants{ display:flex; flex-wrap:wrap; gap:4px; }
  .chip{ font-size:11px; background:#f4f7fe; color:#41506b; border-radius:6px; padding:2px 7px; }
  .chip--out{ text-decoration:line-through; opacity:.5; }
  .foot{ margin-top:auto; display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:6px; }
  .price{ font-weight:700; font-size:15px; }
  .wa{ display:inline-flex; align-items:center; gap:5px; background:var(--wa); color:#fff; text-decoration:none; font-size:13px; font-weight:600; padding:7px 10px; border-radius:9px; }
  .wa:active{ opacity:.85; }
  .empty{ text-align:center; color:var(--muted); padding:60px 16px; }
  footer{ text-align:center; color:var(--muted); font-size:12px; padding:24px 16px 40px; }
</style>
</head>
<body>
<header><div class="wrap">
  <div class="logo">${esc(business.name.slice(0, 1).toUpperCase())}</div>
  <div><h1>${esc(business.name)}</h1><div class="sub">${products.length} produk tersedia</div></div>
</div></header>
<main>
  ${products.length ? `<div class="grid">${cards}</div>` : empty}
</main>
<footer>Didukung oleh Bayar Yuk</footer>
</body>
</html>`;
}

export function renderNotFoundPage(): string {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Katalog tidak ditemukan</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f6f7fb;color:#1f2430;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px}h1{font-size:20px}p{color:#6b7280}</style>
</head><body><div><h1>Katalog tidak ditemukan</h1><p>Tautan ini mungkin salah atau katalog sedang tidak aktif.</p></div></body></html>`;
}
