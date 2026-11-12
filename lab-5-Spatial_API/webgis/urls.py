from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from districts.views import DistrictViewSet, map_page

# The router writes the list and detail URLs for each viewset
router = DefaultRouter()
router.register("districts", DistrictViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("", map_page, name="map"),
]
