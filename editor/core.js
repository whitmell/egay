/*
 * Listing logic shared by the editor page (editor/index.html) and the
 * command-line scripts (scripts/*.js). Plain ES5 with no dependencies so the
 * page still works when opened straight from disk (file://).
 */
(function (root) {
  var ACTION_HEADER = "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)";
  var CONDITIONS = {
    "New": { draft: "NEW", live: "1000" },
    "Used": { draft: "USED", live: "3000" },
    "For parts or not working": { draft: "7000", live: "7000" }
  };

  // Codes for the full listing template (templates/eBay-category-listing-template-*.csv).
  var LIVE_ACTIONS = ["VerifyAdd", "Add"];
  var RETURN_OPTIONS = ["ReturnsAccepted", "ReturnsNotAccepted"];
  var RETURN_WINDOWS = ["Days_30", "Days_60"];
  var RETURN_PAYERS = ["Buyer", "Seller"];

  function defaultSettings() {
    return {
      exportType: "draft", liveAction: "VerifyAdd", scheduleTime: "", location: "", dispatchDays: 1,
      shippingService: "USPSParcel", returnsAccepted: "ReturnsAccepted", returnsWithin: "Days_30", returnShippingPaidBy: "Buyer",
      photoBucket: "", photoRegion: ""
    };
  }

  function blankListing(index) {
    var num = String(index + 1);
    return {
      include: true, sku: "HW-" + (num.length < 2 ? "0" + num : num), title: "", categoryId: "", categoryName: "",
      condition: "Used", price: 0, quantity: 1, bestOffer: true, shippingCost: null, listed: "", itemId: "", description: "",
      specifics: { "Brand": "", "MPN": "" }, photos: [], photoUrls: [], notes: ""
    };
  }

  function normalizeData(raw) {
    var source = Array.isArray(raw) ? { listings: raw } : (raw || {});
    var settings = Object.assign(defaultSettings(), source.settings || {});
    var listings = (source.listings || []).map(function (item, index) {
      var merged = Object.assign(blankListing(index), item || {});
      if (!merged.specifics || typeof merged.specifics !== "object" || Array.isArray(merged.specifics)) merged.specifics = {};
      if (!Array.isArray(merged.photos)) merged.photos = [];
      if (!Array.isArray(merged.photoUrls)) merged.photoUrls = [];
      merged.price = Number(merged.price) || 0;
      merged.quantity = Number(merged.quantity) || 0;
      var ship = merged.shippingCost;
      merged.shippingCost = ship === null || ship === undefined || ship === "" || isNaN(Number(ship)) ? null : Number(ship);
      merged.listed = merged.listed ? String(merged.listed).trim() : "";
      merged.itemId = merged.itemId ? String(merged.itemId).trim() : "";
      if (!CONDITIONS[merged.condition]) merged.condition = "Used";
      return merged;
    });
    return { settings: settings, listings: listings };
  }

  // Items already listed on eBay are never exported again, so they can't be listed twice.
  function isExported(item) {
    return !!item.include && !item.listed;
  }

  function validateListing(item, settings, exportType) {
    var problems = [];
    var title = String(item.title || "").trim();
    if (!title) problems.push("Add a title");
    if (title.length > 80) problems.push("Shorten the title to 80 characters (now " + title.length + ")");
    if (!/^\d+$/.test(String(item.categoryId || "").trim())) problems.push("Enter a numeric category ID");
    if (!(item.price > 0)) problems.push("Set a price above 0");
    if (!(item.quantity >= 1)) problems.push("Set quantity to 1 or more");
    if (exportType === "live") {
      if (!String(item.description || "").trim()) problems.push("Add a description");
      if (!item.photoUrls.some(function (url) { return /^https?:\/\//i.test(String(url).trim()); })) problems.push("Add a public photo URL (https://...)");
      if (!(item.shippingCost >= 0)) problems.push("Set a shipping cost (0 for free shipping)");
      if (!String(settings.location || "").trim()) problems.push("Fill in the item location under Live listing settings");
      if (!String(settings.shippingService || "").trim()) problems.push("Fill in the shipping service under Live listing settings");
      if (LIVE_ACTIONS.indexOf(settings.liveAction) === -1) problems.push("Choose Verify only or List under Live listing settings");
      if (RETURN_OPTIONS.indexOf(settings.returnsAccepted) === -1) problems.push("Choose whether returns are accepted under Live listing settings");
      if (settings.returnsAccepted === "ReturnsAccepted" && (RETURN_WINDOWS.indexOf(settings.returnsWithin) === -1 || RETURN_PAYERS.indexOf(settings.returnShippingPaidBy) === -1)) {
        problems.push("Choose the return window and who pays return shipping under Live listing settings");
      }
      if (String(settings.scheduleTime || "").trim() && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(settings.scheduleTime).trim())) {
        problems.push("Write the schedule time as YYYY-MM-DD HH:MM:SS, or leave it empty");
      }
    }
    return problems;
  }

  function specificNames(listings) {
    var names = [];
    listings.forEach(function (item) {
      Object.keys(item.specifics).forEach(function (name) {
        var clean = name.trim();
        if (clean && String(item.specifics[name]).trim() && names.indexOf(clean) === -1) names.push(clean);
      });
    });
    return names;
  }

  function csvEscape(value) {
    var text = value === null || value === undefined ? "" : String(value);
    text = text.replace(/\r?\n/g, "<br>");
    return /[",]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function buildCsv(data, exportType) {
    var chosen = data.listings.filter(isExported);
    var names = specificNames(chosen);
    var isLive = exportType === "live";
    var settings = data.settings;
    var returns = settings.returnsAccepted === "ReturnsAccepted";
    var header = isLive
      ? ["*" + ACTION_HEADER, "CustomLabel", "*Category", "*Title", "ScheduleTime", "*ConditionID", "PicURL", "*Description", "*Format", "*Duration", "*StartPrice", "BestOfferEnabled", "*Quantity", "*Location",
         "ShippingType", "ShippingService-1:Option", "ShippingService-1:Cost", "*DispatchTimeMax", "*ReturnsAcceptedOption", "ReturnsWithinOption", "RefundOption", "ShippingCostPaidByOption"]
      : [ACTION_HEADER, "Custom label (SKU)", "Category ID", "Title", "UPC", "Price", "Quantity", "Item photo URL", "Condition ID", "Description", "Format"];
    header = header.concat(names.map(function (name) { return "C:" + name; }));
    var info = isLive
      ? ["Info", "Version=1.0.0", "Template=fx_category_template_EBAY_US"]
      : ["#INFO", "Version=0.0.2", "Template= eBay-draft-listings-template_US"];
    while (info.length < header.length) info.push("");
    var rows = chosen.map(function (item) {
      var urls = item.photoUrls.map(function (url) { return String(url).trim(); }).filter(Boolean).join("|");
      var condition = CONDITIONS[item.condition] || CONDITIONS["Used"];
      var price = Number(item.price).toFixed(2);
      var base = isLive
        ? [settings.liveAction, item.sku, item.categoryId, item.title.trim(), String(settings.scheduleTime || "").trim(), condition.live, urls, item.description, "FixedPrice", "GTC", price, item.bestOffer ? 1 : 0, item.quantity, String(settings.location).trim(),
           "Flat", settings.shippingService, Number(item.shippingCost || 0).toFixed(2), settings.dispatchDays, settings.returnsAccepted,
           returns ? settings.returnsWithin : "", returns ? "MoneyBack" : "", returns ? settings.returnShippingPaidBy : ""]
        : ["Draft", item.sku, item.categoryId, item.title.trim(), "", price, item.quantity, urls, condition.draft, item.description, "FixedPrice"];
      return base.concat(names.map(function (name) {
        var value = item.specifics[name];
        return value === undefined ? "" : String(value).trim();
      }));
    });
    return [info, header].concat(rows).map(function (row) { return row.map(csvEscape).join(","); }).join("\r\n") + "\r\n";
  }

  var api = {
    ACTION_HEADER: ACTION_HEADER,
    CONDITIONS: CONDITIONS,
    LIVE_ACTIONS: LIVE_ACTIONS,
    RETURN_OPTIONS: RETURN_OPTIONS,
    RETURN_WINDOWS: RETURN_WINDOWS,
    RETURN_PAYERS: RETURN_PAYERS,
    defaultSettings: defaultSettings,
    blankListing: blankListing,
    normalizeData: normalizeData,
    isExported: isExported,
    validateListing: validateListing,
    specificNames: specificNames,
    csvEscape: csvEscape,
    buildCsv: buildCsv
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else for (var key in api) root[key] = api[key];
})(this);
