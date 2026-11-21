/* FIG. 02 — supply and demand balance. Stacked columns: mine output by certainty. Line: reactor requirement.
   Everything is recomputed from the per-mine and per-reactor models when a control changes. */
(function () {
  'use strict';
  const U = window.U;
  U.balance = { init };

  function init() {
    const host = U.$('#balance-chart'); if (!host || !U.data.mines || !U.data.reactors) return;
    const M = U.model;
    const Y0 = Math.max(2015, d3.min(Object.keys(M.worldProd).map(Number)) || 2019), Y1 = M.horizon;
    const hasSec = !!(U.data.secondary_supply && U.data.secondary_supply.model && U.data.secondary_supply.model.length);
    const st = { slip: 0, kase: 'base', deliver: 1, proposed: false, secondary: hasSec, against: 'fleet' };

    const scen = scenarios();
    const BUCKETS = [
      { k: 'operating', t: 'Operating mines', c: '--supply' },
      { k: 'restart', t: 'Restarts', c: '--supply-2' },
      { k: 'development', t: 'New mines in development', c: '--supply-3' },
      { k: 'proposed', t: 'Proposed', c: '--supply-3', outline: true },
      { k: 'secondary', t: 'Secondary supply', c: '--neutral-mark' },
    ];

    /* controls */
    const ctl = U.$('#balance-controls');
    ctl.appendChild(U.seg('Mine output', [{ v: 'low', t: 'Low' }, { v: 'base', t: 'Base' }, { v: 'high', t: 'High' }], st.kase, (v) => { st.kase = v; update(); }));
    ctl.appendChild(U.seg('New mines arrive', [{ v: 0, t: 'On owners’ dates' }, { v: 1, t: '1 yr late' }, { v: 2, t: '2 yr late' }, { v: 3, t: '3 yr late' }], st.slip, (v) => { st.slip = v; update(); }));
    ctl.appendChild(U.seg('New mines deliver', [{ v: 1, t: 'All of plan' }, { v: 0.75, t: 'Three quarters' }, { v: 0.5, t: 'Half' }], st.deliver, (v) => { st.deliver = v; update(); }));
    ctl.appendChild(U.seg('Proposed mines', [{ v: false, t: 'Leave out' }, { v: true, t: 'Count' }], st.proposed, (v) => { st.proposed = v; update(); }));
    if (hasSec) ctl.appendChild(U.seg('Secondary supply', [{ v: true, t: 'Count' }, { v: false, t: 'Leave out' }], st.secondary, (v) => { st.secondary = v; update(); }));
    const againstOpts = [{ v: 'fleet', t: 'Reactor model' }].concat(scen.map((s) => ({ v: s.id, t: s.short })));
    if (againstOpts.length > 1) ctl.appendChild(U.seg('Measure the gap against', againstOpts, st.against, (v) => { st.against = v; update(); }));

    let rows = [];
    function compute() {
      rows = [];
      for (let y = Y0; y <= Y1; y++) {
        const s = M.supply(y, { slip: st.slip, case: st.kase, proposed: st.proposed, deliver: st.deliver });
        const sec = st.secondary ? M.secondary(y) : 0;
        const d = M.demand(y, {});
        const row = { y, actual: s.actual, operating: s.operating + s.other, restart: s.restart, development: s.development, proposed: st.proposed ? s.proposed : 0, secondary: sec, fleet: d.tu };
        row.supply = row.operating + row.restart + row.development + row.proposed + row.secondary;
        scen.forEach((sc) => { row[sc.id] = sc.at(y); });
        row.need = row[st.against] != null ? row[st.against] : row.fleet;
        row.gap = row.supply - row.need;
        rows.push(row);
      }
    }

    function scenarios() {
      const o = U.data.outlook, out = [];
      const list = (o && o.demand_scenarios) || [];
      list.filter((s) => s.show).forEach((s) => {
        const pts = s.points.filter((p) => p.tu != null).sort((a, b) => a.year - b.year);
        if (pts.length < 2) return;
        out.push({ id: s.id, short: s.short || s.scenario, name: s.name, pts, role: s.role,
          at: (y) => { if (y < pts[0].year || y > pts[pts.length - 1].year) return null; for (let i = 1; i < pts.length; i++) if (y <= pts[i].year) { const a = pts[i - 1], b = pts[i]; return a.tu + ((b.tu - a.tu) * (y - a.year)) / (b.year - a.year); } return null; } });
      });
      return out;
    }

    function stats() {
      const at = (y) => rows.find((r) => r.y === y);
      const fmtGap = (r) => (r ? U.signed(U.fmtU(Math.abs(r.gap)), r.gap) : '–');
      const future = rows.filter((r) => r.y >= M.nowYear);
      const firstShort = future.find((r) => r.gap < 0);
      const cum = d3.sum(future, (r) => r.gap);
      const a = at(2030), b = at(2035);
      U.stats(U.$('#balance-stats'), [
        { v: fmtGap(a), u: U.unitShort(), l: 'Balance in 2030', d: a ? (a.gap < 0 ? 'Supply short of need' : 'Supply above need') : '', dir: a && a.gap < 0 ? 'down' : 'up' },
        { v: fmtGap(b), u: U.unitShort(), l: 'Balance in 2035', d: b ? (b.gap < 0 ? 'Supply short of need' : 'Supply above need') : '', dir: b && b.gap < 0 ? 'down' : 'up' },
        { v: firstShort ? String(firstShort.y) : 'None', l: 'First year supply falls short', d: 'From ' + M.nowYear + ' to ' + Y1 },
        { v: U.signed(U.fmtU(Math.abs(cum)), cum), u: U.unitShort(), l: 'Cumulative balance, ' + M.nowYear + '–' + Y1, d: cum < 0 ? 'Would have to come from inventories or new supply' : 'Surplus over the period', dir: cum < 0 ? 'down' : 'up' },
      ]);
    }

    function legend() {
      const items = BUCKETS.filter((b) => (b.k !== 'proposed' || st.proposed) && (b.k !== 'secondary' || st.secondary)).map((b) => ({ t: b.t, c: 'var(' + b.c + ')', kind: b.outline ? 'ring' : null }));
      items.push({ t: 'Reactor requirement (this model)', c: 'var(--demand)', kind: 'line' });
      const band = scen.filter((s) => s.role === 'low' || s.role === 'high');
      if (band.length === 2) items.push({ t: 'Published range: ' + (band[0].name || 'scenarios'), c: 'var(--demand)', kind: 'band' });
      scen.filter((s) => s.role === 'ref').forEach((s) => items.push({ t: s.name, c: 'var(--demand)', kind: 'dash' }));
      const Wl = U.data.outlook && U.data.outlook.wna_2040;
      if (Wl && Wl.reference) items.push({ t: Wl.name + ': low, reference and high for ' + Wl.year, c: 'var(--demand)', kind: 'ring' });
      U.legend(U.$('#balance-legend'), items);
    }

    function render(w) {
      const h = w < 640 ? 340 : 460;
      const m = { t: 34, r: w < 640 ? 14 : 92, b: 30, l: 46 };
      const f = U.frame(host, w, h, m);
      f.svg.setAttribute('aria-label', 'Uranium supply by source against reactor requirements, ' + Y0 + ' to ' + Y1);
      const x = d3.scaleBand().domain(rows.map((r) => r.y)).range([0, f.iw]).paddingInner(0.28).paddingOuter(0.1);
      const bw = Math.min(24, x.bandwidth()), off = (x.bandwidth() - bw) / 2;
      const W0 = U.data.outlook && U.data.outlook.wna_2040;
      // the scale reaches the WNA reference figure; its upper case runs off the top and is marked with an arrow
      const maxTu = Math.max(d3.max(rows, (r) => Math.max(r.supply, r.fleet, d3.max(scen, (s) => r[s.id] || 0) || 0)), W0 && W0.reference ? W0.reference * 1.03 : 0);
      const y = d3.scaleLinear().domain([0, U.toUnit(maxTu) * 1.06]).nice(5).range([f.ih, 0]);
      const Yt = (tu) => y(U.toUnit(tu));
      U.yGrid(f, y, y.ticks(5), U.axisNum);
      f.g.appendChild(U.el('text', { class: 'ax-label', x: -m.l + 2, y: -20, text: U.unitName() + ' per year' }));

      // x labels
      const xg = U.el('g', { class: 'ax' });
      const every = w < 520 ? 5 : w < 900 ? 5 : 5;
      rows.forEach((r) => { if (r.y % every === 0) xg.appendChild(U.el('text', { x: x(r.y) + x.bandwidth() / 2, y: f.ih + 18, 'text-anchor': 'middle', text: String(r.y) })); });
      f.g.appendChild(xg);

      // published scenario band + reference
      const lo = scen.find((s) => s.role === 'low'), hi = scen.find((s) => s.role === 'high');
      const cx = (r) => x(r.y) + x.bandwidth() / 2;
      if (lo && hi) {
        const pts = rows.filter((r) => r[lo.id] != null && r[hi.id] != null);
        if (pts.length > 1) f.g.appendChild(U.el('path', { d: d3.area().x(cx).y0((r) => Yt(r[lo.id])).y1((r) => Yt(r[hi.id]))(pts), fill: 'var(--demand)', 'fill-opacity': 0.1 }));
      }

      // markers at the years the band's publisher actually gives
      [lo, hi].forEach((sc) => { if (!sc) return; sc.pts.forEach((p) => { if (p.year < Y0 || p.year > Y1) return; f.g.appendChild(U.el('circle', { cx: x(p.year) + x.bandwidth() / 2, cy: Yt(p.tu), r: 2.5, fill: 'var(--demand)', 'fill-opacity': 0.55 })); }); });

      // columns
      const gap = 2;
      rows.forEach((r) => {
        let acc = 0;
        BUCKETS.forEach((b) => {
          const v = r[b.k]; if (!v) return;
          const y0 = Yt(acc), y1 = Yt(acc + v); acc += v;
          const hh = y0 - y1 - (acc > v ? gap : 0);
          if (hh < 0.6) return;
          const rect = U.el('rect', { x: x(r.y) + off, y: y1, width: bw, height: hh, fill: b.outline ? 'none' : 'var(' + b.c + ')', opacity: r.actual || b.outline ? 1 : 0.86 });
          if (b.outline) { rect.setAttribute('stroke', 'var(' + b.c + ')'); rect.setAttribute('stroke-width', 1.2); rect.setAttribute('x', x(r.y) + off + 0.6); rect.setAttribute('width', bw - 1.2); }
          f.g.appendChild(rect);
        });
      });

      // "modelled from here" divider
      const firstModel = rows.find((r) => !r.actual);
      if (firstModel) {
        const dx = Math.round(x(firstModel.y) - (x.step() - x.bandwidth()) / 2) + 0.5;
        f.g.appendChild(U.el('line', { x1: dx, x2: dx, y1: -14, y2: f.ih, stroke: 'var(--ink-3)', 'stroke-width': 1 }));
        if (w >= 520 && dx > 150) {
          f.g.appendChild(U.el('text', { class: 'ax-label', x: dx - 6, y: -6, 'text-anchor': 'end', text: 'Reported' }));
          f.g.appendChild(U.el('text', { class: 'ax-label', x: dx + 6, y: -6, text: 'Modelled' }));
        }
      }

      // reference scenario lines
      scen.filter((s) => s.role === 'ref').forEach((s) => {
        const pts = rows.filter((r) => r[s.id] != null);
        if (pts.length > 1) f.g.appendChild(U.el('path', { d: d3.line().x(cx).y((r) => Yt(r[s.id]))(pts), fill: 'none', stroke: 'var(--demand)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
      });
      // World Nuclear Association scenarios for one year: a range mark, not a line (nothing in between is published)
      const W = U.data.outlook && U.data.outlook.wna_2040;
      if (W && W.reference && W.year >= Y0 && W.year <= Y1) {
        const wx = x(W.year) + x.bandwidth() / 2 + Math.min(14, x.step() * 0.45);
        const topTu = (y.domain()[1] / U.toUnit(1)), clipped = W.upper && W.upper > topTu;
        const yTop = W.upper ? (clipped ? 2 : Yt(W.upper)) : Yt(W.reference);
        if (W.lower && W.upper) f.g.appendChild(U.el('line', { x1: wx, x2: wx, y1: Yt(W.lower), y2: yTop, stroke: 'var(--demand)', 'stroke-width': 1.5 }));
        if (W.lower) f.g.appendChild(U.el('line', { x1: wx - 4, x2: wx + 4, y1: Yt(W.lower), y2: Yt(W.lower), stroke: 'var(--demand)', 'stroke-width': 1.5 }));
        if (W.upper && !clipped) f.g.appendChild(U.el('line', { x1: wx - 4, x2: wx + 4, y1: yTop, y2: yTop, stroke: 'var(--demand)', 'stroke-width': 1.5 }));
        if (clipped) f.g.appendChild(U.el('path', { d: 'M' + (wx - 4.5) + ',8 L' + wx + ',0 L' + (wx + 4.5) + ',8', fill: 'none', stroke: 'var(--demand)', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
        f.g.appendChild(U.el('rect', { x: wx - 4, y: Yt(W.reference) - 4, width: 8, height: 8, fill: 'var(--paper)', stroke: 'var(--demand)', 'stroke-width': 1.5, transform: 'rotate(45 ' + wx + ' ' + Yt(W.reference) + ')' }));
        if (w >= 640) {
          f.g.appendChild(U.el('text', { class: 'direct direct--muted', x: f.iw + 10, y: Yt(W.reference), dy: '0.32em', text: 'WNA ref. ' + U.fmtU(W.reference) }));
          if (W.upper) f.g.appendChild(U.el('text', { class: 'direct direct--muted', x: f.iw + 10, y: clipped ? 4 : yTop, dy: '0.32em', text: (clipped ? 'high ' : 'WNA high ') + U.fmtU(W.upper) }));
        }
      }
      // fleet requirement
      f.g.appendChild(U.el('path', { d: d3.line().x(cx).y((r) => Yt(r.fleet))(rows), fill: 'none', stroke: 'var(--paper)', 'stroke-width': 5, 'stroke-linejoin': 'round' }));
      f.g.appendChild(U.el('path', { d: d3.line().x(cx).y((r) => Yt(r.fleet))(rows), fill: 'none', stroke: 'var(--demand)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      const lastR = rows[rows.length - 1];
      f.g.appendChild(U.el('circle', { cx: cx(lastR), cy: Yt(lastR.fleet), r: 4, fill: 'var(--demand)', stroke: 'var(--paper)', 'stroke-width': 2 }));
      if (w >= 640) {
        const labels = [{ y: Yt(lastR.fleet), t: 'Need ' + U.fmtU(lastR.fleet), cls: 'direct' }, { y: Yt(lastR.supply), t: 'Supply ' + U.fmtU(lastR.supply), cls: 'direct direct--muted' }];
        if (Math.abs(labels[0].y - labels[1].y) < 15) { const mid = (labels[0].y + labels[1].y) / 2, up = labels[0].y <= labels[1].y; labels[0].y = mid + (up ? -8 : 8); labels[1].y = mid + (up ? 8 : -8); }
        labels.forEach((l) => f.g.appendChild(U.el('text', { class: l.cls, x: f.iw + 10, y: l.y, dy: '0.32em', text: l.t })));
      }

      // hover layer
      const cross = U.el('line', { class: 'crosshair', y1: 0, y2: f.ih, visibility: 'hidden' });
      f.g.appendChild(cross);
      const hit = U.el('rect', { x: 0, y: 0, width: f.iw, height: f.ih, fill: 'transparent', tabindex: 0, 'aria-label': 'Balance by year. Use arrow keys.' });
      f.g.appendChild(hit);
      let idx = -1;
      const show = (i, px, py) => {
        idx = Math.max(0, Math.min(rows.length - 1, i));
        const r = rows[idx], X = cx(r);
        cross.setAttribute('x1', X); cross.setAttribute('x2', X); cross.setAttribute('visibility', 'visible');
        const box = host.getBoundingClientRect();
        const list = BUCKETS.filter((b) => r[b.k]).reverse().map((b) => [b.t, U.fmtUu(r[b.k]), U.css(b.c)]);
        list.push(['Supply', U.fmtUu(r.supply)]);
        list.push(['Reactors need', U.fmtUu(r.need), U.css('--demand')]);
        const blo = scen.find((sc) => sc.role === 'low'), bhi = scen.find((sc) => sc.role === 'high');
        if (blo && bhi && r[blo.id] != null && r[bhi.id] != null) list.push(['Red Book range', U.fmtU(r[blo.id]) + '–' + U.fmtU(r[bhi.id])]);
        const Wt = U.data.outlook && U.data.outlook.wna_2040;
        if (Wt && Wt.year === r.y && Wt.lower && Wt.upper) list.push(['WNA range', U.fmtU(Wt.lower) + '–' + U.fmtU(Wt.upper)]);
        list.push([r.gap < 0 ? 'Short by' : 'Surplus', U.fmtUu(Math.abs(r.gap))]);
        U.tip.show(px != null ? px : box.left + m.l + X, py != null ? py : box.top + m.t + 20, U.tip.card(String(r.y), r.actual ? 'Reported' : 'Modelled', list));
      };
      const iAt = (e) => { const b = hit.getBoundingClientRect(); const px = ((e.clientX - b.left) / b.width) * f.iw; return Math.round((px - x.bandwidth() / 2 - x(rows[0].y)) / x.step()); };
      hit.addEventListener('pointermove', (e) => show(iAt(e), e.clientX, e.clientY));
      hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); U.tip.hide(); });
      hit.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(idx + 1); else if (e.key === 'ArrowLeft') show(idx - 1); else return; e.preventDefault(); });
      hit.addEventListener('blur', () => { cross.setAttribute('visibility', 'hidden'); U.tip.hide(); });
    }

    function table() {
      const cols = [{ k: 'y', t: 'Year', l: true }].concat(BUCKETS.map((b) => ({ k: b.k, t: b.t, f: (v) => U.fmtU(v || 0) })), [
        { k: 'supply', t: 'Supply', f: (v) => U.fmtU(v) }, { k: 'need', t: 'Need', f: (v) => U.fmtU(v) }, { k: 'gap', t: 'Balance', f: (v) => U.signed(U.fmtU(Math.abs(v)), v) }]);
      U.table(U.$('#balance-table'), cols, rows);
    }

    // one plain caution under the figure; it states how the base case is built, not what will happen
    const LYb = M.lastActualYear, capMines = (U.data.mines || []).filter((m) => m.capacity_tu > 0 && (m.production_tu || {})[LYb] > 0);
    const capSum = d3.sum(capMines, (m) => m.capacity_tu), outSum = d3.sum(capMines, (m) => m.production_tu[LYb]);
    const utilNote = capSum > 0 ? 'In ' + LYb + ' the mines already producing made ' + U.pct(outSum / capSum) + ' of their nameplate. ' : '';
    const figEl = host.closest('.fig');
    if (figEl) figEl.insertBefore(U.el('p', { class: 'note', text: 'The base case takes every restart and new mine at its owner’s date and planned output, and counts only reactors that are running, being built or planned at a named site. ' + utilNote + 'Use the controls to test a slip, a shortfall or a different demand outlook.' }), U.$('.fig__tools', figEl));

    let ask = null;
    function update() { compute(); stats(); legend(); table(); if (ask) ask(); }
    compute(); stats(); legend(); table();
    ask = U.responsive(host, render);
    U.on('units', () => { stats(); table(); });

    U.titleblock('tb-balance', {
      fig: '02', title: 'Supply against reactor need, ' + Y0 + '–' + Y1, unit: 'Mlb U₃O₈ or tU per year',
      sources: [{ t: 'Mine and reactor models (this site)', url: '#sources' }].concat(scen.length ? [{ t: 'Red Book 2024 (NEA and IAEA, CC BY 4.0)', url: scen[0].source || 'https://www.oecd-nea.org/' }] : [], (U.data.outlook && U.data.outlook.wna_2040) ? [{ t: 'WNA Fuel Report 2025', url: U.data.outlook.wna_2040.source }] : []),
    });
  }
})();
