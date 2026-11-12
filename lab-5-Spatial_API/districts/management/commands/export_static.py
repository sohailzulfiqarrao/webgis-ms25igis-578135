import datetime
import json
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from districts.views import DistrictViewSet
from districts.serializers import DistrictSerializer
from facilities.models import Facility
from facilities.serializers import FacilitySerializer


def rounded(coordinates, places=5):
    """Round every number in a GeoJSON coordinate array (nested lists) to `places` decimals."""
    if isinstance(coordinates, (int, float)):
        return round(coordinates, places)
    return [rounded(c, places) for c in coordinates]


class Command(BaseCommand):
    help = "Write a static, read-only copy of the map page and the API's data to web/, for GitHub Pages."

    def handle(self, *args, **options):
        out = Path(settings.BASE_DIR) / "web"
        out.mkdir(exist_ok=True)

        # the same template as the live page, switched to snapshot mode
        html = render_to_string("districts/map.html", {
            "snapshot": True,
            "exported": datetime.date.today().isoformat(),
        })
        # the stylesheet and the logo are copied next to index.html
        html = html.replace("/static/districts/", "")
        with open(out / "index.html", "w", encoding="utf-8", newline="\n") as f:
            f.write(html)

        # what /api/districts/ and /api/facilities/ send, from the same serializers (with facilities_count and district)
        districts = json.loads(json.dumps(DistrictSerializer(DistrictViewSet.queryset, many=True).data))
        for feature in districts["features"]:
            feature["geometry"]["coordinates"] = rounded(feature["geometry"]["coordinates"])
        with open(out / "districts.json", "w", encoding="utf-8", newline="\n") as f:
            json.dump(districts, f, separators=(",", ":"))

        facilities = json.loads(json.dumps(FacilitySerializer(Facility.objects.order_by("id"), many=True).data))
        with open(out / "facilities.json", "w", encoding="utf-8", newline="\n") as f:
            json.dump(facilities, f, separators=(",", ":"))

        static = Path(__file__).resolve().parents[2] / "static" / "districts"
        for name in ("style.css", "nust.jpg"):
            shutil.copy(static / name, out / name)

        self.stdout.write(f"wrote {out}: index.html, districts.json ({len(districts['features'])} districts), "
                          f"facilities.json ({len(facilities['features'])} facilities), style.css, nust.jpg")
