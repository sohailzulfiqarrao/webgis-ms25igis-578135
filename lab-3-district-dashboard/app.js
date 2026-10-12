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

let allDistricts = null;
let allPoints = null;
let districts = null;

function draw(province) {
   const keep = function (feature) {
      return province === 'all' || feature.properties.province === province;
   };

   districtGroup.clearLayers();

   districts = L.geoJSON(allDistricts, {
      filter: keep,
      style: styleFor,
      onEachFeature: bindDistrict
   });
   districtGroup.addLayer(districts);

   const n = districts.getLayers().length;
   if (n > 0) {
      map.fitBounds(districts.getBounds());
   }
   document.getElementById('count').textContent = n + ' districts';
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
   draw('all');
}

loadData();

const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
   const div = L.DomUtil.create('div', 'legend');
   const breaks = [0, 50, 150, 400, 1000];
   const labels = ['under 50', '50 to 150', '150 to 400',
                   '400 to 1,000', 'over 1,000'];

   div.innerHTML = '<strong>People per km<sup>2</sup></strong><br>';
   for (let i = 0; i < breaks.length; i++) {
      div.innerHTML +=
         '<i style="background:' + colourFor(breaks[i] + 1) + '"></i> ' +
         labels[i] + '<br>';
   }
   div.innerHTML +=
      '<i style="background:' + colourFor(null) + '"></i> no census data';

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
