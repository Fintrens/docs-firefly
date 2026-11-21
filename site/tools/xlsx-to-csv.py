#!/usr/bin/env python3
"""Convert a Firefly backtest export (.xlsx) into the trade CSV the site reads.

    python3 tools/xlsx-to-csv.py "export.xlsx" backtests/<id>/trades.csv

The input may be a real .xlsx workbook or a CSV file (the engine sometimes saves CSV under an .xlsx name).
Two layouts are recognised, by their header row:

  * the engine's raw export  (runId, variationId, instrument, side, entryDate, entryTime, exitTime, …,
    leg1, leg1Action, leg1EntryQty, leg1Entry, leg1Exit, leg1Pnl, leg2…, leg3…)   one row per trade, up to three legs.
    Times are Excel serials or text (DD/MM/YY HH:MM). A trade with no exit time was still open when the test
    ended and is left out; the count is printed.
  * the analysed workbook's "Trades" sheet  (Date, Entry time, Instrument, Signal side, Option leg, CE/PE,
    Contract, Exit reason, Hold (min), Return %, Net P&L after brokerage, Gross P&L)   no prices or quantities

P&L written is GROSS (leg P&L as the engine reports it, before brokerage), like every backtest on the site.
Standard library only; no Excel packages needed.
"""
import csv
import re
import sys
import zipfile
import datetime as dt
import xml.etree.ElementTree as ET

M = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
EPOCH = dt.datetime(1899, 12, 30)


def sheets(path):
    """Yield (sheet name, list of rows); cells are str, float or None."""
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.parse(z.open('xl/sharedStrings.xml')).getroot().findall(M + 'si'):
            shared.append(''.join(t.text or '' for t in si.iter(M + 't')))
    rels = {r.get('Id'): r.get('Target') for r in ET.parse(z.open('xl/_rels/workbook.xml.rels')).getroot()}
    for s in ET.parse(z.open('xl/workbook.xml')).getroot().find(M + 'sheets'):
        target = rels[s.get(R + 'id')]
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        rows = []
        for _, el in ET.iterparse(z.open(target)):
            if el.tag != M + 'row':
                continue
            out = []
            for c in el.findall(M + 'c'):
                if c.get('r'):
                    i = 0
                    for ch in re.match(r'[A-Z]+', c.get('r')).group(0):
                        i = i * 26 + ord(ch) - 64
                    while len(out) < i - 1:
                        out.append(None)
                t, v = c.get('t'), c.find(M + 'v')
                if t == 's' and v is not None:
                    val = shared[int(v.text)]
                elif t == 'inlineStr':
                    val = ''.join(x.text or '' for x in c.iter(M + 't'))
                elif v is None:
                    val = None
                else:
                    try:
                        val = v.text if t in ('str', 'b', 'e') else float(v.text)
                    except ValueError:
                        val = v.text
                out.append(val)
            el.clear()
            rows.append(out)
        yield s.get('name'), rows


def when(v):
    """Excel serial (days, time as a fraction) or text 'DD/MM/YY HH:MM[:SS]' → (YYYY-MM-DD, HH:MM:SS); None if blank."""
    if isinstance(v, float):
        t = EPOCH + dt.timedelta(seconds=round(v * 86400))
    else:
        v = (v or '').strip()
        if not v:
            return None
        for f in ('%d/%m/%y %H:%M', '%d/%m/%y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S'):
            try:
                t = dt.datetime.strptime(v, f)
                break
            except ValueError:
                pass
        else:
            raise SystemExit('cannot read the date/time "%s" (expected DD/MM/YY HH:MM)' % v)
    return t.strftime('%Y-%m-%d'), t.strftime('%H:%M:%S')


def num(v):
    """A number from a workbook cell (float) or a CSV cell (text); None when blank or not numeric."""
    if isinstance(v, float):
        return v
    try:
        return float(str(v).replace(',', '').strip())
    except (TypeError, ValueError):
        return None


