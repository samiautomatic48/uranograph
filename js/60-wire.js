/* The wire — news and regulatory filings. Headlines link out; summaries are the site's own. */
(function () {
  'use strict';
  const U = window.U;
  U.wire = { init };
  const CAT = { supply: { t: 'Supply', c: '--supply' }, demand: { t: 'Demand', c: '--demand' }, policy: { t: 'Policy', c: '--ink-3' }, 'fuel-cycle': { t: 'Fuel cycle', c: '--market' }, price: { t: 'Price', c: '--market' }, corporate: { t: 'Corporate', c: '--ink-3' } };
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : null);

  function init() { news(); filings(); companies(); }

  function companies() {
    const all = U.data.companies, block = U.$('#companies-block'), host = U.$('#companies-table');
    if (!all || !all.length || !block) return;
    const SEG = { producer: 'Producers', developer: 'Developers', explorer: 'Explorers', royalty: 'Royalty', holding: 'Holding', 'physical-trust': 'Physical funds', 'asset-manager': 'Asset managers', 'conversion-enrichment-fuel': 'Conversion, enrichment, fuel', 'reactor-vendor': 'Reactor vendors', 'smr-developer': 'SMR developers', utility: 'Utilities' };
    const GROUPS = [['mining', 'Miners', ['producer', 'developer', 'explorer', 'royalty', 'holding']], ['fuel', 'Fuel cycle', ['conversion-enrichment-fuel']], ['funds', 'Funds', ['physical-trust', 'asset-manager']], ['reactors', 'Reactor builders', ['reactor-vendor', 'smr-developer']], ['utility', 'Utilities', ['utility']]];
    const st = { g: 'all' };
    const opts = [{ v: 'all', t: 'All ' + all.length }].concat(GROUPS.filter((g) => all.some((c) => g[2].includes(c.segment))).map((g) => ({ v: g[0], t: g[1] })));
    U.$('#companies-controls').appendChild(U.seg('Show', opts, st.g, (v) => { st.g = v; draw(); }));
    function draw() {
      const grp = GROUPS.find((g) => g[0] === st.g);
      const ORD = Object.keys(SEG), rank = (c) => { const i = ORD.indexOf(c.segment); return i < 0 ? 99 : i; };
      const rows = all.filter((c) => !grp || grp[2].includes(c.segment)).slice().sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
      U.table(host, [
        { k: 'name', t: 'Company', l: true, f: (v, r) => { const u = safeUrl(r.ir_url); return u ? U.el('a', { href: u, target: '_blank', rel: 'noopener noreferrer', text: v }) : v; } },
        { k: 'tickers', t: 'Listed', l: true, f: (v) => v || '–' },
        { k: 'segment', t: 'What it is', l: true, f: (v) => SEG[v] || v || '–' },
        { k: 'role', t: 'Role', l: true, f: (v) => v || '–' },
        { k: 'filings_url', t: 'Filings', l: true, f: (v, r) => { const u = safeUrl(v); return u ? U.el('a', { href: u, target: '_blank', rel: 'noopener noreferrer', text: (r.filings_venue || 'Filings').trim() }) : (r.filings_venue || '–'); } },
      ], rows, 'src-table');
    }
    draw(); block.hidden = false;
  }

  function news() {
    const list = U.$('#news-list'), all = (U.data.news || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!list) return;
    if (!all.length) { list.appendChild(U.el('p', { class: 'empty', text: 'No news items in this issue yet.' })); U.$('#news-more').hidden = true; return; }
    const hasTop = all.filter((n) => n.importance >= 4).length >= 4;
    const st = { cat: hasTop ? 'top' : 'all', n: 12 };
    const cats = (hasTop ? ['top'] : []).concat(['all'], Object.keys(CAT).filter((k) => all.some((n) => n.category === k)));
    U.$('#news-controls').appendChild(U.seg('Show', cats.map((k) => ({ v: k, t: k === 'all' ? 'All ' + all.length : k === 'top' ? 'Biggest' : CAT[k].t })), st.cat, (v) => { st.cat = v; st.n = 12; draw(); }));
    const more = U.$('#news-more');
    more.addEventListener('click', () => { st.n += 12; draw(); });
    const entCache = new Map();
    function globeLink(n) {
      if (!U.model.findEntity || !U.globe || !U.globe.focus) return null;
      if (!entCache.has(n)) entCache.set(n, U.model.findEntity([n.title].concat(n.entities || []).join(' | ')));
      const ref = entCache.get(n); if (!ref) return null;
      const b = U.el('button', { type: 'button', class: 'linkbtn', text: 'Show ' + ref.name + ' on the globe' });
      b.addEventListener('click', () => { if (U.globe.focus(ref)) document.getElementById('atlas').scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth' }); });
      return b;
    }
    function draw() {
      U.clear(list);
      const rows = all.filter((n) => st.cat === 'all' || (st.cat === 'top' ? n.importance >= 4 : n.category === st.cat));
      rows.slice(0, st.n).forEach((n) => {
        const cat = CAT[n.category] || { t: n.category || 'News', c: '--ink-3' };
        const url = safeUrl(n.url);
        const title = url ? U.el('a', { class: 'news__title', href: url, target: '_blank', rel: 'noopener noreferrer', text: n.title }) : U.el('span', { class: 'news__title', text: n.title });
        list.appendChild(U.el('article', { class: 'news__item' },
          U.el('time', { class: 'news__date', datetime: n.date, text: U.day(n.date) }),
          U.el('div', null, title,
            n.summary ? U.el('p', { class: 'news__sum', text: n.summary }) : null,
            U.el('div', { class: 'news__meta' },
              U.el('span', { class: 'tag' }, U.el('i', { style: { '--c': 'var(' + cat.c + ')' } }), cat.t),
              n.source ? U.el('span', { text: n.source }) : null,
              n.region ? U.el('span', { text: n.region }) : null,
              globeLink(n)))));
      });
      more.hidden = rows.length <= st.n;
      if (!rows.length) list.appendChild(U.el('p', { class: 'empty', text: 'Nothing under this topic in the current issue.' }));
    }
    draw();
  }

  function filings() {
    const list = U.$('#filings-list'), all = (U.data.filings || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!list) return;
    if (!all.length) { list.appendChild(U.el('p', { class: 'empty', text: 'No filings in this issue yet.' })); U.$('#filings-more').hidden = true; return; }
    const st = { co: 'all', form: 'all', n: 14 };
    const cos = Array.from(new Set(all.map((f) => f.company))).sort();
    const sel = U.el('select', { class: 'select', id: 'filings-company', 'aria-label': 'Company' }, U.el('option', { value: 'all', text: 'All companies' }), cos.map((c) => U.el('option', { value: c, text: c })));
    sel.addEventListener('change', () => { st.co = sel.value; st.n = 14; draw(); });
    const group = (f) => { const k = String(f.form || '').toUpperCase(); return /^10-K|^40-F|^20-F/.test(k) ? 'annual' : /^10-Q/.test(k) ? 'quarterly' : /^8-K|^6-K/.test(k) ? 'current' : 'other'; };
    const present = new Set(all.map(group));
    const formOpts = [{ v: 'all', t: 'All' }, { v: 'annual', t: 'Annual' }, { v: 'quarterly', t: 'Quarterly' }, { v: 'current', t: 'Current' }, { v: 'other', t: 'Other' }].filter((o) => o.v === 'all' || present.has(o.v));
    const ctl = U.$('#filings-controls');
    ctl.appendChild(U.el('div', { class: 'control' }, sel));
    ctl.appendChild(U.seg('Form', formOpts, st.form, (v) => { st.form = v; st.n = 14; draw(); }));
    const chip = (f) => { const k = String(f.form || ''); if (k && k.length <= 8) return k; const v = String(f.venue || ''); return /ASX/i.test(v) ? 'ASX' : /LSE|RNS/i.test(v) ? 'RNS' : /SEDAR/i.test(v) ? 'SEDAR+' : /HKEX/i.test(v) ? 'HKEX' : /AIX|KASE/i.test(v) ? 'AIX' : 'Update'; };
    const more = U.$('#filings-more');
    more.addEventListener('click', () => { st.n += 14; draw(); });
    function draw() {
      U.clear(list);
      const rows = all.filter((f) => (st.co === 'all' || f.company === st.co) && (st.form === 'all' || group(f) === st.form));
      rows.slice(0, st.n).forEach((f) => {
        const url = safeUrl(f.url);
        const name = (f.ticker ? f.ticker + ' · ' : '') + f.company;
        list.appendChild(U.el('div', { class: 'filing' },
          U.el('time', { class: 'news__date', datetime: f.date, text: U.day(f.date), style: { paddingTop: '0' } }),
          U.el('span', { class: 'filing__form', title: f.form || null, text: chip(f) }),
          url ? U.el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: name }) : U.el('span', { text: name }),
          U.el('div', { class: 'filing__d', text: [f.title && f.summary ? f.title.replace(/^[A-Z0-9-]+(\/A)?:\s*/, '') + '.' : null, f.summary || f.title || f.items || ''].filter(Boolean).join(' ') })));
      });
      more.hidden = rows.length <= st.n;
      if (!rows.length) list.appendChild(U.el('p', { class: 'empty', text: 'No filings match.' }));
    }
    draw();
  }
})();
