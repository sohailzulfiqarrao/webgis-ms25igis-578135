const useCanvas = new URLSearchParams(window.location.search).has('canvas');

const map = L.map('map', {
   center: [30.3753, 69.3451],
   zoom: 5,
   minZoom: 5,
   maxZoom: 14,
   maxBounds: [[21.5, 58.5], [39.0, 80.5]],
   maxBoundsViscosity: 1.0,
   preferCanvas: useCanvas
});

const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
   maxZoom: 19,
   attribution: '&copy; OpenStreetMap contributors'
});

// The manual's default, CARTO Positron, now answers every tile with "API KEY REQUIRED",
// so the quiet grey basemap is Esri's Light Gray Canvas, which needs no key.
const lightGrey = L.tileLayer(
   'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
   maxZoom: 16,
   attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
});

const imagery = L.tileLayer(
   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
   maxZoom: 19,
   attribution: 'Tiles &copy; Esri'
});

lightGrey.addTo(map);

const layerControl = L.control.layers(
   {
      'Light (Esri Light Gray)': lightGrey,
      'OpenStreetMap': osm,
      'Satellite (Esri)': imagery
   },
   {},
   { collapsed: false }
).addTo(map);

L.control.scale({ imperial: false }).addTo(map);

function show(value) {
   if (value === null || value === undefined || value === '') {
      return 'not recorded';
   }
   return typeof value === 'number' ? value.toLocaleString() : value;
}

function densityOf(p) {
   if (p.pop_2023 === null || p.pop_2023 === undefined) return null;
   return p.pop_2023 / p.area_km2;
}

// Optional 4: five colours and four break values; the breaks are either fixed or quantiles
const DENSITY_COLOURS = ['#deebf7', '#9ecae1', '#4292c6', '#2171b5', '#08306b'];
const FIXED_BREAKS = [50, 150, 400, 1000];
let breaks = FIXED_BREAKS;
let quantileBreaksList = [];

function colourFor(density) {
   if (density === null) return '#c9cfd1';
   return DENSITY_COLOURS[breaks.filter(b => density > b).length];
}

function styleFor(feature) {
   return {
      color: '#ffffff',
      weight: 1,
      fillColor: colourFor(densityOf(feature.properties)),
      fillOpacity: 0.8
   };
}

const districtGroup = L.featureGroup().addTo(map);
layerControl.addOverlay(districtGroup, 'Population density');

const circleGroup = L.featureGroup().addTo(map);
layerControl.addOverlay(circleGroup, 'Population');

// Optional 1: the 160 points as clustered markers, on a separate overlay
const clusterGroup = L.markerClusterGroup();
layerControl.addOverlay(clusterGroup, 'Points (clustered)');

let allDistricts = null;
let allPoints = null;
let districts = null;

function draw(province) {
   const t0 = performance.now();
   const keep = function (feature) {
      return province === 'all' || feature.properties.province === province;
   };
   currentKeep = keep;

   districtGroup.clearLayers();
   circleGroup.clearLayers();

   districts = L.geoJSON(allDistricts, {
      filter: keep,
      style: styleFor,
      onEachFeature: bindDistrict
   });
   districtGroup.addLayer(districts);

   circleGroup.addLayer(L.geoJSON(allPoints, {
      filter: function (f) { return keep(f) && hasPopulation(f); },
      pointToLayer: circleFor
   }));

   clusterGroup.clearLayers();
   clusterGroup.addLayer(L.geoJSON(allPoints, {
      filter: keep,
      onEachFeature: function (f, l) { l.bindTooltip(f.properties.district); }
   }));

   const n = districts.getLayers().length;
   if (n > 0) {
      map.fitBounds(districts.getBounds());
   }
   document.getElementById('count').textContent = n + ' districts';
   updateLabels();
   console.log('draw(' + province + '): ' + n + ' districts in ' +
               (performance.now() - t0).toFixed(1) + ' ms, ' +
               (useCanvas ? 'canvas' : 'SVG'));
}

async function loadJSON(path) {
   const response = await fetch(path);
   if (!response.ok) {
      throw new Error(path + ': status ' + response.status);
   }
   return response.json();
}

async function loadData() {
   try {
      [allDistricts, allPoints] = await Promise.all([
         loadJSON('data/districts.geojson'),
         loadJSON('data/district_points.geojson')
      ]);
   } catch (err) {
      console.error('Could not load the data.', err);
      document.getElementById('count').textContent = 'data failed to load';
      return;
   }
   const view = savedView();
   quantileBreaksList = quantileBreaksOf(
      allDistricts.features.map(f => densityOf(f.properties)).filter(d => d !== null), 5);
   fillProvinceList();
   draw('all');
   if (view && view.center) {
      map.setView([view.center.lat, view.center.lng], view.zoom, { animate: false });
   }
}

