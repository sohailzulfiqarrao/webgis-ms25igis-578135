const map = L.map('map', {
   center: [30.3753, 69.3451],
   zoom: 5,
   minZoom: 5,
   maxZoom: 14,
   maxBounds: [[21.5, 58.5], [39.0, 80.5]],
   maxBoundsViscosity: 1.0
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
