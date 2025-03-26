

const { description } = require('../../package')
//module.exports = require('../src/browser/builds/algoliasearch.jquery.js');
module.exports = {
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#title
   */
  title: 'Firefly',
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#description
   */
  description: description,

  /**
   * Extra tags to be injected to the page HTML `<head>`
   *
   * ref：https://v1.vuepress.vuejs.org/config/#head
   */
  head: [
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }]
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
        target: "_black"
      },
      {
        text: 'Verified Result',
        link: 'https://web.sensibull.com/verified-pnl/chivalrous-sardine/1d1jrssPASS0HN',
        target: '_self',
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

  ]
}
