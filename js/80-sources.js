/* Sources and method: how the numbers are built, and the catalogue of where they come from. */
(function () {
  'use strict';
  const U = window.U;
  U.sources = { init };
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : null);

  function init() {
    const M = U.model, meta = U.data.meta || {};
    const method = U.$('#method');
    if (method) {
      const f = M.TYPE_F;
      const blocks = [
        ['Reactor demand', 'Each reactor is given an annual uranium need from its net capacity, an ' + Math.round(M.CF_DEFAULT * 100) + '% capacity factor and a factor for its design: ' + f.PWR + ' tU per GWe-year for light-water reactors, ' + f.PHWR + ' for heavy-water, ' + f.GCR + ' for gas-cooled, ' + f.LWGR + ' for RBMK. Each country is then scaled to the World Nuclear Association’s published requirement. A new reactor’s first core is counted as ' + (1 + M.firstCoreMultiple) + ' years of fuel, booked the year before it connects.'],
        ['Mine supply', 'Reported production is used wherever a mine has published it, on a 100% basis. Beyond the last reported year, operating mines hold at company guidance or their latest output. Restarts and new mines begin in the stated year and ramp in a straight line to their planned output. Low and high cases use the late and early ends of each project’s range. Mines not listed individually are held flat at the gap to the published world total.'],
        ['What this is not', 'Nothing here is a forecast of price. The balance figure is arithmetic on public plans, and plans slip. Inventories, enrichment tails, and contract terms all move the real market and are only partly visible in public data. Where a number is an estimate it is marked as one in the tables.'],
      ];
      blocks.forEach(([h, p]) => method.appendChild(U.el('div', null, U.el('h3', { text: h }), U.el('p', { text: p }))));
      blocks.length = 0;
      method.appendChild(U.el('div', null, U.el('h3', { text: 'Credits and licences' }), U.el('p', { text: 'Reactor data: IAEA PRIS and the World Nuclear Association, with coordinates derived from GeoNuclearData under the Open Database License; the reactor file on this site is offered under the same licence. Country production history and demand ranges: OECD-NEA and IAEA Red Book, CC BY 4.0. US contracts, inventories, origins and prices paid: US Energy Information Administration. Monthly price: International Monetary Fund, Primary Commodity Price System. Map outlines: Natural Earth.' })));
      if (meta.as_of) method.appendChild(U.el('div', null, U.el('h3', { text: 'This issue' }), U.el('p', { text: 'Data collected ' + U.dayLong(meta.as_of) + '. ' + (meta.note || 'The page is rebuilt from the source files once a month.') })));
    }

    const host = U.$('#sources-table'), list = U.data.sources;
    if (!host) return;
    if (!list || !list.length) { host.appendChild(U.el('p', { class: 'empty', style: { padding: '16px' }, text: 'The source catalogue is being compiled.' })); return; }
    const st = { feeds: 'all' };
    const REUSE = { 'ok-with-attribution': 'Yes, with credit', 'non-commercial-only': 'Non-commercial only', restricted: 'Restricted', unclear: 'Terms unclear' };
    const FEED = { reactors: 'Reactors', generation: 'Generation', outlook: 'Outlooks', filings: 'Filings', mines: 'Mines', enrichment_conversion: 'Enrichment and conversion', trade_flows: 'Trade flows', prices: 'Prices', inventories: 'Inventories', news: 'News', funds: 'Funds' };
    const feeds = Array.from(new Set(list.flatMap((s) => [].concat(s.feeds || [])))).filter(Boolean).sort();
    if (feeds.length > 1) {
      const sel = U.el('select', { class: 'select', id: 'sources-filter', 'aria-label': 'Filter sources by what they feed' }, U.el('option', { value: 'all', text: 'All sources (' + list.length + ')' }), feeds.map((f) => U.el('option', { value: f, text: FEED[f] || f })));
      sel.addEventListener('change', () => { st.feeds = sel.value; draw(); });
      U.$('#sources-controls').appendChild(U.el('div', { class: 'control' }, U.el('span', { class: 'label', text: 'Used for' }), sel));
    }
    function draw() {
      const rows = list.filter((s) => st.feeds === 'all' || [].concat(s.feeds || []).includes(st.feeds));
      U.table(host, [
        { k: 'name', t: 'Source', l: true, f: (v, r) => { const u = safeUrl(r.url); return u ? U.el('a', { href: u, target: '_blank', rel: 'noopener noreferrer', text: v }) : v; } },
        { k: 'provides', t: 'What it gives', l: true, f: (v) => v || '–' },
        { k: 'format', t: 'Format', l: true, f: (v) => v || '–' },
        { k: 'cadence', t: 'Updated', l: true, f: (v) => v || '–' },
        { k: 'cost', t: 'Cost', l: true, f: (v) => v || '–' },
        { k: 'reuse', t: 'Reuse', l: true, f: (v) => REUSE[v] || v || '–' },
      ], rows, 'src-table');
    }
    draw();
  }
})();
