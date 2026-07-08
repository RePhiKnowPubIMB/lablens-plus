import { Router } from "express";
import Fuse from "fuse.js";
import { medicineDB } from "../data/medicines.js";

export const medicineRouter = Router();

// Fuzzy search index for medicine names
const fuse = new Fuse(medicineDB, {
  keys: ["brand_name", "generic_name"],
  threshold: 0.3,
  includeScore: true,
});

/**
 * GET /api/medicine/search?q=napa
 * Fuzzy search for medicines in the local database.
 */
medicineRouter.get("/search", (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) {
    return res.status(400).json({ success: false, error: "Query must be at least 2 characters." });
  }

  const results = fuse.search(query).slice(0, 15);

  // For each result, find other brands with the same generic name
  const enriched = results.map((r) => {
    const medicine = r.item;
    const alternatives = medicineDB
      .filter(
        (m) =>
          m.generic_name.toLowerCase() === medicine.generic_name.toLowerCase() &&
          m.brand_name.toLowerCase() !== medicine.brand_name.toLowerCase()
      )
      .slice(0, 8);

    return {
      ...medicine,
      alternatives,
      search_score: r.score,
    };
  });

  res.json({ success: true, data: enriched });
});

/**
 * GET /api/medicine/generic/:genericName
 * Find all brands for a specific generic name.
 */
medicineRouter.get("/generic/:genericName", (req, res) => {
  const genericName = req.params.genericName.toLowerCase();
  const matches = medicineDB.filter(
    (m) => m.generic_name.toLowerCase() === genericName
  );

  if (matches.length === 0) {
    return res.status(404).json({ success: false, error: "No medicines found for this generic name." });
  }

  res.json({ success: true, data: matches });
});

/**
 * GET /api/medicine/alternatives/:brandName
 * Resolve a brand to its generic and return all other brands with
 * the same generic_name as alternatives.
 *
 * Response shape:
 *   {
 *     detectedMedicine: "Napa",
 *     generic: "Paracetamol",
 *     alternatives: [{ brand, manufacturer, price, strength, form }, ...]
 *   }
 */
medicineRouter.get("/alternatives/:brandName", (req, res) => {
  const brandQuery = req.params.brandName?.trim();
  if (!brandQuery) {
    return res.status(400).json({ success: false, error: "brandName is required." });
  }

  // Use the same fuzzy index as /search so noisy OCR input ("Nappa", "Napaa")
  // still resolves to the real entry. If there's no DB hit at all, 404.
  const hits = fuse.search(brandQuery);
  const detected = hits.length > 0 ? hits[0].item : null;

  if (!detected) {
    return res.status(404).json({
      success: false,
      error: `No medicine found matching "${brandQuery}".`,
    });
  }

  // Same-generic, different-brand, sorted by price (cheapest first).
  const alternatives = medicineDB
    .filter(
      (m) =>
        m.generic_name.toLowerCase() === detected.generic_name.toLowerCase() &&
        m.brand_name.toLowerCase() !== detected.brand_name.toLowerCase()
    )
    .sort((a, b) => (a.price_bdt ?? Infinity) - (b.price_bdt ?? Infinity))
    .map((m) => ({
      brand: m.brand_name,
      manufacturer: m.manufacturer,
      price: m.price_bdt,
      strength: m.strength,
      form: m.form,
    }));

  return res.json({
    success: true,
    data: {
      detectedMedicine: detected.brand_name,
      generic: detected.generic_name,
      manufacturer: detected.manufacturer,
      price: detected.price_bdt,
      strength: detected.strength,
      form: detected.form,
      alternatives,
    },
  });
});

/**
 * POST /api/medicine/advice
 * Get offline advice for a specific medicine from local DB.
 * (Replaces the previous Gemini-powered endpoint)
 */
medicineRouter.post("/advice", (req, res) => {
  const { medicine_name } = req.body;
  if (!medicine_name) {
    return res.status(400).json({ success: false, error: "medicine_name is required." });
  }

  // Search local DB for the medicine
  const results = fuse.search(medicine_name);
  const match = results.length > 0 ? results[0].item : null;

  if (!match) {
    return res.json({
      success: true,
      data: {
        medicine_name,
        generic_name: "Unknown",
        category: "Unknown",
        common_uses: ["Information not available in local database"],
        side_effects: ["Consult your doctor or pharmacist"],
        advice: {
          do: ["Ask your pharmacist about this medicine"],
          dont: ["Do not change dosage without consulting a doctor"],
          diet: [],
          lifestyle: [],
        },
        alternatives_generic: [],
        disclaimer: "This is offline advice from a local database. Consult a doctor for complete guidance.",
      },
    });
  }

  // Find alternatives with same generic
  const alternatives = medicineDB
    .filter(
      (m) =>
        m.generic_name.toLowerCase() === match.generic_name.toLowerCase() &&
        m.brand_name.toLowerCase() !== match.brand_name.toLowerCase()
    )
    .map((m) => m.brand_name);

  res.json({
    success: true,
    data: {
      medicine_name: match.brand_name,
      generic_name: match.generic_name,
      category: match.form || "Tablet",
      strength: match.strength,
      manufacturer: match.manufacturer,
      price_bdt: match.price_bdt,
      common_uses: [`Contains ${match.generic_name}`],
      side_effects: ["Refer to package insert or consult your pharmacist"],
      advice: {
        do: ["Take as prescribed by your doctor", "Store in a cool dry place"],
        dont: ["Do not exceed the prescribed dose", "Do not share with others"],
        diet: ["Take with water unless otherwise directed"],
        lifestyle: ["Complete the full course if prescribed"],
      },
      alternatives_generic: alternatives,
      disclaimer: "This is offline advice from a local database. Consult a doctor for complete guidance.",
    },
  });
});
