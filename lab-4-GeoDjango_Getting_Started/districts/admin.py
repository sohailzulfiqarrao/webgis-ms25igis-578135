from django.contrib.gis import admin

from .models import District, Facility


@admin.register(District)
class DistrictAdmin(admin.GISModelAdmin):
    list_display = ["name", "province", "pop_2023", "area_km2"]
    list_filter = ["province"]
    search_fields = ["name", "pcode"]
    ordering = ["province", "name"]


@admin.register(Facility)
class FacilityAdmin(admin.GISModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]
    # open the map on Pakistan instead of the widget's default view of France
    gis_widget_kwargs = {
        "attrs": {"default_lon": 69.3451, "default_lat": 30.3753, "default_zoom": 5},
    }
