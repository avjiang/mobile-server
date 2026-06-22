import { PublicCatalogue } from "./public.service";

/**
 * Server-rendered HTML for the public online catalogue (the page a buyer opens
 * from a shared link). Intentionally a tiny, self-contained, mobile-first page —
 * NOT the Flutter app (see docs/future/ONLINE_CATALOGUE.md §5/§6). No external
 * assets or JS frameworks; image bytes come from Cloudflare R2 (images.bayaryuk.net).
 *
 * Streamlined with the BayarYuk POS design language (brand red #E3173C, lavender
 * #F4F7FE, rounded cards) and enriched with:
 *   - a product detail sheet (per-variant prices + targeted WhatsApp links),
 *   - Open Graph / Twitter share-preview meta + an inline SVG favicon,
 *   - ID/MY localization + currency (Rp / RM) derived from the WhatsApp dial code,
 *   - a scroll-collapsing brand header and staggered entrance animations.
 *
 * The single inline <script> (search, category filter, detail sheet) is
 * authorised by a per-response CSP nonce passed in from the controller.
 */

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

// ── Localization ───────────────────────────────────────────────────────────
// No tenant locale field exists yet, so country is inferred from the WhatsApp
// dial code (62→ID, 60→MY). When a real tenant locale/currency lands, swap
// localeFor() to read it — every caller below already routes through this.

