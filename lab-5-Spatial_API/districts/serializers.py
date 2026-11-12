from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import District


class DistrictSerializer(GeoFeatureModelSerializer):
    # Added to the queryset by DistrictViewSet: how many facilities lie inside the district
    facilities_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = District
        geo_field = "geom"
        fields = ["id", "name", "province", "pcode", "pop_2023", "area_km2",
                  "facilities_count"]
