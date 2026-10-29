/* Four more live maps for the Web GIS hub landing page (mounted by geo-viz.js, which loads the boundaries):
     layers   Lab 3's layer control: density, proportional circles, points and the 25 km NUST circle switched on and off
     heat     a population-weighted kernel density ("heatmap") of the 135 districts with census data, and its bandwidth
     groups   k-means grouping of the districts by log density and log population, step by step
     schemes  four rules for cutting the same densities into five classes: Lab 3's breaks, quantiles, equal interval, natural breaks
   The plain algorithms (k-means, natural breaks) are in window.GEOVIZ_PURE, so they can be checked without a browser. */
(function () {
   'use strict';
   var TAU = Math.PI * 2;

   /* ---------------------------------------------------------------- the maths ---------------------------------------------------------------- */
   function rng(seed) {
      var s = seed >>> 0;
      return function () {
         s = (s + 0x6D2B79F5) >>> 0;
         var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
         return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
   }
   function kmeans2d(X, K, seed, maxIter) {                                        // Lloyd's algorithm, recording every step
      var r = rng(seed), n = X.length, cents = [], used = {}, snaps = [], prev = null, it, i, c;
      while (cents.length < K) { var q = Math.floor(r() * n); if (!used[q]) { used[q] = 1; cents.push([X[q][0], X[q][1]]); } }
      for (it = 0; it < maxIter; it++) {
         var asg = X.map(function (x) { var b = 0, bd = 1e18; for (c = 0; c < K; c++) { var d = (x[0] - cents[c][0]) * (x[0] - cents[c][0]) + (x[1] - cents[c][1]) * (x[1] - cents[c][1]); if (d < bd) { bd = d; b = c; } } return b; });
         var inertia = 0; for (i = 0; i < n; i++) { inertia += (X[i][0] - cents[asg[i]][0]) * (X[i][0] - cents[asg[i]][0]) + (X[i][1] - cents[asg[i]][1]) * (X[i][1] - cents[asg[i]][1]); }
         var same = prev && asg.every(function (v, k) { return v === prev[k]; });
         var snap = { cents: cents.map(function (v) { return v.slice(); }), asg: asg, inertia: inertia, done: !!same };
         snaps.push(snap);
         if (same) { break; }
         var next = [];
         for (c = 0; c < K; c++) { var sx = 0, sy = 0, m = 0; for (i = 0; i < n; i++) { if (asg[i] === c) { sx += X[i][0]; sy += X[i][1]; m++; } } next.push(m ? [sx / m, sy / m] : cents[c]); }
         snap.next = next; cents = next; prev = asg;
      }
      return snaps;
   }
   function jenks(vals, k) {                                                       // Fisher-Jenks natural breaks (upper bounds of the first k - 1 classes)
      var v = vals.slice().sort(function (a, b) { return a - b; }), n = v.length, INF = 1e18, i, j, l, m, lc = [], vr = [], vv = 0;
      for (i = 0; i <= n; i++) { lc.push(new Array(k + 1).fill(0)); vr.push(new Array(k + 1).fill(INF)); }
      for (i = 1; i <= k; i++) { lc[1][i] = 1; vr[1][i] = 0; }
      for (l = 2; l <= n; l++) {
         var s1 = 0, s2 = 0, w = 0;
         for (m = 1; m <= l; m++) {
            var i3 = l - m + 1, val = v[i3 - 1]; s2 += val * val; s1 += val; w++; vv = s2 - s1 * s1 / w; var i4 = i3 - 1;
            if (i4) { for (j = 2; j <= k; j++) { if (vr[l][j] >= vv + vr[i4][j - 1]) { lc[l][j] = i3; vr[l][j] = vv + vr[i4][j - 1]; } } }
         }
         lc[l][1] = 1; vr[l][1] = vv;
      }
      var ks = n, out = [];
      for (j = k; j > 1; j--) { out.push(v[lc[ks][j] - 2]); ks = lc[ks][j] - 1; }
      return out.sort(function (a, b) { return a - b; });
   }
   function classOf(v, breaks) { var c = 0; for (var i = 0; i < breaks.length; i++) { if (v > breaks[i]) { c++; } } return c; }          // Lab 3: breaks.filter(b => density > b).length
   function schemeBreaks(dens) {
      var s = dens.slice().sort(function (a, b) { return a - b; }), n = s.length, mn = s[0], mx = s[n - 1], q = [], e = [];
      for (var k = 1; k < 5; k++) { q.push(s[Math.floor(n * k / 5)]); e.push(mn + (mx - mn) * k / 5); }
      return { fixed: [50, 150, 400, 1000], quantile: q, equal: e, natural: jenks(dens, 5) };
   }
   window.GEOVIZ_PURE = { kmeans2d: kmeans2d, jenks: jenks, classOf: classOf, schemeBreaks: schemeBreaks, rng: rng };

   /* ------------------------------------------------------------------ the panels ------------------------------------------------------------------ */
   window.GEOVIZ_EXTRA = function (A) {
      var COL = A.COL, TEXT = A.TEXT, GRID = A.GRID, AXIS = A.AXIS, MONO = A.MONO, CLS = A.CLS, NODATA = A.NODATA, reduce = A.reduce, clamp = A.clamp, ease = A.ease, easeIO = A.easeIO, lerp = A.lerp, rgba = A.rgba, fmt = A.fmt;
      var FONT = 'ui-monospace, "Cascadia Code", Consolas, monospace', PURE = window.GEOVIZ_PURE, CL5 = [COL.cyan, COL.green, COL.amber, COL.violet, '#f87171'];
      function proj(f) { return { X: function (lon) { return f.ox + (lon - A.LON0) * A.KX * f.s; }, Y: function (lat) { return f.oy + (A.LAT1 - lat) * f.s; } }; }
      function withData(D) { var out = []; D.forEach(function (d, i) { if (d.pop) { out.push(i); } }); return out; }
      function reserve(p) { return p.W < 420 ? 112 : 160; }

      /* ================================= layer control ================================= */
      function layers(card) {
         var p = A.base(card); p.needsData = true;
         var NAMES = ['Density', 'Circles', 'Points', 'NUST 25 km'], EV = [[0.9, 0, 1], [2.2, 1, 1], [3.5, 2, 1], [4.8, 3, 1], [7.4, 0, 0], [8.8, 1, 0], [10.2, 2, 0], [11.6, 3, 0]], T_END = 12.8, FADE = 0.45, t, hold;
         p.reset = function () { t = 0; hold = 0; p.finished = false; };
         p.update = function (dt) { t += dt; if (t >= T_END) { p.finished = true; hold += dt; if (hold > 1 && !reduce) { p.reset(); } } };
         function alphas(tt) {
            var a = [0, 0, 0, 0], last = null, pulse = [0, 0, 0, 0];
            EV.forEach(function (e) { if (tt >= e[0]) { var q = ease((tt - e[0]) / FADE); a[e[1]] = e[2] ? q : 1 - q; last = e; if (tt - e[0] < 0.7) { pulse[e[1]] = 1 - (tt - e[0]) / 0.7; } } });
            return { a: a, last: last, pulse: pulse };
         }
         p.draw = function () {
            var G = A.geo(); if (!G) { p.waiting(); return; }
            p.begin();
            var c = p.ctx, W = p.W, H = p.H, f = A.fit(p, reserve(p)), D = G.d, P = proj(f), i, st = reduce ? { a: [1, 1, 1, 1], last: null, pulse: [0, 0, 0, 0] } : alphas(t);
            A.ensureBase(p, f, D, 0.3); A.paintBase(p); c.lineJoin = 'round';
            if (st.a[0] > 0.01) { for (i = 0; i < D.length; i++) { c.globalAlpha = st.a[0]; c.fillStyle = D[i].cls < 0 ? NODATA : CLS[D[i].cls]; c.fill(p.paths[i], 'evenodd'); } c.globalAlpha = 1; }
            if (st.a[1] > 0.01) {                                                       // proportional circles, in a pane above the polygons: radius = sqrt(population) / 160
               for (i = 0; i < D.length; i++) { if (!D[i].pop || !D[i].pt) { continue; } var r = Math.sqrt(D[i].pop) / 160 * 0.5 * st.a[1];
                  c.fillStyle = rgba(COL.amber, 0.38 * st.a[1]); c.strokeStyle = rgba(COL.amber, 0.9 * st.a[1]); c.lineWidth = 1; c.beginPath(); c.arc(P.X(D[i].pt[0]), P.Y(D[i].pt[1]), r, 0, TAU); c.fill(); c.stroke(); }
            }
            if (st.a[2] > 0.01) { c.fillStyle = rgba('#ffffff', 0.85 * st.a[2]); for (i = 0; i < D.length; i++) { if (D[i].pt) { c.beginPath(); c.arc(P.X(D[i].pt[0]), P.Y(D[i].pt[1]), 1.5, 0, TAU); c.fill(); } } }
            if (st.a[3] > 0.01) {                                                       // 25 km around NUST (72.99 E, 33.64 N); one degree of latitude is 111.3 km
               var nx = P.X(72.9906), ny = P.Y(33.6423), rr = 25 / 111.32 * f.s, ring = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5);
               c.strokeStyle = rgba(COL.green, 0.95 * st.a[3]); c.fillStyle = rgba(COL.green, 0.2 * st.a[3]); c.lineWidth = 1.8; c.beginPath(); c.arc(nx, ny, rr, 0, TAU); c.fill(); c.stroke();
               c.strokeStyle = rgba(COL.green, 0.5 * st.a[3] * (1 - ring)); c.beginPath(); c.arc(nx, ny, rr + 3 + ring * 8, 0, TAU); c.stroke();
               c.fillStyle = '#fff'; c.beginPath(); c.arc(nx, ny, 2.4, 0, TAU); c.fill();
            }
            // the layer control, drawn the way Leaflet draws it
            var lx = f.right + 8, bw = W - lx - 6, y0 = 10, rowH = 24;
            c.fillStyle = 'rgba(8,16,34,.9)'; c.fillRect(lx, y0, bw, 28 + 4 * rowH); c.strokeStyle = 'rgba(148,163,184,.35)'; c.lineWidth = 1; c.strokeRect(lx + 0.5, y0 + 0.5, bw - 1, 28 + 4 * rowH - 1);
            c.fillStyle = '#e8eefb'; c.textAlign = 'left'; c.font = 'bold 11px ' + FONT; c.fillText('Layers ▾', lx + 8, y0 + 17); c.font = MONO;
            for (i = 0; i < 4; i++) {
               var ry = y0 + 28 + i * rowH, on = st.a[i] > 0.5, pu = st.pulse[i];
               if (pu > 0) { c.fillStyle = 'rgba(251,191,36,' + (0.22 * pu) + ')'; c.fillRect(lx + 2, ry, bw - 4, rowH); }
               c.strokeStyle = on ? COL.amber : 'rgba(148,163,184,.7)'; c.lineWidth = 1.4; c.strokeRect(lx + 8.5, ry + 6.5, 11, 11);
               if (st.a[i] > 0.02) { c.fillStyle = rgba(COL.amber, st.a[i]); c.fillRect(lx + 11, ry + 9, 6, 6); }
               c.fillStyle = on ? '#e8eefb' : TEXT; c.fillText(NAMES[i], lx + 27, ry + 16);
            }
            var cnt = st.a.filter(function (v) { return v > 0.5; }).length;
            c.fillStyle = TEXT; c.fillText('circles: upper pane', lx, y0 + 28 + 4 * rowH + 18); c.fillText('radius = √pop', lx, y0 + 28 + 4 * rowH + 32);
            p.say('on', cnt + '/4'); p.say('last', st.last ? NAMES[st.last[1]] + (st.last[2] ? ' on' : ' off') : (reduce ? 'all on' : '--'));
         };
         return p;
      }

      /* ================================== heatmap ================================== */
      var LUT = (function () {                                                       // alpha (0..255) -> heat colour
         var stops = [[0, 8, 20, 60, 0], [0.12, 37, 60, 180, 110], [0.38, 34, 211, 238, 190], [0.62, 52, 211, 153, 220], [0.84, 251, 191, 36, 240], [1, 255, 255, 255, 255]], out = new Uint8ClampedArray(256 * 4);
         for (var a = 0; a < 256; a++) { var t = a / 255, k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) { k++; } var s0 = stops[k], s1 = stops[k + 1], u = (t - s0[0]) / (s1[0] - s0[0]); for (var j = 0; j < 4; j++) { out[a * 4 + j] = Math.round(s0[j + 1] + (s1[j + 1] - s0[j + 1]) * u); } }
         return out;
      })();
      function heat(card) {
         var p = A.base(card); p.needsData = true;
         var HD = 0.5, t, hold, stamp = document.createElement('canvas'), buf = document.createElement('canvas'), out = document.createElement('canvas');
         stamp.width = stamp.height = 64; var sg = stamp.getContext('2d'), gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
         var T_END = 9.4;
         function bandwidth(tt) {                                                       // in degrees: grows, holds, shrinks
            if (reduce) { return 0.65; }
            if (tt < 0.5) { return 0.15; }
            if (tt < 4.4) { return lerp(0.15, 1.5, easeIO((tt - 0.5) / 3.9)); }
            if (tt < 5.6) { return 1.5; }
            if (tt < 7.8) { return lerp(1.5, 0.45, easeIO((tt - 5.6) / 2.2)); }
            return 0.45;
         }
         p.reset = function () { t = 0; hold = 0; p.finished = false; };
         p.update = function (dt) { t += dt; if (t >= T_END) { p.finished = true; hold += dt; if (hold > 0.8 && !reduce) { p.reset(); } } };
         p.draw = function () {
            var G = A.geo(); if (!G) { p.waiting(); return; }
            p.begin();
            var c = p.ctx, W = p.W, H = p.H, f = A.fit(p, reserve(p)), D = G.d, P = proj(f), i, hDeg = bandwidth(t), hPx = hDeg * f.s;
            A.ensureBase(p, f, D, 0.22); A.paintBase(p);
            if (p._allKey !== p._key) { p.all = new Path2D(); p.paths.forEach(function (pp) { p.all.addPath(pp); }); p._allKey = p._key; }
            var hw = Math.max(8, Math.ceil(W * HD)), hh = Math.max(8, Math.ceil(H * HD));
            if (buf.width !== hw || buf.height !== hh) { buf.width = hw; buf.height = hh; out.width = hw; out.height = hh; }
            var b = buf.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, hw, hh); b.globalCompositeOperation = 'lighter';
            var maxPop = 0; D.forEach(function (d) { if (d.pop > maxPop) { maxPop = d.pop; } });
            var rad = hPx * HD * 1.6, pts = [];                                         // each district counts in proportion to the square root of its population
            for (i = 0; i < D.length; i++) { if (D[i].pop && D[i].pt) { pts.push({ i: i, x: P.X(D[i].pt[0]) * HD, y: P.Y(D[i].pt[1]) * HD, w: Math.sqrt(D[i].pop / maxPop) }); } }
            function kern(u) { return u >= 1 ? 0 : (u < 0.45 ? 1 - 0.55 * u / 0.45 : 0.45 * (1 - (u - 0.45) / 0.55)); }             // the profile of the stamp
            var peak = 1e-9, hotI = -1, j;
            for (i = 0; i < pts.length; i++) {                                           // heat at every district point: the surface peaks at (or near) one of them
               var hsum = 0; for (j = 0; j < pts.length; j++) { var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y; if (dx * dx + dy * dy < rad * rad) { hsum += pts[j].w * kern(Math.sqrt(dx * dx + dy * dy) / rad); } }
               if (hsum > peak) { peak = hsum; hotI = pts[i].i; }
            }
            var scale = 0.92 / peak;                                                    // so the hottest place is always near the top of the colour scale, whatever h is
            for (i = 0; i < pts.length; i++) { b.globalAlpha = Math.min(1, pts[i].w * scale); b.drawImage(stamp, pts[i].x - rad, pts[i].y - rad, rad * 2, rad * 2); }
            b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
            var img = b.getImageData(0, 0, hw, hh), d = img.data, o = out.getContext('2d'), res = o.createImageData(hw, hh), rd = res.data, k;
            for (k = 0; k < hw * hh; k++) { var a = d[k * 4 + 3], li = a * 4, ri = k * 4; rd[ri] = LUT[li]; rd[ri + 1] = LUT[li + 1]; rd[ri + 2] = LUT[li + 2]; rd[ri + 3] = LUT[li + 3]; }
            o.putImageData(res, 0, 0);
            c.save(); c.clip(p.all, 'evenodd'); c.imageSmoothingEnabled = true; c.drawImage(out, 0, 0, W, H); c.restore();
            c.strokeStyle = 'rgba(148,163,184,.25)'; c.lineWidth = 0.5; c.stroke(p.all);
            // legend and read-outs in the right-hand column
            var lx = f.right + 12, bw = W - lx - 10;
            c.textAlign = 'left'; c.fillStyle = TEXT; c.fillText('population heat', lx, 16);
            var gl = c.createLinearGradient(lx, 0, lx + bw, 0); for (k = 0; k <= 8; k++) { var li2 = Math.round(k / 8 * 255) * 4; gl.addColorStop(k / 8, 'rgba(' + LUT[li2] + ',' + LUT[li2 + 1] + ',' + LUT[li2 + 2] + ',' + Math.max(0.25, LUT[li2 + 3] / 255) + ')'); }
            c.fillStyle = gl; c.fillRect(lx, 24, bw, 10); c.strokeStyle = 'rgba(255,255,255,.25)'; c.strokeRect(lx + 0.5, 24.5, bw - 1, 9);
            c.fillStyle = TEXT; c.fillText('low', lx, 48); c.textAlign = 'right'; c.fillText('high', lx + bw, 48);
            // bandwidth drawn as a circle, to scale
            c.textAlign = 'left'; c.fillStyle = TEXT; c.fillText('bandwidth h', lx, 76);
            c.strokeStyle = rgba(COL.amber, 0.9); c.lineWidth = 1.6; c.fillStyle = rgba(COL.amber, 0.15); c.beginPath(); c.arc(lx + Math.min(hPx, bw / 2 - 2) + 2, 116, Math.min(hPx, bw / 2 - 2), 0, TAU); c.fill(); c.stroke();
            p.say('h', Math.round(hDeg * 111.32) + ' km'); p.say('hot', hotI >= 0 ? D[hotI].n : '--');
         };
         return p;
      }

      /* ============================ grouping the districts (k-means) ============================ */
      function groups(card) {
         var p = A.base(card); p.needsData = true;
         var K = 5, SEED = 5, snaps = null, idx = null, X = null, T0 = 0.9, SLOT = 1.0, ASSIGN = 0.5, t, hold, byDistrict = null;
         function ensure() {
            if (snaps || !A.geo()) { return; }
            var D = A.geo().d; idx = withData(D); X = idx.map(function (i) { return [Math.log(D[i].pop / D[i].a) / Math.LN10, Math.log(D[i].pop) / Math.LN10]; });
            for (var j = 0; j < 2; j++) { var m = 0, v = 0; X.forEach(function (r) { m += r[j]; }); m /= X.length; X.forEach(function (r) { v += (r[j] - m) * (r[j] - m); }); v = Math.sqrt(v / X.length); X.forEach(function (r) { r[j] = (r[j] - m) / v; }); }
            snaps = PURE.kmeans2d(X, K, SEED, 25); byDistrict = {}; idx.forEach(function (di, k) { byDistrict[di] = k; });
         }
         p.reset = function () { t = 0; hold = 0; p.finished = false; };
         p.update = function (dt) { ensure(); if (!snaps) { return; } t += dt; if (t >= T0 + snaps.length * SLOT + 0.2) { p.finished = true; hold += dt; if (hold > 2.8 && !reduce) { p.reset(); } } };
         p.draw = function () {
            ensure(); var G = A.geo(); if (!G || !snaps) { p.waiting(); return; }
            p.begin();
            var c = p.ctx, W = p.W, H = p.H, f = A.fit(p, p.W < 420 ? 128 : 190), D = G.d, i, k, tt = reduce ? 1e9 : t;
            var it = clamp(Math.floor((tt - T0) / SLOT), 0, snaps.length - 1), local = tt - T0 - it * SLOT, started = tt >= T0 || reduce, last = reduce || it >= snaps.length - 1 && local > ASSIGN;
            var st = snaps[it], prev = it ? snaps[it - 1] : null, aq = reduce ? 1 : ease(local / ASSIGN), mq = reduce || !st.next ? 0 : ease((local - ASSIGN) / (SLOT - ASSIGN));
            var cents = st.cents.map(function (cc, q) { var to = st.next && !st.done ? st.next[q] : cc; return [lerp(cc[0], to[0], mq), lerp(cc[1], to[1], mq)]; });
            A.ensureBase(p, f, D, 0.28); A.paintBase(p); c.lineJoin = 'round';
            for (i = 0; i < D.length; i++) {
               var kk = byDistrict[i];
               if (kk === undefined) { c.globalAlpha = 0.55; c.fillStyle = NODATA; c.fill(p.paths[i], 'evenodd'); c.globalAlpha = 1; continue; }
               if (!started) { c.globalAlpha = 0.5; c.fillStyle = '#64748b'; c.fill(p.paths[i], 'evenodd'); c.globalAlpha = 1; continue; }
               var oldC = prev ? CL5[prev.asg[kk]] : '#64748b', newC = CL5[st.asg[kk]];
               c.globalAlpha = 0.85; c.fillStyle = oldC; c.fill(p.paths[i], 'evenodd'); if (oldC !== newC) { c.globalAlpha = 0.85 * aq; c.fillStyle = newC; c.fill(p.paths[i], 'evenodd'); } c.globalAlpha = 1;
            }
            // the scatter plot of the two features, in the right-hand column
            var sx0 = f.right + 14, sw = W - sx0 - 8, sh = Math.min(sw, H - 62), sy0 = 20;
            function SX(v) { return sx0 + (clamp(v, -2.9, 2.9) + 3) / 6 * sw; } function SY(v) { return sy0 + sh - (clamp(v, -2.9, 2.9) + 3) / 6 * sh; }
            c.fillStyle = TEXT; c.textAlign = 'left'; c.fillText('log density →', sx0, sy0 + sh + 14); c.save(); c.translate(sx0 - 6, sy0 + sh); c.rotate(-Math.PI / 2); c.fillText('log population →', 0, 0); c.restore();
            c.strokeStyle = AXIS; c.lineWidth = 1; c.strokeRect(sx0 + 0.5, sy0 + 0.5, sw - 1, sh - 1);
            for (k = 0; k < X.length; k++) { var col = started ? CL5[st.asg[k]] : '#64748b'; if (started && prev && prev.asg[k] !== st.asg[k] && aq < 0.5) { col = CL5[prev.asg[k]]; } c.fillStyle = rgba(col, 0.85); c.beginPath(); c.arc(SX(X[k][0]), SY(X[k][1]), 2.1, 0, TAU); c.fill(); }
            for (k = 0; k < K; k++) {
               var cx = SX(cents[k][0]), cy = SY(cents[k][1]);
               c.fillStyle = CL5[k]; c.strokeStyle = '#fff'; c.lineWidth = 1.8; c.beginPath(); c.arc(cx, cy, 5.5, 0, TAU); c.fill(); c.stroke();
               c.strokeStyle = '#04101e'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx - 2.6, cy); c.lineTo(cx + 2.6, cy); c.moveTo(cx, cy - 2.6); c.lineTo(cx, cy + 2.6); c.stroke();
            }
            var sizes = [0, 0, 0, 0, 0]; st.asg.forEach(function (a) { sizes[a]++; });
            p.say('iter', started ? String(it + 1) : '0'); p.say('inertia', started ? st.inertia.toFixed(1) : '--'); p.say('state', started ? ((st.done && local > ASSIGN) || last && st.done ? 'converged: ' + sizes.join(' · ') : (local < ASSIGN ? 'assign' : 'update')) : 'random start');
         };
         return p;
      }

      /* ============================== classification schemes ============================== */
      function schemes(card) {
         var p = A.base(card); p.needsData = true;
         var ORDER = [['fixed', "Lab 3 breaks"], ['quantile', 'quantiles'], ['equal', 'equal interval'], ['natural', 'natural breaks']], SLOT = 3.4, MOVE = 0.8, T_END = ORDER.length * SLOT + 0.3, br = null, cls = null, counts = null, idx = null, t, hold;
         function ensure() {
            if (br || !A.geo()) { return; }
            var D = A.geo().d; idx = withData(D); var dens = idx.map(function (i) { return D[i].pop / D[i].a; });
            br = PURE.schemeBreaks(dens); cls = {}; counts = {};
            ORDER.forEach(function (o) { cls[o[0]] = D.map(function (d) { return d.pop ? PURE.classOf(d.pop / d.a, br[o[0]]) : -1; }); counts[o[0]] = [0, 0, 0, 0, 0]; cls[o[0]].forEach(function (cc) { if (cc >= 0) { counts[o[0]][cc]++; } }); });
         }
         p.reset = function () { t = 0; hold = 0; p.finished = false; };
         p.update = function (dt) { t += dt; if (t >= T_END) { p.finished = true; hold += dt; if (hold > 0.5 && !reduce) { p.reset(); } } };
         function label(v, k, bks) { return k < 4 ? '≤ ' + fmt(Math.round(bks[k])) : '> ' + fmt(Math.round(bks[3])); }
         p.draw = function () {
            ensure(); var G = A.geo(); if (!G || !br) { p.waiting(); return; }
            p.begin();
            var c = p.ctx, W = p.W, H = p.H, f = A.fit(p, reserve(p) + 8), D = G.d, i, k, tt = reduce ? 0 : t;
            var s = Math.min(ORDER.length - 1, Math.floor(tt / SLOT)), local = tt - s * SLOT, q = s === 0 && !reduce ? ease(local / MOVE) : ease(local / MOVE), key = ORDER[s][0], pkey = ORDER[(s + ORDER.length - 1) % ORDER.length][0];
            if (s === 0) { pkey = key; q = 1; }
            A.ensureBase(p, f, D, 0.28); A.paintBase(p); c.lineJoin = 'round';
            for (i = 0; i < D.length; i++) {
               var a = cls[pkey][i], b = cls[key][i], col = function (v) { return v < 0 ? NODATA : CLS[v]; };
               c.globalAlpha = 0.9; c.fillStyle = col(a); c.fill(p.paths[i], 'evenodd'); if (a !== b && q > 0) { c.globalAlpha = 0.9 * q; c.fillStyle = col(b); c.fill(p.paths[i], 'evenodd'); } c.globalAlpha = 1;
            }
            var lx = f.right + 10, bw = W - lx - 8, bks = br[key], rows = 5, top = 34, rowH = Math.min(46, (H - top - 8) / rows), maxN = 0, shown = [];
            for (k = 0; k < 5; k++) { shown.push(lerp(counts[pkey][k], counts[key][k], q)); }
            shown.forEach(function (v) { if (v > maxN) { maxN = v; } });
            c.textAlign = 'left'; c.fillStyle = '#ffffff'; c.font = 'bold 11px ' + FONT; c.fillText(ORDER[s][1], lx, 16); c.font = MONO; c.fillStyle = TEXT; c.fillText('districts per class', lx, 29);
            for (k = 0; k < 5; k++) {
               var y = top + k * rowH, bwid = Math.max(1, (bw - 28) * shown[k] / 135);
               c.fillStyle = CLS[k]; c.fillRect(lx, y + 3, 11, 11); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1; c.strokeRect(lx + 0.5, y + 3.5, 10, 10);
               c.fillStyle = '#e8eefb'; c.fillText(label(0, k, bks), lx + 17, y + 13);
               c.fillStyle = rgba(CL5[1], 0.85); c.fillRect(lx, y + 19, bwid, 8); c.fillStyle = '#e8eefb'; c.fillText(String(Math.round(shown[k])), lx + bwid + 5, y + 27);
            }
            var big = Math.max.apply(null, counts[key]);
            p.say('scheme', ORDER[s][1]); p.say('big', Math.round(big / 135 * 100) + '%');
         };
         return p;
      }

      return { layers: layers, heat: heat, groups: groups, schemes: schemes };
   };
})();