function group(intStr: string, sep: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

// Currency presentation by ISO code (from the tenant's default_currency setting).
// `lang` picks the page copy. Unknown codes fall back to IDR.
interface CurrencyFmt {
  prefix: string;
  decimals: number;
  group: string;
  decSep: string;
  lang: "id" | "ms";
}
const CURRENCIES: Record<string, CurrencyFmt> = {
  IDR: { prefix: "Rp ", decimals: 0, group: ".", decSep: ",", lang: "id" },
  MYR: { prefix: "RM ", decimals: 2, group: ",", decSep: ".", lang: "ms" },
  SGD: { prefix: "S$ ", decimals: 2, group: ",", decSep: ".", lang: "id" },
  USD: { prefix: "$ ", decimals: 2, group: ",", decSep: ".", lang: "id" },
  THB: { prefix: "฿ ", decimals: 2, group: ",", decSep: ".", lang: "id" },
  EUR: { prefix: "€ ", decimals: 2, group: ".", decSep: ",", lang: "id" },
  AUD: { prefix: "A$ ", decimals: 2, group: ",", decSep: ".", lang: "id" },
};
function makeFmt(c: CurrencyFmt): (n: number) => string {
  return (n: number) => {
    const num = Number(n) || 0;
    if (c.decimals === 0) return c.prefix + group(Math.round(num).toString(), c.group);
    const parts = num.toFixed(c.decimals).split(".");
    return c.prefix + group(parts[0], c.group) + c.decSep + parts[1];
  };
}

interface Strings {
  lang: string;
  catalogOnline: string;
  available: string; // follows the product count
  searchPlaceholder: string;
  all: string;
  options: string; // "N pilihan" prefix label (count rendered separately)
  optionsLabel: string; // heading above the variant list in the sheet
  askStock: string;
  outOfStock: string;
  poweredBy: string;
  emptyTitle: string;
  notFound: string;
  startFrom: string;
  share: string;
  linkCopied: string;
  sortBy: string;
  sortDefault: string;
  sortCheap: string;
  sortExpensive: string;
  ogDesc: (name: string) => string;
  waText: (name: string, price: string) => string;
}

const ID_STRINGS: Strings = {
  lang: "id",
  catalogOnline: "KATALOG ONLINE",
  available: "produk tersedia",
  searchPlaceholder: "Cari produk…",
  all: "Semua",
  options: "pilihan",
  optionsLabel: "Pilihan tersedia",
  askStock: "Tanya stok via WhatsApp",
  outOfStock: "Habis",
  poweredBy: "Didukung oleh",
  emptyTitle: "Belum ada produk yang tersedia saat ini.",
  notFound: "Produk tidak ditemukan.",
  startFrom: "Mulai",
  share: "Bagikan",
  linkCopied: "Tautan disalin",
  sortBy: "Urutkan",
  sortDefault: "Pilihan",
  sortCheap: "Termurah",
  sortExpensive: "Termahal",
  ogDesc: (name) => `Lihat katalog produk ${name} dan pesan langsung lewat WhatsApp.`,
  waText: (name, price) => `Halo, saya tertarik dengan ${name} (${price}). Apakah tersedia?`,
};

const MS_STRINGS: Strings = {
  lang: "ms",
  catalogOnline: "KATALOG ONLINE",
  available: "produk tersedia",
  searchPlaceholder: "Cari produk…",
  all: "Semua",
  options: "pilihan",
  optionsLabel: "Pilihan tersedia",
  askStock: "Tanya stok via WhatsApp",
  outOfStock: "Habis",
  poweredBy: "Dikuasakan oleh",
  emptyTitle: "Tiada produk tersedia buat masa ini.",
  notFound: "Produk tidak dijumpai.",
  startFrom: "Dari",
  share: "Bagikan",
  linkCopied: "Pautan disalin",
  sortBy: "Susun",
  sortDefault: "Pilihan",
  sortCheap: "Termurah",
  sortExpensive: "Termahal",
  ogDesc: (name) => `Lihat katalog produk ${name} dan tempah terus melalui WhatsApp.`,
  waText: (name, price) => `Hai, saya berminat dengan ${name} (${price}). Adakah stok masih ada?`,
};

function localeFor(currencyCode: string): { fmt: (n: number) => string; t: Strings } {
  const c = CURRENCIES[(currencyCode || "IDR").toUpperCase()] || CURRENCIES.IDR;
  return { fmt: makeFmt(c), t: c.lang === "ms" ? MS_STRINGS : ID_STRINGS };
}

function waLink(number: string | null, text: string): string {
  if (!number) return "";
  return `https://wa.me/${encodeURIComponent(number)}?text=${encodeURIComponent(text)}`;
}

const WA_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M.06 24l1.68-6.13A11.87 11.87 0 0 1 .12 11.9 11.9 11.9 0 0 1 12.06 0a11.82 11.82 0 0 1 8.41 3.49 11.82 11.82 0 0 1 3.48 8.41c0 6.56-5.34 11.9-11.9 11.9a11.9 11.9 0 0 1-5.7-1.45L.06 24zM6.6 20.13l.36.21a9.86 9.86 0 0 0 5.03 1.38h.01c5.45 0 9.89-4.43 9.89-9.88a9.82 9.82 0 0 0-2.9-6.99 9.82 9.82 0 0 0-6.98-2.9c-5.46 0-9.9 4.44-9.9 9.89a9.85 9.85 0 0 0 1.51 5.26l.24.38-1 3.63 3.74-.98zM17.2 14.3c-.07-.12-.27-.2-.56-.34-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.69.25-1.28.18-1.4z"/></svg>';

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.2-4.2"/></svg>';

// Neutral "no photo" glyph for products without an image (replaces the noisy
// first-letter placeholder). Same icon on cards and in the detail sheet.
const PLACEHOLDER_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.7"/><path d="M21 15l-4.5-4.5L5 21"/></svg>';

const SHARE_ICON =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';

const UP_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M6 12l6-6 6 6"/></svg>';

// BayarYuk horizontal brand logo (assets/app_logo_banner.svg) inlined for the footer.
const BRAND_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280.45 65.88" role="img" aria-label="Bayar Yuk"><g><g><path fill="#011627" d="M48.14,0h-23.97C19.81,0,15.79,2.32,13.62,6.09L1.63,26.85c-2.18,3.77-2.18,8.41,0,12.18l11.99,20.76c2.18,3.77,6.2,6.09,10.55,6.09h23.97c4.35,0,8.37-2.32,10.55-6.09l11.99-20.76c2.18-3.77,2.18-8.41,0-12.18l-11.99-20.76C56.51,2.32,52.49,0,48.14,0Z"/><g><path fill="#e3173c" d="M47.5,52.97h-19.72c-2.3,0-4.45-1.24-5.6-3.24l-7.86-13.62c-1.15-2-1.15-4.48,0-6.47l7.86-13.62c1.15-2,3.3-3.24,5.6-3.24h20.04c.49,0,.89.4.89.89s-.4.89-.89.89h-20.04c-1.67,0-3.23.9-4.06,2.34l-7.86,13.62c-.84,1.45-.84,3.24,0,4.69l7.86,13.62c.83,1.45,2.39,2.34,4.06,2.34h19.72c.49,0,.89.4.89.89s-.4.89-.89.89Z"/><path fill="#e3173c" d="M60.26,28.25c1.8,3.35.56,6.67-1.22,9.81l-7.56,12.62c-1.71,3.07-6.29,3.03-7.97.01l-8.63-14.94c-.69-1.2-.7-2.68-.01-3.88l9.47-16.63c1.74-3.41,4.93-2.71,6.05-1.17l1.92,3.11c1.23,2.43,1.17,5.25-.61,8.38l1.05-1.84c1.54-2.7,3.52-2.38,4.87-.05l2.65,4.59ZM43.55,32.63c.31.54,1.1.54,1.41,0l2.25-3.94c.4-.71.42-1.69.09-2.26l-1.05-1.82c-.35-.61-.89-.54-1.3.17l-2.72,4.77c-.14.25-.14.56,0,.81l1.32,2.28ZM53.31,34.35l-1.36-2.36c-.33-.57-.92-.5-1.32.21l-3.41,5.98c-.14.25-.14.56,0,.81l1.63,2.82c.31.54,1.1.54,1.41,0l2.94-5.16c.4-.71.46-1.69.11-2.3Z"/></g></g><g><path fill="#011627" d="M104.29,42.08h-10.01v-21.18h10.01c2.49,0,4.4.64,5.71,1.92.98.96,1.47,2.17,1.47,3.64,0,2.38-.91,4.06-2.73,5.05,1.82.97,2.73,2.65,2.73,5.05,0,1.45-.49,2.65-1.47,3.61-1.31,1.28-3.21,1.92-5.71,1.92ZM99.27,30.52c1.81-.52,3.1-.88,3.87-1.09.45-.13.73-.21.85-.23.74-.18,1.32-.38,1.73-.6.44-.23.66-.67.66-1.34,0-1.38-.93-2.09-2.79-2.13h-4.33v5.38ZM103.6,37.84c1.86-.04,2.79-.72,2.79-2.04,0-.84-.3-1.48-.89-1.92-.34-.28-.75-.43-1.23-.43-.23,0-.46.03-.72.1-.05,0-.1.02-.15.03l-4.12,1.16v3.1h4.33Z"/><path fill="#011627" d="M135.99,42.2h-5.31l-6.13-15.08-4.42,10.86h4.65v4.23h-11.56l9.04-21.3h4.67l9.07,21.3Z"/><path fill="#011627" d="M140.17,33.71l-8.14-12.84h5.88l4.84,8.14,4.93-8.14h5.74l-8.14,12.75v8.46h-5.11v-8.38Z"/><path fill="#011627" d="M172.23,42.2h-5.31l-6.13-15.08-4.42,10.86h4.65v4.23h-11.56l9.04-21.3h4.67l9.07,21.3Z"/><path fill="#011627" d="M193.59,42.08h-5.85l-7.48-10.99h4.17c2.1,0,3.21-.96,3.32-2.89,0-1.96-1.13-2.95-3.4-2.98h-4.36v16.86h-5.11v-21.21h9.86c2.76,0,4.88.74,6.37,2.23,1.2,1.22,1.8,2.82,1.8,4.8,0,3.46-1.49,5.67-4.47,6.62l5.16,7.57Z"/></g><g><path fill="#011627" d="M210.33,33.71l-8.14-12.84h5.88l4.84,8.14,4.93-8.14h5.74l-8.14,12.75v8.46h-5.11v-8.38Z"/><path fill="#011627" d="M235.56,42.42c-2.91,0-5.2-.8-6.85-2.41-1.66-1.59-2.49-3.94-2.49-7.03v-12.12h5.11v11.99c0,1.75.38,3.04,1.14,3.86.78.84,1.83,1.26,3.15,1.26s2.37-.4,3.15-1.2c.76-.82,1.14-2.07,1.14-3.76v-12.15h5.11v11.96c0,1.59-.22,2.99-.66,4.18-.43,1.17-1.05,2.17-1.86,2.98-.82.8-1.82,1.41-3.01,1.83-1.18.4-2.49.6-3.93.6Z"/><path fill="#011627" d="M265.66,42.08h-6.02l-6.88-7.86v7.86h-5.11v-21.21h5.11v7.88l6.88-7.88h6.02l-9.35,10.61,9.35,10.61Z"/></g><path fill="#e3173c" d="M274.62,21.56v-.69h5.82v.69l-1.41,13.38h-3.01l-1.41-13.38ZM274.86,37.1h5.35v4.99h-5.35v-4.99Z"/></g></svg>';

function faviconHref(initial: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#E3173C"/>` +
    `<text x="32" y="45" font-family="Arial,Helvetica,sans-serif" font-size="38" font-weight="bold" fill="#ffffff" text-anchor="middle">${esc(initial)}</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

export function renderCataloguePage(catalogue: PublicCatalogue, nonce: string): string {
  const { business, products } = catalogue;
  const wa = business.whatsappNumber;
  const { fmt, t } = localeFor(business.currency);

  // Unique categories, first-seen order — used for the filter tabs.
  const categories: string[] = [];
  const seenCat = new Set<string>();
  for (const p of products) {
    if (p.categoryName && !seenCat.has(p.categoryName)) {
      seenCat.add(p.categoryName);
      categories.push(p.categoryName);
    }
  }

  // Compact per-product payload that powers the client-side detail sheet.
  const data = products.map((p) => {
    const variantPrices =
      p.hasVariants && p.variants.length ? p.variants.map((v) => v.price) : [];
    const minVariantPrice = variantPrices.length ? Math.min(...variantPrices) : null;
    const maxVariantPrice = variantPrices.length ? Math.max(...variantPrices) : null;
    const displayPrice = minVariantPrice != null ? minVariantPrice : p.price;
    const priceLabel =
      minVariantPrice != null ? `${t.startFrom} ${fmt(displayPrice)}` : fmt(displayPrice);
    // Full range for the detail sheet (where there's room); cards stay compact.
    const rangeLabel =
      minVariantPrice != null && maxVariantPrice != null && maxVariantPrice !== minVariantPrice
        ? `${fmt(minVariantPrice)} – ${fmt(maxVariantPrice)}`
        : fmt(displayPrice);
    return {
      n: p.name,
      c: p.categoryName ?? "",
      d: p.description ?? "",
      img: p.imageUrl ?? "",
      p: priceLabel,
      pr: rangeLabel,
      sp: displayPrice,
      oos: !p.inStock,
      w: waLink(wa, t.waText(p.name, fmt(displayPrice))),
      v:
        p.hasVariants && p.variants.length
          ? p.variants.map((v) => ({
              n: v.name,
              p: fmt(v.price),
              s: v.inStock,
              w: v.inStock ? waLink(wa, t.waText(`${p.name} — ${v.name}`, fmt(v.price))) : "",
            }))
          : [],
    };
  });

  const cards = products
    .map((p, i) => {
      const d = data[i];
      const img = p.imageUrl
        ? `<img class="thumb" loading="lazy" decoding="async" src="${esc(p.imageUrl)}" alt="${esc(p.name)}">`
        : `<div class="thumb thumb--empty">${PLACEHOLDER_ICON}</div>`;
      const vcount =
        p.hasVariants && p.variants.length
          ? `<span class="vcount">${p.variants.length} ${esc(t.options)}</span>`
          : "";
      const haystack = `${p.name} ${p.description ?? ""} ${p.categoryName ?? ""}`.toLowerCase();

      const oos = !p.inStock;
      return `<article class="card${oos ? " card--oos" : ""}" style="--i:${i}" data-idx="${i}" data-price="${d.sp}" data-cat="${esc(p.categoryName ?? "")}" data-name="${esc(haystack)}" tabindex="0" role="button" aria-label="${esc(p.name)}">
  <div class="card-inner">
    <div class="thumb-wrap">
      ${img}
      ${oos ? `<div class="oos-banner">${esc(t.outOfStock)}</div>` : ""}
    </div>
    <div class="body">
      ${p.categoryName ? `<span class="cat">${esc(p.categoryName)}</span>` : ""}
      <h2 class="name">${esc(p.name)}</h2>
      ${vcount}
      <div class="foot"><span class="price">${esc(d.p)}</span><span class="chev" aria-hidden="true">›</span></div>
    </div>
  </div>
</article>`;
    })
    .join("\n");

  const tabs = categories.length
    ? `<div class="cats">
      <button class="cat-chip active" data-cat="">${esc(t.all)}</button>
      ${categories
        .map((c) => `<button class="cat-chip" data-cat="${esc(c)}">${esc(c)}</button>`)
        .join("\n      ")}
    </div>`
    : "";

  const initial = esc(business.name.slice(0, 1).toUpperCase());

  const toolbar = products.length
    ? `<div class="toolbar" id="toolbar"><div class="tb">
    <div class="tb-brand"><div class="monogram monogram--sm">${initial}</div><span class="tb-name">${esc(business.name)}</span></div>
    <div class="tb-row">
      <div class="searchbox">${SEARCH_ICON}<input id="q" class="search" type="search" inputmode="search" autocomplete="off" placeholder="${esc(t.searchPlaceholder)}" aria-label="${esc(t.searchPlaceholder)}"></div>
      <select id="sort" class="sort" aria-label="${esc(t.sortBy)}">
        <option value="def">${esc(t.sortDefault)}</option>
        <option value="asc">${esc(t.sortCheap)}</option>
        <option value="desc">${esc(t.sortExpensive)}</option>
      </select>
    </div>
    ${tabs}
  </div></div>`
    : "";

  const empty = `<div class="empty"><div class="empty-emoji">🛍️</div><p>${esc(t.emptyTitle)}</p></div>`;
  const noResults = `<div id="nores" class="empty" hidden><div class="empty-emoji">🔍</div><p>${esc(t.notFound)}</p></div>`;

  // Count of in-stock products (sold-out are shown but not counted as "available").
  const availableCount = products.filter((p) => p.inStock).length;
  const productCount = `${availableCount} ${esc(t.available)}`;
  const canonicalUrl = `https://${esc(business.slug)}.bayaryuk.net`;
  // Prefer the landscape cover for link unfurls (≈1.91:1 ideal); fall back to
  // the logo, then any product photo. A square product shot crops badly.
  const ogImage =
    business.coverUrl || business.logoUrl || (products.find((p) => p.imageUrl)?.imageUrl ?? "");
  const ogDesc = esc(t.ogDesc(business.name));
  const pageTitle = `${esc(business.name)} — Katalog`;

  const dataJson = JSON.stringify(data)
    .replace(/[<\u2028\u2029]/g, function (c) {
      return c === "<" ? "\\u003c" : c === "\u2028" ? "\\u2028" : "\\u2029";
    });

  // JSON-LD structured data (Store + product offers) for richer Google results
  // and link unfurls. Capped at 50 items to bound page size.
  const jsonEsc = (s: string) => s.replace(/</g, "\\u003c");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${business.name} — Katalog`,
    itemListElement: products.slice(0, 50).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.name,
        ...(p.imageUrl ? { image: p.imageUrl } : {}),
        ...(p.description ? { description: p.description } : {}),
        ...(p.categoryName ? { category: p.categoryName } : {}),
        offers: {
          "@type": "Offer",
          price: String(data[i].sp),
          priceCurrency: business.currency,
          availability: p.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: canonicalUrl,
        },
      },
    })),
  };
  const jsonLdStr = jsonEsc(JSON.stringify(jsonLd));

  // Static skeleton of the detail sheet — populated by JS on card tap.
  const modal = products.length
    ? `<div class="modal" id="modal" hidden>
  <div class="modal-bg" data-close></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="m-name">
    <button class="sheet-x" data-close aria-label="Tutup">&times;</button>
    <div class="sheet-img" id="m-img"></div>
    <div class="sheet-body">
      <span class="cat" id="m-cat"></span>
      <h2 id="m-name"></h2>
      <div class="price-row"><div class="price price--lg" id="m-price"></div><span class="oos-tag" id="m-oos" hidden>${esc(t.outOfStock)}</span></div>
      <p class="m-desc" id="m-desc"></p>
      <div id="m-variants"></div>
      <a class="wa wa--lg" id="m-wa" target="_blank" rel="noopener">${WA_ICON}<span>${esc(t.askStock)}</span></a>
    </div>
  </div>
</div>`
    : "";

  return `<!doctype html>
<html lang="${esc(t.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#E3173C">
<title>${pageTitle}</title>
<meta name="description" content="${ogDesc}">
<link rel="canonical" href="${canonicalUrl}">
<link rel="icon" href="${faviconHref(business.name.slice(0, 1).toUpperCase())}">
${business.coverUrl ? `<link rel="preload" as="image" href="${esc(business.coverUrl)}" fetchpriority="high">` : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bayar Yuk">
<meta property="og:title" content="${pageTitle}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:url" content="${canonicalUrl}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${pageTitle}">
<meta name="twitter:description" content="${ogDesc}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ""}
<script type="application/ld+json" nonce="${esc(nonce)}">${jsonLdStr}</script>
<style>
  :root{
    --red:#E3173C; --red-dark:#B01230; --brand-light:#FEE9ED; --brand-lighter:#FFF5F7;
    --ink:#302D3D; --muted:#5e6675; --line:#ECEEF2; --bg:#F2F2F7; --input:#F4F7FE;
    --wa:#25D366; --wa-deep:#0E8A43; --wa-soft:#E7F8EF;
  }
  /* Brand display font (Gilroy) for headings/prices/buttons; body stays on the
     system stack. font-display:swap → if the cross-origin fetch is blocked
     (R2 CORS not yet enabled) the page renders in system fonts, no FOIT. */
  @font-face{ font-family:'Gilroy'; font-style:normal; font-weight:700; font-display:swap;
    src:url('https://images.bayaryuk.net/fonts/gilroy-bold.ttf') format('truetype'); }
  *{ box-sizing:border-box; }
  html{ -webkit-text-size-adjust:100%; scroll-behavior:smooth; }
  body{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg);
    overflow-x:hidden; -webkit-tap-highlight-color:transparent; }
  img{ max-width:100%; }
  .store,.price,.name,.cat-chip,.pill,.share-btn,.tb-name,.sheet-body h2,.vp,.vlabel,.wa,.empty p{
    font-family:'Gilroy',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }

  /* Branded hero banner — bold, centered storefront header */
  .hero{ position:relative; overflow:hidden; background:linear-gradient(135deg,var(--red) 0%, var(--red-dark) 100%); color:#fff; }
  .hero::after{ content:""; position:absolute; top:-40%; right:-15%; width:340px; height:340px; border-radius:50%;
    background:radial-gradient(circle, rgba(255,255,255,.16), rgba(255,255,255,0) 70%); pointer-events:none; }
  .hero .wrap{ position:relative; max-width:1040px; margin:0 auto; padding:40px 18px 34px; display:flex; flex-direction:column;
    align-items:center; text-align:center; gap:13px; }
  .hero .monogram{ width:74px; height:74px; border-radius:21px; background:#fff; color:var(--red); font-size:32px;
    box-shadow:0 14px 30px rgba(0,0,0,.22); }
  .logo-img{ width:78px; height:78px; flex:none; border-radius:21px; object-fit:cover; background:#fff;
    box-shadow:0 14px 30px rgba(0,0,0,.24); animation:pop .55s cubic-bezier(.22,.61,.36,1) both; }
  /* Cover/banner image behind the hero — responsive landscape band */
  .hero--cover{ min-height:clamp(200px, 46vw, 300px); }
  .hero--cover::after{ display:none; }
  .hero-cover{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0; }
  .hero--cover::before{ content:""; position:absolute; inset:0; z-index:1;
    background:linear-gradient(180deg, rgba(15,8,11,.30) 0%, rgba(120,12,30,.55) 55%, rgba(120,12,30,.88) 100%); }
  .hero--cover .wrap{ position:relative; z-index:2; padding-top:58px; padding-bottom:30px; justify-content:flex-end; }
  .hero--cover .logo-img{ box-shadow:0 14px 34px rgba(0,0,0,.4); }
  .store{ margin:0; font-size:clamp(25px,7vw,33px); line-height:1.08; font-weight:800; letter-spacing:-.025em; color:#fff;
    overflow-wrap:anywhere; animation:rise .55s cubic-bezier(.22,.61,.36,1) .05s both; }
  .meta{ display:flex; align-items:center; justify-content:center; gap:9px; flex-wrap:wrap;
    animation:rise .55s cubic-bezier(.22,.61,.36,1) .12s both; }
  .pill{ background:rgba(255,255,255,.22); color:#fff; font-weight:800; font-size:10.5px; letter-spacing:.05em; padding:5px 11px; border-radius:999px; }
  .meta .dot{ color:rgba(255,255,255,.9); font-size:13px; font-weight:600; }
  .share-btn{ margin-top:4px; display:inline-flex; align-items:center; gap:7px; cursor:pointer; font-family:inherit;
    font-weight:800; font-size:13px; color:#fff; background:rgba(255,255,255,.15); border:1.5px solid rgba(255,255,255,.4); border-radius:999px;
    padding:9px 16px; transition:background .16s, color .16s, transform .12s;
    animation:rise .55s cubic-bezier(.22,.61,.36,1) .18s both; }
  .share-btn:hover{ background:#fff; color:var(--red); border-color:#fff; }
  .share-btn:active{ transform:scale(.96); }
  /* base monogram (used in the white sticky toolbar) keeps the red gradient */
  .monogram{ width:64px; height:64px; flex:none; border-radius:19px; background:linear-gradient(135deg,var(--red),var(--red-dark));
    color:#fff; display:grid; place-items:center; font-weight:800; font-size:28px; box-shadow:0 10px 24px rgba(227,23,60,.30);
    animation:pop .55s cubic-bezier(.22,.61,.36,1) both; }

  /* Solid background (no backdrop blur) — a blurred sticky bar re-composites the
     whole page behind it every scroll frame, which tanks fps on mobile. */
  .toolbar{ position:sticky; top:0; z-index:30; background:#fff; border-bottom:1px solid var(--line);
    transition:box-shadow .2s ease; }
  .toolbar.scrolled{ box-shadow:0 2px 12px rgba(20,22,40,.06); }
  .tb{ max-width:1040px; margin:0 auto; padding:12px 18px; display:flex; flex-direction:column; gap:11px; }
  .tb-brand{ display:flex; align-items:center; justify-content:center; gap:10px; max-height:0; opacity:0; overflow:hidden;
    transition:max-height .28s ease, opacity .24s ease; }
  .toolbar.scrolled .tb-brand{ max-height:42px; opacity:1; }
  .monogram--sm{ width:32px; height:32px; border-radius:10px; font-size:15px; box-shadow:none; animation:none; }
  .tb-name{ font-weight:800; font-size:16px; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .tb-row{ display:flex; align-items:stretch; gap:8px; }
  .searchbox{ position:relative; display:flex; align-items:center; flex:1; min-width:0; }
  .searchbox svg{ position:absolute; left:14px; color:var(--muted); pointer-events:none; }
  .sort{ flex:none; border:1.5px solid transparent; background:var(--input); color:var(--ink); font-family:inherit; font-weight:700;
    font-size:16px; border-radius:13px; padding:0 30px 0 14px; cursor:pointer; outline:none; transition:border-color .18s;
    -webkit-appearance:none; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%237b8190' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 9px center; }
  .sort:focus{ border-color:var(--red); }
  /* 16px font-size avoids iOS Safari auto-zooming the page on focus. */
  .search{ width:100%; border:1.5px solid transparent; background:var(--input); border-radius:13px; padding:12px 14px 12px 42px;
    font-size:16px; font-family:inherit; color:var(--ink); outline:none; transition:border-color .18s, background .18s; }
  .search::placeholder{ color:#9aa0ad; }
  .search:focus{ border-color:var(--red); background:#fff; }
  .cats{ display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding:2px; margin:-2px; }
  .cats::-webkit-scrollbar{ display:none; }
  .cat-chip{ flex:none; border:1.5px solid var(--line); background:#fff; color:var(--muted); font-family:inherit; font-weight:700;
    font-size:13px; padding:8px 15px; border-radius:999px; cursor:pointer; white-space:nowrap; transition:all .18s ease; }
  .cat-chip:hover{ border-color:#dadfe8; color:var(--ink); }
  .cat-chip.active{ background:var(--red); border-color:var(--red); color:#fff; box-shadow:0 6px 14px rgba(227,23,60,.26); }

  main{ max-width:1040px; margin:0 auto; padding:18px; }
  /* Capped columns (2 → 3 → 4) so wide screens don't cram in 5-6 tiny cards. */
  .grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
  @media (min-width:560px){ .grid{ grid-template-columns:repeat(3,minmax(0,1fr)); } }
  @media (min-width:860px){ .grid{ grid-template-columns:repeat(4,minmax(0,1fr)); } }

  .card{ position:relative; background:#fff; border:1px solid var(--line); border-radius:16px; overflow:hidden; display:flex; flex-direction:column; cursor:pointer;
    opacity:0; animation:fadeUp .5s cubic-bezier(.22,.61,.36,1) forwards; animation-delay:calc(var(--i,0)*42ms);
    transition:transform .22s ease, box-shadow .22s ease, border-color .2s ease; }
  .card-inner{ display:flex; flex-direction:column; flex:1; }
  .card:hover{ transform:translateY(-4px); box-shadow:0 14px 30px rgba(22,24,40,.11); border-color:#e6e9ef; }
  .card:focus-visible{ outline:2px solid var(--red); outline-offset:2px; }
  .card:active{ transform:translateY(-1px); }
  .thumb-wrap{ position:relative; }
  /* Sold-out: drain the photo + text to greyscale + dim, then stamp an angled
     red banner across the IMAGE centre (kept outside the filter so it stays
     brand-red) — mirrors the sales-grid design. */
  .card--oos .thumb, .card--oos .body{ filter:grayscale(1) brightness(.96); opacity:.58; }
  .card--oos:hover{ transform:none; box-shadow:none; border-color:var(--line); }
  .oos-banner{ position:absolute; left:-6px; right:-6px; top:50%; transform:translateY(-50%) rotate(-3deg); z-index:2;
    background:var(--red); color:#fff; text-align:center; font-weight:800; font-size:11px; letter-spacing:.4px; text-transform:uppercase;
    padding:6px 8px; box-shadow:0 3px 8px rgba(0,0,0,.35); pointer-events:none;
    font-family:'Gilroy',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .thumb{ width:100%; aspect-ratio:1/1; object-fit:cover; background:#f0f1f5; display:block; }
  .thumb--empty{ display:grid; place-items:center; color:#c4cad6; background:linear-gradient(135deg,#f6f7fb,#eef0f6); }
  .thumb--empty svg{ width:38px; height:38px; }
  .body{ padding:13px; display:flex; flex-direction:column; gap:5px; flex:1; }
  .cat{ font-size:10.5px; color:var(--red); font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
  .name{ font-size:15px; margin:0; line-height:1.25; font-weight:700; }
  .vcount{ font-size:11px; color:var(--muted); font-weight:600; }
  .foot{ margin-top:auto; padding-top:8px; display:flex; align-items:center; justify-content:space-between; }
  .price{ font-weight:800; font-size:16px; letter-spacing:-.01em; }
  .chev{ color:var(--red); font-size:20px; font-weight:700; line-height:1; opacity:.55; transition:transform .2s, opacity .2s; }
  .card:hover .chev{ transform:translateX(2px); opacity:1; }

  /* Detail sheet */
  .modal{ position:fixed; inset:0; z-index:60; display:flex; align-items:flex-end; justify-content:center; }
  .modal[hidden]{ display:none; }
  #nores[hidden]{ display:none; }
  .modal-bg{ position:absolute; inset:0; background:rgba(20,22,34,.5); opacity:0; transition:opacity .24s ease; }
  .modal.open .modal-bg{ opacity:1; }
  .sheet{ position:relative; width:100%; max-width:460px; max-height:92vh; overflow-y:auto; background:#fff; border-radius:22px 22px 0 0;
    transform:translateY(100%); opacity:0; transition:transform .3s cubic-bezier(.22,.61,.36,1), opacity .26s ease; -webkit-overflow-scrolling:touch;
    scrollbar-width:none; }
  .sheet::-webkit-scrollbar{ display:none; }
  .modal.open .sheet{ transform:none; opacity:1; }
  .sheet-x{ position:absolute; top:12px; right:12px; z-index:2; width:34px; height:34px; border:none; border-radius:999px;
    background:rgba(255,255,255,.9); color:var(--ink); font-size:22px; line-height:1; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.12); }
  .sheet-img{ width:100%; aspect-ratio:1/1; background:#f0f1f5; display:block; }
  .sheet-img img{ width:100%; height:100%; object-fit:cover; display:block; cursor:zoom-in; }

  /* Fullscreen image zoom (lightbox) */
  .lightbox{ position:fixed; inset:0; z-index:80; display:flex; align-items:center; justify-content:center; padding:20px;
    background:rgba(8,9,14,.92); opacity:0; transition:opacity .2s ease; cursor:zoom-out; }
  .lightbox.open{ opacity:1; }
  .lightbox[hidden]{ display:none; }
  .lightbox img{ max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; }
  .sheet-img--empty{ display:grid; place-items:center; color:#c4cad6; background:linear-gradient(135deg,#f6f7fb,#eef0f6); }
  .sheet-img--empty svg{ width:72px; height:72px; }
  .sheet-body{ padding:18px 18px 24px; display:flex; flex-direction:column; gap:8px; }
  .sheet-body h2{ margin:0; font-size:21px; font-weight:800; letter-spacing:-.02em; line-height:1.2; }
  .price--lg{ font-size:22px; color:var(--red); }
  .price-row{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .oos-tag{ background:var(--brand-light); color:var(--red); font-weight:800; font-size:11px; letter-spacing:.4px; text-transform:uppercase;
    padding:4px 10px; border-radius:999px; }
  .oos-tag[hidden]{ display:none; }
  .m-desc{ margin:2px 0 0; font-size:14px; line-height:1.5; color:#525a68; white-space:pre-line; }
  .vlabel{ margin-top:10px; font-size:11px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); }
  .vrow{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; margin-top:8px;
    background:var(--input); border-radius:12px; text-decoration:none; color:var(--ink); transition:background .16s; }
  a.vrow:hover{ background:#e9eefb; }
  a.vrow:active{ background:#e1e8f8; }
  .vrow--out{ opacity:.55; }
  .vn{ font-weight:700; font-size:14px; }
  .vp{ font-weight:800; font-size:14px; color:var(--red); white-space:nowrap; }
  .vrow--out .vp{ color:var(--muted); }

  .wa{ display:flex; align-items:center; justify-content:center; gap:8px; text-decoration:none; font-weight:800; border-radius:13px;
    background:var(--wa-soft); color:var(--wa-deep); transition:background .18s ease, color .18s ease, transform .12s ease; }
  .wa--lg{ margin-top:14px; padding:14px; font-size:15px; }
  .wa--lg:hover{ background:var(--wa-deep); color:#fff; }
  .wa--lg:active{ transform:scale(.98); }

  .empty{ text-align:center; color:var(--muted); padding:64px 18px; }
  .empty-emoji{ font-size:40px; margin-bottom:10px; }
  .empty p{ margin:0; font-size:14px; }

  footer{ text-align:center; padding:34px 18px 48px; }
  .poweredby{ display:inline-flex; flex-direction:column; align-items:center; gap:9px; color:var(--muted); font-size:12px; font-weight:600; }
  .brandlogo svg{ height:24px; width:auto; display:block; opacity:.92; }

  .totop{ position:fixed; right:18px; bottom:calc(18px + env(safe-area-inset-bottom, 0px)); z-index:50; width:46px; height:46px; border:none; border-radius:999px; cursor:pointer;
    background:var(--red); color:#fff; display:grid; place-items:center; box-shadow:0 8px 20px rgba(227,23,60,.34);
    opacity:0; transform:translateY(12px) scale(.9); pointer-events:none; transition:opacity .22s ease, transform .22s ease; }
  .totop.show{ opacity:1; transform:none; pointer-events:auto; }
  .totop:active{ transform:scale(.94); }
  .toast{ position:fixed; left:50%; bottom:26px; transform:translate(-50%,16px); z-index:70; background:var(--ink); color:#fff;
    font-size:13px; font-weight:600; padding:11px 18px; border-radius:999px; box-shadow:0 8px 24px rgba(0,0,0,.22);
    opacity:0; pointer-events:none; transition:opacity .22s ease, transform .22s ease; }
  .toast.show{ opacity:1; transform:translate(-50%,0); }

  @keyframes fadeUp{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
  @keyframes rise{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:none; } }
  @keyframes pop{ from{ opacity:0; transform:scale(.8); } to{ opacity:1; transform:none; } }

  @media (max-width:480px){
    main{ padding:14px; }
    .grid{ gap:13px; }
    .hero .wrap{ padding:26px 16px 22px; }
    .tb{ padding:11px 16px; }
    .cat-chip{ padding:9px 15px; }       /* ~40px tap target */
    .sheet-body{ padding:16px 16px calc(22px + env(safe-area-inset-bottom, 0px)); }
    footer{ padding-bottom:calc(40px + env(safe-area-inset-bottom, 0px)); }
  }
  @media (min-width:560px){ .modal{ align-items:center; } .sheet{ border-radius:22px; max-height:88vh; } .modal .sheet{ transform:translateY(16px) scale(.98); } .modal.open .sheet{ transform:none; } }
  @media (prefers-reduced-motion: reduce){ *{ animation:none !important; transition:none !important; } .card{ opacity:1 !important; } html{ scroll-behavior:auto; } }
</style>
</head>
<body>
<div class="hero${business.coverUrl ? " hero--cover" : ""}">
  ${business.coverUrl ? `<img class="hero-cover" src="${esc(business.coverUrl)}" alt="" aria-hidden="true" fetchpriority="high" decoding="async">` : ""}
  <div class="wrap">
  ${
    business.logoUrl
      ? `<img class="logo-img" src="${esc(business.logoUrl)}" alt="${esc(business.name)}">`
      : `<div class="monogram">${initial}</div>`
  }
  <h1 class="store">${esc(business.name)}</h1>
  <div class="meta"><span class="pill">${esc(t.catalogOnline)}</span><span class="dot">${productCount}</span></div>
  <button class="share-btn" id="share" type="button" aria-label="${esc(t.share)}">${SHARE_ICON}<span>${esc(t.share)}</span></button>
</div></div>
<div id="sentinel"></div>
${toolbar}
<main>
  ${products.length ? `<div class="grid" id="grid">${cards}</div>${noResults}` : empty}
</main>
<footer>
  <div class="poweredby"><span>${esc(t.poweredBy)}</span><span class="brandlogo">${BRAND_LOGO}</span></div>
</footer>
<button class="totop" id="totop" type="button" aria-label="Atas">${UP_ICON}</button>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
${modal}
${products.length ? `<div class="lightbox" id="lightbox" hidden><img id="lb-img" alt=""></div>` : ""}
<script nonce="${esc(nonce)}">
(function(){
  var P = ${dataJson};
  var OOS = ${JSON.stringify(t.outOfStock)};
  var VLABEL = ${JSON.stringify(t.optionsLabel)};
  var PH = ${JSON.stringify(PLACEHOLDER_ICON)};
  var SHARE_URL = ${JSON.stringify(canonicalUrl)};
  var SHARE_TITLE = ${JSON.stringify(`${business.name} — Katalog`)};
  var COPIED = ${JSON.stringify(t.linkCopied)};

  /* ---- search + category filter ---- */
  var q = document.getElementById('q');
  var nores = document.getElementById('nores');
  var grid = document.getElementById('grid');
  var cards = [].slice.call(document.querySelectorAll('.card'));
  var chips = [].slice.call(document.querySelectorAll('.cat-chip'));
  var activeCat = '';
  function norm(s){ return (s || '').toString().toLowerCase().trim(); }
  function apply(restagger){
    var term = norm(q ? q.value : ''), i = 0, shown = 0;
    for (var n = 0; n < cards.length; n++){
      var c = cards[n];
      var okCat = !activeCat || c.getAttribute('data-cat') === activeCat;
      var okTerm = !term || (c.getAttribute('data-name') || '').indexOf(term) > -1;
      if (okCat && okTerm){
        c.style.display = '';
        if (restagger){ c.style.setProperty('--i', i); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; }
        i++; shown++;
      } else { c.style.display = 'none'; }
    }
    if (nores) nores.hidden = shown > 0;
  }
  for (var k = 0; k < chips.length; k++){
    chips[k].addEventListener('click', (function(chip){
      return function(){
        for (var j = 0; j < chips.length; j++) chips[j].classList.remove('active');
        chip.classList.add('active');
        activeCat = chip.getAttribute('data-cat') || '';
        if (chip.scrollIntoView) chip.scrollIntoView({ inline: 'center', block: 'nearest' });
        apply(true);
      };
    })(chips[k]));
  }
  if (q) q.addEventListener('input', function(){ apply(false); });

  /* ---- collapsing header ---- */
  var sentinel = document.getElementById('sentinel');
  var toolbar = document.getElementById('toolbar');
  if (window.IntersectionObserver && sentinel && toolbar){
    new IntersectionObserver(function(es){
      toolbar.classList.toggle('scrolled', !es[0].isIntersecting);
    }, { rootMargin: '-4px 0px 0px 0px' }).observe(sentinel);
  }

  /* ---- product detail sheet ---- */
  var modal = document.getElementById('modal');
  var lightbox = document.getElementById('lightbox');
  var lbImg = document.getElementById('lb-img');
  var lastFocused = null;
  var curIdx = -1;
  function el(tag, cls){ var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function openModal(idx){
    var d = P[idx]; if (!d || !modal) return;
    lastFocused = document.activeElement; curIdx = idx;
    var imgWrap = document.getElementById('m-img');
    imgWrap.innerHTML = '';
    if (d.img){ imgWrap.className = 'sheet-img'; var im = el('img'); im.src = d.img; im.alt = d.n; imgWrap.appendChild(im); }
    else { imgWrap.className = 'sheet-img sheet-img--empty'; imgWrap.innerHTML = PH; }
    var cat = document.getElementById('m-cat'); cat.textContent = d.c || ''; cat.style.display = d.c ? '' : 'none';
    document.getElementById('m-name').textContent = d.n || '';
    document.getElementById('m-price').textContent = d.pr || d.p || '';
    var oosTag = document.getElementById('m-oos'); if (oosTag) oosTag.hidden = !d.oos;
    var desc = document.getElementById('m-desc'); desc.textContent = d.d || ''; desc.style.display = d.d ? '' : 'none';
    var vc = document.getElementById('m-variants'); vc.innerHTML = '';
    if (d.v && d.v.length){
      var lab = el('div', 'vlabel'); lab.textContent = VLABEL; vc.appendChild(lab);
      for (var i = 0; i < d.v.length; i++){
        var v = d.v[i], row;
        if (v.s && v.w){ row = el('a', 'vrow'); row.href = v.w; row.target = '_blank'; row.rel = 'noopener'; }
        else { row = el('div', 'vrow vrow--out'); }
        var nm = el('span', 'vn'); nm.textContent = v.n; row.appendChild(nm);
        var pr = el('span', 'vp'); pr.textContent = v.s ? v.p : OOS; row.appendChild(pr);
        vc.appendChild(row);
      }
    }
    var waBtn = document.getElementById('m-wa');
    if (d.w){ waBtn.href = d.w; waBtn.style.display = ''; } else { waBtn.style.display = 'none'; }
    clearTimeout(closeT);
    var sheetEl = modal.querySelector('.sheet');
    if (sheetEl) sheetEl.scrollTop = 0;
    modal.hidden = false; document.body.style.overflow = 'hidden';
    var xb = modal.querySelector('.sheet-x'); if (xb) xb.focus();
    // Double rAF so the sheet's off-screen start state is painted before the
    // .open class flips it on — guarantees a smooth slide-up every time.
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ modal.classList.add('open'); }); });
  }
  var closeT;
  function closeModal(){
    if (!modal) return;
    modal.classList.remove('open'); document.body.style.overflow = '';
    // Hide exactly when the sheet finishes fading/sliding out (transitionend),
    // so it never lingers visibly or pops out mid-animation. setTimeout is a
    // fallback in case the transition doesn't fire.
    var sheetEl = modal.querySelector('.sheet');
    var done = false;
    function finish(){
      if (done) return;
      done = true;
      if (sheetEl) sheetEl.removeEventListener('transitionend', onEnd);
      modal.hidden = true;
    }
    function onEnd(e){
      if (e.target === sheetEl && (e.propertyName === 'transform' || e.propertyName === 'opacity')) finish();
    }
    if (sheetEl) sheetEl.addEventListener('transitionend', onEnd);
    clearTimeout(closeT);
    closeT = setTimeout(finish, 380);
    curIdx = -1;
    if (lastFocused && lastFocused.focus){ try { lastFocused.focus(); } catch (e) {} }
  }
  // History integration: opening pushes a state (#p=idx) so the device Back
  // button / swipe closes the sheet instead of leaving the page, and a shared
  // #p=idx link deep-opens that product.
  function openProduct(idx){
    if (!P[idx]) return;
    openModal(idx);
    try { history.pushState({ m: idx }, '', '#p=' + idx); } catch (e) {}
  }
  function requestClose(){
    if (history.state && history.state.m != null){ history.back(); }
    else { closeModal(); }
  }
  window.addEventListener('popstate', function(ev){
    var st = ev.state;
    if (st && st.m != null){ if (modal && modal.hidden) openModal(st.m); }
    else { closeModal(); }
  });
  if (grid){
    grid.addEventListener('click', function(e){ var c = e.target.closest('.card'); if (c) openProduct(+c.getAttribute('data-idx')); });
    grid.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){ var c = e.target.closest('.card'); if (c){ e.preventDefault(); openProduct(+c.getAttribute('data-idx')); } }
    });
  }
  if (modal){
    modal.addEventListener('click', function(e){ if (e.target.hasAttribute('data-close')) requestClose(); });
    // Trap Tab within the open sheet (accessibility).
    modal.addEventListener('keydown', function(e){
      if (e.key !== 'Tab') return;
      var f = [].slice.call(modal.querySelectorAll('a[href],button,select,textarea,input,[tabindex]:not([tabindex="-1"])'))
        .filter(function(x){ return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
  }

  /* ---- image lightbox (tap the detail photo to zoom) ---- */
  var lbT;
  function openLightbox(src){
    if (!lightbox || !lbImg) return;
    lbImg.src = src; lightbox.hidden = false;
    requestAnimationFrame(function(){ lightbox.classList.add('open'); });
  }
  function closeLightbox(){
    if (!lightbox) return;
    lightbox.classList.remove('open');
    clearTimeout(lbT); lbT = setTimeout(function(){ lightbox.hidden = true; lbImg.src = ''; }, 220);
  }
  if (lightbox) lightbox.addEventListener('click', closeLightbox);
  var mImg = document.getElementById('m-img');
  if (mImg) mImg.addEventListener('click', function(){ var d = P[curIdx]; if (d && d.img) openLightbox(d.img); });

  // Single Esc handler: lightbox first, then the sheet.
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    if (lightbox && !lightbox.hidden) closeLightbox();
    else if (modal && !modal.hidden) requestClose();
  });

  /* ---- sort ---- */
  var sortSel = document.getElementById('sort');
  var cardsOrig = cards.slice();
  if (sortSel && grid){
    sortSel.addEventListener('change', function(){
      var v = sortSel.value, order;
      if (v === 'asc' || v === 'desc'){
        order = cards.slice().sort(function(a, b){
          var pa = +a.getAttribute('data-price') || 0, pb = +b.getAttribute('data-price') || 0;
          return v === 'asc' ? pa - pb : pb - pa;
        });
      } else { order = cardsOrig.slice(); }
      for (var i = 0; i < order.length; i++) grid.appendChild(order[i]);
      cards = order;
      apply(true);
    });
  }

  // Deep link: open #p=idx on load, normalising history so Back returns to the grid.
  (function(){
    var m = location.hash.match(/^#p=(\\d+)$/);
    if (m && P[+m[1]]){
      try { history.replaceState({}, '', location.pathname + location.search); } catch (e) {}
      openProduct(+m[1]);
    }
  })();

  /* ---- toast ---- */
  var toast = document.getElementById('toast');
  var toastT;
  function showToast(msg){
    if (!toast) return;
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function(){ toast.classList.remove('show'); }, 2200);
  }

  /* ---- share ---- */
  var shareBtn = document.getElementById('share');
  if (shareBtn){
    shareBtn.addEventListener('click', function(){
      if (navigator.share){
        navigator.share({ title: SHARE_TITLE, url: SHARE_URL }).catch(function(){});
      } else if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(SHARE_URL).then(function(){ showToast(COPIED); }).catch(function(){});
      } else {
        showToast(SHARE_URL);
      }
    });
  }

  /* ---- back to top ---- */
  var totop = document.getElementById('totop');
  if (totop){
    var ticking = false;
    function onScroll(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        totop.classList.toggle('show', (window.pageYOffset || document.documentElement.scrollTop) > 600);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    totop.addEventListener('click', function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
})();
</script>
</body>
</html>`;
}

export function renderNotFoundPage(): string {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Katalog tidak ditemukan</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#F2F2F7;color:#302D3D;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px}h1{font-size:20px;margin:0 0 6px}p{color:#7b8190;margin:0}</style>
</head><body><div><h1>Katalog tidak ditemukan</h1><p>Tautan ini mungkin salah atau katalog sedang tidak aktif.</p></div></body></html>`;
}
