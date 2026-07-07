import { Router } from "express";
import Fuse from "fuse.js";
import { medicineDB } from "../data/medicines.js";
import { getMedicineAdvice } from "../services/geminiService.js";

export const medicineRouter = Router();

// Fuzzy search index for medicine names
const fuse = new Fuse(medicineDB, {
  keys: ["brand_name", "generic_name", "category"],
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
 * POST /api/medicine/advice
 * Get AI-powered advice for a specific medicine.
 */
medicineRouter.post("/advice", async (req, res, next) => {
  try {
    const { medicine_name } = req.body;
    if (!medicine_name) {
      return res.status(400).json({ success: false, error: "medicine_name is required." });
    }

    const advice = await getMedicineAdvice(medicine_name);
    res.json({ success: true, data: advice });
  } catch (error) {
    next(error);
  }
});
