/* FIG. — uranium price history with event marks.
   Which series appear depends on what the build step was allowed to ship (see the licensing switch in
   scripts/build-data.mjs): the IMF monthly average always; the industry month-end spot and long-term
   indicators only with permission; yearly prices paid by US utilities (EIA, public domain) when present. */
(function () {
  'use strict';
  const U = window.U;
  U.price = { init };

  function init() {
    const host = U.$('#price-chart'), P = U.data.prices;
    if (!host || !P || !P.series) return;
    const parse = (d) => { const [y, m] = String(d).split('-').map(Number); return new Date(Date.UTC(y, (m || 7) - 1, 15)); };
    const has = (k) => P.series[k] && P.series[k].length > 1;
    const full = has('spot');
    const DEFS = full
      ? [{ k: 'spot', t: 'Spot, month-end', short: 'Spot', c: '--ink' }, { k: 'term', t: 'Long-term contract, month-end', short: 'Term', c: '--market' }]
      : [{ k: 'imf', t: 'IMF monthly average', short: 'IMF avg', c: '--ink' }];
    if (!full && has('spot_q')) DEFS.push({ k: 'spot_q', t: 'Spot, quarter-end (company filings)', short: 'Spot', c: '--neutral-mark', step: true });
    if (!full && has('term_q')) DEFS.push({ k: 'term_q', t: 'Long-term contract, quarter-end (company filings)', short: 'Term', c: '--market', step: true });
    if (has('eia')) DEFS.push({ k: 'eia', t: 'Paid by US utilities, yearly average', short: 'US paid', c: full ? '--neutral-mark' : '--market', step: true });
    const series = DEFS.map((d) => ({ ...d, pts: (P.series[d.k] || []).filter((p) => p.v != null).map((p) => ({ d: p.d, t: parse(p.d), v: p.v })) })).filter((s) => s.pts.length > 1);
    if (!series.length) return;
    const main = series[0];
    const events = (U.data.events || []).map((e) => ({ ...e, t: parse(String(e.date).slice(0, 7)) })).sort((a, b) => a.t - b.t);
    const lastT = d3.max(series, (s) => s.pts[s.pts.length - 1].t), firstT = d3.min(series, (s) => s.pts[0].t);
    const st = { range: '20', log: false };

    const ctl = U.$('#price-controls');
    const spanYears = (lastT - firstT) / 31557600000;
    const ranges = [{ v: '5', t: '5 years' }, { v: '10', t: '10 years' }, { v: '20', t: '20 years' }, { v: 'max', t: 'All' }].filter((r) => r.v === 'max' || +r.v < spanYears);
    if (!ranges.find((r) => r.v === st.range)) st.range = 'max';
    ctl.appendChild(U.seg('Range', ranges, st.range, (v) => { st.range = v; ask(); }));
    ctl.appendChild(U.seg('Scale', [{ v: false, t: 'Linear' }, { v: true, t: 'Log' }], st.log, (v) => { st.log = v; ask(); }));
    U.legend(U.$('#price-legend'), series.map((s) => ({ t: s.t, c: 'var(' + s.c + ')', kind: 'line' })).concat(events.length ? [{ t: 'Event', c: 'var(--ink-3)' }] : []));
    if (events.length) { const evSw = U.$$('#price-legend .sw').pop(); if (evSw) { evSw.style.width = '2px'; evSw.style.height = '10px'; evSw.style.borderRadius = '0'; } }

    /* stats */
    (function stats() {
      const items = [];
      const C = P.cited;
      const L = main.pts[main.pts.length - 1], back = (n) => main.pts[main.pts.length - 1 - n];
      const chg = (a, b) => (a && b ? (a.v - b.v) / b.v : null);
      if (full) {
        const term = series.find((s) => s.k === 'term');
        const m1 = chg(L, back(1));
        items.push({ v: U.usd(L.v), u: '/lb', l: 'Spot, end of ' + U.month(L.d), d: m1 == null ? '' : U.signed(U.pct(Math.abs(m1), 1), m1) + ' on the month', dir: m1 > 0 ? 'up' : m1 < 0 ? 'down' : null });
        if (term) { const T = term.pts[term.pts.length - 1]; items.push({ v: U.usd(T.v), u: '/lb', l: 'Long-term contract, end of ' + U.month(T.d), d: 'Spot is ' + U.usd(Math.abs(L.v - T.v)) + (L.v >= T.v ? ' above' : ' below') }); }
      } else if (C) {
        if (C.spot) items.push({ v: U.usd(C.spot.v), u: '/lb', l: 'Spot, end of ' + U.month(C.spot.d), d: 'Industry average, published by Cameco' });
        if (C.term) items.push({ v: U.usd(C.term.v), u: '/lb', l: 'Long-term contract, end of ' + U.month(C.term.d), d: C.spot ? 'Spot is ' + U.usd(Math.abs(C.spot.v - C.term.v)) + (C.spot.v >= C.term.v ? ' above' : ' below') : 'Industry average, published by Cameco' });
      }
      const y1 = chg(L, back(12));
      items.push({ v: y1 == null ? '–' : U.signed(U.pct(Math.abs(y1), 0), y1), l: (full ? 'Spot' : 'IMF monthly average') + ', change over twelve months', d: back(12) ? U.usd(back(12).v) + ' in ' + U.month(back(12).d) + ', ' + U.usd(L.v) + ' in ' + U.month(L.d) : '', dir: y1 > 0 ? 'up' : y1 < 0 ? 'down' : null });
      const hi = main.pts.reduce((a, b) => (b.v > a.v ? b : a));
      items.push({ v: U.usd(hi.v), u: '/lb', l: 'Highest month on record, ' + (full ? 'spot' : 'IMF average'), d: U.month(hi.d) });
      U.stats(U.$('#price-stats'), items);
      if (!full) {
        const fig = host.closest('.fig');
        const note = U.el('p', { class: 'note' }, 'The line is the International Monetary Fund’s monthly average, which is free to reuse. Since 2021 it has run 15 to 25 percent below the month-end spot price that brokers publish. ');
        if (C && C.url) { note.appendChild(document.createTextNode('The broker figures above are quoted from ')); note.appendChild(U.el('a', { href: C.url, target: '_blank', rel: 'noopener noreferrer', text: 'Cameco’s price page' })); note.appendChild(document.createTextNode('; their full history is licensed and is not reproduced here.')); }
        fig.insertBefore(note, U.$('.fig__tools', fig));
      }
    })();

    function render(w) {
      const h = w < 640 ? 320 : 440;
      const m = { t: 30, r: w < 640 ? 12 : 96, b: 44, l: 44 };
      const f = U.frame(host, w, h, m);
      f.svg.setAttribute('aria-label', 'Uranium price over time');
      const t0 = st.range === 'max' ? firstT : new Date(Date.UTC(lastT.getUTCFullYear() - +st.range, lastT.getUTCMonth(), 1));
      const vis = series.map((s) => ({ ...s, pts: s.pts.filter((p) => p.t >= t0) })).filter((s) => s.pts.length > 1);
      const x = d3.scaleUtc().domain([t0, lastT]).range([0, f.iw]);
      const vmax = d3.max(vis, (s) => d3.max(s.pts, (p) => p.v)), vmin = d3.min(vis, (s) => d3.min(s.pts, (p) => p.v));
      const y = st.log ? d3.scaleLog().domain([Math.max(1, vmin * 0.85), vmax * 1.1]).range([f.ih, 0]) : d3.scaleLinear().domain([0, vmax * 1.1]).range([f.ih, 0]);
      const ticks = st.log ? [5, 10, 20, 40, 80, 160].filter((t) => t >= y.domain()[0] && t <= y.domain()[1]) : y.ticks(5);
      U.yGrid(f, y, ticks, (t) => '$' + t);
      f.g.appendChild(U.el('text', { class: 'ax-label', x: -m.l + 2, y: -16, text: 'USD per lb U₃O₈, nominal' }));
      const xg = U.el('g', { class: 'ax' });
      x.ticks(w < 640 ? 4 : 8).forEach((t) => xg.appendChild(U.el('text', { x: x(t), y: f.ih + 18, 'text-anchor': 'middle', text: String(t.getUTCFullYear()) })));
      f.g.appendChild(xg);

      // events along the baseline
      const evVis = events.filter((e) => e.t >= t0 && e.t <= lastT);
      evVis.forEach((e) => { const px = Math.round(x(e.t)) + 0.5; f.g.appendChild(U.el('line', { x1: px, x2: px, y1: f.ih + 26, y2: f.ih + 36, stroke: 'var(--ink-3)', 'stroke-width': 2 })); });

      vis.slice().reverse().forEach((s) => {
        const curve = s.step ? d3.curveStepAfter : d3.curveMonotoneX;
        const line = d3.line().x((p) => x(p.t)).y((p) => y(p.v)).curve(curve);
        if (s === vis[0]) f.g.appendChild(U.el('path', { d: d3.area().x((p) => x(p.t)).y0(y(y.domain()[0])).y1((p) => y(p.v)).curve(curve)(s.pts), fill: 'var(' + s.c + ')', 'fill-opacity': 0.06 }));
        f.g.appendChild(U.el('path', { d: line(s.pts), fill: 'none', stroke: 'var(' + s.c + ')', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      });
      // end markers + labels
      const ends = vis.map((s) => { const p = s.pts[s.pts.length - 1]; return { s, p, y: y(p.v) }; }).sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
      ends.forEach((e) => {
        f.g.appendChild(U.el('circle', { cx: x(e.p.t), cy: y(e.p.v), r: 4, fill: 'var(' + e.s.c + ')', stroke: 'var(--paper)', 'stroke-width': 2 }));
        if (w >= 640) f.g.appendChild(U.el('text', { class: 'direct', x: Math.min(f.iw, x(e.p.t)) + 10, y: e.y, dy: '0.32em', text: e.s.short + ' ' + U.usd(e.p.v, e.p.v >= 100 ? 0 : 2) }));
      });

      // hover
      const cross = U.el('line', { class: 'crosshair', y1: 0, y2: f.ih + 22, visibility: 'hidden' }); f.g.appendChild(cross);
      const marks = vis.map((s) => { const c = U.el('circle', { r: 4, fill: 'var(' + s.c + ')', stroke: 'var(--paper)', 'stroke-width': 2, visibility: 'hidden' }); f.g.appendChild(c); return c; });
      const hit = U.el('rect', { x: 0, y: 0, width: f.iw, height: f.ih + 40, fill: 'transparent', tabindex: 0, 'aria-label': 'Price by month. Use arrow keys.' });
      f.g.appendChild(hit);
      const base = vis[0].pts, bis = d3.bisector((p) => p.t).center;
      let idx = base.length - 1;
      const valueAt = (s, p) => { if (!s.step) return s.pts.find((z) => z.d === p.d); let q = null; for (const z of s.pts) { if (z.t <= p.t) q = z; else break; } return q; };
      const show = (i, px, py) => {
        idx = Math.max(0, Math.min(base.length - 1, i));
        const p = base[idx], X = x(p.t);
        cross.setAttribute('x1', X); cross.setAttribute('x2', X); cross.setAttribute('visibility', 'visible');
        const rows = [];
        vis.forEach((s, j) => { const q = valueAt(s, p); if (q) { rows.push([s.step ? s.t + ' (' + q.d.slice(0, 4) + ')' : s.t, U.usd(q.v) + '/lb', U.css(s.c)]); marks[j].setAttribute('cx', X); marks[j].setAttribute('cy', y(q.v)); marks[j].setAttribute('visibility', 'visible'); } else marks[j].setAttribute('visibility', 'hidden'); });
        const near = evVis.filter((e) => Math.abs(e.t - p.t) < 46 * 86400000).slice(0, 2);
        const card = U.tip.card(U.month(p.d), null, rows);
        near.forEach((e) => { card.appendChild(U.el('div', { class: 'tip__t', style: { marginTop: '8px' }, text: e.title })); if (e.detail) card.appendChild(U.el('div', { class: 'tip__s', text: e.detail })); });
        const b = host.getBoundingClientRect();
        U.tip.show(px != null ? px : b.left + m.l + X, py != null ? py : b.top + m.t + 24, card);
      };
      const hide = () => { cross.setAttribute('visibility', 'hidden'); marks.forEach((c) => c.setAttribute('visibility', 'hidden')); U.tip.hide(); };
      hit.addEventListener('pointermove', (e) => { const b = hit.getBoundingClientRect(); show(bis(base, x.invert(((e.clientX - b.left) / b.width) * f.iw)), e.clientX, e.clientY); });
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(idx + 1); else if (e.key === 'ArrowLeft') show(idx - 1); else return; e.preventDefault(); });
      hit.addEventListener('blur', hide);
    }

    // table: one row per month, newest first, plus events
    (function table() {
      const byD = new Map();
      series.filter((s) => !s.step).forEach((s) => s.pts.forEach((p) => { const r = byD.get(p.d) || { d: p.d }; r[s.k] = p.v; byD.set(p.d, r); }));
      events.forEach((e) => { const k = String(e.date).slice(0, 7); const r = byD.get(k); if (r) r.event = (r.event ? r.event + '; ' : '') + e.title; });
      const rows = Array.from(byD.values()).sort((a, b) => (a.d < b.d ? 1 : -1));
      U.table(U.$('#price-table'), [{ k: 'd', t: 'Month', l: true, f: (v) => U.month(v) }].concat(series.filter((s) => !s.step).map((s) => ({ k: s.k, t: s.t + ', $/lb', f: (v) => (v == null ? '–' : U.n(v, 2)) })), [{ k: 'event', t: 'Event', l: true, f: (v) => v || '' }]), rows);
    })();

    const ask = U.responsive(host, render);
    const srcs = (P.sources_list || []).map((s) => ({ t: s.t, url: s.url }));
    U.titleblock('tb-price', { title: full ? 'U₃O₈ spot and long-term price' : 'U₃O₈ price, IMF monthly average', unit: 'USD per lb U₃O₈, nominal', asof: P.as_of || null, sources: srcs.length ? srcs : [{ t: 'see Sources', url: '#sources' }] });
  }
})();