loadData();

// bottom left, not bottom right: the right-hand corner already holds the layer control and the info panel
const legend = L.control({ position: 'bottomleft' });

function fillLegend(div) {
   const fmt = n => Math.round(n).toLocaleString();
   const labels = ['under ' + fmt(breaks[0])];
   for (let i = 1; i < breaks.length; i++) {
      labels.push(fmt(breaks[i - 1]) + ' to ' + fmt(breaks[i]));
   }
   labels.push('over ' + fmt(breaks[breaks.length - 1]));

   div.innerHTML = '<strong>People per km<sup>2</sup></strong><br>';
   for (let i = 0; i < DENSITY_COLOURS.length; i++) {
      div.innerHTML +=
         '<i style="background:' + DENSITY_COLOURS[i] + '"></i> ' +
         labels[i] + '<br>';
   }
   div.innerHTML +=
      '<i style="background:' + colourFor(null) + '"></i> no census data';

   const sizes = [10000000, 4000000, 1000000];
   const rMax = radiusFor(sizes[0]);
   const pad = 6;
   const base = pad + 2 * rMax;
   let svg = '<svg width="' + (2 * rMax + 75) +
             '" height="' + (base + 2) + '">';
   for (const s of sizes) {
      const r = radiusFor(s);
      const top = base - 2 * r;
      svg += '<circle cx="' + (rMax + 1) + '" cy="' + (base - r) +
             '" r="' + r + '" fill="#f97316" fill-opacity=".2"' +
             ' stroke="#7c2d12"/>' +
             '<line x1="' + (rMax + 1) + '" y1="' + top +
             '" x2="' + (2 * rMax + 14) + '" y2="' + top +
             '" stroke="#7c2d12" stroke-width=".6"/>' +
             '<text x="' + (2 * rMax + 17) + '" y="' + (top + 3.5) +
             '" font-size="10">' + (s / 1000000) + ' million</text>';
   }
   svg += '</svg>';
   div.innerHTML +=
      '<div class="circles"><strong>Population</strong>' + svg + '</div>';
}

legend.onAdd = function () {
   const div = L.DomUtil.create('div', 'legend');
   fillLegend(div);
   L.DomEvent.disableClickPropagation(div);
   return div;
};

legend.addTo(map);

const info = L.control({ position: 'topright' });

info.onAdd = function () {
   this._div = L.DomUtil.create('div', 'info');
   L.DomEvent.disableClickPropagation(this._div);
   L.DomEvent.disableScrollPropagation(this._div);
   this.update();
   return this._div;
};

info.update = function (p) {
   const zoom = '<div class="muted">Zoom level ' + map.getZoom() + '</div>';
   if (!p) {
      this._div.innerHTML = '<h4>District</h4>' +
         '<div class="muted">Hover over a district</div>' + zoom;
      return;
   }
   const d = densityOf(p);
   this._div.innerHTML =
      '<h4>' + p.district + '</h4>' +
      p.province + '<br>' +
      'Population: ' + show(p.pop_2023) + '<br>' +
      'Area: ' + show(p.area_km2) + ' km<sup>2</sup><br>' +
      'Density: ' + (d === null ? 'not recorded'
                                : Math.round(d).toLocaleString() + ' per km<sup>2</sup>') +
      zoom;
};

info.addTo(map);

function highlight(e) {
   e.target.setStyle({ weight: 3, color: '#1a202c', fillOpacity: 0.95 });
   e.target.bringToFront();
   info.update(e.target.feature.properties);
}

function unhighlight(e) {
   districts.resetStyle(e.target);
   info.update();
}

function zoomToDistrict(e) {
   map.fitBounds(e.target.getBounds(), { padding: [20, 20] });
}

function bindDistrict(feature, layer) {
   layer.bindTooltip(feature.properties.district, { sticky: true });
   layer.on({
      mouseover: highlight,
      mouseout: unhighlight,
      click: zoomToDistrict
   });
}

map.createPane('symbols');
map.getPane('symbols').style.zIndex = 450;

function radiusFor(population) {
   return Math.sqrt(population) / 160;
}

