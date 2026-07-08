import { Router } from "express";
import multer from "multer";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { medicineDB } from "../data/medicines.js";
import {
    extractMedicinesFromPrescription,
    extractLabReportAnalysis,
    GeminiConfigError,
    GeminiInputError,
    GeminiAuthError,
    GeminiQuotaError,
    GeminiTimeoutError,
    GeminiInvalidJsonError,
    GeminiApiError,
} from "../services/geminiService.js";
import { matchMedicines } from "../services/medicineMatcher.js";

export const analysisRouter = Router();

// --- Resolve paths ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OCR_ENGINE_PATH = path.resolve(__dirname, "../ai_engine/ocr_engine.py");
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

// ---------------------------------------------------------------
// Feature flag: USE_GEMINI
// ---------------------------------------------------------------
// When "true" (string), prescription analysis is delegated to the
// Google Gemini service. When "false" or unset, the existing offline
// TrOCR + Fuse.js pipeline is used as the fallback.
//
// This is intentionally a temporary fallback mechanism so the offline
// model can continue to be improved in parallel without removing it.
// ---------------------------------------------------------------
const USE_GEMINI = String(process.env.USE_GEMINI || "").toLowerCase() === "true";
console.log(
    `[analysis] USE_GEMINI=${USE_GEMINI} (set USE_GEMINI=true in .env to switch)`
);

// Upper bound on the OCR subprocess. Configurable via OCR_TIMEOUT_MS.
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 60_000;

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ---------------------------------------------------------------
// Typed errors raised by this route so the global error handler
// (and the inline handler in /upload) can map them to proper
// HTTP status codes instead of a generic 500.
// ---------------------------------------------------------------

export class OcrEngineError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "OcrEngineError";
        this.httpStatus = 502; // upstream OCR is unreachable / misbehaving
        this.code = "OCR_ENGINE_ERROR";
        this.cause = cause;
    }
}

export class OcrTimeoutError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "OcrTimeoutError";
        this.httpStatus = 504;
        this.code = "OCR_TIMEOUT";
        this.cause = cause;
    }
}

export class UploadValidationError extends Error {
    constructor(message, httpStatus = 400, code = "UPLOAD_VALIDATION") {
        super(message);
        this.name = "UploadValidationError";
        this.httpStatus = httpStatus;
        this.code = code;
    }
}

// --- Multer: save to disk so Python can read the file ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new UploadValidationError(
        `Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, WebP, GIF.`,
        415,
        "UNSUPPORTED_MEDIA_TYPE"
      ));
    }
  },
});

/**
 * Wraps `multer.single()` so that multer errors (LIMIT_FILE_SIZE,
 * UNEXPECTED_FIELD, ...) are surfaced as UploadValidationError with
 * the right HTTP status. Without this, multer throws a generic Error
 * that the global handler turns into a 500.
 */
function uploadSingle(field) {
  const mw = upload.single(field);
  return (req, res, next) =>
    mw(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new UploadValidationError(
            "Uploaded file is too large. Maximum size is 10 MB.",
            413,
            "FILE_TOO_LARGE"
          ));
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(new UploadValidationError(
            `Unexpected file field "${err.field}". Expected "${field}".`,
            400,
            "UNEXPECTED_FIELD"
          ));
        }
        return next(new UploadValidationError(
          `Upload failed: ${err.message}`,
          400,
          `MULTER_${err.code}`
        ));
      }
      next(err);
    });
}

/**
 * Run the Python OCR engine on an image file.
 * Resolves with the predicted text. Rejects with:
 *   - OcrTimeoutError  if the subprocess takes > OCR_TIMEOUT_MS
 *   - OcrEngineError   if spawn fails or the process exits non-zero
 */
