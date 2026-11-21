/* Mined here, used there: mine output against reactor need by region, counted either by where the mine is
   or by the home region of who owns it. Regions and owner regions are assigned in scripts/build-data.mjs. */
(function () {
  'use strict';
  const U = window.U;
  U.split = { init };

  function init() {
    const host = U.$('#split-chart'), mines = U.data.mines, reactors = U.data.reactors, meta = U.data.meta || {};
    if (!host || !mines || !reactors || !meta.regions) return;
    const M = U.model, LY = M.lastActualYear, regions = meta.regions;
    const st = { by: 'place' };
    const prod = (m) => (m.production_tu || {})[LY] || 0;

    const need = {}, place = {}, owner = {};
    regions.forEach((r) => { need[r] = 0; place[r] = 0; owner[r] = 0; });
    reactors.forEach((r) => { if (r.status === 'operating' && need[r.rg] != null) need[r.rg] += r.req || 0; });
    mines.forEach((m) => {
      const v = prod(m); if (!v) return;
      if (place[m.rg] != null) place[m.rg] += v;
      Object.entries(m.own || { [m.rg]: 100 }).forEach(([r, p]) => { if (owner[r] != null) owner[r] += (v * p) / 100; });
    });
    const tot = (o) => d3.sum(regions, (r) => o[r]);
    const share = (o, list) => d3.sum(list, (r) => o[r] || 0) / (tot(o) || 1);

    U.$('#split-controls').appendChild(U.seg('Count each mine under', [{ v: 'place', t: 'Where it is' }, { v: 'owner', t: 'Who owns it' }], st.by, (v) => { st.by = v; stats(); legend(); ask(); table(); }));

    function stats() {
      const west = ['North America', 'Europe'], east = ['Russia and Central Asia', 'China'];
      const items = [
        { v: U.pct(share(need, west)), l: 'of reactor need is in North America and Europe', d: 'They mine ' + U.pct(share(place, west)) + ' of the world’s uranium' },
        { v: U.pct(share(place, east)), l: 'is mined in Russia, Central Asia and China', d: 'Their reactors use ' + U.pct(share(need, east)) },
        { v: U.pct(share(owner, east)), l: 'is owned by companies from Russia, Central Asia and China', d: 'Counting each mine by its owners’ shares' },
        { v: U.pct(share(place, ['Africa', 'Australia'])), l: 'is mined in Africa and Australia', d: 'Their reactors use ' + U.pct(share(need, ['Africa', 'Australia']), 1) },
      ];
      U.stats(U.$('#split-stats'), items);
    }
    function legend() {
      U.legend(U.$('#split-legend'), [{ t: st.by === 'place' ? 'Mined in the region, ' + LY : 'Mined by owners from the region, ' + LY, c: 'var(--supply)' }, { t: 'Needed by the region’s reactors', c: 'var(--demand)' }]);
    }

    function render(w) {
      const mined = st.by === 'place' ? place : owner;
      const narrow = w < 640, labelW = narrow ? 0 : Math.min(230, w * 0.26), rowH = narrow ? 64 : 48, bh = 12;
      const mg = { t: 22, r: narrow ? 84 : 120, b: 6, l: labelW };
      const f = U.frame(host, w, regions.length * rowH + mg.t + mg.b, mg);
      f.svg.setAttribute('aria-label', 'Uranium mined and uranium needed by reactors, by region');
      const max = d3.max(regions, (r) => Math.max(place[r], owner[r], need[r])) || 1;
      const x = d3.scaleLinear().domain([0, U.toUnit(max)]).nice(4).range([0, f.iw]);
      const X = (tu) => x(U.toUnit(tu));
      x.ticks(4).forEach((t) => {
        const px = Math.round(x(t)) + 0.5;
        f.g.appendChild(U.el('line', { class: t === 0 ? 'baseline' : 'gridline', x1: px, x2: px, y1: -4, y2: regions.length * rowH }));
        f.g.appendChild(U.el('text', { class: 'ax-label', x: px, y: -10, 'text-anchor': 'middle', text: U.axisNum(t) }));
      });
      const bar = (x0, y, bw, r) => { r = Math.min(r, bw, bh / 2); return 'M' + x0 + ',' + y + 'h' + (bw - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (bh - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + -r + ',' + r + 'h' + -(bw - r) + 'z'; };
      const tm = tot(mined), tn = tot(need);
      regions.forEach((r, i) => {
        const y = i * rowH, top = narrow ? y + 22 : y + (rowH - (bh * 2 + 4)) / 2;
        const g = U.el('g', { tabindex: 0, 'aria-label': r + ': mined ' + U.fmtUu(mined[r]) + ', needed ' + U.fmtUu(need[r]) });
        if (narrow) g.appendChild(U.el('text', { class: 'direct', x: 0, y: y + 14, text: r }));
        else g.appendChild(U.el('text', { class: 'direct', x: -12, y: top + bh + 2, dy: '0.32em', 'text-anchor': 'end', text: r }));
        const rows = [[mined[r], tm, '--supply', top], [need[r], tn, '--demand', top + bh + 4]];
        rows.forEach(([v, t, c, yy]) => {
          const bw = X(v);
          if (bw >= 0.5) g.appendChild(U.el('path', { d: bar(0, yy, Math.max(1, bw), 4), fill: 'var(' + c + ')' }));
          g.appendChild(U.el('text', { class: 'direct direct--muted num', x: Math.max(bw, 0) + 8, y: yy + bh / 2, dy: '0.32em', text: U.fmtU(v) + ' · ' + U.pct(v / (t || 1), v / (t || 1) < 0.1 ? 1 : 0) }));
        });
        const hit = U.el('rect', { x: -labelW, y: y, width: w, height: rowH, fill: 'transparent' });
        g.appendChild(hit);
        const tip = (px, py) => U.tip.show(px, py, U.tip.card(r, String(LY), [
          ['Mined in the region', U.fmtUu(place[r]), U.css('--supply')], ['Mined by its owners', U.fmtUu(owner[r])], ['Needed by its reactors', U.fmtUu(need[r]), U.css('--demand')],
          [need[r] > place[r] ? 'Short by' : 'Surplus', U.fmtUu(Math.abs(place[r] - need[r]))]]));
        hit.addEventListener('pointermove', (e) => tip(e.clientX, e.clientY));
        hit.addEventListener('pointerleave', () => U.tip.hide());
        g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); tip(b.left + labelW + 40, b.top + 8); });
        g.addEventListener('blur', () => U.tip.hide());
        f.g.appendChild(g);
      });
    }
    function table() {
      U.table(U.$('#split-table'), [
        { k: 'r', t: 'Region', l: true }, { k: 'place', t: 'Mined there', f: (v) => U.fmtU(v) }, { k: 'owner', t: 'Mined by its owners', f: (v) => U.fmtU(v) },
        { k: 'need', t: 'Needed by reactors', f: (v) => U.fmtU(v) }, { k: 'gap', t: 'Mined less needed', f: (v) => U.signed(U.fmtU(Math.abs(v)), v) },
      ], regions.map((r) => ({ r, place: place[r], owner: owner[r], need: need[r], gap: place[r] - need[r] })));
    }

    stats(); legend(); table();
    const ask = U.responsive(host, render);
    U.on('units', () => { stats(); table(); });
    U.titleblock('tb-split', { title: 'Uranium mined and uranium needed, by region, ' + LY, unit: 'Mlb U₃O₈ or tU per year; share of world', sources: [{ t: 'Mine and reactor data on this site' }, { t: 'owner shares from company reports' }, { t: 'see Sources', url: '#sources' }] });
  }
})();
