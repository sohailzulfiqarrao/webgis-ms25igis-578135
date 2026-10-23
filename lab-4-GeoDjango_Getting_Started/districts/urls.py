from django.urls import path

from . import views

urlpatterns = [
    path("", views.map_page, name="map"),
    path("api/districts/", views.districts_geojson, name="districts-geojson"),
]