function runOcrEngine(imagePath) {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn("python3", [OCR_ENGINE_PATH, imagePath]);
    } catch (e) {
      return reject(new OcrEngineError(
        `Failed to spawn OCR engine: ${e.message}`, e
      ));
    }

    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;

    const timer = setTimeout(() => {
      killedByTimeout = true;
      try { proc.kill("SIGKILL"); } catch (_) { /* ignore */ }
      reject(new OcrTimeoutError(
        `OCR engine did not respond within ${OCR_TIMEOUT_MS}ms.`
      ));
    }, OCR_TIMEOUT_MS);

    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killedByTimeout) return; // already rejected
      if (code !== 0) {
        return reject(new OcrEngineError(
          `OCR engine exited with code ${code}: ${stderr.trim().slice(0, 500)}`
        ));
      }
      resolve(stdout.trim());
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      if (killedByTimeout) return; // already rejected
      reject(new OcrEngineError(
        `OCR engine process error: ${err.message}`, err
      ));
    });
  });
}

/**
 * Strictly validate a base64 string before we try to decode it.
 * Rejects:
 *   - non-strings, empty strings, strings that look like JSON literals
 *   - super-long payloads that probably aren't real prescription images
 * Returns the cleaned base64 (data URL prefix stripped) or throws.
 */
function validateBase64Image(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new UploadValidationError(
      "No image data provided. Expected a base64 string under `image`.",
      400,
      "EMPTY_UPLOAD"
    );
  }
  if (raw.length > 25 * 1024 * 1024) {
    // 25 MB of base64 ≈ 18 MB decoded. Same upper bound as the JSON body parser.
    throw new UploadValidationError(
      "Base64 image payload is too large (max 25 MB).",
      413,
      "FILE_TOO_LARGE"
    );
  }
  // Strip data URL prefix if present.
  let cleaned = raw.replace(/^data:image\/\w+;base64,/, "");
  if (!cleaned || cleaned.length < 16) {
    throw new UploadValidationError(
      "Image data is empty or too small to be a valid image.",
      400,
      "EMPTY_UPLOAD"
    );
  }
  // Quick sanity check: base64 alphabet only. We don't want arbitrary
  // user text to slip into Buffer.from() and allocate huge buffers.
  if (!/^[A-Za-z0-9+/_=\s-]+$/.test(cleaned)) {
    throw new UploadValidationError(
      "Image data is not valid base64.",
      400,
      "INVALID_BASE64"
    );
  }
  return cleaned;
}

/**
 * Decode a base64 image to bytes and verify it is non-empty.
 * Throws UploadValidationError(400) on empty input.
 */
function decodeBase64Image(cleanedBase64) {
  let bytes;
  try {
    bytes = Buffer.from(cleanedBase64, "base64");
  } catch (e) {
    throw new UploadValidationError(
      `Could not decode base64 image: ${e.message}`, 400, "INVALID_BASE64"
    );
  }
  if (!bytes || bytes.length === 0) {
    throw new UploadValidationError(
      "Decoded image is empty (0 bytes).", 400, "EMPTY_UPLOAD"
    );
  }
  return bytes;
}

/**
 * Parse raw OCR text into individual medicine tokens.
 * Splits on newlines, commas, common separators, and extracts strength patterns.
 */
function parseOcrTokens(rawText) {
  // Split by newlines, commas, semicolons, or multiple spaces
  const lines = rawText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const tokens = [];

  for (const line of lines) {
    // Try to separate medicine name from strength (e.g., "Napa 500mg" or "N0pa500mg")
    const match = line.match(/^(.+?)\s*(\d+\s*(?:mg|mcg|ml|g|iu|puff)[^\s]*)?$/i);
    if (match) {
      tokens.push({
        raw: line,
        name: match[1].trim(),
        strength: match[2] ? match[2].trim() : null,
      });
    } else {
      tokens.push({ raw: line, name: line, strength: null });
    }
  }

  return tokens;
}

/**
 * Clean up (delete) a temporary uploaded file.
 */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error(`Warning: Could not delete temp file ${filePath}:`, e.message);
  }
}

