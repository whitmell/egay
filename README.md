# eBay listing editor

A small local tool for preparing eBay listings and uploading them in bulk through Seller Hub. You keep your items in one JSON file, edit them in a web page that runs straight from disk, and export a CSV that Seller Hub's bulk upload accepts. Nothing here talks to eBay directly, and there's no server or account to set up.

## What you need

- **Chrome or Edge.** The editor saves back to your data file using a browser feature that Firefox and Safari don't have. In those browsers, Save downloads a copy instead.
- **Node.js 18 or newer** (optional), for the command-line checks and export.
- **Python 3 with Pillow, plus the AWS CLI** (optional), only if you want the script to host your photos on Amazon S3 for live listings.

## Folders

| Folder | What goes there |
|---|---|
| `data/listings.json` | Your listings and export settings. It starts with one example item. |
| `photos/<SKU>/` | Each item's photos, in a folder named after its SKU, such as `photos/HW-01/`. |
| `editor/` | The editor page (`index.html`) and its logic (`core.js`). |
| `scripts/` | Command-line checks, export, and the photo uploader. |
| `exports/` | CSV files written by the export script. |
| `uploads/` | A place to keep the results files Seller Hub gives you after each upload. |

## Using the editor

1. Open `editor/index.html` in Chrome or Edge. Double-clicking it works.
2. Click **Open data file** and pick `data/listings.json`. The browser asks once for permission to edit the file.
3. Click **Edit** on an item to change it. Each row shows what still needs fixing before export.
4. Tick the items to export, then click **Save data file**.
5. Choose the export type and click **Export CSV**.

The file dialogs remember the last folder you used, so after the first time they open in `data/` and in your photos folder.

## Two ways to upload

**Drafts** are the simplest. Choose "Drafts" and export, then upload the CSV in Seller Hub under Reports > Uploads, using the "Create new drafts" option. Each item appears as a draft, and you add photos, shipping and returns in Seller Hub before publishing. Drafts can't carry Best Offer, shipping, returns or location.

**Live listings** create finished listings in one upload. Choose "Live listings" and fill in **Live listing settings**: your ZIP code, handling time, returns, and the upload action. Each item also needs a shipping cost and at least one public photo URL.

- Leave **Upload action** on "Verify only" for your first upload. eBay checks every row and reports problems without listing anything, and its results file also shows the fee for each item. Once a verify upload comes back clean, switch to "List" and upload again.
- Shipping is a flat amount the buyer pays, set per item (0 means free shipping). The service code `USPSParcel` is USPS Ground Advantage; eBay's upload rejects `USPSGroundAdvantage`.

**Before uploading, check that the category IDs are right for your items.** The editor suggests a few common computer-part categories. You can find others in the URL of any eBay category page.

## After an upload

Open each item and fill in **Listed on eBay** (or click **Mark listed today**, or use **Mark selected as listed** in the summary bar). Listed items are never exported again, so nothing gets listed twice. The **eBay item number** field is optional; the Seller Hub results file has each item's number in its ItemID column.

## Command line

Run these from this folder:

```
npm run validate        # check the items to export against the draft rules
npm run validate:live   # same, against the live listing rules
npm run export          # write exports/ebay-drafts.csv
npm run export:live     # write exports/ebay-listings.csv
```

## Hosting photos on S3 (optional)

Live listings need photo URLs that eBay can download. `scripts/publish-photos.py` uploads each item's photos to an S3 bucket and fills in the item's photo URLs. Before uploading, it strips all metadata from each copy, turns it upright and shrinks it to 1600 px; your originals aren't changed.

The metadata part matters. **Phone photos usually contain the GPS location where they were taken**, and uploading them unchanged would make that location public.

To set it up:

1. Create an S3 bucket. Turn off "Block public access" for it, and add a bucket policy that allows public `s3:GetObject` only. That makes the photos readable but the bucket's contents unlistable. Anything you put in the bucket is public.
2. In `data/listings.json`, set `"photoBucket"` under `"settings"` to the bucket's name. Also set `"photoRegion"` if the bucket isn't in us-east-1.
3. Install the requirements (`pip install Pillow`, plus the AWS CLI signed in with `aws configure`), then run:

```
python scripts/publish-photos.py --dry-run   # preview
python scripts/publish-photos.py             # upload photos of the ticked items
python scripts/publish-photos.py HW-03       # upload only the named items, ticked or not
```

Rerun it whenever you add or replace photos. Reload the editor afterward to see the new photo URLs.

Screenshots and labels can show serial numbers. Leave those out of the photos if you don't want them public.

## Listing fields

| Field | Meaning |
|---|---|
| `include` | Exported only when true. |
| `sku` | Your own ID for the item (HW-01, HW-02, ...). It's the Custom label in Seller Hub and names the item's photos folder. |
| `title` | Up to 80 characters. |
| `categoryId`, `categoryName` | The eBay category number; the name is just for you. |
| `condition` | `New`, `Used` or `For parts or not working`. |
| `price`, `quantity`, `bestOffer` | Price in USD for the whole listing. |
| `shippingCost` | Flat shipping charge for live listings; 0 is free shipping. |
| `listed`, `itemId` | Date the item went live and its eBay item number. |
| `description` | Line breaks are kept. |
| `specifics` | eBay item specifics, such as Brand and MPN. |
| `photos`, `photoUrls` | Photo file names in `photos/<SKU>/`, and their public URLs for live listings. |
| `notes` | Anything for yourself. Never exported. |
