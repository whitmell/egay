#!/usr/bin/env node
// Writes a Seller Hub upload CSV for the included listings, same output as the editor's Export CSV.
// Usage: node scripts/export-csv.js [draft|live] [output.csv] [path/to/listings.json]

const fs = require("fs");
const path = require("path");
const core = require("../editor/core.js");

const exportType = process.argv[2] || "draft";
if (exportType !== "draft" && exportType !== "live") {
  console.error('Export type must be "draft" or "live".');
  process.exit(2);
}
const root = path.join(__dirname, "..");
const outPath = process.argv[3] || path.join(root, "exports", exportType === "live" ? "ebay-listings.csv" : "ebay-drafts.csv");
const dataPath = process.argv[4] || path.join(root, "data", "listings.json");

const data = core.normalizeData(JSON.parse(fs.readFileSync(dataPath, "utf8")));
const included = data.listings.filter(core.isExported);
const withProblems = included.filter((item) => core.validateListing(item, data.settings, exportType).length);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, core.buildCsv(data, exportType), "utf8");
console.log(`Wrote ${included.length} listing(s) to ${outPath}`);
if (withProblems.length) {
  console.log(`${withProblems.length} of them still need fixes; run: node scripts/validate.js ${exportType}`);
}
