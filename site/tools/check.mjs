#!/usr/bin/env node
// Checks on the built site (run after build.mjs): every strategy has its pages and data, titles and
// descriptions fit search results, internal links resolve, the script parses and the version is stamped.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = JSON.parse(fs.readFileSync(path.join(HERE, '../site.json'), 'utf8')).base, OUT = path.join(HERE, '../dist', BASE);
// the strategy list is whatever the build found in backtests/ and published
const cfg = { strategies: JSON.parse(fs.readFileSync(path.join(OUT, 'data/series.json'), 'utf8')).strategies };
const errors = [], bad = m => errors.push(m);
const need = f => { const p = path.join(OUT, f); if (!fs.existsSync(p) || !fs.statSync(p).size) bad(`missing ${f}`); return p; };

const pages = ['index.html', ...cfg.strategies.map(s => `${s.id}/index.html`)];
for (const f of [...pages, '404.html', 'sitemap.xml', 'version.json', 'data/series.json']) { need(f); need(f + '.gz'); }
for (const s of cfg.strategies) if (!fs.readdirSync(path.join(OUT, 'data', s.id)).some(f => /^trades-\d{4}\.csv$/.test(f))) bad(`${s.id}: no yearly trade files`);

const titles = new Set();
for (const f of pages) {
  const h = fs.readFileSync(path.join(OUT, f), 'utf8');
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '', desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  if (!title || title.length > 60) bad(`${f}: title is ${title.length} characters (1–60)`);
  if (titles.has(title)) bad(`${f}: duplicate title`); titles.add(title);
  if (desc.length < 100 || desc.length > 160) bad(`${f}: description is ${desc.length} characters (100–160)`);
  if ((h.match(/<h1[\s>]/g) || []).length !== 1) bad(`${f}: needs exactly one h1`);
  if (!h.includes(`<link rel="canonical" href="https://fintrens.com${BASE}${f.replace('index.html', '')}">`)) bad(`${f}: canonical is missing or not this page's own URL`);
  if (!/<html lang="en">/.test(h)) bad(`${f}: no lang attribute`);
  if (/<meta name="robots" content="noindex/.test(h)) bad(`${f}: marked noindex`);
  for (const t of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt']) if (!h.includes(`property="${t}"`)) bad(`${f}: missing ${t}`);
  for (const t of ['rel="icon"', 'rel="apple-touch-icon"', 'rel="manifest"', 'name="viewport"', 'name="twitter:card"']) if (!h.includes(t)) bad(`${f}: missing ${t}`);
  const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
  const levels = [...main.matchAll(/<h([1-6])[\s>]/g)].map(m => +m[1]);
  levels.forEach((l, i) => { if (i && l - levels[i - 1] > 1) bad(`${f}: heading jumps from h${levels[i - 1]} to h${l}`); });
  if (/<div[^>]*><dd/.test(main) || /<\/dd><p/.test(main)) bad(`${f}: invalid <dl> group (dt must come first; only dt/dd inside)`);
  if ([...main.matchAll(/<svg[^>]*>/g)].some(m => !/aria-(label|hidden)/.test(m[0]))) bad(`${f}: chart without a text label`);
  if (/<img(?![^>]*\balt=)/.test(main)) bad(`${f}: image without alt text`);
  const lds = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (lds.length !== 1) bad(`${f}: expected one structured-data block`);
  else try {
    const types = JSON.parse(lds[0][1])['@graph'].map(n => n['@type']);
    for (const t of ['BreadcrumbList', 'WebPage', f === 'index.html' ? 'FAQPage' : 'Dataset']) if (!types.includes(t)) bad(`${f}: structured data lacks ${t}`);
  } catch (e) { bad(`${f}: structured data is not valid JSON`); }
  if (main.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').split(/\s+/).length < 400) bad(`${f}: under 400 words of text`);
  if (/NaN|undefined|Infinity/.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) bad(`${f}: NaN/undefined/Infinity in the page text`);
  for (const m of h.matchAll(/(?:href|src)="(\/backtests\/[^"#?]*)/g)) {
    let p = path.join(OUT, m[1].slice(BASE.length)); if (m[1].endsWith('/')) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) bad(`${f}: broken link ${m[1]}`);
  }
}
const sm = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8');
if ((sm.match(/<loc>/g) || []).length !== pages.length) bad('sitemap does not list every page');
for (const js of fs.readdirSync(path.join(OUT, 'assets')).filter(f => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', path.join(OUT, 'assets', js)]); } catch { bad(`assets/${js} does not parse`); }
}
const v = JSON.parse(fs.readFileSync(path.join(OUT, 'version.json'), 'utf8'));
if (process.env.VERSION && v.version !== process.env.VERSION) bad(`version.json says ${v.version}, expected ${process.env.VERSION}`);

if (errors.length) { console.error(errors.map(e => '✗ ' + e).join('\n')); process.exit(1); }
console.log(`checks passed: ${pages.length} pages, version ${v.version}`);
