// ═══ RoofScan UK Service Worker — Offline + Push ═══
const CACHE_NAME = 'roofscan-v6'; // bumped so old caches (including any saved API responses) are deleted
const APP_SHELL = [
  'hub.html',
  'ops.html',
  'reports.html',
  'airtable-api.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
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

// Fetch — only same-site pages and files are cached. Calls to the API Worker (roofscan-api...workers.dev)
// carry a login token and return one person's private data, so the service worker never touches them:
// caching them let the next person to log in on the same browser be shown the previous person's data.
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (e.request.method !== 'GET' || new URL(url).origin !== self.location.origin) {
    if (url.indexOf('api.airtable.com') === -1) return; // let the browser handle it normally
  }

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

  // Site pages and files — network first (so updates always show), saved copy only when offline
  if (e.request.method === 'GET') {
    e.respondWith(
      fetch(e.request).then(function(res) {
        if (res && res.ok) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, resClone);
          });
        }
        return res;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          if (cached) return cached;
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
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: data.url || 'hub.html' },
    vibrate: [100, 50, 100]
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// Click on notification — open or focus the relevant page
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || 'hub.html';
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
