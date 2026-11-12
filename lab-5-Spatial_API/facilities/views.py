from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework_gis.filters import DistanceToPointFilter, InBBoxFilter

from .models import Facility
from .serializers import FacilitySerializer


class FacilityViewSet(viewsets.ModelViewSet):
    queryset = Facility.objects.all()
    serializer_class = FacilitySerializer

    # Read and add only. Without logins (Lab 6), allowing PUT, PATCH or
    # DELETE would let any visitor change or remove everyone's data.
    http_method_names = ["get", "post", "head", "options"]

    # ?in_bbox=...  ?dist=25000&point=lng,lat  and  ?kind=school
    filter_backends = [InBBoxFilter, DistanceToPointFilter, DjangoFilterBackend]
    bbox_filter_field = "geom"
    distance_filter_field = "geom"
    distance_filter_convert_meters = True
    filterset_fields = ["kind"]
