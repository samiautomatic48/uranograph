/* FIG. 09 — the scale of nuclear power on one logarithmic ruler, and the facts grid. */
(function () {
  'use strict';
  const U = window.U;
  U.scale = { init };

  function init() { ladder(); flow(); facts(); }

  /* One reactor, one year: the mass flow from ore to electricity, from the fuel-cycle fact's own numbers. */
  function flow() {
    const fig = U.$('#flow-fig'), host = U.$('#flow-steps');
    const fact = (U.data.facts || []).find((f) => f.flow && f.flow.length);
    if (!fig || !fact) return;
    const art = U.art || {};
    const get = (re) => fact.flow.find((s) => re.test(s.step)) || {};
    const ore = get(/ore/i), yc = get(/U3O8|yellowcake/i), uf6 = get(/^UF6/i), enr = get(/^enrichment/i), tails = get(/tails/i), fuel = get(/UO2|fuel loaded/i), el = get(/electricity/i);
    const n = (v, d) => U.n(v, d == null ? (v < 100 && v % 1 ? 1 : 0) : d);
    const range = (t) => (Array.isArray(t) ? n(t[0]) + '–' + n(t[1]) : n(t));
    const steps = [
      { k: 'Mine', art: 'open-pit', v: ore.tonnes ? range(ore.tonnes) : '–', u: 'tonnes of ore', note: 'Depends on the grade of the deposit' },
      { k: 'Mill', art: 'drum', v: n(yc.tonnes), u: 'tonnes of yellowcake, U₃O₈', note: 'Holds ' + n(yc.tU) + ' tonnes of uranium' },
      { k: 'Convert', art: 'uf6-cylinder', v: n(uf6.tonnes), u: 'tonnes of UF₆ gas feed', note: 'Same uranium, as a compound that can be enriched' },
      { k: 'Enrich', art: 'centrifuge', v: n(enr.swu), u: 'separative work units', note: 'From 0.711% to ' + enr.product_assay_pct + '% U-235, tails at ' + enr.tails_assay_pct + '%' },
      { k: 'Fabricate', art: 'fuel-assembly', v: n(fuel.tonnes), u: 'tonnes of UO₂ fuel', note: n(fuel.tU) + ' tonnes of enriched uranium in pellets' },
      { k: 'Generate', art: 'large-reactor', v: n(el.twh, 2), u: 'terawatt-hours', note: 'A 1 GWe reactor at full output for a year' },
    ];
    steps.forEach((s) => {
      const box = U.el('div', { class: 'flow__art' });
      if (art[s.art]) box.innerHTML = art[s.art]; // trusted: authored in this repo (js/05-art.js)
      host.appendChild(U.el('div', { class: 'flow__s' }, U.el('div', { class: 'label flow__k', text: s.k }), art[s.art] ? box : null,
        U.el('div', { class: 'flow__v', text: s.v }), U.el('div', { class: 'flow__u', text: s.u }), U.el('div', { class: 'flow__n', text: s.note })));
    });
    if (tails.tU && fuel.tU) {
      const total = tails.tU + fuel.tU, split = U.$('#flow-split');
      const bar = U.el('div', { class: 'flow-split__bar', role: 'img', 'aria-label': 'Of ' + n(total) + ' tonnes of mined uranium, ' + n(fuel.tU) + ' become fuel and ' + n(tails.tU) + ' are left as depleted tails' },
        U.el('div', { style: { flex: fuel.tU + ' 1 0', background: 'var(--supply)', color: '#121610' }, text: n(fuel.tU) + ' t' }),
        U.el('div', { style: { flex: tails.tU + ' 1 0', background: 'var(--neutral-mark)', color: '#121610' }, text: n(tails.tU) + ' t left behind as depleted tails' }));
      split.appendChild(bar);
      split.appendChild(U.el('p', { class: 'flow-split__cap', text: 'Of the ' + n(total) + ' tonnes of uranium mined for that year, ' + U.pct(fuel.tU / total) + ' goes into the reactor as fuel. The rest stays at the enrichment plant with most of its U-235 removed.' }));
    }
    fig.hidden = false;
    U.titleblock('tb-flow', { title: 'One reactor, one year: from ore to electricity', unit: 'tonnes, SWU, TWh for a 1 GWe light-water reactor', sources: [{ t: 'World Nuclear Association, nuclear fuel cycle overview', url: (fact.sources || [])[0] || 'https://world-nuclear.org/' }] });
  }

  function ladder() {
    const rail = U.$('#ladder-rail'), scroll = U.$('#ladder-scroll'), data = U.data.scale;
    if (!rail || !data || !data.length) return;
    const art = U.art || {};
    const all = data.map((r) => ({ ...r, w: r.w != null ? r.w : r.electric_w != null ? r.electric_w : r.thermal_w })).filter((r) => r.w > 0).sort((a, b) => a.w - b.w);
    const rungs = all.some((r) => r.show) ? all.filter((r) => r.show) : all;
    const lo = Math.floor(Math.log10(rungs[0].w)), hi = Math.ceil(Math.log10(rungs[rungs.length - 1].w));
    // Cards alternate between two lanes and are at least half a card apart, so an upper card's leader always
    // drops through the gap between its lower neighbours. Leaders only slant inside the strip above the ruler.
    const CARD = 196, SLOT = 108, PAD = 130, PX = 236; // px per decade
    const xOf = (w) => PAD + (Math.log10(w) - lo) * PX;
    let prev = -Infinity;
    rungs.forEach((r, i) => { r.x = xOf(r.w); r.cx = Math.max(r.x, prev + SLOT); prev = r.cx; r.lane = i % 2; });
    const width = Math.max(xOf(Math.pow(10, hi)) + PAD, prev + CARD / 2 + 40);
    const RULER = 56, STRIP = 46, LANE_H = 236, H = RULER + STRIP + LANE_H * 2 + 28;
    const LANE_BOTTOM = [RULER + STRIP, RULER + STRIP + LANE_H + 16];
    rail.style.width = width + 'px'; rail.style.height = H + 'px';
    U.clear(rail);

    // leaders
    const svg = U.el('svg', { width: width, height: H, viewBox: '0 0 ' + width + ' ' + H, style: { position: 'absolute', inset: '0', pointerEvents: 'none' }, 'aria-hidden': 'true' });
    rail.appendChild(svg);
    rungs.forEach((r) => {
      const yCard = H - LANE_BOTTOM[r.lane] + 6, yStrip = H - RULER - STRIP + 6, yRule = H - RULER;
      svg.appendChild(U.el('path', { d: 'M' + r.cx + ',' + yCard + ' L' + r.cx + ',' + yStrip + ' L' + r.x + ',' + (yRule - 8) + ' L' + r.x + ',' + yRule, fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 1, 'stroke-linejoin': 'round' }));
      svg.appendChild(U.el('circle', { cx: r.x, cy: yRule, r: 3, fill: 'var(--supply)', stroke: 'var(--paper)', 'stroke-width': 1.5 }));
    });

    rungs.forEach((r) => {
      const card = U.el('div', { class: 'rung', tabindex: 0, style: { left: r.cx + 'px', bottom: LANE_BOTTOM[r.lane] + 'px', width: CARD + 'px', transform: 'translateX(-50%)' } });
      const artBox = U.el('div', { class: 'rung__art' });
      const key = r.art && art[r.art] ? r.art : null;
      if (key) artBox.innerHTML = art[key]; // trusted: authored in this repo (js/05-art.js)
      card.appendChild(artBox);
      card.appendChild(U.el('div', { class: 'rung__p', text: U.power(r.w) }));
      card.appendChild(U.el('div', { class: 'rung__n', text: r.name }));
      if (r.blurb) card.appendChild(U.el('div', { class: 'rung__b', text: r.blurb }));
      const tip = (px, py) => U.tip.show(px, py, U.tip.card(r.name, r.year ? String(r.year) : null, [
        r.electric_w != null ? ['Electric output', U.power(r.electric_w), U.css('--supply')] : null,
        r.thermal_w != null ? ['Heat output', U.power(r.thermal_w)] : null,
        r.fuel ? ['Fuel', String(r.fuel).slice(0, 48)] : null,
        r.equivalent ? ['About', String(r.equivalent).slice(0, 60)] : null,
        r.confidence === 'public-estimate' ? ['Note', 'Public estimate'] : null,
      ]));
      card.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') tip(e.clientX, e.clientY); });
      card.addEventListener('pointerleave', () => U.tip.hide());
      card.addEventListener('focus', () => { const b = card.getBoundingClientRect(); tip(b.left + b.width / 2, b.top + 40); });
      card.addEventListener('blur', () => U.tip.hide());
      rail.appendChild(card);
    });

    // ruler
    const ruler = U.el('div', { class: 'ruler' });
    for (let e = lo; e <= hi; e++) {
      const x = xOf(Math.pow(10, e)), major = ((e % 3) + 3) % 3 === 0;
      ruler.appendChild(U.el('span', { class: 'ruler__t' + (major ? '' : ' ruler__t--minor'), style: { left: x + 'px' } }));
      ruler.appendChild(U.el('span', { class: 'ruler__l label', style: { left: x + 'px', color: major ? 'var(--ink)' : null }, text: U.power(Math.pow(10, e)) }));
    }
    rail.appendChild(ruler);

    // drag to scroll with a mouse
    let drag = null;
    scroll.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; drag = { x: e.clientX, left: scroll.scrollLeft }; scroll.dataset.drag = '1'; scroll.setPointerCapture(e.pointerId); });
    scroll.addEventListener('pointermove', (e) => { if (drag) { scroll.scrollLeft = drag.left - (e.clientX - drag.x); U.tip.hide(); } });
    const end = () => { drag = null; delete scroll.dataset.drag; };
    scroll.addEventListener('pointerup', end); scroll.addEventListener('pointercancel', end);
    scroll.addEventListener('scroll', () => U.tip.hide(), { passive: true });

    U.table(U.$('#scale-table'), [
      { k: 'name', t: 'Source', l: true }, { k: 'year', t: 'Year', f: (v) => v || '–' },
      { k: 'electric_w', t: 'Electric', f: (v) => (v == null ? '–' : U.power(v)) }, { k: 'thermal_w', t: 'Heat', f: (v) => (v == null ? '–' : U.power(v)) },
      { k: 'fuel', t: 'Fuel', l: true, f: (v) => v || '–' }, { k: 'confidence', t: 'Basis', l: true, f: (v) => (v === 'public-estimate' ? 'Public estimate' : 'Published') },
    ], all);
    U.titleblock('tb-scale', { fig: '09', title: 'Nuclear power sources, smallest to largest', unit: 'watts, logarithmic. Each major tick is ×1,000', sources: [{ t: 'NASA, DOE, IAEA, vendor data' }, { t: 'see table for each source' }] });
  }

  function facts() {
    const grid = U.$('#facts-grid'), all = U.data.facts;
    if (!grid || !all || !all.length) return;
    const GROUPS = { 'energy-density': 'Energy', 'fuel-cycle': 'Fuel cycle', element: 'The element', market: 'Market', geology: 'Geology', history: 'History', waste: 'Waste', 'safety-climate': 'Safety and climate' };
    const hasTop = all.some((f) => f.top);
    const st = { g: hasTop ? 'top' : 'all' };
    const present = Object.keys(GROUPS).filter((k) => all.some((f) => f.group === k));
    U.$('#facts-controls').appendChild(U.seg('Show', (hasTop ? [{ v: 'top', t: 'Highlights' }] : []).concat(present.map((k) => ({ v: k, t: GROUPS[k] })), [{ v: 'all', t: 'All ' + all.length }]), st.g, (v) => { st.g = v; draw(); }));
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return null; } };
    // featured: a few facts shown large with their drawings
    const art = U.art || {}, featHost = U.$('#facts-feat');
    const featured = all.filter((f) => f.art && f.art.length && f.art.every((k) => art[k]));
    if (featHost && featured.length >= 2) {
      featured.forEach((f) => {
        const box = U.el('div', { class: 'feat__art' });
        f.art.forEach((k, i) => { if (i) box.appendChild(U.el('span', { class: 'feat__eq', 'aria-hidden': 'true', text: '=' })); const d = U.el('div'); d.innerHTML = art[k]; box.appendChild(d); }); // trusted: authored in this repo (js/05-art.js)
        const src = (f.sources || []).find((x) => /^https?:\/\//.test(x));
        featHost.appendChild(U.el('div', { class: 'feat__c' }, box,
          U.el('div', { class: 'fact__v' }, String(f.display != null ? f.display : f.value), f.unit ? U.el('small', { text: f.unit }) : null),
          U.el('p', { class: 'fact__s', text: f.statement }), f.detail ? U.el('p', { class: 'fact__d', text: f.detail }) : null,
          src ? U.el('a', { class: 'fact__src', href: src, target: '_blank', rel: 'noopener noreferrer', text: host(src) || 'source' }) : null));
      });
      featHost.hidden = false;
    }
    const featIds = new Set(featHost && !featHost.hidden ? featured.map((f) => f.id) : []);
    function draw() {
      U.clear(grid);
      all.filter((f) => st.g === 'all' || (st.g === 'top' ? f.top && !featIds.has(f.id) : f.group === st.g)).forEach((f) => {
        const src = (f.sources || []).find((s) => /^https?:\/\//.test(s));
        const v = U.el('div', { class: 'fact__v' }, String(f.display != null ? f.display : f.value), f.unit ? U.el('small', { text: f.unit }) : null);
        const node = U.el('div', { class: 'fact' }, v, U.el('p', { class: 'fact__s', text: f.statement }), f.detail ? U.el('p', { class: 'fact__d', text: f.detail }) : null,
          src ? U.el('a', { class: 'fact__src', href: src, target: '_blank', rel: 'noopener noreferrer', text: host(src) || 'source' }) : null);
        grid.appendChild(node);
      });
    }
    draw();
  }
})();
