from django.db.models import Count, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
from django.shortcuts import render
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework_gis.filters import InBBoxFilter

from facilities.models import Facility

from .models import District
from .serializers import DistrictSerializer


def map_page(request):
    return render(request, "districts/map.html")


# A facility belongs to a district by position, not by a foreign key, so the count is a
# spatial subquery: for each district, count the facilities whose point lies within it.
facilities_inside = (
    Facility.objects.filter(geom__within=OuterRef("geom"))
    .order_by()
    .annotate(one=Value(1))
    .values("one")
    .annotate(n=Count("pk"))
    .values("n")
)


class DistrictViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = District.objects.annotate(
        facilities_count=Coalesce(Subquery(facilities_inside, output_field=IntegerField()), 0)
    )
    serializer_class = DistrictSerializer

    # ?in_bbox=west,south,east,north  and  ?province=Sindh
    filter_backends = [InBBoxFilter, DjangoFilterBackend]
    bbox_filter_field = "geom"
    bbox_filter_include_overlapping = True
    filterset_fields = ["province"]
