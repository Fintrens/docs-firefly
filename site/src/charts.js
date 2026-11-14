/* Dependency-free SVG charts, returned as strings so the build can pre-render them into the HTML
   (visible without JavaScript, good for LCP and crawlers) and the page can redraw them at any width. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.FFCharts = factory(root.FFCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  const COLORS = ['#0369A1', '#B0711C', '#157F5B', '#7A4FB5', '#BE3A3A', '#3F7C85'];
  const r1 = v => Math.round(v * 10) / 10;

  function niceTicks(lo, hi, n) {
    if (lo === hi) { hi = lo + 1; }
    const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
    const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    return out;
  }
  function xTicks(dates, w) {
    const out = [], spanYears = dates.length / 260, wantMonths = spanYears < 1.6;
    const every = wantMonths ? Math.max(1, Math.ceil((dates.length / 21) / Math.max(2, Math.floor(w / 90)))) : Math.max(1, Math.ceil(spanYears / Math.max(2, Math.floor(w / 80))));
    let last = null, count = 0;
    dates.forEach((d, i) => {
      const k = wantMonths ? d.slice(0, 7) : d.slice(0, 4);
      if (k !== last) { if (last !== null || i === 0) { if (count % every === 0 && i > 0) out.push({ i, label: wantMonths ? C.MON[+d.slice(5, 7) - 1] + " '" + d.slice(2, 4) : k }); count++; } last = k; }
    });
    return out;
  }
  const path = (vals, x, y) => vals.map((v, i) => (i ? 'L' : 'M') + r1(x(i)) + ' ' + r1(y(v))).join('');

  /** Multi-line time chart. opts: {dates, lines:[{values,color,width,name,dash}], w, h, fmt, area, zero, min, max, label} */
  function line(o) {
    const w = o.w || 960, h = o.h || 340, m = { t: 12, r: 12, b: 26, l: 8 };
    const all = o.lines.flatMap(l => l.values);
    let lo = o.min !== undefined ? o.min : Math.min(0, ...all), hi = o.max !== undefined ? o.max : Math.max(0, ...all);
    if (lo === hi) hi = lo + 1;
    const pad = (hi - lo) * 0.06; if (o.max === undefined) hi += pad; if (o.min === undefined && lo < 0) lo -= pad;
    const n = o.dates.length, pw = w - m.l - m.r, ph = h - m.t - m.b;
    const x = i => m.l + (n > 1 ? (i / (n - 1)) * pw : pw / 2), y = v => m.t + (1 - (v - lo) / (hi - lo)) * ph;
    const fmt = o.fmt || (v => v);
    let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${o.label || 'Chart'}" xmlns="http://www.w3.org/2000/svg">`;
    for (const t of niceTicks(lo, hi, Math.max(2, Math.round(ph / 60)))) {
      s += `<line x1="${m.l}" x2="${w - m.r}" y1="${r1(y(t))}" y2="${r1(y(t))}" class="${t === 0 ? 'ax0' : 'grid'}"/>` +
           `<text x="${m.l + 2}" y="${r1(y(t)) - 4}" class="tick">${fmt(t)}</text>`;
    }
    for (const t of xTicks(o.dates, pw)) s += `<line x1="${r1(x(t.i))}" x2="${r1(x(t.i))}" y1="${h - m.b}" y2="${h - m.b + 4}" class="grid"/><text x="${r1(x(t.i))}" y="${h - 8}" class="tick" text-anchor="middle">${t.label}</text>`;
    o.lines.forEach((l, k) => {
      const d = path(l.values, x, y), c = l.color || COLORS[k % COLORS.length];
      if (o.area && k === 0) s += `<path d="${d}L${r1(x(n - 1))} ${r1(y(Math.max(lo, 0)))}L${r1(x(0))} ${r1(y(Math.max(lo, 0)))}Z" fill="${c}" opacity=".09"/>`;
      s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${l.width || 1.8}" stroke-linejoin="round"${l.dash ? ' stroke-dasharray="4 4"' : ''}/>`;
    });
    s += '</svg>';
    return { svg: s, x, y, m, w, h, n };
  }

  /** Underwater (drawdown) chart: values are ≤ 0 fractions. */
  function underwater(o) {
    const lo = Math.min(...o.values, -0.01);
    return line({ dates: o.dates, w: o.w, h: o.h || 200, min: lo * 1.08, max: 0, fmt: v => (v * 100).toFixed(v > -0.1 && v !== 0 ? 1 : 0) + '%', area: true, label: o.label || 'Drawdown from peak equity', lines: [{ values: o.values, color: '#BE3A3A', width: 1.4 }] });
  }

  /** Tiny trend line for cards. */
  function spark(values, w = 240, h = 56) {
    const step = Math.max(1, Math.floor(values.length / 120)), v = values.filter((_, i) => i % step === 0 || i === values.length - 1);
    const lo = Math.min(0, ...v), hi = Math.max(...v, 1), x = i => (i / (v.length - 1)) * w, y = t => 2 + (1 - (t - lo) / (hi - lo)) * (h - 4);
    const d = path(v, x, y);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="spark" aria-hidden="true"><path d="${d}L${w} ${h}L0 ${h}Z" fill="#0369A1" opacity=".1"/><path d="${d}" fill="none" stroke="#0369A1" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
  }

  /** Vertical bars (yearly returns). items: [{label, value}] where value is a fraction. */
  function bars(o) {
    const w = o.w || 480, h = o.h || 220, m = { t: 18, r: 8, b: 24, l: 8 }, it = o.items;
    const lo = Math.min(0, ...it.map(i => i.value)), hi = Math.max(0, ...it.map(i => i.value)) || 1;
    const ph = h - m.t - m.b, bw = (w - m.l - m.r) / it.length, y = v => m.t + (1 - (v - lo) / (hi - lo)) * ph;
    let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${o.label || 'Bar chart'}" xmlns="http://www.w3.org/2000/svg"><line x1="${m.l}" x2="${w - m.r}" y1="${r1(y(0))}" y2="${r1(y(0))}" class="ax0"/>`;
    it.forEach((b, i) => {
      const x = m.l + i * bw + bw * 0.18, bh = Math.abs(y(b.value) - y(0)), top = b.value >= 0 ? y(b.value) : y(0);
      s += `<rect x="${r1(x)}" y="${r1(top)}" width="${r1(bw * 0.64)}" height="${r1(Math.max(bh, 1))}" rx="3" fill="${b.value >= 0 ? '#157F5B' : '#BE3A3A'}"/>` +
           `<text x="${r1(x + bw * 0.32)}" y="${r1(b.value >= 0 ? top - 5 : top + bh + 12)}" class="tick val" text-anchor="middle">${C.signPct(b.value, 1)}</text>` +
           `<text x="${r1(x + bw * 0.32)}" y="${h - 6}" class="tick" text-anchor="middle">${b.label}</text>`;
    });
    return s + '</svg>';
  }

  /** Heat colour for a monthly return (fraction): green for gains, red for losses, scaled to `scale`. */
  function heat(v, scale) {
    if (!v) return 'transparent';
    const t = Math.min(1, Math.abs(v) / scale), a = (0.12 + t * 0.6).toFixed(2);
    return v > 0 ? `rgba(21,127,91,${a})` : `rgba(190,58,58,${a})`;
  }

  return { COLORS, line, underwater, spark, bars, heat };
});
