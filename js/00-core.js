/* Core: namespace, events, DOM helpers, units, theme, tooltip, chart frame, data loading, and the
   two bottom-up models (reactor demand, mine supply) that every figure shares. */
(function () {
  'use strict';
  const U = (window.U = window.U || {});

  /* ---------- events ---------- */
  const bus = {};
  U.on = (evt, fn) => { (bus[evt] = bus[evt] || []).push(fn); };
  U.emit = (evt, data) => { (bus[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

  /* ---------- DOM ---------- */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  // el('div', {class:'x', text:'safe text'}, child, child) — text always goes through textContent.
  U.el = function (tag, attrs, ...kids) {
    const svgTags = U.el._svg;
    const node = svgTags.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'text') node.textContent = v;
        else if (k === 'class') node.setAttribute('class', v);
        else if (k === 'style' && typeof v === 'object') { for (const p in v) { if (v[p] == null) continue; if (p.startsWith('--')) node.style.setProperty(p, v[p]); else node.style[p] = v[p]; } }
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      node.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return node;
  };
  U.el._svg = new Set(['svg', 'g', 'path', 'line', 'rect', 'circle', 'text', 'tspan', 'defs', 'pattern', 'clipPath', 'polyline', 'polygon', 'title']);
  U.clear = (node) => { while (node && node.firstChild) node.removeChild(node.firstChild); return node; };

  /* ---------- tokens ---------- */
  let cssCache = {};
  U.css = (name) => {
    if (!(name in cssCache)) cssCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return cssCache[name];
  };
  const themeChanged = () => { cssCache = {}; U.emit('theme'); };
  new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged); } catch (e) { /* older browsers */ }
  U.isDark = () => {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  U.reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- storage (best effort) ---------- */
  U.store = {
    get(k) { try { return window.localStorage.getItem('u.' + k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem('u.' + k, v); } catch (e) { /* private mode */ } },
  };

  /* ---------- units ---------- */
  const LB_PER_TU = 2599.8; // lb U3O8 per tonne U
  U.LB_PER_TU = LB_PER_TU;
  U.units = { mode: U.store.get('unit') === 'tU' ? 'tU' : 'lb' };
  U.setUnit = (mode) => {
    if (mode !== 'lb' && mode !== 'tU') return;
    U.units.mode = mode;
    U.store.set('unit', mode);
    U.$$('[data-unit]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === mode)));
    U.emit('units', mode);
  };
  U.toUnit = (tU) => (U.units.mode === 'lb' ? (tU * LB_PER_TU) / 1e6 : tU);
  U.unitName = () => (U.units.mode === 'lb' ? 'Mlb U₃O₈' : 'tU');
  U.unitShort = () => (U.units.mode === 'lb' ? 'Mlb' : 'tU');
  const nf = (d) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const NF = [nf(0), nf(1), nf(2)];
  U.n = (v, d) => (v == null || !isFinite(v) ? '–' : NF[d == null ? 0 : d].format(v));
  // value only, in the current unit
  U.fmtU = (tU, opts) => {
    if (tU == null || !isFinite(tU)) return '–';
    const v = U.toUnit(tU);
    if (U.units.mode === 'tU') return NF[0].format(Math.round(v));
    const a = Math.abs(v);
    const d = opts && opts.d != null ? opts.d : a >= 100 ? 0 : a >= 10 ? 1 : 2;
    return NF[d].format(v);
  };
  U.fmtUu = (tU, opts) => U.fmtU(tU, opts) + ' ' + U.unitShort();
  U.signed = (s, v) => (v > 0 ? '+' : v < 0 ? '−' : '') + s.replace(/^-/, '');
  U.pct = (v, d) => (v == null || !isFinite(v) ? '–' : NF[d || 0].format(v * 100) + '%');
  U.usd = (v, d) => (v == null || !isFinite(v) ? '–' : '$' + NF[d == null ? 2 : d].format(v));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  U.month = (ym) => { const [y, m] = String(ym).split('-'); return m ? MONTHS[+m - 1] + ' ' + y : String(y); };
  U.day = (iso) => { const p = String(iso).split('-'); return p.length >= 3 ? +p[2] + ' ' + MONTHS[+p[1] - 1] : p.length === 2 ? MONTHS[+p[1] - 1] : p[0]; };
  U.dayLong = (iso) => { const p = String(iso).split('-'); return p.length >= 3 ? +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0] : U.month(iso); };
  U.power = (w) => {
    if (w == null) return '–';
    const steps = [[1e12, 'TW'], [1e9, 'GW'], [1e6, 'MW'], [1e3, 'kW'], [1, 'W'], [1e-3, 'mW'], [1e-6, 'µW'], [1e-9, 'nW']];
    for (const [k, u] of steps) if (Math.abs(w) >= k) { const v = w / k; return (v >= 100 ? NF[0].format(v) : v >= 10 ? NF[1].format(v).replace(/\.0$/, '') : NF[2].format(v).replace(/\.?0+$/, '')) + ' ' + u; }
    return w + ' W';
  };

  /* ---------- tooltip ---------- */
  const tipEl = () => U.$('#tip');
  U.tip = {
    show(x, y, node) {
      const t = tipEl(); if (!t) return;
      U.clear(t).appendChild(node);
      t.dataset.on = '1';
      const r = t.getBoundingClientRect();
      const pad = 12, vw = window.innerWidth, vh = window.innerHeight;
      let left = x + 14, top = y + 14;
      if (left + r.width + pad > vw) left = x - r.width - 14;
      if (left < pad) left = pad;
      if (top + r.height + pad > vh) top = y - r.height - 14;
      if (top < pad) top = pad;
      t.style.transform = 'translate3d(' + Math.round(left) + 'px,' + Math.round(top) + 'px,0)';
    },
    hide() { const t = tipEl(); if (t) t.dataset.on = '0'; },
    // title, subtitle, rows: [[label, value, cssColor?], ...]
    card(title, sub, rows) {
      const kids = [];
      if (title) kids.push(U.el('div', { class: 'tip__t', text: title }));
      if (sub) kids.push(U.el('div', { class: 'tip__s', text: sub }));
      if (rows && rows.length) {
        const dl = U.el('dl', { class: 'tip__rows' });
        rows.forEach((r) => {
          if (!r) return;
          dl.appendChild(U.el('dt', null, r[2] ? U.el('span', { class: 'tip__key', style: { background: r[2] } }) : null, r[0]));
          dl.appendChild(U.el('dd', { text: r[1] }));
        });
        kids.push(dl);
      }
      return U.el('div', null, kids);
    },
  };
  window.addEventListener('scroll', () => U.tip.hide(), { passive: true });

  /* ---------- small UI builders ---------- */
  // seg('Label', [{v, t}], current, onChange) -> .control element
  U.seg = (label, options, current, onChange) => {
    const group = U.el('div', { class: 'seg', role: 'group', 'aria-label': label });
    options.forEach((o) => {
      const b = U.el('button', { type: 'button', 'aria-pressed': String(o.v === current), text: o.t, title: o.title || null });
      b.addEventListener('click', () => {
        U.$$('button', group).forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        onChange(o.v);
      });
      group.appendChild(b);
    });
    return U.el('div', { class: 'control' }, U.el('span', { class: 'label', text: label }), group);
  };
  U.legend = (host, items) => {
    U.clear(host);
    items.forEach((it) => {
      host.appendChild(U.el('span', { class: 'legend__item' }, U.el('span', { class: 'sw' + (it.kind ? ' sw--' + it.kind : ''), style: { '--c': it.c } }), it.t));
    });
  };
  U.stats = (host, items) => {
    U.clear(host);
    items.forEach((s) => {
      host.appendChild(U.el('div', { class: 'stat' },
        U.el('div', { class: 'stat__v' }, s.v, s.u ? U.el('small', { text: s.u }) : null),
        U.el('div', { class: 'stat__l', text: s.l }),
        s.d ? U.el('div', { class: 'stat__d', 'data-dir': s.dir || null, text: s.d }) : null));
    });
  };
  // drawing-style title block under a figure
  const figNo = {}; let figCount = 0; // figures are numbered in the order they first appear on the page
  U.titleblock = (id, o) => {
    const host = U.$('#' + id); if (!host) return;
    U.clear(host);
    const no = figNo[id] || (figNo[id] = String(++figCount).padStart(2, '0'));
    const cell = (k, v) => { host.appendChild(U.el('div', { text: k })); host.appendChild(U.el('div', null, v)); };
    cell('Fig.', U.el('b', { text: no + ' · ' + o.title }));
    cell('Unit', o.unit || '–');
    cell('As of', o.asof || (U.data && U.data.meta && U.data.meta.as_of) || '–');
    const src = U.el('span');
    (o.sources || []).forEach((s, i) => {
      if (i) src.appendChild(document.createTextNode(' · '));
      src.appendChild(s.url ? U.el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.t }) : document.createTextNode(s.t));
    });
    cell('Source', src);
  };
  // data-table twin: columns [{k, t, l?:left, f?:fmt}], rows [obj]
  U.table = (host, cols, rows, cls) => {
    U.clear(host);
    const thead = U.el('thead', null, U.el('tr', null, cols.map((c) => U.el('th', { class: c.l ? 'l' : null, scope: 'col', text: c.t }))));
    const tbody = U.el('tbody');
    rows.forEach((r) => {
      tbody.appendChild(U.el('tr', null, cols.map((c) => {
        const raw = r[c.k];
        const val = c.f ? c.f(raw, r) : raw == null ? '–' : raw;
        return U.el('td', { class: c.l ? 'l' : null }, val instanceof Node ? val : String(val));
      })));
    });
    host.appendChild(U.el('table', { class: 'data ' + (cls || '') }, thead, tbody));
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-table]'); if (!b) return;
    const host = document.getElementById(b.dataset.table); if (!host) return;
    host.hidden = !host.hidden;
    b.setAttribute('aria-expanded', String(!host.hidden));
    b.textContent = host.hidden ? 'Show table' : 'Hide table';
  });

  /* ---------- chart frame ---------- */
  // Calls render(width) now, on container resize, and on unit/theme change.
  U.responsive = (host, render) => {
    let last = 0, raf = 0;
    const run = () => { raf = 0; const w = Math.floor(host.clientWidth); if (w > 0) { last = w; try { render(w); } catch (e) { console.error(e); } } };
    const ask = () => { if (!raf) raf = requestAnimationFrame(run); };
    if (window.ResizeObserver) new ResizeObserver(() => { if (Math.floor(host.clientWidth) !== last) ask(); }).observe(host);
    else window.addEventListener('resize', ask);
    U.on('units', ask); U.on('theme', ask);
    run();
    return ask;
  };
  U.frame = (host, w, h, m) => {
    U.clear(host);
    const svg = U.el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, role: 'img' });
    const g = U.el('g', { transform: 'translate(' + m.l + ',' + m.t + ')' });
    svg.appendChild(g); host.appendChild(svg);
    return { svg, g, w, h, iw: w - m.l - m.r, ih: h - m.t - m.b, m };
  };
  U.yGrid = (f, scale, ticks, fmt) => {
    const g = U.el('g', { class: 'ax' });
    ticks.forEach((t) => {
      const y = Math.round(scale(t)) + 0.5;
      g.appendChild(U.el('line', { class: t === 0 ? 'baseline' : 'gridline', x1: 0, x2: f.iw, y1: y, y2: y }));
      g.appendChild(U.el('text', { x: -8, y: y, dy: '0.32em', 'text-anchor': 'end', text: fmt(t) }));
    });
    f.g.appendChild(g);
    return g;
  };
  U.axisNum = (v) => { const a = Math.abs(v); return a >= 10000 ? NF[0].format(v / 1000) + 'K' : NF[0].format(v); };

  /* ---------- data ---------- */
  const FILES = ['meta', 'reactors', 'mines', 'country_requirements', 'production_by_country', 'secondary_supply', 'prices', 'events', 'outlook', 'funds', 'contracting', 'mining_costs', 'news', 'filings', 'companies', 'scale', 'facts', 'sources', 'world'];
  U.data = {};
  // meta.json is always revalidated; its build stamp then versions every other data file, so a monthly
  // rebuild reaches returning visitors without a hard refresh
  const getJSON = (url, opts) => fetch(url, opts).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  U.load = () => getJSON('data/meta.json', { cache: 'no-cache' }).then((meta) => {
    U.data.meta = meta;
    const v = meta && meta.built_at && !window.__U_NO_VERSION__ ? '?v=' + encodeURIComponent(meta.built_at) : '';
    return Promise.all(FILES.filter((f) => f !== 'meta').map((f) => getJSON('data/' + f + '.json' + v).then((d) => { U.data[f] = d; })));
  }).then(() => U.data);

  /* ---------- model: reactor demand ----------
     Natural uranium needed per GWe-year at full output, by reactor family (tU). Derived from typical
     burnup, enrichment, tails assay and thermal efficiency; see Sources and method. Each country's total is
     then scaled to the World Nuclear Association's published requirement for that country. */
  const TYPE_F = { PWR: 205, BWR: 205, PHWR: 165, GCR: 210, LWGR: 230, HTGR: 180, FBR: 100, SMR: 225 };
  const CF_DEFAULT = 0.83;
  const typeKey = (t) => { t = String(t || 'PWR').toUpperCase(); if (t.startsWith('SMR')) return 'SMR'; if (t === 'AGR' || t === 'MAGNOX') return 'GCR'; if (t === 'RBMK' || t === 'EGP') return 'LWGR'; if (t === 'VVER' || t === 'WWER') return 'PWR'; if (t === 'ABWR' || t === 'ESBWR') return 'BWR'; if (t === 'FNR') return 'FBR'; return TYPE_F[t] != null ? t : 'PWR'; };
  const M = (U.model = { firstCoreMultiple: 2, nowYear: 2026, horizon: 2040, TYPE_F, CF_DEFAULT });

  M.prepare = () => {
    const d = U.data;
    M.nowYear = (d.meta && d.meta.now_year) || 2026;
    const R = (d.reactors || []);
    const mm = d.meta && d.meta.model;
    if (mm) { if (mm.type_f) Object.assign(TYPE_F, mm.type_f); if (mm.cf) M.CF_DEFAULT = mm.cf; if (mm.first_core_multiple != null) M.firstCoreMultiple = mm.first_core_multiple; }
    // the build step gives every reactor its annual requirement (req, tU); fall back to the raw formula if it is absent
    R.forEach((r) => { if (r.req == null) r.req = ((r.mw || 0) / 1000) * TYPE_F[typeKey(r.type)] * M.CF_DEFAULT; });
    // sites
    const sites = new Map();
    R.forEach((r) => {
      if (r.lat == null || r.lon == null) return;
      const key = r.iso2 + '|' + (r.site || r.name);
      let s = sites.get(key);
      if (!s) { s = { kind: 'reactor', key, name: r.site || r.name, country: r.country, iso2: r.iso2, lat: 0, lon: 0, units: [] }; sites.set(key, s); }
      s.units.push(r);
    });
    sites.forEach((s) => { s.lat = d3.mean(s.units, (u) => u.lat); s.lon = d3.mean(s.units, (u) => u.lon); });
    M.sites = Array.from(sites.values());
    // mines
    (d.mines || []).forEach((m) => { m.kind = 'mine'; m._last = lastActual(m); });
    M.lastActualYear = d3.max(d.mines || [], (m) => (m._last ? m._last.y : null)) || M.nowYear - 1;
    M.worldProd = {};
    const pbc = d.production_by_country;
    if (pbc && pbc.world) pbc.world.forEach((w) => { if (w.tu != null) M.worldProd[w.year] = w.tu; });
  };

  // Find the mine or reactor site a piece of text is about (used to link news to the globe). Conservative on
  // purpose: whole-word, case-sensitive, names of five letters or more, and a stoplist of ordinary words.
  const STOP = new Set(['Summer', 'Cooper', 'Clinton', 'Harris', 'Perry', 'Salem', 'Columbia', 'Robinson', 'Hatch', 'Farley', 'Fermi', 'Byron', 'Monticello', 'Brunswick', 'Callaway', 'Central', 'South', 'North', 'Unit', 'Point', 'River', 'Grand', 'Republic', 'Ranger', 'Lance', 'Alpha', 'Sunday', 'Phoenix', 'Arrow', 'Midwest', 'Millennium', 'Honeymoon', 'Hope']);
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let entIndex = null;
  M.findEntity = (text) => {
    if (!text) return null;
    if (!entIndex) {
      entIndex = [];
      const add = (name, ref) => { const base = String(name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim(); if (base.length >= 5 && !STOP.has(base)) entIndex.push({ re: new RegExp('(^|[^A-Za-z])' + esc(base) + '([^A-Za-z]|$)'), ref, len: base.length }); };
      (U.data.mines || []).forEach((m) => add(m.name, m));
      (M.sites || []).forEach((st) => add(st.name, st));
      entIndex.sort((a, b) => b.len - a.len);
    }
    const hit = entIndex.find((e) => e.re.test(text));
    return hit ? hit.ref : null;
  };

  // state of one reactor in a given year: 'operating' | 'construction' | 'planned' | 'idle' | null
  M.unitState = (r, y) => {
    const now = M.nowYear;
    if (r.r0 != null) { // a unit that shut and is coming back: second life from r0
      if (y >= r.r0) return 'operating';
      if (r.y1 != null && y >= r.y1) return y >= now ? (r.status === 'planned' ? 'planned' : 'construction') : null;
    }
    // units still being built or planned today are never 'running' in the past or present, whatever their due date says
    if ((r.status === 'construction' || r.status === 'planned') && r.r0 == null) {
      if (y > now && r.y0 != null && y >= Math.max(r.y0, now + 1)) return 'operating';
      if (r.status === 'construction') return (r.c0 != null ? y >= r.c0 : y >= now) ? 'construction' : null;
      return y >= now ? 'planned' : null;
    }
    if (r.y0 != null && y >= r.y0 && (r.y1 == null || y < r.y1)) {
      if (r.status === 'idle' && y >= (r.idle_since || now)) return 'idle';
      if (r.status === 'shutdown' && r.y1 == null && y >= now) return null;
      return 'operating';
    }
    if (r.y0 != null && r.y1 != null && y >= r.y1) return null;
    if (r.status === 'shutdown') return null;
    if (r.c0 != null && y >= r.c0 && (r.y0 == null || y < r.y0)) return 'construction';
    if (r.status === 'construction' && y >= now && (r.y0 == null || y < r.y0)) return 'construction';
    if (r.status === 'planned' && y >= now && (r.y0 == null || y < r.y0)) return 'planned';
    return null;
  };
  // world reactor requirement in a year (tU). opts.firstCores adds the extra fuel in a first core, booked the year before grid connection.
  M.demand = (y, opts) => {
    opts = opts || {};
    let tu = 0, units = 0, mw = 0, cores = 0;
    (U.data.reactors || []).forEach((r) => {
      if (opts.firmOnly && r.status === 'planned') return;
      const st = M.unitState(r, y);
      if (st === 'operating') { tu += r.req; units++; mw += r.mw || 0; }
      if (opts.firstCores !== false && r.y0 === y + 1 && r.r0 == null && y >= M.nowYear - 1) cores += r.req * M.firstCoreMultiple;
    });
    return { tu: tu + cores, running: tu, cores, units, mw };
  };

  /* ---------- model: mine supply ---------- */
  function lastActual(m) {
    const p = m.production_tu || {}; let best = null;
    Object.keys(p).forEach((k) => { if (p[k] != null && (!best || +k > best.y)) best = { y: +k, v: p[k] }; });
    return best;
  }
  const bucketOf = (m) => (m.status === 'operating' || m.status === 'ramp-up' ? 'operating' : m.status === 'care-maintenance' ? 'restart' : m.status === 'development' ? 'development' : m.status === 'proposed' ? 'proposed' : null);
  M.bucketOf = bucketOf;
  // production of one mine in a year (tU, 100% basis). opts: {slip: years, case: 'low'|'base'|'high',
  // deliver: share of planned new output that actually arrives (1 = all of plan); applies to restarts, new mines
  // and the part of a ramp-up that has not been produced yet}
  M.mineOutput = (m, y, opts) => {
    opts = opts || {};
    const p = m.production_tu || {};
    if (p[y] != null) return { v: p[y], actual: true };
    const last = m._last;
    const kase = opts.case || 'base';
    const deliver = opts.deliver != null ? opts.deliver : 1;
    const bucket = bucketOf(m);
    if (!bucket) return { v: 0 };
    if (m.expected_end_year && y > m.expected_end_year) return { v: 0 };
    if (bucket === 'operating') {
      if (!last) {
        // newly producing, no actual yet
        const tgt0 = (m.planned_output_tu && m.planned_output_tu[kase]) || m.capacity_tu || 0;
        const s0 = m.first_production_year || m.planned_start_year || M.nowYear;
        return y < s0 ? { v: 0 } : { v: tgt0 * deliver * Math.min(1, (y - s0 + 1) / (m.ramp_years || 3)), est: true };
      }
      if (y < last.y) return { v: null };
      const g = m.guidance_tu && m.guidance_tu[y];
      if (g) return { v: kase === 'low' ? g.low : kase === 'high' ? g.high : (g.low + g.high) / 2, est: true, guided: true };
      let steady = last.v;
      const gNext = m.guidance_tu && m.guidance_tu[last.y + 1];
      if (gNext) steady = (gNext.low + gNext.high) / 2;
      if (m.status === 'ramp-up') {
        const tgt = (m.planned_output_tu && m.planned_output_tu[kase]) || m.capacity_tu || steady;
        const n = m.ramp_years || 3;
        const k = Math.min(1, (y - last.y) / n);
        return { v: steady + Math.max(0, tgt - steady) * k * deliver + Math.min(0, tgt - steady) * k, est: true };
      }
      if (m.steady_tu != null) steady = m.steady_tu;
      return { v: steady * (kase === 'low' ? 0.93 : kase === 'high' ? 1.05 : 1), est: true };
    }
    // restart / development / proposed
    const rng = m.start_year_range || {};
    let start = kase === 'low' ? (rng.late || m.planned_start_year) : kase === 'high' ? (rng.early || m.planned_start_year) : (m.planned_start_year || (rng.early && rng.late ? Math.round((rng.early + rng.late) / 2) : rng.early || rng.late));
    if (start == null) return { v: 0 };
    start += opts.slip || 0;
    if (y < start) return { v: 0 };
    const out = m.planned_output_tu || {};
    const tgt = out[kase] != null ? out[kase] : out.base != null ? out.base : m.capacity_tu || 0;
    const n = m.ramp_years || 3;
    return { v: tgt * deliver * Math.min(1, (y - start + 1) / n), est: true };
  };
  // world primary supply in a year, split by bucket. Unlisted mines (the gap to the published world total) are held flat.
  M.supply = (y, opts) => {
    opts = opts || {};
    const out = { operating: 0, restart: 0, development: 0, proposed: 0, other: 0, total: 0, mines: 0, actual: false };
    (U.data.mines || []).forEach((m) => {
      const b = bucketOf(m); const r = M.mineOutput(m, y, opts);
      if (r.v == null || !r.v) return;
      const key = r.actual ? 'operating' : b;
      if (!key) return;
      if (key === 'proposed' && !opts.proposed) return; // proposed mines only count when asked for
      out[key] += r.v; out.mines++;
    });
    const world = M.worldProd[y];
    if (world != null) {
      out.actual = true;
      const listed = out.operating + out.restart + out.development + out.proposed;
      out.other = Math.max(0, world - listed);
    } else {
      out.actual = y <= M.lastActualYear;
      out.other = M.otherFlat();
    }
    out.total = out.operating + out.restart + out.development + out.proposed + out.other;
    return out;
  };
  let _otherFlat = null;
  M.otherFlat = () => {
    if (_otherFlat != null) return _otherFlat;
    const ys = Object.keys(M.worldProd).map(Number).sort((a, b) => b - a);
    for (const y of ys) {
      let listed = 0;
      (U.data.mines || []).forEach((m) => { const v = (m.production_tu || {})[y]; if (v) listed += v; });
      if (listed > 0) { _otherFlat = Math.max(0, M.worldProd[y] - listed); return _otherFlat; }
    }
    _otherFlat = 0; return 0;
  };
  M.secondary = (y) => {
    const s = U.data.secondary_supply && U.data.secondary_supply.model;
    if (!s || !s.length) return 0;
    if (y <= s[0].year) return s[0].tu;
    for (let i = 1; i < s.length; i++) if (y <= s[i].year) { const a = s[i - 1], b = s[i]; return a.tu + ((b.tu - a.tu) * (y - a.year)) / (b.year - a.year); }
    return s[s.length - 1].tu;
  };
})();
