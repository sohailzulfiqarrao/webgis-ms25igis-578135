from django.contrib.gis import admin

from .models import Facility


@admin.register(Facility)
class FacilityAdmin(admin.GISModelAdmin):
    list_display = ["name", "kind", "added"]
    list_filter = ["kind"]
    search_fields = ["name"]
    # open the map on Pakistan instead of the widget's default view of France
    gis_widget_kwargs = {
        "attrs": {"default_lon": 69.3451, "default_lat": 30.3753, "default_zoom": 5},
    }