def csv_rows(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        return [[c.strip().rstrip('.') if i == 0 else c for c in row] if i == 0 else row for i, row in enumerate(csv.reader(f))]


def fmt(v):
    """Numbers without float noise (1983.7500000000007 → 1983.75); blanks stay blank."""
    if v is None or v == '':
        return ''
    s = ('%.4f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def contract(s):
    """INDIA-OPTSTK:ITC:30-Jan-25:460PE or ITC:30-Jan-25:460PE → 'ITC 30-Jan-25 460 PE' (no commas)."""
    p = s.split(':')
    p = p[-3:] if len(p) >= 3 else p
    m = re.match(r'^([\d.]+)(CE|PE)$', p[-1]) if p else None
    if len(p) == 3 and m:
        return '%s %s %s %s' % (p[0], p[1], m.group(1), m.group(2))
    return s.replace(',', ' ')


HEAD = 'trade,instrument,side,qty,entry_date,entry_time,entry_price,exit_date,exit_time,exit_price,points,pnl,tag'


def from_raw(rows):
    h = {k: i for i, k in enumerate(rows[0]) if k}
    get = lambda r, k: r[h[k]] if k in h and h[k] < len(r) else None
    out, n, skipped = [], 0, 0
    for r in rows[1:]:
        if not r or not any(r) or when(get(r, 'entryTime')) is None:
            continue
        if when(get(r, 'exitTime')) is None:      # still open when the test ended: no exit, no P&L
            skipped += 1
            continue
        n += 1
        ed, et = when(get(r, 'entryTime'))
        xd, xt = when(get(r, 'exitTime'))
        legs = 0
        for k in ('leg1', 'leg2', 'leg3'):
            name = get(r, k)
            if not name or not str(name).strip():
                continue
            legs += 1
            action = str(get(r, k + 'Action')).strip().upper()
            entry, exit_, pnl = num(get(r, k + 'Entry')), num(get(r, k + 'Exit')), num(get(r, k + 'Pnl'))
            if pnl is None:
                raise SystemExit('trade %d (%s): %sPnl is not a number' % (n, name, k))
            pts = None if entry is None or exit_ is None else (exit_ - entry if action == 'BUY' else entry - exit_)
            out.append(','.join([str(n), contract(str(name)), action, fmt(num(get(r, k + 'EntryQty'))), ed, et, fmt(entry),
                                 xd, xt, fmt(exit_), fmt(pts), fmt(pnl), str(get(r, 'reason') or '')]))
        if not legs:
            raise SystemExit('trade %d has no legs' % n)
    if skipped:
        print('  left out %d trade(s) with no exit time (still open at the end of the test)' % skipped)
    return out, n


def from_workbook(rows):
    h = {k: i for i, k in enumerate(rows[0]) if k}
    for k in ('Date', 'Entry time', 'Contract', 'Option leg', 'Hold (min)', 'Gross P&L (₹)'):
        if k not in h:
            raise SystemExit('Trades sheet: missing column "%s"' % k)
    out, n = [], 0
    for r in rows[1:]:
        if not r or num(r[h['Date']]) is None:
            continue
        n += 1
        start = r[h['Date']] + r[h['Entry time']]
        ed, et = when(start)
        xd, xt = when(start + r[h['Hold (min)']] / 1440.0)
        out.append(','.join([str(n), contract(str(r[h['Contract']])), str(r[h['Option leg']]).upper(), '', ed, et, '',
                             xd, xt, '', '', fmt(r[h['Gross P&L (₹)']]), str(r[h['Exit reason']] or '')]))
    return out, n


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    found = None
    if not zipfile.is_zipfile(src):               # a CSV, whatever its extension
        rows = csv_rows(src)
        if rows and 'leg1' in rows[0] and 'leg1Pnl' in rows[0]:
            found = ('raw export, CSV', from_raw(rows))
        else:
            raise SystemExit('%s: not a workbook, and not a CSV with the raw export columns' % src)
    for name, rows in (sheets(src) if not found else ()):
        if not rows:
            continue
        head = [c for c in rows[0] if c]
        if 'leg1' in head and 'leg1Pnl' in head:
            found = ('raw export, sheet "%s"' % name, from_raw(rows))
            break
        if name == 'Trades' and 'Contract' in head:
            found = ('analysed workbook, sheet "Trades"', from_workbook(rows))
            break
    if not found:
        raise SystemExit('%s: no sheet with a recognised trade layout' % src)
    kind, (lines, trades) = found
    with open(dst, 'w') as f:
        f.write(HEAD + '\n' + '\n'.join(lines) + '\n')
    total = sum(float(l.split(',')[11]) for l in lines)
    print('%s → %s: %d trades, %d rows, gross P&L %.2f  (%s)' % (src.split('/')[-1], dst, trades, len(lines), total, kind))


if __name__ == '__main__':
    main()
