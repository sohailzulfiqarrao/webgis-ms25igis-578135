from django.shortcuts import render
from rest_framework import viewsets

from .models import District
from .serializers import DistrictSerializer


def map_page(request):
    return render(request, "districts/map.html")


class DistrictViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = District.objects.all()
    serializer_class = DistrictSerializer