/**
 * Map a list of detected medicines (any provider — Gemini, TrOCR, …) to the
 * public API contract the frontend (ScanPage.jsx) renders:
 *
 *   { success: true, medicines: [
 *       { detectedName, matchedMedicine, generic, confidence, alternatives[] }
 *   ] }
 *
 * Every provider feeds in `{ name, confidence, dosage }` rows. We run each
 * name through `matchMedicines` against data/medicines.js to resolve the
 * generic_name, manufacturer, form, price, and a sorted list of
 * same-generic alternatives. This is the SINGLE place that decides what
 * the client sees — both Gemini and offline OCR produce identical shapes.
 *
 * The optional `geminiGenerics` array (same length and order as `detected`)
 * carries the generic_name the Gemini model itself returned for each
 * detected brand. We use it as a FALLBACK to look up alternatives when the
 * fuzzy matcher could not find the brand in the local DB — e.g. an
 * unfamiliar brand whose salt composition is still identifiable.
 */
function buildResponse(detected, geminiGenerics = []) {
  const rawMedicines = Array.isArray(detected) ? detected : [];

  // Run every name through the fuzzy matcher against data/medicines.js.
  // Each medicine becomes a row with match_status ("matched" | "unknown"),
  // a numeric similarity, and the full DB record if a match was found.
  const matched = matchMedicines(rawMedicines);

  // Build the compact public contract:
  //   { detectedName, matchedMedicine, generic, confidence, alternatives[] }
  const medicines = matched.map((m, idx) => {
    const detectedName = m.name || "";
    const isMatched = m.match_status === "matched" && m.brand_name;
    const matchedMedicine = isMatched ? m.brand_name : "";

    // Prefer the DB-resolved generic when the brand matched. Otherwise
    // fall back to whatever generic_name Gemini provided (if any) so
    // the alternatives list is still anchored to a real salt.
    let generic = m.generic_name || "";
    let resolvedByMatcher = isMatched;
    if (!generic) {
      const fromGemini =
        idx < geminiGenerics.length
          ? (geminiGenerics[idx] || "").trim()
          : "";
      if (fromGemini) {
        generic = fromGemini;
      }
    }

    const confidence = m.confidence || "low";

    // Resolve alternatives from data/medicines.js. Allowed whenever we
    // have an anchored generic (either via fuzzy match or Gemini's
    // generic_name fallback). Sorted cheapest first.
    let alternatives = [];
    if (generic) {
      const genericLc = generic.toLowerCase();
      const matchedLc = matchedMedicine.toLowerCase();
      alternatives = medicineDB
        .filter(
          (db) =>
            db.generic_name &&
            db.generic_name.toLowerCase() === genericLc &&
            db.brand_name &&
            // When the brand is known, hide the matched brand itself from
            // the alternatives list. When it is unknown (resolved only via
            // Gemini's generic_name), we cannot know which DB row was
            // "the same" so we keep the full set — the frontend shows the
            // match status so the user can tell the brand wasn't local.
            (!resolvedByMatcher ||
              db.brand_name.toLowerCase() !== matchedLc)
        )
        .sort((a, b) => (a.price_bdt ?? Infinity) - (b.price_bdt ?? Infinity))
        .map((db) => ({
          brand: db.brand_name,
          manufacturer: db.manufacturer || "",
          price: db.price_bdt ?? null,
          strength: db.strength || "",
          form: db.form || "",
        }));
    }

    return {
      detectedName,
      matchedMedicine,
      generic,
      confidence,
      alternatives,
    };
  });

  return { success: true, medicines };
}

/**
 * Backwards-compatible alias — kept so any external caller that imported
 * `mapGeminiToResponse` from a future refactor still resolves.
 */
function mapGeminiToResponse(geminiResult) {
  const meds = Array.isArray(geminiResult?.medicines) ? geminiResult.medicines : [];
  const generics = meds.map((m) => (typeof m?.generic_name === "string" ? m.generic_name : ""));
  return buildResponse(meds, generics);
}

