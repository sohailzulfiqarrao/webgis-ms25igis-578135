from django.contrib.gis import admin

from .models import District


@admin.register(District)
class DistrictAdmin(admin.GISModelAdmin):
    list_display = ["name", "province", "pop_2023", "area_km2"]
    list_filter = ["province"]
    search_fields = ["name", "pcode"]
    ordering = ["province", "name"]
