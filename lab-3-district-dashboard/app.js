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

function colourFor(density) {
   if (density === null) return '#c9cfd1';
   if (density > 1000) return '#08306b';
   if (density > 400) return '#2171b5';
   if (density > 150) return '#4292c6';
   if (density > 50) return '#9ecae1';
   return '#deebf7';
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
