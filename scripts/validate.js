#!/usr/bin/env node
// Checks every listing in data/listings.json and reports what still needs fixing.
// Usage: node scripts/validate.js [draft|live] [path/to/listings.json]
// Exits with code 1 if any included listing has a problem.

const fs = require("fs");
const path = require("path");
const core = require("../editor/core.js");

const exportType = process.argv[2] || "draft";
if (exportType !== "draft" && exportType !== "live") {
  console.error('Export type must be "draft" or "live".');
  process.exit(2);
}
const dataPath = process.argv[3] || path.join(__dirname, "..", "data", "listings.json");
const data = core.normalizeData(JSON.parse(fs.readFileSync(dataPath, "utf8")));
const photoDir = path.join(path.dirname(dataPath), "..", "photos");

let failing = 0;
const skus = new Set();
for (const item of data.listings) {
  const problems = core.validateListing(item, data.settings, exportType);
  if (skus.has(item.sku)) problems.push(`Duplicate SKU ${item.sku}`);
  skus.add(item.sku);
  for (const photo of item.photos) {
    if (!fs.existsSync(path.join(photoDir, item.sku, photo))) problems.push(`Photo not found: photos/${item.sku}/${photo}`);
  }
  const mark = item.listed ? "LIST" : item.include ? (problems.length ? "FIX " : "OK  ") : "SKIP";
  const listedNote = item.listed ? ` (listed ${item.listed}${item.itemId ? ", item " + item.itemId : ""})` : "";
  console.log(`${mark} ${item.sku.padEnd(8)} $${String(item.price).padEnd(7)} ${item.title}${listedNote}`);
  for (const problem of problems) console.log(`       - ${problem}`);
  if (core.isExported(item) && problems.length) failing += 1;
}

const included = data.listings.filter(core.isExported);
const listed = data.listings.filter((item) => item.listed).length;
const total = included.reduce((sum, item) => sum + item.price * item.quantity, 0);
console.log(`\n${listed} already listed on eBay. ${included.length} of ${data.listings.length} to export, $${total.toFixed(2)} total, ${failing} need fixes (${exportType} rules).`);
process.exit(failing ? 1 : 0);
