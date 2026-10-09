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
}
loadData();
