#!/usr/bin/env node
// One-off: convert the old VuePress trade tables (docs/src/tables/Options_<Name>_<year>.md)
// into the CSV format the new site reads (site/backtests/<id>/trades.csv). See site/README.md.
// The old tables come in five column layouts (extra SELL/COVER column, a strategy-name column,
// Excel serial dates, thousands separators); this normalises all of them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '../../docs/src/tables');
const OUT = path.join(HERE, '../backtests');
const NAMES = process.argv.slice(2).length ? process.argv.slice(2) : ['Elysium', 'Ember', 'Mirage'];

const num = s => { const v = Number(String(s).replace(/,/g, '').trim()); return Number.isFinite(v) ? v : null; };
const iso = s => {
  s = s.trim();
  let m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5).toISOString().slice(0, 10); // Excel serial
  throw new Error('bad date ' + s);
};

fs.mkdirSync(OUT, { recursive: true });
for (const name of NAMES) {
  const files = fs.readdirSync(SRC).filter(f => new RegExp(`^Options_${name}_\\d{4}\\.md$`).test(f)).sort();
  const legs = [];
  for (const f of files) for (const line of fs.readFileSync(path.join(SRC, f), 'utf8').split('\n')) {
    if (!/^[A-Z]+\d/.test(line)) continue;
    const c = line.split('|').map(x => x.trim());
    const shift = (c[5] === 'SELL' || c[5] === 'COVER') ? 1 : 0;
    const leg = {
      instrument: c[0], side: c[3], entry_date: iso(c[1]), entry_time: c[2], entry_price: num(c[4]),
      exit_date: iso(c[5 + shift]), exit_time: c[6 + shift], exit_price: num(c[7 + shift]), points: num(c[8 + shift]),
      pnl: null, tag: '', file: f,
    };
    for (const x of c.slice(9 + shift)) {
      if (x === '' ) continue;
      if (x === '-') { leg.pnl = 0; continue; }
      const v = num(x);
      if (v !== null) leg.pnl = v; else leg.tag = x;
    }
    legs.push(leg);
  }
  // Every trade is a hedge leg (BUY) followed by its short leg; the rupee P&L sits on the closing row.
  const rows = ['trade,instrument,side,entry_date,entry_time,entry_price,exit_date,exit_time,exit_price,points,pnl,tag'];
  let trade = 0, missing = 0, total = 0;
  for (let i = 0; i < legs.length; i += 2) {
    const a = legs[i], b = legs[i + 1];
    if (!b || a.side !== 'BUY' || b.side !== 'SHORT') throw new Error(`${name}: unpaired legs near ${a.file} ${a.instrument} ${a.entry_date}`);
    trade++;
    const pnl = (a.pnl ?? 0) + (b.pnl ?? 0);
    if (a.pnl === null && b.pnl === null) missing++;
    total += pnl;
    const tag = a.tag || b.tag;
    for (const [l, p] of [[a, ''], [b, pnl]])
      rows.push([trade, l.instrument, l.side, l.entry_date, l.entry_time, l.entry_price, l.exit_date, l.exit_time, l.exit_price, l.points, p, tag].join(','));
  }
  const id = name.toLowerCase();
  fs.mkdirSync(path.join(OUT, id), { recursive: true });
  fs.writeFileSync(path.join(OUT, id, 'trades.csv'), rows.join('\n') + '\n');
  console.log(`${id}: ${trade} trades, net ${total.toFixed(2)}, ${missing} trades without a rupee P&L (counted as 0)`);
}
