# docs-firefly

Firefly's published backtests: the static site served at `https://fintrens.com/backtests/`, in `site/`.
It replaced the VuePress docs site at `docs.firefly.fintrens.com` in November 2026; that domain now
redirects here.

Working on the site itself (adding a backtest, the CSV format, how the build works) is covered in
[site/README.md](site/README.md). This page covers deploying it.

## How to deploy

Pushing a version tag deploys. The site is built on the GitHub runner and uploaded to the server as
plain files; the server needs only nginx and an SSH user.

```bash
git push origin master
```

```bash
git tag -a v2.0.0 -m "Backtests on fintrens.com"
```

```bash
git push origin v2.0.0
```

Then watch **Actions → Deploy backtests**. The workflow:

1. Builds the site with the tag as its version, runs the page checks and an nginx smoke test.
2. Uploads the files to `WEBROOT/backtests-releases/<tag>-<time>/` on the server.
3. Installs the nginx rules for `/backtests/` if they changed, and switches the live symlink.
4. Checks on the server that `/backtests/` serves this release and the fintrens.com home page still
   answers. If not, it rolls everything back and the run fails.

Useful to know:

- **Only tags deploy.** A push to `master` runs the checks (`Check backtests`) but does not deploy.
- **Tags already go up to `v1.0.5`**, so use `v2.0.0` or later.
- **Re-deploy or roll back**: Actions → Deploy backtests → Run workflow, and enter the tag.
- **The live version** is shown in the page footer and at `https://fintrens.com/backtests/version.json`.
- **A new backtest** goes live the same way: add its folder under `site/backtests/`, commit, tag, push.

## Secrets to add

In GitHub: **Settings → Secrets and variables → Actions** on this repository. These are the same
names fintrens-home and fintrens-lantern use; if they are set at organisation level and shared with
this repository, nothing needs adding.

### Secrets

| Name | Required | Value |
|---|---|---|
| `DEPLOY_HOST` | Yes | Server IP or hostname (the box that serves fintrens.com) |
| `DEPLOY_USER` | Yes | SSH user that can write the web root |
| `DEPLOY_SSH_KEY` | Yes | The private key (whole file, including the `BEGIN`/`END` lines) whose public half is in that user's `~/.ssh/authorized_keys` |
| `DEPLOY_PORT` | No | SSH port, only if it is not 22 |

### Variables

| Name | Required | Value |
|---|---|---|
| `WEBROOT` | No | The fintrens.com web root. Defaults to `/srv/www/static/fintrens` |

### Environment

The deploy job runs in an environment called `production`. GitHub creates it on the first run. To
require a manual approval before each deploy, open **Settings → Environments → production** and add
a required reviewer.

There is no secret for analytics: the GTM container id is public and lives in `site/site.json`.

### If you need a new deploy key

On your machine:

```bash
ssh-keygen -t ed25519 -C fintrens-backtests-deploy -f backtests-deploy -N ""
```

Add `backtests-deploy.pub` to the deploy user's `~/.ssh/authorized_keys` on the server, and paste the
contents of `backtests-deploy` (the private file) into the `DEPLOY_SSH_KEY` secret. Then delete both
local files.

## One-time server setup

The deploy user must be able to write the web root, and should be allowed to install the nginx rules
and reload nginx without a password. On the server, replacing `deploy` with the user:

```bash
sudo visudo -f /etc/sudoers.d/fintrens-backtests
```

```
deploy ALL=(root) NOPASSWD: /usr/bin/cp /srv/www/static/fintrens/backtests-releases/*/.backtests.conf /etc/nginx/fintrens.d/backtests.conf, /usr/bin/rm -f /etc/nginx/fintrens.d/backtests.conf, /usr/sbin/nginx -t, /usr/bin/systemctl reload nginx
```

Without this line the first deploy stops before changing anything and prints the exact commands to
install the nginx rules by hand; after that, re-run the workflow.

The fintrens.com server block must include `/etc/nginx/fintrens.d/*.conf` (the current one from
fintrens-home does).

## The old docs domain

`docs.firefly.fintrens.com` answers every request with a 301 to fintrens.com (tables and everything
else to `/backtests/`, the old guide pages to `/methodology/` or `/what-is-algo-trading/`). The vhost
is `site/deploy/nginx/docs.firefly.fintrens.com.conf`, installed by hand on the server as
`/etc/nginx/conf.d/docs.firefly.fintrens.com.conf`; the deploy workflow does not manage it. Keep the
DNS record and the certificate renewal for that domain, or the redirects stop working.

The old workflow's settings are no longer used and can be deleted from the repository settings:
secrets `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, `SSH_PORT`, the variable `REMOTE_PATH`, and the
`prod` and `dev` environments. The old site's files are still on the server in the folder
`REMOTE_PATH` pointed to, with its `_backup_*` copies beside it; they are no longer served.
