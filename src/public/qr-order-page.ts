import type { QrKind, QrMenu, QrShop } from "../qr-order/qr-order.service"

/**
 * The diner's QR menu page (docs/modules/FNB.md P6; mockups
 * docs/design/fnb-mockups/phone/10_qr_menu + 10b_qr_status in the FE repo).
 *
 * One self-contained HTML response, like the store page: inline CSS + one
 * nonce'd script. Browsing, options and the cart run on the phone (0 requests);
 * only "Pesan" and the status checks reach the server. The cart and the
 * diner's submissions live in localStorage, so a refresh never loses them.
 * Copy is Indonesian; the brand is "Bayar Yuk!".
 */

const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export interface QrPageInput {
    shop: QrShop
    token: string
    kind: QrKind
    tableName: string | null
    menu: QrMenu
    /** Where submit/status go: "" (front door, same origin), or a full base. */
    apiBase: string
}

export function renderQrOrderPage(input: QrPageInput, nonce: string): string {
    const { shop, token, kind, tableName, menu, apiBase } = input
    const data = {
        token,
        kind,
        table: tableName,
        api: apiBase,
        shop: shop.name,
        categories: menu.categories,
        items: menu.items.map(({ hasTax: _hasTax, ...i }) => i),
        groups: menu.groups,
    }
    const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "")
    const initials = shop.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "B"
    const where = kind === "counter" ? "Bawa pulang · bayar di kasir" : `Meja ${esc(tableName ?? "")} · bayar di kasir setelah makan`
    return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#E3173C">
