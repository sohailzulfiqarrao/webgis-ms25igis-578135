# Lab 04 – GeoDjango with PostGIS

The 160 districts from Labs 2 and 3, now stored in a PostGIS database, served by Django as GeoJSON, edited in
Django's admin panel and drawn by Leaflet. The write-up is in [report.md](report.md).

This project needs a database, so it cannot run on GitHub Pages. [`web/`](web/) is a static snapshot of the map page,
exported from the database with `python manage.py export_static`.

## What you need

| Item | Version used |
|---|---|
| Python | 3.13 (3.12 to 3.14 work with Django 6.1) |
| Django, psycopg | see `requirements.txt` |
| PostgreSQL with PostGIS | 18.3 with PostGIS 3.6.2 |
| GDAL, GEOS, PROJ (OSGeo4W) | GDAL 3.13.3 in `D:\OSGeo4W` (the settings default is `C:\OSGeo4W`) |

## Set up and run

1. Create the database in pgAdmin or `psql`: `CREATE DATABASE webgis;` then, inside it, `CREATE EXTENSION postgis;`
2. Put the database password in an environment variable, so it is never written in a file, and reopen the terminal:
   `setx WEBGIS_DB_PASSWORD "the postgres password"`
3. If OSGeo4W is not in `C:\OSGeo4W`, say where it is: `setx OSGEO4W_ROOT "D:\OSGeo4W"`
4. In this folder:

```
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py shell -c "from districts import load; load.run()"
python manage.py createsuperuser
python manage.py runserver
```

| Address | What it is |
|---|---|
| `http://127.0.0.1:8000/` | the Leaflet map |
| `http://127.0.0.1:8000/api/districts/` | all districts as GeoJSON (`?province=Sindh` for one province) |
| `http://127.0.0.1:8000/api/where/?lat=33.6423&lng=72.9906` | which district contains a point |
| `http://127.0.0.1:8000/admin/` | the admin panel |

## Files

| File | Role |
|---|---|
| `webgis/settings.py` | database, installed apps, OSGeo4W paths, referrer policy |
| `districts/models.py` | `District` (MultiPolygon) and `Facility` (Point) |
| `districts/load.py` | fills the table from `data/districts.geojson` |
| `districts/admin.py` | how the admin shows both models |
| `districts/views.py`, `urls.py` | the map page and the two API views |
| `districts/templates/`, `static/` | the map page, its stylesheet and logo |
| `districts/management/commands/export_static.py` | writes the `web/` snapshot |
