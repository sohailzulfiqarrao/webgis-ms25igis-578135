# Lab 05 – A Spatial API

Facility Finder: the districts and facilities of Pakistan behind a GeoJSON API built with Django REST Framework. The map asks only
for what is in view, filters by kind and by distance, and collects new facilities that PostGIS checks before they are stored.
The write-up is in [report.md](report.md).

This project needs a database, so it cannot run on GitHub Pages. [`web/`](web/) is a read-only snapshot of the page and its data,
exported with `python manage.py export_static`.

## What you need

| Item | Version used |
|---|---|
| Python | 3.14 (3.12 to 3.14 work with Django 6.1) |
| Django, Django REST Framework, djangorestframework-gis, django-filter | see `requirements.txt` |
| PostgreSQL with PostGIS | 18.3 with PostGIS 3.6.2 |
| GDAL, GEOS, PROJ (OSGeo4W) | GDAL 3.13.3 in `D:\OSGeo4W` (the settings default is `C:\OSGeo4W`) |

## Set up and run

This lab uses the `webgis` database of Lab 4, with the 160 districts already loaded (the steps to create and fill it are in the
[Lab 4 README](../lab-4-GeoDjango_Getting_Started/README.md)).

1. Put the database password in an environment variable, so it is never written in a file, and reopen the terminal:
   `setx WEBGIS_DB_PASSWORD "the postgres password"`
2. If OSGeo4W is not in `C:\OSGeo4W`, say where it is: `setx OSGEO4W_ROOT "D:\OSGeo4W"`
3. In this folder:

```
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

| Address | What it is |
|---|---|
| `http://127.0.0.1:8000/` | the Facility Finder map |
| `http://127.0.0.1:8000/api/` | the API root |
| `http://127.0.0.1:8000/api/districts/` | the districts; `?in_bbox=W,S,E,N` for a rectangle, `?province=Sindh` for one province; each has `facilities_count` |
| `http://127.0.0.1:8000/api/districts/60/` | one district |
| `http://127.0.0.1:8000/api/facilities/` | the facilities; `?in_bbox=…`, `?kind=health`, `?dist=25000&point=LNG,LAT` (nearest first, `&order=desc` reverses) |
| `POST /api/facilities/` | adds one facility as a GeoJSON Feature; PostGIS refuses a point outside every district |
| `http://127.0.0.1:8000/admin/` | the admin panel (where facilities are changed or deleted: the API only reads and adds) |

## Files

| File | Role |
|---|---|
| `webgis/settings.py` | database, installed apps, OSGeo4W paths, referrer policy |
| `webgis/urls.py` | the router: `/api/districts/` and `/api/facilities/`, the admin, the map page |
| `districts/models.py`, `load.py`, `admin.py` | the `District` model and how it is loaded and edited (from Lab 4) |
| `districts/serializers.py`, `views.py` | the district API: bounding box, province, `facilities_count` |
| `facilities/models.py`, `admin.py` | the `Facility` model (name, kind, added, point) and its admin |
| `facilities/serializers.py`, `views.py` | the facility API: validation in PostGIS, the district of each point, filters, ordering |
| `districts/templates/`, `static/` | the Facility Finder page, its stylesheet and logo |
| `districts/management/commands/export_static.py` | writes the `web/` snapshot |