<title>${esc(shop.name)} · Pesan</title>
<style>
  :root{ --red:#E3173C; --red-dark:#B01230; --brand-light:#FEE9ED; --ink:#302D3D; --muted:#6B7280; --line:#ECEEF2;
    --bg:#F2F2F7; --input:#F4F7FE; --ok:#15803D; --ok-bg:#E8F7EE; --warn:#B45F06; --warn-bg:#FFF4E5; }
  @font-face{ font-family:'Gilroy'; font-weight:700; font-display:swap; src:url('https://images.bayaryuk.net/fonts/gilroy-bold.ttf') format('truetype'); }
  *{ box-sizing:border-box; } html{ -webkit-text-size-adjust:100%; }
  body{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Helvetica,Arial,sans-serif; color:var(--ink);
    background:#fff; -webkit-tap-highlight-color:transparent; }
  h1,h2,h3,.price,.btn,.chip,.qty b,.bar b{ font-family:'Gilroy',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap{ max-width:560px; margin:0 auto; padding:0 16px 120px; }
  header{ display:flex; gap:12px; align-items:center; padding:18px 0 10px; }
  .mono{ width:48px; height:48px; border-radius:12px; background:var(--ink); color:#fff; display:grid; place-items:center; font-weight:800; flex:none; }
  .mono img{ width:48px; height:48px; border-radius:12px; object-fit:cover; }
  header h1{ margin:0; font-size:19px; } header p{ margin:2px 0 0; color:var(--muted); font-size:13px; }
  .chips{ display:flex; gap:8px; overflow-x:auto; padding:8px 0 12px; position:sticky; top:0; background:#fff; z-index:2; scrollbar-width:none; }
  .chips::-webkit-scrollbar{ display:none; }
  .chip{ flex:none; border:1px solid var(--line); background:#fff; border-radius:999px; padding:9px 15px; font-size:14px; color:var(--ink); cursor:pointer; }
  .chip.on{ background:var(--ink); border-color:var(--ink); color:#fff; }
  .item{ display:flex; gap:14px; align-items:center; padding:14px 0; border-bottom:1px solid var(--line); }
  .pic{ width:72px; height:72px; border-radius:14px; flex:none; display:grid; place-items:center; font-size:32px; overflow:hidden; }
  .pic img{ width:100%; height:100%; object-fit:cover; }
  .meta{ flex:1; min-width:0; } .meta h3{ margin:0; font-size:15.5px; } .meta p{ margin:3px 0 4px; color:var(--muted); font-size:12.5px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .price{ font-size:14.5px; }
  .add{ width:38px; height:38px; border-radius:50%; border:none; background:var(--red); color:#fff; font-size:22px; line-height:1; cursor:pointer; flex:none; }
  .qty{ display:flex; align-items:center; gap:10px; } .qty button{ width:32px; height:32px; border-radius:50%; border:none; background:var(--brand-light);
    color:var(--red); font-size:20px; line-height:1; cursor:pointer; } .qty b{ min-width:14px; text-align:center; }
  .bar{ position:fixed; left:12px; right:12px; bottom:calc(12px + env(safe-area-inset-bottom)); max-width:536px; margin:0 auto; background:var(--red); color:#fff;
    border-radius:16px; padding:12px 14px; display:none; align-items:center; gap:12px; box-shadow:0 10px 30px rgba(227,23,60,.35); cursor:pointer; border:none; width:calc(100% - 24px); text-align:left; }
  .bar.show{ display:flex; } .bar .n{ width:34px; height:34px; border-radius:10px; background:rgba(255,255,255,.2); display:grid; place-items:center; font-weight:800; }
  .bar small{ display:block; opacity:.85; font-size:12px; } .bar .go{ margin-left:auto; font-weight:700; }
  .scrim{ position:fixed; inset:0; background:rgba(20,18,28,.45); opacity:0; pointer-events:none; transition:opacity .16s linear; z-index:9; }
  .scrim.on{ opacity:1; pointer-events:auto; }
  .sheet{ position:fixed; left:0; right:0; bottom:0; max-height:88vh; overflow:auto; background:#fff; border-radius:20px 20px 0 0; z-index:10;
    transform:translateY(105%); transition:transform .32s cubic-bezier(.22,1,.36,1); padding:8px 18px calc(18px + env(safe-area-inset-bottom)); max-width:560px; margin:0 auto; }
  .sheet.on{ transform:none; } .grab{ width:40px; height:5px; border-radius:3px; background:#D9DCE5; margin:4px auto 12px; }
  .sheet h2{ margin:0 0 4px; font-size:20px; } .muted{ color:var(--muted); font-size:13px; }
  .group{ margin-top:16px; } .group h4{ margin:0 0 8px; font-size:14.5px; display:flex; gap:8px; align-items:center; }
  .tag{ font-size:11px; padding:2px 8px; border-radius:6px; background:var(--input); color:var(--muted); font-weight:700; }
  .tag.req{ background:var(--brand-light); color:var(--red); }
  .opt{ display:flex; align-items:center; gap:12px; padding:11px 12px; border:1.5px solid var(--line); border-radius:12px; margin-bottom:8px; cursor:pointer; }
  .opt.on{ border-color:var(--red); background:#FFF5F7; } .opt .tick{ width:20px; height:20px; border-radius:50%; border:2px solid #C9CDD8; flex:none; }
  .opt.on .tick{ border-color:var(--red); background:radial-gradient(circle,var(--red) 45%,transparent 50%); } .opt span{ flex:1; } .opt em{ font-style:normal; color:var(--muted); font-size:13px; }
  textarea,input{ width:100%; border:none; background:var(--input); border-radius:12px; padding:12px; font:inherit; font-size:14.5px; color:var(--ink); }
  textarea{ resize:none; height:64px; }
  .row{ display:flex; align-items:center; gap:12px; margin-top:16px; }
  .btn{ flex:1; border:none; border-radius:14px; background:var(--red); color:#fff; font-size:16px; padding:15px; cursor:pointer; }
  .btn:disabled{ background:#D9DCE5; color:#7a7f8c; } .btn.ghost{ background:#fff; color:var(--red); border:1.5px solid var(--red); }
  .line{ display:flex; gap:10px; padding:12px 0; border-bottom:1px solid var(--line); align-items:flex-start; }
  .line .meta p{ white-space:normal; }
  .sum{ display:flex; justify-content:space-between; padding:14px 0 4px; font-size:17px; } .sum b{ font-size:20px; }
  .card{ background:#fff; border-radius:16px; padding:18px; margin-top:16px; border:1px solid var(--line); }
  .hero{ text-align:center; } .hero .big{ width:64px; height:64px; border-radius:50%; display:grid; place-items:center; margin:4px auto 10px; font-size:30px; }
  .steps{ display:flex; justify-content:space-around; margin-top:16px; } .step{ text-align:center; font-size:12.5px; color:#9aa0ad; }
  .step i{ display:grid; place-items:center; width:40px; height:40px; border-radius:50%; background:#F0F1F5; margin:0 auto 6px; font-style:normal; font-size:18px; }
  .step.on{ color:var(--ok); font-weight:700; } .step.on i{ background:var(--ok); color:#fff; }
  .step.now{ color:var(--warn); font-weight:700; } .step.now i{ background:var(--warn-bg); }
  .rh{ display:flex; gap:8px; align-items:center; font-size:12px; font-weight:700; color:var(--muted); letter-spacing:.5px; margin-top:12px; }
  .pill{ font-size:11.5px; padding:3px 8px; border-radius:8px; background:var(--input); } .pill.ok{ background:var(--ok-bg); color:var(--ok); } .pill.warn{ background:var(--warn-bg); color:var(--warn); }
  .toast{ position:fixed; left:50%; top:16px; transform:translateX(-50%); background:var(--ink); color:#fff; padding:10px 16px; border-radius:12px; font-size:14px; z-index:20; display:none; }
  .toast.on{ display:block; }
  .center{ text-align:center; } footer{ text-align:center; color:var(--muted); font-size:12.5px; margin-top:18px; }
  @media (prefers-reduced-motion: reduce){ .sheet,.scrim{ transition:none; } }
</style>
</head>
<body>
<div class="wrap" id="app">
  <header>
    <div class="mono">${shop.logoUrl ? `<img src="${esc(shop.logoUrl)}" alt="">` : esc(initials)}</div>
    <div><h1>${esc(shop.name)}</h1><p>${where}</p></div>
  </header>
  <div id="view"></div>
</div>
<button class="bar" id="bar" type="button"></button>
<div class="scrim" id="scrim"></div>
<div class="sheet" id="sheet" role="dialog" aria-modal="true"></div>
<div class="toast" id="toast" role="status"></div>
<script type="application/json" id="data">${json}</script>
<script nonce="${esc(nonce)}">
(function(){
  var D = JSON.parse(document.getElementById('data').textContent);
  var K = 'byqr:' + D.token;
  var EMO = [['coffee','☕'],['cafe','☕'],['tea','🍵'],['drink','🥤'],['juice','🧃'],['bar','🍹'],['liquor','🍹'],['wine','🍷'],['icecream','🍨'],['cake','🍰'],['bakery','🥐'],['cookie','🍪'],['ramen','🍜'],['noodle','🍜'],['soup','🍲'],['rice','🍚'],['egg','🍳'],['pizza','🍕'],['burger','🍔'],['lunch','🍱'],['dinner','🍛'],['restaurant','🍛'],['fastfood','🍟'],['set_meal','🍱'],['kebab','🥙'],['outdoor_grill','🍢'],['fish','🐟']];
  var TINT = ['#FFE9D6','#FDE2E4','#FFF3C4','#DFF3E4','#E3ECFF','#F1E3FF'];
  var items = {}; D.items.forEach(function(i){ items[i.id] = i; });
  var groups = {}; D.groups.forEach(function(g){ groups[g.id] = g; });
  var cats = {}; D.categories.forEach(function(c){ cats[c.id] = c; });
  function load(k, d){ try { var v = localStorage.getItem(K + k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }
  function save(k, v){ try { localStorage.setItem(K + k, JSON.stringify(v)); } catch(e){} }
  var cart = load(':cart', []).filter(function(l){ return items[l.itemId]; });
  var subs = load(':subs', []);
  var view = 'menu', cat = D.categories.length ? D.categories[0].id : null, poll = null, pollMs = 10000;
  function rp(n){ return 'Rp ' + Math.round(n).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.'); }
  function h(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function emoji(i){ var c = cats[i.categoryId], n = ((c && c.icon) || '') + ' ' + i.name.toLowerCase();
    for (var x = 0; x < EMO.length; x++) if (n.indexOf(EMO[x][0]) >= 0) return EMO[x][1]; return '🍽️'; }
  function pic(i){ return '<div class="pic" style="background:' + TINT[(i.categoryId || 0) % TINT.length] + '">' + (i.imageUrl ? '<img src="' + h(i.imageUrl) + '" alt="" loading="lazy">' : emoji(i)) + '</div>'; }
  function simple(i){ return !i.variants.length && !i.groups.length; }
  function unit(l){ var i = items[l.itemId], base = i.price, extra = 0;
    if (i.variants.length){ var v = i.variants.filter(function(v){ return v.id === l.variantId; })[0]; if (v) base = v.price; }
    i.groups.forEach(function(gid){ var g = groups[gid]; if (!g) return;
      var ch = g.options.filter(function(o){ return l.modifierIds.indexOf(o.id) >= 0; }).sort(function(a,b){ return b.price - a.price; });
      ch.forEach(function(o, k){ if (k >= g.free) extra += o.price; }); });
    return base + extra; }
  function details(l){ var i = items[l.itemId], out = [];
    if (i.variants.length){ var v = i.variants.filter(function(v){ return v.id === l.variantId; })[0]; if (v) out.push(v.name); }
    i.groups.forEach(function(gid){ var g = groups[gid]; if (!g) return; g.options.forEach(function(o){ if (l.modifierIds.indexOf(o.id) >= 0) out.push((o.price > 0 ? '+ ' : '') + o.name); }); });
    if (l.note) out.push('“' + l.note + '”'); return out.join(' · '); }
  function count(){ return cart.reduce(function(a,l){ return a + l.quantity; }, 0); }
  function total(){ return cart.reduce(function(a,l){ return a + unit(l) * l.quantity; }, 0); }
  function keyOf(l){ return [l.itemId, l.variantId || 0, l.modifierIds.slice().sort().join('.'), (l.note || '').trim().toLowerCase()].join('|'); }
  function addLine(l){ var k = keyOf(l), f = cart.filter(function(x){ return keyOf(x) === k; })[0];
    if (f) f.quantity = Math.min(50, f.quantity + l.quantity); else cart.push(l); save(':cart', cart); render(); }
  function qtyOf(id){ return cart.filter(function(l){ return l.itemId === id && simple(items[id]); }).reduce(function(a,l){ return a + l.quantity; }, 0); }
  function bump(id, d){ var l = cart.filter(function(x){ return x.itemId === id && !x.modifierIds.length && !x.variantId && !x.note; })[0];
    if (!l){ if (d > 0) addLine({ itemId:id, variantId:null, modifierIds:[], note:'', quantity:1 }); return; }
    l.quantity += d; if (l.quantity <= 0) cart.splice(cart.indexOf(l), 1); save(':cart', cart); render(); }
  function toast(t){ var e = document.getElementById('toast'); e.textContent = t; e.className = 'toast on'; clearTimeout(toast.t); toast.t = setTimeout(function(){ e.className = 'toast'; }, 3200); }
  var sheet = document.getElementById('sheet'), scrim = document.getElementById('scrim');
  function openSheet(html){ sheet.innerHTML = '<div class="grab"></div>' + html; sheet.className = 'sheet on'; scrim.className = 'scrim on'; }
  function closeSheet(){ sheet.className = 'sheet'; scrim.className = 'scrim'; }
  scrim.onclick = closeSheet;

  function renderMenu(){
    var chips = D.categories.map(function(c){ return '<button class="chip' + (c.id === cat ? ' on' : '') + '" data-cat="' + c.id + '">' + h(c.name) + '</button>'; }).join('');
    var list = D.items.filter(function(i){ return cat == null || i.categoryId === cat; });
    if (!D.categories.length) list = D.items;
    var rows = list.map(function(i){
      var q = qtyOf(i.id), right = simple(i) && q > 0
        ? '<div class="qty"><button data-dec="' + i.id + '" aria-label="Kurangi">−</button><b>' + q + '</b><button data-inc="' + i.id + '" aria-label="Tambah">+</button></div>'
        : '<button class="add" data-open="' + i.id + '" aria-label="Tambah ' + h(i.name) + '">+</button>';
      return '<div class="item">' + pic(i) + '<div class="meta"><h3>' + h(i.name) + '</h3>' + (i.description ? '<p>' + h(i.description) + '</p>' : '<p></p>') +
        '<div class="price">' + rp(i.variants.length ? Math.min.apply(null, i.variants.map(function(v){ return v.price; })) : i.price) + '</div></div>' + right + '</div>';
    }).join('');
    return (D.categories.length > 1 ? '<div class="chips">' + chips + '</div>' : '') + rows +
      (subs.length ? '<div class="row"><button class="btn ghost" data-status="1">Lihat status pesanan</button></div>' : '');
  }

  function openItem(id){
    var i = items[id]; if (simple(i)){ bump(id, 1); return; }
    var sel = { variantId: i.variants.length ? i.variants[0].id : null, mods: [], note: '', qty: 1 };
    i.groups.forEach(function(gid){ var g = groups[gid]; if (!g) return;
      g.options.forEach(function(o){ if (o.isDefault && (g.max === 0 || sel.mods.filter(function(m){ return g.options.some(function(x){ return x.id === m; }); }).length < g.max)) sel.mods.push(o.id); }); });
    function missing(){ var m = null; i.groups.forEach(function(gid){ var g = groups[gid]; if (!g || m) return;
      var n = g.options.filter(function(o){ return sel.mods.indexOf(o.id) >= 0; }).length; if (n < g.min) m = g.name; }); return m; }
    function paint(){
      var html = '<h2>' + h(i.name) + '</h2>' + (i.description ? '<div class="muted">' + h(i.description) + '</div>' : '');
      if (i.variants.length) html += '<div class="group"><h4>Pilih varian <span class="tag req">Wajib</span></h4>' + i.variants.map(function(v){
        return '<div class="opt' + (sel.variantId === v.id ? ' on' : '') + '" data-var="' + v.id + '"><div class="tick"></div><span>' + h(v.name) + '</span><em>' + rp(v.price) + '</em></div>'; }).join('') + '</div>';
      i.groups.forEach(function(gid){ var g = groups[gid]; if (!g) return;
        var rule = g.min > 0 ? '<span class="tag req">Wajib' + (g.max > 1 ? ' · maks ' + g.max : '') + '</span>' : '<span class="tag">' + (g.max > 1 ? 'Pilih maks ' + g.max : 'Opsional') + '</span>';
        if (g.free > 0) rule += '<span class="tag">' + g.free + ' gratis</span>';
        html += '<div class="group"><h4>' + h(g.name) + ' ' + rule + '</h4>' + g.options.map(function(o){
          return '<div class="opt' + (sel.mods.indexOf(o.id) >= 0 ? ' on' : '') + '" data-mod="' + o.id + '" data-g="' + g.id + '"><div class="tick"></div><span>' + h(o.name) + '</span><em>' + (o.price > 0 ? '+ ' + rp(o.price) : '') + '</em></div>'; }).join('') + '</div>'; });
      html += '<div class="group"><h4>Catatan untuk dapur</h4><textarea id="note" maxlength="120" placeholder="mis. tanpa bawang">' + h(sel.note) + '</textarea></div>';
      var miss = missing(), u = unit({ itemId: i.id, variantId: sel.variantId, modifierIds: sel.mods });
      html += '<div class="row"><div class="qty"><button data-q="-1" aria-label="Kurangi">−</button><b>' + sel.qty + '</b><button data-q="1" aria-label="Tambah">+</button></div>' +
        '<button class="btn" id="addbtn"' + (miss ? ' disabled' : '') + '>' + (miss ? 'Pilih ' + h(miss) : 'Tambah · ' + rp(u * sel.qty)) + '</button></div>';
      openSheet(html);
      var note = document.getElementById('note'); note.oninput = function(){ sel.note = note.value; };
    }
    sheet.onclick = function(e){
      var t = e.target.closest('[data-var],[data-mod],[data-q],#addbtn'); if (!t) return;
      if (t.dataset.var){ sel.variantId = +t.dataset.var; }
      else if (t.dataset.mod){ var g = groups[+t.dataset.g], id = +t.dataset.mod, on = sel.mods.indexOf(id) >= 0;
        var inG = sel.mods.filter(function(m){ return g.options.some(function(o){ return o.id === m; }); });
        if (on){ if (!(g.max === 1 && g.min === 1)) sel.mods.splice(sel.mods.indexOf(id), 1); }
        else if (g.max === 1){ inG.forEach(function(m){ sel.mods.splice(sel.mods.indexOf(m), 1); }); sel.mods.push(id); }
        else if (g.max === 0 || inG.length < g.max) sel.mods.push(id); else { toast('Maksimal ' + g.max + ' pilihan'); return; } }
      else if (t.dataset.q){ sel.qty = Math.max(1, Math.min(50, sel.qty + (+t.dataset.q))); }
      else if (t.id === 'addbtn'){ if (missing()) return; closeSheet();
        addLine({ itemId: i.id, variantId: sel.variantId, modifierIds: sel.mods.slice(), note: (sel.note || '').trim(), quantity: sel.qty }); toast(i.name + ' ditambahkan'); return; }
      paint();
    };
    paint();
  }

  function openCart(){
    function paint(){
      if (!cart.length){ closeSheet(); render(); return; }
      var html = '<h2>Pesanan ' + (D.kind === 'counter' ? 'kamu' : 'Meja ' + h(D.table || '')) + '</h2>';
      html += cart.map(function(l, k){ var i = items[l.itemId];
        return '<div class="line"><div class="meta"><h3>' + h(i.name) + '</h3><p>' + h(details(l)) + '</p><div class="price">' + rp(unit(l) * l.quantity) + '</div></div>' +
          '<div class="qty"><button data-cq="' + k + ':-1" aria-label="Kurangi">−</button><b>' + l.quantity + '</b><button data-cq="' + k + ':1" aria-label="Tambah">+</button></div></div>'; }).join('');
      html += '<div class="sum"><span>Total sementara</span><b>' + rp(total()) + '</b></div><div class="muted">Harga final dihitung di kasir (pajak & biaya layanan).</div>';
      if (D.kind === 'counter') html += '<div class="group"><h4>Nama kamu <span class="tag req">Wajib</span></h4><input id="name" maxlength="60" placeholder="Untuk dipanggil saat siap" value="' + h(load(':name', '')) + '"></div>';
      html += '<div class="row"><button class="btn" id="send">Pesan · ' + rp(total()) + '</button></div>';
      openSheet(html);
    }
    sheet.onclick = function(e){
      var t = e.target.closest('[data-cq],#send'); if (!t) return;
      if (t.dataset.cq){ var p = t.dataset.cq.split(':'), l = cart[+p[0]]; l.quantity += (+p[1]); if (l.quantity <= 0) cart.splice(+p[0], 1); save(':cart', cart); render(); paint(); return; }
      send(t);
    };
    paint();
  }

  function send(btn){
    var name = '';
    if (D.kind === 'counter'){ var n = document.getElementById('name'); name = (n && n.value || '').trim(); if (!name){ toast('Tulis nama kamu dulu'); return; } save(':name', name); }
    btn.disabled = true; btn.textContent = 'Mengirim…';
    fetch(D.api + '/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ token: D.token, name: name, lines: cart.map(function(l){ return { itemId: l.itemId, variantId: l.variantId, modifierIds: l.modifierIds, note: l.note, quantity: l.quantity }; }) }) })
      .then(function(r){ return r.json().then(function(b){ return { ok: r.ok, b: b }; }); })
      .then(function(x){
        if (!x.ok){ throw new Error((x.b && x.b.error && x.b.error.errorMessage) || 'Gagal mengirim'); }
        var d = x.b.data; subs.unshift({ ref: d.orderRef, round: d.round, at: Date.now(), status: d.status });
        subs = subs.slice(0, 10); save(':subs', subs); cart = []; save(':cart', cart);
        closeSheet(); view = 'status'; pollMs = 10000; render(); check();
      })
      .catch(function(e){ btn.disabled = false; btn.textContent = 'Pesan · ' + rp(total()); toast(e.message === 'Failed to fetch' ? 'Tidak ada koneksi — coba lagi' : e.message); });
  }

  var last = null;
  function check(){
    var s = subs[0]; if (!s) return;
    clearTimeout(poll);
    fetch(D.api + '/order/' + encodeURIComponent(s.ref) + '/status?round=' + s.round, { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(b){ if (b && b.data){ last = b.data; s.status = b.data.status; save(':subs', subs); if (view === 'status') render(); }
        var st = last && last.status; if (st === 'READY' || st === 'REJECTED' || st === 'CLOSED') return;
        pollMs = st === 'PENDING' ? 10000 : 30000; schedule(); })
      .catch(function(){ schedule(); });
  }
  function schedule(){ clearTimeout(poll); if (document.visibilityState === 'hidden') return; poll = setTimeout(check, pollMs); }
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible' && view === 'status') check(); });

  function renderStatus(){
    var s = subs[0]; if (!s) return renderMenu();
    var st = (last && last.status) || s.status || 'PENDING';
    var waited = Date.now() - s.at > 5 * 60000;
    var titles = { PENDING: waited ? 'Belum dikonfirmasi — silakan ke kasir' : 'Menunggu konfirmasi kasir…', ACCEPTED: 'Pesanan dikirim ke dapur',
      PREPARING: 'Pesanan sedang dibuat', READY: 'Pesanan siap!', REJECTED: 'Pesanan tidak bisa diproses', CLOSED: 'Terima kasih! Sesi meja sudah ditutup' };
    var icon = st === 'REJECTED' ? '✕' : st === 'PENDING' ? '⏳' : '✓';
    var bg = st === 'REJECTED' ? 'var(--brand-light)' : st === 'PENDING' ? 'var(--warn-bg)' : 'var(--ok-bg)';
    var idx = { ACCEPTED: 1, PREPARING: 2, READY: 3, CLOSED: 3 }[st] || 0;
    var steps = st === 'REJECTED' || st === 'PENDING' ? '' : '<div class="steps">' + [['✓','Diterima'],['🔥','Dimasak'],['🛎','Siap']].map(function(x, k){
      return '<div class="step' + (k + 1 < idx || idx === 3 ? ' on' : k + 1 === idx ? (k === 0 ? ' on' : ' now') : '') + '"><i>' + x[0] + '</i>' + x[1] + '</div>'; }).join('') + '</div>';
    var html = '<div class="card hero"><div class="big" style="background:' + bg + '">' + icon + '</div><h2>' + titles[st] + '</h2>' +
      '<div class="muted">' + (D.kind === 'counter' ? 'Bawa pulang' : 'Meja ' + h(D.table || '')) + (s.round > 1 ? ' · Ronde ' + s.round : '') + '</div>' +
      (st === 'REJECTED' && last && last.reason ? '<p class="muted">' + h(last.reason) + '</p>' : '') + steps + '</div>';
    if (last && last.rounds && last.rounds.length){
      var pills = { NEW: ['Antre',''], PREPARING: ['Dimasak','warn'], READY: ['Siap diantar','ok'], SERVED: ['Sudah keluar','ok'] };
      html += '<div class="card"><h3 style="margin:0">' + (D.kind === 'counter' ? 'Pesanan kamu' : 'Pesanan meja ini') + '</h3>' + last.rounds.map(function(r){
        var p = pills[r.status] || null;
        return '<div class="rh">RONDE ' + r.round + (p ? ' <span class="pill ' + p[1] + '">' + p[0] + '</span>' : '') + '</div>' + r.lines.map(function(l){
          return '<div class="line"><b>' + l.quantity + '×</b><div class="meta"><h3>' + h(l.name) + '</h3><p>' + h(l.details) + '</p></div></div>'; }).join(''); }).join('') +
        '<div class="sum"><span>Total sementara</span><b>' + rp(last.billTotal) + '</b></div></div>';
    }
    if (st !== 'CLOSED') html += '<div class="row"><button class="btn ghost" data-menu="1">+ Pesan lagi</button></div>';
    html += '<footer>Bayar di kasir' + (D.kind === 'counter' ? '' : ' · sebut Meja ' + h(D.table || '')) + ' · Bayar Yuk!</footer>';
    return html;
  }

  function render(){
    document.getElementById('view').innerHTML = view === 'status' ? renderStatus() : renderMenu();
    var bar = document.getElementById('bar'), n = count();
    if (view === 'menu' && n > 0){ bar.className = 'bar show'; bar.innerHTML = '<span class="n">' + n + '</span><span><small>' +
      (D.kind === 'counter' ? 'Pesanan kamu' : 'Pesanan Meja ' + h(D.table || '')) + '</small><b>' + rp(total()) + '</b></span><span class="go">Lihat &amp; pesan ›</span>'; }
    else bar.className = 'bar';
  }
  document.getElementById('bar').onclick = openCart;
  document.getElementById('view').onclick = function(e){
    var t = e.target.closest('[data-cat],[data-open],[data-inc],[data-dec],[data-status],[data-menu]'); if (!t) return;
    if (t.dataset.cat){ cat = +t.dataset.cat; render(); }
    else if (t.dataset.open) openItem(+t.dataset.open);
    else if (t.dataset.inc) bump(+t.dataset.inc, 1);
    else if (t.dataset.dec) bump(+t.dataset.dec, -1);
    else if (t.dataset.status){ view = 'status'; render(); check(); }
    else if (t.dataset.menu){ view = 'menu'; clearTimeout(poll); render(); window.scrollTo(0, 0); }
  };
  if (subs.length && Date.now() - subs[0].at < 3 * 3600000 && ['READY','CLOSED','REJECTED'].indexOf(subs[0].status) < 0){ view = 'status'; check(); }
  render();
})();
</script>
</body>
</html>`
}

/** "QR tidak berlaku" — unknown or reset token, ordering off, a paid bill. */
export function renderQrInvalidPage(shopName: string | null): string {
    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>QR tidak berlaku</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#302D3D;background:#F2F2F7;display:grid;place-items:center;min-height:100vh;padding:24px;text-align:center}
.c{background:#fff;border-radius:18px;padding:28px 22px;max-width:380px}.i{width:64px;height:64px;border-radius:50%;background:#FEE9ED;color:#E3173C;display:grid;place-items:center;margin:0 auto 14px;font-size:28px}
h1{font-size:20px;margin:0 0 8px}p{color:#6B7280;margin:0;line-height:1.5}</style></head>
<body><div class="c"><div class="i">!</div><h1>QR tidak berlaku</h1><p>${shopName ? esc(shopName) + " — " : ""}silakan pesan di kasir. Kalau tagihan sudah dibayar, sesi meja sudah ditutup.</p><p style="margin-top:14px;font-size:12px">Bayar Yuk!</p></div></body></html>`
}
