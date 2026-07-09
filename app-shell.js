// ═══ RoofScan UK — Shared App Shell: SW registration, offline queue, push ═══

// ─── REGISTER SERVICE WORKER ─────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').then(function(reg) {
      console.log('SW registered');
    }).catch(function(err) {
      console.log('SW registration failed:', err);
    });
  });

  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SYNC_PENDING') {
      RSOffline.flushQueue();
    }
  });
}

// ─── OFFLINE QUEUE (for status changes / checklist made without signal) ──
var RSOffline = {
  QUEUE_KEY: 'rs_offline_queue',

  isOnline: function() { return navigator.onLine; },

  queueAction: function(action) {
    var queue = this.getQueue();
    queue.push(Object.assign({ts: Date.now()}, action));
    try { localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue)); } catch(e) {}
    this.updateBanner();
  },

  getQueue: function() {
    try { return JSON.parse(localStorage.getItem(this.QUEUE_KEY)) || []; } catch(e) { return []; }
  },

  clearQueue: function() {
    try { localStorage.removeItem(this.QUEUE_KEY); } catch(e) {}
    this.updateBanner();
  },

  flushQueue: async function() {
    if (!this.isOnline()) return;
    var queue = this.getQueue();
    if (!queue.length) return;
    if (typeof AT === 'undefined' || !AT.hasToken()) return;

    var remaining = [];
    for (var i = 0; i < queue.length; i++) {
      var item = queue[i];
      try {
        if (item.type === 'status') {
          await AT.setJobStatus(item.recordId, item.status);
        } else if (item.type === 'score') {
          await AT.setRoofScore(item.recordId, item.score);
        } else if (item.type === 'notes') {
          await AT.appendJobNotes(item.recordId, item.notes);
        }
      } catch(e) {
        remaining.push(item); // keep failed ones for next attempt
      }
    }
    try { localStorage.setItem(this.QUEUE_KEY, JSON.stringify(remaining)); } catch(e) {}
    this.updateBanner();
  },

  updateBanner: function() {
    var queue = this.getQueue();
    var banner = document.getElementById('offline-banner');
    if (!banner) return;
    if (!this.isOnline()) {
      banner.style.display = 'flex';
      banner.querySelector('.ob-text').textContent = queue.length
        ? 'Offline — ' + queue.length + ' change' + (queue.length>1?'s':'') + ' will sync when reconnected'
        : 'Offline — changes will sync when reconnected';
      banner.className = 'offline-banner offline';
    } else if (queue.length) {
      banner.style.display = 'flex';
      banner.querySelector('.ob-text').textContent = 'Syncing ' + queue.length + ' change' + (queue.length>1?'s':'') + '...';
      banner.className = 'offline-banner syncing';
      this.flushQueue();
    } else {
      banner.style.display = 'none';
    }
  }
};

window.addEventListener('online', function() { RSOffline.updateBanner(); RSOffline.flushQueue(); });
window.addEventListener('offline', function() { RSOffline.updateBanner(); });
document.addEventListener('DOMContentLoaded', function() { RSOffline.updateBanner(); });

// ─── PUSH NOTIFICATIONS ────────────────────────
var RSPush = {
  isSupported: function() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  getPermissionState: function() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  },

  async requestPermission() {
    if (!this.isSupported()) return 'unsupported';
    var perm = await Notification.requestPermission();
    if (perm === 'granted') {
      try { localStorage.setItem('rs_push_enabled', '1'); } catch(e) {}
    }
    return perm;
  },

  // Local notification fallback for browsers/devices where push isn't available
  // (e.g. iOS Safari without the app added to home screen)
  showLocalAlert: function(title, body) {
    if (this.getPermissionState() === 'granted' && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(function(reg) {
        reg.showNotification(title, {
          body: body,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png'
        });
      });
    }
  }
};

// ─── VOICE NOTES (Web Speech API) ────────────────────
var RSVoice = {
  recognition: null,
  activeField: null,

  isSupported: function() {
    return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
  },

  init: function() {
    if (!this.isSupported()) return false;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-GB';
    return true;
  },

  start: function(fieldEl, btnEl) {
    if (!this.recognition) { if (!this.init()) { alert('Voice input is not supported on this device.'); return; } }
    this.activeField = fieldEl;
    var startVal = fieldEl.value ? fieldEl.value + ' ' : '';

    btnEl.classList.add('listening');
    btnEl.textContent = '🔴';

    this.recognition.onresult = function(e) {
      var transcript = '';
      for (var i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      fieldEl.value = startVal + transcript;
      fieldEl.dispatchEvent(new Event('input'));
    };

    this.recognition.onerror = function(e) {
      btnEl.classList.remove('listening');
      btnEl.textContent = '🎤';
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.log('Voice recognition error:', e.error);
      }
    };

    this.recognition.onend = function() {
      btnEl.classList.remove('listening');
      btnEl.textContent = '🎤';
    };

    try { this.recognition.start(); } catch(e) { console.log('Voice start error:', e); }
  },

  stop: function() {
    if (this.recognition) { try { this.recognition.stop(); } catch(e) {} }
  }
};
