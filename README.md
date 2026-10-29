# Web GIS Labs, Fall 2026

Laboratory work for the Web GIS course, MS Remote Sensing and GIS, Institute of Geographical Information Systems
(IGIS), NUST. One repository for the whole semester, one folder per lab, published as a single GitHub Pages site.

**Site:** https://sohailzulfiqarrao.github.io/webgis-ms25igis-578135/

**Course page:** https://shahidnawazkhan.github.io/Fall2026WebGIS/

**Main page:** https://sohailzulfiqarrao.github.io/ (Web GIS and machine learning together)

## Labs

| Lab | Folder | Live map | Report |
|---|---|---|---|
| 01 – First Web Map | [`lab-1-First-Web-Map/`](lab-1-First-Web-Map/) | [open](https://sohailzulfiqarrao.github.io/webgis-ms25igis-578135/lab-1-First-Web-Map/) | [report](lab-1-First-Web-Map/reports/lab01-report.md) |
| 02 – District Explorer | [`lab-2-district-explorer/`](lab-2-district-explorer/) | [open](https://sohailzulfiqarrao.github.io/webgis-ms25igis-578135/lab-2-district-explorer/) | [report](lab-2-district-explorer/report.md) |
| 03 – District Dashboard | [`lab-3-district-dashboard/`](lab-3-district-dashboard/) | [open](https://sohailzulfiqarrao.github.io/webgis-ms25igis-578135/lab-3-district-dashboard/) | [report](lab-3-district-dashboard/report.md) |
| 04 – GeoDjango with PostGIS | [`lab-4-GeoDjango_Getting_Started/`](lab-4-GeoDjango_Getting_Started/) | [snapshot](https://sohailzulfiqarrao.github.io/webgis-ms25igis-578135/lab-4-GeoDjango_Getting_Started/web/) (the app runs locally) | [report](lab-4-GeoDjango_Getting_Started/report.md) |

## Layout

```
index.html                  landing page listing every lab
assets/site.css             its stylesheet
assets/neural.css           the landing page theme only (dark, animated); no lab page loads it
assets/geo-viz.js           the shared loop and the first four live maps on the landing page (choropleth, point query,
                            tile zoom, request flow), drawn from assets/geo-districts.json
assets/geo-viz2.js          four more: layer control, population heatmap, k-means grouping of districts,
                            classification schemes (their plain algorithms are in window.GEOVIZ_PURE)
assets/geo-districts.json   the 160 district boundaries, generalised to about 1 km, with each district's point (88 KB),
                            loaded only when needed
assets/motif.svg            the still background art; motif-fx.svg holds its few moving parts, and
                            motif-static.svg is the frozen copy used when the visitor prefers reduced motion
lab-1-First-Web-Map/        Lab 01: Leaflet map of Islamabad
lab-2-district-explorer/    Lab 02: districts of Pakistan from a shapefile
lab-3-district-dashboard/   Lab 03: layers, controls and interaction
    each of the last two: index.html  style.css  app.js  data/  images/  report.md
lab-4-GeoDjango_Getting_Started/   Lab 04: Django, PostGIS, admin panel and Leaflet
    manage.py  webgis/  districts/  data/  images/  web/ (static snapshot)  report.md
```

Each new lab gets its own folder and a new card on the landing page.

The "Web GIS, in motion" section runs only while it is on screen and the tab is visible, and with
`prefers-reduced-motion` each map is drawn once, in its finished state. The choropleth uses Lab 3's five density classes
(20, 18, 34, 41 and 22 districts, and 25 with no data), the point query is a point-in-polygon test on the same
boundaries, the tile numbers are computed with the Web Mercator tile formula, and the request sizes are the ones
measured in Lab 4. The layer control replays Lab 3's overlays (density, circles with radius √population, points, the
25 km NUST circle). The heatmap is a kernel density of the 135 districts with census data, weighted by the square root
of population. The grouping runs k-means on log density and log population (no coordinates): the sparsest group is 23
districts of Balochistan and the densest is Lahore and five Karachi districts. The classification panel cuts the same
densities with four rules: Lab 3's breaks (20, 18, 34, 41, 22), quantiles, equal interval (131 districts in one class)
and natural breaks (126).

## Run it locally

Do not open a page by double-clicking it: the browser blocks data requests for pages opened from the file system.
Serve the repository folder instead, for example with the VS Code **Live Server** extension (right-click
`index.html`, *Open with Live Server*, which opens `http://127.0.0.1:5500`), or from a terminal:

```
python -m http.server 5500
```

Then open:

| Page | Local address |
|---|---|
| Landing page | `http://127.0.0.1:5500/` |
| Lab 01 – First Web Map | `http://127.0.0.1:5500/lab-1-First-Web-Map/` |
| Lab 02 – District Explorer | `http://127.0.0.1:5500/lab-2-district-explorer/` |
| Lab 03 – District Dashboard | `http://127.0.0.1:5500/lab-3-district-dashboard/` |
| Lab 04 – snapshot of the Django map | `http://127.0.0.1:5500/lab-4-GeoDjango_Getting_Started/web/` |

### Lab 04 runs a real server

The live Lab 04 app needs Python, PostgreSQL with PostGIS and the GDAL libraries, so it cannot run from Live Server
or GitHub Pages. The `web/` folder is only a snapshot of it. To run the app itself, from
`lab-4-GeoDjango_Getting_Started/`:

```
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
setx WEBGIS_DB_PASSWORD "your postgres password"      # then reopen the terminal
python manage.py migrate
python manage.py shell -c "from districts import load; load.run()"
python manage.py runserver
```

Then open `http://127.0.0.1:8000/` (map) and `http://127.0.0.1:8000/admin/` (admin). The full steps, including
creating the `webgis` database, are in [that lab's README](lab-4-GeoDjango_Getting_Started/README.md).

---
**Author:** Sohail Zulfiqar, MS GIS & Remote Sensing
