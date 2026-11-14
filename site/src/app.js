/* Backtest pages: redraw the pre-rendered charts at the real width, hover readouts, period switch,
   the trade log (loaded per year on demand) and the combine tool. All numbers come from FFCore,
   the same code the build used for the static HTML. */
(function () {
  const C = window.FFCore, Ch = window.FFCharts, base = document.body.dataset.base;
  if (!C || !Ch || !base) return;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const tone = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let seriesP;
  const getSeries = () => seriesP || (seriesP = fetch(base + 'data/series.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));

  /* ---------- analytics: the same dataLayer event shape fintrens-home's www.js pushes ---------- */
  const track = (name, params) => { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name, page_kind: document.body.dataset.kind || '', page_path: location.pathname }, params || {})); };
  document.addEventListener('click', e => { const a = e.target.closest('a[href*="demo-date-scheduler"]'); if (a) track('cta_demo', { label: (a.textContent || '').trim() }); });

  /* ---------- a pair of time charts (P&L on top, drawdown below) sharing one hover position ----------
     model(): { dates, lines:[{name, values, color, width}], dd:[], daily:[] }  — already cut to the visible period */
  function timeView(root, model) {
    const elEq = $('[data-chart="equity"]', root), elDd = $('[data-chart="dd"]', root), out = $('[data-readout]', root);
    let m, cEq, cDd, idle = '';
    function draw() {
      m = model(); if (!m) return;
      const w = Math.max(280, Math.floor(elEq.clientWidth)), small = w < 560;
      cEq = Ch.line({ dates: m.dates, lines: m.lines, area: m.lines.length === 1, fmt: C.inrShort, w, h: small ? 250 : 360, label: 'Cumulative profit and loss' });
      cDd = Ch.underwater({ dates: m.dates, values: m.dd, w, h: small ? 140 : 180 });
      elEq.innerHTML = cEq.svg + '<i class="cross"></i>'; elDd.innerHTML = cDd.svg + '<i class="cross"></i>';
      const net = m.lines[0].values[m.lines[0].values.length - 1];
      idle = `${C.fmtDate(m.dates[0])} – ${C.fmtDate(m.dates[m.dates.length - 1])} · <b class="${tone(net)}">${C.inr(net)}</b>`;
      out.innerHTML = idle;
    }
    function hover(e, el, c) {
      const r = el.getBoundingClientRect(), pw = c.w - c.m.l - c.m.r;
      const i = Math.max(0, Math.min(c.n - 1, Math.round(((e.clientX - r.left) - c.m.l) / pw * (c.n - 1))));
      for (const [x, ch] of [[elEq, cEq], [elDd, cDd]]) { const k = $('.cross', x); k.style.left = ch.x(i) + 'px'; k.style.display = 'block'; }
      const parts = [C.fmtDate(m.dates[i]), `day <b class="${tone(m.daily[i])}">${C.inr(m.daily[i])}</b>`];
      m.lines.forEach(l => parts.push(`${m.lines.length > 1 ? `<i style="background:${l.color}"></i>${esc(l.name)} ` : 'total '}<b class="${tone(l.values[i])}">${C.inr(l.values[i])}</b>`));
      parts.push(`drawdown <b class="${m.dd[i] < 0 ? 'neg' : ''}">${C.pct(m.dd[i])}</b>`);
      out.innerHTML = parts.join(' · ');
    }
    const leave = () => { $$('.cross', root).forEach(k => (k.style.display = 'none')); out.innerHTML = idle; };
    for (const [el, get] of [[elEq, () => cEq], [elDd, () => cDd]]) {
      el.addEventListener('pointermove', e => get() && hover(e, el, get()));
      el.addEventListener('pointerdown', e => get() && hover(e, el, get()));
      el.addEventListener('pointerleave', leave);
    }
    let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(draw, 80); }).observe(elEq);
    return { draw };
  }

  /* ---------- strategy page ---------- */
  const strat = $('[data-strategy]');
  if (strat) getSeries().then(d => {
    const s = d.strategies.find(x => x.id === strat.dataset.strategy); if (!s) return;
    const a = C.analyse(s); let range = 0;
    const view = timeView(strat, () => {
      const from = range ? Math.max(0, a.dates.length - range) : 0, b = from ? a.equity[from - 1] : 0;
      return { dates: a.dates.slice(from), dd: a.dd.slice(from), daily: s.days.slice(from), lines: [{ name: s.name, values: a.equity.slice(from).map(v => v - b), color: Ch.COLORS[0] }] };
    });
    $$('[data-range] button', strat).forEach(btn => btn.addEventListener('click', () => {
      range = +btn.dataset.r; $$('[data-range] button', strat).forEach(x => x.classList.toggle('on', x === btn)); view.draw();
    }));
    view.draw();
  }).catch(() => {});

  /* ---------- trade log ---------- */
  const MONC = '123456789OND';
  function instrument(s) {
    let m = s.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/);
    if (m) return `${m[1]} ${+m[4]} ${C.MON[MONC.indexOf(m[3])]} ${m[5]} ${m[6]}`;
    m = s.match(/^([A-Z]+?)(\d{2})([A-Za-z]{3})(\d+)(CE|PE)$/);
    return m ? `${m[1]} ${m[3][0].toUpperCase() + m[3].slice(1).toLowerCase()} '${m[2]} ${m[4]} ${m[5]}` : s;
  }
  const log = $('[data-trades]');
  if (log) {
    const id = log.dataset.trades, years = log.dataset.years.split(','), tbody = $('[data-tbody]', log), pager = $('[data-pager]', log);
    const cache = {}, PER = 50; let rows = [], page = 0;
    const dt = (d, t) => `${C.fmtDate(d)}<small>${t.slice(0, 5)}</small>`;
    function render() {
      const pages = Math.ceil(rows.length / PER);
      tbody.innerHTML = rows.slice(page * PER, page * PER + PER).map(t => `<tr><td class="num">${dt(t.xd, t.xt)}</td><td class="num">${dt(t.ed, t.et)}</td><td>${t.legs.map(l => `<div class="leg"><span class="side ${l.side === 'BUY' ? 'b' : 's'}">${esc(l.side)}</span><span class="num">${esc(instrument(l.inst))}</span><span class="num px">${(+l.ep).toFixed(2)} → ${(+l.xp).toFixed(2)}</span></div>`).join('')}</td><td class="num r ${tone(t.pts)}">${t.pts.toFixed(2)}</td><td class="num r ${tone(t.pnl)}"><b>${C.inr(t.pnl)}</b></td></tr>`).join('');
      pager.hidden = pages < 2; $('[data-page]', pager).textContent = `${page + 1} / ${pages} · ${rows.length.toLocaleString('en-IN')} trades`;
      $('[data-prev]', pager).disabled = page === 0; $('[data-next]', pager).disabled = page >= pages - 1;
    }
    function load(y) {
      $$('[data-years-seg] button', log).forEach(b => b.classList.toggle('on', b.dataset.y === y));
      tbody.innerHTML = '<tr><td colspan="5" class="na">Loading trades…</td></tr>';
      (cache[y] || (cache[y] = fetch(`${base}data/${id}/trades-${y}.csv`).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(txt => {
        const L = txt.trim().split('\n'), h = L[0].split(','), ix = Object.fromEntries(h.map((k, i) => [k, i])), map = new Map();
        for (const line of L.slice(1)) {
          const c = line.split(','), k = c[ix.trade];
          if (!map.has(k)) map.set(k, { legs: [], pnl: 0, pts: 0, xd: '', xt: '', ed: c[ix.entry_date], et: c[ix.entry_time] });
          const t = map.get(k);
          t.legs.push({ inst: c[ix.instrument], side: c[ix.side], ep: c[ix.entry_price], xp: c[ix.exit_price] });
          t.pnl += +c[ix.pnl] || 0; t.pts += +c[ix.points] || 0;
          if (c[ix.exit_date] + c[ix.exit_time] > t.xd + t.xt) { t.xd = c[ix.exit_date]; t.xt = c[ix.exit_time]; }
          if (c[ix.entry_date] + c[ix.entry_time] < t.ed + t.et) { t.ed = c[ix.entry_date]; t.et = c[ix.entry_time]; }
        }
        return [...map.values()].reverse(); // newest first
      }))).then(r => { rows = r; page = 0; render(); }).catch(() => { tbody.innerHTML = '<tr><td colspan="5" class="na">Could not load the trades. Please try again.</td></tr>'; });
    }
    $$('[data-years-seg] button', log).forEach(b => b.addEventListener('click', () => load(b.dataset.y)));
    $('[data-prev]', pager).addEventListener('click', () => { page--; render(); log.scrollIntoView({ block: 'start' }); });
    $('[data-next]', pager).addEventListener('click', () => { page++; render(); log.scrollIntoView({ block: 'start' }); });
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); load(years[years.length - 1]); } }, { rootMargin: '300px' });
    io.observe(log);
  }

  /* ---------- combine tool ---------- */
  const comb = $('[data-combine]');
  if (comb) getSeries().then(d => {
    const all = d.strategies, state = {}; all.forEach(s => (state[s.id] = { on: true, mult: 1 }));
    const color = id => Ch.COLORS[all.findIndex(s => s.id === id) % Ch.COLORS.length];
    const q = new URLSearchParams(location.search).get('mix');
    if (q) { all.forEach(s => (state[s.id].on = false)); q.split(',').forEach(p => { const [id, m] = p.split(':'); if (state[id]) { state[id].on = true; state[id].mult = Math.min(10, Math.max(0.5, Math.round((+m || 1) * 2) / 2)); } }); }
    const scaled = s => ({ start: s.start, capital: s.capital * state[s.id].mult, days: s.days.map(v => v * state[s.id].mult) });
    let current = null;
    const view = timeView(comb, () => current);
    const kpi = (l, v, c) => `<div class="kpi"><dt>${l}</dt><dd class="num ${c || ''}">${v}</dd></div>`;

    function update(push) {
      const picked = all.filter(s => state[s.id].on);
      $$('.pick[data-id]', comb).forEach(p => {
        const st = state[p.dataset.id], s = all.find(x => x.id === p.dataset.id);
        $('[data-on]', p).checked = st.on; p.classList.toggle('off', !st.on);
        $('[data-mult]', p).textContent = st.mult + '×'; $('[data-cap]', p).textContent = C.inrShort(s.capital * st.mult);
        $('[data-dec]', p).disabled = !st.on || st.mult <= 0.5; $('[data-inc]', p).disabled = !st.on || st.mult >= 10;
      });
      if (push) { const mix = picked.map(s => s.id + ':' + state[s.id].mult).join(','); history.replaceState(null, '', location.pathname + (mix ? '?mix=' + mix : '') + '#combine'); }
      const res = $('.result', comb); res.classList.toggle('empty', !picked.length);
      if (!picked.length) { $('[data-total]', comb).textContent = '₹0'; return; }
      const parts = picked.map(scaled), combo = C.combine(parts.map(p => ({ series: p, weight: 1 }))), ca = C.analyse(combo);
      $('[data-total]', comb).textContent = C.inrShort(combo.capital);
      $('[data-ckpis]', comb).innerHTML = kpi('Net profit', C.inrShort(ca.net), tone(ca.net)) + kpi('Total return', C.signPct(ca.ret, 1), tone(ca.ret)) + kpi('CAGR', C.pct(ca.cagr, 1)) + kpi('Max drawdown', C.pct(ca.maxDD), 'neg') + kpi('Sharpe', ca.sharpe.toFixed(2));
      const each = picked.map((s, i) => ({ s, a: C.analyse(parts[i]), off: C.dayIndex(combo.start, s.start) }));
      const lines = [{ name: picked.length > 1 ? 'Combined' : picked[0].name, values: ca.equity, color: picked.length > 1 ? '#12211E' : color(picked[0].id), width: picked.length > 1 ? 2.4 : 1.8 }];
      if (picked.length > 1) each.forEach(e => { let last = 0; lines.push({ name: e.s.name, color: color(e.s.id), width: 1.3, values: ca.dates.map((_, k) => (k - e.off >= 0 && k - e.off < e.a.equity.length ? (last = e.a.equity[k - e.off]) : last)) }); });
      current = { dates: ca.dates, lines, dd: ca.dd, daily: combo.days };
      $('[data-legend]', comb).innerHTML = lines.map(l => `<li><i style="background:${l.color}"></i>${esc(l.name)}</li>`).join('');
      view.draw();
      const tr = (name, a, cls) => `<tr class="${cls || ''}"><th scope="row">${esc(name)}</th><td>${C.inrShort(a.capital)}</td><td class="${tone(a.net)}">${C.inrShort(a.net)}</td><td class="${tone(a.ret)}">${C.signPct(a.ret, 1)}</td><td>${C.pct(a.cagr, 1)}</td><td class="neg">${C.pct(a.maxDD)}</td><td>${a.sharpe.toFixed(2)}</td><td>${a.calmar.toFixed(2)}</td><td class="${tone(a.worstMonth.pnl)}">${C.signPct(a.worstMonth.pnl / a.capital, 1)}</td></tr>`;
      $('[data-ctable]', comb).innerHTML = `<table class="cmp num"><thead><tr><th></th><th>Capital</th><th>Net profit</th><th>Return</th><th>CAGR</th><th>Max DD</th><th>Sharpe</th><th>Calmar</th><th>Worst month</th></tr></thead><tbody>${each.map(e => tr(e.s.name + (state[e.s.id].mult !== 1 ? ' ' + state[e.s.id].mult + '×' : ''), e.a)).join('')}${picked.length > 1 ? tr('Combined', ca, 'sum') : ''}</tbody></table>`;
      $('[data-corr]', comb).innerHTML = picked.length < 2 ? '<p class="na">Pick two or more strategies to see how they move together.</p>'
        : `<table class="corr num"><thead><tr><th></th>${picked.map(s => `<th scope="col">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${picked.map((r, i) => `<tr><th scope="row">${esc(r.name)}</th>${picked.map((c, j) => { const v = i === j ? 1 : C.correlation(r, c); return `<td style="background:rgba(3,105,161,${(Math.abs(v) * 0.45).toFixed(2)})">${v.toFixed(2)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    }
    $$('.pick[data-id]', comb).forEach(p => {
      const st = state[p.dataset.id];
      $('[data-on]', p).addEventListener('change', e => { st.on = e.target.checked; update(true); });
      $('[data-dec]', p).addEventListener('click', () => { st.mult = Math.max(0.5, st.mult - 0.5); update(true); });
      $('[data-inc]', p).addEventListener('click', () => { st.mult = Math.min(10, st.mult + 0.5); update(true); });
    });
    update(false);
  }).catch(() => {});
})();
