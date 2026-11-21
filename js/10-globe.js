/* FIG. 01 — the globe. Canvas 2D, orthographic. Land is stippled; every reactor site and mine is a spike
   whose height is the square root of the uranium it needs or ships in the selected year. */
(function () {
  'use strict';
  const U = window.U;
  const RAD = Math.PI / 180;
  const K_SPIKE = 0.0046;          // spike height (in globe radii) per sqrt(tU/yr)
  const YEAR_MIN = 1956;

  U.globe = { init };

  function init() {
    const host = U.$('#globe'), canvas = U.$('#globe-canvas');
    if (!host || !canvas || !U.data.reactors) return;
    const ctx = canvas.getContext('2d');
    const M = U.model;
    const yearInput = U.$('#scrub-year');
    yearInput.min = YEAR_MIN; yearInput.max = M.horizon; yearInput.value = M.nowYear;

    const S = {
      lon: 58, lat: 26, vlon: 0, vlat: 0,
      year: M.nowYear, playing: false,
      w: 0, h: 0, dpr: 1, R: 0, cx: 0, cy: 0,
      hover: null, pinned: null, dragging: false, touched: false, visible: true,
      auto: !U.reducedMotion(), tween: null, dirty: true,
    };

    /* ----- items ----- */
    const items = [];
    M.sites.forEach((s) => items.push({ kind: 'reactor', ref: s, lat: s.lat, lon: s.lon, vec: vec(s.lat, s.lon), cur: [0, 0, 0, 0], tgt: [0, 0, 0, 0] }));
    (U.data.mines || []).forEach((m) => { if (m.lat != null && m.lon != null) items.push({ kind: 'mine', ref: m, lat: m.lat, lon: m.lon, vec: vec(m.lat, m.lon), cur: [0, 0], tgt: [0, 0] }); });
    function vec(lat, lon) { const p = lat * RAD, l = lon * RAD; return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]; }

    /* ----- land stipple: rasterise land once, sample a Fibonacci sphere ----- */
    let dots = new Float32Array(0), landFeature = null;
    (function buildLand() {
      const world = U.data.world; if (!world || !window.topojson) return;
      const obj = world.objects.land || world.objects.countries;
      landFeature = topojson.feature(world, obj);
      const W = 1440, H = 720, off = document.createElement('canvas'); off.width = W; off.height = H;
      const c = off.getContext('2d', { willReadFrequently: true });
      const proj = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
      c.fillStyle = '#fff'; c.beginPath(); d3.geoPath(proj, c)(landFeature); c.fill();
      const px = c.getImageData(0, 0, W, H).data;
      const N = 26000, out = [], golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const z = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - z * z), th = golden * i;
        const lat = Math.asin(z) / RAD; let lon = ((th / RAD) % 360 + 540) % 360 - 180;
        if (lat < -62) continue; // leave Antarctica off; nothing is mined or burned there
        const ix = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
        const iy = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
        if (px[(iy * W + ix) * 4 + 3] > 127) out.push(r * Math.cos(lon * RAD), r * Math.sin(lon * RAD), z);
      }
      dots = new Float32Array(out);
    })();

    /* ----- targets for a year ----- */
    function setYear(y, immediate) {
      S.year = y;
      let need = 0, units = 0, mw = 0, cores = 0;
      items.forEach((it) => {
        if (it.kind === 'reactor') {
          let op = 0, idle = 0, con = 0, pl = 0;
          it.ref.units.forEach((u) => {
            const st = M.unitState(u, y);
            if (st === 'operating') { op += u.req; need += u.req; units++; mw += u.mw || 0; }
            else if (st === 'idle') idle += u.req;
            else if (st === 'construction') con += u.req;
            else if (st === 'planned') pl += u.req;
            if (u.y0 === y + 1 && u.r0 == null && y >= M.nowYear - 1) cores += u.req * M.firstCoreMultiple;
          });
          it.tgt = [op, idle, con, pl];
        } else {
          const r = M.mineOutput(it.ref, y);
          const v = r.v || 0;
          const projected = !r.actual && M.bucketOf(it.ref) !== 'operating';
          it.tgt = projected ? [0, v] : [v, 0];
          it.est = !r.actual;
        }
        if (immediate) it.cur = it.tgt.slice();
      });
      const sup = supplyFor(y);
      readout(y, need + cores, units, mw, sup);
      S.dirty = true; kick();
    }
    function supplyFor(y) {
      const firstMineYear = M.firstMineYear || (M.firstMineYear = d3.min(U.data.mines || [], (m) => d3.min(Object.keys(m.production_tu || {}), Number)) || M.nowYear);
      if (M.worldProd[y] != null) return { tu: M.worldProd[y], note: 'World mine output, actual', mines: null };
      if (y < firstMineYear) return { tu: null, note: 'No mine data this early' };
      const s = M.supply(y, {});
      return { tu: s.total, note: y > M.lastActualYear ? 'Modelled from guidance and project schedules' : 'Sum of listed mines', mines: s.mines };
    }
    function readout(y, need, units, mw, sup) {
      U.$('#ro-year').textContent = y;
      U.$('#ro-tag').textContent = y === M.nowYear ? 'Today' : y < M.nowYear ? 'History' : 'Projected from firm plans';
      setValue('#ro-demand', need);
      U.$('#ro-demand-n').textContent = U.n(units) + ' reactors running · ' + U.n(mw / 1000) + ' GWe';
      setValue('#ro-supply', sup.tu);
      U.$('#ro-supply-n').textContent = sup.note;
      const cover = sup.tu != null && need > 0 ? sup.tu / need : null;
      U.$('#ro-cover').textContent = cover == null ? '–' : U.pct(cover);
      U.$('#ro-cover-bar').style.width = cover == null ? '0%' : Math.min(100, cover * 100) + '%';
      yearInput.setAttribute('aria-valuetext', y + ': reactors need ' + U.fmtUu(need) + (sup.tu != null ? ', mines produce ' + U.fmtUu(sup.tu) : ''));
    }
    function setValue(sel, tu) {
      const node = U.clear(U.$(sel));
      node.appendChild(document.createTextNode(U.fmtU(tu)));
      if (tu != null) node.appendChild(U.el('small', { text: U.unitShort() + '/yr' }));
    }

    let ready = false;
    /* ----- sizing ----- */
    function resize() {
      const r = canvas.getBoundingClientRect(), hr = host.getBoundingClientRect();
      S.dpr = Math.min(2, window.devicePixelRatio || 1);
      S.w = Math.max(10, r.width); S.h = Math.max(10, r.height);
      canvas.width = Math.round(S.w * S.dpr); canvas.height = Math.round(S.h * S.dpr);
      S.R = Math.min(hr.width, hr.height) * 0.43; S.cx = S.w / 2; S.cy = S.h / 2 + S.R * 0.05;
      S.dirty = true; kick();
      if (ready) { try { draw(); } catch (e) { /* first paint is best effort */ } }
    }

    /* ----- drawing ----- */
    const proj = d3.geoOrthographic().clipAngle(90).precision(0.6);
    const path = d3.geoPath(proj, ctx);
    const grat = d3.geoGraticule().step([30, 30])();
    function col(name) { return U.css(name); }

    function draw() {
      const { w, h, dpr, R, cx, cy } = S;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cl = Math.cos(S.lon * RAD), sl = Math.sin(S.lon * RAD), cp = Math.cos(S.lat * RAD), sp = Math.sin(S.lat * RAD);
      const cDemand = col('--glow-demand'), cSupply = col('--glow-supply'), cInk = col('--plate-ink'), cRule = col('--plate-rule');

      // project items
      const front = [], back = [];
      for (const it of items) {
        const [X, Y, Z] = it.vec;
        const x = -sl * X + cl * Y, y = -sp * cl * X - sp * sl * Y + cp * Z, z = cp * cl * X + cp * sl * Y + sp * Z;
        it.sx = cx + R * x; it.sy = cy - R * y; it.z = z; it.dx = x; it.dy = -y;
        const total = it.cur.reduce((a, b) => a + b, 0);
        it.total = total;
        if (total < 0.5) { it.vis = false; continue; }
        it.vis = true;
        if (z >= 0) front.push(it); else back.push(it);
      }

      // spikes on the far side that reach past the limb
      ctx.globalCompositeOperation = 'lighter';
      for (const it of back) spike(it, true, cDemand, cSupply, cInk);
      ctx.globalCompositeOperation = 'source-over';

      // sphere
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = col('--plate-2'); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = cRule; ctx.stroke();

      proj.rotate([-S.lon, -S.lat]).translate([cx, cy]).scale(R);
      ctx.beginPath(); path(grat); ctx.strokeStyle = cRule; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.6; ctx.stroke(); ctx.globalAlpha = 1;

      // land stipple
      const landCol = col('--plate-land');
      ctx.fillStyle = landCol;
      const ds = Math.max(1, R / 300);
      for (let i = 0; i < dots.length; i += 3) {
        const X = dots[i], Y = dots[i + 1], Z = dots[i + 2];
        const z = cp * cl * X + cp * sl * Y + sp * Z;
        if (z <= 0.02) continue;
        const x = -sl * X + cl * Y, y = -sp * cl * X - sp * sl * Y + cp * Z;
        ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, z * 1.6);
        const s = ds * (0.55 + 0.45 * z);
        ctx.fillRect(cx + R * x - s / 2, cy - R * y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      if (landFeature) { ctx.beginPath(); path(landFeature); ctx.strokeStyle = landCol; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.7; ctx.stroke(); ctx.globalAlpha = 1; }

      // near-side spikes, far to near
      front.sort((a, b) => a.z - b.z);
      ctx.globalCompositeOperation = 'lighter';
      for (const it of front) spike(it, false, cDemand, cSupply, cInk);
      ctx.globalCompositeOperation = 'source-over';

      // direct labels for the few largest spikes facing the viewer
      const cands = front.filter((it) => it.z > 0.3);
      const top = cands.filter((it) => it.kind === 'mine').sort((a, b) => b.total - a.total).slice(0, 6)
        .concat(cands.filter((it) => it.kind === 'reactor').sort((a, b) => b.cur[0] - a.cur[0]).slice(0, 4));
      const placed = [];
      ctx.font = '500 10px ' + (U.css('--f-mono') || 'monospace'); ctx.textBaseline = 'middle';
      const hlNow = S.hover || S.pinned;
      if (hlNow && hlNow.vis && hlNow.z >= 0 && !top.includes(hlNow)) top.unshift(hlNow);
      for (const it of top) {
        if (it.total < 1) continue;
        const tip = tipOf(it), len = Math.hypot(it.sx - cx, it.sy - cy) || 1;
        const nx = (it.sx - cx) / len, ny = (it.sy - cy) / len;
        const text = String(it.ref.short || it.ref.name || '').toUpperCase();
        const tw = ctx.measureText(text).width, right = nx >= 0;
        const lx = tip[0] + nx * 7 + (right ? 2 : -2), ly = tip[1] + ny * 7;
        const box = { x0: right ? lx : lx - tw, x1: right ? lx + tw : lx, y0: ly - 7, y1: ly + 7 };
        if (it !== hlNow && placed.some((b) => box.x0 < b.x1 + 4 && box.x1 > b.x0 - 4 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
        placed.push(box);
        ctx.textAlign = right ? 'left' : 'right';
        ctx.fillStyle = it === hlNow ? cInk : U.css('--plate-ink-2');
        ctx.globalAlpha = it === hlNow ? 1 : 0.9;
        ctx.fillText(text, lx, ly);
      }
      ctx.globalAlpha = 1;

      // hover / pinned highlight
      const hl = S.hover || S.pinned;
      if (hl && hl.vis && hl.z >= 0) {
        const tip = tipOf(hl);
        ctx.strokeStyle = cInk; ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(hl.sx, hl.sy); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
        ctx.beginPath(); ctx.arc(hl.sx, hl.sy, 5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    function heightOf(v) { return K_SPIKE * Math.sqrt(Math.max(0, v)); }
    function tipOf(it) { const k = 1 + heightOf(it.total); return [S.cx + (it.sx - S.cx) * k, S.cy + (it.sy - S.cy) * k]; }
    function spike(it, behind, cDemand, cSupply) {
      const { cx, cy, R } = S;
      const bx = it.sx - cx, by = it.sy - cy;
      const base = Math.hypot(bx, by);
      const color = it.kind === 'mine' ? cSupply : cDemand;
      // segments: [value, style]  style 0 solid, 1 dim, 2 dashed, 3 dotted
      const segs = it.kind === 'mine' ? [[it.cur[0], 0], [it.cur[1], 2]] : [[it.cur[0], 0], [it.cur[1], 1], [it.cur[2], 2], [it.cur[3], 3]];
      let acc = 0, k0 = 1;
      const depth = behind ? 0.5 : 0.55 + 0.45 * Math.min(1, it.z * 1.5);
      for (const [v, style] of segs) {
        if (v < 0.5) continue;
        acc += v;
        const k1 = 1 + heightOf(acc);
        let a = k0, b = k1;
        if (behind) { // only the part beyond the limb is visible
          const kLimb = base > 1e-6 ? R / base : Infinity;
          if (b <= kLimb) { k0 = k1; continue; }
          a = Math.max(a, kLimb);
        }
        const x0 = cx + bx * a, y0 = cy + by * a, x1 = cx + bx * b, y1 = cy + by * b;
        ctx.strokeStyle = style === 1 ? U.css('--plate-ink-3') : color;
        ctx.setLineDash(style === 2 ? [4, 3] : style === 3 ? [1.2, 3.2] : []);
        ctx.lineCap = style === 3 ? 'round' : 'butt';
        if (style === 0) { ctx.globalAlpha = 0.16 * depth; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
        ctx.globalAlpha = (style === 0 ? 0.95 : style === 1 ? 0.6 : 0.85) * depth;
        ctx.lineWidth = style === 0 ? 1.5 : 1.3;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        k0 = k1;
      }
      ctx.setLineDash([]);
      if (!behind) { ctx.globalAlpha = 0.9 * depth; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(it.sx, it.sy, 1.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    /* ----- loop ----- */
    let raf = 0, lastT = 0, idleSince = 0;
    function kick() { if (!raf && S.visible) raf = requestAnimationFrame(frame); }
    function frame(t) {
      raf = 0;
      const dt = Math.min(48, t - (lastT || t)); lastT = t;
      let again = false;
      // tween values toward targets
      for (const it of items) {
        for (let i = 0; i < it.cur.length; i++) {
          const d = it.tgt[i] - it.cur[i];
          if (Math.abs(d) > 0.5) { it.cur[i] += d * Math.min(1, dt / 110); again = true; } else it.cur[i] = it.tgt[i];
        }
      }
      if (S.tween) {
        const k = Math.min(1, (t - S.tween.t0) / S.tween.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        S.lon = S.tween.lon0 + S.tween.dlon * e; S.lat = S.tween.lat0 + S.tween.dlat * e;
        if (k >= 1) S.tween = null; again = true;
      } else if (!S.dragging) {
        if (Math.abs(S.vlon) > 0.002 || Math.abs(S.vlat) > 0.002) {
          S.lon += S.vlon * dt; S.lat = clampLat(S.lat + S.vlat * dt);
          const f = Math.pow(0.94, dt / 16); S.vlon *= f; S.vlat *= f; again = true;
        } else if (S.auto && !S.hover && !S.pinned && t - idleSince > 2500) {
          S.lon += dt * 0.0035; again = true;
        }
      }
      if (S.playing) again = true;
      if (again || S.dirty) { S.dirty = false; draw(); }
      if (again) kick();
    }
    const clampLat = (v) => Math.max(-65, Math.min(72, v));

    /* ----- pointer ----- */
    let last = null;
    host.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.pin')) return;
      S.dragging = true; S.tween = null; S.vlon = S.vlat = 0; host.dataset.drag = '1';
      last = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, type: e.pointerType };
      try { host.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      touched();
    });
    host.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (S.dragging && last) {
        const now = performance.now(), dx = e.clientX - last.x, dy = e.clientY - last.y, dt = Math.max(1, now - last.t);
        const k = 1 / (S.R * RAD);
        const dlon = -dx * k, dlat = last.type === 'touch' ? 0 : dy * k;
        S.lon += dlon; S.lat = clampLat(S.lat + dlat);
        S.vlon = dlon / dt; S.vlat = dlat / dt;
        last.x = e.clientX; last.y = e.clientY; last.t = now; last.moved += Math.abs(dx) + Math.abs(dy);
        U.tip.hide(); S.hover = null; S.dirty = true; kick();
        return;
      }
      if (e.pointerType === 'touch') return;
      const hit = pick(px, py);
      if (hit !== S.hover) { S.hover = hit; S.dirty = true; kick(); }
      if (hit) U.tip.show(e.clientX, e.clientY, cardFor(hit)); else U.tip.hide();
      host.style.cursor = hit ? 'pointer' : '';
    });
    const end = (e) => {
      if (!S.dragging) return;
      S.dragging = false; delete host.dataset.drag; idleSince = performance.now();
      if (last && last.moved < 6) { // a click or tap
        const r = canvas.getBoundingClientRect();
        const hit = pick(e.clientX - r.left, e.clientY - r.top);
        S.vlon = S.vlat = 0;
        pin(hit);
      }
      last = null; kick();
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
    host.addEventListener('pointerleave', () => { if (!S.dragging) { S.hover = null; U.tip.hide(); S.dirty = true; idleSince = performance.now(); kick(); } });
    host.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 20 : 6;
      if (e.key === 'ArrowLeft') S.lon -= step; else if (e.key === 'ArrowRight') S.lon += step;
      else if (e.key === 'ArrowUp') S.lat = clampLat(S.lat + step); else if (e.key === 'ArrowDown') S.lat = clampLat(S.lat - step); else return;
      e.preventDefault(); touched(); S.dirty = true; kick();
    });
    host.tabIndex = 0;
    function touched() { if (!S.touched) { S.touched = true; host.dataset.touched = '1'; } idleSince = performance.now(); }

    function pick(px, py) {
      let best = null, bestD = 13;
      for (const it of items) {
        if (!it.vis || it.z < 0) continue;
        const tip = tipOf(it);
        const d = segDist(px, py, it.sx, it.sy, tip[0], tip[1]);
        if (d < bestD) { bestD = d; best = it; }
      }
      return best;
    }
    function segDist(px, py, x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
    }

    function cardFor(it) {
      if (it.kind === 'mine') {
        const m = it.ref, r = M.mineOutput(m, S.year);
        return U.tip.card(m.name, [m.country, m.operator].filter(Boolean).join(' · '), [
          [r.actual ? 'Produced in ' + S.year : 'Modelled for ' + S.year, U.fmtUu(r.v || 0), U.css('--glow-supply')],
          m.capacity_tu ? ['Capacity', U.fmtUu(m.capacity_tu)] : null,
          ['Method', methodName(m.method)],
          ['Status', statusName(m.status)],
        ]);
      }
      const s = it.ref, c = count(s);
      return U.tip.card(s.name, s.country, [
        ['Needs in ' + S.year, U.fmtUu(it.tgt[0]), U.css('--glow-demand')],
        ['Running', c.operating + (c.operating === 1 ? ' unit · ' : ' units · ') + U.n(c.mw) + ' MWe'],
        c.construction ? ['Being built', String(c.construction)] : null,
        c.planned ? ['Planned', String(c.planned)] : null,
        c.idle ? ['Idle', String(c.idle)] : null,
      ]);
    }
    function count(s) {
      const c = { operating: 0, construction: 0, planned: 0, idle: 0, mw: 0 };
      s.units.forEach((u) => { const st = M.unitState(u, S.year); if (st) { c[st]++; if (st === 'operating') c.mw += u.mw || 0; } });
      return c;
    }
    const methodName = (m) => ({ ISR: 'In-situ recovery', underground: 'Underground', 'open-pit': 'Open pit', byproduct: 'By-product', 'heap-leach': 'Heap leach' }[m] || m || '–');
    const statusName = (s) => ({ operating: 'Operating', 'ramp-up': 'Ramping up', 'care-maintenance': 'Care and maintenance', development: 'In development', proposed: 'Proposed', closed: 'Closed' }[s] || s || '–');
    U.methodName = methodName; U.statusName = statusName;

    const pinEl = U.$('#globe-pin');
    function pin(it) {
      S.pinned = it; U.tip.hide();
      if (!it) { pinEl.hidden = true; S.dirty = true; return; }
      U.clear(pinEl);
      const close = U.el('button', { class: 'pin__x', type: 'button', 'aria-label': 'Close', text: '×' });
      close.addEventListener('click', (e) => { e.stopPropagation(); pin(null); kick(); });
      pinEl.appendChild(close);
      if (it.kind === 'mine') {
        const m = it.ref, r = M.mineOutput(m, S.year);
        pinEl.appendChild(U.el('h4', { text: m.name }));
        pinEl.appendChild(U.el('div', { class: 'label', text: [m.country, m.region].filter(Boolean).join(' · ') }));
        const dl = U.el('dl');
        const row = (k, v) => { if (v == null || v === '') return; dl.appendChild(U.el('dt', { text: k })); dl.appendChild(U.el('dd', { text: v })); };
        row('Operator', m.operator);
        row(r.actual ? 'Produced ' + S.year : 'Modelled ' + S.year, U.fmtUu(r.v || 0));
        row('Capacity', m.capacity_tu ? U.fmtUu(m.capacity_tu) : null);
        row('Method', methodName(m.method));
        row('Status', statusName(m.status));
        pinEl.appendChild(dl);
        if (m.note) pinEl.appendChild(U.el('p', { style: { marginTop: '8px', color: 'var(--plate-ink-2)', fontSize: '12px' }, text: m.note }));
      } else {
        const s = it.ref;
        pinEl.appendChild(U.el('h4', { text: s.name }));
        pinEl.appendChild(U.el('div', { class: 'label', text: s.country }));
        const ul = U.el('ul');
        s.units.slice().sort((a, b) => (a.y0 || 9999) - (b.y0 || 9999)).forEach((u) => {
          const st = M.unitState(u, S.year);
          ul.appendChild(U.el('li', null, U.el('span', { text: u.name + (u.model ? ' · ' + u.model : '') }), U.el('span', { text: (u.mw ? U.n(u.mw) + ' MWe · ' : '') + (st ? stName(st) : u.y1 && S.year >= u.y1 ? 'closed ' + u.y1 : u.y0 ? 'due ' + u.y0 : '–') })));
        });
        pinEl.appendChild(ul);
      }
      pinEl.hidden = false; S.dirty = true;
    }
    const stName = (s) => ({ operating: 'running', construction: 'being built', planned: 'planned', idle: 'idle' }[s] || s);

    /* ----- controls ----- */
    yearInput.addEventListener('input', () => { stopPlay(); touched(); setYear(+yearInput.value); drawSpark(); if (S.pinned) pin(S.pinned); });
    const playBtn = U.$('#scrub-play'), playIcon = U.$('#scrub-play-icon');
    let playTimer = 0;
    function stopPlay() { if (!S.playing) return; S.playing = false; clearInterval(playTimer); playBtn.setAttribute('aria-pressed', 'false'); playBtn.setAttribute('aria-label', 'Play through the years'); playIcon.setAttribute('d', 'M4 2.5v11l9-5.5z'); }
    playBtn.addEventListener('click', () => {
      if (S.playing) { stopPlay(); return; }
      S.playing = true; touched(); playBtn.setAttribute('aria-pressed', 'true'); playBtn.setAttribute('aria-label', 'Pause'); playIcon.setAttribute('d', 'M4 2.5h3v11H4zM9 2.5h3v11H9z');
      if (S.year >= M.horizon) { yearInput.value = YEAR_MIN; setYear(YEAR_MIN); }
      playTimer = setInterval(() => {
        const y = S.year + 1;
        if (y > M.horizon) { stopPlay(); return; }
        yearInput.value = y; setYear(y); drawSpark();
      }, 170);
      kick();
    });
    U.$$('#globe-regions button').forEach((b) => b.addEventListener('click', () => {
      U.$$('#globe-regions button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      let dlon = (+b.dataset.lon - S.lon) % 360; if (dlon > 180) dlon -= 360; if (dlon < -180) dlon += 360;
      const dur = U.reducedMotion() ? 1 : 900;
      S.tween = { t0: performance.now(), dur, lon0: S.lon, lat0: S.lat, dlon, dlat: +b.dataset.lat - S.lat };
      S.vlon = S.vlat = 0; S.auto = false; touched(); kick();
    }));

    // decade ticks under the scrubber
    const ticks = U.$('#scrub-ticks');
    [1960, 1980, 2000, 2020, 2040].forEach((y) => ticks.appendChild(U.el('span', { text: String(y) })));
    ticks.style.cssText = 'position:relative;height:14px;display:block;padding:0';
    U.$$('span', ticks).forEach((sp) => { const y = +sp.textContent; sp.style.cssText = 'position:absolute;left:calc(7px + (100% - 14px) * ' + ((y - YEAR_MIN) / (M.horizon - YEAR_MIN)).toFixed(4) + ')'; });

    /* ----- sparkline above the scrubber: demand and supply across the whole range ----- */
    const sparkCanvas = U.$('#spark-canvas'), sctx = sparkCanvas.getContext('2d');
    const series = [];
    for (let y = YEAR_MIN; y <= M.horizon; y++) { const d = M.demand(y, {}); const s = supplyFor(y); series.push({ y, d: d.tu, s: s.tu }); }
    function drawSpark() {
      const r = sparkCanvas.getBoundingClientRect(); if (!r.width) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sparkCanvas.width = Math.round(r.width * dpr); sparkCanvas.height = Math.round(r.height * dpr);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, r.width, r.height);
      const x = (y) => 7 + ((r.width - 14) * (y - YEAR_MIN)) / (M.horizon - YEAR_MIN);
      const max = d3.max(series, (p) => Math.max(p.d || 0, p.s || 0)) || 1;
      const yy = (v) => r.height - 3 - (v / max) * (r.height - 10);
      const line = (key, color) => {
        sctx.beginPath(); let pen = false;
        series.forEach((p) => { if (p[key] == null) { pen = false; return; } const X = x(p.y), Y = yy(p[key]); if (pen) sctx.lineTo(X, Y); else { sctx.moveTo(X, Y); pen = true; } });
        sctx.strokeStyle = color; sctx.lineWidth = 1.5; sctx.lineJoin = 'round'; sctx.stroke();
      };
      // "now" divider
      sctx.strokeStyle = U.css('--plate-rule'); sctx.lineWidth = 1; sctx.beginPath(); sctx.moveTo(Math.round(x(M.nowYear)) + 0.5, 4); sctx.lineTo(Math.round(x(M.nowYear)) + 0.5, r.height); sctx.stroke();
      line('s', U.css('--glow-supply')); line('d', U.css('--glow-demand'));
      const cur = series[S.year - YEAR_MIN];
      if (cur) {
        const X = x(cur.y);
        sctx.strokeStyle = U.css('--plate-ink'); sctx.globalAlpha = 0.5; sctx.beginPath(); sctx.moveTo(X, 0); sctx.lineTo(X, r.height); sctx.stroke(); sctx.globalAlpha = 1;
        [['d', '--glow-demand'], ['s', '--glow-supply']].forEach(([k, c]) => { if (cur[k] == null) return; sctx.fillStyle = U.css('--plate'); sctx.beginPath(); sctx.arc(X, yy(cur[k]), 5, 0, 7); sctx.fill(); sctx.fillStyle = U.css(c); sctx.beginPath(); sctx.arc(X, yy(cur[k]), 3.5, 0, 7); sctx.fill(); });
      }
    }

    /* ----- lifecycle ----- */
    if (window.ResizeObserver) new ResizeObserver(() => { resize(); drawSpark(); }).observe(host); else window.addEventListener('resize', () => { resize(); drawSpark(); });
    if (window.IntersectionObserver) new IntersectionObserver((es) => { S.visible = es[0].isIntersecting; if (S.visible) kick(); else stopPlay(); }).observe(host);
    U.on('units', () => { setYear(S.year, true); if (S.pinned) pin(S.pinned); });
    U.on('theme', () => { S.dirty = true; kick(); drawSpark(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastT = 0; kick(); } });

    resize(); setYear(M.nowYear, true); ready = true; draw(); drawSpark();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { S.dirty = true; kick(); });

    U.titleblock('tb-atlas', {
      fig: '01', title: 'Reactors and mines, ' + YEAR_MIN + '–' + M.horizon, unit: 'tU per year, shown as √',
      sources: [{ t: 'IAEA PRIS', url: 'https://pris-stats.iaea.org/' }, { t: 'World Nuclear Association', url: 'https://world-nuclear.org/' }, { t: 'company reports' }, { t: 'see Sources', url: '#sources' }],
    });
    U.globe.state = S; U.globe.setYear = (y) => { yearInput.value = y; setYear(y, true); drawSpark(); };
    // turn the globe to a mine or reactor site and pin it (used by the news list)
    U.globe.focus = (ref) => {
      const it = items.find((i) => i.ref === ref); if (!it) return false;
      if (it.total < 1 && S.year !== M.nowYear) { yearInput.value = M.nowYear; setYear(M.nowYear, true); drawSpark(); }
      let dlon = (it.lon - S.lon) % 360; if (dlon > 180) dlon -= 360; if (dlon < -180) dlon += 360;
      S.tween = { t0: performance.now(), dur: U.reducedMotion() ? 1 : 900, lon0: S.lon, lat0: S.lat, dlon, dlat: clampLat(it.lat * 0.8) - S.lat };
      S.vlon = S.vlat = 0; S.auto = false; touched(); pin(it); kick();
      return true;
    };
  }
})();
