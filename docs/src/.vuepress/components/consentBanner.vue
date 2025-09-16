<template>
    <div v-if="shouldShow" class="cb-fixed" role="dialog" aria-live="polite">
        <div class="cb-inner">
            <p class="cb-text">
                We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, and
                deliver personalized content.
                By clicking “OK, Got it”, you consent to the use of cookies as outlined in our
                <a href="/privacy.html" class="cb-link">Cookie Policy</a>.
            </p>
            <button class="cb-btn" @click="acceptAll">OK, Got it</button>
        </div>
    </div>
</template>

<script>
export default {
    name: 'ConsentBanner',
    data() {
        return {
            delayedShow: false,
            accepted: false,
            _clientThinksBannerNeeded: false
        };
    },
    computed: {
        shouldShow() {
            return this.delayedShow && !this.accepted && this._clientThinksBannerNeeded;
        }
    },
    mounted() {
        this._clientThinksBannerNeeded = true;

        // Read from localStorage first
        try {
            if (localStorage.getItem('consentAccepted') === 'true') {
                this.accepted = true;
            }
        } catch (_) { }

        // Fallback check: Cache Storage (async)
        if (!this.accepted && typeof window !== 'undefined' && 'caches' in window) {
            caches.open('fintrens-consent')
                .then(cache => cache.match('/__consent__'))
                .then(resp => { if (resp) this.accepted = true; })
                .catch(() => { });
        }

        // Delay show to help LCP
        this._timer = setTimeout(() => (this.delayedShow = true), 800);
    },
    beforeDestroy() {
        clearTimeout(this._timer);
    },
    methods: {
        async acceptAll() {
            // Persist in localStorage
            try { localStorage.setItem('consentAccepted', 'true'); } catch (_) { }

            // Also persist in Cache Storage (HTTPS/localhost)
            try {
                if (typeof window !== 'undefined' && 'caches' in window) {
                    const cache = await caches.open('fintrens-consent');
                    const req = new Request('/__consent__', { method: 'GET' });
                    const res = new Response('true', {
                        headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=31536000' }
                    });
                    await cache.put(req, res);
                }
            } catch (_) { }

            this.accepted = true;
        }
    }
};
</script>

<style scoped>
/* --- compact, minimal styles --- */
.cb-fixed {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    background: #0b68c1;
    color: #fff;
    font-size: 14px;
}

.cb-inner {
    max-width: 76rem;
    margin: 0 auto;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.cb-text {
    margin: 0;
    flex: 1 1 auto;
    line-height: 1.35;
}

.cb-link {
    color: #e6f3ff;
    text-decoration: underline;
}

.cb-btn {
    border: 0;
    padding: 6px 12px;
    font-weight: 600;
    font-size: 13px;
    background: #84c7f3;
    color: #f8f9fa;
    white-space: nowrap;
    cursor: pointer;
}

@media (max-width: 540px) {
    .cb-inner {
        flex-wrap: wrap;
    }

    .cb-btn {
        width: 100%;
        text-align: center;
    }
}
</style>
