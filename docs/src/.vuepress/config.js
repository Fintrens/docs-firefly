

const { description } = require('../../package')
//module.exports = require('../src/browser/builds/algoliasearch.jquery.js');
module.exports = {
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#title
   */
  title: 'Firefly by Fintrens: Verified Algo Trading & Backtest Results (5Y)',
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#description
   */
  description: 'Firefly by Fintrens: Swarm Intelligence trading bot with transparent 5-year backtest results. Automated, risk-managed strategies for stocks, options, commodities, crypto.',

  /**
   * Extra tags to be injected to the page HTML `<head>`
   *
   * ref：https://v1.vuepress.vuejs.org/config/#head
   */
  head: [
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],

    // SEO
    ['meta', { name: 'description', content: 'Firefly by Fintrens: Swarm Intelligence trading bot with transparent 5-year backtest results. Automated, risk-managed strategies for stocks, options, commodities, crypto.' }],
    ['link', { rel: 'canonical', href: 'https://www.docs.firefly.fintrens.com/' }],
    ['meta', { name: "keywords", content: 'firefly by fintrens, algorithmic trading bot, automated trading software, fintech trading platform, swarm intelligence trading, backtesting results, quantitative trading bot, fintrens algorithmic trading, firefly trading bot, algo trading india, trading bot backtest, automated trading system, financial trading algorithm, risk management trading, portfolio optimization bot, firefly by fintrens trading bot, best algorithmic trading bot india fintrens, automated trading with 5-year backtest results firefly, swarm intelligence trading bot firefly fintrens, quantitative trading platform with 267% returns firefly, algo trading bot options strategies fintrens, automated trading software with risk management firefly, fintrens trading platform, firefly automated trading, fintrens backtest results, firefly quantitative trading, fintrens swarm intelligence, firefly trading technology india, fintrens financial algorithm platform.' }],

    ['meta', { property: 'og:title', content: 'Firefly by Fintrens: 5-Year Verified Backtest Results' }],
    ['meta', { property: 'og:description', content: 'See real 5-year backtest results with Firefly by Fintrens. Swarm Intelligence powered trading, risk-managed strategies for stocks, options, commodities, and crypto. Trusted by quant traders.' }],
    ['meta', { property: 'og:url', content: 'https://www.docs.firefly.fintrens.com/' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: 'https://www.docs.firefly.fintrens.com/path-to-your-image.jpg' }], // TODO: replace with your real image (1200x630 recommended)
    ['meta', { property: 'og:site_name', content: 'Firefly by Fintrens' }],

    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'Firefly by Fintrens: Verified Algo Trading Bot with 5Y Backtest' }],
    ['meta', { name: 'twitter:description', content: 'Backtested, transparent, Swarm Intelligence driven automated trading for stocks, options, and more. Data-driven profits, robust risk management by Fintrens.' }],

    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Firefly by Fintrens",
        "operatingSystem": "Web-based",
        "applicationCategory": "FinanceApplication",
        "offers": {
          "@type": "Offer",
          "url": "https://www.docs.firefly.fintrens.com/",
          "price": 0,
          "priceCurrency": "INR"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": 4.8,
          "ratingCount": 120
        },
        "description": "Firefly by Fintrens: Swarm Intelligence powered trading bot with transparent 5-year backtest results.",
        "publisher": {
          "@type": "Organization",
          "name": "Fintrens Technologies Pvt. Ltd.",
          "url": "https://www.fintrens.com"
        },
        "sameAs": [
          "https://www.fintrens.com"
        ]
      })
    ],
    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Firefly by Fintrens",
        "operatingSystem": "Web-based",
        "applicationCategory": "FinanceApplication",
        "offers": {
          "@type": "Offer",
          "url": "https://www.docs.firefly.fintrens.com/",
          "price": "Contact for pricing"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "ratingCount": "120"
        },
        "description": "Firefly by Fintrens: Swarm Intelligence powered trading bot with transparent 5-year backtest performance, multi-asset support, full risk management, and adaptive strategies.",
        "provider": {
          "@type": "Organization",
          "name": "Fintrens Technologies Pvt. Ltd.",
          "url": "https://www.fintrens.com"
        }
      })
    ],
    [
      'script',
      {},
      `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','GTM-WVZ3WWM4');`
    ],
        [
      'link',
      {
        rel: 'preload',
        as: 'image',
        href: '/Final.png',
        fetchpriority: 'high'
      }
    ]
  ],

  /**
   * Theme configuration, here is the default theme configuration for VuePress.
   *
   * ref：https://v1.vuepress.vuejs.org/theme/default-theme-config.html
   */



  themeConfig: {
    URL: 'http://192.168.0.6:8080/',
    baseUrl: '/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    repo: '',
    editLinks: false,
    docsDir: '',
    editLinkText: '',
    lastUpdated: false,

    /* algolia  : {
       appId: 'T1ZFHCPGT1',
       apiKey: 'b3484d07a262a39f9cc8c84ad06d3f3f',
       indexName: 'FireFly',
       contextualSearch: true,
       },*/
    nav: [
      {
        text: 'Product Video',
        link: 'https://youtu.be/X8zcysqXlSA?si=HwefjDjRrD9CvvXK',
        target: '_self',
        rel: false,
      },
      {
        text: 'Docs',
        link: '/guide/',
      },
      {
        text: 'Backtest Result',
        link: '/tables/Options_Elysium/',
        target: "_self"
      },
      {
        text: 'Verified Result',
        link: 'https://web.sensibull.com/verified-pnl/chivalrous-sardine/1d1jrssPASS0HN',
        target: '_blank',
        rel: false
      },
      {
        text: 'Live Result',
        link: '/live-result/',
      },
      {
        text: 'About us',
        link: 'https://www.fintrens.com/',
        target: '_self',
        rel: false
      }
    ],
    sidebar: {
      '/guide/': [
        {
          title: 'Documentation',
          collapsable: false,
          children: [
            '',
            'The-World-of-Quantitative-Trading',
            'Algorithmic-Trading',
            'Backtesting-Results',
            'Risk-Management',
            'System-Architecture',
            'Conclusion'
          ]
        }
      ],
      '/tables/': [
        {
          title: 'Backtest result',
          collapsable: false,
          children: [
            {
              title: 'Options Elysium',
              collapsable: true,
              style: 'cursor: pointer; user-select: none;', // Inline style for clickable hand cursor
              children: [
                'Options_Elysium',
                {
                  title: 'Backtest Results',
                  style: 'cursor: pointer; user-select: none;', // Inline style for clickable hand cursor
                  collapsable: true,
                  children: [
                    'Options_Elysium_2020',
                    'Options_Elysium_2021',
                    'Options_Elysium_2022',
                    'Options_Elysium_2023',
                    'Options_Elysium_2024',
                  ]
                }
              ]
            },
            {
              title: 'Options Ember',
              collapsable: true,
              children: [
                'Options_Ember',
                {
                  title: 'Backtest Results',
                  style: 'cursor: pointer; user-select: none;', // Inline style for clickable hand cursor
                  collapsable: true,
                  children: [
                    'Options_Ember_2020',
                    'Options_Ember_2021',
                    'Options_Ember_2022',
                    'Options_Ember_2023',
                    'Options_Ember_2024',
                  ]
                }
              ]
            },
            {
              title: 'Options Mirage',
              collapsable: true,
              children: [
                'Options_Mirage',
                {
                  title: 'Backtest Results',
                  style: 'cursor: pointer; user-select: none;', // Inline style for clickable hand cursor
                  collapsable: true,
                  children: [
                    'Options_Mirage_2020',
                    'Options_Mirage_2021',
                    'Options_Mirage_2022',
                    'Options_Mirage_2023',
                    'Options_Mirage_2024',
                  ]
                }
              ]
            }
          ]
        }
      ]


    }
  },

  /**
   * Apply plugins，ref：https://v1.vuepress.vuejs.org/zh/plugin/
   */
  plugins: [
    [],
    '@vuepress/plugin-back-to-top',
    '@vuepress/plugin-medium-zoom',
    '@vuepress-plugin-smooth-scroll',

  ],
  shouldPrefetch: () => false,

  // Only preload truly critical assets
  shouldPreload: (file, type) => {
    if (type === 'script') return /app\.[\w]+\.js$/.test(file);  // entry only
    if (type === 'style')  return /styles\.[\w]+\.css$/.test(file);
    if (type === 'font')   return true; // small, render-blocking
    return false;
  },

  configureWebpack: (config, isServer) => {
    if (!isServer) {
      // Kill source maps in prod
      config.devtool = false;
      // Minify aggressively
      config.optimization = config.optimization || {};
      config.optimization.minimizer = (config.optimization.minimizer || []).map(m => {
        if (m.options && m.options.terserOptions) {
          m.options.terserOptions.compress = {
            ...(m.options.terserOptions.compress || {}),
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.info','console.debug','console.warn'],
          };
        }
        return m;
      });

      // Force smaller, more cacheable chunks
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 160000,
        cacheGroups: {
          vendor_vue: { test: /[\\/]node_modules[\\/]vue[\\/]/, name: 'vendor-vue', priority: 30, chunks: 'all' },
          vendor_misc: { test: /[\\/]node_modules[\\/](lodash|dayjs|moment|chart|echarts|prismjs)[\\/]/, name: 'vendor-misc', priority: 20, chunks: 'all' },
        }
      };
    }
  },
}
