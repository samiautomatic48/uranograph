/* Boot: load data, prepare the models, start each figure, wire the masthead. */
(function () {
  'use strict';
  const U = window.U;

  function safe(name, fn) { try { fn(); } catch (e) { console.error('[' + name + ']', e); } }

  function masthead() {
    const meta = U.data.meta || {};
    const name = meta.name || 'Uranograph';
    U.$$('[data-brand]').forEach((n) => { n.textContent = name; });
    const issue = meta.issue != null ? 'No. ' + String(meta.issue).padStart(2, '0') : '';
    const when = meta.issue_month ? U.month(meta.issue_month) : '';
    U.$$('[data-issue]').forEach((n) => { n.textContent = [issue, when].filter(Boolean).join(' · '); });
    U.$$('[data-issue-long]').forEach((n) => { n.textContent = [issue ? 'Issue ' + issue : '', when, meta.as_of ? 'Data as of ' + U.dayLong(meta.as_of) : ''].filter(Boolean).join(' · '); });

    U.$$('[data-unit]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.unit === U.units.mode));
      b.addEventListener('click', () => U.setUnit(b.dataset.unit));
    });
    const tt = U.$('#theme-toggle');
    if (tt) tt.addEventListener('click', () => {
      const next = U.isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      U.store.set('theme', next);
    });

    // scroll spy
    const links = U.$$('.nav a');
    const byId = {}; links.forEach((a) => { byId[a.getAttribute('href').slice(1)] = a; });
    if (window.IntersectionObserver) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting && byId[en.target.id]) { links.forEach((a) => a.removeAttribute('aria-current')); byId[en.target.id].setAttribute('aria-current', 'true'); } });
      }, { rootMargin: '-35% 0px -60% 0px' });
      Object.keys(byId).forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  // honour a saved theme choice only on the standalone site (an embedding host sets data-theme itself)
  const saved = U.store.get('theme');
  if ((saved === 'dark' || saved === 'light') && !document.documentElement.hasAttribute('data-theme')) document.documentElement.setAttribute('data-theme', saved);

  // entrance animation only when the page is actually on screen at load; otherwise everything is simply visible
  if (document.visibilityState === 'visible' && !U.reducedMotion()) document.documentElement.setAttribute('data-anim', '1');

  U.load().then(() => {
    safe('model', () => U.model.prepare());
    safe('masthead', masthead);
    ['globe', 'split', 'balance', 'fleet', 'mines', 'price', 'market', 'scale', 'wire', 'sources'].forEach((k) => {
      if (U[k] && U[k].init) safe(k, () => U[k].init());
    });
    document.documentElement.setAttribute('data-ready', '1');
  });
})();
