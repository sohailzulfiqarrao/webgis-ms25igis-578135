/* Web GIS in motion: four small live maps on the Web GIS hub landing page.
     choropleth  the 160 districts coloured by population density, in the five classes of Lab 3
     probe       a point crosses Pakistan and a point-in-polygon test finds its district (the idea of ST_Contains in Lab 4)
     tiles       the slippy-map tile grid subdividing as the zoom grows, with real z/x/y tile numbers
     requests    a request travelling Browser -> Django -> PostGIS and back, with the response sizes measured in Lab 4
   The polygons are the real district boundaries (generalised to about 1 km), loaded from assets/geo-districts.json only when
   this section is about to scroll into view. A panel animates only while it is on screen and the tab is visible; with
   prefers-reduced-motion each panel is drawn once, in its finished state. */
(function () {
   'use strict';
   // the animated background art plays only near the top of the page (see .bg-still in neural.css)
   var bgTick = false;
   function bgState() { bgTick = false; document.body.classList.toggle('bg-still', window.scrollY > 160); }
   window.addEventListener('scroll', function () { if (!bgTick) { bgTick = true; requestAnimationFrame(bgState); } }, { passive: true });
   bgState();
   var cards = document.querySelectorAll('.viz-card');
   if (!cards.length) { return; }

   var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
   var TAU = Math.PI * 2;
   var COL = { cyan: '#22d3ee', violet: '#a78bfa', amber: '#fbbf24', green: '#34d399', red: '#f87171' };
   var TEXT = 'rgba(148,163,184,.9)', GRID = 'rgba(148,163,184,.13)', AXIS = 'rgba(148,163,184,.42)';
   var MONOFONT = 'ui-monospace, "Cascadia Code", Consolas, monospace';
   var MONO = '11px ' + MONOFONT;
   var CLS = ['#17405c', '#1e6a8f', '#2b9cc2', '#7ad6ee', '#e9d5ff'], NODATA = '#3a4559';
   var CLS_LABEL = ['< 50', '50–150', '150–400', '400–1,000', '> 1,000'], BREAKS = [50, 150, 400, 1000];
   var LON0 = 60.8, LON1 = 77.9, LAT0 = 23.5, LAT1 = 37.2, KX = Math.cos(30.4 * Math.PI / 180);

   function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
   function ease(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
   function easeIO(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
   function lerp(a, b, t) { return a + (b - a) * t; }
   function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
   function fmt(n) { return Number(n).toLocaleString('en-US'); }

   /* ---------- the district data ---------- */
   var GEO = null;                       // { provinces, d: [ { n, p, pop, a, polys, minx, miny, maxx, maxy, cx, dens, cls } ] }

   function decode(raw) {
      var kInv = 1 / 1000;
      raw.d.forEach(function (d) {
         d.polys = d.g.map(function (poly) {
            return poly.map(function (flat) {                      // delta-encoded, in thousandths of a degree
               var n = flat.length / 2, out = new Float64Array(flat.length), x = flat[0], y = flat[1], q, m = new Float64Array(flat.length);
               out[0] = x * kInv; out[1] = y * kInv;
               for (q = 1; q < n; q++) { x += flat[2 * q]; y += flat[2 * q + 1]; out[2 * q] = x * kInv; out[2 * q + 1] = y * kInv; }
               for (q = 0; q < n; q++) {                            // the same points in Web Mercator units (0 to 1), for the tile panel
                  var lat = out[2 * q + 1] * Math.PI / 180;
                  m[2 * q] = (out[2 * q] + 180) / 360;
                  m[2 * q + 1] = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2;
               }
               out.m = m; return out;
            });
         });
         var mnx = 999, mny = 999, mxx = -999, mxy = -999;
         d.polys.forEach(function (poly) { var r = poly[0]; for (var q = 0; q < r.length; q += 2) { if (r[q] < mnx) { mnx = r[q]; } if (r[q] > mxx) { mxx = r[q]; } if (r[q + 1] < mny) { mny = r[q + 1]; } if (r[q + 1] > mxy) { mxy = r[q + 1]; } } });
         d.minx = mnx; d.maxx = mxx; d.miny = mny; d.maxy = mxy; d.cx = (mnx + mxx) / 2;
         function mercY(lat) { var r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2; }
         d.mx0 = (mnx + 180) / 360; d.mx1 = (mxx + 180) / 360; d.my0 = mercY(mxy); d.my1 = mercY(mny);
         d.dens = d.pop === null ? null : d.pop / d.a;
         d.cls = d.dens === null ? -1 : BREAKS.filter(function (b) { return d.dens > b; }).length;         // Lab 3: breaks.filter(b => density > b).length
      });
      return raw;
   }
   function ringHas(r, x, y) {
      var inside = false, n = r.length / 2, i, j;
      for (i = 0, j = n - 1; i < n; j = i++) {
         var xi = r[2 * i], yi = r[2 * i + 1], xj = r[2 * j], yj = r[2 * j + 1];
         if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) { inside = !inside; }
      }
      return inside;
   }
   function contains(d, x, y) {                                       // is the point inside the district, outside its holes?
      if (x < d.minx || x > d.maxx || y < d.miny || y > d.maxy) { return false; }
      for (var k = 0; k < d.polys.length; k++) {
         var poly = d.polys[k];
         if (ringHas(poly[0], x, y)) { var hole = false; for (var h = 1; h < poly.length; h++) { if (ringHas(poly[h], x, y)) { hole = true; } } if (!hole) { return true; } }
      }
      return false;
   }
   function findAt(x, y) { for (var i = 0; i < GEO.d.length; i++) { if (contains(GEO.d[i], x, y)) { return i; } } return -1; }

   function base(card) {
      var p = { card: card, canvas: card.querySelector('canvas'), W: 1, H: 1, dpr: 1, visible: false, finished: false, started: false, stats: {}, needsData: false };
      p.ctx = p.canvas.getContext('2d');
      [].forEach.call(card.querySelectorAll('[data-s]'), function (el) { p.stats[el.getAttribute('data-s')] = el; });
      p.say = function (k, v) { var el = p.stats[k]; if (el && el.textContent !== v) { el.textContent = v; } };
      p.resize = function () {
         p.dirty = true;
         var r = p.canvas.getBoundingClientRect();
         p.dpr = Math.min(window.devicePixelRatio || 1, 2);
         p.W = Math.max(1, Math.round(r.width)); p.H = Math.max(1, Math.round(r.height));
         p.canvas.width = Math.round(p.W * p.dpr); p.canvas.height = Math.round(p.H * p.dpr);
      };
      p.begin = function () { p.ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0); p.ctx.clearRect(0, 0, p.W, p.H); p.ctx.font = MONO; };
      p.waiting = function () {
         p.begin(); p.ctx.fillStyle = TEXT; p.ctx.textAlign = 'center'; p.ctx.fillText('loading the district boundaries...', p.W / 2, p.H / 2);
      };
      return p;
   }
   // the equirectangular fit used by the first two panels: the map on the left, a text column on the right
   function fit(p, reserve) {
      var m = 8, aw = p.W - reserve - m, ah = p.H - 2 * m, bw = (LON1 - LON0) * KX, bh = LAT1 - LAT0;
      var s = Math.min(aw / bw, ah / bh);
      return { s: s, ox: m + (aw - bw * s) / 2, oy: m + (ah - bh * s) / 2, right: m + aw };
   }
   function trace(c, d, f) {                                         // one district as a path, in the equirectangular fit
      var X = function (lon) { return f.ox + (lon - LON0) * KX * f.s; }, Y = function (lat) { return f.oy + (LAT1 - lat) * f.s; };
      c.beginPath();
      for (var k = 0; k < d.polys.length; k++) {
         for (var h = 0; h < d.polys[k].length; h++) {
            var r = d.polys[k][h]; c.moveTo(X(r[0]), Y(r[1]));
            for (var q = 2; q < r.length; q += 2) { c.lineTo(X(r[q]), Y(r[q + 1])); }
            c.closePath();
         }
      }
   }

   // the static part of a map (every district's dark fill and outline) is drawn once into a hidden canvas and reused
   function ensureBase(p, f, D, strokeAlpha) {
      var key = f.ox.toFixed(2) + '|' + f.oy.toFixed(2) + '|' + f.s.toFixed(3) + '|' + p.W + 'x' + p.H + '|' + p.dpr;
      if (p._key === key && p.base) { return; }
      var KXs = KX * f.s, all = new Path2D();
      p.paths = D.map(function (d) {
         var pd = new Path2D();
         for (var k = 0; k < d.polys.length; k++) {
            for (var h = 0; h < d.polys[k].length; h++) {
               var r = d.polys[k][h]; pd.moveTo(f.ox + (r[0] - LON0) * KXs, f.oy + (LAT1 - r[1]) * f.s);
               for (var q = 2; q < r.length; q += 2) { pd.lineTo(f.ox + (r[q] - LON0) * KXs, f.oy + (LAT1 - r[q + 1]) * f.s); }
               pd.closePath();
            }
         }
         all.addPath(pd); return pd;
      });
      p.base = document.createElement('canvas'); p.base.width = p.canvas.width; p.base.height = p.canvas.height;
      var b = p.base.getContext('2d'); b.setTransform(p.dpr, 0, 0, p.dpr, 0, 0); b.lineJoin = 'round';
      b.fillStyle = 'rgba(15,28,52,.9)'; b.fill(all, 'evenodd');
      b.strokeStyle = 'rgba(148,163,184,' + strokeAlpha + ')'; b.lineWidth = 0.6; b.stroke(all);
      p._key = key;
   }
   function paintBase(p) {
      var c = p.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(p.base, 0, 0); c.setTransform(p.dpr, 0, 0, p.dpr, 0, 0); c.font = MONO;
   }

   /* =============================== choropleth =============================== */
   function choropleth(card) {
      var p = base(card); p.needsData = true;
      var t, hover = -1, tr = null, SWEEP = 3.6, HOLD = 3.4, OUT = 0.9;
      p.reset = function () { t = 0; p.finished = false; p.animating = true; p._drawn = false; };
      p.update = function (dt) {
         t += dt;
         p.animating = t < SWEEP + 0.15 || t > SWEEP + HOLD;                      // nothing moves during the hold, so nothing is redrawn
         if (t >= SWEEP) { p.finished = true; if (t >= SWEEP + HOLD + OUT && !reduce) { p.reset(); } }
      };
      p.draw = function () {
         if (!GEO) { p.waiting(); return; }
         if (!p.animating && !p.dirty && p._drawn) { return; }
         p.dirty = false; p._drawn = true;
         p.begin();
         var c = p.ctx, f = fit(p, p.W < 420 ? 112 : 150), D = GEO.d, i;
         tr = f; ensureBase(p, f, D, 0.3); paintBase(p);
         var sweep = reduce ? 9e3 : lerp(LON0 - 1.5, LON1 + 2.5, clamp(t / SWEEP, 0, 1));
         var fadeOut = reduce ? 1 : (t > SWEEP + HOLD ? 1 - 0.8 * ease((t - SWEEP - HOLD) / OUT) : 1);
         var counts = [0, 0, 0, 0, 0, 0], shown = 0;
         for (i = 0; i < D.length; i++) {
            var d = D[i], a = reduce ? 1 : ease((sweep - d.cx) / 1.6) * fadeOut;
            if (a > 0.02) { c.globalAlpha = a; c.fillStyle = d.cls < 0 ? NODATA : CLS[d.cls]; c.fill(p.paths[i], 'evenodd'); c.globalAlpha = 1; }
            if (a > 0.5) { counts[d.cls < 0 ? 5 : d.cls]++; shown++; }
         }
         c.lineJoin = 'round';
         if (hover >= 0) { c.strokeStyle = '#ffffff'; c.lineWidth = 1.7; c.stroke(p.paths[hover]); }
         // legend
         var lx = f.right + 12, ly = 30, row = 20;
         c.textAlign = 'left'; c.fillStyle = TEXT; c.fillText('people per km\u00b2', lx, 14);
         for (i = 0; i < 6; i++) {
            c.fillStyle = i < 5 ? CLS[i] : NODATA; c.fillRect(lx, ly + i * row - 8, 14, 12);
            c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.strokeRect(lx + 0.5, ly + i * row - 7.5, 13, 11);
            c.fillStyle = '#e8eefb'; c.fillText(i < 5 ? CLS_LABEL[i] : 'no data', lx + 22, ly + i * row + 2);
            c.fillStyle = COL.cyan; c.textAlign = 'right'; c.fillText(String(counts[i]), p.W - 8, ly + i * row + 2); c.textAlign = 'left';
         }
         p.say('shown', shown + '/' + D.length);
         p.say('hover', hover >= 0 ? D[hover].n + ' \u00b7 ' + (D[hover].dens === null ? 'no census data' : fmt(Math.round(D[hover].dens)) + ' per km\u00b2') : 'point at a district');
      };
      p.hoverAt = function (px, py) {
         if (!GEO || !tr) { return; }
         var lon = LON0 + (px - tr.ox) / (KX * tr.s), lat = LAT1 - (py - tr.oy) / tr.s, h = findAt(lon, lat);
         if (h !== hover) { hover = h; p.dirty = true; if (!p.visible || reduce) { p.draw(); } }
      };
      return p;
   }

   /* ================================= probe ================================== */
   function probe(card) {
      var p = base(card); p.needsData = true;
      var STOPS = [['Karachi', 67.01, 24.86], ['Hyderabad', 68.37, 25.4], ['Multan', 71.47, 30.2], ['Lahore', 74.34, 31.55], ['Islamabad', 73.05, 33.68], ['Peshawar', 71.58, 34.01], ['Gilgit', 74.31, 35.92], ['Quetta', 66.99, 30.18]];
      var TRAVEL = 1.1, DWELL = 1.5, SEG = TRAVEL + DWELL, LAST = 4, t, trail;
      p.reset = function () { t = TRAVEL; p.finished = false; trail = []; };
      function where() {
         var k = Math.floor(t / SEG), local = t - k * SEG, n = STOPS.length, cur = STOPS[k % n], prev = STOPS[(k + n - 1) % n];
         var u = local < TRAVEL ? easeIO(local / TRAVEL) : 1;
         var arc = local < TRAVEL ? Math.sin(u * Math.PI) * 0.5 : 0;                                // a slight curve, so the path is not a ruler line
         return { lon: lerp(prev[1], cur[1], u), lat: lerp(prev[2], cur[2], u) + arc, name: cur[0], moving: local < TRAVEL, k: k };
      }
      p.update = function (dt) {
         t += dt;
         var w = where(); trail.push([w.lon, w.lat]); if (trail.length > 44) { trail.shift(); }
         if (Math.floor(t / SEG) >= LAST && t - Math.floor(t / SEG) * SEG > TRAVEL + 0.5) { p.finished = true; }
      };
      p.draw = function () {
         if (!GEO) { p.waiting(); return; }
         p.begin();
         var c = p.ctx, f = fit(p, p.W < 420 ? 112 : 150), D = GEO.d, w = where(), i;
         var X = function (lon) { return f.ox + (lon - LON0) * KX * f.s; }, Y = function (lat) { return f.oy + (LAT1 - lat) * f.s; };
         var hit = findAt(w.lon, w.lat);
         ensureBase(p, f, D, 0.34); paintBase(p); c.lineJoin = 'round';
         if (hit >= 0) { c.fillStyle = rgba(COL.cyan, 0.42); c.fill(p.paths[hit], 'evenodd'); c.strokeStyle = '#ffffff'; c.lineWidth = 1.8; c.shadowColor = rgba(COL.cyan, 0.8); c.shadowBlur = 10; c.stroke(p.paths[hit]); c.shadowBlur = 0; }
         if (!reduce) {                                                                           // fading trail
            for (i = 1; i < trail.length; i++) { c.strokeStyle = rgba(COL.amber, 0.55 * i / trail.length); c.lineWidth = 1.6; c.beginPath(); c.moveTo(X(trail[i - 1][0]), Y(trail[i - 1][1])); c.lineTo(X(trail[i][0]), Y(trail[i][1])); c.stroke(); }
         }
         var px = X(w.lon), py = Y(w.lat), pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6);
         c.strokeStyle = rgba(COL.amber, 0.45); c.lineWidth = 1.2; c.beginPath(); c.arc(px, py, 9 + pulse * 4, 0, TAU); c.stroke();
         c.strokeStyle = rgba(COL.amber, 0.9); c.beginPath(); c.moveTo(px - 14, py); c.lineTo(px - 5, py); c.moveTo(px + 5, py); c.lineTo(px + 14, py); c.moveTo(px, py - 14); c.lineTo(px, py - 5); c.moveTo(px, py + 5); c.lineTo(px, py + 14); c.stroke();
         c.fillStyle = COL.amber; c.beginPath(); c.arc(px, py, 3.2, 0, TAU); c.fill();
         // the answer, in the column on the right
         var lx = f.right + 12, d = hit >= 0 ? D[hit] : null;
         c.textAlign = 'left'; c.fillStyle = TEXT; c.fillText('ST_Contains(geom, pt)', lx, 14);
         c.fillStyle = TEXT; c.fillText('district', lx, 40);
         c.fillStyle = '#ffffff'; c.font = 'bold 12px ' + MONOFONT; c.fillText(d ? d.n : 'no district', lx, 56); c.font = MONO;
         c.fillStyle = TEXT; c.fillText('province', lx, 80); c.fillStyle = '#e8eefb'; c.fillText(d ? GEO.provinces[d.p] : '--', lx, 96);
         c.fillStyle = TEXT; c.fillText('pop_2023', lx, 120); c.fillStyle = COL.cyan; c.fillText(d ? (d.pop === null ? 'not recorded' : fmt(d.pop)) : '--', lx, 136);
         p.say('lat', w.lat.toFixed(3)); p.say('lng', w.lon.toFixed(3));
         p.say('district', d ? d.n : 'none');
      };
      return p;
   }

   /* ================================== tiles ================================= */
   function tiles(card) {
      var p = base(card); p.needsData = true;
      var ISL = { lon: 73.05, lat: 33.68 }, PAK = { lon: 69.3, lat: 30.4 };
      function merc(lon, lat) { var r = lat * Math.PI / 180; return [(lon + 180) / 360, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2]; }
      var mI = merc(ISL.lon, ISL.lat), mP = merc(PAK.lon, PAK.lat);
      var ZMIN = 5, ZMAX = 9.4, IN = 9, HOLD = 2.8, OUT = 1.6, TILE = 120, t;
      p.reset = function () { t = 0; p.finished = false; };
      p.update = function (dt) {
         t += dt;
         if (t >= IN) { p.finished = true; if (t >= IN + HOLD + OUT && !reduce) { p.reset(); } }
      };
      p.draw = function () {
         if (!GEO) { p.waiting(); return; }
         p.begin();
         var c = p.ctx, W = p.W, H = p.H, D = GEO.d, i, k, h, r;
         var u = reduce ? 1 : (t < IN ? easeIO(t / IN) : (t < IN + HOLD ? 1 : 1 - easeIO((t - IN - HOLD) / OUT)));
         var zv = lerp(ZMIN, ZMAX, u), z = Math.floor(zv), frac = zv - z, n = Math.pow(2, z);
         var S = TILE * n * Math.pow(2, frac);                        // the world is S pixels wide at this zoom
         var cm = ease(u * 1.15), cmx = lerp(mP[0], mI[0], cm), cmy = lerp(mP[1], mI[1], cm);
         function X(mx) { return W / 2 + (mx - cmx) * S; }
         function Y(my) { return H / 2 + (my - cmy) * S; }
         // district outlines, in Web Mercator: one path for all of them, skipping vertices less than a pixel apart
         c.lineJoin = 'round'; c.lineWidth = 0.8; c.beginPath();
         for (i = 0; i < D.length; i++) {
            var d = D[i];
            if (X(d.mx1) < -20 || X(d.mx0) > W + 20 || Y(d.my1) < -20 || Y(d.my0) > H + 20) { continue; }
            for (k = 0; k < d.polys.length; k++) {
               for (h = 0; h < d.polys[k].length; h++) {
                  r = d.polys[k][h].m; var lx = X(r[0]), ly = Y(r[1]); c.moveTo(lx, ly);
                  for (var q = 2; q < r.length; q += 2) { var x = X(r[q]), y = Y(r[q + 1]); if (Math.abs(x - lx) + Math.abs(y - ly) < 0.9) { continue; } c.lineTo(x, y); lx = x; ly = y; }
                  c.closePath();
               }
            }
         }
         c.fillStyle = rgba(COL.cyan, 0.07); c.fill('evenodd'); c.strokeStyle = rgba(COL.cyan, 0.5); c.stroke();
         // the tile grid: this level, and the next one fading in
         function grid(level, alpha, width) {
            var nn = Math.pow(2, level), sz = S / nn;
            var x0 = Math.floor((cmx - W / 2 / S) * nn), x1 = Math.ceil((cmx + W / 2 / S) * nn), y0 = Math.floor((cmy - H / 2 / S) * nn), y1 = Math.ceil((cmy + H / 2 / S) * nn);
            c.strokeStyle = 'rgba(226,232,240,' + alpha + ')'; c.lineWidth = width; c.beginPath();
            for (var gx = x0; gx <= x1; gx++) { c.moveTo(X(gx / nn), 0); c.lineTo(X(gx / nn), H); }
            for (var gy = y0; gy <= y1; gy++) { c.moveTo(0, Y(gy / nn)); c.lineTo(W, Y(gy / nn)); }
            c.stroke();
            return { x0: x0, x1: x1, y0: y0, y1: y1, sz: sz, nn: nn };
         }
         var g = grid(z, 0.5, 1.2);
         if (frac > 0.02) { grid(z + 1, 0.38 * frac, 0.8); }
         c.textAlign = 'center'; c.font = '9.5px ' + MONOFONT;
         var tx = Math.floor(mI[0] * n), ty = Math.floor(mI[1] * n);
         for (var gx = g.x0; gx < g.x1; gx++) {
            for (var gy = g.y0; gy < g.y1; gy++) {
               var mine = gx === tx && gy === ty, cx = X((gx + 0.5) / n), cy = Y((gy + 0.5) / n);
               if (mine) {
                  c.fillStyle = rgba(COL.amber, 0.18); c.fillRect(X(gx / n), Y(gy / n), g.sz, g.sz);
                  c.strokeStyle = COL.amber; c.lineWidth = 1.8; c.strokeRect(X(gx / n) + 0.5, Y(gy / n) + 0.5, g.sz - 1, g.sz - 1);
               }
               if (g.sz > 64 && cx > 20 && cx < W - 20 && cy > 10 && cy < H - 6) {
                  c.fillStyle = mine ? COL.amber : 'rgba(203,213,225,.62)'; c.fillText(z + '/' + gx + '/' + gy, cx, cy + 3);
               }
            }
         }
         c.font = MONO;
         var ix = X(mI[0]), iy = Y(mI[1]);                                                           // Islamabad
         c.fillStyle = COL.amber; c.beginPath(); c.arc(ix, iy, 3.6, 0, TAU); c.fill();
         c.strokeStyle = rgba(COL.amber, 0.6); c.lineWidth = 1.2; c.beginPath(); c.arc(ix, iy, 8, 0, TAU); c.stroke();
         p.say('zoom', zv.toFixed(1)); p.say('tile', z + '/' + tx + '/' + ty); p.say('world', fmt(Math.pow(4, z)));
      };
      return p;
   }

   /* =============================== requests ================================= */
   function requests(card) {
      var p = base(card);
      var FULL = 1026495;
      var REQ = [
         { path: '/api/districts/', label: 'all districts', sql: 'SELECT ... FROM districts_district', rows: 160, bytes: 1026495 },
         { path: '/api/districts/?province=Sindh', label: 'province = Sindh', sql: "... WHERE province = 'Sindh'", rows: 29, bytes: 173769 },
         { path: '/api/districts/?province=Punjab', label: 'province = Punjab', sql: "... WHERE province = 'Punjab'", rows: 36, bytes: 321613 },
         { path: '/api/where/?lat=33.64&lng=72.99', label: 'one point', sql: '... WHERE ST_Contains(geom, point)', rows: 1, bytes: 71 }
      ];
      var T_REQ = 0.7, T_Q = 0.7, T_ROWS = 0.7, T_RESP = 1.6, T_HOLD = 1.2, LEN = T_REQ + T_Q + T_ROWS + T_RESP + T_HOLD, LAST = reduce ? 1 : REQ.length - 1, t;
      p.reset = function () { t = 0; p.finished = false; };
      p.update = function (dt) {
         t += dt;
         if (t >= (LAST + 1) * LEN - 0.01) { p.finished = true; if (!reduce) { p.reset(); } }
      };
      function savedText(b) { var s = 100 * (1 - b / FULL); return b === FULL ? 'baseline' : (s > 99.9 ? '99.99%' : Math.round(s) + '%'); }
      p.draw = function () {
         p.begin();
         var c = p.ctx, W = p.W, H = p.H, idx = clamp(Math.floor(t / LEN), 0, LAST), local = t - idx * LEN, q = REQ[idx], i;
         if (reduce) { local = LEN - 0.01; }
         var ny = H * 0.44, bw = Math.min(84, W * 0.21), bh = 50, nx = [W * 0.12 + bw / 2, W * 0.5, W * 0.88 - bw / 2];
         var names = ['Leaflet', 'Django', 'PostGIS'], subs = ['browser', 'views.py', 'database'], cols = [COL.cyan, COL.violet, COL.green];
         for (i = 0; i < 2; i++) {                                                               // the two links
            c.strokeStyle = 'rgba(148,163,184,.3)'; c.lineWidth = 1.5; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(nx[i] + bw / 2, ny); c.lineTo(nx[i + 1] - bw / 2, ny); c.stroke(); c.setLineDash([]);
         }
         for (i = 0; i < 3; i++) {                                                               // the three boxes
            var act = (i === 0 && (local < T_REQ || local > T_REQ + T_Q + T_ROWS)) || (i === 1 && local > T_REQ * 0.6 && local < T_REQ + T_Q + T_ROWS + 0.3) || (i === 2 && local > T_REQ + T_Q * 0.6 && local < T_REQ + T_Q + T_ROWS);
            c.fillStyle = 'rgba(8,18,38,.95)'; c.strokeStyle = rgba(cols[i], act ? 1 : 0.45); c.lineWidth = act ? 2.2 : 1.4;
            if (act) { c.shadowColor = rgba(cols[i], 0.6); c.shadowBlur = 14; }
            c.beginPath(); c.roundRect ? c.roundRect(nx[i] - bw / 2, ny - bh / 2, bw, bh, 10) : c.rect(nx[i] - bw / 2, ny - bh / 2, bw, bh); c.fill(); c.stroke(); c.shadowBlur = 0;
            c.fillStyle = '#e8eefb'; c.textAlign = 'center'; c.font = 'bold 12px ' + MONOFONT; c.fillText(names[i], nx[i], ny - 3); c.font = '10px ' + MONOFONT; c.fillStyle = TEXT; c.fillText(subs[i], nx[i], ny + 13); c.font = MONO;
         }
         function dot(x, y, colour, r) { c.fillStyle = colour; c.shadowColor = colour; c.shadowBlur = 10; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.shadowBlur = 0; }
         var xA = nx[0] + bw / 2, xB = nx[1] - bw / 2, xC = nx[1] + bw / 2, xD = nx[2] - bw / 2;
         var s2 = T_REQ, s3 = T_REQ + T_Q, s4 = T_REQ + T_Q + T_ROWS, rows = 0, bytes = 0;
         c.textAlign = 'center';
         var showReq = reduce || local > 0.05, showSql = reduce || local > s2 + 0.1;
         if (showReq) { c.fillStyle = rgba(COL.cyan, 1); c.fillText('GET ' + (q.path.length > 38 && W < 420 ? q.path.slice(0, 37) + '…' : q.path), W / 2, 18); }
         if (local > 0 && local < s2 && !reduce) { dot(lerp(xA, xB, ease(local / T_REQ)), ny, COL.cyan, 4); }
         if (showSql) { c.fillStyle = rgba(COL.violet, 1); c.fillText('SQL ' + q.sql, W / 2, 36); }
         if (local > s2 - 0.05 && local < s3 && !reduce) { dot(lerp(xC, xD, ease((local - s2) / T_Q)), ny, COL.violet, 4); }
         if (local >= s3 || reduce) {                                                              // rows come back, a few packets
            var k = reduce ? 1 : clamp((local - s3) / T_ROWS, 0, 1);
            if (k < 1 && !reduce) { for (i = 0; i < 4; i++) { var kk = clamp(k * 1.25 - i * 0.1, 0, 1); if (kk > 0 && kk < 1) { dot(lerp(xD, xC, kk), ny, COL.amber, 3); } } }
            rows = Math.round(q.rows * ease(k));
         }
         var stream = reduce ? 1 : clamp((local - s4) / T_RESP, 0, 1);
         if (local >= s4 || reduce) {                                                              // the response, a stream sized by the payload
            var np = clamp(Math.round(Math.log(q.bytes / 40) / Math.log(2) * 1.4), 2, 22);
            if (stream < 1 && !reduce) { for (i = 0; i < np; i++) { var u = stream * (1 + np * 0.06) - i * 0.06; if (u > 0 && u < 1) { dot(lerp(xB, xA, ease(u)), ny + (i % 3 - 1) * 4, COL.green, 2.6 + Math.min(1.6, q.bytes / 400000)); } } }
            bytes = Math.round(q.bytes * ease(stream));
         }
         // payload bars
         var by = H * 0.7, bx = 14, bwMax = W - 28;
         c.textAlign = 'left'; c.fillStyle = TEXT; c.fillText('response size', bx, by - 12);
         c.fillStyle = 'rgba(148,163,184,.14)'; c.fillRect(bx, by, bwMax, 12);
         c.fillStyle = rgba(COL.green, 0.9); c.shadowColor = rgba(COL.green, 0.5); c.shadowBlur = 8;
         c.fillRect(bx, by, Math.max(bytes > 0 ? 2 : 0, bwMax * bytes / FULL), 12); c.shadowBlur = 0;
         c.setLineDash([3, 3]); c.strokeStyle = 'rgba(248,113,113,.7)'; c.beginPath(); c.moveTo(bx + bwMax, by - 5); c.lineTo(bx + bwMax, by + 17); c.stroke(); c.setLineDash([]);
         c.textAlign = 'right'; c.fillStyle = '#f87171'; c.fillText('all 160 districts: ' + fmt(FULL) + ' B', bx + bwMax, by + 32);
         c.textAlign = 'left'; c.fillStyle = '#e8eefb';
         for (i = 0; i < REQ.length; i++) { c.fillStyle = i === idx ? COL.cyan : 'rgba(148,163,184,.55)'; c.fillText((i === idx ? '● ' : '○ ') + ['all', 'Sindh', 'Punjab', 'one point'][i], bx + i * Math.max(70, W * 0.2), H - 10); }
         p.say('path', q.label);
         p.say('rows', String(local >= s3 || reduce ? rows : 0));
         p.say('bytes', fmt(bytes));
         p.say('saved', stream > 0.9 || reduce ? savedText(q.bytes) : '--');
      };
      return p;
   }

   /* ---------- wiring ---------- */
   var makers = { choropleth: choropleth, probe: probe, tiles: tiles, requests: requests };
   var panels = [], running = false, last = 0;

   function frame(now) {
      var dt = (now - last) / 1000, any = false;
      if (!(dt > 0)) { dt = 0.016; } if (dt > 0.05) { dt = 0.05; }   // a frame stamp can precede the start time: never step backwards
      last = now;
      panels.forEach(function (p) { if (p.visible && (GEO || !p.needsData)) { any = true; p.update(dt); p.draw(); } });
      if (any && !document.hidden) { requestAnimationFrame(frame); } else { running = false; }
   }
   function kick() { if (!running && !reduce && !document.hidden) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
   function settle(p) { var guard = 0; p.reset(); while (!p.finished && guard++ < 4000) { p.update(0.05); } p.draw(); }

   [].forEach.call(cards, function (card) {
      var make = makers[card.getAttribute('data-viz')];
      if (!make) { return; }
      var p = make(card); p.card = card; card._p = p; panels.push(p);
      p.resize(); p.reset();
      if (reduce && !p.needsData) { settle(p); } else { p.draw(); }
      var btn = card.querySelector('.viz-replay');
      if (btn) { btn.addEventListener('click', function () { p.reset(); p.visible = true; kick(); }); }
      if (p.hoverAt) {                                                                  // the choropleth answers the pointer
         p.canvas.addEventListener('pointermove', function (e) { var r = p.canvas.getBoundingClientRect(); p.hoverAt(e.clientX - r.left, e.clientY - r.top); });
         p.canvas.addEventListener('pointerleave', function () { p.hoverAt(-9999, -9999); });
      }
   });

   // load the boundaries only when the section is about to be seen
   var loading = false;
   function loadData() {
      if (loading || GEO) { return; }
      loading = true;
      fetch('assets/geo-districts.json').then(function (r) { if (!r.ok) { throw new Error(r.status); } return r.json(); }).then(function (raw) {
         GEO = decode(raw);
         panels.forEach(function (p) { if (p.needsData) { p.resize(); if (reduce) { settle(p); } else { p.reset(); p.draw(); } } });
         kick();
      }).catch(function () { loading = false; panels.forEach(function (p) { if (p.needsData) { p.begin(); p.ctx.fillStyle = TEXT; p.ctx.textAlign = 'center'; p.ctx.fillText('the boundaries could not be loaded', p.W / 2, p.H / 2); } }); });
   }
   var lab = document.querySelector('.viz-lab');
   if ('IntersectionObserver' in window && lab) {
      new IntersectionObserver(function (es, obs) { if (es[0].isIntersecting) { loadData(); obs.disconnect(); } }, { rootMargin: '600px 0px' }).observe(lab);
   } else { loadData(); }

   if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (entries) {
         entries.forEach(function (en) {
            var p = en.target._p;
            if (en.isIntersecting && !p.visible) { p.visible = true; if (!p.started) { p.started = true; p.reset(); } kick(); }
            else if (!en.isIntersecting) { p.visible = false; }
         });
      }, { threshold: 0.2 });
      panels.forEach(function (p) { io.observe(p.card); });
   } else if (!reduce) {
      panels.forEach(function (p) { p.visible = true; });
      kick();
   }
   document.addEventListener('visibilitychange', function () { if (!document.hidden) { kick(); } });

   var timer;
   function relayout() { clearTimeout(timer); timer = setTimeout(function () { panels.forEach(function (p) { p.resize(); p.draw(); }); }, 100); }
   if ('ResizeObserver' in window) { panels.forEach(function (p) { new ResizeObserver(relayout).observe(p.canvas); }); }
   else { window.addEventListener('resize', relayout); }
})();
