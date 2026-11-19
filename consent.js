/* RoofScan UK: cookie consent + Google Ads tag + Meta (Facebook) pixel.
   Meta pixel: paste the Pixel ID from Meta Events Manager into PIXEL below. While it is empty, no Meta code loads.
   The Google tag only loads after the visitor clicks Accept (UK PECR).
   Choice is remembered for 6 months. window.rsCookieSettings() reopens the banner. */
(function () {
  var TAG = 'AW-18532768672';
  var PIXEL = '';   // Meta Pixel ID, e.g. '123456789012345'
  var KEY = 'rs_cookie_choice';
  var MAX_AGE = 1000 * 60 * 60 * 24 * 182;

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && v.t && Date.now() - v.t < MAX_AGE) return v.c;
    } catch (e) {}
    return null;
  }
  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify({ c: c, t: Date.now() })); } catch (e) {}
  }

  var loaded = false;
  function loadTag() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('consent', 'default', {
      ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted'
    });
    gtag('js', new Date());
    gtag('config', TAG);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + TAG;
    document.head.appendChild(s);
    if (PIXEL) {
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', PIXEL);
      fbq('track', 'PageView');
    }
  }

  // One call for every step of the quote, sent to Google and Meta only if the visitor accepted cookies.
  // Standard Meta events (Lead, InitiateCheckout, Purchase) use fbq('track'); anything else is a custom event.
  var STANDARD = { Lead: 1, InitiateCheckout: 1, Purchase: 1, ViewContent: 1, Contact: 1 };
  window.rsTrack = function (name, params) {
    if (!loaded) return;
    params = params || {};
    try { if (window.gtag) gtag('event', name, params); } catch (e) {}
    try { if (window.fbq) fbq(STANDARD[name] ? 'track' : 'trackCustom', name, params); } catch (e) {}
  };

  function removeBanner() {
    var b = document.getElementById('rs-cookie');
    if (b) b.parentNode.removeChild(b);
  }

  function showBanner() {
    if (document.getElementById('rs-cookie')) return;
    var b = document.createElement('div');
    b.id = 'rs-cookie';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Cookie choice');
    // 19 Nov 2026: compact, so it never covers a big part of a phone screen (about 70px tall at 375px wide).
    b.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;max-width:560px;margin:0 auto;' +
      'background:#1C2B4A;color:#fff;border-radius:12px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.25);' +
      'font:12.5px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding-bottom:calc(10px + env(safe-area-inset-bottom));' +
      'display:flex;align-items:center;gap:10px;';
    var btn = 'padding:8px 12px;border-radius:9px;font-size:13px;cursor:pointer;white-space:nowrap;flex:none;';
    b.innerHTML =
      '<p style="margin:0;flex:1;min-width:0">We use ' + (PIXEL ? 'Google Ads and Meta cookies' : 'a Google Ads cookie') + ' to see which adverts lead to bookings, only if you accept. ' +
      '<a href="privacy.html#cookies" style="color:#C9A84C">More info</a></p>' +
      '<button type="button" id="rs-cookie-yes" style="' + btn + 'border:0;background:#C9A84C;color:#1C2B4A;font-weight:700">Accept</button>' +
      '<button type="button" id="rs-cookie-no" style="' + btn + 'border:1.5px solid rgba(255,255,255,.5);background:transparent;color:#fff;font-weight:600">Reject</button>';
    document.body.appendChild(b);
    document.getElementById('rs-cookie-yes').onclick = function () { save('yes'); removeBanner(); loadTag(); };
    document.getElementById('rs-cookie-no').onclick = function () { save('no'); removeBanner(); };
  }

  window.rsCookieSettings = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (loaded) { location.reload(); return; }
    showBanner();
  };

  var choice = read();
  if (choice === 'yes') {
    loadTag();
  } else if (choice !== 'no') {
    if (document.body) showBanner();
    else document.addEventListener('DOMContentLoaded', showBanner);
  }
})();