/**
 * Run the Gemini prescription service on a file on disk.
 * Returns a compact response: { success, medicines: [...] }.
 *
 * On failure, throws an Error whose `httpStatus` and `code` are set so
 * the route handler can respond with a proper status code instead of
 * letting the global handler convert it into a generic 500.
 */
async function analyzeWithGemini(imagePath) {
  let geminiResult;
  try {
    geminiResult = await extractMedicinesFromPrescription({ imagePath });
  } catch (err) {
    // Typed, well-understood errors — propagate with their declared
    // httpStatus and code. The global handler will turn this into the
    // right response shape.
    if (
      err instanceof GeminiConfigError ||
      err instanceof GeminiInputError ||
      err instanceof GeminiAuthError ||
      err instanceof GeminiQuotaError ||
      err instanceof GeminiTimeoutError ||
      err instanceof GeminiInvalidJsonError ||
      err instanceof GeminiApiError
    ) {
      throw err;
    }

    // Truly unexpected error — wrap with a 500.
    const e = new Error(`Unexpected Gemini error: ${err.message || err}`);
    e.httpStatus = 500;
    e.code = "GEMINI_UNEXPECTED";
    e.cause = err;
    throw e;
  }
  return buildResponse(geminiResult?.medicines, geminiResult?.medicines?.map((m) => m?.generic_name));
}

/**
 * Run the offline TrOCR + Fuse.js pipeline on a file on disk and return
 * the same `{ success, medicines: [...] }` contract as analyzeWithGemini.
 *
 * The fuzzy matcher (matchMedicines → buildResponse) is the single source
 * of truth for what the client sees, so both providers are interchangeable
 * from the frontend's point of view.
 *
 * Errors from the OCR subprocess (timeout / spawn failure / non-zero exit)
 * are typed and propagated via runOcrEngine so the caller can return the
 * right HTTP status code.
 */
async function analyzeWithOfflineOcr(imagePath) {
  const rawOcr = await runOcrEngine(imagePath);
  if (!rawOcr || rawOcr.length === 0) {
    // Nothing readable on the page — return an empty list, not an error.
    // The frontend renders this as "no medicines detected".
    return buildResponse([]);
  }

  const tokens = parseOcrTokens(rawOcr);
  // Shape the OCR tokens into the {name, confidence, dosage} input the
  // matcher expects. The OCR model doesn't give a confidence value, so
  // we derive one from the matcher's similarity score later in
  // buildResponse. The OCR-side `confidence` string we attach here is
  // used as a fallback if the matcher returns 0.
  const detected = tokens.map((t) => ({
    name: t.name,
    // Treat every OCR token as the model's best guess with "medium"
    // confidence. buildResponse() will override this to "high" or "low"
    // based on the actual fuzzy-match similarity.
    confidence: "medium",
    dosage: t.strength || "",
  }));
  return buildResponse(detected);
}

/**
 * Centralized error → JSON converter used by both routes.
 * Sends { success: false, error, code } with err.httpStatus (or 500).
 */
function sendError(res, err) {
  const status = Number(err?.httpStatus) || 500;
  const payload = {
    success: false,
    error: err?.message || "Internal Server Error",
    code: err?.code || "INTERNAL_ERROR",
  };
  if (status >= 500) {
    console.error(`[analysis] ${err?.code || "ERROR"} (${status}):`, err?.message);
    if (err?.stack) console.error(err.stack);
  }
  return res.status(status).json(payload);
}

/**
 * POST /api/analysis/upload
 * Accepts an image file of a prescription.
 * Runs offline TrOCR → Fuse.js fuzzy matching → structured JSON response,
 * OR delegates to Gemini if the feature flag is on.
 *
 * Error contract:
 *   - 400  empty upload, missing file, multer validation problem
 *   - 413  file too large
 *   - 415  unsupported media type
 *   - 502  OCR subprocess failed
 *   - 504  OCR timed out
 *   - 4xx  typed Gemini errors (auth, quota, invalid input, …)
 *   - 500  anything unexpected
 *
 * Never crashes the server. Temp files are always cleaned up.
 */
