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

// Manual classification: five classes, four break values.
function colourFor(population) {
   if (population === null || population === undefined) return '#c9cfd1';
   if (population > 3000000) return '#7f2704';
   if (population > 1500000) return '#d94801';
   if (population > 750000) return '#f16913';
   if (population > 300000) return '#fd8d3c';
   return '#fdd0a2';
}

function styleFor(feature) {
   return {
      color: '#ffffff',
      weight: 1,
      fillColor: colourFor(feature.properties.pop_2023),
      fillOpacity: 0.8
   };
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
function fillProvinceList() {
   const select = document.getElementById('province');
   const provinces = [...new Set(
      districts.features.map(f => f.properties.province)
   )].sort();
   for (const name of provinces) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
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

const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
   const div = L.DomUtil.create('div', 'legend');
   const breaks = [0, 300000, 750000, 1500000, 3000000];
   const labels = ['under 300k', '300k to 750k', '750k to 1.5m',
                   '1.5m to 3m', 'over 3m'];

   for (let i = 0; i < breaks.length; i++) {
      div.innerHTML +=
         '<i style="background:' + colourFor(breaks[i] + 1) + '"></i> ' +
         labels[i] + '<br>';
   }
   div.innerHTML +=
      '<i style="background:' + colourFor(null) + '"></i> no census data';
   return div;
};

legend.addTo(map);
