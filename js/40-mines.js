/* FIG. 05 — who mines it (countries), FIG. 06 — the largest mines, FIG. 07 — when new supply arrives. */
(function () {
  'use strict';
  const U = window.U;
  U.mines = { init };

  function init() {
    const mines = U.data.mines; if (!mines || !mines.length) return;
    const M = U.model, now = M.nowYear;
    const years = Array.from(new Set(mines.flatMap((m) => Object.keys(m.production_tu || {}).filter((k) => m.production_tu[k] != null).map(Number)))).sort((a, b) => a - b);
    const LY = years[years.length - 1];
    const st = { year: LY };
    const prodIn = (m, y) => (m.production_tu || {})[y] || 0;

    /* ----- stats ----- */
    function stats() {
      const world = M.worldProd[LY] != null ? M.worldProd[LY] : d3.sum(mines, (m) => prodIn(m, LY));
      const ranked = mines.filter((m) => prodIn(m, LY) > 0).sort((a, b) => prodIn(b, LY) - prodIn(a, LY));
      const top5 = d3.sum(ranked.slice(0, 5), (m) => prodIn(m, LY));
      const byC = d3.rollups(ranked, (v) => d3.sum(v, (m) => prodIn(m, LY)), (m) => m.country).sort((a, b) => b[1] - a[1]);
      const need = (U.data.country_requirements && U.data.country_requirements.world && U.data.country_requirements.world.uranium_required_tu) || M.demand(LY, {}).tu;
      U.stats(U.$('#mines-stats'), [
        { v: U.fmtU(world), u: U.unitShort(), l: 'World mine output, ' + LY, d: need ? 'Equal to ' + U.pct(world / need) + ' of the world reactor requirement' : '' },
        { v: String(ranked.length), l: 'Mines that shipped uranium in ' + LY, d: 'Listed individually on this page' },
        { v: U.pct(top5 / world), l: 'Share from the five largest mines', d: ranked.slice(0, 3).map((m) => m.short || m.name).join(', ') },
        { v: byC.length ? U.pct(byC[0][1] / world) : '–', l: byC.length ? 'Share mined in ' + byC[0][0] : 'Largest country share', d: byC.length > 1 ? 'Then ' + byC.slice(1, 3).map((c) => c[0]).join(' and ') : '' },
      ]);
    }

    /* ----- country share: one whole, split into parts ----- */
    function countryBar() {
      const host = U.clear(U.$('#country-bar'));
      const pbc = U.data.production_by_country;
      let parts;
      const cy = pbc && pbc.countries ? d3.max(pbc.countries.flatMap((c) => Object.keys(c.tu || {}).filter((k) => c.tu[k] != null).map(Number))) : null;
      if (cy) parts = pbc.countries.map((c) => ({ name: c.country, v: c.tu[cy] || 0 })).filter((p) => p.v > 0);
      else parts = d3.rollups(mines, (v) => d3.sum(v, (m) => prodIn(m, LY)), (m) => m.country).map(([name, v]) => ({ name, v })).filter((p) => p.v > 0);
      parts.sort((a, b) => b.v - a.v);
      const total = d3.sum(parts, (p) => p.v);
      const head = parts.slice(0, 7), rest = parts.slice(7);
      if (rest.length) head.push({ name: rest.length + ' others', v: d3.sum(rest, (p) => p.v), other: true });
      const bar = U.el('div', { style: { display: 'flex', gap: '2px', height: '28px' }, role: 'img', 'aria-label': 'Share of world uranium mine production by country, ' + (cy || LY) + ': ' + head.map((p) => p.name + ' ' + U.pct(p.v / total)).join(', ') });
      const leg = U.el('div', { class: 'legend', style: { marginTop: '12px', marginBottom: '0' } });
      head.forEach((p) => {
        const share = p.v / total;
        const seg = U.el('div', { style: { flex: share + ' 1 0', minWidth: '3px', background: p.other ? 'var(--neutral-mark)' : 'var(--supply)', borderRadius: '4px', color: '#121610', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', paddingLeft: '8px', overflow: 'hidden', whiteSpace: 'nowrap' } });
        seg._label = p.name + ' ' + U.pct(share); seg._short = U.pct(share);
        seg.addEventListener('pointermove', (e) => U.tip.show(e.clientX, e.clientY, U.tip.card(p.name, String(cy || LY), [['Mined', U.fmtUu(p.v), U.css('--supply')], ['Share of world', U.pct(share, 1)]])));
        seg.addEventListener('pointerleave', () => U.tip.hide());
        bar.appendChild(seg);
        leg.appendChild(U.el('span', { class: 'legend__item' }, U.el('b', { text: p.name, style: { fontWeight: '560' } }), U.el('span', { class: 'num', style: { color: 'var(--ink-3)' }, text: U.pct(share, share < 0.1 ? 1 : 0) + ' · ' + U.fmtUu(p.v) })));
      });
      host.appendChild(bar); host.appendChild(leg);
      // print a label inside a block only when it fits
      const fit = () => Array.from(bar.children).forEach((seg) => { const w = seg.clientWidth; seg.textContent = w > seg._label.length * 7.2 + 16 ? seg._label : w > 46 ? seg._short : ''; });
      fit(); if (window.ResizeObserver) new ResizeObserver(fit).observe(bar);
      U.titleblock('tb-country', { title: 'Mine production by country, ' + (cy || LY), unit: 'share of world tU', sources: [{ t: 'Sum of the mines listed on this page' }, { t: 'history: NEA and IAEA Red Book (CC BY 4.0)', url: 'https://www.oecd-nea.org/' }, { t: 'see Sources', url: '#sources' }] });
    }

    /* ----- largest mines ----- */
    const mHost = U.$('#mines-chart');
    const ctl = U.$('#mines-controls');
    if (years.length > 1) ctl.appendChild(U.seg('Year', years.slice(-4).map((y) => ({ v: y, t: String(y) })), st.year, (v) => { st.year = v; askMines(); tables(); }));
    function minesChart(w) {
      const list = mines.filter((m) => prodIn(m, st.year) > 0 || (m.status === 'operating' && m.capacity_tu)).sort((a, b) => prodIn(b, st.year) - prodIn(a, st.year)).slice(0, 22);
      const narrow = w < 640;
      const labelW = narrow ? 0 : Math.min(250, w * 0.3);
      const rowH = narrow ? 44 : 30;
      const m = { t: 22, r: 64, b: 8, l: labelW };
      const f = U.frame(mHost, w, list.length * rowH + m.t + m.b, m);
      f.svg.setAttribute('aria-label', 'Largest uranium mines by production in ' + st.year);
      const max = d3.max(list, (d) => Math.max(prodIn(d, st.year), d.capacity_tu || 0)) || 1;
      const x = d3.scaleLinear().domain([0, U.toUnit(max)]).nice(4).range([0, f.iw]);
      const X = (tu) => x(U.toUnit(tu));
      x.ticks(4).forEach((t) => {
        const px = Math.round(x(t)) + 0.5;
        f.g.appendChild(U.el('line', { class: t === 0 ? 'baseline' : 'gridline', x1: px, x2: px, y1: -4, y2: list.length * rowH }));
        f.g.appendChild(U.el('text', { class: 'ax-label', x: px, y: -10, 'text-anchor': 'middle', text: U.axisNum(t) }));
      });
      list.forEach((d, i) => {
        const y = i * rowH, v = prodIn(d, st.year), bh = 14, by = narrow ? y + 22 : y + (rowH - bh) / 2;
        const g = U.el('g', { tabindex: 0, 'aria-label': d.name + ', ' + d.country + ': ' + U.fmtUu(v) });
        if (narrow) {
          g.appendChild(U.el('text', { class: 'direct', x: 0, y: y + 14, text: d.short || d.name }));
          g.appendChild(U.el('text', { class: 'ax-label', x: f.iw + m.r, y: y + 14, 'text-anchor': 'end', text: d.country }));
        } else {
          g.appendChild(U.el('text', { class: 'direct', x: -12, y: by + bh / 2, dy: '0.32em', 'text-anchor': 'end', text: clip(d.short || d.name, 21) }));
          g.appendChild(U.el('text', { class: 'ax-label', x: -labelW, y: by + bh / 2, dy: '0.32em', text: cShort(d.country) }));
        }
        const bw = Math.max(0, X(v));
        if (bw > 0) g.appendChild(U.el('path', { d: barPath(0, by, bw, bh, 4), fill: 'var(--supply)' }));
        if (d.capacity_tu) { const cxp = Math.round(X(d.capacity_tu)) + 0.5; g.appendChild(U.el('line', { x1: cxp, x2: cxp, y1: by - 4, y2: by + bh + 4, stroke: 'var(--ink)', 'stroke-width': 1.5 })); }
        const labelX = Math.max(bw, d.capacity_tu ? X(d.capacity_tu) : 0) + 8;
        g.appendChild(U.el('text', { class: 'direct direct--muted num', x: labelX, y: by + bh / 2, dy: '0.32em', text: U.fmtU(v) }));
        const hit = U.el('rect', { x: -labelW, y: y, width: w, height: rowH, fill: 'transparent' });
        g.appendChild(hit);
        const tip = (e, px, py) => U.tip.show(px, py, U.tip.card(d.name, [d.country, d.operator].filter(Boolean).join(' · '), [
          ['Produced in ' + st.year, U.fmtUu(v), U.css('--supply')],
          d.capacity_tu ? ['Capacity', U.fmtUu(d.capacity_tu)] : null,
          d.capacity_tu && v ? ['Running at', U.pct(v / d.capacity_tu)] : null,
          ['Method', U.methodName ? U.methodName(d.method) : d.method],
          d.cost_usd_lb && (d.cost_usd_lb.aisc || d.cost_usd_lb.cash) ? [d.cost_usd_lb.aisc ? 'All-in cost' : 'Cash cost', U.usd(d.cost_usd_lb.aisc || d.cost_usd_lb.cash) + '/lb'] : null,
        ]));
        hit.addEventListener('pointermove', (e) => tip(e, e.clientX, e.clientY));
        hit.addEventListener('pointerleave', () => U.tip.hide());
        g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); tip(null, b.left + labelW + 40, b.top + 8); });
        g.addEventListener('blur', () => U.tip.hide());
        f.g.appendChild(g);
      });
    }
    const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s || '');
    const CSHORT = { 'United States': 'USA', 'South Africa': 'S. Africa', 'Central African Republic': 'C.A.R.', 'Czech Republic': 'Czechia', 'United Kingdom': 'UK' };
    const cShort = (c) => clip(CSHORT[c] || c, 12);
    // horizontal bar, square at the baseline, rounded at the data end
    const barPath = (x, y, w, h, r) => { r = Math.min(r, w, h / 2); return 'M' + x + ',' + y + 'h' + (w - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (h - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + -r + ',' + r + 'h' + -(w - r) + 'z'; };

    /* ----- nameplate against actual ----- */
    const npHost = U.$('#nameplate-chart');
    const npRows = mines.filter((m) => m.capacity_tu > 0 && M.bucketOf(m) === 'operating' && (prodIn(m, LY) > 0 || m.status === 'ramp-up'))
      .map((m) => ({ m, v: prodIn(m, LY), cap: m.capacity_tu, pct: prodIn(m, LY) / m.capacity_tu, ramp: m.status === 'ramp-up' }))
      .sort((a, b) => b.cap - a.cap);
    function nameplateChart(w) {
      const list = npRows.slice(0, 26);
      const narrow = w < 640, labelW = narrow ? 0 : Math.min(250, w * 0.3), rowH = narrow ? 42 : 28;
      const mg = { t: 22, r: narrow ? 46 : 150, b: 8, l: labelW };
      const f = U.frame(npHost, w, list.length * rowH + mg.t + mg.b, mg);
      f.svg.setAttribute('aria-label', 'Mine output in ' + LY + ' as a share of nameplate capacity');
      const xmax = Math.max(1.1, d3.max(list, (d) => d.pct) || 1);
      const x = d3.scaleLinear().domain([0, xmax]).range([0, f.iw]);
      [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
        const px = Math.round(x(t)) + 0.5;
        f.g.appendChild(U.el('line', { class: t === 0 ? 'baseline' : 'gridline', x1: px, x2: px, y1: -4, y2: list.length * rowH }));
        f.g.appendChild(U.el('text', { class: 'ax-label', x: px, y: -10, 'text-anchor': 'middle', text: t === 1 ? 'Nameplate' : Math.round(t * 100) + '%' }));
      });
      const nx = Math.round(x(1)) + 0.5;
      f.g.appendChild(U.el('line', { x1: nx, x2: nx, y1: -4, y2: list.length * rowH, stroke: 'var(--ink)', 'stroke-width': 1.5 }));
      list.forEach((d, i) => {
        const y = i * rowH, bh = 12, by = narrow ? y + 22 : y + (rowH - bh) / 2;
        const g = U.el('g', { tabindex: 0, 'aria-label': d.m.name + ': ' + U.pct(d.pct) + ' of nameplate' });
        if (narrow) g.appendChild(U.el('text', { class: 'direct', x: 0, y: y + 14, text: (d.m.short || d.m.name) + ' · ' + cShort(d.m.country) }));
        else {
          g.appendChild(U.el('text', { class: 'direct', x: -12, y: by + bh / 2, dy: '0.32em', 'text-anchor': 'end', text: clip(d.m.short || d.m.name, 21) }));
          g.appendChild(U.el('text', { class: 'ax-label', x: -labelW, y: by + bh / 2, dy: '0.32em', text: cShort(d.m.country) }));
        }
        const bw = Math.max(d.ramp ? 3 : 0, x(d.pct));
        if (d.ramp) g.appendChild(U.el('rect', { x: 0.75, y: by + 0.75, width: Math.max(2, bw - 1.5), height: bh - 1.5, rx: 2, fill: 'none', stroke: 'var(--supply)', 'stroke-width': 1.5 }));
        else if (bw > 0) g.appendChild(U.el('path', { d: barPath(0, by, bw, bh, 4), fill: 'var(--supply)' }));
        g.appendChild(U.el('text', { class: 'direct direct--muted num', x: Math.max(bw, 0) + 8, y: by + bh / 2, dy: '0.32em', text: U.pct(d.pct) + (narrow ? '' : ' · ' + U.fmtU(d.v) + ' of ' + U.fmtU(d.cap)) }));
        const hit = U.el('rect', { x: -labelW, y: y, width: w, height: rowH, fill: 'transparent' });
        g.appendChild(hit);
        const tip = (px, py) => U.tip.show(px, py, U.tip.card(d.m.name, [d.m.country, d.m.operator].filter(Boolean).join(' · '), [
          ['Produced in ' + LY, U.fmtUu(d.v), U.css('--supply')], ['Nameplate', U.fmtUu(d.cap)], ['Share of nameplate', U.pct(d.pct)], d.ramp ? ['Stage', 'Still ramping up'] : null]));
        hit.addEventListener('pointermove', (e) => tip(e.clientX, e.clientY));
        hit.addEventListener('pointerleave', () => U.tip.hide());
        g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); tip(b.left + labelW + 40, b.top + 8); });
        g.addEventListener('blur', () => U.tip.hide());
        f.g.appendChild(g);
      });
    }
    function nameplateExtras() {
      const est = npRows.filter((d) => !d.ramp), all = npRows;
      const share = (rows) => d3.sum(rows, (d) => d.v) / (d3.sum(rows, (d) => d.cap) || 1);
      U.$('#nameplate-note').textContent = 'Established mines together produced ' + U.fmtUu(d3.sum(est, (d) => d.v)) + ' of the ' + U.fmtUu(d3.sum(est, (d) => d.cap)) + ' they are built for, ' + U.pct(share(est)) + '. Counting mines still ramping up, ' + U.pct(share(all)) + '. A mine early in its ramp is not behind plan by that fact alone; the chart shows where output stands, not why.';
      U.table(U.$('#nameplate-table'), [
        { k: 'n', t: 'Mine', l: true, f: (v, r) => r.m.name }, { k: 'c', t: 'Country', l: true, f: (v, r) => r.m.country },
        { k: 'v', t: String(LY), f: (v) => U.fmtU(v) }, { k: 'cap', t: 'Nameplate', f: (v) => U.fmtU(v) }, { k: 'pct', t: 'Share', f: (v) => U.pct(v) },
        { k: 'ramp', t: 'Stage', l: true, f: (v) => (v ? 'Ramping up' : 'Established') },
      ], npRows);
    }
    if (npHost && npRows.length > 3) {
      U.legend(U.$('#nameplate-legend'), [{ t: 'Established mine', c: 'var(--supply)' }, { t: 'Still ramping up', c: 'var(--supply)', kind: 'ring' }, { t: 'Nameplate capacity', c: 'var(--ink)', kind: 'line' }]);
      U.responsive(npHost, nameplateChart); nameplateExtras(); U.on('units', nameplateExtras);
    }

    /* ----- projects ----- */
    const pHost = U.$('#projects-chart');
    const BK = { restart: { t: 'Restart of an idled mine', c: '--supply-2' }, development: { t: 'New mine in development', c: '--supply-3' }, proposed: { t: 'Proposed', c: '--supply-3', ring: true }, operating: { t: 'Ramping up now', c: '--supply' } };
    const projSt = { size: 'big', proposed: false };
    const allProjects = mines.map((m) => {
      const b = M.bucketOf(m); if (!b) return null;
      if (b === 'operating' && m.status !== 'ramp-up') return null;
      const out = m.planned_output_tu || {};
      const base = out.base != null ? out.base : m.capacity_tu;
      if (!base) return null;
      if (b === 'operating') { // already producing: shown at "now", with how far it still has to climb
        const last = m._last ? m._last.v : 0;
        if (base - last < 40) return null;
        return { m, b, early: now, late: now, plan: null, base, low: out.low != null ? out.low : base, high: out.high != null ? out.high : base, ramping: true, last };
      }
      const rng = m.start_year_range || {};
      const early = rng.early || m.planned_start_year, late = rng.late || m.planned_start_year || early;
      if (early == null) return null;
      return { m, b, early: Math.max(now, early), late: Math.max(now, late), plan: m.planned_start_year != null ? Math.max(now, m.planned_start_year) : null, base, low: out.low != null ? out.low : base, high: out.high != null ? out.high : base };
    }).filter(Boolean).sort((a, b) => (a.ramping ? 0 : 1) - (b.ramping ? 0 : 1) || (a.plan || a.early) - (b.plan || b.early) || b.base - a.base);
    const BIG = 1e6 / U.LB_PER_TU; // one million pounds a year, in tU
    const projectList = () => allProjects.filter((d) => (projSt.proposed || d.b !== 'proposed') && (projSt.size === 'all' || d.base >= BIG));
    const projects = allProjects;
    U.legend(U.$('#projects-legend'), [
      { t: BK.operating.t, c: 'var(--supply)' }, { t: BK.restart.t, c: 'var(--supply-2)' }, { t: BK.development.t, c: 'var(--supply-3)' }, { t: BK.proposed.t, c: 'var(--supply-3)', kind: 'ring' },
    ]);
    function projectsChart(w) {
      const list = projectList().slice(0, 60);
      const narrow = w < 720;
      const labelW = narrow ? 0 : Math.min(240, w * 0.26);
      const outW = narrow ? 86 : 190;
      const rowH = narrow ? 42 : 28;
      const m = { t: 24, r: outW, b: 8, l: labelW };
      const f = U.frame(pHost, w, list.length * rowH + m.t + m.b, m);
      f.svg.setAttribute('aria-label', 'Uranium projects by first year of production');
      const y0 = now - 1, y1 = Math.max(M.horizon, d3.max(list, (d) => d.late) || M.horizon);
      const x = d3.scaleLinear().domain([y0, y1]).range([8, f.iw - 8]);
      d3.range(Math.ceil(y0 / 2) * 2, y1 + 1, narrow ? 4 : 2).forEach((yr) => {
        const px = Math.round(x(yr)) + 0.5;
        f.g.appendChild(U.el('line', { class: 'gridline', x1: px, x2: px, y1: -4, y2: list.length * rowH }));
        f.g.appendChild(U.el('text', { class: 'ax-label', x: px, y: -10, 'text-anchor': 'middle', text: String(yr) }));
      });
      const nx = Math.round(x(now)) + 0.5;
      f.g.appendChild(U.el('line', { x1: nx, x2: nx, y1: -4, y2: list.length * rowH, stroke: 'var(--ink-3)', 'stroke-width': 1 }));
      const maxOut = d3.max(list, (d) => d.high) || 1;
      const ox = d3.scaleLinear().domain([0, maxOut]).range([0, outW - (narrow ? 44 : 78)]);
      f.g.appendChild(U.el('text', { class: 'ax-label', x: f.iw + 14, y: -10, text: narrow ? U.unitShort() + '/yr' : 'At full output, ' + U.unitShort() + '/yr' }));
      list.forEach((d, i) => {
        const y = i * rowH, cy = narrow ? y + 28 : y + rowH / 2, bk = BK[d.b];
        const g = U.el('g', { tabindex: 0, 'aria-label': d.m.name + ', ' + d.m.country + ': first production ' + d.early + (d.late !== d.early ? ' to ' + d.late : '') + ', ' + U.fmtUu(d.base) + ' per year at full output' });
        if (narrow) g.appendChild(U.el('text', { class: 'direct', x: 0, y: y + 14, text: (d.m.short || d.m.name) + ' · ' + d.m.country }));
        else {
          g.appendChild(U.el('text', { class: 'direct', x: -12, y: cy, dy: '0.32em', 'text-anchor': 'end', text: clip(d.m.short || d.m.name, 21) }));
          g.appendChild(U.el('text', { class: 'ax-label', x: -labelW, y: cy, dy: '0.32em', text: cShort(d.m.country) }));
        }
        const xa = x(d.early), xb = x(d.late);
        const bar = U.el('rect', { x: xa - 4, y: cy - 4, width: Math.max(8, xb - xa + 8), height: 8, rx: 4, fill: bk.ring ? 'none' : 'var(' + bk.c + ')' });
        if (bk.ring) { bar.setAttribute('stroke', 'var(' + bk.c + ')'); bar.setAttribute('stroke-width', 1.4); }
        g.appendChild(bar);
        if (d.plan != null) g.appendChild(U.el('circle', { cx: x(d.plan), cy: cy, r: 4.5, fill: 'var(--ink)', stroke: 'var(--paper)', 'stroke-width': 2 }));
        // output: low–high range with base mark
        const bx = f.iw + 14;
        g.appendChild(U.el('rect', { x: bx, y: cy - 5, width: Math.max(2, ox(d.base)), height: 10, rx: 2, fill: bk.ring ? 'none' : 'var(' + bk.c + ')', stroke: bk.ring ? 'var(' + bk.c + ')' : 'none', 'stroke-width': 1.2 }));
        g.appendChild(U.el('text', { class: 'direct direct--muted num', x: bx + Math.max(2, ox(d.base)) + 6, y: cy, dy: '0.32em', text: U.fmtU(d.base) }));
        const hit = U.el('rect', { x: -labelW, y: y, width: w, height: rowH, fill: 'transparent' });
        g.appendChild(hit);
        const tip = (px, py) => U.tip.show(px, py, U.tip.card(d.m.name, [d.m.country, d.m.operator].filter(Boolean).join(' · '), [
          ['Kind', bk.t],
          d.ramping ? ['Produced last year', U.fmtUu(d.last)] : ['First production', d.early === d.late ? String(d.early) : d.early + '–' + d.late],
          d.plan != null ? ["Company's date", String(d.plan)] : null,
          ['At full output', (d.low !== d.high ? U.fmtU(d.low) + '–' + U.fmtU(d.high) : U.fmtU(d.base)) + ' ' + U.unitShort() + '/yr', U.css(bk.c)],
          d.m.permitting_stage ? ['Stage', clip(d.m.permitting_stage, 44)] : null,
        ]));
        hit.addEventListener('pointermove', (e) => tip(e.clientX, e.clientY));
        hit.addEventListener('pointerleave', () => U.tip.hide());
        g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); tip(b.left + labelW + 40, b.top + 8); });
        g.addEventListener('blur', () => U.tip.hide());
        f.g.appendChild(g);
      });
    }

    function tables() {
      U.table(U.$('#mines-table'), [
        { k: 'name', t: 'Mine', l: true }, { k: 'country', t: 'Country', l: true }, { k: 'operator', t: 'Operator', l: true, f: (v) => v || '–' },
        { k: 'method', t: 'Method', l: true, f: (v) => (U.methodName ? U.methodName(v) : v) },
        { k: 'p', t: String(st.year), f: (v, r) => U.fmtU(prodIn(r, st.year)) }, { k: 'capacity_tu', t: 'Capacity', f: (v) => (v ? U.fmtU(v) : '–') },
        { k: 'status', t: 'Status', l: true, f: (v) => (U.statusName ? U.statusName(v) : v) },
      ], mines.filter((m) => prodIn(m, st.year) > 0).sort((a, b) => prodIn(b, st.year) - prodIn(a, st.year)));
      U.table(U.$('#projects-table'), [
        { k: 'name', t: 'Project', l: true, f: (v, r) => r.m.name }, { k: 'country', t: 'Country', l: true, f: (v, r) => r.m.country }, { k: 'operator', t: 'Operator', l: true, f: (v, r) => r.m.operator || '–' },
        { k: 'b', t: 'Kind', l: true, f: (v) => BK[v].t }, { k: 'early', t: 'Earliest' }, { k: 'late', t: 'Latest' }, { k: 'plan', t: 'Company date', f: (v) => v || '–' },
        { k: 'base', t: 'Full output', f: (v) => U.fmtU(v) },
      ], projects);
    }

    /* ----- cost curve ----- */
    const costOf = (m) => { const c = m.cost_usd_lb; if (!c) return null; const v = c.aisc != null ? c.aisc : c.cash; return v != null && isFinite(v) ? { v: +v, kind: c.aisc != null ? 'All-in sustaining cost' : 'Cash cost', basis: c.basis || null, year: c.year || null, prior: c.prior || null } : null; };
    const costSt = { scope: 'operating' };
    function costRows() {
      return mines.map((m) => {
        const c = costOf(m), b = M.bucketOf(m); if (!c || !b) return null;
        const out = b === 'operating' ? (prodIn(m, LY) || (m.planned_output_tu && m.planned_output_tu.base) || 0) : ((m.planned_output_tu && m.planned_output_tu.base) || m.capacity_tu || 0);
        if (!out) return null;
        if (costSt.scope === 'operating' && b !== 'operating') return null;
        return { m, b, c, out };
      }).filter(Boolean).sort((a, b) => a.c.v - b.c.v);
    }
    function costChart(w) {
      const cHost = U.$('#cost-chart'), rows = costRows();
      const h = w < 640 ? 320 : 420, mg = { t: 30, r: w < 640 ? 12 : 110, b: 40, l: 44 };
      const f = U.frame(cHost, w, h, mg);
      f.svg.setAttribute('aria-label', 'Uranium mine cost curve: cost per pound against cumulative annual output');
      const total = d3.sum(rows, (r) => r.out);
      const need = M.demand(now, { firstCores: false }).tu;
      const P = U.data.prices && U.data.prices.cited;
      const refs = [];
      if (P && P.spot) refs.push({ v: P.spot.v, t: 'Spot ' + U.usd(P.spot.v, 0) });
      if (P && P.term) refs.push({ v: P.term.v, t: 'Term ' + U.usd(P.term.v, 0) });
      const x = d3.scaleLinear().domain([0, U.toUnit(Math.max(total, costSt.scope === 'all' ? need * 1.02 : 0))]).range([0, f.iw]);
      const ymax = Math.max(d3.max(rows, (r) => r.c.v) || 0, d3.max(refs, (r) => r.v) || 0) * 1.12;
      const y = d3.scaleLinear().domain([0, ymax]).nice(5).range([f.ih, 0]);
      U.yGrid(f, y, y.ticks(5), (t) => '$' + t);
      f.g.appendChild(U.el('text', { class: 'ax-label', x: -mg.l + 2, y: -16, text: 'USD per lb U₃O₈' }));
      const xg = U.el('g', { class: 'ax' });
      x.ticks(w < 640 ? 4 : 8).forEach((t) => xg.appendChild(U.el('text', { x: x(t), y: f.ih + 18, 'text-anchor': 'middle', text: U.axisNum(t) })));
      xg.appendChild(U.el('text', { x: f.iw, y: f.ih + 34, 'text-anchor': 'end', text: 'Cumulative output, ' + U.unitName() + ' per year' }));
      f.g.appendChild(xg);
      let acc = 0;
      rows.forEach((r) => {
        const x0 = x(U.toUnit(acc)), x1 = x(U.toUnit(acc + r.out)); acc += r.out;
        const bw = Math.max(1, x1 - x0 - 2), yy = y(r.c.v), color = r.b === 'operating' ? '--supply' : r.b === 'restart' ? '--supply-2' : '--supply-3';
        const rect = U.el('rect', { x: x0 + 1, y: yy, width: bw, height: Math.max(1, f.ih - yy), fill: r.b === 'proposed' ? 'none' : 'var(' + color + ')', tabindex: 0, 'aria-label': r.m.name + ': ' + U.usd(r.c.v) + ' per pound, ' + U.fmtUu(r.out) + ' per year' });
        if (r.b === 'proposed') { rect.setAttribute('stroke', 'var(' + color + ')'); rect.setAttribute('stroke-width', 1.2); }
        const tip = (px, py) => U.tip.show(px, py, U.tip.card(r.m.name, [r.m.country, r.m.operator].filter(Boolean).join(' · '), [
          [r.c.kind, U.usd(r.c.v) + '/lb', U.css(color)], ['Output', U.fmtUu(r.out) + '/yr'], r.c.basis ? ['Basis', clip(String(r.c.basis), 40)] : null, r.c.year ? ['Year', String(r.c.year)] : null, r.c.prior ? [r.c.prior.year + ' actual', U.usd(r.c.prior.aisc != null ? r.c.prior.aisc : r.c.prior.cash) + '/lb'] : null]));
        rect.addEventListener('pointermove', (e) => tip(e.clientX, e.clientY));
        rect.addEventListener('pointerleave', () => U.tip.hide());
        rect.addEventListener('focus', () => { const b = rect.getBoundingClientRect(); tip(b.left + b.width / 2, b.top); });
        rect.addEventListener('blur', () => U.tip.hide());
        f.g.appendChild(rect);
        if (bw > 74 && w >= 640) f.g.appendChild(U.el('text', { class: 'ax-label', x: x0 + 1 + bw / 2, y: yy - 6, 'text-anchor': 'middle', text: clip(r.m.short || r.m.name, Math.floor(bw / 7)) }));
      });
      refs.forEach((r) => {
        const yy = Math.round(y(r.v)) + 0.5;
        f.g.appendChild(U.el('line', { x1: 0, x2: f.iw, y1: yy, y2: yy, stroke: 'var(--market)', 'stroke-width': 1.5 }));
        if (w >= 640) f.g.appendChild(U.el('text', { class: 'direct', x: f.iw + 10, y: yy, dy: '0.32em', text: r.t }));
      });
      if (need && U.toUnit(need) <= x.domain()[1]) {
        const nx = Math.round(x(U.toUnit(need))) + 0.5;
        f.g.appendChild(U.el('line', { x1: nx, x2: nx, y1: 0, y2: f.ih, stroke: 'var(--demand)', 'stroke-width': 2 }));
        f.g.appendChild(U.el('text', { class: 'direct', x: nx - 6, y: 8, 'text-anchor': 'end', text: 'Reactors need ' + U.fmtU(need) }));
      }
      const withCost = rows.length, all = mines.filter((m) => M.bucketOf(m) === 'operating' && prodIn(m, LY) > 0).length;
      U.$('#cost-note').textContent = 'Costs are as each owner reports them, on different bases and in different years, so read the shape and not the decimals. ' + (costSt.scope === 'operating' ? withCost + ' of ' + all + ' producing mines publish a cost; the rest are left out, so the curve is shorter than real supply.' : 'New mines use the figure in their latest study.') + (refs.length ? ' Price lines are the latest month-end industry averages.' : '');
    }
    function costTable() {
      U.table(U.$('#cost-table'), [
        { k: 'n', t: 'Mine', l: true, f: (v, r) => r.m.name }, { k: 'c', t: 'Country', l: true, f: (v, r) => r.m.country },
        { k: 'k', t: 'Measure', l: true, f: (v, r) => r.c.kind }, { k: 'v', t: '$/lb', f: (v, r) => U.n(r.c.v, 2) },
        { k: 'out', t: 'Output / yr', f: (v) => U.fmtU(v) }, { k: 'b', t: 'Basis', l: true, f: (v, r) => (r.c.basis || '') + (r.c.year ? ' ' + r.c.year : '') },
      ], costRows());
    }
    const anyCost = mines.filter((m) => costOf(m) && M.bucketOf(m)).length;
    if (anyCost >= 8) {
      U.$('#cost-block').hidden = false;
      const askCost = U.responsive(U.$('#cost-chart'), costChart);
      U.$('#cost-controls').appendChild(U.seg('Show', [{ v: 'operating', t: 'Producing mines' }, { v: 'all', t: 'With restarts and new mines' }], costSt.scope, (v) => { costSt.scope = v; askCost(); costTable(); }));
      U.legend(U.$('#cost-legend'), [{ t: 'Producing', c: 'var(--supply)' }, { t: 'Restart', c: 'var(--supply-2)' }, { t: 'New mine', c: 'var(--supply-3)' }, { t: 'Reactor need', c: 'var(--demand)', kind: 'line' }, { t: 'Price', c: 'var(--market)', kind: 'line' }]);
      costTable(); U.on('units', costTable);
    }

    /* ----- producers' own unit costs, year by year ----- */
    const MC = U.data.mining_costs, chHost = U.$('#costs-chart');
    const STYLE = { kap_c1: ['--supply', 'Kazatomprom, cash cost'], kap_aisc: ['--supply-3', 'Kazatomprom, all-in sustaining'], cameco_cash: ['--ink', 'Cameco, cash cost'], cameco_total: ['--ink-3', 'Cameco, total cost'] };
    const costSeries = MC && MC.series ? Object.keys(STYLE).map((id) => MC.series.find((x) => x.id === id)).filter(Boolean).map((x) => ({ ...x, c: STYLE[x.id][0], label: STYLE[x.id][1] })) : [];
    function costHistory(w) {
      const h = w < 640 ? 320 : 420, mg = { t: 30, r: w < 640 ? 14 : 220, b: 30, l: 44 };
      const f = U.frame(chHost, w, h, mg);
      f.svg.setAttribute('aria-label', 'Unit cost of mining uranium by year, as reported by Kazatomprom and Cameco');
      const yrs = costSeries.flatMap((x) => x.points.map((p) => p.year).concat(x.guidance ? [x.guidance.year] : []));
      const x = d3.scaleLinear().domain([d3.min(yrs), d3.max(yrs)]).range([0, f.iw]);
      const vmax = d3.max(costSeries, (x2) => Math.max(d3.max(x2.points, (p) => p.v), x2.guidance ? x2.guidance.high : 0));
      const y = d3.scaleLinear().domain([0, vmax * 1.1]).nice(5).range([f.ih, 0]);
      U.yGrid(f, y, y.ticks(5), (t) => '$' + t);
      f.g.appendChild(U.el('text', { class: 'ax-label', x: -mg.l + 2, y: -16, text: 'USD per lb U₃O₈, nominal' }));
      const xg = U.el('g', { class: 'ax' });
      d3.range(Math.ceil(x.domain()[0]), x.domain()[1] + 1).forEach((yr) => { if (w >= 640 || (yr - x.domain()[1]) % 2 === 0) xg.appendChild(U.el('text', { x: x(yr), y: f.ih + 18, 'text-anchor': 'middle', text: String(yr) })); });
      f.g.appendChild(xg);
      const ends = [];
      costSeries.forEach((sr) => {
        const col = 'var(' + sr.c + ')';
        f.g.appendChild(U.el('path', { d: d3.line().x((p) => x(p.year)).y((p) => y(p.v))(sr.points), fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
        sr.points.forEach((p) => {
          const dot = U.el('circle', { cx: x(p.year), cy: y(p.v), r: 3.5, fill: col, stroke: 'var(--paper)', 'stroke-width': 1.5 });
          f.g.appendChild(dot);
        });
        const last = sr.points[sr.points.length - 1];
        let ex = x(last.year), ey = y(last.v), ev = last.v;
        if (sr.guidance) {
          const gx = x(sr.guidance.year), ya = y(sr.guidance.high), yb = y(sr.guidance.low);
          f.g.appendChild(U.el('line', { x1: x(last.year), y1: y(last.v), x2: gx, y2: (ya + yb) / 2, stroke: col, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
          f.g.appendChild(U.el('path', { d: 'M' + (gx - 4) + ',' + ya + 'h8M' + gx + ',' + ya + 'V' + yb + 'M' + (gx - 4) + ',' + yb + 'h8', fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linecap': 'round' }));
          ex = gx; ey = (ya + yb) / 2; ev = (sr.guidance.low + sr.guidance.high) / 2;
        }
        ends.push({ sr, x: ex, y: ey, v: ev });
      });
      if (w >= 640) {
        ends.sort((a, b) => a.y - b.y);
        for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
        ends.forEach((e) => f.g.appendChild(U.el('text', { class: 'direct', x: f.iw + 12, y: e.y, dy: '0.32em', text: e.sr.label + ' ' + U.usd(e.v, 0) })));
      }
      // hover: nearest year
      const cross = U.el('line', { class: 'crosshair', y1: 0, y2: f.ih, visibility: 'hidden' }); f.g.appendChild(cross);
      const hit = U.el('rect', { x: 0, y: 0, width: f.iw, height: f.ih, fill: 'transparent', tabindex: 0, 'aria-label': 'Cost by year. Use arrow keys.' }); f.g.appendChild(hit);
      const allYears = d3.range(Math.ceil(x.domain()[0]), x.domain()[1] + 1); let idx = allYears.length - 1;
      const show = (i, px, py) => {
        idx = Math.max(0, Math.min(allYears.length - 1, i)); const yr = allYears[idx], X = x(yr);
        cross.setAttribute('x1', X); cross.setAttribute('x2', X); cross.setAttribute('visibility', 'visible');
        const rows = costSeries.map((sr) => { const p = sr.points.find((q) => q.year === yr); if (p) return [sr.label, U.usd(p.v), U.css(sr.c)]; if (sr.guidance && sr.guidance.year === yr) return [sr.label + ' (guidance)', U.usd(sr.guidance.low) + '–' + U.usd(sr.guidance.high), U.css(sr.c)]; return null; }).filter(Boolean);
        const b = chHost.getBoundingClientRect();
        U.tip.show(px != null ? px : b.left + mg.l + X, py != null ? py : b.top + mg.t + 20, U.tip.card(String(yr), 'USD per lb', rows));
      };
      const hide = () => { cross.setAttribute('visibility', 'hidden'); U.tip.hide(); };
      hit.addEventListener('pointermove', (e) => { const b = hit.getBoundingClientRect(); show(Math.round(x.invert(((e.clientX - b.left) / b.width) * f.iw)) - allYears[0], e.clientX, e.clientY); });
      hit.addEventListener('pointerleave', hide); hit.addEventListener('blur', hide);
      hit.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(idx + 1); else if (e.key === 'ArrowLeft') show(idx - 1); else return; e.preventDefault(); });
    }
    if (chHost && costSeries.length >= 2) {
      U.$('#costs-block').hidden = false;
      U.legend(U.$('#costs-legend'), costSeries.map((sr) => ({ t: sr.label, c: 'var(' + sr.c + ')', kind: 'line' })));
      U.responsive(chHost, costHistory);
      const yrsAll = Array.from(new Set(costSeries.flatMap((x) => x.points.map((p) => p.year)))).sort((a, b) => b - a);
      U.table(U.$('#costs-table'), [{ k: 'year', t: 'Year', l: true }].concat(costSeries.map((sr) => ({ k: sr.id, t: sr.label, f: (v) => (v == null ? '–' : U.n(v, 2)) }))),
        yrsAll.map((yr) => { const r = { year: yr }; costSeries.forEach((sr) => { const p = sr.points.find((q) => q.year === yr); r[sr.id] = p ? p.v : null; }); return r; }));
      const conv = costSeries.filter((sr) => sr.converted).map((sr) => sr.company);
      U.$('#costs-note').textContent = 'Each company defines cost its own way, so compare a line with its own past, not with the other company. ' + (conv.length ? Array.from(new Set(conv)).join(' and ') + ' reports in its home currency; figures are converted at the yearly average rate in its reports. ' : '') + 'Kazatomprom figures are the group average for its share of each joint venture and include mineral extraction tax; Cameco’s exclude royalties.' + costSeries.filter((sr) => sr.ytd).map((sr) => ' ' + sr.label + ' was ' + U.usd(sr.ytd.v) + ' in ' + String(sr.ytd.period || 'the year to date').replace(/^1H\s*/, 'the first half of ') + '.').join('');
    }

    stats(); countryBar(); tables();
    const askMines = U.responsive(mHost, minesChart);
    const pfig = pHost.closest('.fig');
    const pctl = U.el('div', { class: 'controls' });
    pfig.insertBefore(pctl, pfig.firstChild);
    let askProj = () => {};
    pctl.appendChild(U.seg('Size', [{ v: 'big', t: 'Over 1 Mlb a year' }, { v: 'all', t: 'All' }], projSt.size, (v) => { projSt.size = v; askProj(); }));
    pctl.appendChild(U.seg('Proposed mines', [{ v: false, t: 'Leave out' }, { v: true, t: 'Show' }], projSt.proposed, (v) => { projSt.proposed = v; askProj(); }));
    if (projects.length) askProj = U.responsive(pHost, projectsChart); else pHost.appendChild(U.el('p', { class: 'empty', text: 'No dated projects in the data.' }));
    U.on('units', () => { stats(); countryBar(); tables(); });

    const src = [{ t: 'Company reports and technical studies' }, { t: 'see Sources', url: '#sources' }];
    U.titleblock('tb-mines', { fig: '06', title: 'Largest uranium mines', unit: 'Mlb U₃O₈ or tU, 100% basis. Tick = capacity', sources: src });
    if (npHost && npRows.length > 3) U.titleblock('tb-nameplate', { title: 'Mine output as a share of nameplate capacity, ' + LY, unit: '% of licensed or built capacity', sources: src });
    U.titleblock('tb-projects', { fig: '07', title: 'Restarts and new mines by first year of production', unit: 'year; output in Mlb U₃O₈ or tU', sources: src });
    const tbCost = () => { if (chHost && costSeries.length >= 2) U.titleblock('tb-costs', { title: 'Unit cost of mining, as each producer reports it', unit: 'USD per lb U₃O₈, nominal', sources: [{ t: 'Kazatomprom annual reports and trading updates', url: 'https://www.kazatomprom.kz/en/investors/' }, { t: 'Cameco annual MD&A', url: 'https://www.cameco.com/invest/financial-information' }] }); };
    if (anyCost >= 8) U.titleblock('tb-cost', { title: 'Mine cost curve', unit: 'USD per lb U₃O₈ against Mlb U₃O₈ or tU per year', sources: [{ t: 'Company reports and technical studies' }, { t: 'see Sources', url: '#sources' }] });
    tbCost();
  }
})();