analysisRouter.post("/upload", uploadSingle("document"), async (req, res) => {
  let imagePath = null;

  try {
    if (!req.file) {
      throw new UploadValidationError(
        "No file uploaded. Use multipart/form-data with field name \"document\".",
        400,
        "EMPTY_UPLOAD"
      );
    }

    imagePath = req.file.path;

    // Belt-and-suspenders: multer's limits object should catch this, but
    // someone could bypass it with a corrupt upload or a future refactor.
    if (req.file.size === 0) {
      throw new UploadValidationError(
        "Uploaded file is empty (0 bytes).", 400, "EMPTY_UPLOAD"
      );
    }

    console.log(`📄 Analyzing document: ${req.file.originalname} (${req.file.mimetype}, ${(req.file.size / 1024).toFixed(1)}KB)`);

    // ---------------------------------------------------------------
    // Feature flag branch: USE_GEMINI
    // When enabled, delegate to the Gemini service and return early.
    // The offline OCR pipeline below is intentionally preserved as a
    // fallback until the custom TrOCR model is improved further.
    // ---------------------------------------------------------------
    if (USE_GEMINI) {
      console.log("[analysis] Routing request through Google Gemini service...");
      const responseData = await analyzeWithGemini(imagePath);
      cleanupFile(imagePath);
      imagePath = null;
      return res.json(responseData);
    }

    // Offline TrOCR → fuzzy match → unified public contract. Both
    // branches feed buildResponse() so the frontend sees one shape.
    const responseData = await analyzeWithOfflineOcr(imagePath);
    cleanupFile(imagePath);
    imagePath = null;
    return res.json(responseData);
  } catch (error) {
    if (imagePath) {
      cleanupFile(imagePath);
      imagePath = null;
    }
    return sendError(res, error);
  }
});

/**
 * POST /api/analysis/base64
 * Accepts a base64-encoded image string (from camera capture).
 * Saves to disk temporarily, runs OCR, then cleans up.
 *
 * Same error contract as /upload — never crashes, always returns JSON.
 */
analysisRouter.post("/base64", async (req, res) => {
  let tempPath = null;

  try {
    const { image } = req.body;
    // Validate strictly. Throws UploadValidationError with the right code;
    // sendError() below turns it into a 400/413 response.
    const cleaned = validateBase64Image(image);
    const bytes = decodeBase64Image(cleaned);

    // Persist to disk so the OCR subprocess / Gemini can read the file.
    const tempFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    tempPath = path.join(UPLOADS_DIR, tempFilename);
    fs.writeFileSync(tempPath, bytes);

    console.log(`📸 Analyzing base64 image (saved to ${tempFilename})`);

    // ---------------------------------------------------------------
    // Feature flag branch: USE_GEMINI
    // Same fallback rule as the /upload route above.
    // ---------------------------------------------------------------
    if (USE_GEMINI) {
      console.log("[analysis] Routing base64 request through Google Gemini service...");
      const responseData = await analyzeWithGemini(tempPath);
      cleanupFile(tempPath);
      tempPath = null;
      return res.json(responseData);
    }

    // Offline OCR branch — produces the same public contract.
    const responseData = await analyzeWithOfflineOcr(tempPath);
    cleanupFile(tempPath);
    tempPath = null;
    return res.json(responseData);
  } catch (error) {
    if (tempPath) cleanupFile(tempPath);
    return sendError(res, error);
  }
});

/**
 * Run the Gemini lab-report analyzer on a file on disk and wrap its
 * output in the public `{ success, report }` envelope.
 *
 * Errors propagate with their typed `httpStatus` and `code`, the same
 * way `analyzeWithGemini` handles prescription failures.
 */
