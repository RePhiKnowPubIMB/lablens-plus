/**
 * LabLens Plus — Medicine Name Matcher
 * ---------------------------------------------------------------
 * Fuzzy-matches a list of medicine names (typically produced by an
 * OCR pipeline or the Gemini service) against the local Bangladeshi
 * medicine database (`data/medicines.js`).
 *
 * Matching strategy
 * -----------------
 * 1. Normalize BOTH the query and each DB name so that common OCR
 *    artefacts do not affect the score:
 *       - lowercase
 *       - remove whitespace and common punctuation
 *       - replace lookalike characters (0 ↔ o, 1 ↔ l ↔ i)
 *       - collapse runs of 3+ identical letters to a single letter
 *         (catches "Napaa" → "napa", "Nappa" is two runs of 2 so it
 *         naturally lowers the score on top of the substitution step)
 *
 * 2. Use Fuse.js with the normalized pair as the searchable string.
 *    Fuse returns a `score` in [0, 1] where 0 = perfect match.
 *
 * 3. Convert Fuse score → similarity percent:
 *        similarity = (1 - score) * 100
 *
 * 4. If similarity > 80, the candidate is considered a match and its
 *    full DB record is returned. Otherwise the match is reported as
 *    `null` and the row is flagged as "Unknown Medicine".
 *
 * The 80% threshold is exposed as `MATCH_THRESHOLD_PERCENT` so it is
 * trivial to tune from a single place.
 */

import Fuse from "fuse.js";
import { medicineDB } from "../data/medicines.js";

const MATCH_THRESHOLD_PERCENT = 80;

/**
 * Normalize a string for fuzzy comparison.
 * Lowercases, strips whitespace and punctuation, and applies OCR-friendly
 * substitutions so that:
 *   "Napa "      -> "napa"
 *   "NAPA"       -> "napa"
 *   "Napa."      -> "napa"
 *   "N0pa"       -> "nopa"
 *   "Napaa"      -> "napa" (run of 3+ identical letters collapsed)
 *   "N-Ap_a"     -> "napa"
 */
export function normalizeMedicineName(input) {
    if (typeof input !== "string") return "";
    return input
        .toLowerCase()
        // OCR-character substitutions (must come before other stripping)
        .replace(/0/g, "o")
        .replace(/1/g, "l")
        // Drop punctuation (hyphen, dot, underscore, slash, etc.)
        .replace(/[^a-z\s]/g, "")
        // Strip whitespace
        .replace(/\s+/g, "")
        // Collapse runs of 3+ identical letters to a single letter.
        // "Napaa" (4 chars: n,a,p,a,a -> collapse 'aa' to 'a' => "napa")
        // Leaves "aa", "pp" untouched so we don't over-correct real names.
        .replace(/([a-z])\1{2,}/g, "$1");
}

/**
 * Build a Fuse index over the medicine DB using BOTH brand_name and
 * generic_name as searchable fields.
 *
 * `threshold: 1.0` is intentional — we always want the closest candidate
 * back. The CALLER is responsible for applying the 80% similarity rule,
 * not Fuse. This keeps the threshold logic explicit and easy to test.
 */
const fuse = new Fuse(medicineDB, {
    keys: [
        { name: "brand_name", weight: 1.0 },
        { name: "generic_name", weight: 0.6 },
    ],
    threshold: 1.0,           // always return the closest candidate
    ignoreLocation: true,
    includeScore: true,
    // We feed pre-normalized strings in, so disable Fuse's own normalization.
    getFn: (obj, path) => normalizeMedicineName(String(obj[path])),
});

/**
 * Find the best match for a single medicine name.
 *
 * @param {string} query  Raw name as produced by the OCR/Gemini pipeline.
 * @returns {{
 *   matched: boolean,        // similarity > MATCH_THRESHOLD_PERCENT
 *   similarity: number,      // 0–100, rounded to 2 decimals
 *   entry: object|null,      // full DB record, or null if no match
 *   matchedField: "brand_name"|"generic_name"|null,
 * }}
 */
export function bestMatchFor(query) {
    const normalized = normalizeMedicineName(query);
    if (!normalized) {
        return { matched: false, similarity: 0, entry: null, matchedField: null };
    }

    const results = fuse.search(normalized);
    if (results.length === 0) {
        return { matched: false, similarity: 0, entry: null, matchedField: null };
    }

    // Fuse's `score` is in [0, 1] where 0 is a perfect match.
    // Convert to a human-friendly similarity percent.
    const top = results[0];
    const similarity = Math.round((1 - top.score) * 100 * 100) / 100;

    // We have to ask Fuse which key matched, but the SDK exposes that via
    // the `matches` array on the result.
    let matchedField = null;
    if (Array.isArray(top.matches) && top.matches.length > 0) {
        matchedField = top.matches[0].key || null;
    }

    const matched = similarity > MATCH_THRESHOLD_PERCENT;
    return {
        matched,
        similarity,
        entry: matched ? top.item : null,
        matchedField: matched ? matchedField : null,
    };
}

/**
 * Match a whole list of medicine names (e.g. from Gemini or the OCR
 * pipeline) against the DB. Each input becomes:
 *
 *   {
 *     name:            "<original name>"   // may be empty if unreadable
 *     confidence:      "<model's confidence>" // "high" | "medium" | "low"
 *     dosage:          "<dosage string>"
 *     match_status:    "matched" | "unknown"
 *     similarity:      <0–100>             // numeric from the matcher
 *     brand_name:      <DB brand_name or null>
 *     generic_name:    <DB generic_name or null>
 *     manufacturer:    <DB manufacturer or null>
 *     form:            <DB form or null>
 *     strength_db:     <DB strength or null>
 *     price_bdt:       <DB price or null>
 *     matched_field:   "brand_name" | "generic_name" | null
 *   }
 *
 * The original `name`, `confidence`, and `dosage` from the source model
 * are preserved unchanged.
 */
export function matchMedicines(medicines) {
    if (!Array.isArray(medicines)) return [];

    return medicines.map((m) => {
        const sourceName = typeof m?.name === "string" ? m.name : "";
        const sourceConfidence = typeof m?.confidence === "string" ? m.confidence : "low";
        const sourceDosage = typeof m?.dosage === "string" ? m.dosage : "";

        const best = bestMatchFor(sourceName);

        return {
            // Pass-through fields from the upstream model
            name: sourceName,
            confidence: sourceConfidence,
            dosage: sourceDosage,

            // Matcher output
            match_status: best.matched ? "matched" : "unknown",
            similarity: best.similarity,
            matched_field: best.matchedField,
            brand_name: best.entry?.brand_name ?? null,
            generic_name: best.entry?.generic_name ?? null,
            manufacturer: best.entry?.manufacturer ?? null,
            form: best.entry?.form ?? null,
            strength_db: best.entry?.strength ?? null,
            price_bdt: best.entry?.price_bdt ?? null,
        };
    });
}

/**
 * Convenience: the configured match threshold, exported for callers
 * (and tests) that want to surface the rule.
 */
export const MATCH_THRESHOLD = MATCH_THRESHOLD_PERCENT;

export default {
    normalizeMedicineName,
    bestMatchFor,
    matchMedicines,
    MATCH_THRESHOLD,
};
