// RoofScan photo marking: red circles round defects and numbered pins for the roof map.
// Used by reports.html (roof report) and thermal-report.html (thermal report).
// Marks are stored as fractions of the photo's width/height (0 to 1), so they survive any resize,
// and are only drawn onto a copy of the photo when the report is built. The original photo is never changed.
//   circles: [{ x, y, r }]   r is a fraction of the photo's shorter side
//   pins:    [{ n, x, y }]   n is the number printed in the pin
(function(){
  var RED = '#E0262B', NAVY = '#1C2B4A';

  function loadImg(src){
    return new Promise(function(res, rej){ var im = new Image(); im.onload = function(){ res(im); }; im.onerror = function(){ rej(new Error('Could not open the photo.')); }; im.src = src; });
  }
  function dataUrl(b64, mime){ return 'data:' + (mime || 'image/jpeg') + ';base64,' + b64; }
  function clamp(v, a, b){ v = Number(v); return isNaN(v) ? a : Math.min(b, Math.max(a, v)); }
  function cleanCircles(list){
    return (Array.isArray(list) ? list : []).map(function(c){ return { x: clamp(c.x, 0, 1), y: clamp(c.y, 0, 1), r: clamp(c.r, 0.02, 0.5) }; }).slice(0, 8);
  }
  function cleanPins(list){
    return (Array.isArray(list) ? list : []).filter(function(p){ return p && p.n != null; }).map(function(p){ return { n: String(p.n).slice(0, 6), x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) }; });
  }

  function drawMarks(ctx, w, h, circles, pins, scale){
    scale = scale || 1;
    var s = Math.min(w, h);
    (circles || []).forEach(function(c){
      var lw = Math.max(3, Math.round(s / 110)) * scale;
      ctx.beginPath(); ctx.arc(c.x * w, c.y * h, c.r * s, 0, Math.PI * 2);
      ctx.lineWidth = lw + 4 * scale; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
      ctx.lineWidth = lw; ctx.strokeStyle = RED; ctx.stroke();
    });
    (pins || []).forEach(function(p){
      var r = Math.max(13, Math.round(s / 34)) * scale, x = p.x * w, y = p.y * h;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = NAVY; ctx.fill();
      ctx.lineWidth = Math.max(2, r / 6); ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.round(r * (String(p.n).length > 2 ? 0.75 : 1)) + 'px Arial, sans-serif';
      ctx.fillText(String(p.n), x, y + r * 0.05);
    });
  }

  // Returns { b64, w, h } of a JPEG copy with the marks drawn on. With no marks, returns the photo unchanged.
  async function bake(b64, marks, mime){
    marks = marks || {};
    var circles = cleanCircles(marks.circles), pins = cleanPins(marks.pins);
    if(!b64 || (!circles.length && !pins.length)) return null;
    var im = await loadImg(dataUrl(b64, mime));
    var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    var ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0);
    drawMarks(ctx, c.width, c.height, circles, pins, 1);
    return { b64: c.toDataURL('image/jpeg', 0.88).split(',')[1], w: c.width, h: c.height };
  }

  // Small copy for sending to the AI (keeps calls quick and cheap).
  async function smallCopy(b64, mime, maxW){
    var im = await loadImg(dataUrl(b64, mime)), sc = Math.min(1, (maxW || 1024) / im.naturalWidth);
    var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  }
  function parseJSON(text){
    var t = String(text || '').replace(/```json|```/g, ''); var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if(a < 0 || b <= a) throw new Error('The AI reply was incomplete. Try again, or mark it yourself.');
    try { return JSON.parse(t.slice(a, b + 1)); } catch(e){ throw new Error('The AI reply was incomplete. Try again, or mark it yourself.'); }
  }

  // ask(messages, maxTokens) must return the AI's reply text. Each page passes its own (it holds the login).
  async function aiCircles(ask, b64, mime, note, thermal){
    var img = await smallCopy(b64, mime, 1024);
    var prompt = 'This is a photo from a UK drone ' + (thermal ? 'thermal (infrared) roof survey' : 'roof inspection') + '. '
      + (note ? 'The inspector\'s note for it says: "' + String(note).slice(0, 400) + '". ' : '')
      + 'Find the ' + (thermal ? 'warm or cool area described (or the most significant temperature pattern)' : 'defect described (or the most significant visible defect)') + ' and give circles that would surround it on the photo. '
      + 'Reply with ONLY JSON: {"circles":[{"x":0.5,"y":0.5,"r":0.1}]} where x and y are the centre as fractions of the photo width and height (0 = left/top, 1 = right/bottom) and r is the radius as a fraction of the photo\'s shorter side. '
      + 'Use one circle per separate defect, at most 4. If you cannot see a defect, reply {"circles":[]}.';
    var text = await ask([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }, { type: 'text', text: prompt }] }], 300);
    return cleanCircles(parseJSON(text).circles);
  }
  // items: [{ n, label }]. Returns pins for the ones it can place on the overview photo.
  async function aiPins(ask, b64, mime, items, thermal){
    var img = await smallCopy(b64, mime, 1280);
    var list = items.map(function(it){ return it.n + ': ' + String(it.label).slice(0, 160); }).join('\n');
    var prompt = 'This is an overview photo of a roof from a UK drone ' + (thermal ? 'thermal survey' : 'roof inspection') + '. These are the report findings, each with a number:\n' + list + '\n\n'
      + 'For each finding, work out where on THIS photo it is (use the element named: chimney, ridge, valley, gutter, front or rear slope, flat roof, and so on) and place a pin there. '
      + 'Reply with ONLY JSON: {"pins":[{"n":"1","x":0.5,"y":0.5}]} with x and y as fractions of the photo width and height. Leave out any finding you cannot place with reasonable confidence. Keep pins at least 0.04 apart so the numbers do not overlap.';
    var text = await ask([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }, { type: 'text', text: prompt }] }], 600);
    var want = {}; items.forEach(function(it){ want[String(it.n)] = true; });
    return cleanPins(parseJSON(text).pins).filter(function(p){ return want[p.n]; });
  }

  // ── Editor ──
  // opts: { b64, mime, title, hint, mode:'circles'|'pins', marks:{circles,pins}, pinItems:[{n,label}], onAi: async () => marks, onDone(marks) }
  function open(opts){
    var mode = opts.mode || 'circles';
    var marks = { circles: cleanCircles((opts.marks || {}).circles), pins: cleanPins((opts.marks || {}).pins) };
    var history = [];
    function snap(){ history.push(JSON.stringify(marks)); if(history.length > 30) history.shift(); }
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,16,30,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;font-family:Arial,sans-serif;';
    ov.innerHTML = '<div style="color:#fff;font-weight:700;font-size:16px;margin-bottom:4px;text-align:center;">' + (opts.title || (mode === 'pins' ? 'Roof map' : 'Circle the defect')) + '</div>'
      + '<div id="rsa-hint" style="color:#C9D6E8;font-size:13px;margin-bottom:8px;text-align:center;max-width:720px;">' + (opts.hint || (mode === 'pins' ? 'Drag a pin to move it. To place one that is missing, pick its number below, then tap the photo.' : 'Press and drag on the photo to draw a circle. Tap a circle to remove it.')) + '</div>'
      + '<canvas id="rsa-cv" style="max-width:96vw;max-height:66vh;touch-action:none;background:#000;border-radius:6px;cursor:crosshair;"></canvas>'
      + '<div id="rsa-pinbar" style="display:' + (mode === 'pins' ? 'flex' : 'none') + ';flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px;max-width:760px;"></div>'
      + '<div id="rsa-msg" style="color:#FFD58A;font-size:13px;min-height:18px;margin-top:6px;text-align:center;"></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px;">'
      + (opts.onAi ? '<button id="rsa-ai" style="' + btn('#C9A84C', '#1C2B4A') + '">' + (mode === 'pins' ? 'Place pins with AI' : 'Find it with AI') + '</button>' : '')
      + '<button id="rsa-undo" style="' + btn('#33415C', '#fff') + '">Undo</button>'
      + '<button id="rsa-clear" style="' + btn('#33415C', '#fff') + '">Clear all</button>'
      + '<button id="rsa-cancel" style="' + btn('#33415C', '#fff') + '">Cancel</button>'
      + '<button id="rsa-done" style="' + btn('#27AE60', '#fff') + '">Done</button></div>';
    function btn(bg, fg){ return 'background:' + bg + ';color:' + fg + ';border:0;border-radius:8px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;'; }
    document.body.appendChild(ov);
    var cv = ov.querySelector('#rsa-cv'), ctx = cv.getContext('2d'), im = null, drag = null, placeN = null;
    function msg(t){ ov.querySelector('#rsa-msg').textContent = t || ''; }
    function draw(extra){
      if(!im) return;
      ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(im, 0, 0, cv.width, cv.height);
      var c = marks.circles.slice(); if(extra) c.push(extra);
      drawMarks(ctx, cv.width, cv.height, c, marks.pins, 1);
      renderPinBar();
    }
    function renderPinBar(){
      if(mode !== 'pins') return;
      var bar = ov.querySelector('#rsa-pinbar'), placed = {}; marks.pins.forEach(function(p){ placed[p.n] = true; });
      bar.innerHTML = (opts.pinItems || []).map(function(it){
        var on = placed[String(it.n)], sel = placeN === String(it.n);
        return '<button data-n="' + String(it.n) + '" title="' + String(it.label).replace(/"/g, '&quot;') + '" style="' + btn(sel ? '#C9A84C' : (on ? '#1B4F8A' : '#5B6B85'), '#fff') + 'padding:6px 10px;font-size:12.5px;">' + String(it.n) + (on ? '' : ' (not placed)') + '</button>';
      }).join('');
      bar.querySelectorAll('button').forEach(function(b){ b.onclick = function(){ placeN = b.dataset.n; msg('Now tap the photo where ' + placeN + ' is.'); renderPinBar(); }; });
    }
    function pos(e){ var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }
    function shorter(){ return Math.min(cv.width, cv.height); }
    function hitCircle(p){
      for(var i = marks.circles.length - 1; i >= 0; i--){ var c = marks.circles[i], dx = (p.x - c.x) * cv.width, dy = (p.y - c.y) * cv.height;
        if(Math.sqrt(dx * dx + dy * dy) <= c.r * shorter() + 8) return i; }
      return -1;
    }
    function hitPin(p){
      var rad = Math.max(13, Math.round(shorter() / 34)) + 6;
      for(var i = marks.pins.length - 1; i >= 0; i--){ var q = marks.pins[i], dx = (p.x - q.x) * cv.width, dy = (p.y - q.y) * cv.height; if(Math.sqrt(dx * dx + dy * dy) <= rad) return i; }
      return -1;
    }
    cv.addEventListener('pointerdown', function(e){
      e.preventDefault(); var p = pos(e); cv.setPointerCapture(e.pointerId);
      if(mode === 'pins'){
        var hp = hitPin(p);
        if(hp >= 0){ snap(); drag = { pin: hp }; return; }
        if(placeN){ snap(); marks.pins = marks.pins.filter(function(q){ return q.n !== placeN; }); marks.pins.push({ n: placeN, x: p.x, y: p.y }); placeN = null; msg(''); draw(); }
        return;
      }
      drag = { start: p, moved: false };
    });
    cv.addEventListener('pointermove', function(e){
      if(!drag) return; var p = pos(e);
      if(drag.pin != null){ marks.pins[drag.pin].x = clamp(p.x, 0, 1); marks.pins[drag.pin].y = clamp(p.y, 0, 1); draw(); return; }
      var dx = (p.x - drag.start.x) * cv.width, dy = (p.y - drag.start.y) * cv.height, d = Math.sqrt(dx * dx + dy * dy);
      if(d > 6) drag.moved = true;
      if(drag.moved) draw({ x: drag.start.x, y: drag.start.y, r: Math.max(0.02, d / shorter()) });
    });
    cv.addEventListener('pointerup', function(e){
      if(!drag) return; var p = pos(e);
      if(drag.pin != null){ drag = null; return; }
      if(!drag.moved){ var hc = hitCircle(p); if(hc >= 0){ snap(); marks.circles.splice(hc, 1); } }
      else { var dx = (p.x - drag.start.x) * cv.width, dy = (p.y - drag.start.y) * cv.height; snap(); marks.circles.push({ x: drag.start.x, y: drag.start.y, r: clamp(Math.sqrt(dx * dx + dy * dy) / shorter(), 0.02, 0.5) }); }
      drag = null; draw();
    });
    function close(){ ov.remove(); }
    ov.querySelector('#rsa-undo').onclick = function(){ if(history.length){ marks = JSON.parse(history.pop()); draw(); } };
    ov.querySelector('#rsa-clear').onclick = function(){ snap(); if(mode === 'pins') marks.pins = []; else marks.circles = []; draw(); };
    ov.querySelector('#rsa-cancel').onclick = close;
    ov.querySelector('#rsa-done').onclick = function(){ close(); if(opts.onDone) opts.onDone({ circles: marks.circles, pins: marks.pins }); };
    if(opts.onAi){
      ov.querySelector('#rsa-ai').onclick = async function(){
        var b = this; b.disabled = true; msg('Asking the AI…');
        try{ var got = await opts.onAi(); snap();
          if(mode === 'pins'){ var keep = {}; (got.pins || []).forEach(function(q){ keep[q.n] = true; }); marks.pins = marks.pins.filter(function(q){ return !keep[q.n]; }).concat(cleanPins(got.pins)); }
          else marks.circles = cleanCircles(got.circles);
          msg((mode === 'pins' ? (got.pins || []).length + ' pin(s) placed.' : ((got.circles || []).length ? 'Circle added.' : 'The AI could not see a defect. Draw it yourself.')) + ' Check and adjust before you press Done.');
          draw();
        }catch(err){ msg(err && err.message ? err.message : 'The AI did not work this time. Mark it yourself.'); }
        b.disabled = false;
      };
    }
    loadImg(dataUrl(opts.b64, opts.mime)).then(function(i){
      im = i; var maxW = Math.min(1400, i.naturalWidth); cv.width = maxW; cv.height = Math.round(i.naturalHeight * maxW / i.naturalWidth); draw();
    }).catch(function(e){ msg(e.message); });
  }

  // Draws marks over an <img> preview without changing the image itself (a canvas laid on top).
  function overlay(imgEl, marks){
    if(!imgEl) return;
    var host = imgEl.parentElement; if(!host) return;
    var old = host.querySelector('canvas.rsa-ov'); if(old) old.remove();
    var circles = cleanCircles((marks || {}).circles), pins = cleanPins((marks || {}).pins);
    if(!circles.length && !pins.length) return;
    function paint(){
      var w = imgEl.clientWidth, h = imgEl.clientHeight; if(!w || !h) return;
      var c = document.createElement('canvas'); c.className = 'rsa-ov'; c.width = w * 2; c.height = h * 2;
      c.style.cssText = 'position:absolute;pointer-events:none;left:' + imgEl.offsetLeft + 'px;top:' + imgEl.offsetTop + 'px;width:' + w + 'px;height:' + h + 'px;';
      if(getComputedStyle(host).position === 'static') host.style.position = 'relative';
      drawMarks(c.getContext('2d'), c.width, c.height, circles, pins, 1);
      host.appendChild(c);
    }
    if(imgEl.complete) paint(); else imgEl.addEventListener('load', paint, { once: true });
  }

  window.RSAnnot = { open: open, bake: bake, aiCircles: aiCircles, aiPins: aiPins, overlay: overlay, cleanCircles: cleanCircles, cleanPins: cleanPins };
})();
