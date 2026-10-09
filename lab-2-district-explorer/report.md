# Web GIS Lab 2 – District Explorer: Report

| | |
|---|---|
| **Name** | Sohail Zulfiqar |
| **Registration ID** | 578135 |
| **Email** | szulfiqar.ms25igis@student.nust.edu.pk |
| **Program** | MS GIS & RS – 2025 |
| **Subject** | Web GIS (Dr. Shahid Nawaz Khan) |
| **Repository** | https://github.com/sohailzulfiqarrao/webgis-ms25igis-578135 (folder `lab-2-district-explorer`) |
| **Live page** | https://sohailzulfiqarrao.github.io/webgis-ms25igis-578135/lab-2-district-explorer/ |

## 1. Checkpoint screenshots

### Checkpoint 1 – Project folder
![Checkpoint 1](images/checkpoint-1-vscode.png)

### Checkpoint 2 – Measurement table and versions A and D
The table is in [section 2](#2-file-size-table-part-3), with the A-versus-D image under it.

### Checkpoint 3 – Reading the GeoJSON as text
1. Outermost object: `FeatureCollection`.
2. Entries in `features`: 160.
3. Geometry of the first feature: `Polygon` (Bagh, Azad Kashmir).
4. Square brackets before the first number: three, `[[[73.69622,34.08025], …`.
5. Keys in `properties`: `district`, `province`, `pcode`, `pop_2023`, `area_km2`.

First coordinate pair: `[73.69622, 34.08025]`. The first number (73.7) is a longitude and the second (34.1) a latitude, so the order is longitude then latitude, which is correct for GeoJSON.

### Checkpoint 4 – Empty page on Live Server
![Checkpoint 4](images/checkpoint-4-live-server.png)

### Checkpoint 5 – Console
![Checkpoint 5](images/checkpoint-5-console.png)

### Checkpoint 6 – Network tab

#### District GeoJson Size & Time
![22 ms](images/checkpoint-6-district-geojson-size.png)
![26 ms](images/checkpoint-6-district-geojson-size-2.png)
![17 ms](images/checkpoint-6-district-geojson-size-3.png)

#### PNG Request Count
![Checkpoint 6 - PNG request Count](images/checkpoint-6-png-count.png)

#### PNG Preview Tab
![Checkpoint 6 - Preview Tab](images/checkpoint-6-preview.png)

### Checkpoint 7 – Shaded map, legend and a popup
![Checkpoint 7: shaded map with legend and a Lahore popup](images/checkpoint-7-shaded-map-popup.jpg)

### Checkpoint 8 – Province filter (extension)
All provinces, 160 districts:

![Checkpoint 8a: all provinces](images/checkpoint-8a-all-provinces.jpg)

Khyber Pakhtunkhwa selected, 35 districts:

![Checkpoint 8b: Khyber Pakhtunkhwa selected](images/checkpoint-8b-single-province.jpg)

### Checkpoint 9 – Coordinate system comparison (extension)
See [section 5](#5-coordinate-system-comparison-part-10).

---

## 2. File size table (Part 3)

The layer is `pak_admin2` (districts): 160 polygons in WGS 84 (EPSG:4326). Its fields are text except two dates and `area_sqkm`, `center_lat` and `center_lon` (numbers), and it has no population field. The supplied `districts.geojson` adds `pop_2023` as a number (135 values, 25 null).

The shapefile row adds only the adm2 components: `.shp` 4,090,564 + `.shx` 1,380 + `.dbf` 283,906 + `.prj` 145 + `.cpg` 5 bytes.

| Version | What was done | Size | % of A | Vertices |
|---|---|---|---|---|
| Shapefile | adm2 `.shp`, `.shx`, `.dbf`, `.prj`, `.cpg` added together | 4,376,000 bytes (4.38 MB) | 39.2 % | n/a |
| A | Straight conversion, default precision | 11,177,210 bytes (11.18 MB) | 100 % | 255,083 |
| B | Precision 5 | 6,170,047 bytes (6.17 MB) | 55.2 % | 255,070 |
| C | Simplified 0.001° (about 100 m), precision 5 | 1,171,352 bytes (1.17 MB) | 10.5 % | 44,773 |
| D | Simplified 0.01° (about 1 km), precision 5 | 334,891 bytes (0.33 MB) | 3.0 % | 9,596 |
| Supplied `districts.geojson` (served by the map) | 5 properties, precision 5 | 933,119 bytes (0.93 MB) | 8.3 % | 45,702 |

C and D were made with QGIS Simplify (Douglas-Peucker, tolerance 0.001° and 0.01°) and exported with precision 5. The supplied file is in effect version C with fewer properties and the population joined on. Dropping decimals alone (A to B) saves 44.8 %, and simplifying to C removes 82 % of the vertices.

### Checkpoint 2 – versions A and D drawn together

![Checkpoint 2: version A (blue) over version D (red)](images/checkpoint-2-a-vs-d.png)

*Rendered with the QGIS engine. At country scale the two are indistinguishable; at 70 km across (the Indus delta) D has straight segments where A is smooth.*

**Which is larger, the shapefile or the GeoJSON?** The GeoJSON: 11.18 MB (A) against 4.38 MB, 2.55 times larger. A shapefile stores each vertex as two 8-byte numbers (16 bytes). GeoJSON writes them as decimal text, about 43 bytes per vertex, plus brackets and property names.

---

## 3. Load times and network measurements (Part 7.2)

Page on a local server, DevTools Network tab, Disable cache ticked, no throttling:

| Item | Result |
|---|---|
| `data/districts.geojson` size | 933 kB (933,119 bytes, sent uncompressed) |
| Time to fetch it, 3 runs | 22 ms, 26 ms, 17 ms (mean 21.7 ms) |
| Requests on one load | 24, of which 12 are `.png` map tiles |
| A tile | 256 × 256 px PNG, 9 to 31 kB; its URL is `/z/x/y.png` and the first number, `5`, is the zoom level |
| DOMContentLoaded | 506 to 546 ms |

**Slow 3G.** The throttling menu is part of DevTools, so I applied the same emulation by driving Chrome through the DevTools protocol, with the values of its Slow 3G preset (50,000 bytes/s down and up, 2,000 ms latency). Cache off, one load per case, and the map tiles came from a local copy of one real tile. "Districts on the map" is the time until the district count appears.

| Case | GeoJSON on the wire | GeoJSON request | Districts on the map | Load event | Finish |
|---|---|---|---|---|---|
| Supplied file (C), no throttling | 933,303 B | 0.01 s | 0.66 s | 0.79 s | 0.80 s |
| Supplied file (C), **Slow 3G**, uncompressed (Live Server) | 933,303 B | **33.7 s** | **39.2 s** | 30.0 s | 39.2 s |
| Supplied file (C), **Slow 3G**, gzip (GitHub Pages) | 294,751 B | **16.1 s** | **21.5 s** | 28.2 s | 30.2 s |
| `districts_A.geojson`, no throttling | 11,177,396 B | 0.07 s | 0.97 s | 0.97 s | 1.00 s |
| `districts_A.geojson`, **Slow 3G**, uncompressed | 11,177,396 B | **238.6 s** | **244.3 s** | 29.7 s | 243.9 s |
| `districts_A.geojson`, **Slow 3G**, gzip | 3,655,082 B | **88.2 s** | **93.8 s** | 29.9 s | 93.6 s |

- On Slow 3G the simplified file is about 7 times faster than version A uncompressed (33.7 s against 238.6 s) and 5.5 times faster gzipped (16.1 s against 88.2 s), which is why the map uses it.
- The load event (about 30 s in every Slow 3G row) does not wait for the GeoJSON, which JavaScript fetches afterwards, so "districts on the map" is the better measure of what a user waits for.

---

## 4. Classification (Part 8)

**Breaks used:** 300,000 / 750,000 / 1,500,000 / 3,000,000, five classes plus grey for districts with no census value.

| Class | Districts |
|---|---|
| under 300k | 20 |
| 300k to 750k | 23 |
| 750k to 1.5m | 28 |
| 1.5m to 3m | 40 |
| over 3m | 24 |
| no census data (grey) | 25 |

**Why these breaks.** Populations are strongly skewed (127,571 in Harnai to 13,004,135 in Lahore), so equal intervals would put 109 of the 135 districts in one class, whereas roughly doubling breaks spread them over all five classes. The 25 grey districts are the 14 in Gilgit Baltistan, the 10 in Azad Kashmir and Lehri, which the 2023 census tables do not cover separately.

---

## 5. Coordinate system comparison (Part 10)

Planar area of each district in EPSG:3857 and in EPSG:32643 (UTM 43N), plus the geodesic area on WGS 84 as a check. Five districts from south to north, all east of 70°E.

| District | Latitude | 3857 km² | UTM 43N km² | % difference | Geodesic km² | 1 / cos²(lat) |
|---|---|---|---|---|---|---|
| Tharparkar | 24.78° | 23,985.1 | 19,785.4 | 21.2 % | 19,684.0 | 1.213 |
| Rahim Yar Khan | 28.41° | 16,672.2 | 12,900.3 | 29.2 % | 12,849.3 | 1.293 |
| Lahore | 31.47° | 2,384.7 | 1,728.4 | 38.0 % | 1,729.6 | 1.375 |
| Haripur | 34.00° | 2,849.7 | 1,953.8 | 45.9 % | 1,953.5 | 1.455 |
| Hunza | 36.58° | 17,745.0 | 11,411.2 | 55.5 % | 11,419.7 | 1.551 |

`% difference = (3857 − UTM) / UTM × 100`; latitude is the district centroid.

1. **Does the difference grow or shrink northward?** It grows, from 21.2 % at 24.8°N to 55.5 % at 36.6°N, because Web Mercator stretches by 1 / cos(latitude).
2. **Predicted versus measured.** For Lahore, 1 / cos²(31.47°) = 1.375, a predicted 37.5 % inflation, against 38.0 % measured. Every row agrees within about 0.5 points, and the lecture's "about 40 %" holds.
3. **Which figure goes in a report?** The UTM figure. Web Mercator is not equal-area and overstates these areas by 21 % to 55 %, while UTM is within 0.12 % of the geodesic area east of 72°E. UTM 43N is only good near its central meridian (worst error 3.55 %, at Gwadar), so western districts need zone 42N.

In QGIS, `$area` follows the project ellipsoid, so set it to None / Planimetric to reproduce the planar comparison.

---

## 6. Questions

**1. Version D is far smaller than version A. Give one situation in which version D would be the wrong choice.**
When zoomed in to a single district or tehsil, or when measuring an area or length: a 1 km tolerance displaces boundaries by up to about a kilometre, so borders look blocky and the measurements are wrong.

**2. The page makes one request for your GeoJSON file and dozens for tiles. Explain the difference in how those two kinds of data reach the browser.**
The GeoJSON is one vector file that `fetch` downloads whole and the browser parses and draws itself, so every feature stays clickable and queryable. Tiles are pre-rendered 256 × 256 pixel pictures on a z/x/y grid; Leaflet requests only those covering the current view, more as the user pans, and a picture carries no attributes.

**3. Why does the map container need a height when the heading does not?**
A heading's height comes from its text, but the empty `<div id="map">` has no content, and Leaflet's panes are positioned absolutely, so it stays zero pixels tall and the map is invisible with no error. The `#map` rule gives it a height (the lab uses `calc(100vh - 150px)`; my final page uses flexbox with a 320 px minimum).

**4. `draw` removes the existing layer before adding a new one. What would go wrong if it did not?**
`addTo(map)` adds a layer rather than replacing one, so each filter choice would stack another layer. The "all provinces" layer would stay underneath, the filter would appear to do nothing, and old layers would keep their handlers and memory.

**5. A classmate's districts all appear in the same colour. List two possible causes and how you would tell them apart.**
(a) The population values are not numbers (a thousands separator, a stray space, "NA"): every comparison is false and all districts get the palest class `#fdd0a2`. Check `typeof districts.features[0].properties.pop_2023` and the QGIS field type. (b) The field name does not match the code: the value is `undefined`, treated as missing, so all districts are grey `#c9cfd1`. Check `Object.keys(districts.features[0].properties)`. Pale orange versus grey tells them apart at a glance.

**6. You open the page by double-clicking `index.html` instead of using Live Server. The basemap appears but the districts do not. Explain why.**
From a `file:///` page the tile `<img>` requests are allowed, but browsers block `fetch` of a local file. The promise rejects before `draw` runs and the console shows "Failed to fetch" or a CORS error. Live Server serves over HTTP, which makes it a normal same-origin request.

---

## 7. Publishing

- Repository: https://github.com/sohailzulfiqarrao/webgis-ms25igis-578135 (this lab is in `lab-2-district-explorer/`)
- Live page: https://sohailzulfiqarrao.github.io/webgis-ms25igis-578135/lab-2-district-explorer/
- All labs: https://sohailzulfiqarrao.github.io/webgis-ms25igis-578135/

---

## Additional Task – optional exercises from the manual

### 1. Second basemap and a layer control
`L.control.layers` switches between OpenStreetMap and Satellite (Esri) from the layer button at the top right. Esri's tile URL is `{z}/{y}/{x}`. **Check:** after switching, 24 of 24 Esri tiles loaded.

![Additional task 1: Esri satellite imagery under the districts, with the layer control open](images/additional-1-basemap-satellite.png)

### 2. Highlight a district on mouseover
`mouseover` sets the outline weight to 3 and brings the district to the front; `mouseout` calls `layer.resetStyle`. **Check:** the weight went 1, 3 while hovered, then 1 again.

![Additional task 2: Punjab selected, with the pointer over Multan, whose outline is thicker and darker](images/additional-2-hover.png)

### 3. Text box that filters by name
The District box filters as you type (case-insensitive) together with the province list, through one `applyFilters()`. **Check:** "pur" gives 9 districts, "LAHORE" gives 1, "zzzz" gives 0.

![Additional task 3: "pur" typed in the District box gives 9 districts](images/additional-3-search.png)

### 4. Drop-down sorted by district count
Provinces are sorted by district count, with the count in each label: Punjab (36), Balochistan (35), Khyber Pakhtunkhwa (35), Sindh (29), Gilgit Baltistan (14), Azad Kashmir (10), Islamabad (1).

![Additional task 4: the province list with the drop-down expanded to show the order and the counts](images/additional-4-sorted-dropdown.png)

### 5. Quantile breaks instead of manual ones
`quantileBreaks()` cuts the 135 population values into five equal-count classes (rounded to the nearest 1,000). The Classes drop-down switches between the two without moving the map, and the legend rewrites itself. The manual breaks stay the default.

![Additional task 5: quantile classes selected, with the legend rewritten](images/additional-5-quantiles.png)

| Class | Manual breaks | Districts | Quantile breaks | Districts |
|---|---|---|---|---|
| 1 | under 300k | 20 | under 361k | 27 |
| 2 | 300k to 750k | 23 | 361k to 1.03m | 27 |
| 3 | 750k to 1.5m | 28 | 1.03m to 1.75m | 27 |
| 4 | 1.5m to 3m | 40 | 1.75m to 2.62m | 27 |
| 5 | over 3m | 24 | over 2.62m | 27 |
| no census data | grey | 25 | grey | 25 |
