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

function draw(features) {
   if (layer) {
      map.removeLayer(layer);
   }

   layer = L.geoJSON(
      { type: 'FeatureCollection', features: features },
      {
         style: {
            color: '#ffffff',
            weight: 1,
            fillColor: '#8c9ea3',
            fillOpacity: 0.75
         }
      }
   ).addTo(map);

   if (features.length > 0) {
      map.fitBounds(layer.getBounds());
   }

   document.getElementById('count').textContent =
      features.length + ' districts';
}
