export default ({ Vue, router, isServer }) => {
  if (isServer) return;
  const GTM_ID = 'GTM-WVZ3WWM4';
  const DL = 'dataLayer';

  window[DL] = window[DL] || [];

  if (!window.__gtmBooted) {
    window.__gtmBooted = true;
    window[DL].push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const params = new URLSearchParams({ id: GTM_ID, l: DL });
    const debug = new URLSearchParams(location.search).get('gtm_debug');
    if (debug) params.set('gtm_debug', debug);

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?${params.toString()}`;
    document.head.appendChild(s);
  }
  const pushPageView = () => {
    window[DL].push({
      event: 'page_view',
      page_path: location.pathname + location.search,
      page_location: location.href,
      page_title: document.title,
    });
  };
  if (document.readyState !== 'loading') pushPageView();
  else document.addEventListener('DOMContentLoaded', pushPageView);
  router.afterEach(() => setTimeout(pushPageView, 0));
  const loaded = new Set();
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (loaded.has(src)) return resolve();
      const el = document.createElement('script');
      el.async = true;
      el.src = src;
      el.onload = () => { loaded.add(src); resolve(); };
      el.onerror = reject;
      document.head.appendChild(el);
    });
  }

  // requestIdleCallback shim
  const idle = (cb) =>
    (window.requestIdleCallback ? window.requestIdleCallback(cb) : setTimeout(cb, 1));

  // ---------- Lazy features via CDN (no bundle cost) ----------
  let zoomApplied = false;
  async function applyZoomIfNeeded() {
    const imgs = document.querySelectorAll('.theme-default-content :not(a) > img');
    if (!imgs.length || zoomApplied) return;
    await loadScript('https://cdn.jsdelivr.net/npm/medium-zoom@1.0.8/dist/medium-zoom.min.js');
    if (window.mediumZoom) {
      window.mediumZoom(imgs, { background: 'rgba(0,0,0,0.85)' });
      zoomApplied = true;
    }
  }

  const supportsCssSmooth = 'scrollBehavior' in document.documentElement.style;
  async function ensureSmoothScrollIfNeeded() {
    if (supportsCssSmooth) return;
    await loadScript('https://cdn.jsdelivr.net/npm/smoothscroll-polyfill@0.4.4/dist/smoothscroll.min.js');
    if (window.__forceSmoothScrollPolyfill) {
      window.__forceSmoothScrollPolyfill();
    } else if (window.polyfill) {
      window.polyfill();
    }
  }

  let prismReady = false;
  async function highlightCodeIfNeeded() {
    const blocks = document.querySelectorAll('pre[class*="language-"] code');
    if (!blocks.length || prismReady) return;
    await loadScript('https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js');
    await Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-javascript.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-json.min.js'),
    ]);
    if (window.Prism && window.Prism.highlightAll) {
      window.Prism.highlightAll();
      prismReady = true;
    }
  }

  // Run lazy features after each route change (post-paint)
  router.afterEach(() => {
    idle(applyZoomIfNeeded);
    idle(ensureSmoothScrollIfNeeded);
    idle(highlightCodeIfNeeded);
  });

  // =========================
  // 5) Consent banner
  // =========================
  const mountConsentBanner = () => {
    if (document.getElementById('consent-banner-root')) return;
    const root = document.createElement('div');
    root.id = 'consent-banner-root';
    document.body.appendChild(root);
    import('./components/consentBanner.vue')
      .then((m) => new Vue({ render: (h) => h(m.default) }).$mount(root))
      .catch(() => { });
  };
  const onIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn) : setTimeout(fn, 200));
  router.onReady(() => onIdle(mountConsentBanner));
  router.afterEach(() => onIdle(mountConsentBanner));

  // =========================
  // 6) Analytics helpers + click mapping
  // =========================
  const slug = (s) =>
    (s || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\s/]+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 60);

  const labelOf = (el) =>
    el?.getAttribute?.('data-gtm-label') ||
    el?.getAttribute?.('aria-label') ||
    el?.getAttribute?.('name') ||
    (el?.textContent || '').trim();

  const ensureId = (el, prefix = 'el') => {
    if (!el) return '';
    if (el.id) return el.id;
    const base = slug(labelOf(el) || 'item');
    let id = `${prefix}-${base || 'x'}`, i = 1;
    while (document.getElementById(id)) { i++; id = `${prefix}-${base}-${i}`; }
    el.id = id;
    return id;
  };

  const findLink = (t) => t?.closest?.('a') || null;

  const areaOf = (el) => {
    if (el.closest('nav')) return 'nav';
    if (el.closest('.home .hero')) return 'hero';
    if (el.closest('.sidebar, .sidebar-links, .theme-container .sidebar-group')) return 'sidebar';
    if (el.closest('.theme-default-content, .page .content, .content__default')) return 'content';
    return 'other';
  };

  const resolveUrl = (href = '') => {
    try {
      return new URL(href, location.origin);
    } catch {
      return null;
    }
  };

  const sectionFromPath = (p = location.pathname) => {
    if (p.startsWith('/guide/')) return 'docs';
    if (p.startsWith('/tables/')) return 'tables';
    if (p.startsWith('/backtest') || p.startsWith('/backtest-results/')) return 'backtest_results';
    if (p === '/' || p.startsWith('/index')) return 'home';
    return 'other';
  };

  const mapNavEvent = (href = '', text = '') => {
    const url = resolveUrl(href);
    const path = url ? url.pathname : href || '';
    const t = (text || '').toLowerCase();
    if (t.includes('docs') || path.startsWith('/guide/')) return 'redirect_docs';
    if (t.includes('tables') || path.startsWith('/tables/')) return 'redirect_tables';
    if (t.includes('backtest') || path.startsWith('/backtest') || path.startsWith('/backtest-results/'))
      return 'redirect_backtest_results';
    if (path === '/' || t === 'home') return 'redirect_home';
    if (
      t.includes('product video') ||
      t.includes('verified') ||
      t.includes('about') ||
      t.includes('live result') ||
      (url && /youtu\.be|youtube\.com|sensibull|fintrens\.com/i.test(url.href))
    ) return 'redirect_external_link';
    return null;
  };

  const isExternalOther = (urlObj, text = '') => {
    const t = (text || '').toLowerCase();
    if (t.includes('product video') || t.includes('verified') || t.includes('about') || t.includes('live result'))
      return true;
    if (!urlObj) return false;
    if (urlObj.pathname.startsWith('/live-result/')) return true;
    const sameHost = urlObj.hostname === location.hostname;
    if (!sameHost) {
      const isDocsHost = urlObj.hostname === 'docs.firefly.fintrens.com';
      if (!isDocsHost) return true;
    }
    return /youtu\.be|youtube\.com|sensibull|fintrens\.com/i.test(urlObj.href) && urlObj.hostname !== location.hostname;
  };

  // ---- Push a synthetic gtm.linkClick so Click-type triggers fire ----
  const pushGtmLinkClick = (el, href = '') => {
    try {
      const txt = labelOf(el) || '';
      window[DL].push({
        event: 'gtm.linkClick',
        // GTM built-ins (so Click URL / Text / ID / Classes resolve in triggers)
        'Click URL': href || el?.href || '',
        'Click Text': txt,
        'Click ID': el?.id || '',
        'Click Classes': el?.className || '',
        'Click Target': el?.getAttribute?.('target') || '',
        // (optional) still provide gtm.element refs for debugging
        'gtm.element': el,
        'gtm.elementId': el?.id || '',
        'gtm.elementClasses': el?.className || '',
        'gtm.elementTarget': el?.getAttribute?.('target') || '',
        'gtm.elementUrl': href || el?.href || '',
      });
    } catch { }
  };

  const pushEvent = ({ event, el, href }) => {
    const link_id = ensureId(el, 'link');
    const link_text = labelOf(el);
    const link_url = href || '';
    const page_url = location.pathname + location.search;
    const link_area = areaOf(el);
    const site_section = sectionFromPath();
    window[DL].push({ event, link_id, link_text, link_url, page_url, link_area, site_section });
  };

  const handleClick = (e) => {
    const el = findLink(e.target);
    if (!el) return;
    const rawHref = el.getAttribute('href') || '';
    const url = resolveUrl(rawHref);
    const href = url ? url.href : rawHref;
    const txt = labelOf(el) || '';
    const area = areaOf(el);

    pushGtmLinkClick(el, href);
    if (area === 'nav') {
      const ev = mapNavEvent(rawHref, txt);
      if (ev) { pushEvent({ event: ev, el, href }); return; }
    }
    if (isExternalOther(url, txt)) {
      pushEvent({ event: 'redirect_external_link', el, href }); return;
    }
    const current = sectionFromPath(location.pathname);
    if (current === 'docs') return pushEvent({ event: 'redirect_docs', el, href });
    if (current === 'tables') return pushEvent({ event: 'redirect_tables', el, href });
    if (current === 'backtest_results') return pushEvent({ event: 'redirect_backtest_results', el, href });
    if (current === 'home') return pushEvent({ event: 'redirect_home', el, href });
    const target = sectionFromPath(url ? url.pathname : '');
    if (target === 'docs') return pushEvent({ event: 'redirect_docs', el, href });
    if (target === 'tables') return pushEvent({ event: 'redirect_tables', el, href });
    if (target === 'backtest_results') return pushEvent({ event: 'redirect_backtest_results', el, href });
    if (target === 'home') return pushEvent({ event: 'redirect_home', el, href });

    pushEvent({ event: 'redirect_external_link', el, href });
  };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('auxclick', (e) => {
    if (e.button === 1) handleClick(e);
  }, true);

  // ---------------- stabilize DOM (IDs + labels) ----------------
  const stabilizeDom = () => {
    document.querySelectorAll('nav a').forEach((a) => {
      ensureId(a, 'nav');
      if (!a.getAttribute('data-gtm-label')) a.setAttribute('data-gtm-label', (a.textContent || '').trim());
    });
    document.querySelectorAll('.sidebar a, .sidebar-links a').forEach((a) => {
      ensureId(a, 'side');
      if (!a.getAttribute('data-gtm-label')) a.setAttribute('data-gtm-label', (a.textContent || '').trim());
    });
    const heroBtn = document.querySelector('.home .hero .action-button');
    if (heroBtn) {
      ensureId(heroBtn, 'home');
      if (!heroBtn.getAttribute('data-gtm-label')) {
        heroBtn.setAttribute('data-gtm-label', (heroBtn.textContent || 'Learn More').trim());
      }
    }
  };

  router.afterEach(() => {
    requestAnimationFrame(() => {
      stabilizeDom();
      const mo = new MutationObserver(stabilizeDom);
      mo.observe(document.querySelector('#app') || document.body, { subtree: true, childList: true });
      setTimeout(() => mo.disconnect(), 1500);
    });
  });

  // ---------------- Navbar branding: "Firefly" ----------------
  const NAV_TEXT = 'Firefly';

  const apply = () => {
    const el = document.querySelector('.navbar .site-name');
    if (el && el.textContent !== NAV_TEXT) el.textContent = NAV_TEXT;
  };

  const startObserver = () => {
    const target = document.querySelector('.navbar') || document.body;
    const mo = new MutationObserver(() => apply());
    mo.observe(target, { childList: true, subtree: true, characterData: true });
    apply();
  };

  if (document.readyState !== 'loading') startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver);

  router.onReady(() => apply());
  router.afterEach(() => setTimeout(apply, 0));
};
