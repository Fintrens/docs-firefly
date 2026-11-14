/* Backtest maths, shared by the build (Node) and the page (browser) so both always show the same numbers.
   A "series" is { start: 'YYYY-MM-DD', days: [₹ P&L booked per weekday, Mon–Fri, from start], capital: ₹ }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FFCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY = 864e5;
  const toDate = s => new Date(s + 'T00:00:00Z');
  const iso = d => d.toISOString().slice(0, 10);

  /** Dates (ISO) of the n weekdays starting at `start`. */
  function weekdays(start, n) {
    const out = []; let d = toDate(start);
    while (out.length < n) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) out.push(iso(d)); d = new Date(+d + DAY); }
    return out;
  }
  /** Index of a date in the weekday calendar starting at `start` (weekend dates fall on the next Monday). */
  function dayIndex(start, date) {
    const a = toDate(start), b = toDate(date); let n = 0;
    for (let d = a; d < b; d = new Date(+d + DAY)) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
    return n;
  }

  /** Weighted sum of several series over their common calendar. parts: [{series, weight}] */
  function combine(parts) {
    const start = parts.map(p => p.series.start).sort()[0];
    const offs = parts.map(p => dayIndex(start, p.series.start));
    const len = Math.max(...parts.map((p, i) => offs[i] + p.series.days.length));
    const days = new Array(len).fill(0); let capital = 0;
    parts.forEach((p, i) => { capital += p.series.capital * p.weight; p.series.days.forEach((v, k) => { days[offs[i] + k] += v * p.weight; }); });
    return { start, days, capital };
  }

  const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); };

  /** Group daily P&L by a key derived from the date (month 'YYYY-MM', year 'YYYY', quarter 'YYYY-Qn'). */
  function bucket(dates, days, keyFn) {
    const m = new Map();
    dates.forEach((d, i) => { const k = keyFn(d); m.set(k, (m.get(k) || 0) + days[i]); });
    return [...m].map(([key, pnl]) => ({ key, pnl }));
  }
  const kMonth = d => d.slice(0, 7), kYear = d => d.slice(0, 4);
  const kQuarter = d => d.slice(0, 4) + '-Q' + (Math.floor((+d.slice(5, 7) - 1) / 3) + 1);

  /** Equity, drawdown and every day-based metric. Returns are on the fixed starting capital (no compounding);
      drawdown is measured from peak equity, and also reported in rupees and as a share of starting capital. */
  function analyse(series) {
    const { start, days, capital } = series;
    const dates = weekdays(start, days.length);
    const equity = [], dd = []; let cum = 0, peak = 0;
    let maxDD = 0, maxDDi = 0, peakI = -1, ddStart = -1, maxDDAbs = 0;
    const spells = []; // completed drawdown spells {from, to, depth}
    let spell = null;
    for (let i = 0; i < days.length; i++) {
      cum += days[i]; equity.push(cum);
      if (cum >= peak) { if (spell) { spell.to = i; spells.push(spell); spell = null; } peak = cum; peakI = i; }
      // drawdown = fall from the highest equity so far (capital + booked profit), as a share of that peak
      const x = (cum - peak) / (capital + peak); dd.push(x);
      if (cum < peak) { if (!spell) spell = { from: peakI, to: null, depth: 0 }; spell.depth = Math.min(spell.depth, x); }
      if (x < maxDD) { maxDD = x; maxDDi = i; ddStart = peakI; maxDDAbs = cum - peak; }
    }
    if (spell) spells.push(spell);
    const span = d => Math.round((toDate(dates[d.to === null ? dates.length - 1 : d.to]) - toDate(dates[Math.max(d.from, 0)])) / DAY);
    const longest = spells.reduce((b, s) => (span(s) > (b ? span(b) : -1) ? s : b), null);
    const recovered = spells.filter(s => s.to !== null && s.depth < -0.01);

    const net = cum, ret = net / capital;
    const years = (toDate(dates[dates.length - 1]) - toDate(dates[0]) + DAY) / DAY / 365.25;
    const annual = ret / years;                              // simple, on fixed capital
    const cagr = ret > -1 ? Math.pow(1 + ret, 1 / years) - 1 : -1;
    const r = days.map(v => v / capital);
    const vol = sd(r) * Math.sqrt(252);
    const downside = Math.sqrt(r.reduce((s, v) => s + (v < 0 ? v * v : 0), 0) / (r.length || 1)) * Math.sqrt(252);
    const active = days.filter(v => v !== 0);
    const months = bucket(dates, days, kMonth), yearsB = bucket(dates, days, kYear), quarters = bucket(dates, days, kQuarter);
    const pct = a => (a.length ? a.filter(x => x.pnl > 0).length / a.length : 0);
    const ext = (a, f) => a.reduce((b, x) => (b === null || f(x.pnl, b.pnl) ? x : b), null);
    const dayList = dates.map((d, i) => ({ key: d, pnl: days[i] })).filter(x => x.pnl !== 0);
    const up = months.filter(m => m.pnl > 0), down = months.filter(m => m.pnl < 0);
    return {
      start: dates[0], end: dates[dates.length - 1], dates, equity, dd, capital, years,
      net, ret, annual, cagr, vol,
      sharpe: vol ? (mean(r) * 252) / vol : 0,
      sortino: downside ? (mean(r) * 252) / downside : 0,
      maxDD, maxDDAbs, maxDDCap: maxDDAbs / capital, maxDDDate: dates[maxDDi], maxDDFrom: dates[Math.max(ddStart, 0)],
      calmar: maxDD ? annual / -maxDD : 0,
      ddDays: longest ? span(longest) : 0, ddOpen: !!(longest && longest.to === null),
      avgRecovery: recovered.length ? Math.round(mean(recovered.map(span))) : 0,
      winDays: active.length ? active.filter(v => v > 0).length / active.length : 0,
      winMonths: pct(months), winQuarters: pct(quarters), winYears: pct(yearsB),
      avgUpMonth: up.length ? mean(up.map(m => m.pnl)) / capital : 0,
      avgDownMonth: down.length ? mean(down.map(m => m.pnl)) / capital : 0,
      bestDay: ext(dayList, (a, b) => a > b), worstDay: ext(dayList, (a, b) => a < b),
      bestMonth: ext(months, (a, b) => a > b), worstMonth: ext(months, (a, b) => a < b),
      bestYear: ext(yearsB, (a, b) => a > b), worstYear: ext(yearsB, (a, b) => a < b),
      months, yearsB, quarters,
    };
  }

  /** Trade-based metrics from an array of per-trade ₹ P&L in closing order. */
  function tradeStats(pnls, weeks) {
    const wins = pnls.filter(v => v > 0), losses = pnls.filter(v => v < 0);
    const gp = wins.reduce((s, v) => s + v, 0), gl = -losses.reduce((s, v) => s + v, 0);
    let cw = 0, cl = 0, mw = 0, ml = 0;
    for (const v of pnls) { if (v > 0) { cw++; cl = 0; } else if (v < 0) { cl++; cw = 0; } mw = Math.max(mw, cw); ml = Math.max(ml, cl); }
    const avgWin = wins.length ? gp / wins.length : 0, avgLoss = losses.length ? -gl / losses.length : 0;
    return {
      count: pnls.length, wins: wins.length, losses: losses.length,
      winRate: pnls.length ? wins.length / pnls.length : 0,
      avgWin, avgLoss, payoff: avgLoss ? avgWin / -avgLoss : 0,
      profitFactor: gl ? gp / gl : 0,
      expectancy: pnls.length ? (gp - gl) / pnls.length : 0,
      best: pnls.length ? Math.max(...pnls) : 0, worst: pnls.length ? Math.min(...pnls) : 0,
      maxWinStreak: mw, maxLossStreak: ml,
      perWeek: weeks ? pnls.length / weeks : 0,
    };
  }

  /** Pearson correlation of two series' weekly P&L over the dates they share. */
  function correlation(a, b) {
    const wk = s => { const d = weekdays(s.start, s.days.length), m = new Map(); d.forEach((x, i) => { const t = toDate(x); const k = iso(new Date(+t - ((t.getUTCDay() + 6) % 7) * DAY)); m.set(k, (m.get(k) || 0) + s.days[i]); }); return m; };
    const A = wk(a), B = wk(b), x = [], y = [];
    for (const [k, v] of A) if (B.has(k)) { x.push(v); y.push(B.get(k)); }
    const sx = sd(x), sy = sd(y); if (!sx || !sy) return 0;
    const mx = mean(x), my = mean(y);
    return x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / (x.length - 1) / (sx * sy);
  }

  // ---------- formatting (Indian numbering) ----------
  const inr = (v, d = 0) => (v < 0 ? '−' : '') + '₹' + Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  function inrShort(v) {
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
    if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
    if (a >= 1e3) return s + '₹' + (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return s + '₹' + Math.round(a);
  }
  const pct = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%';
  const signPct = (v, d = 2) => (v > 0 ? '+' : '') + pct(v, d);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = s => +s.slice(8, 10) + ' ' + MON[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4);
  const fmtMonth = s => MON[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4);

  return { weekdays, dayIndex, combine, analyse, tradeStats, correlation, bucket, inr, inrShort, pct, signPct, fmtDate, fmtMonth, MON };
});
