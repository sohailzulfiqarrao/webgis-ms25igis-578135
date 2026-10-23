from django.core.serializers import serialize
from django.http import HttpResponse
from django.shortcuts import render

from .models import District


def map_page(request):
    return render(request, "districts/map.html")


def districts_geojson(request):
    districts = District.objects.all()

    # /api/districts/?province=Sindh returns one province only
    province = request.GET.get("province")
    if province:
        districts = districts.filter(province=province)

    data = serialize(
        "geojson",
        districts,
        geometry_field="geom",
        fields=["name", "province", "pop_2023", "area_km2"],
    )
    return HttpResponse(data, content_type="application/geo+json")
