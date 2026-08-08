// 'install' 事件在 Service Worker 首次被安装时触发。
self.addEventListener('install', event => {
  self.skipWaiting();
});

// 'activate' 事件在 Service Worker 变为激活状态时触发。
self.addEventListener('activate', event => {
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
});