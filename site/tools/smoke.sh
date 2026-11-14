#!/usr/bin/env bash
# Serve the built site through a real nginx set up like the fintrens.com server block, plus the
# retired docs.firefly.fintrens.com redirect vhost, and check status codes, headers and redirects.
#   node build.mjs && tools/smoke.sh        (needs docker)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; CI="$HERE/.smoke"; NAME=backtests-smoke; PORT="${PORT:-8089}"
rm -rf "$CI"; mkdir -p "$CI/webroot/www" "$CI/fintrens.d" "$CI/conf.d" "$CI/le/live/docs.firefly.fintrens.com"
trap 'docker rm -f $NAME >/dev/null 2>&1 || true; rm -rf "$CI"' EXIT
echo home > "$CI/webroot/www/index.html"
cp -r "$HERE/dist/backtests" "$CI/webroot/backtests-release"; ln -s backtests-release "$CI/webroot/backtests"
cp "$HERE/deploy/nginx/backtests.conf" "$CI/fintrens.d/backtests.conf"
cp "$HERE/deploy/nginx/backtests.conf" "$CI/webroot/backtests-release/.backtests.conf"      # must not be served
cp "$HERE/deploy/nginx/docs.firefly.fintrens.com.conf" "$CI/conf.d/docs.conf"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=docs.firefly.fintrens.com" \
  -keyout "$CI/le/live/docs.firefly.fintrens.com/privkey.pem" -out "$CI/le/live/docs.firefly.fintrens.com/fullchain.pem" 2>/dev/null
cat > "$CI/conf.d/default.conf" <<'CONF'
map $uri $fx_cache {
    default                                                 "public, max-age=300, stale-while-revalidate=3600";
    ~*\.(?:css|js|woff2?|svg|png|jpe?g|gif|ico|webp|avif)$   "public, max-age=31536000, immutable";
    ~*\.(?:json|xml|txt|webmanifest)$                        "public, max-age=300";
}
server {
    listen 8080 default_server;
    server_name fintrens.com;
    root /srv/www/static/fintrens/www;
    index index.html;
    add_header Cache-Control $fx_cache always;
    add_header X-Content-Type-Options "nosniff" always;
    gzip on; gzip_static on; gzip_vary on;
    gzip_types text/plain text/css text/javascript application/javascript application/json application/xml image/svg+xml;
    include /etc/nginx/fintrens.d/*.conf;
    location / { try_files $uri $uri/ =404; }
    location ~ /\.(?!well-known) { deny all; }
}
CONF
docker run -d --name $NAME -p "$PORT:8080" -p "$((PORT+1)):80" \
  -v "$CI/webroot:/srv/www/static/fintrens:ro" -v "$CI/fintrens.d:/etc/nginx/fintrens.d:ro" \
  -v "$CI/conf.d:/etc/nginx/conf.d:ro" -v "$CI/le:/etc/letsencrypt:ro" nginx:1.27-alpine >/dev/null
sleep 2; docker exec $NAME nginx -t
fail=0
expect() { got=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT$1"); printf '%-46s %s (want %s)\n' "$1" "$got" "$2"; [ "$got" = "$2" ] || fail=1; }
expect /backtests 301
expect /backtests/ 200
for s in $(node -e "for(const s of require('$HERE/dist/backtests/data/series.json').strategies)console.log(s.id)"); do
  expect "/backtests/$s/" 200
  y=$(ls "$HERE/dist/backtests/data/$s" | grep -o 'trades-[0-9]*\.csv$' | tail -1); expect "/backtests/data/$s/$y" 200
done
expect /backtests/data/series.json 200
expect /backtests/sitemap.xml 200
expect /backtests/version.json 200
expect /backtests/no-such-page 404
expect /backtests/.backtests.conf 403
expect / 200
# (captured first: `curl | grep -q` under pipefail fails at random when grep exits before curl has finished writing)
has() { grep -qi -- "$2" <<<"$1" && echo "$3" || { echo "FAILED: $3"; fail=1; }; }
has "$(curl -s "http://localhost:$PORT/backtests/no-such-page")" "Page not found" "404 page served"
js=$(cd "$HERE/dist/backtests" && ls assets/app.*.js | head -1)
hdr() { curl -sI -H 'Accept-Encoding: gzip' "http://localhost:$PORT$1"; }
has "$(hdr "/backtests/$js")" '^content-encoding: gzip' "js served pre-compressed"
has "$(hdr "/backtests/$js")" 'max-age=31536000' "js cached for a year"
has "$(hdr "/backtests/data/$s/$y")" '^content-encoding: gzip' "trade CSV served pre-compressed"
has "$(hdr /backtests/)" 'x-content-type-options: nosniff' "security header inherited"
# old docs URLs → new homes
redir() { got=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: docs.firefly.fintrens.com' "http://localhost:$((PORT+1))$1"); printf '%-46s %s\n' "docs$1" "$got"; [ "$got" = "301 https://fintrens.com$2" ] || { echo "   want 301 https://fintrens.com$2"; fail=1; }; }
redir / /backtests/
redir /tables/Options_Elysium.html /backtests/elysium/
redir /tables/Options_Elysium/ /backtests/elysium/
redir /tables/Options_Ember_2024.html '/backtests/ember/#trades'
redir /tables/Options_Mirage_2020.html '/backtests/mirage/#trades'
redir /guide/ /methodology/
redir /guide/Backtesting-Results.html /backtests/
redir /guide/Algorithmic-Trading.html /what-is-algo-trading/
redir /guide/Risk-Management.html /methodology/
redir /live-result/ /backtests/
redir /assets/js/app.123.js /backtests/
[ $fail = 0 ] && echo "SMOKE OK" || { echo "SMOKE FAILED"; docker logs $NAME 2>&1 | tail -20; exit 1; }
