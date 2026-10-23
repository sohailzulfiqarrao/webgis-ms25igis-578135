import datetime
import json
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.serializers import serialize
from django.template.loader import render_to_string

from districts.models import District


def rounded(coordinates, places=5):
    """Round every number in a GeoJSON coordinate array (nested lists) to `places` decimals."""
    if isinstance(coordinates, (int, float)):
        return round(coordinates, places)
    return [rounded(c, places) for c in coordinates]


class Command(BaseCommand):
    help = "Write a static copy of the map page and its data to web/, for GitHub Pages."

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

        # the GeoJSON that /api/districts/ returns, coordinates rounded to 5 decimals (about 1 m)
        data = json.loads(serialize(
            "geojson",
            District.objects.all(),
            geometry_field="geom",
            fields=["name", "province", "pop_2023", "area_km2"],
        ))
        for feature in data["features"]:
            feature["geometry"]["coordinates"] = rounded(feature["geometry"]["coordinates"])
        with open(out / "districts.json", "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, separators=(",", ":"))

        static = Path(__file__).resolve().parents[2] / "static" / "districts"
        for name in ("style.css", "nust.jpg"):
            shutil.copy(static / name, out / name)

        self.stdout.write(f"wrote {out}: index.html, districts.json "
                          f"({District.objects.count()} districts), style.css, nust.jpg")