async function analyzeReportWithGemini(imagePath) {
  let geminiResult;
  try {
    geminiResult = await extractLabReportAnalysis({ imagePath });
  } catch (err) {
    if (
      err instanceof GeminiConfigError ||
      err instanceof GeminiInputError ||
      err instanceof GeminiAuthError ||
      err instanceof GeminiQuotaError ||
      err instanceof GeminiTimeoutError ||
      err instanceof GeminiInvalidJsonError ||
      err instanceof GeminiApiError
    ) {
      throw err;
    }
    const e = new Error(`Unexpected Gemini error: ${err.message || err}`);
    e.httpStatus = 500;
    e.code = "GEMINI_UNEXPECTED";
    e.cause = err;
    throw e;
  }
  return { success: true, report: geminiResult };
}

/**
 * POST /api/analysis/report
 * Accepts an image file of a medical/lab report (CBC, lipid profile,
 * liver function, thyroid panel, …). Always uses the Gemini service
 * — there is no offline equivalent.
 *
 * Returns:
 *   { success: true, report: {
 *       report_type, patient_info, findings, abnormal_findings,
 *       problems, todolist, dontdolist, overall_assessment,
 *       confidence, warnings
 *   } }
 *
 * Same error contract as /upload:
 *   - 400  empty upload, missing file, multer validation problem
 *   - 413  file too large
 *   - 415  unsupported media type
 *   - 4xx  typed Gemini errors (auth, quota, invalid input, …)
 *   - 500  anything unexpected
 */
analysisRouter.post("/report", uploadSingle("document"), async (req, res) => {
  let imagePath = null;

  try {
    if (!req.file) {
      throw new UploadValidationError(
        "No file uploaded. Use multipart/form-data with field name \"document\".",
        400,
        "EMPTY_UPLOAD"
      );
    }

    imagePath = req.file.path;

    if (req.file.size === 0) {
      throw new UploadValidationError(
        "Uploaded file is empty (0 bytes).", 400, "EMPTY_UPLOAD"
      );
    }

    console.log(`🧪 Analyzing medical report: ${req.file.originalname} (${req.file.mimetype}, ${(req.file.size / 1024).toFixed(1)}KB)`);

    if (!USE_GEMINI) {
      // Medical-report analysis is Gemini-only for now. Refuse loudly
      // so the frontend can switch the flag instead of hanging.
      throw new GeminiConfigError(
        "Medical report analysis requires USE_GEMINI=true. " +
        "Set USE_GEMINI=true in server/.env and restart the server."
      );
    }

    const responseData = await analyzeReportWithGemini(imagePath);
    cleanupFile(imagePath);
    imagePath = null;
    return res.json(responseData);
  } catch (error) {
    if (imagePath) {
      cleanupFile(imagePath);
      imagePath = null;
    }
    return sendError(res, error);
  }
});

/**
 * POST /api/analysis/report/base64
 * Accepts a base64-encoded medical report image (from camera capture).
 * Saves to disk temporarily, runs Gemini, then cleans up.
 *
 * Same error contract as /report.
 */
analysisRouter.post("/report/base64", async (req, res) => {
  let tempPath = null;

  try {
    const { image } = req.body;
    const cleaned = validateBase64Image(image);
    const bytes = decodeBase64Image(cleaned);

    const tempFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    tempPath = path.join(UPLOADS_DIR, tempFilename);
    fs.writeFileSync(tempPath, bytes);

    console.log(`🧪 Analyzing base64 medical report (saved to ${tempFilename})`);

    if (!USE_GEMINI) {
      throw new GeminiConfigError(
        "Medical report analysis requires USE_GEMINI=true. " +
        "Set USE_GEMINI=true in server/.env and restart the server."
      );
    }

    const responseData = await analyzeReportWithGemini(tempPath);
    cleanupFile(tempPath);
    tempPath = null;
    return res.json(responseData);
  } catch (error) {
    if (tempPath) cleanupFile(tempPath);
    return sendError(res, error);
  }
});
