// Limits: south-west corner first, then north-east, each as [latitude, longitude]
const pakistanLimits = L.latLngBounds([21.5, 58.5], [39.0, 80.5]);

const map = L.map('map', {
   maxBounds: pakistanLimits,
   maxBoundsViscosity: 1.0,
   minZoom: 5
}).setView([30.3753, 69.3451], 5);

// Optional 1: two basemaps and a layer control to switch between them.
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
   maxZoom: 19,
   attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Note the order in this URL: Esri wants {z}/{y}/{x}, not {z}/{x}/{y}.
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
   maxZoom: 19,
   attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
});

L.control.layers(
   { 'OpenStreetMap': osm, 'Satellite (Esri)': satellite },
   null,
   { position: 'topright' }
).addTo(map);

let districts = null;
let layer = null;

// Classification: five colours, four break values. The breaks are either the
// manual ones or quantiles (optional 5), chosen with the "Classes" drop-down.
const COLOURS = ['#fdd0a2', '#fd8d3c', '#f16913', '#d94801', '#7f2704'];
const NO_DATA_COLOUR = '#c9cfd1';
const MANUAL_BREAKS = [300000, 750000, 1500000, 3000000];
let quantileBreaksList = [];
let breaks = MANUAL_BREAKS;

async function loadData() {
   const response = await fetch('data/districts.geojson');

   if (!response.ok) {
      console.error('Request failed with status', response.status);
      return;
   }

   districts = await response.json();
   console.log('Features Count:', districts.features.length);
   console.log('First Feature:', districts.features[0]);
   console.log('distinct Provinces:', [...new Set(districts.features.map(f => f.properties.province))].sort());

   quantileBreaksList = quantileBreaks(
      districts.features.map(f => f.properties.pop_2023)
         .filter(v => typeof v === 'number'),
      COLOURS.length
   );
   console.log('quantile breaks:', quantileBreaksList);

   fillProvinceList();
   draw(districts.features);
}
loadData();

// Readable text for any attribute value; missing values become a placeholder.
function show(value) {
   if (value === null || value === undefined || value === '') {
      return 'not recorded';
   }
   return typeof value === 'number' ? value.toLocaleString() : value;
}

// The class is the number of break values the population is above.
function colourFor(population) {
   if (population === null || population === undefined) return NO_DATA_COLOUR;
   return COLOURS[breaks.filter(b => population > b).length];
}

function styleFor(feature) {
   return {
      color: '#ffffff',
      weight: 1,
      fillColor: colourFor(feature.properties.pop_2023),
      fillOpacity: 0.8
   };
}

// Optional 5: quantile breaks computed from the data (values rounded to the nearest 1,000).
function quantileBreaks(values, classes) {
   const sorted = values.slice().sort((a, b) => a - b);
   const result = [];
   for (let i = 1; i < classes; i++) {
      const position = (sorted.length - 1) * i / classes;
      const low = Math.floor(position);
      const high = Math.min(low + 1, sorted.length - 1);
      const value = sorted[low] + (sorted[high] - sorted[low]) * (position - low);
      result.push(Math.round(value / 1000) * 1000);
   }
   return result;
}

function draw(features) {
   if (layer) {
      map.removeLayer(layer);
   }

   layer = L.geoJSON(
      { type: 'FeatureCollection', features: features },
      {
         style: styleFor,
         onEachFeature: function (feature, featureLayer) {
            const p = feature.properties;
            featureLayer.bindPopup(
               '<strong>' + show(p.district) + '</strong><br>' +
               'Province: ' + show(p.province) + '<br>' +
               'Population: ' + show(p.pop_2023) + '<br>' +
               'Area: ' + show(p.area_km2) + ' km<sup>2</sup>'
            );

            // Optional 2: thicken the outline while the pointer is over a district.
            featureLayer.on({
               mouseover: function () {
                  featureLayer.setStyle({ weight: 3, color: '#23373b' });
                  featureLayer.bringToFront();
               },
               mouseout: function () {
                  layer.resetStyle(featureLayer);
               }
            });
         }
      }
   ).addTo(map);

   if (features.length > 0) {
      map.fitBounds(layer.getBounds());
   }

   document.getElementById('count').textContent =
      features.length + (features.length === 1 ? ' district' : ' districts');
}

// Fill the drop-down from the data rather than typing the names by hand.
// Optional 4: most districts first instead of alphabetical order.
function fillProvinceList() {
   const select = document.getElementById('province');
   const counts = {};
   for (const f of districts.features) {
      const name = f.properties.province;
      counts[name] = (counts[name] || 0) + 1;
   }
   const provinces = Object.keys(counts).sort(
      (a, b) => counts[b] - counts[a] || a.localeCompare(b)
   );
   for (const name of provinces) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name + ' (' + counts[name] + ')';
      select.appendChild(option);
   }
}

// Optional 3: the province drop-down and the name box filter together.
function applyFilters() {
   const chosen = document.getElementById('province').value;
   const text = document.getElementById('search').value.trim().toLowerCase();
   const subset = districts.features.filter(f =>
      (chosen === 'all' || f.properties.province === chosen) &&
      (text === '' || String(f.properties.district).toLowerCase().includes(text))
   );
   draw(subset);
}

document.getElementById('province').addEventListener('change', applyFilters);
document.getElementById('search').addEventListener('input', applyFilters);

// Switching the classification only restyles the layer: the view stays where it is.
document.getElementById('classes')
   .addEventListener('change', function (event) {
      breaks = event.target.value === 'quantile' ? quantileBreaksList : MANUAL_BREAKS;
      if (layer) {
         layer.setStyle(styleFor);
      }
      fillLegend(legend.getContainer());
   });

// 300000 -> "300k", 1500000 -> "1.5m"
function shortNumber(n) {
   return n >= 1000000 ? +(n / 1000000).toFixed(2) + 'm' : Math.round(n / 1000) + 'k';
}

function legendLabels() {
   const labels = ['under ' + shortNumber(breaks[0])];
   for (let i = 1; i < breaks.length; i++) {
      labels.push(shortNumber(breaks[i - 1]) + ' to ' + shortNumber(breaks[i]));
   }
   labels.push('over ' + shortNumber(breaks[breaks.length - 1]));
   return labels;
}

function fillLegend(div) {
   const labels = legendLabels();
   let html = '';
   for (let i = 0; i < COLOURS.length; i++) {
      html += '<i style="background:' + COLOURS[i] + '"></i> ' + labels[i] + '<br>';
   }
   html += '<i style="background:' + NO_DATA_COLOUR + '"></i> no census data';
   div.innerHTML = html;
}

const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
   const div = L.DomUtil.create('div', 'legend');
   fillLegend(div);
   return div;
};

legend.addTo(map);
