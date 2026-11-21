/* FIG. 03 — the fleet as a lattice (one square per reactor), and FIG. 04 — the pipeline by due year. */
(function () {
  'use strict';
  const U = window.U;
  U.fleet = { init };
  const ORDER = { operating: 0, idle: 1, construction: 2, planned: 3 };
  const LABEL = { operating: 'Running', idle: 'Idle', construction: 'Being built', planned: 'Planned' };

  function init() {
    const R = U.data.reactors; if (!R || !R.length) return;
    const M = U.model, now = M.nowYear;
    const live = R.filter((r) => ORDER[r.status] != null);
    const st = { show: 'all', sort: 'units' };
    const due = (u) => (u.r0 != null ? u.r0 : u.y0);

    /* ----- stats ----- */
    function stats() {
      const by = d3.rollup(live, (v) => ({ n: v.length, mw: d3.sum(v, (r) => r.mw || 0), req: d3.sum(v, (r) => r.req || 0) }), (r) => r.status);
      const g = (k) => by.get(k) || { n: 0, mw: 0, req: 0 };
      const op = g('operating'), con = g('construction'), pl = g('planned');
      U.stats(U.$('#fleet-stats'), [
        { v: U.n(op.n), l: 'Reactors running', d: U.n(op.mw / 1000) + ' GWe net' },
        { v: U.n(con.n), l: 'Being built', d: U.n(con.mw / 1000, 1) + ' GWe · adds ' + U.fmtUu(con.req) + '/yr' },
        { v: U.n(pl.n), l: 'Planned with a named site', d: U.n(pl.mw / 1000, 1) + ' GWe · adds ' + U.fmtUu(pl.req) + '/yr' },
        { v: U.fmtU(op.req), u: U.unitShort(), l: 'Uranium the running fleet needs each year', d: 'About ' + U.fmtUu(op.req / Math.max(1, op.n)) + ' per reactor' },
      ]);
    }

    /* ----- lattice ----- */
    const host = U.$('#fleet-lattice');
    const ctl = U.$('#fleet-controls');
    ctl.appendChild(U.seg('Show', [{ v: 'all', t: 'All' }, { v: 'operating', t: 'Running' }, { v: 'construction', t: 'Being built' }, { v: 'planned', t: 'Planned' }], st.show, (v) => { st.show = v; lattice(); }));
    ctl.appendChild(U.seg('Order countries by', [{ v: 'units', t: 'Units' }, { v: 'new', t: 'New build' }, { v: 'need', t: 'Uranium need' }], st.sort, (v) => { st.sort = v; lattice(); }));
    U.legend(U.$('#fleet-legend'), [
      { t: 'Running', c: 'var(--demand)' }, { t: 'Idle, could restart', c: 'var(--neutral-mark)' },
      { t: 'Being built', c: 'var(--demand)', kind: 'ring' }, { t: 'Planned', c: 'var(--demand)', kind: 'ring' },
    ]);
    // make the "being built" swatch hatched like its cells
    const sw = U.$$('#fleet-legend .sw')[2]; if (sw) { sw.style.background = 'repeating-linear-gradient(135deg, var(--demand) 0 2px, transparent 2px 4px)'; }

    const index = new Map();
    function lattice() {
      U.clear(host); index.clear();
      const groups = d3.groups(live.filter((r) => st.show === 'all' || r.status === st.show), (r) => r.country)
        .map(([country, units]) => ({ country, units, n: units.length,
          newb: units.filter((u) => u.status === 'construction' || u.status === 'planned').length,
          need: d3.sum(units, (u) => (u.status === 'operating' ? u.req : 0)),
          run: units.filter((u) => u.status === 'operating').length }));
      const key = st.sort === 'new' ? 'newb' : st.sort === 'need' ? 'need' : 'n';
      groups.sort((a, b) => b[key] - a[key] || b.n - a.n || a.country.localeCompare(b.country));
      if (!groups.length) { host.appendChild(U.el('p', { class: 'empty', text: 'Nothing to show for this filter.' })); return; }
      groups.forEach((g) => {
        g.units.sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.y0 || 9999) - (b.y0 || 9999) || (a.name < b.name ? -1 : 1));
        const cells = U.el('div', { class: 'cells' });
        g.units.forEach((u) => { const c = U.el('span', { class: 'cell', 'data-s': u.status, 'data-id': u.id }); index.set(u.id, u); cells.appendChild(c); });
        const parts = ['operating', 'idle', 'construction', 'planned'].map((k) => { const n = g.units.filter((u) => u.status === k).length; return n ? n + ' ' + LABEL[k].toLowerCase() : null; }).filter(Boolean);
        host.appendChild(U.el('div', { class: 'lat-row', role: 'img', 'aria-label': g.country + ': ' + parts.join(', ') },
          U.el('div', { class: 'lat-row__c', text: g.country }), cells,
          U.el('div', { class: 'lat-row__n', text: st.sort === 'need' ? U.fmtU(g.need) : String(g.n) })));
      });
    }
    const tipFor = (u) => U.tip.card(u.name, [u.country, u.model || u.type].filter(Boolean).join(' · '), [
      ['Status', LABEL[u.status] || u.status],
      ['Net capacity', u.mw ? U.n(u.mw) + ' MWe' : '–'],
      [u.status === 'operating' || u.status === 'idle' ? 'On the grid since' : u.restart ? 'Due back on the grid' : 'Due on the grid', (u.status === 'operating' || u.status === 'idle' ? u.y0 : due(u)) ? String(u.status === 'operating' || u.status === 'idle' ? u.y0 : due(u)) : 'No date published'],
      ['Needs each year', U.fmtUu(u.req), U.css('--demand')],
    ]);
    host.addEventListener('pointermove', (e) => {
      const c = e.target.closest('.cell'); if (!c) { U.tip.hide(); return; }
      const u = index.get(c.dataset.id); if (u) U.tip.show(e.clientX, e.clientY, tipFor(u));
    });
    host.addEventListener('pointerleave', () => U.tip.hide());

    /* ----- pipeline ----- */
    const pHost = U.$('#pipeline-chart');
    const pipe = live.filter((r) => (r.status === 'construction' || r.status === 'planned'));
    const dated = pipe.filter((r) => due(r) != null && due(r) >= now && due(r) <= M.horizon);
    const undated = pipe.filter((r) => due(r) == null || due(r) > M.horizon);
    const late = pipe.filter((r) => due(r) != null && due(r) < now); // overdue: listed as due before this year
    late.forEach((r) => { r._bin = now; }); dated.forEach((r) => { r._bin = due(r); });
    const binned = dated.concat(late);
    U.legend(U.$('#pipeline-legend'), [{ t: 'Being built', c: 'var(--demand)' }, { t: 'Planned', c: 'var(--demand)', kind: 'ring' }]);

    function pipeline(w) {
      const years = d3.range(now, M.horizon + 1);
      const cols = years.map((y) => ({ y, units: binned.filter((r) => r._bin === y).sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.mw || 0) - (a.mw || 0)) }));
      const m = { t: 22, r: 8, b: 34, l: 8 };
      const iw = w - m.l - m.r;
      const step = iw / cols.length;
      const pitch = Math.max(8, Math.min(13, (step - 4) / 2)); // at least two dots side by side in a year
      const perRow = Math.max(1, Math.min(4, Math.floor((step - 4) / pitch)));
      const dot = pitch / 2 - 1.2;
      const maxRows = d3.max(cols, (c) => Math.ceil(c.units.length / perRow)) || 1;
      const ih = Math.max(120, maxRows * pitch + 22);
      const f = U.frame(pHost, w, ih + m.t + m.b, m);
      f.svg.setAttribute('aria-label', 'Reactors under construction and planned, by the year they are due on the grid');
      f.g.appendChild(U.el('line', { class: 'baseline', x1: 0, x2: iw, y1: ih + 0.5, y2: ih + 0.5 }));
      cols.forEach((c, i) => {
        const cx0 = i * step + step / 2;
        const lab = w < 700 ? "'" + String(c.y).slice(2) : String(c.y);
        f.g.appendChild(U.el('text', { class: 'ax-label', x: cx0, y: ih + 18, 'text-anchor': 'middle', text: lab }));
        const rowW = Math.min(perRow, c.units.length) * pitch;
        c.units.forEach((u, j) => {
          const col = j % perRow, row = Math.floor(j / perRow);
          const x = cx0 - (Math.min(perRow, c.units.length - row * perRow) * pitch) / 2 + col * pitch + pitch / 2;
          const y = ih - 6 - dot - row * pitch;
          const solid = u.status === 'construction';
          const node = U.el('circle', { cx: x, cy: y, r: solid ? dot : dot - 0.8, fill: solid ? 'var(--demand)' : 'var(--paper)', stroke: 'var(--demand)', 'stroke-width': solid ? 0 : 1.6, 'data-id': u.id });
          f.g.appendChild(node);
        });
        if (c.units.length && w >= 560) {
          const rowsN = Math.ceil(c.units.length / perRow);
          f.g.appendChild(U.el('text', { class: 'ax-label', x: cx0, y: ih - 12 - rowsN * pitch, 'text-anchor': 'middle', text: String(c.units.length) }));
        }
        void rowW;
      });
      // nearest-dot hover
      const hit = U.el('rect', { x: 0, y: 0, width: iw, height: ih, fill: 'transparent' });
      f.g.appendChild(hit);
      const dots = U.$$('circle[data-id]', f.g);
      let cur = null;
      hit.addEventListener('pointermove', (e) => {
        let best = null, bd = 22;
        dots.forEach((d) => { const b = d.getBoundingClientRect(); const dist = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)); if (dist < bd) { bd = dist; best = d; } });
        if (cur && cur !== best) cur.removeAttribute('data-hot');
        if (best) {
          cur = best; const u = byId.get(best.getAttribute('data-id'));
          best.setAttribute('data-hot', '1');
          U.tip.show(e.clientX, e.clientY, U.tip.card(u.name, [u.country, u.model || u.type].filter(Boolean).join(' · '), [
            ['Status', LABEL[u.status] + (u.restart ? ' (restart)' : '')], ['Net capacity', u.mw ? U.n(u.mw) + ' MWe' : '–'], ['Due on the grid', due(u) ? String(due(u)) : 'No date'],
            u.restart ? null : ['First core, about', U.fmtUu(u.req * (1 + M.firstCoreMultiple)), U.css('--demand')], [u.restart ? 'Needs each year' : 'Then each year', U.fmtUu(u.req)],
          ]));
        } else { cur = null; U.tip.hide(); }
      });
      hit.addEventListener('pointerleave', () => { if (cur) cur.removeAttribute('data-hot'); cur = null; U.tip.hide(); });
    }
    const byId = new Map(pipe.map((u) => [u.id, u]));

    function table() {
      U.table(U.$('#pipeline-table'), [
        { k: 'name', t: 'Unit', l: true }, { k: 'country', t: 'Country', l: true }, { k: 'status', t: 'Status', l: true, f: (v) => LABEL[v] || v },
        { k: 'model', t: 'Design', l: true, f: (v, r) => v || r.type || '–' }, { k: 'mw', t: 'MWe', f: (v) => U.n(v) }, { k: 'y0', t: 'Due', f: (v, r) => due(r) || '–' },
        { k: 'req', t: 'Need / yr', f: (v) => U.fmtU(v) },
      ], pipe.slice().sort((a, b) => (due(a) || 9999) - (due(b) || 9999) || a.country.localeCompare(b.country)));
    }

    function countryTable() {
      const rows = d3.groups(live, (r) => r.country).map(([country, units]) => {
        const n = (k) => units.filter((u) => u.status === k).length;
        const op = units.filter((u) => u.status === 'operating');
        return { country, run: op.length, gwe: d3.sum(op, (u) => u.mw || 0) / 1000, idle: n('idle'), con: n('construction'), pl: n('planned'), need: d3.sum(op, (u) => u.req || 0) };
      }).sort((a, b) => b.need - a.need || b.run - a.run || a.country.localeCompare(b.country));
      U.table(U.$('#fleet-table'), [
        { k: 'country', t: 'Country', l: true }, { k: 'run', t: 'Running' }, { k: 'gwe', t: 'GWe', f: (v) => U.n(v, 1) }, { k: 'idle', t: 'Idle' }, { k: 'con', t: 'Being built' }, { k: 'pl', t: 'Planned' },
        { k: 'need', t: 'Need / yr, ' + U.unitShort(), f: (v) => U.fmtU(v) },
      ], rows);
    }
    stats(); lattice(); table(); countryTable();
    if (undated.length) {
      const nc = undated.filter((u) => u.status === 'construction').length;
      pHost.parentNode.insertBefore(U.el('p', { class: 'note', text: undated.length + ' more units have no published date and are left off the chart' + (nc ? ' (' + nc + ' of them under construction, several suspended)' : '') + '. They are in the table.' }), pHost.nextSibling);
    }
    if (pipe.length) U.responsive(pHost, pipeline); else pHost.appendChild(U.el('p', { class: 'empty', text: 'No reactors under construction in the data.' }));
    U.on('units', () => { stats(); lattice(); table(); countryTable(); });

    const srcs = [{ t: 'IAEA PRIS', url: 'https://pris-stats.iaea.org/' }, { t: 'World Nuclear Association', url: 'https://world-nuclear.org/information-library/facts-and-figures/world-nuclear-power-reactors-and-uranium-requireme' }, { t: 'GeoNuclearData', url: 'https://github.com/cristianst85/GeoNuclearData' }];
    U.titleblock('tb-fleet', { fig: '03', title: 'World reactor fleet by country', unit: '1 square = 1 reactor', sources: srcs });
    U.titleblock('tb-pipeline', { fig: '04', title: 'Reactors due on the grid, ' + now + '–' + M.horizon, unit: '1 dot = 1 reactor', sources: srcs });
  }
})();
