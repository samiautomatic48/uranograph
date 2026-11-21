/* Market structure, under the price chart: pounds held by listed physical funds, the trust's premium or discount
   to net asset value, and (when the data is present) how much uranium US utilities still have to buy. */
(function () {
  'use strict';
  const U = window.U;
  U.market = { init };
  const day = (d) => { const p = String(d).split('-').map(Number); return new Date(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 15)); };

  function init() {
    const host = U.$('#market-extra'); if (!host) return;
    services();
    const F = U.data.funds;
    if (F && F.sput && F.sput.holdings && F.sput.holdings.length > 1) funds(host, F);
    const O = U.data.outlook, sec = U.$('#buyers'), bh = U.$('#buyers-extra');
    if (!O || !sec || !bh) return;
    if (O.us_uncovered && O.us_uncovered.points && O.us_uncovered.points.length > 1) uncovered(bh, O.us_uncovered);
    const C = U.data.contracting;
    if (C && ((C.us && C.us.points.length > 2) || (C.eu && C.eu.points.length > 2))) contracting(bh, C);
    if (O.us_inventories && O.us_inventories.points && O.us_inventories.points.length > 2) inventories(bh, O.us_inventories, O.eu_inventories);
    if (O.us_origins && O.us_origins.rows && O.us_origins.rows.length > 2) origins(bh, O.us_origins);
    if (bh.children.length) sec.hidden = false; else { const a = U.$('.nav a[href="#buyers"]'); if (a) a.remove(); }
  }

  /* ----- newly contracted each year against uranium loaded into reactors ----- */
  function contracting(host, C) {
    // a region gets a panel only if it still publishes the tonnage of new contracts (the EU stopped after 2008)
    const latest = d3.max([C.us, C.eu].flatMap((D) => (D && D.points ? D.points.map((p) => p.year) : [])));
    const sets = [['us', 'United States', C.us], ['eu', 'European Union', C.eu]].filter((x) => x[2] && x[2].points && x[2].points.filter((p) => p.new_tu != null && p.year >= latest - 2).length > 0);
    if (!sets.length) return;
    sets.forEach((x) => { x[2] = { ...x[2], points: x[2].points.filter((p) => p.new_tu != null || p.loaded_tu != null) }; });
    const fig = block(host, 'What they sign each year', 'Uranium US reactor operators newly contracted each year, against the uranium they loaded. Signing less than is loaded means running down earlier contracts and stock.');
    fig.appendChild(U.el('div', { class: 'legend', id: 'con-legend' }));
    const grid = U.el('div', { style: { display: 'grid', gap: '32px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' } });
    fig.appendChild(grid);
    const note = U.el('p', { class: 'note' }); fig.appendChild(note);
    fig.appendChild(U.el('div', { class: 'fig__tools' }, U.el('button', { class: 'btn', type: 'button', 'data-table': 'con-table', 'aria-expanded': 'false', text: 'Show table' })));
    fig.appendChild(U.el('div', { class: 'tableview', id: 'con-table', hidden: true }));
    fig.appendChild(U.el('div', { class: 'titleblock', id: 'tb-con' }));
    const hasSplit = sets.some((x) => x[2].points.some((p) => p.firm_tu != null && p.new_tu > p.firm_tu));
    U.legend(U.$('#con-legend'), (hasSplit ? [{ t: 'Newly contracted, firm minimum', c: 'var(--demand)' }, { t: 'Extra the buyer may take, up to the maximum', c: 'var(--demand-2)' }] : [{ t: 'Newly contracted', c: 'var(--demand)' }]).concat([{ t: 'Loaded into reactors', c: 'var(--ink)', kind: 'line' }]));
    const all = sets.flatMap((x) => x[2].points);
    const maxTu = d3.max(all, (p) => Math.max(p.new_tu || 0, p.loaded_tu || 0));
    const y0 = d3.min(all, (p) => p.year), y1 = d3.max(all, (p) => p.year), years = d3.range(y0, y1 + 1);
    sets.forEach(([key, label, D]) => {
      const body = U.el('div', { class: 'fig__body', id: 'con-chart-' + key });
      grid.appendChild(U.el('div', null, U.el('div', { class: 'label', style: { marginBottom: '6px' }, text: label }), body));
      const pts = D.points;
      U.responsive(body, (w) => {
        const h = w < 520 ? 260 : 320, m = { t: 30, r: 10, b: 26, l: 46 };
        const f = U.frame(body, w, h, m);
        f.svg.setAttribute('aria-label', label + ': uranium newly contracted each year against uranium loaded into reactors');
        const x = d3.scaleBand().domain(years).range([0, f.iw]).padding(0.28);
        const bw = Math.min(24, x.bandwidth()), off = (x.bandwidth() - bw) / 2;
        const y = d3.scaleLinear().domain([0, U.toUnit(maxTu) * 1.08]).nice(4).range([f.ih, 0]);
        const Yv = (tu) => y(U.toUnit(tu));
        U.yGrid(f, y, y.ticks(4), U.axisNum);
        f.g.appendChild(U.el('text', { class: 'ax-label', x: -m.l + 2, y: -16, text: U.unitName() + ' per year' }));
        const every = w < 420 ? 5 : w < 620 ? 3 : 2;
        years.forEach((yr) => { if ((yr - y1) % every === 0) f.g.appendChild(U.el('text', { class: 'ax-label', x: x(yr) + x.bandwidth() / 2, y: f.ih + 18, 'text-anchor': 'middle', text: String(yr) })); });
        pts.forEach((p) => {
          if (p.new_tu == null) return;
          const split = p.firm_tu != null && p.new_tu > p.firm_tu, lt = split ? p.firm_tu : p.new_tu, sp = split ? p.new_tu - p.firm_tu : 0;
          f.g.appendChild(U.el('rect', { x: x(p.year) + off, y: Yv(lt), width: bw, height: Math.max(0, Yv(0) - Yv(lt)), fill: 'var(--demand)' }));
          if (sp) f.g.appendChild(U.el('rect', { x: x(p.year) + off, y: Yv(lt + sp), width: bw, height: Math.max(0, Yv(lt) - Yv(lt + sp) - 2), fill: 'var(--demand-2)' }));
        });
        const lp = pts.filter((p) => p.loaded_tu != null), cx = (p) => x(p.year) + x.bandwidth() / 2;
        if (lp.length > 1) {
          f.g.appendChild(U.el('path', { d: d3.line().x(cx).y((p) => Yv(p.loaded_tu))(lp), fill: 'none', stroke: 'var(--paper)', 'stroke-width': 5, 'stroke-linejoin': 'round' }));
          f.g.appendChild(U.el('path', { d: d3.line().x(cx).y((p) => Yv(p.loaded_tu))(lp), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
          const last = lp[lp.length - 1];
          f.g.appendChild(U.el('circle', { cx: cx(last), cy: Yv(last.loaded_tu), r: 4, fill: 'var(--ink)', stroke: 'var(--paper)', 'stroke-width': 2 }));
        }
        pts.forEach((p) => {
          const hit = U.el('rect', { x: x(p.year), y: 0, width: x.bandwidth(), height: f.ih, fill: 'transparent' });
          hit.addEventListener('pointermove', (e) => U.tip.show(e.clientX, e.clientY, U.tip.card(label + ', ' + p.year, null, [
            p.new_tu != null ? ['Newly contracted, maximum', U.fmtUu(p.new_tu), U.css('--demand')] : null,
            p.firm_tu != null ? ['Firm minimum', U.fmtUu(p.firm_tu)] : null,
            p.loaded_tu != null ? ['Loaded into reactors' + (p.prelim ? ' (preliminary)' : ''), U.fmtUu(p.loaded_tu), U.css('--ink')] : null,
            p.new_tu != null && p.loaded_tu ? ['Signed as a share of loaded', (p.firm_tu != null && p.firm_tu < p.new_tu ? U.pct(p.firm_tu / p.loaded_tu) + ' to ' : '') + U.pct(p.new_tu / p.loaded_tu)] : null])));
          hit.addEventListener('pointerleave', () => U.tip.hide());
          f.g.appendChild(hit);
        });
      });
    });
    const describe = () => {
      U.clear(note);
      const text = sets.map(([, label, D]) => {
        const both = D.points.filter((p) => p.new_tu != null && p.loaded_tu);
        if (!both.length) return '';
        const L = both[both.length - 1], five = both.slice(-5);
        return label + ', ' + L.year + ': up to ' + U.fmtUu(L.new_tu) + ' signed against ' + U.fmtUu(L.loaded_tu) + ' loaded, ' + U.pct(L.new_tu / L.loaded_tu) + '. Over the last ' + five.length + ' years, ' + U.pct(d3.sum(five, (p) => p.new_tu) / d3.sum(five, (p) => p.loaded_tu)) + '.';
      }).filter(Boolean).join(' ');
      note.appendChild(document.createTextNode(text + ' Contracts signed in one year deliver over the following decade, so this is a pace check and not a balance. '));
      if (!sets.find((x) => x[0] === 'eu')) note.appendChild(document.createTextNode('The EU’s supply agency stopped publishing the tonnage of new contracts after 2008, so there is no comparable EU series. '));
      const W = C.world;
      if (W && W.contracted_mlb && W.consumed_mlb) {
        note.appendChild(document.createTextNode('Worldwide, ' + U.n(W.contracted_mlb) + ' Mlb went under long-term contract in ' + (W.period || 'the last five years') + ' against ' + U.n(W.consumed_mlb) + ' Mlb used in reactors, ' + U.pct(W.contracted_mlb / W.consumed_mlb) + ' (' + (W.attributed_to || 'industry estimate') + ', '));
        note.appendChild(W.src ? U.el('a', { href: W.src, target: '_blank', rel: 'noopener noreferrer', text: 'annual report' }) : document.createTextNode('annual report'));
        note.appendChild(document.createTextNode(').'));
      }
      const rows = years.slice().reverse().map((yr) => { const r = { year: yr }; sets.forEach(([key, , D]) => { const p = D.points.find((q) => q.year === yr) || {}; r[key + '_new'] = p.new_tu; r[key + '_loaded'] = p.loaded_tu; }); return r; });
      U.table(U.$('#con-table'), [{ k: 'year', t: 'Year', l: true }].concat(sets.flatMap(([key, label]) => [{ k: key + '_new', t: label + ', signed', f: (v) => (v == null ? '–' : U.fmtU(v)) }, { k: key + '_loaded', t: label + ', loaded', f: (v) => (v == null ? '–' : U.fmtU(v)) }])), rows);
    };
    describe(); U.on('units', describe);
    U.titleblock('tb-con', { title: 'Uranium newly contracted against uranium loaded into reactors', unit: 'Mlb U₃O₈ or tU per year', asof: String(y1), sources: sets.map(([, , D]) => ({ t: D.source_name, url: D.source })) });
  }

  /* ----- inventories: United States (utilities and suppliers) and EU utilities, same scale ----- */
  function inventories(host, D, EU) {
    const hasEU = !!(EU && EU.points && EU.points.length > 2);
    const fig = block(host, 'Uranium on the shelf', 'Year-end inventories. Utilities hold fuel for their own reactors. Suppliers are traders, converters, enrichers and producers.' + (hasEU ? ' EU figures cover utilities only and include the United Kingdom until 2020.' : ''));
    fig.appendChild(U.el('div', { class: 'legend', id: 'inv-legend' }));
    const grid = U.el('div', { style: { display: 'grid', gap: '32px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' } });
    const usBody = U.el('div', { class: 'fig__body', id: 'inv-chart' }), euBody = U.el('div', { class: 'fig__body', id: 'inv-chart-eu' });
    grid.appendChild(U.el('div', null, U.el('div', { class: 'label', style: { marginBottom: '6px' }, text: 'United States' }), usBody));
    if (hasEU) grid.appendChild(U.el('div', null, U.el('div', { class: 'label', style: { marginBottom: '6px' }, text: 'European Union, utilities' }), euBody));
    fig.appendChild(grid);
    fig.appendChild(U.el('div', { class: 'titleblock', id: 'tb-inv' }));
    const us = D.points.map((p) => ({ year: p.year, a: p.utilities_tu, b: p.suppliers_tu || 0 }));
    const eu = hasEU ? EU.points.map((p) => ({ year: p.year, a: p.tu, b: 0 })) : [];
    const years = us.map((p) => p.year);
    const maxTu = d3.max(us.concat(eu), (p) => p.a + p.b);
    U.legend(U.$('#inv-legend'), [{ t: 'Utilities', c: 'var(--demand)' }, { t: 'Suppliers (United States only)', c: 'var(--supply)' }]);
    const panel = (body, pts, label) => (w) => {
      const h = w < 520 ? 260 : 320, m = { t: 30, r: 10, b: 26, l: 46 };
      const f = U.frame(body, w, h, m);
      f.svg.setAttribute('aria-label', label + ' uranium inventories at year end');
      const x = d3.scaleBand().domain(years).range([0, f.iw]).padding(0.28);
      const bw = Math.min(24, x.bandwidth()), off = (x.bandwidth() - bw) / 2;
      const y = d3.scaleLinear().domain([0, U.toUnit(maxTu) * 1.08]).nice(4).range([f.ih, 0]);
      const Yv = (tu) => y(U.toUnit(tu));
      U.yGrid(f, y, y.ticks(4), U.axisNum);
      f.g.appendChild(U.el('text', { class: 'ax-label', x: -m.l + 2, y: -16, text: U.unitName() + ', year end' }));
      const every = w < 420 ? 6 : w < 620 ? 4 : 2, lastY = years[years.length - 1];
      years.forEach((yr) => { if ((yr - lastY) % every === 0) f.g.appendChild(U.el('text', { class: 'ax-label', x: x(yr) + x.bandwidth() / 2, y: f.ih + 18, 'text-anchor': 'middle', text: String(yr) })); });
      pts.forEach((p) => {
        if (x(p.year) == null) return;
        f.g.appendChild(U.el('rect', { x: x(p.year) + off, y: Yv(p.a), width: bw, height: Math.max(0, Yv(0) - Yv(p.a)), fill: 'var(--demand)' }));
        if (p.b) f.g.appendChild(U.el('rect', { x: x(p.year) + off, y: Yv(p.a + p.b), width: bw, height: Math.max(0, Yv(p.a) - Yv(p.a + p.b) - 2), fill: 'var(--supply)' }));
        const hit = U.el('rect', { x: x(p.year), y: 0, width: x.bandwidth(), height: f.ih, fill: 'transparent' });
        hit.addEventListener('pointermove', (e) => U.tip.show(e.clientX, e.clientY, U.tip.card(label + ', end of ' + p.year, null, [p.b ? ['Suppliers', U.fmtUu(p.b), U.css('--supply')] : null, ['Utilities', U.fmtUu(p.a), U.css('--demand')], p.b ? ['Together', U.fmtUu(p.a + p.b)] : null])));
        hit.addEventListener('pointerleave', () => U.tip.hide());
        f.g.appendChild(hit);
      });
    };
    U.responsive(usBody, panel(usBody, us, 'United States'));
    if (hasEU) U.responsive(euBody, panel(euBody, eu, 'European Union utilities'));
    const srcs = [{ t: D.source_name || 'EIA', url: D.source }];
    if (hasEU) srcs.push({ t: EU.source_name || 'Euratom Supply Agency', url: EU.source || 'https://euratom-supply.ec.europa.eu/publications/esa-annual-reports_en' });
    U.titleblock('tb-inv', { title: 'Commercial uranium inventories, United States' + (hasEU ? ' and European Union' : ''), unit: 'Mlb U₃O₈ or tU at year end', asof: String(us[us.length - 1].year), sources: srcs });
  }

  /* ----- where US reactors' uranium came from ----- */
  function origins(host, D) {
    const fig = block(host, 'Where US reactors bought their uranium', 'Deliveries to US reactor operators by the country where the uranium was mined. Some rows are withheld by the statistics agency in some years.');
    const ctl = U.el('div', { class: 'controls' }); fig.appendChild(ctl);
    const body = U.el('div', { class: 'fig__body', id: 'org-chart' }); fig.appendChild(body);
    fig.appendChild(U.el('div', { class: 'titleblock', id: 'tb-org' }));
    const st = { i: D.years.length - 1 };
    const ask = U.responsive(body, (w) => {
      const rows = D.rows.map((r) => ({ origin: r.origin, v: r.tu[st.i], prev: st.i > 0 ? r.tu[st.i - 1] : null })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
      const total = d3.sum(D.rows, (r) => r.tu[st.i] || 0);
      const narrow = w < 560, labelW = narrow ? 104 : 150, rowH = 30, m = { t: 22, r: 96, b: 6, l: labelW };
      const f = U.frame(body, w, rows.length * rowH + m.t + m.b, m);
      f.svg.setAttribute('aria-label', 'Origin of uranium delivered to US reactor operators in ' + D.years[st.i]);
      const x = d3.scaleLinear().domain([0, U.toUnit(d3.max(rows, (r) => r.v) || 1)]).nice(4).range([0, f.iw]);
      x.ticks(4).forEach((t) => { const px = Math.round(x(t)) + 0.5; f.g.appendChild(U.el('line', { class: t === 0 ? 'baseline' : 'gridline', x1: px, x2: px, y1: -4, y2: rows.length * rowH })); f.g.appendChild(U.el('text', { class: 'ax-label', x: px, y: -10, 'text-anchor': 'middle', text: U.axisNum(t) })); });
      rows.forEach((r, i) => {
        const y = i * rowH + (rowH - 14) / 2, bw = Math.max(1, x(U.toUnit(r.v))), rr = Math.min(4, bw, 7);
        f.g.appendChild(U.el('text', { class: 'direct', x: -10, y: y + 7, dy: '0.32em', 'text-anchor': 'end', text: r.origin }));
        f.g.appendChild(U.el('path', { d: 'M0,' + y + 'h' + (bw - rr) + 'a' + rr + ',' + rr + ' 0 0 1 ' + rr + ',' + rr + 'v' + (14 - 2 * rr) + 'a' + rr + ',' + rr + ' 0 0 1 ' + -rr + ',' + rr + 'h' + -(bw - rr) + 'z', fill: 'var(--supply)' }));
        f.g.appendChild(U.el('text', { class: 'direct direct--muted num', x: bw + 8, y: y + 7, dy: '0.32em', text: U.fmtU(r.v) + (total ? ' · ' + U.pct(r.v / total) : '') }));
        const hit = U.el('rect', { x: -labelW, y: i * rowH, width: w, height: rowH, fill: 'transparent' });
        hit.addEventListener('pointermove', (e) => U.tip.show(e.clientX, e.clientY, U.tip.card(r.origin, String(D.years[st.i]), [['Delivered', U.fmtUu(r.v), U.css('--supply')], total ? ['Share of reported total', U.pct(r.v / total, 1)] : null, r.prev != null ? ['Year before', U.fmtUu(r.prev)] : null])));
        hit.addEventListener('pointerleave', () => U.tip.hide());
        f.g.appendChild(hit);
      });
    });
    ctl.appendChild(U.seg('Year', D.years.map((y, i) => ({ v: i, t: String(y) })), st.i, (v) => { st.i = v; ask(); }));
    U.titleblock('tb-org', { title: 'Origin of uranium delivered to US reactor operators', unit: 'Mlb U₃O₈ or tU per year; share of the reported total', asof: String(D.years[D.years.length - 1]), sources: [{ t: D.source_name || 'EIA', url: D.source }] });
  }

  /* ----- conversion and enrichment: each step's latest figure against its low ----- */
  function services() {
    const P = U.data.prices, FC = P && P.fuel_cycle, blockEl = U.$('#services-block'), host = U.$('#services-chart');
    if (!FC || !FC.steps || FC.steps.length < 2 || !blockEl || !host) return;
    const steps = FC.steps.map((x) => ({ ...x, mult: x.to.v / x.from.v }));
    const when = (d) => U.month(String(d).slice(0, 7));
    blockEl.hidden = false;
    U.responsive(host, (w) => {
      const narrow = w < 720, labelW = narrow ? 0 : 150, rowH = narrow ? 86 : 62, bh = 14;
      const mg = { t: 22, r: 56, b: 6, l: labelW };
      const f = U.frame(host, w, steps.length * rowH + mg.t + mg.b, mg);
      f.svg.setAttribute('aria-label', 'Latest price of uranium, conversion and enrichment as a multiple of each one’s low');
      const x = d3.scaleLinear().domain([0, Math.max(5, d3.max(steps, (d) => d.mult))]).nice(4).range([0, f.iw]);
      x.ticks(4).forEach((t) => {
        const px = Math.round(x(t)) + 0.5;
        f.g.appendChild(U.el('line', { class: t === 0 ? 'baseline' : 'gridline', x1: px, x2: px, y1: -4, y2: steps.length * rowH }));
        f.g.appendChild(U.el('text', { class: 'ax-label', x: px, y: -10, 'text-anchor': 'middle', text: t === 0 ? '0' : t + '×' }));
      });
      const one = Math.round(x(1)) + 0.5;
      f.g.appendChild(U.el('line', { x1: one, x2: one, y1: -4, y2: steps.length * rowH, stroke: 'var(--ink-3)', 'stroke-width': 1 }));
      steps.forEach((d, i) => {
        const y = i * rowH, by = narrow ? y + 24 : y + 12, bw = x(d.mult), r = Math.min(4, bw, bh / 2);
        const detail = U.usd(d.from.v) + ' in ' + when(d.from.d) + ', ' + U.usd(d.to.v) + ' in ' + when(d.to.d) + ', ' + d.unit;
        const g = U.el('g', { tabindex: 0, 'aria-label': d.name + ': ' + U.n(d.mult, 1) + ' times its low. ' + detail });
        if (narrow) {
          g.appendChild(U.el('text', { class: 'direct', x: 0, y: y + 14, text: d.name }));
          g.appendChild(U.el('text', { class: 'ax-label', x: 0, y: by + bh + 16, text: U.usd(d.from.v) + ' ' + when(d.from.d) + ' → ' + U.usd(d.to.v) + ' ' + when(d.to.d) }));
          g.appendChild(U.el('text', { class: 'ax-label', x: 0, y: by + bh + 30, text: d.unit }));
        } else {
          g.appendChild(U.el('text', { class: 'direct', x: -12, y: by + bh / 2, dy: '0.32em', 'text-anchor': 'end', text: d.name }));
          g.appendChild(U.el('text', { class: 'ax-label', x: 6, y: by + bh + 15, text: detail }));
        }
        g.appendChild(U.el('path', { d: 'M0,' + by + 'h' + (bw - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (bh - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + -r + ',' + r + 'h' + -(bw - r) + 'z', fill: 'var(--market)' }));
        g.appendChild(U.el('text', { class: 'direct num', x: bw + 8, y: by + bh / 2, dy: '0.32em', text: U.n(d.mult, 1) + '×' }));
        const hit = U.el('rect', { x: -labelW, y: y, width: w, height: rowH, fill: 'transparent' });
        g.appendChild(hit);
        const tip = (px, py) => U.tip.show(px, py, U.tip.card(d.name, d.what, [['Low, ' + when(d.from.d), U.usd(d.from.v)], ['Latest, ' + when(d.to.d), U.usd(d.to.v), U.css('--market')], ['Multiple', U.n(d.mult, 1) + '×'], ['Unit', d.unit]]));
        hit.addEventListener('pointermove', (e) => tip(e.clientX, e.clientY));
        hit.addEventListener('pointerleave', () => U.tip.hide());
        g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); tip(b.left + labelW + 40, b.top + 8); });
        g.addEventListener('blur', () => U.tip.hide());
        f.g.appendChild(g);
      });
    });
    const note = U.$('#services-note'), paid = FC.swu_paid_latest;
    note.textContent = 'Each bar compares the latest published figure with that series’ own low, so the dates differ by row. '
      + (paid ? 'US utilities paid an average of ' + U.usd(paid.v) + ' per SWU for enrichment in ' + String(paid.d).slice(0, 4) + ', because most of it is bought under older contracts. ' : '')
      + (FC.series ? '' : 'The quarter-by-quarter history behind these figures is licensed and is not reproduced here.');
    const srcs = []; steps.forEach((d) => { if (d.source && !srcs.find((x) => x.t === d.source.t)) srcs.push(d.source); });
    if (paid) srcs.push({ t: 'EIA Uranium Marketing Annual Report', url: 'https://www.eia.gov/uranium/marketing/' });
    U.titleblock('tb-services', { title: 'Uranium, conversion and enrichment: latest price against each one’s low', unit: 'multiple of the low; USD per lb, per kgU, per SWU', asof: steps[0].to.d, sources: srcs });
  }

  function block(host, title, sub) {
    if (title) host.appendChild(U.el('div', { class: 'sub-head' }, U.el('h3', { text: title }), sub ? U.el('p', { text: sub }) : null));
    const fig = U.el('figure', { class: 'fig' });
    host.appendChild(fig);
    return fig;
  }

  /* ----- funds ----- */
  function funds(host, F) {
    const fig = block(host, 'Pounds parked in funds', 'Two listed funds buy physical uranium and hold it. They can raise money to buy more only when their units trade at or above the value of that uranium.');
    const statsEl = U.el('div', { class: 'stats' }); fig.appendChild(statsEl);
    const grid = U.el('div', { style: { display: 'grid', gap: '32px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' } });
    const a = U.el('div', null, U.el('div', { class: 'legend', id: 'funds-legend' }), U.el('div', { class: 'fig__body', id: 'funds-chart' }));
    const b = U.el('div', null, U.el('div', { class: 'legend', id: 'prem-legend' }), U.el('div', { class: 'fig__body', id: 'prem-chart' }));
    const etfs = (F.etfs || []).filter((e) => e.aum_usd > 0).sort((x, y) => y.aum_usd - x.aum_usd).slice(0, 8);
    const c = U.el('div', null, U.el('div', { class: 'legend', id: 'etf-legend' }), U.el('div', { class: 'fig__body', id: 'etf-chart' }));
    grid.appendChild(a); if (F.sput_premium && F.sput_premium.length > 2) grid.appendChild(b); else if (etfs.length > 1) grid.appendChild(c);
    fig.appendChild(grid);
    fig.appendChild(U.el('div', { class: 'fig__tools' }, U.el('button', { class: 'btn', type: 'button', 'data-table': 'funds-table', 'aria-expanded': 'false', text: 'Show table' })));
    fig.appendChild(U.el('div', { class: 'tableview', id: 'funds-table', hidden: true }));
    fig.appendChild(U.el('div', { class: 'titleblock', id: 'tb-funds' }));

    const S = F.sput.holdings.map((p) => ({ t: day(p[0]), d: p[0], v: p[1] }));
    const Y = F.yca && F.yca.holdings ? F.yca.holdings.map((p) => ({ t: day(p[0]), d: p[0], v: p[1] })) : [];
    const atOrBefore = (arr, t) => { let v = 0; for (const p of arr) { if (p.t <= t) v = p.v; else break; } return v; };
    const t0 = d3.min([S[0].t, Y.length ? Y[0].t : S[0].t]), t1 = d3.max([S[S.length - 1].t, Y.length ? Y[Y.length - 1].t : S[0].t]);
    // merged timeline for stacking
    const times = Array.from(new Set(S.concat(Y).map((p) => +p.t))).sort((x, y) => x - y).map((n) => new Date(n));
    const rows = times.map((t) => ({ t, s: atOrBefore(S, t), y: atOrBefore(Y, t) }));
    const lbToTu = (lb) => lb / U.LB_PER_TU;

    function stats() {
      const sl = F.sput.latest || {}, yl = (F.yca && F.yca.latest) || {};
      const total = (sl.lb_u3o8 || 0) + (yl.lb_u3o8 || 0);
      const mined = U.model.worldProd[U.model.lastActualYear];
      const items = [
        { v: U.fmtU(lbToTu(sl.lb_u3o8)), u: U.unitShort(), l: 'Held by Sprott Physical Uranium Trust', d: sl.d ? 'As of ' + U.dayLong(sl.d) : '' },
      ];
      if (yl.lb_u3o8) items.push({ v: U.fmtU(lbToTu(yl.lb_u3o8)), u: U.unitShort(), l: 'Held by Yellow Cake plc', d: yl.d ? 'As of ' + U.dayLong(yl.d) : '' });
      if (mined) items.push({ v: U.pct(lbToTu(total) / mined), l: 'Both funds, as a share of one year of world mine output', d: 'Against ' + U.model.lastActualYear + ' production' });
      if (sl.premium_discount_pct != null) items.push({ v: U.signed(U.n(Math.abs(sl.premium_discount_pct), 1) + '%', sl.premium_discount_pct), l: 'Sprott units against net asset value', d: sl.premium_discount_pct < 0 ? 'At a discount the trust cannot issue units to buy' : 'At a premium the trust can issue units and buy', dir: sl.premium_discount_pct < 0 ? 'down' : 'up' });
      U.stats(statsEl, items);
    }

    U.legend(U.$('#funds-legend'), [{ t: 'Sprott Physical Uranium Trust', c: 'var(--market)' }].concat(Y.length ? [{ t: 'Yellow Cake plc', c: 'var(--neutral-mark)' }] : []));
    function chart(w) {
      const h = w < 520 ? 260 : 320, m = { t: 30, r: 14, b: 26, l: 44 };
      const f = U.frame(U.$('#funds-chart'), w, h, m);
      f.svg.setAttribute('aria-label', 'Uranium held by physical funds over time');
      const x = d3.scaleUtc().domain([t0, t1]).range([0, f.iw]);
      const max = d3.max(rows, (r) => r.s + r.y);
      const y = d3.scaleLinear().domain([0, U.toUnit(lbToTu(max)) * 1.08]).nice(4).range([f.ih, 0]);
      const Yv = (lb) => y(U.toUnit(lbToTu(lb)));
      U.yGrid(f, y, y.ticks(4), U.axisNum);
      f.g.appendChild(U.el('text', { class: 'ax-label', x: -m.l + 2, y: -16, text: U.unitName() + ' held' }));
      const xg = U.el('g', { class: 'ax' }); x.ticks(w < 520 ? 4 : 6).forEach((t) => xg.appendChild(U.el('text', { x: x(t), y: f.ih + 18, 'text-anchor': 'middle', text: String(t.getUTCFullYear()) }))); f.g.appendChild(xg);
      const step = d3.curveStepAfter;
      f.g.appendChild(U.el('path', { d: d3.area().curve(step).x((r) => x(r.t)).y0(Yv(0)).y1((r) => Yv(r.s))(rows), fill: 'var(--market)' }));
      if (Y.length) f.g.appendChild(U.el('path', { d: d3.area().curve(step).x((r) => x(r.t)).y0((r) => Yv(r.s) - 2).y1((r) => Yv(r.s + r.y) - 2)(rows.filter((r) => r.y > 0)), fill: 'var(--neutral-mark)' }));
      hover(f, m, x, rows, (r) => U.tip.card(U.dayLong(r.t.toISOString().slice(0, 10)), null, [
        ['Sprott', U.fmtUu(lbToTu(r.s)), U.css('--market')], Y.length ? ['Yellow Cake', U.fmtUu(lbToTu(r.y)), U.css('--neutral-mark')] : null, ['Together', U.fmtUu(lbToTu(r.s + r.y))]]), U.$('#funds-chart'));
    }

    const P = (F.sput_premium || []).map((p) => ({ t: day(p[0]), d: p[0], v: p[1] }));
    function prem(w) {
      const h = w < 520 ? 260 : 320, m = { t: 30, r: 14, b: 26, l: 44 };
      const f = U.frame(U.$('#prem-chart'), w, h, m);
      f.svg.setAttribute('aria-label', 'Sprott Physical Uranium Trust premium or discount to net asset value, month end');
      const x = d3.scaleUtc().domain([t0, t1]).range([0, f.iw]);
      const ext = d3.extent(P, (p) => p.v), pad = 3;
      const y = d3.scaleLinear().domain([Math.min(-5, ext[0] - pad), Math.max(5, ext[1] + pad)]).nice(4).range([f.ih, 0]);
      U.yGrid(f, y, y.ticks(5), (t) => (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t) + '%');
      f.g.appendChild(U.el('text', { class: 'ax-label', x: -m.l + 2, y: -16, text: 'Unit price against net asset value' }));
      const xg = U.el('g', { class: 'ax' }); x.ticks(w < 520 ? 4 : 6).forEach((t) => xg.appendChild(U.el('text', { x: x(t), y: f.ih + 18, 'text-anchor': 'middle', text: String(t.getUTCFullYear()) }))); f.g.appendChild(xg);
      const bw = Math.max(1.5, Math.min(6, (f.iw / Math.max(1, (t1 - t0) / (30.4 * 86400000))) - 2));
      P.forEach((p) => { const y0 = y(0), y1 = y(p.v); f.g.appendChild(U.el('rect', { x: x(p.t) - bw / 2, y: Math.min(y0, y1), width: bw, height: Math.max(1, Math.abs(y1 - y0)), fill: p.v >= 0 ? 'var(--market)' : 'var(--ink-3)', rx: 1 })); });
      if (w >= 420) {
        f.g.appendChild(U.el('text', { class: 'ax-label', x: f.iw, y: y(y.domain()[1]) + 12, 'text-anchor': 'end', text: 'Premium: can buy' }));
        f.g.appendChild(U.el('text', { class: 'ax-label', x: f.iw, y: y(y.domain()[0]) - 6, 'text-anchor': 'end', text: 'Discount: cannot' }));
      }
      hover(f, m, x, P, (p) => U.tip.card(U.month(p.d.slice(0, 7)), 'Month end', [[p.v >= 0 ? 'Premium' : 'Discount', U.n(Math.abs(p.v), 1) + '%', U.css(p.v >= 0 ? '--market' : '--ink-3')]]), U.$('#prem-chart'));
    }
    if (U.$('#prem-legend')) U.legend(U.$('#prem-legend'), [{ t: 'Premium to net asset value', c: 'var(--market)' }, { t: 'Discount', c: 'var(--ink-3)' }]);

    function table() {
      const monthly = new Map(); rows.forEach((r) => monthly.set(r.t.toISOString().slice(0, 7), r));
      const pm = new Map(P.map((p) => [p.d.slice(0, 7), p.v]));
      U.table(U.$('#funds-table'), [{ k: 'm', t: 'Month', l: true, f: (v) => U.month(v) }, { k: 's', t: 'Sprott', f: (v) => U.fmtU(lbToTu(v)) }, { k: 'y', t: 'Yellow Cake', f: (v) => U.fmtU(lbToTu(v)) }, { k: 'p', t: 'Sprott premium', f: (v) => (v == null ? '–' : U.signed(U.n(Math.abs(v), 1) + '%', v)) }],
        Array.from(monthly.entries()).map(([m, r]) => ({ m, s: r.s, y: r.y, p: pm.get(m) })).sort((a, b) => (a.m < b.m ? 1 : -1)));
    }
    function etfChart(w) {
      const rowH = 30, m = { t: 30, r: 64, b: 6, l: 64 };
      const f = U.frame(U.$('#etf-chart'), w, etfs.length * rowH + m.t + m.b, m);
      f.svg.setAttribute('aria-label', 'Assets in listed uranium and nuclear equity funds');
      const x = d3.scaleLinear().domain([0, d3.max(etfs, (e) => e.aum_usd) / 1e9]).nice(4).range([0, f.iw]);
      x.ticks(4).forEach((t) => { const px = Math.round(x(t)) + 0.5; f.g.appendChild(U.el('line', { class: t === 0 ? 'baseline' : 'gridline', x1: px, x2: px, y1: -4, y2: etfs.length * rowH })); f.g.appendChild(U.el('text', { class: 'ax-label', x: px, y: -10, 'text-anchor': 'middle', text: '$' + t + 'bn' })); });
      etfs.forEach((e, i) => {
        const y = i * rowH + (rowH - 14) / 2, bw = x(e.aum_usd / 1e9), r = Math.min(4, bw, 7);
        f.g.appendChild(U.el('text', { class: 'direct', x: -10, y: y + 7, dy: '0.32em', 'text-anchor': 'end', text: e.ticker }));
        f.g.appendChild(U.el('path', { d: 'M0,' + y + 'h' + (bw - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (14 - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + -r + ',' + r + 'h' + -(bw - r) + 'z', fill: 'var(--market)' }));
        f.g.appendChild(U.el('text', { class: 'direct direct--muted num', x: bw + 8, y: y + 7, dy: '0.32em', text: '$' + U.n(e.aum_usd / 1e9, 2) + 'bn' }));
        const hit = U.el('rect', { x: -m.l, y: i * rowH, width: w, height: rowH, fill: 'transparent' });
        hit.addEventListener('pointermove', (ev) => U.tip.show(ev.clientX, ev.clientY, U.tip.card(e.ticker, e.name, [['Assets', '$' + U.n(e.aum_usd / 1e9, 2) + 'bn', U.css('--market')], e.as_of ? ['As of', U.dayLong(e.as_of)] : null])));
        hit.addEventListener('pointerleave', () => U.tip.hide());
        f.g.appendChild(hit);
      });
    }
    if (U.$('#etf-legend')) U.$('#etf-legend').appendChild(U.el('span', { class: 'legend__item', text: 'Assets in listed uranium and nuclear equity funds' }));
    stats(); table();
    if (U.$('#etf-chart')) U.responsive(U.$('#etf-chart'), etfChart);
    U.responsive(U.$('#funds-chart'), chart);
    if (P.length > 2 && U.$('#prem-chart')) U.responsive(U.$('#prem-chart'), prem);
    U.on('units', () => { stats(); table(); });
    U.titleblock('tb-funds', { fig: '09', title: 'Uranium held by listed physical funds', unit: 'Mlb U₃O₈ or tU held; fund assets in USD', asof: F.as_of, sources: [{ t: 'Sprott Physical Uranium Trust financial reports', url: 'https://sprott.com/investment-strategies/physical-commodity-funds/uranium/' }, { t: 'Yellow Cake plc updates', url: 'https://www.yellowcakeplc.com/' }] });
  }

  // shared crosshair for small time charts
  function hover(f, m, x, pts, card, hostEl) {
    const cross = U.el('line', { class: 'crosshair', y1: 0, y2: f.ih, visibility: 'hidden' }); f.g.appendChild(cross);
    const hit = U.el('rect', { x: 0, y: 0, width: f.iw, height: f.ih, fill: 'transparent', tabindex: 0, 'aria-label': 'Use arrow keys to read values' }); f.g.appendChild(hit);
    const bis = d3.bisector((p) => p.t).center; let idx = pts.length - 1;
    const show = (i, px, py) => { idx = Math.max(0, Math.min(pts.length - 1, i)); const p = pts[idx], X = x(p.t); cross.setAttribute('x1', X); cross.setAttribute('x2', X); cross.setAttribute('visibility', 'visible'); const b = hostEl.getBoundingClientRect(); U.tip.show(px != null ? px : b.left + m.l + X, py != null ? py : b.top + m.t + 20, card(p)); };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); U.tip.hide(); };
    hit.addEventListener('pointermove', (e) => { const b = hit.getBoundingClientRect(); show(bis(pts, x.invert(((e.clientX - b.left) / b.width) * f.iw)), e.clientX, e.clientY); });
    hit.addEventListener('pointerleave', hide); hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(idx + 1); else if (e.key === 'ArrowLeft') show(idx - 1); else return; e.preventDefault(); });
  }

  /* ----- US utilities: uranium still to buy ----- */
  function uncovered(host, D) {
    const fig = block(host, null);
    fig.appendChild(U.el('div', { class: 'legend', id: 'unc-legend' }));
    const body = U.el('div', { class: 'fig__body', id: 'unc-chart' }); fig.appendChild(body);
    fig.appendChild(U.el('div', { class: 'titleblock', id: 'tb-unc' }));
    const pts = D.points.map((p) => ({ y: +p.year, unfilled: p.unfilled_tu, contracted: p.contracted_tu })).filter((p) => p.unfilled != null);
    const hasC = pts.some((p) => p.contracted != null);
    U.legend(U.$('#unc-legend'), (hasC ? [{ t: 'Already under contract (maximum)', c: 'var(--demand)' }] : []).concat([{ t: 'Still to buy', c: 'var(--demand)', kind: 'ring' }]));
    U.responsive(body, (w) => {
      const h = w < 640 ? 280 : 340, m = { t: 30, r: 14, b: 26, l: 46 };
      const f = U.frame(body, w, h, m);
      f.svg.setAttribute('aria-label', 'US utility uranium requirements not yet under contract, by year');
      const x = d3.scaleBand().domain(pts.map((p) => p.y)).range([0, f.iw]).padding(0.3);
      const bw = Math.min(24, x.bandwidth()), off = (x.bandwidth() - bw) / 2;
      const max = d3.max(pts, (p) => (p.contracted || 0) + p.unfilled);
      const y = d3.scaleLinear().domain([0, U.toUnit(max) * 1.08]).nice(4).range([f.ih, 0]);
      const Yv = (tu) => y(U.toUnit(tu));
      U.yGrid(f, y, y.ticks(4), U.axisNum);
      f.g.appendChild(U.el('text', { class: 'ax-label', x: -m.l + 2, y: -16, text: U.unitName() + ' per year' }));
      pts.forEach((p) => {
        const c = p.contracted || 0;
        if (c) f.g.appendChild(U.el('rect', { x: x(p.y) + off, y: Yv(c), width: bw, height: Yv(0) - Yv(c), fill: 'var(--demand)' }));
        const g = U.el('rect', { x: x(p.y) + off + 0.75, y: Yv(c + p.unfilled), width: bw - 1.5, height: Math.max(1, Yv(c) - Yv(c + p.unfilled) - (c ? 2 : 0)), fill: 'none', stroke: 'var(--demand)', 'stroke-width': 1.5 });
        f.g.appendChild(g);
        f.g.appendChild(U.el('text', { class: 'ax-label', x: x(p.y) + x.bandwidth() / 2, y: f.ih + 18, 'text-anchor': 'middle', text: String(p.y) }));
        const hit = U.el('rect', { x: x(p.y), y: 0, width: x.bandwidth(), height: f.ih, fill: 'transparent' });
        hit.addEventListener('pointermove', (e) => U.tip.show(e.clientX, e.clientY, U.tip.card(String(p.y), null, [['Still to buy', U.fmtUu(p.unfilled)], hasC ? ['Under contract', U.fmtUu(c), U.css('--demand')] : null, c + p.unfilled ? ['Share still open', U.pct(p.unfilled / (c + p.unfilled))] : null])));
        hit.addEventListener('pointerleave', () => U.tip.hide());
        f.g.appendChild(hit);
      });
    });
    U.titleblock('tb-unc', { title: 'US utilities: contracted and unfilled uranium requirements', unit: 'Mlb U₃O₈ or tU per year', asof: D.as_of || null, sources: [{ t: D.source_name || 'EIA Uranium Marketing Annual Report', url: D.source || 'https://www.eia.gov/uranium/marketing/' }] });
  }
})();
