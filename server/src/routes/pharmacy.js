import { Router } from "express";
import { pharmacies } from "../data/pharmacies.js";

export const pharmacyRouter = Router();

/**
 * GET /api/pharmacy/list
 * Returns all trusted pharmacies in Bangladesh.
 */
pharmacyRouter.get("/list", (_req, res) => {
  res.json({ success: true, data: pharmacies });
});

/**
 * GET /api/pharmacy/search?medicine=Napa&location=Dhaka
 * Returns pharmacies that likely stock a given medicine, filtered by location.
 * For the hackathon MVP, we return all pharmacies with a "buy link" constructed from their base URL.
 */
pharmacyRouter.get("/search", (req, res) => {
  const { medicine, location } = req.query;

  let filtered = [...pharmacies];

  if (location) {
    const loc = location.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.location.toLowerCase().includes(loc) ||
        p.coverage.toLowerCase().includes(loc) ||
        p.coverage.toLowerCase() === "nationwide"
    );
  }

  // Construct search URLs for each pharmacy
  const results = filtered.map((p) => ({
    ...p,
    search_url: medicine
      ? p.search_url_template.replace("{query}", encodeURIComponent(medicine))
      : p.website,
  }));

  res.json({ success: true, data: results });
});
