// ═══ RoofScan UK Service Worker — Offline + Push ═══
const CACHE_NAME = 'roofscan-v1';
const APP_SHELL = [
  '/index.html',
  '/ops.html',
  '/reports.html',
  '/airtable-api.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install — cache the app shell
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL).catch(function(err) {
        console.log('Cache addAll failed (some files may not exist yet):', err);
      });
    })
  );
});

// Activate — clean up old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first for Airtable API calls, cache first for app shell
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Airtable API — network first, fall back to cached JSON response if offline
  if (url.indexOf('api.airtable.com') !== -1) {
    e.respondWith(
      fetch(e.request)
        .then(function(res) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, resClone);
          });
          return res;
        })
        .catch(function() {
          return caches.match(e.request).then(function(cached) {
            return cached || new Response(JSON.stringify({records: [], offline: true}), {
              headers: {'Content-Type': 'application/json'}
            });
          });
        })
    );
    return;
  }

  // App shell — cache first, network fallback
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, resClone);
          });
          return res;
        }).catch(function() {
          // Offline and not cached — return a basic offline message for HTML requests
          if (e.request.headers.get('accept') && e.request.headers.get('accept').indexOf('text/html') !== -1) {
            return new Response(
              '<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px;background:#F8F6F0;color:#1C2B4A;"><h2>You\'re offline</h2><p>This page hasn\'t been loaded before, so it can\'t be shown without a connection.</p></body></html>',
              {headers: {'Content-Type': 'text/html'}}
            );
          }
        });
      })
    );
  }
});

// ─── PUSH NOTIFICATIONS ─────────────────────────────────────────
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = {title: 'RoofScan UK', body: e.data ? e.data.text() : 'New update'}; }

  var title = data.title || 'RoofScan UK';
  var options = {
    body: data.body || 'You have a new update',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/index.html' },
    vibrate: [100, 50, 100]
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// Click on notification — open or focus the relevant page
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/index.html';
  e.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf(url) !== -1 && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ─── BACKGROUND SYNC for offline checklist/status changes ───────
self.addEventListener('sync', function(e) {
  if (e.tag === 'roofscan-sync') {
    e.waitUntil(syncPendingChanges());
  }
});

function syncPendingChanges() {
  // Pending changes are read from IndexedDB by the page itself on reconnect.
  // This event just wakes the app up to process its own queue via postMessage.
  return self.clients.matchAll().then(function(clientList) {
    clientList.forEach(function(client) {
      client.postMessage({type: 'SYNC_PENDING'});
    });
  });
}
