// RoofScan photo tools, shared by the flyer upload page (jobs.html) and the report generator (reports.html).
// Reads drone data, measures sharpness, fingerprints near-identical shots, sets aside duplicates and blurry shots,
// sorts photos into report sections through the Worker, and checks which shots a job still needs.
// Reads the data a drone saves inside each photo: GPS position, camera direction (yaw) and tilt (pitch), height and
// capture time. DJI drones write these in XMP text (drone-dji:...) and the GPS also in EXIF. Returns null if none found.
// Only reads the first 256 KB of the file, where this data always sits.
function rsReadDroneMetaFromBuffer(buf){
  var u8 = new Uint8Array(buf), out = {};
  var txt = ''; for (var i = 0; i < u8.length; i++) txt += String.fromCharCode(u8[i]);
  function xmp(names){
    for (var n = 0; n < names.length; n++){
      var re = new RegExp('drone-dji:' + names[n] + '\\s*=\\s*"([^"]+)"|<drone-dji:' + names[n] + '>([^<]+)<', 'i');
      var m = txt.match(re);
      if (m){ var v = parseFloat(m[1] || m[2]); if (isFinite(v)) return v; }
    }
    return null;
  }
  var map = { yaw:['GimbalYawDegree'], pitch:['GimbalPitchDegree'], fyaw:['FlightYawDegree'], alt:['RelativeAltitude'],
              lat:['GpsLatitude','Latitude'], lon:['GpsLongitude','GpsLongtitude','Longitude'] };
  for (var k in map){ var v = xmp(map[k]); if (v !== null) out[k] = v; }
  // EXIF (GPS + capture time), used when XMP has no GPS.
  try {
    var exifAt = txt.indexOf('Exif\0\0');
    if (exifAt >= 0){
      var t0 = exifAt + 6, dv = new DataView(buf);
      var le = txt.substr(t0, 2) === 'II';
      var r16 = function(o){ return dv.getUint16(t0 + o, le); }, r32 = function(o){ return dv.getUint32(t0 + o, le); };
      var readIfd = function(off){ var n = r16(off), tags = {}; for (var e = 0; e < n; e++){ var p = off + 2 + e*12; tags[r16(p)] = { type:r16(p+2), count:r32(p+4), valOff:p+8 }; } return tags; };
      var rat = function(off, c){ var a = []; for (var q = 0; q < c; q++){ var d = r32(off + q*8 + 4); a.push(d ? r32(off + q*8) / d : 0); } return a; };
      var asc = function(tag){ if (!tag) return ''; var o = tag.count > 4 ? r32(tag.valOff) : tag.valOff, s = ''; for (var q = 0; q < tag.count - 1; q++) s += String.fromCharCode(dv.getUint8(t0 + o + q)); return s; };
      var ifd0 = readIfd(r32(4));
      if (ifd0[0x8769]){ var ex = readIfd(r32(ifd0[0x8769].valOff)); var dt = asc(ex[0x9003]); if (dt) out.t = dt; }
      if (ifd0[0x8825]){
        var g = readIfd(r32(ifd0[0x8825].valOff));
        if (g[2] && g[4] && (out.lat === undefined || out.lon === undefined)){
          var la = rat(r32(g[2].valOff), 3), lo = rat(r32(g[4].valOff), 3);
          var lat = la[0] + la[1]/60 + la[2]/3600, lon = lo[0] + lo[1]/60 + lo[2]/3600;
          if (asc(g[1]) === 'S') lat = -lat; if (asc(g[3]) === 'W') lon = -lon;
          if (lat || lon){ out.lat = Math.round(lat*1e6)/1e6; out.lon = Math.round(lon*1e6)/1e6; }
        }
      }
    }
  } catch(e) { /* odd EXIF layouts are skipped, XMP values still count */ }
  return Object.keys(out).length ? out : null;
}
function rsReadDroneMeta(file){
  return new Promise(function(res){
    try {
      var r = new FileReader();
      r.onload = function(){ try { res(rsReadDroneMetaFromBuffer(r.result)); } catch(e){ res(null); } };
      r.onerror = function(){ res(null); };
      r.readAsArrayBuffer(file.slice(0, 262144));
    } catch(e){ res(null); }
  });
}

