const CACHE_NAME = 'Tarot-free-v2';
// 把你專案裡固定不會變的檔案寫進來 (塔羅牌預設圖片也可以加進來)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './tarot_style.css',
  './tarot_ui.js',
  './tarot_engines.js',
  './tarot_data.js',
  './tarot_touch.js',
  './sync_tarot.js',
  './tool/tailwindcss.js',
  './tool/matter.min.js',
  './tool/jszip.min.js',
  './tool/localforage.min.js',
  './assets/cards/cardback.jpg',
  './assets/cards/cups_1.jpg',
  './assets/cards/cups_2.jpg',
  './assets/cards/cups_3.jpg',
  './assets/cards/cups_4.jpg',
  './assets/cards/cups_5.jpg',
  './assets/cards/cups_6.jpg',
  './assets/cards/cups_7.jpg',
  './assets/cards/cups_8.jpg',
  './assets/cards/cups_9.jpg',
  './assets/cards/cups_10.jpg',
  './assets/cards/cups_11.jpg',
  './assets/cards/cups_12.jpg',
  './assets/cards/cups_13.jpg',
  './assets/cards/cups_14.jpg',
  './assets/cards/major_0.jpg',
  './assets/cards/major_1.jpg',
  './assets/cards/major_2.jpg',
  './assets/cards/major_3.jpg',
  './assets/cards/major_4.jpg',
  './assets/cards/major_5.jpg',
  './assets/cards/major_6.jpg',
  './assets/cards/major_7.jpg',
  './assets/cards/major_8.jpg',
  './assets/cards/major_9.jpg',
  './assets/cards/major_10.jpg',
  './assets/cards/major_11.jpg',
  './assets/cards/major_12.jpg',
  './assets/cards/major_13.jpg',
  './assets/cards/major_14.jpg',
  './assets/cards/major_15.jpg',
  './assets/cards/major_16.jpg',
  './assets/cards/major_17.jpg',
  './assets/cards/major_18.jpg',
  './assets/cards/major_19.jpg',
  './assets/cards/major_20.jpg',
  './assets/cards/major_21.jpg',
  './assets/cards/pentacles_1.jpg',
  './assets/cards/pentacles_2.jpg',
  './assets/cards/pentacles_3.jpg',
  './assets/cards/pentacles_4.jpg',
  './assets/cards/pentacles_5.jpg',
  './assets/cards/pentacles_6.jpg',
  './assets/cards/pentacles_7.jpg',
  './assets/cards/pentacles_8.jpg',
  './assets/cards/pentacles_9.jpg',
  './assets/cards/pentacles_10.jpg',
  './assets/cards/pentacles_11.jpg',
  './assets/cards/pentacles_12.jpg',
  './assets/cards/pentacles_13.jpg',
  './assets/cards/pentacles_14.jpg',
  './assets/cards/swords_1.jpg',
  './assets/cards/swords_2.jpg',
  './assets/cards/swords_3.jpg',
  './assets/cards/swords_4.jpg',
  './assets/cards/swords_5.jpg',
  './assets/cards/swords_6.jpg',
  './assets/cards/swords_7.jpg',
  './assets/cards/swords_8.jpg',
  './assets/cards/swords_9.jpg',
  './assets/cards/swords_10.jpg',
  './assets/cards/swords_11.jpg',
  './assets/cards/swords_12.jpg',
  './assets/cards/swords_13.jpg',
  './assets/cards/swords_14.jpg',
  './assets/cards/wands_1.jpg',
  './assets/cards/wands_2.jpg',
  './assets/cards/wands_3.jpg',
  './assets/cards/wands_4.jpg',
  './assets/cards/wands_5.jpg',
  './assets/cards/wands_6.jpg',
  './assets/cards/wands_7.jpg',
  './assets/cards/wands_8.jpg',
  './assets/cards/wands_9.jpg',
  './assets/cards/wands_10.jpg',
  './assets/cards/wands_11.jpg',
  './assets/cards/wands_12.jpg',
  './assets/cards/wands_13.jpg',
  './assets/cards/wands_14.jpg',
];

// 安裝時：把靜態資源抓下來存進 Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 正在寫入離線快取...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 啟動時：清除舊版本的 Cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // ✨ 核心強化 1：防呆機制，過濾掉擴充功能發出的奇怪請求 (如 chrome-extension://)
  // 只攔截正常的 http 與 https 網頁資源
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. 如果快取裡有，直接秒殺回傳 (極致效能)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 如果快取沒有，去網路上抓
      return fetch(event.request).then((networkResponse) => {
        // ✨ 核心強化 2：放寬對圖片的限制 (容許 opaque response)
        // 有些外部網址的圖片 (如 CDN) type 會是 opaque，status 會是 0
        // 放寬這個條件，能確保你未來如果載入外部圖片也能成功快取！
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }

        // 3. 抓回來後，順手牽羊複製一份存進快取，下次就能離線使用了！
        const responseToCache = networkResponse.clone();

        // 建議這裡可以使用動態快取的專屬名稱，例如 'tarot-dynamic-cache-v1'
        // 如果你統一用 CACHE_NAME 也可以，只是未來更新快取時要小心不要全洗掉
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // 如果斷網了，且快取也沒有，就回傳錯誤
        console.log('📴 處於離線狀態，且找不到快取資源:', event.request.url);
        // (進階玩法：如果是圖片請求失敗，可以在這裡回傳一張 "離線專用" 的破圖佔位符號)

        // ✨ 核心修復：當網路斷線且沒快取時，必須給瀏覽器一個「空的回應」，不能讓它等不到東西！
        return new Response('離線模式無法取得資源', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});