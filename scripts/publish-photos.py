"""Upload the included listings' photos to S3 for live listings.

Each photo is re-encoded without metadata (phone photos carry GPS
coordinates), rotated upright and shrunk to at most 1600 px on the long side,
then uploaded to s3://<bucket>/<SKU>/<name>. The listing's photoUrls are set
to the public URLs. Originals in photos/ are not changed.

Usage: python scripts/publish-photos.py [--dry-run] [SKU ...]
With SKUs (for example HW-09), only those listings are uploaded, included or
not. Without them, every included listing is uploaded.
Needs Pillow and the AWS CLI with credentials for the bucket. The bucket is
set in listings.json under settings.photoBucket (and settings.photoRegion if it
isn't us-east-1); it must allow public s3:GetObject so eBay can read the photos.
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageOps

MAX_SIDE = 1600
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "listings.json")


def clean_copy(src, dest):
    with Image.open(src) as im:
        fmt = im.format
        im = ImageOps.exif_transpose(im)
        im.thumbnail((MAX_SIDE, MAX_SIDE))
        if fmt == "PNG":
            im.save(dest, "PNG", optimize=True)
        else:
            im.convert("RGB").save(dest, "JPEG", quality=90, optimize=True)


def main():
    dry = "--dry-run" in sys.argv
    skus = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    with open(DATA, encoding="utf-8") as f:
        raw = f.read()
    data = json.loads(raw)
    settings = data.get("settings", {})
    bucket = str(settings.get("photoBucket", "")).strip()
    if not bucket:
        sys.exit('Set "photoBucket" under "settings" in data/listings.json to your S3 bucket name.')
    region = str(settings.get("photoRegion", "")).strip() or "us-east-1"
    host = "s3.amazonaws.com" if region == "us-east-1" else "s3.%s.amazonaws.com" % region
    base_url = "https://%s.%s/" % (bucket, host)
    unknown = set(skus) - {item["sku"] for item in data["listings"]}
    if unknown:
        sys.exit("No listing with SKU " + ", ".join(sorted(unknown)))
    stage = tempfile.mkdtemp(prefix="ebay-photos-")
    for item in data["listings"]:
        if skus:
            if item["sku"] not in skus:
                continue
        elif not item.get("include"):
            continue
        urls = []
        for name in item["photos"]:
            src = os.path.join(ROOT, "photos", item["sku"], name)
            os.makedirs(os.path.join(stage, item["sku"]), exist_ok=True)
            dest = os.path.join(stage, item["sku"], name)
            clean_copy(src, dest)
            key = "%s/%s" % (item["sku"], name)
            ctype = "image/png" if name.lower().endswith(".png") else "image/jpeg"
            print(("would upload " if dry else "upload ") + key)
            if not dry:
                subprocess.run(["aws", "s3", "cp", dest, "s3://%s/%s" % (bucket, key),
                                "--content-type", ctype, "--only-show-errors"], check=True)
            urls.append(base_url + key)
        item["photoUrls"] = urls
    if not dry:
        with open(DATA, "w", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(data, indent=2, ensure_ascii=False) + ("\n" if raw.endswith("\n") else ""))
    print("staged copies in", stage)


if __name__ == "__main__":
    main()
