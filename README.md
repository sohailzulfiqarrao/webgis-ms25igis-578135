# Web GIS Labs, Fall 2026

Laboratory work for the Web GIS course, MS Remote Sensing and GIS, Institute of Geographical Information Systems
(IGIS), NUST. One repository for the whole semester, one folder per lab, published as a single GitHub Pages site.

**Site:** https://sohailzulfiqarrao.github.io/webgis-ms25igis-578135/

**Course page:** https://shahidnawazkhan.github.io/Fall2026WebGIS/

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
lab-1-First-Web-Map/        Lab 01: Leaflet map of Islamabad
lab-2-district-explorer/    Lab 02: districts of Pakistan from a shapefile
lab-3-district-dashboard/   Lab 03: layers, controls and interaction
    each of the last two: index.html  style.css  app.js  data/  images/  report.md
lab-4-GeoDjango_Getting_Started/   Lab 04: Django, PostGIS, admin panel and Leaflet
    manage.py  webgis/  districts/  data/  images/  web/ (static snapshot)  report.md
```

Each new lab gets its own folder and a new card on the landing page.

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
