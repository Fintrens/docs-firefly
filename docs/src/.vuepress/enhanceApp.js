export default ({ Vue, router, isServer }) => {
  if (isServer) return;

  // Lazy component: split out of main bundle
  Vue.component(
    'liveResult',
    () => import('./components/liveResult.vue')
  );

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

  // --------- Lightweight analytics helpers (same behavior as yours) ---------
  window.dataLayer = window.dataLayer || [];

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
    let id = `${prefix}-${base || 'x'}`,
      i = 1;
    while (document.getElementById(id)) {
      i++;
      id = `${prefix}-${base}-${i}`;
    }
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
      (url && url.pathname.startsWith('/live-result/')) ||
      (url && /youtu\.be|youtube\.com|sensibull|fintrens\.com/i.test(url.href))
    ) return 'redirect_external-link';
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

  const pushEvent = ({ event, el, href }) => {
    const link_id = ensureId(el, 'link');
    const link_text = labelOf(el);
    const link_url = href || '';
    const page_url = location.pathname + location.search;
    const link_area = areaOf(el);
    const site_section = sectionFromPath();
    window.dataLayer.push({ event, link_id, link_text, link_url, page_url, link_area, site_section });
  };

  const handleClick = (e) => {
    const el = findLink(e.target);
    if (!el) return;
    const rawHref = el.getAttribute('href') || '';
    const url = resolveUrl(rawHref);
    const href = url ? url.href : rawHref;
    const txt = labelOf(el) || '';
    const area = areaOf(el);

    if (area === 'nav') {
      const ev = mapNavEvent(rawHref, txt);
      if (ev) {
        pushEvent({ event: ev, el, href });
        return;
      }
    }
    if (isExternalOther(url, txt)) {
      pushEvent({ event: 'redirect_external-link', el, href });
      return;
    }
    const currentSection = sectionFromPath(location.pathname);
    if (currentSection === 'docs') return pushEvent({ event: 'redirect_docs', el, href });
    if (currentSection === 'tables') return pushEvent({ event: 'redirect_tables', el, href });
    if (currentSection === 'backtest_results') return pushEvent({ event: 'redirect_backtest_results', el, href });
    if (currentSection === 'home') return pushEvent({ event: 'redirect_home', el, href });
    const targetSection = sectionFromPath(url ? url.pathname : '');
    if (targetSection === 'docs') return pushEvent({ event: 'redirect_docs', el, href });
    if (targetSection === 'tables') return pushEvent({ event: 'redirect_tables', el, href });
    if (targetSection === 'backtest_results') return pushEvent({ event: 'redirect_backtest_results', el, href });
    if (targetSection === 'home') return pushEvent({ event: 'redirect_home', el, href });

    pushEvent({ event: 'redirect_external-link', el, href });
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
