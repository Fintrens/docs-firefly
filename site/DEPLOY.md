# Deploying the backtest site

| What | Where |
|---|---|
| Live URL | `https://fintrens.com/backtests/` |
| Web root | `/srv/www/static/fintrens/` — `backtests` → the current release in `backtests-releases/<tag>-<stamp>/` (symlink flipped by the workflow) |
| nginx rules | `/etc/nginx/fintrens.d/backtests.conf` (this repo's `deploy/nginx/backtests.conf`), included by the fintrens.com vhost from fintrens-home |
| Old domain | `docs.firefly.fintrens.com` → 301 to fintrens.com (`deploy/nginx/docs.firefly.fintrens.com.conf`, installed by hand once) |
| Backend | none |

## Releases

Pushing a version tag deploys it. The site is built on the GitHub runner and uploaded as files; the
server needs only nginx and an SSH user that can write the web root.

```bash
git tag -a v2.0.0 -m "Backtests on fintrens.com"
git push origin v2.0.0            # → Actions → "Deploy backtests"
```

`.github/workflows/deploy-backtests.yml`:

1. **Build and check** — `node build.mjs` with the tag as the version, `tools/check.mjs` (pages, titles,
   descriptions, links, script syntax), `tools/smoke.sh` (the nginx include and the old-domain redirects
   served by a real nginx), then one tarball kept as a workflow artifact for 14 days.
2. **Deploy to server** — unpacks into `WEBROOT/backtests-releases/<tag>-<stamp>/`, installs the nginx
   include if it changed (a failing `nginx -t` puts the previous file back), flips the
   `WEBROOT/backtests` symlink, then checks on the box that `/backtests/` answers 200 from this
   release's `version.json` and that the fintrens.com home page still answers. If a check fails, the
   symlink and the include are rolled back and the run fails. Old releases are pruned afterwards,
   keeping the four newest.

Any tag can be re-deployed from Actions → Deploy backtests → Run workflow. Rolling back is deploying
the previous tag. The tag is shown in the page footer and at `/backtests/version.json`.

A new backtest goes live the same way: add its folder under `backtests/` (README.md), commit, tag, push.

`check-backtests.yml` runs the same build, checks and smoke test on pushes and pull requests that
touch `site/`, without deploying.

## One-time setup

1. **Secrets** in this repository (the same values fintrens-home uses; set them at organisation level
   to share them): `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_PORT` if SSH is not on 22.
   Optional variable `WEBROOT` (default `/srv/www/static/fintrens`). The deploy job targets a
   `production` environment; add a required reviewer there for an approve-before-deploy step.
2. **sudoers**, so the workflow can install the nginx include itself
   (`sudo visudo -f /etc/sudoers.d/fintrens-backtests`, replace `deploy` with the user):

   ```
   deploy ALL=(root) NOPASSWD: /usr/bin/cp /srv/www/static/fintrens/backtests-releases/*/.backtests.conf /etc/nginx/fintrens.d/backtests.conf, /usr/bin/rm -f /etc/nginx/fintrens.d/backtests.conf, /usr/sbin/nginx -t, /usr/bin/systemctl reload nginx
   ```

   Without it the first deploy stops before changing anything and prints the commands to install the
   include by hand.
3. Push the first tag and open `https://fintrens.com/backtests/`.

## Cutover from docs.firefly.fintrens.com (done 14 Nov 2026)

- `/backtests/` went live with `v2.0.0`.
- The redirect vhost `deploy/nginx/docs.firefly.fintrens.com.conf` was installed by hand as
  `/etc/nginx/conf.d/docs.firefly.fintrens.com.conf` (the previous vhost is kept on the server as
  `/root/docs.firefly.fintrens.com.conf.bak`). To change a redirect, edit the file here, run
  `tools/smoke.sh`, then copy it to the server and `nginx -t && systemctl reload nginx`.
- The VuePress site (`docs/`), its backup script and its workflow were removed from this repository.
- fintrens-home links to `/backtests/` and lists `backtests/sitemap.xml` in `robots.txt`, with
  `Disallow: /backtests/data/` and `/backtests/version.json` so the raw data files are not crawled.

Keep the DNS record and the certificate renewal for the old domain; the redirects only work while
both exist.

## Analytics

The pages push the same events as fintrens-home (`cta_demo`, `outbound_click`, `faq_open`,
`scroll_depth`, `consent_choice` and the other click events), which the GTM container already
forwards. One event is specific to this site: `backtest_action` (label `range 1Y`, `trades 2024`,
`combine elysium:1,ember:2`, `card elysium`). It must be in the trigger regex of the tag
`GA4 - Site events (fintrens.com)` in GTM to reach GA4.

## Header and footer

`src/shell/` is a copy of the built fintrens-home header, footer and their CSS/JS. When the main
site's navigation changes, re-copy them (README.md) and release.