function circleFor(feature, latlng) {
   return L.circleMarker(latlng, {
      pane: 'symbols',
      radius: radiusFor(feature.properties.pop_2023),
      color: '#7c2d12',
      weight: 1,
      fillColor: '#f97316',
      fillOpacity: 0.7
   }).bindTooltip(
      feature.properties.district + ': ' +
      feature.properties.pop_2023.toLocaleString()
   );
}

function hasPopulation(feature) {
   return feature.properties.pop_2023 !== null;
}

const nust = [33.6423, 72.9906];
const nustGroup = L.featureGroup([
   L.circle(nust, { radius: 25000, color: '#0f766e', weight: 2,
                    fillOpacity: 0.08 }),
   L.circleMarker(nust, { radius: 6, color: '#0f766e',
                          fillColor: '#0f766e', fillOpacity: 1 })
]).bindTooltip('NUST H-12: a 25 km circle and a 6 pixel circleMarker');
layerControl.addOverlay(nustGroup, 'NUST, 25 km');

function showCoordinates(e) {
   L.popup()
      .setLatLng(e.latlng)
      .setContent(e.latlng.lat.toFixed(4) + ', ' + e.latlng.lng.toFixed(4))
      .openOn(map);
}

document.getElementById('coords')
   .addEventListener('change', function (event) {
      if (event.target.checked) {
         map.on('click', showCoordinates);
      } else {
         map.off('click', showCoordinates);
      }
   });

map.on('zoomend', function () {
   info.update();
});

// Optional 2: the density as a permanent label on each district above zoom 8
const labelGroup = L.layerGroup().addTo(map);
let currentKeep = null;

function updateLabels() {
   labelGroup.clearLayers();
   if (!allPoints || !currentKeep || map.getZoom() <= 8) return;
   allPoints.features.forEach(function (f) {
      const d = densityOf(f.properties);
      if (d === null || !currentKeep(f)) return;
      labelGroup.addLayer(
         L.tooltip({ permanent: true, direction: 'center', className: 'density-label' })
            .setLatLng([f.geometry.coordinates[1], f.geometry.coordinates[0]])
            .setContent(Math.round(d).toLocaleString())
      );
   });
}

map.on('zoomend', updateLabels);

function fillProvinceList() {
   const select = document.getElementById('province');
   const provinces = [...new Set(
      allDistricts.features.map(f => f.properties.province)
   )].sort();
   for (const name of provinces) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
   }
}

document.getElementById('province')
   .addEventListener('change', function (event) {
      draw(event.target.value);
   });

// Optional 3: remember where the user was looking, and go back there on the next visit
const VIEW_KEY = 'lab3-view';

function savedView() {
   try {
      return JSON.parse(localStorage.getItem(VIEW_KEY));
   } catch (err) {
      return null;
   }
}

map.on('moveend', function () {
   try {
      localStorage.setItem(VIEW_KEY, JSON.stringify({ center: map.getCenter(), zoom: map.getZoom() }));
   } catch (err) {
      // storage is blocked: carry on without it
   }
});

// Optional 4 (continued): quantile breaks computed from the data, and the legend rewritten to match
function quantileBreaksOf(values, classes) {
   const sorted = values.slice().sort((a, b) => a - b);
   const result = [];
   for (let i = 1; i < classes; i++) {
      const position = (sorted.length - 1) * i / classes;
      const low = Math.floor(position);
      const high = Math.min(low + 1, sorted.length - 1);
      result.push(Math.round(sorted[low] + (sorted[high] - sorted[low]) * (position - low)));
   }
   return result;
}

document.getElementById('classes')
   .addEventListener('change', function (event) {
      breaks = event.target.value === 'quantile' ? quantileBreaksList : FIXED_BREAKS;
      if (districts) {
         districts.setStyle(styleFor);
      }
      fillLegend(legend.getContainer());
   });

// The manual keeps the layer control always open. This adds a button that collapses it, and starts it
// collapsed on small screens, where an open control would cover the map.
const layersBox = layerControl.getContainer();
const layersToggle = L.DomUtil.create('button', 'layers-toggle');
layersToggle.type = 'button';
layersBox.insertBefore(layersToggle, layersBox.firstChild);

function setLayersOpen(open) {
   layersBox.classList.toggle('layers-collapsed', !open);
   layersToggle.textContent = 'Layers ' + (open ? '\u25BE' : '\u25B8');
   layersToggle.setAttribute('aria-expanded', String(open));
}

L.DomEvent.on(layersToggle, 'click', function (e) {
   L.DomEvent.stop(e);
   setLayersOpen(layersBox.classList.contains('layers-collapsed'));
});

setLayersOpen(window.innerWidth >= 700 && window.innerHeight >= 650);