function rsZoneFromMeta(m){
  if(!m) return '';
  if(typeof m.pitch === 'number' && m.pitch <= -60) return 'Top-down / overview';
  var yaw = (typeof m.yaw === 'number') ? m.yaw : ((typeof m.fyaw === 'number') ? m.fyaw : null);
  if(yaw === null) return '';
  var side = ((yaw + 180) % 360 + 360) % 360;
  return side >= 315 || side < 45 ? 'North side' : side < 135 ? 'East side' : side < 225 ? 'South side' : 'West side';
}
function rsSharpness(canvas){
  try{
    var w = canvas.width, h = canvas.height, g = canvas.getContext('2d').getImageData(0,0,w,h).data;
    var step = Math.max(1, Math.floor(Math.max(w,h)/384)), n = 0, sum = 0, sum2 = 0;
    var L = function(x,y){ var i=(y*w+x)*4; return 0.299*g[i]+0.587*g[i+1]+0.114*g[i+2]; };
    for(var y=step; y<h-step; y+=step){ for(var x=step; x<w-step; x+=step){
      var v = 4*L(x,y) - L(x-step,y) - L(x+step,y) - L(x,y-step) - L(x,y+step); n++; sum += v; sum2 += v*v; } }
    if(!n) return 0; var m = sum/n; return Math.round(sum2/n - m*m);
  }catch(e){ return 0; }
}
function rsDHash(canvas){
  try{
    var w = canvas.width, h = canvas.height, g = canvas.getContext('2d').getImageData(0,0,w,h).data;
    var cell = [], cnt = [], i, hs = '';
    for(i=0;i<72;i++){ cell.push(0); cnt.push(0); }
    for(var y=0; y<h; y+=2){ var cy = Math.min(7, Math.floor(y*8/h));
      for(var x=0; x<w; x+=2){ var cx = Math.min(8, Math.floor(x*9/w)), p = (y*w+x)*4; cell[cy*9+cx] += 0.299*g[p]+0.587*g[p+1]+0.114*g[p+2]; cnt[cy*9+cx]++; } }
    for(i=0;i<72;i++) cell[i] /= (cnt[i] || 1);
    for(y=0;y<8;y++){ for(x=0;x<8;x++){ hs += cell[y*9+x] > cell[y*9+x+1] ? '1' : '0'; } }
    return hs;
  }catch(e){ return ''; }
}
function rsHamming(h1, h2){ var d = 0; for (var i = 0; i < h1.length; i++){ if (h1[i] !== h2[i]) d++; } return d; }
// One decode per photo: a 768px copy for the AI, its fingerprint and sharpness, and a 70px square thumbnail.
function rsSmallCopy(file){
  return new Promise(function(resolve, reject){
    var u = URL.createObjectURL(file), img = new Image();
    img.onload = function(){
      var w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(1, 768/Math.max(w, h));
      var c1 = document.createElement('canvas'); c1.width = Math.round(w*sc); c1.height = Math.round(h*sc);
      c1.getContext('2d').drawImage(img, 0, 0, c1.width, c1.height);
      var c3 = document.createElement('canvas'); c3.width = 70; c3.height = 70; var ms = Math.min(w, h);
      c3.getContext('2d').drawImage(img, (w-ms)/2, (h-ms)/2, ms, ms, 0, 0, 70, 70);
      URL.revokeObjectURL(u);
      try { resolve({ base64: c1.toDataURL('image/jpeg', 0.7).split(',')[1], hash: rsDHash(c1), sharp: rsSharpness(c1), w: w, h: h, thumbUrl: c3.toDataURL('image/jpeg', 0.6), file: file }); }
      catch(e){ reject(e); }
    };
    img.onerror = function(){ URL.revokeObjectURL(u); reject(new Error('Could not read image')); };
    img.src = u;
  });
}
// Near-duplicates and blurry shots. list: [{id, hash, sharp}] in capture order. ctx carries what earlier batches kept,
// so a burst split across two uploads is still caught. Keeps the sharpest of each group; a photo that was already
// sorted in an earlier batch is never swapped out. Returns { keep:[ids], dup:[ids], blur:[ids] }.
var RS_DUP_BITS = 10, RS_BLUR_RATIO = 0.2;   // tested: bursts of one spot 5-10 bits apart, different views 23+
function rsNewFilterCtx(){ return { keepers: [], sharpAll: [] }; }
function rsPreFilter(list, ctx){
  var out = { keep: [], dup: [], blur: [] }, batch = [];
  list.forEach(function(it){
    if (!it.hash){ batch.push({ id: it.id, sharp: it.sharp || 0, hash: '', fresh: true, nohash: true }); return; }
    ctx.sharpAll.push(it.sharp || 0);
    var hit = null;
    for (var i = ctx.keepers.length - 1; i >= 0; i--){ if (ctx.keepers[i].hash && rsHamming(it.hash, ctx.keepers[i].hash) <= RS_DUP_BITS){ hit = ctx.keepers[i]; break; } }
    if (!hit){ var k = { id: it.id, hash: it.hash, sharp: it.sharp || 0, fresh: true }; ctx.keepers.push(k); batch.push(k); return; }
    if (hit.fresh && (it.sharp || 0) > hit.sharp * 1.15){ out.dup.push(hit.id); hit.id = it.id; hit.hash = it.hash; hit.sharp = it.sharp || 0; }
    else out.dup.push(it.id);
  });
  var sorted = ctx.sharpAll.slice().sort(function(a, b){ return a - b; });
  var median = sorted.length ? sorted[Math.floor(sorted.length/2)] : 0;
  batch.forEach(function(k){
    if (!k.nohash && sorted.length >= 6 && median > 0 && k.sharp < median * RS_BLUR_RATIO){
      out.blur.push(k.id); var at = ctx.keepers.indexOf(k); if (at >= 0) ctx.keepers.splice(at, 1); return;
    }
    k.fresh = false; out.keep.push(k.id);
  });
  return out;
}
// Sends photos to the Worker in groups of six (one AI call each, one at a time so the saved results never clash).
// items: [{name, b64}]; info: { name:{hash, sharp, set} } saved alongside. Returns { results:{name:{cat,conf,note}}, failed:n, error }.
async function rsSortPhotos(api, token, jobId, items, info, onProgress){
  var results = {}, failed = 0, error = '', done = 0, infoLeft = Object.assign({}, info || {});
  for (var i = 0; i < items.length || (i === 0 && Object.keys(infoLeft).length); i += 6){
    var chunk = items.slice(i, i + 6), inf = {};
    chunk.forEach(function(c){ if (infoLeft[c.name]){ inf[c.name] = infoLeft[c.name]; delete infoLeft[c.name]; } });
    if (i === 0) Object.keys(infoLeft).slice(0, 40).forEach(function(n){ inf[n] = infoLeft[n]; delete infoLeft[n]; });
    var body = JSON.stringify({ jobId: jobId, photos: chunk.map(function(c){ return { name: c.name, b64: c.b64 }; }), info: inf });
    var ok = false;
    for (var attempt = 0; attempt < 2 && !ok; attempt++){
      try {
        var r = await fetch(api + '/contractor/photo-sort', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body });
        var d = await r.json().catch(function(){ return {}; });
        if (r.ok){ ok = true; Object.assign(results, d.results || {}); }
        else { error = d.error || ('HTTP ' + r.status); if (r.status < 500) break; }
      } catch(e){ error = 'No connection'; }
    }
    if (!ok) failed += chunk.length;
    done += chunk.length;
    if (onProgress) onProgress(done, items.length);
    if (!items.length) break;
  }
  // Any set-aside info still waiting (more than 40 at once) goes in follow-up calls with no photos.
  var rest = Object.keys(infoLeft);
  for (var j = 0; j < rest.length; j += 40){
    var part = {}; rest.slice(j, j + 40).forEach(function(n){ part[n] = infoLeft[n]; });
    try { await fetch(api + '/contractor/photo-sort', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ jobId: jobId, photos: [], info: part }) }); } catch(e){}
  }
  return { results: results, failed: failed, error: error };
}
// Which shots a job has, from the saved sorts and the drone data. Used by the flyer before leaving the site.
// Compass sides are only checked when the drone recorded its direction.
function rsShotChecklist(photos, sorts){
  var cats = {}, zones = {}, anyMeta = false;
  (photos || []).forEach(function(p){
    var s = (sorts || {})[p.name] || {};
    if (s.cat && !s.set) cats[s.cat] = (cats[s.cat] || 0) + 1;
    if (p.meta){ var z = rsZoneFromMeta(p.meta); if (z){ anyMeta = true; zones[z] = (zones[z] || 0) + 1; } }
  });
  var has = function(list){ return list.some(function(c){ return cats[c]; }); };
  var items = [];
  items.push({ label: 'Overview of the whole roof', ok: has([12]) || !!zones['Top-down / overview'] });
  if (anyMeta) ['North side','East side','South side','West side'].forEach(function(z){ items.push({ label: z, ok: !!zones[z] }); });
  items.push({ label: 'Ridge', ok: has([4]) });
  items.push({ label: 'Roof covering close-ups', ok: has([5, 6]) });
  items.push({ label: 'Gutters, fascias and downpipes', ok: has([8, 9, 10]) });
  items.push({ label: 'Chimney (if there is one)', ok: has([1, 2, 3]), optional: true });
  return items;
}
