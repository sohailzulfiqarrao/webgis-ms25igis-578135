// Limits: south-west corner first, then north-east, each as [latitude, longitude]
const pakistanLimits = L.latLngBounds([21.5, 58.5], [39.0, 80.5]);

const map = L.map('map', {
   maxBounds: pakistanLimits,
   maxBoundsViscosity: 1.0,
   minZoom: 5
}).setView([30.3753, 69.3451], 5);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
   maxZoom: 19,
   attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

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
         }
      }
   ).addTo(map);

   if (features.length > 0) {
      map.fitBounds(layer.getBounds());
   }

   document.getElementById('count').textContent =
      features.length + ' districts';
}
