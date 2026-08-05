/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

clientsClaim();

// CRA がビルド時に生成するプリキャッシュマニフェストを展開する
precacheAndRoute(self.__WB_MANIFEST);

// SPA のフォールバック: ナビゲーションリクエストはすべて index.html へ
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/_')) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// 画像キャッシュ（CacheFirst: 30日）
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// Google Fonts キャッシュ（StaleWhileRevalidate）
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);
