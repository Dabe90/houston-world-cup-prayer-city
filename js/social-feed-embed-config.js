/**
 * Live Instagram / TikTok grids for dashboard.html
 *
 * Meta and TikTok do not offer a simple “profile URL” you can drop into an iframe.
 * You connect accounts through a widget provider; they host the feed and give you an embed.
 *
 * Quick path (example — SnapWidget has a free tier):
 *   1. Sign up at https://snapwidget.com (or https://lightwidget.com for Instagram).
 *   2. Create one widget per feed you want (e.g. @ddbs.global IG, @ddbs.global TikTok).
 *   3. Copy the embed code and find the iframe src="https://..." URL.
 *   4. Paste that full https URL into the arrays below (add one object per widget).
 *
 * For multiple Instagram accounts (@_abedamilola, @ddbs.htx, @ddbs.global), create
 * one widget each (free tiers may limit count — check the provider), or use a paid
 * plan that merges feeds.
 */
window.__PRAYER_CITY_SOCIAL_FEEDS__ = {
  /** Default iframe height in pixels (each embed can override with `height`) */
  defaultHeight: 400,

  /**
   * Instagram iframe URLs from your widget provider.
   * Example: { src: 'https://snapwidget.com/embed/123456', label: '@ddbs.global', height: 420 }
   */
  instagramEmbeds: [],

  /**
   * TikTok iframe URLs from your widget provider (SnapWidget, SociableKIT, Elfsight, etc.).
   */
  tiktokEmbeds: [],
};
