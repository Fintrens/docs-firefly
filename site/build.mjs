#!/usr/bin/env node
// Builds the static backtest site into site/dist/backtests/ (plain files, served by nginx).
//   node build.mjs            → site/dist
// Add a backtest: drop a CSV into data/trades/, add an entry to data/strategies.json, rebuild. See README.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const C = require('./src/core.js');
const Ch = require('./src/charts.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const rd = p => fs.readFileSync(path.join(HERE, p), 'utf8');
const cfg = JSON.parse(rd('data/strategies.json'));
const BASE = cfg.site.base, ORIGIN = cfg.site.origin;
// Version stamp (the deploy workflow sets VERSION to the git tag; the server check reads version.json)
const sh = c => { try { return execSync(c, { cwd: HERE, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const VERSION = process.env.VERSION || sh('git describe --tags --always') || 'dev', COMMIT = sh('git rev-parse --short HEAD');
const DIST = path.join(HERE, 'dist'), OUT = path.join(DIST, BASE);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const write = (rel, body) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };

// ---------- load trades ----------
const COLS = ['trade', 'instrument', 'side', 'entry_date', 'entry_time', 'entry_price', 'exit_date', 'exit_time', 'exit_price', 'points', 'pnl'];
const isoDate = (s, where) => {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return s;
  m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  throw new Error(`${where}: date "${s}" is not YYYY-MM-DD or DD-MM-YYYY`);
};
function loadTrades(file) {
  const lines = rd('data/' + file).split(/\r?\n/).filter(l => l.trim());
  const head = lines[0].split(',').map(h => h.trim().toLowerCase());
  for (const c of COLS) if (!head.includes(c)) throw new Error(`${file}: missing column "${c}" (need ${COLS.join(', ')})`);
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const map = new Map();
  lines.slice(1).forEach((l, n) => {
    const c = l.split(',').map(x => x.trim()), where = `${file} line ${n + 2}`;
    const leg = {
      trade: c[ix.trade], instrument: c[ix.instrument], side: c[ix.side].toUpperCase(),
      entry_date: isoDate(c[ix.entry_date], where), entry_time: c[ix.entry_time], entry_price: c[ix.entry_price],
      exit_date: isoDate(c[ix.exit_date], where), exit_time: c[ix.exit_time], exit_price: c[ix.exit_price],
      points: c[ix.points], pnl: c[ix.pnl], tag: ix.tag !== undefined ? c[ix.tag] || '' : '',
    };
    if (leg.pnl !== '' && !Number.isFinite(+leg.pnl)) throw new Error(`${where}: pnl "${leg.pnl}" is not a number`);
    if (!map.has(leg.trade)) map.set(leg.trade, { legs: [], pnl: 0, exit: '' });
    const t = map.get(leg.trade); t.legs.push(leg); t.pnl += +leg.pnl || 0;
    const e = leg.exit_date + ' ' + leg.exit_time; if (e > t.exit) t.exit = e;
  });
  return [...map.values()].sort((a, b) => (a.exit < b.exit ? -1 : a.exit > b.exit ? 1 : 0));
}

const strategies = cfg.strategies.map(s => {
  const trades = loadTrades(s.trades);
  const first = trades[0].exit.slice(0, 10), last = trades[trades.length - 1].exit.slice(0, 10);
  const start = C.weekdays(first, 1)[0];
  const days = new Array(C.dayIndex(start, last) + 1).fill(0);
  for (const t of trades) days[C.dayIndex(start, t.exit.slice(0, 10))] += t.pnl;
  const series = { start, days: days.map(v => Math.round(v * 100) / 100), capital: s.capital };
  const a = C.analyse(series);
  const ts = C.tradeStats(trades.map(t => t.pnl), a.years * 365.25 / 7);
  return { ...s, tradesList: trades, series, a, ts };
});

// ---------- assets ----------
fs.rmSync(DIST, { recursive: true, force: true });
const js = ['src/shell/shell.js', 'src/core.js', 'src/charts.js', 'src/app.js'].map(rd).join('\n;\n');
const jsName = 'assets/app.' + crypto.createHash('sha256').update(js).digest('hex').slice(0, 10) + '.js';
write(jsName, js);
const css = (rd('src/shell/shell.css') + rd('src/style.css')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s+/g, '\n');
const header = rd('src/shell/header.html'), tail = rd('src/shell/tail.html');
const footer = rd('src/shell/footer.html').replace(/(<[^>]*class="ver"[^>]*>)[^<]*</, `$1${esc(VERSION)}<`);

// data the page fetches: daily P&L for every strategy (one small file), and the trade log per year
write('data/series.json', JSON.stringify({ updated: cfg.site.updated, strategies: strategies.map(s => ({ id: s.id, name: s.name, capital: s.capital, start: s.series.start, days: s.series.days })) }));
const CSV_HEAD = COLS.concat('tag').join(',');
const legRow = l => [l.trade, l.instrument, l.side, l.entry_date, l.entry_time, l.entry_price, l.exit_date, l.exit_time, l.exit_price, l.points, l.pnl, l.tag].join(',');
for (const s of strategies) {
  const byYear = new Map();
  for (const t of s.tradesList) { const y = t.exit.slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(t); }
  s.yearsList = [...byYear.keys()].sort();
  for (const [y, list] of byYear) write(`data/${s.id}/trades-${y}.csv`, CSV_HEAD + '\n' + list.flatMap(t => t.legs.map(legRow)).join('\n') + '\n');
}

// ---------- shared template ----------
const DISCLAIMER = `<p><b>Hypothetical results.</b> These are backtests: the rules were applied to historical market data. They are not a record of actual trading, and no account achieved these results. ${esc(cfg.site.costs)} Past and backtested performance does not indicate future results; trading options can lose more than the amount shown in any drawdown here.</p><p>Fintrens Technologies is a software company, not a SEBI-registered investment adviser or research analyst. Nothing on this page is investment advice. See the <a href="/disclaimer/">disclaimer</a>.</p>`;

// Same Consent Mode v2 set-up as fintrens-home (baseof.html): denied until the banner grants, never loaded on a local host.
const GTM = cfg.site.gtm || '';
const GTM_HEAD = GTM ? `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
(function(){var c=null;try{c=localStorage.getItem("fx_consent")}catch(e){}var g=c==="all"?"granted":"denied";
gtag("consent","default",{ad_storage:g,ad_user_data:g,ad_personalization:g,analytics_storage:g,functionality_storage:"granted",security_storage:"granted",wait_for_update:500});
document.addEventListener("fx:consent",function(e){var v=e.detail==="all"?"granted":"denied";gtag("consent","update",{ad_storage:v,ad_user_data:v,ad_personalization:v,analytics_storage:v})});})();
window.addEventListener('load',function(){if(/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname)||/\\.(localhost|test)$/.test(location.hostname))return;(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM}')});</script>` : '';
const GTM_BODY = GTM ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>` : '';

function page({ slug, title, desc, body, ld, kind, noindex }) {
  const url = ORIGIN + BASE + slug;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Fintrens">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0369A1">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<link rel="preload" href="/fonts/manrope-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<style>${css}</style>
${ld ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld })}</script>` : ''}
${GTM_HEAD}
</head>
<body class="www bt" data-kind="${kind}" data-base="${BASE}">${GTM_BODY}
<a href="#main" class="skip">Skip to content</a>
${header}
<main id="main">
${body}
</main>
${footer}
${tail}
<script src="${BASE}${jsName}" defer></script>
</body>
</html>
`;
}
const ORG = { '@type': 'Organization', '@id': ORIGIN + '/#org', name: 'Fintrens Technologies Pvt. Ltd.', url: ORIGIN + '/' };
const crumbLd = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: ORIGIN + c[1] })) });
const crumb = items => `<nav class="crumb" aria-label="Breadcrumb">${items.map((c, i) => (i < items.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(c[0])}</span>`)).join('')}</nav>`;
const tone = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const kpi = (label, value, sub, cls = '') => `<div class="kpi"><dt>${label}</dt><dd class="num ${cls}">${value}</dd>${sub ? `<p>${sub}</p>` : ''}</div>`;
const row = (label, value, cls = '') => `<div><dt>${label}</dt><dd class="num ${cls}">${value}</dd></div>`;
const period = a => `${C.fmtDate(a.start)} – ${C.fmtDate(a.end)}`;
const yrs = a => `${a.start.slice(0, 4)}–${a.end.slice(0, 4)}`;

function heatmap(a) {
  const scale = Math.max(...a.months.map(m => Math.abs(m.pnl))) / a.capital || 1;
  const by = new Map(a.months.map(m => [m.key, m.pnl]));
  const years = a.yearsB.map(y => y.key);
  let h = `<div class="scroll"><table class="heat"><caption class="sr">Monthly return on starting capital, by year</caption><thead><tr><th scope="col">Year</th>${C.MON.map(m => `<th scope="col">${m}</th>`).join('')}<th scope="col">Year</th></tr></thead><tbody>`;
  for (const y of years) {
    h += `<tr><th scope="row">${y}</th>`;
    for (let m = 1; m <= 12; m++) {
      const k = y + '-' + String(m).padStart(2, '0');
      if (!by.has(k)) { h += '<td class="na">·</td>'; continue; }
      const v = by.get(k) / a.capital;
      h += `<td style="background:${Ch.heat(v, scale)}" title="${C.fmtMonth(k)}: ${C.inr(by.get(k))}">${(v * 100).toFixed(1)}</td>`;
    }
    const yv = a.yearsB.find(x => x.key === y).pnl / a.capital;
    h += `<td class="tot ${tone(yv)}">${C.signPct(yv, 1)}</td></tr>`;
  }
  return h + '</tbody></table></div>';
}
function distribution(a) {
  const v = a.months.map(m => m.pnl / a.capital), lo = Math.min(...v), hi = Math.max(...v);
  const step = [0.01, 0.02, 0.025, 0.05, 0.1].find(s => (hi - lo) / s <= 9) || 0.2;
  const from = Math.floor(lo / step) * step, bins = [];
  for (let b = from; b < hi; b += step) bins.push({ lo: b, hi: b + step, n: v.filter(x => x >= b && (x < b + step || (b + step >= hi && x <= hi))).length });
  const max = Math.max(...bins.map(b => b.n));
  const f = x => (Math.round(x * 1000) / 10).toString().replace('-', '−') + '%';
  return `<ul class="dist">${bins.map(b => `<li><span class="num">${f(b.lo)} to ${f(b.hi)}</span><i><b class="${b.hi <= 0 ? 'neg' : 'pos'}" style="width:${Math.max(b.n / max * 100, b.n ? 2 : 0)}%"></b></i><em class="num">${b.n} ${b.n === 1 ? 'month' : 'months'}</em></li>`).join('')}</ul>`;
}
const stratCard = s => `<a class="scard" href="${BASE}${s.id}/">
  <div class="scard-h"><h3>${esc(s.name)}</h3><span class="tag">${esc(s.underlying)} · ${esc(s.segment)}</span></div>
  <p>${esc(s.tagline)}</p>
  ${Ch.spark(s.a.equity)}
  <dl class="mini"><div><dt>Return</dt><dd class="num ${tone(s.a.ret)}">${C.signPct(s.a.ret, 1)}</dd></div><div><dt>CAGR</dt><dd class="num">${C.pct(s.a.cagr, 1)}</dd></div><div><dt>Max DD</dt><dd class="num neg">${C.pct(s.a.maxDD, 1)}</dd></div><div><dt>Sharpe</dt><dd class="num">${s.a.sharpe.toFixed(2)}</dd></div></dl>
  <span class="more">Capital ${C.inrShort(s.capital)} · ${s.ts.count.toLocaleString('en-IN')} trades · Full results →</span></a>`;

const DEFS = [
  ['Total return', 'Net profit or loss over the whole test, divided by the starting capital. Capital is fixed: profits are not reinvested.'],
  ['CAGR', 'The compound annual growth rate that turns the starting capital into the final equity over the test period.'],
  ['Average yearly return', 'Total return divided by the number of years in the test (simple, not compounded).'],
  ['Max drawdown', 'The largest fall in daily closing equity (starting capital plus booked profit) from its highest point so far, as a share of that peak. The rupee amount and its share of starting capital are shown alongside.'],
  ['Sharpe ratio', 'Average daily return divided by the standard deviation of daily returns, annualised with 252 trading days. Risk-free rate taken as zero.'],
  ['Sortino ratio', 'As Sharpe, but divided by the downside deviation only (negative days).'],
  ['Calmar ratio', 'Average yearly return divided by max drawdown.'],
  ['Profit factor', 'Total profit of winning trades divided by total loss of losing trades.'],
  ['Expectancy', 'Average profit or loss per trade, winners and losers together.'],
  ['Trade', 'One position from entry to exit. A hedged spread (a short option and its bought hedge) counts as one trade.'],
];
const defsBlock = `<dl class="defs">${DEFS.map(d => `<div><dt>${d[0]}</dt><dd>${d[1]}</dd></div>`).join('')}</dl>`;

// ---------- strategy pages ----------
for (const s of strategies) {
  const { a, ts } = s;
  const eq = Ch.line({ dates: a.dates, lines: [{ values: a.equity }], area: true, fmt: C.inrShort, w: 1100, h: 360, label: `${s.name} cumulative profit and loss` });
  const uw = Ch.underwater({ dates: a.dates, values: a.dd, w: 1100, h: 180 });
  const yb = Ch.bars({ items: a.yearsB.map(y => ({ label: y.key, value: y.pnl / a.capital })), w: 420, h: 230, label: 'Return by calendar year' });
  const title = `${s.name} backtest: Nifty options strategy, ${yrs(a)}`;
  const desc = `${s.name} backtest on ${s.underlying} ${s.segment.toLowerCase()}, ${period(a)}: ${ts.count.toLocaleString('en-IN')} trades, equity curve, drawdowns, monthly returns and the full trade log.`;
  const others = strategies.filter(o => o.id !== s.id);
  const body = `
<section class="wrap head">
  ${crumb([['Home', '/'], ['Backtests', BASE], [s.name, BASE + s.id + '/']])}
  <p class="eyebrow">Backtest · ${esc(s.exchange)} · ${esc(s.underlying)} · ${esc(s.segment)}</p>
  <h1>${esc(s.name)} backtest: ${esc(s.tagline.charAt(0).toLowerCase() + s.tagline.slice(1))}</h1>
  <p class="lede">${esc(s.summary)}</p>
  <ul class="chips">
    <li><span>Capital</span><b class="num">${C.inr(s.capital)}</b></li>
    <li><span>Period</span><b class="num">${period(a)}</b></li>
    <li><span>Trades</span><b class="num">${ts.count.toLocaleString('en-IN')}</b></li>
    <li><span>Style</span><b>${esc(s.style)}</b></li>
    <li><span>Holding</span><b>${esc(s.holding)}</b></li>
  </ul>
  <div class="cta"><a class="btn" href="${cfg.site.cta.href}">${esc(cfg.site.cta.label)}</a><a class="btn ghost" href="${BASE}?mix=${s.id}:1#combine">Combine with other strategies</a></div>
</section>

<section class="wrap" data-strategy="${s.id}">
  <dl class="kpis">
    ${kpi('Net profit', C.inrShort(a.net), `on ${C.inrShort(s.capital)} capital`, tone(a.net))}
    ${kpi('Total return', C.signPct(a.ret, 1), `${a.years.toFixed(1)} years, not compounded`, tone(a.ret))}
    ${kpi('CAGR', C.pct(a.cagr, 1), `${C.pct(a.annual, 1)} average per year`)}
    ${kpi('Max drawdown', C.pct(a.maxDD, 2), `${C.inrShort(a.maxDDAbs)} from peak`, 'neg')}
    ${kpi('Sharpe ratio', a.sharpe.toFixed(2), `Sortino ${a.sortino.toFixed(2)}`)}
    ${kpi('Winning trades', C.pct(ts.winRate, 1), `profit factor ${ts.profitFactor.toFixed(2)}`)}
  </dl>

  <div class="card chartcard">
    <div class="card-h"><h2>Cumulative profit and loss</h2>
      <div class="seg" role="group" aria-label="Period" data-range><button data-r="63">3M</button><button data-r="126">6M</button><button data-r="252">1Y</button><button data-r="756">3Y</button><button data-r="0" class="on">All</button></div></div>
    <p class="readout num" data-readout aria-live="off">${period(a)} · <b class="${tone(a.net)}">${C.inr(a.net)}</b></p>
    <div class="chart" data-chart="equity">${eq.svg}</div>
    <h3 class="sub">Drawdown from peak equity</h3>
    <div class="chart" data-chart="dd">${uw.svg}</div>
    <p class="note">Booked profit and loss on a fixed ${C.inr(s.capital)}, by the day each trade closed. Hover or tap the chart for daily values.</p>
  </div>

  <div class="grid4">
    <div class="card"><h2>Returns</h2><dl class="rows">
      ${row('Net profit', C.inr(a.net), tone(a.net))}
      ${row('Total return', C.signPct(a.ret), tone(a.ret))}
      ${row('CAGR', C.pct(a.cagr))}
      ${row('Average yearly return', C.pct(a.annual))}
      ${row('Average winning month', C.signPct(a.avgUpMonth), 'pos')}
      ${row('Average losing month', C.signPct(a.avgDownMonth), 'neg')}
    </dl></div>
    <div class="card"><h2>Risk</h2><dl class="rows">
      ${row('Max drawdown', C.pct(a.maxDD), 'neg')}
      ${row('…in rupees', C.inr(a.maxDDAbs), 'neg')}
      ${row('…of starting capital', C.pct(a.maxDDCap), 'neg')}
      ${row('Longest drawdown', a.ddDays + ' days' + (a.ddOpen ? ' (open)' : ''))}
      ${row('Average recovery', a.avgRecovery + ' days')}
      ${row('Volatility (annualised)', C.pct(a.vol))}
    </dl></div>
    <div class="card"><h2>Trades</h2><dl class="rows">
      ${row('Trades', ts.count.toLocaleString('en-IN') + ` <small>(${ts.perWeek.toFixed(0)}/week)</small>`)}
      ${row('Winning trades', C.pct(ts.winRate))}
      ${row('Average win', C.inr(ts.avgWin), 'pos')}
      ${row('Average loss', C.inr(ts.avgLoss), 'neg')}
      ${row('Win : loss size', ts.payoff.toFixed(2) + ' : 1')}
      ${row('Expectancy per trade', C.inr(ts.expectancy), tone(ts.expectancy))}
    </dl></div>
    <div class="card"><h2>Ratios and consistency</h2><dl class="rows">
      ${row('Sharpe', a.sharpe.toFixed(2))}
      ${row('Sortino', a.sortino.toFixed(2))}
      ${row('Calmar', a.calmar.toFixed(2))}
      ${row('Profit factor', ts.profitFactor.toFixed(2))}
      ${row('Winning days / months', C.pct(a.winDays, 0) + ' / ' + C.pct(a.winMonths, 0))}
      ${row('Longest win / loss streak', ts.maxWinStreak + ' / ' + ts.maxLossStreak + ' trades')}
    </dl></div>
  </div>

  <div class="card"><div class="card-h"><h2>Monthly returns</h2><p class="hint">% of starting capital · every losing month shown</p></div>${heatmap(a)}</div>

  <div class="grid2">
    <div class="card"><h2>Return by year</h2><div class="chart static">${yb}</div><p class="note">${a.start.slice(0, 4)} and ${a.end.slice(0, 4)} are part years (${C.fmtDate(a.start)} to ${C.fmtDate(a.end)}).</p></div>
    <div class="card"><h2>Best and worst periods</h2>
      <table class="bw"><thead><tr><th></th><th scope="col">Best</th><th scope="col">Worst</th></tr></thead><tbody>
        <tr><th scope="row">Day</th><td><b class="num pos">${C.inr(a.bestDay.pnl)}</b><span>${C.fmtDate(a.bestDay.key)}</span></td><td><b class="num neg">${C.inr(a.worstDay.pnl)}</b><span>${C.fmtDate(a.worstDay.key)}</span></td></tr>
        <tr><th scope="row">Month</th><td><b class="num pos">${C.signPct(a.bestMonth.pnl / a.capital)}</b><span>${C.fmtMonth(a.bestMonth.key)}</span></td><td><b class="num ${tone(a.worstMonth.pnl)}">${C.signPct(a.worstMonth.pnl / a.capital)}</b><span>${C.fmtMonth(a.worstMonth.key)}</span></td></tr>
        <tr><th scope="row">Year</th><td><b class="num pos">${C.signPct(a.bestYear.pnl / a.capital)}</b><span>${a.bestYear.key}</span></td><td><b class="num ${tone(a.worstYear.pnl)}">${C.signPct(a.worstYear.pnl / a.capital)}</b><span>${a.worstYear.key}</span></td></tr>
        <tr><th scope="row">Trade</th><td><b class="num pos">${C.inr(ts.best)}</b></td><td><b class="num neg">${C.inr(ts.worst)}</b></td></tr>
      </tbody></table>
      <h3 class="sub">How monthly returns are spread</h3>${distribution(a)}
    </div>
  </div>

  <div class="card" id="trades" data-trades="${s.id}" data-years="${s.yearsList.join(',')}">
    <div class="card-h"><h2>Trade log</h2>
      <div class="seg" role="group" aria-label="Year" data-years-seg>${s.yearsList.map(y => `<button data-y="${y}">${y}</button>`).join('')}</div></div>
    <p class="hint">All ${ts.count.toLocaleString('en-IN')} trades, entry to exit, in the order they closed.</p>
    <div class="scroll"><table class="tlog"><thead><tr><th scope="col">Closed</th><th scope="col">Opened</th><th scope="col">Legs (entry → exit price)</th><th scope="col" class="r">Points</th><th scope="col" class="r">P&amp;L</th></tr></thead><tbody data-tbody><tr><td colspan="5" class="na">Pick a year to load its trades.</td></tr></tbody></table></div>
    <div class="pager" data-pager hidden><button class="btn ghost" data-prev>← Newer</button><span class="num" data-page></span><button class="btn ghost" data-next>Older →</button></div>
  </div>

  <div class="card method"><h2>How to read these numbers</h2>${defsBlock}<div class="legal">${DISCLAIMER}</div></div>
</section>

<section class="wrap more">
  <h2>Other published backtests</h2>
  <div class="scards">${others.map(stratCard).join('')}</div>
  <p class="center"><a class="btn ghost" href="${BASE}?mix=${strategies.map(x => x.id + ':1').join(',')}#combine">See them combined →</a></p>
</section>`;
  write(`${s.id}/index.html`, page({
    slug: s.id + '/', title, desc, body, kind: 'backtest',
    ld: [ORG, crumbLd([['Home', '/'], ['Backtests', BASE], [s.name, BASE + s.id + '/']]),
      { '@type': 'Dataset', name: `${s.name} backtest trade log (${s.underlying} ${s.segment.toLowerCase()})`, description: desc, url: ORIGIN + BASE + s.id + '/', temporalCoverage: `${a.start}/${a.end}`, creator: { '@id': ORG['@id'] }, isAccessibleForFree: true, dateModified: cfg.site.updated, variableMeasured: ['Entry and exit price', 'Profit and loss per trade'] }],
  }));
}

// ---------- index (overview + combine) ----------
{
  const totalTrades = strategies.reduce((n, s) => n + s.ts.count, 0);
  const start = strategies.map(s => s.a.start).sort()[0], end = strategies.map(s => s.a.end).sort().pop();
  const combo = C.combine(strategies.map(s => ({ series: s.series, weight: 1 }))), ca = C.analyse(combo);
  const lines = [{ values: ca.equity, color: '#12211E', width: 2.4 }].concat(strategies.map((s, i) => ({ values: s.a.equity, color: Ch.COLORS[i % Ch.COLORS.length], width: 1.3 })));
  const cmb = Ch.line({ dates: ca.dates, lines, fmt: C.inrShort, w: 1100, h: 380, label: 'Combined cumulative profit and loss' });
  const faqs = [
    ['What is a backtest?', 'A backtest applies a fixed set of trading rules to historical market data and records every trade the rules would have taken. It shows how the rules behaved in past markets, including the losing periods. It is not a record of real trading and does not predict future results.'],
    ['Are these results from real accounts?', 'No. Every figure on these pages is hypothetical: it comes from running the strategy rules on historical prices. No brokerage, taxes or slippage are deducted, so results on a real account would be lower.'],
    ['How is max drawdown calculated?', 'Equity is the starting capital plus all profit booked so far. Each day we compare closing equity with its highest value up to that day; the largest percentage fall is the max drawdown. The same fall is also shown in rupees and as a share of the starting capital.'],
    ['Why combine strategies?', 'Strategies that lose at different times smooth each other out, so a combination can have a shallower drawdown than its parts. The combine tool adds the daily profit and loss of the strategies you pick, at the size you choose, and recomputes every metric. It also shows how correlated they are: strategies built on the same rules will move together and add less.'],
    ['Can I check the numbers myself?', 'Yes. Each strategy page lists every trade, year by year, with its entry and exit time and price.'],
  ];
  const metricRow = (label, f) => `<tr><th scope="row">${label}</th>${strategies.map(s => `<td class="num">${f(s)}</td>`).join('')}</tr>`;
  const body = `
<section class="wrap head hero">
  ${crumb([['Home', '/'], ['Backtests', BASE]])}
  <p class="eyebrow">Firefly · Published backtests · ${start.slice(0, 4)}–${end.slice(0, 4)}</p>
  <h1>Firefly backtest results: every trade, published</h1>
  <p class="lede">The rules behind Firefly's algo trading, run on ${a_years(start, end)} years of Nifty options data and published trade by trade: equity curves, drawdowns, monthly returns with the losing months, and the full trade logs. Combine strategies and the numbers recalculate in your browser.</p>
  <dl class="stats">
    <div><dd class="num">${totalTrades.toLocaleString('en-IN')}</dd><dt>trades published</dt></div>
    <div><dd class="num">${strategies.length}</dd><dt>strategies</dt></div>
    <div><dd class="num">${C.fmtMonth(start.slice(0, 7))} – ${C.fmtMonth(end.slice(0, 7))}</dd><dt>test period</dt></div>
  </dl>
  <div class="cta"><a class="btn" href="#combine">Combine strategies</a><a class="btn ghost" href="/methodology/">How Firefly works</a></div>
</section>

<section class="wrap">
  <h2 class="sec">Strategies</h2>
  <div class="scards">${strategies.map(stratCard).join('')}</div>
</section>

<section class="wrap">
  <div class="card"><div class="card-h"><h2>Side by side</h2><p class="hint">${C.fmtDate(start)} – ${C.fmtDate(end)} · fixed capital, not compounded</p></div>
  <div class="scroll"><table class="cmp"><thead><tr><th></th>${strategies.map(s => `<th scope="col"><a href="${BASE}${s.id}/">${esc(s.name)}</a></th>`).join('')}</tr></thead><tbody>
    ${metricRow('Capital', s => C.inr(s.capital))}
    ${metricRow('Net profit', s => C.inr(s.a.net))}
    ${metricRow('Total return', s => C.signPct(s.a.ret, 1))}
    ${metricRow('CAGR', s => C.pct(s.a.cagr, 1))}
    ${metricRow('Max drawdown', s => C.pct(s.a.maxDD))}
    ${metricRow('Longest drawdown', s => s.a.ddDays + ' days')}
    ${metricRow('Sharpe', s => s.a.sharpe.toFixed(2))}
    ${metricRow('Calmar', s => s.a.calmar.toFixed(2))}
    ${metricRow('Trades', s => s.ts.count.toLocaleString('en-IN'))}
    ${metricRow('Winning trades', s => C.pct(s.ts.winRate, 1))}
    ${metricRow('Profit factor', s => s.ts.profitFactor.toFixed(2))}
    ${metricRow('Winning months', s => C.pct(s.a.winMonths, 0))}
    ${metricRow('Worst month', s => C.signPct(s.a.worstMonth.pnl / s.a.capital, 1) + ` <small>${C.fmtMonth(s.a.worstMonth.key)}</small>`)}
  </tbody></table></div></div>
</section>

<section class="wrap" id="combine" data-combine>
  <h2 class="sec">Combine strategies</h2>
  <p class="secp">Pick the strategies and the size of each. Daily profit and loss are added together and every metric is recalculated. The link in your address bar keeps your selection, so you can share it.</p>
  <div class="builder">
    <form class="card picks" data-picks aria-label="Strategies in the combination">
      ${strategies.map((s, i) => `<div class="pick" data-id="${s.id}">
        <label><input type="checkbox" checked data-on><i style="background:${Ch.COLORS[i % Ch.COLORS.length]}"></i><b>${esc(s.name)}</b></label>
        <div class="step"><button type="button" data-dec aria-label="Less ${esc(s.name)}">−</button><output class="num" data-mult>1×</output><button type="button" data-inc aria-label="More ${esc(s.name)}">+</button></div>
        <span class="num cap" data-cap>${C.inrShort(s.capital)}</span></div>`).join('')}
      <div class="pick total"><b>Combined capital</b><span class="num" data-total>${C.inrShort(combo.capital)}</span></div>
      <p class="note">1× is the capital each backtest was run on. Position sizes scale with the multiplier.</p>
    </form>
    <div class="result">
      <dl class="kpis five" data-ckpis>
        ${kpi('Net profit', C.inrShort(ca.net), '', tone(ca.net))}
        ${kpi('Total return', C.signPct(ca.ret, 1), '', tone(ca.ret))}
        ${kpi('CAGR', C.pct(ca.cagr, 1))}
        ${kpi('Max drawdown', C.pct(ca.maxDD), '', 'neg')}
        ${kpi('Sharpe', ca.sharpe.toFixed(2))}
      </dl>
      <div class="card chartcard">
        <div class="card-h"><h3 class="h2">Combined profit and loss</h3><ul class="legend" data-legend><li><i style="background:#12211E"></i>Combined</li>${strategies.map((s, i) => `<li><i style="background:${Ch.COLORS[i % Ch.COLORS.length]}"></i>${esc(s.name)}</li>`).join('')}</ul></div>
        <p class="readout num" data-readout>${period(ca)} · <b class="${tone(ca.net)}">${C.inr(ca.net)}</b></p>
        <div class="chart" data-chart="equity">${cmb.svg}</div>
        <h3 class="sub">Drawdown from peak equity</h3>
        <div class="chart" data-chart="dd">${Ch.underwater({ dates: ca.dates, values: ca.dd, w: 1100, h: 170 }).svg}</div>
      </div>
      <div class="grid2">
        <div class="card"><h3 class="h2">Each strategy against the combination</h3><div class="scroll" data-ctable></div></div>
        <div class="card"><h3 class="h2">Correlation</h3><p class="hint">Of weekly profit and loss. 1.00 means they move together; near 0 means they are unrelated.</p><div class="scroll" data-corr></div></div>
      </div>
    </div>
  </div>
</section>

<section class="wrap">
  <div class="card method"><h2>How the backtests are measured</h2>
    <ul class="pts">
      <li><b>Fixed capital.</b> Each strategy runs on the stated capital for the whole period. Profits are not reinvested, so returns are not compounded.</li>
      <li><b>Booked on exit.</b> A trade's profit or loss counts on the day it closed. Open positions are not marked to market.</li>
      <li><b>Costs.</b> ${esc(cfg.site.costs)}</li>
      <li><b>Nothing hidden.</b> Losing days, months and trades are all in the charts, the tables and the trade logs.</li>
    </ul>
    ${defsBlock}
  </div>
</section>

<section class="wrap faq">
  <h2 class="sec">Questions</h2>
  ${faqs.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join('')}
  <div class="legal">${DISCLAIMER}</div>
</section>`;
  function a_years(s, e) { return Math.round((new Date(e) - new Date(s)) / 864e5 / 365.25); }
  write('index.html', page({
    slug: '', kind: 'backtests', body,
    title: 'Firefly backtest results: Nifty options algo trading',
    desc: `Firefly algo trading backtests, trade by trade: ${totalTrades.toLocaleString('en-IN')} Nifty options trades, ${start.slice(0, 4)}–${end.slice(0, 4)}, with equity curves, drawdowns and monthly returns.`,
    ld: [ORG, crumbLd([['Home', '/'], ['Backtests', BASE]]),
      { '@type': 'CollectionPage', name: 'Firefly backtest results', url: ORIGIN + BASE, dateModified: cfg.site.updated, publisher: { '@id': ORG['@id'] }, hasPart: strategies.map(s => ({ '@type': 'Dataset', name: `${s.name} backtest`, url: ORIGIN + BASE + s.id + '/' })) },
      { '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } })) }],
  }));
}

// ---------- 404, version stamp ----------
write('404.html', page({ slug: '404.html', kind: 'notfound', noindex: true, title: 'Page not found · Firefly backtests', desc: 'This backtest page does not exist.',
  body: `<section class="wrap head"><p class="eyebrow">404</p><h1>Page not found</h1><p class="lede">There is no backtest page at this address. The published backtests are listed on the overview.</p><div class="cta"><a class="btn" href="${BASE}">All backtests</a><a class="btn ghost" href="/">Fintrens home</a></div></section><section class="wrap"><div class="scards">${strategies.map(stratCard).join('')}</div></section>` }));
write('version.json', JSON.stringify({ version: VERSION, commit: COMMIT, built: new Date().toISOString().slice(0, 16) + 'Z', updated: cfg.site.updated }) + '\n');

// ---------- sitemap + local-preview extras ----------
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', ...strategies.map(s => s.id + '/')].map(u => `  <url><loc>${ORIGIN}${BASE}${u}</loc><lastmod>${cfg.site.updated}</lastmod></url>`).join('\n')}\n</urlset>\n`);
// fonts live on fintrens.com at /fonts/; copy them for local preview only when the sibling repo is checked out
const fonts = path.join(HERE, '../../fintrens-home/static/fonts');
if (fs.existsSync(fonts)) fs.cpSync(fonts, path.join(DIST, 'fonts'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), `<!doctype html><meta http-equiv="refresh" content="0;url=${BASE}"><a href="${BASE}">Backtests</a>`);

// pre-compress every text file: the fintrens.com vhost has gzip_static on (CSV is not in its gzip_types, so this is what compresses the trade logs)
(function gz(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) gz(f); else if (/\.(html|js|json|csv|xml)$/.test(e.name)) fs.writeFileSync(f + '.gz', zlib.gzipSync(fs.readFileSync(f), { level: 9 })); } })(OUT);

const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
console.log(`built ${VERSION}: ${strategies.length} strategies → ${path.relative(process.cwd(), OUT)}  (index ${kb('index.html')}, ${strategies.map(s => s.id + ' ' + kb(s.id + '/index.html')).join(', ')}, js ${kb(jsName)})`);
for (const s of strategies) console.log(`  ${s.id}: ${s.ts.count} trades, net ${C.inr(s.a.net)}, return ${C.pct(s.a.ret)}, max DD ${C.pct(s.a.maxDD)}`);
