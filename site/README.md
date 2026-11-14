# Firefly backtests site

Static pages for `fintrens.com/backtests/`: an overview with a combine tool, and one page per strategy
(equity curve, drawdown, monthly returns, metrics, trade log). No framework and no dependencies; the
output is plain files for nginx.

```bash
node build.mjs                          # → dist/backtests/
python3 -m http.server 4173 -d dist     # preview at http://localhost:4173/backtests/
```

## Add or update a backtest

Each strategy is a folder in `backtests/`. The build picks up every folder there; there is no list to edit.

```
backtests/
  elysium/
    strategy.json      name, capital and description
    trades.csv         the trade log (any file name, one or more .csv files)
```

**New strategy**

1. Make `backtests/<id>/`. The folder name is the URL (`/backtests/<id>/`): lower-case letters, digits and hyphens.
2. Put the trade log in it as one or more `.csv` files (format below).
3. Copy a `strategy.json` from another folder and edit it. `name`, `tagline`, `summary`, `capital`,
   `exchange`, `underlying`, `segment`, `style` and `holding` are required; `order` sets its position
   on the overview (lowest first).
4. `node build.mjs`. The strategy gets its own page and appears on the overview, in the side-by-side
   table, in the combine tool and in the sitemap.

**More data for an existing strategy**: append rows to its CSV, or drop another `.csv` in the folder
(for example one per year). All files in a folder are read as one log.

Every number and chart is computed from the CSVs; no metric is typed by hand. A folder whose name
starts with `_` is skipped, which is a way to park a draft.

### Trade CSV format

One row per leg, with a header row. A single-leg trade is one row; a spread is one row per leg sharing
the same `trade` value.

| Column | Meaning |
|---|---|
| `trade` | Any id; rows with the same id are one trade. Only needs to be unique within a file |
| `instrument` | e.g. `NIFTY2410421800PE` |
| `side` | `BUY` or `SHORT` |
| `entry_date`, `exit_date` | `YYYY-MM-DD` (or `DD-MM-YYYY`) |
| `entry_time`, `exit_time` | `HH:MM:SS` |
| `entry_price`, `exit_price` | Per unit |
| `points` | Per-unit profit or loss of the leg |
| `pnl` | Rupee profit or loss. Fill it on one leg of the trade (or on each leg); a trade's P&L is the sum |
| `tag` | Optional, not shown yet |

No thousands separators and no quoted fields. The build stops with the file and line number if a
column is missing or a date or number cannot be read. A trade's P&L is booked on its latest exit date.

## How it fits together

- `src/core.js` — all the maths (returns, drawdown, Sharpe, correlation, combining). Runs in the build
  and in the browser, so the static HTML and the interactive tool cannot disagree.
- `src/charts.js` — SVG charts as strings: pre-rendered into the HTML, redrawn in the browser at the real width.
- `src/app.js` — hover readouts, period switch, trade log (one CSV per year, fetched on demand), combine tool.
- `src/shell/` — the Fintrens site bar, footer, consent banner and their CSS/JS, copied from the built
  `fintrens-home` site. Re-copy when the main site's navigation changes.
- `site.json` — site-wide settings: base path, origin, GTM id, the costs sentence, the call-to-action link.
- `tools/import-legacy.mjs` — one-off converter from the old VuePress tables in `docs/src/tables/`.

Fonts are served by fintrens.com at `/fonts/`; the build copies them into `dist/fonts/` for local
preview only when `../../fintrens-home` is checked out.

## Checks and deployment

```bash
node tools/check.mjs      # pages, titles, descriptions, links, script syntax
tools/smoke.sh            # nginx include and old-domain redirects through a real nginx (needs docker)
```

Releases go out by pushing a `v*` tag. The repository README (`../README.md`) has the deploy steps and
the GitHub secrets to add (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, optional `DEPLOY_PORT`);
DEPLOY.md has the workflow in detail and the cutover from docs.firefly.fintrens.com.
