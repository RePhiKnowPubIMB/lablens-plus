/**
 * LabLens Plus — Gemini Service
 * ---------------------------------------------------------------
 * A standalone, route-agnostic module that uses Google's official
 * Generative AI SDK (`@google/genai`) to extract medicines from a
 * prescription image.
 *
 *  - Reads `GEMINI_API_KEY` from environment (.env).
 *  - Accepts either a file path on disk or a base64-encoded string.
 *  - Returns the strict JSON contract:
 *        { medicines: [ { name, confidence: "high"|"medium"|"low", dosage } ] }
 *  - Gemini is instructed to act as a pharmacist: ignore doctor notes,
 *    patient name, hospital info, date, and orphan dosages.
 *  - Does NOT touch the offline TrOCR pipeline; it runs in parallel.
 *  - Does NOT register any Express route. Callers wire it up later.
 *
 * Usage (from a route/controller, once integrated):
 *
 *     import { extractMedicinesFromPrescription } from "../services/geminiService.js";
 *
 *     const result = await extractMedicinesFromPrescription({
 *         imagePath: "/abs/path/to/upload.jpg",
 *     });
 *     // result => { medicines: [ { name, confidence, dosage }, ... ] }
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { GoogleGenAI, Type } from "@google/genai";

// ---------------------------------------------------------------
// 1. API key & client singleton
// ---------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Default 25s — the SDK call itself is usually <5s but we give breathing
// room for cold starts. Configurable via GEMINI_TIMEOUT_MS.
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 25_000;

// Reasonable upper bound for an uploaded prescription. Anything larger
// is almost certainly an attack or a mistake; reject before we burn
// tokens on it. Configurable via GEMINI_MAX_IMAGE_BYTES (default 8 MB).
const MAX_IMAGE_BYTES = Number(process.env.GEMINI_MAX_IMAGE_BYTES) || 8 * 1024 * 1024;

if (!GEMINI_API_KEY) {
    // Fail fast at import time so misconfiguration is obvious in logs.
    // This is a module-level guard, not a per-request error.
    console.warn(
        "[geminiService] WARNING: GEMINI_API_KEY is not set in .env. " +
        "Calls to extractMedicinesFromPrescription() will fail."
    );
}

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ---------------------------------------------------------------
// 2. Allowed MIME types (must match what the upload route accepts)
// ---------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

// ---------------------------------------------------------------
// 3. Structured-output schema for the Gemini response
//    Using `responseSchema` + `responseMimeType: "application/json"`
//    forces Gemini to return JSON matching this shape.
// ---------------------------------------------------------------

const PRESCRIPTION_RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    description: "Strict extraction result. No prose, no markdown.",
    properties: {
        medicines: {
            type: Type.ARRAY,
            description: "All medicines written in the prescription.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: {
                        type: Type.STRING,
                        description:
                            "The brand name as written by the doctor. " +
                            "If the doctor only wrote a generic name, copy it here as well.",
                    },
                    generic_name: {
                        type: Type.STRING,
                        description:
                            "The active generic / salt name(s) for this medicine. " +
                            "ALWAYS include this even if the doctor only wrote the brand. " +
                            "For combination drugs, list all actives separated by ' + ' " +
                            "(e.g. 'Amoxicillin + Clavulanic Acid'). " +
                            "Empty string only if you truly cannot determine the generic.",
                    },
                    confidence: {
                        type: Type.STRING,
                        enum: ["high", "medium", "low"],
                        description:
                            "'high' if clearly readable, 'medium' if partially readable, " +
                            "'low' if the handwriting is illegible or uncertain.",
                    },
                    dosage: {
                        type: Type.STRING,
                        description:
                            "The dose that belongs to THIS medicine only (e.g. '500mg'). " +
                            "Empty string if no dose is written or it is illegible.",
                    },
                },
                required: ["name", "generic_name", "confidence", "dosage"],
            },
        },
    },
    required: ["medicines"],
};

// --- Medical report schema (lab reports, blood tests, etc.) ---------
// Strict, schema-enforced output for `extractLabReportAnalysis`.
// The model is asked to compare each measured value against the standard
// reference range, identify abnormalities, list probable problems, and
// recommend what to do / not to do. This is the public contract the
// /api/analysis/report route returns to the frontend.
const LAB_REPORT_RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    description: "Structured analysis of a medical/lab report image.",
    properties: {
        report_type: {
            type: Type.STRING,
            description:
                "Short description of the report (e.g. 'Complete Blood Count (CBC)', " +
                "'Lipid Profile', 'Liver Function Test', 'Thyroid Panel'). " +
                "Empty string if it cannot be determined.",
        },
        patient_info: {
            type: Type.OBJECT,
            description: "Patient details visible on the report. All fields optional.",
            properties: {
                name:   { type: Type.STRING, description: "Patient name, or empty." },
                age:    { type: Type.STRING, description: "Patient age as written, or empty." },
                gender: { type: Type.STRING, description: "Patient gender as written, or empty." },
                date:   { type: Type.STRING, description: "Report date as written, or empty." },
            },
        },
        findings: {
            type: Type.ARRAY,
            description: "Every lab parameter visible in the report, with its value, unit, reference range, and status.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name:       { type: Type.STRING, description: "Name of the parameter (e.g. 'Hemoglobin', 'Total Cholesterol')." },
                    value:      { type: Type.STRING, description: "Measured value as written (preserve formatting)." },
                    unit:       { type: Type.STRING, description: "Unit (e.g. 'g/dL', 'mg/dL', 'mmol/L'). Empty if not shown." },
                    ref_range:  { type: Type.STRING, description: "Reference range as written (e.g. '13.0-17.0'). Empty if not shown." },
                    status:     {
                        type: Type.STRING,
                        enum: ["normal", "low", "high", "borderline", "unknown"],
                        description: "'normal' if within range, 'low'/'high' if outside, 'borderline' if at the edge, 'unknown' if it cannot be judged.",
                    },
                    note:       { type: Type.STRING, description: "Optional one-line note (e.g. 'slightly above normal'). Empty if none." },
                },
                required: ["name", "value", "unit", "ref_range", "status", "note"],
            },
        },
        abnormal_findings: {
            type: Type.ARRAY,
            description: "ONLY the parameters that are out of range or borderline. Same shape as items in `findings`.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name:      { type: Type.STRING },
                    value:     { type: Type.STRING },
                    unit:      { type: Type.STRING },
                    ref_range: { type: Type.STRING },
                    status:    { type: Type.STRING, enum: ["normal", "low", "high", "borderline", "unknown"] },
                    note:      { type: Type.STRING },
                },
                required: ["name", "value", "unit", "ref_range", "status", "note"],
            },
        },
        problems: {
            type: Type.ARRAY,
            description: "Plain-language problems / possible conditions suggested by the abnormal values (e.g. 'Possible iron-deficiency anemia').",
            items: { type: Type.STRING },
        },
        todolist: {
            type: Type.ARRAY,
            description: "Things the patient SHOULD do, given the findings. Action-oriented, short sentences.",
            items: { type: Type.STRING },
        },
        dontdolist: {
            type: Type.ARRAY,
            description: "Things the patient SHOULD AVOID doing, given the findings. Short, actionable sentences.",
            items: { type: Type.STRING },
        },
        overall_assessment: {
            type: Type.STRING,
            description: "2-4 sentence overall summary. Plain language. End with a reminder that this is informational and not a medical diagnosis.",
        },
        confidence: {
            type: Type.STRING,
            enum: ["high", "medium", "low"],
            description: "Model's overall confidence in the extracted values and interpretation.",
        },
        warnings: {
            type: Type.ARRAY,
            description: "Caveats such as illegible values, ambiguous units, or partial reports.",
            items: { type: Type.STRING },
        },
    },
    required: [
        "report_type",
        "patient_info",
        "findings",
        "abnormal_findings",
        "problems",
        "todolist",
        "dontdolist",
        "overall_assessment",
        "confidence",
        "warnings",
    ],
};

// ---------------------------------------------------------------
// 4. System prompt
// ---------------------------------------------------------------

// --- Prescription prompt (existing) ---------------------------------
const SYSTEM_INSTRUCTION = `
You are an experienced pharmacist reading a handwritten prescription.

Your ONLY job is to extract medicine names, their generic (salt) names, and
their dosages.

Strict rules:
1. Read the handwritten prescription carefully.
2. Identify the medicine names that are prescribed.
3. For EVERY medicine you extract, also provide the generic / salt name(s).
   - Common Bangladesh mappings include:
       Napa / Ace / Fast / Renova / Xcel / Tylenol        -> "Paracetamol"
       Napa Extra / Ace Plus                                -> "Paracetamol + Caffeine"
       Seclo / Losectil / Proceptin                         -> "Omeprazole"
       Sergel / Maxpro / Nexium / Esonix                    -> "Esomeprazole"
       Zimax / Azith / Azithrocin                           -> "Azithromycin"
       Cef-3 / Cefim / Cefix / Cephacid                     -> "Cefixime"
       Moxacil / Tycil / Fimoxyl                            -> "Amoxicillin"
       Ciprox / Ciprocin                                    -> "Ciprofloxacin"
       Amdocal / Amlopin / Amlovas                          -> "Amlodipine"
       Losartan / Losar / Anazid                            -> "Losartan Potassium"
       Daonil / Comet / Informet / Sugamet                  -> "Metformin HCl"
       Glimep                                               -> "Glimepiride"
       Fexo / Fixal / Telfast                                -> "Fexofenadine"
       Monas / Montec                                       -> "Montelukast"
       Tofen / Zaditen                                      -> "Ketotifen"
       Histacin                                             -> "Chlorpheniramine"
       Toricel / Keto-R                                     -> "Ketorolac"
       Clofenac / Voltalin                                  -> "Diclofenac Sodium"
       Naprox / Sonap                                       -> "Naproxen"
       Calbo-D / Acical-D / Oscal-D                         -> "Calcium + Vitamin D3"
       Neurobion / Nervex                                   -> "Vitamin B Complex"
       D-Rise                                               -> "Cholecalciferol (Vitamin D3)"
       Ranitid / Neoceptin-R                                -> "Ranitidine"
       Pantonix / Panoral                                   -> "Pantoprazole"
       Domet                                                -> "Domperidone"
       Salbinol / Brodil / Ventolin                         -> "Salbutamol"
       Serotia / Serta                                      -> "Sertraline"
       Anxinil                                              -> "Clonazepam"
       Tyrox / Thyrox / Euthyrox                            -> "Levothyroxine Sodium"
       Lipicon / Atorva / Tiginor                           -> "Atorvastatin"
       Flucan / Flugal                                      -> "Fluconazole"
       Ferogen / Feron                                      -> "Ferrous Sulfate + Folic Acid"
       Augmentin / Moxiclav / Clamox / Clavusef / Tyclav    -> "Amoxicillin + Clavulanic Acid"
       Enzoflam / Enzoflam Plus / Diclofen / Serralon /
         Serrafen                                           -> "Diclofenac + Paracetamol + Serratiopeptidase"
       Hexigel / Hexidine Mouth Gel                         -> "Chlorhexidine Gluconate"
       Chlorhex                                             -> "Chlorhexidine Gluconate"
       Orasep Gel                                           -> "Chlorhexidine Gluconate + Lidocaine"
4. For combination drugs, list all active ingredients separated by " + " in
   the generic_name field (e.g. "Amoxicillin + Clavulanic Acid").
5. IGNORE the doctor's notes, advice, or instructions (e.g. "after meal", "follow up in 2 weeks").
6. IGNORE the patient name.
7. IGNORE the hospital, clinic, or doctor's name and address.
8. IGNORE the date and any reference numbers.
9. IGNORE dosages that are NOT attached to a medicine (e.g. generic "mg/kg" advice lines).
   Only keep a dosage if it clearly belongs to a specific medicine.
10. If a medicine name is unreadable or you are not confident, still include it,
    but set its "confidence" to "low".
11. If the doctor only wrote a generic name (no brand), copy the generic name
    into BOTH the "name" and "generic_name" fields.
12. Return ONLY valid JSON. No markdown. No explanation. No code fences. No extra text.
13. The JSON must match this exact shape:
    {
      "medicines": [
        { "name": "", "generic_name": "", "confidence": "", "dosage": "" }
      ]
    }
    Use "high", "medium", or "low" for confidence. Use empty string for unknown values.
`;

// --- Medical report prompt ------------------------------------------
const LAB_REPORT_SYSTEM_INSTRUCTION = `
You are an experienced clinical pathologist and physician assistant analyzing a
medical laboratory report image (blood test, urine test, lipid profile, liver
function test, thyroid panel, etc.).

Your job is to read every value in the report and compare it against the
standard reference range for an adult. Based on the comparison, explain what
is normal, what is abnormal, what problems the abnormal values may suggest,
and what the patient should or should not do next.

Strict rules:
1. Read every parameter shown in the report. Preserve the original value,
   unit, and reference range exactly as written.
2. For each parameter, decide the status by comparing the value to the
   printed reference range:
     - "normal"     -> value falls inside the printed range
     - "low"        -> value is clearly below the printed range
     - "high"       -> value is clearly above the printed range
     - "borderline" -> value is at or just outside the edge of the range
     - "unknown"    -> no reference range is printed and the test is not
                       common enough to assume
3. Put EVERY parameter you read into the "findings" array. Only parameters
   that are "low", "high", or "borderline" should also appear in
   "abnormal_findings". Do not duplicate items between the two arrays
   beyond that.
4. In "problems", list the most likely clinical problems suggested by the
   abnormal values. Use plain language (e.g. "Possible iron-deficiency
   anemia", "Elevated blood sugar consistent with pre-diabetes"). Limit
   to the 3-5 most likely issues, ordered by clinical importance.
5. In "todolist", list 3-7 concrete actions the patient SHOULD do:
   - "Drink at least 2 liters of water daily"
   - "Repeat the CBC test in 4 weeks"
   - "Consult a hematologist within 2 weeks"
   Each item must be a short, imperative sentence.
6. In "dontdolist", list 3-7 concrete actions the patient SHOULD AVOID:
   - "Avoid self-medicating with iron supplements"
   - "Reduce intake of saturated fats and fried foods"
   - "Do not skip prescribed thyroid medication"
7. NEVER prescribe medication, suggest a specific drug brand, or give a
   definitive diagnosis. Always recommend consulting a qualified doctor.
8. If the image is illegible, a value is unreadable, or a unit is
   ambiguous, list it in "warnings" and mark the parameter "unknown".
9. "overall_assessment" must be 2-4 sentences in plain language, end
   with a clear reminder that this analysis is informational and not a
   substitute for professional medical advice.
10. Return ONLY valid JSON. No markdown, no code fences, no prose before
    or after the JSON. The JSON must match the schema exactly.
`;

// ---------------------------------------------------------------
// 5. Helpers
// ---------------------------------------------------------------

/**
 * Strip common wrappers around the JSON payload that the model sometimes
 * adds despite `responseMimeType: "application/json"` (markdown fences,
 * leading "Here is the JSON:" prose, etc.). Defensive: never throws.
 */
function stripJsonWrappers(rawText) {
    let s = rawText;
    // ```json ... ``` or ``` ... ```
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
    if (fence) s = fence[1];const LAB_REPORT_SYSTEM_INSTRUCTION = `
You are an experienced clinical pathologist and physician assistant analyzing a
medical laboratory report image (blood test, urine test, lipid profile, liver
function test, thyroid panel, etc.).

Your job is to read every value in the report and compare it against the
standard reference range for an adult. Based on the comparison, explain what
is normal, what is abnormal, what problems the abnormal values may suggest,
and what the patient should or should not do next.

Strict rules:
1. Read every parameter shown in the report. Preserve the original value,
   unit, and reference range exactly as written.
2. For each parameter, decide the status by comparing the value to the
   printed reference range:
     - "normal"     -> value falls inside the printed range
     - "low"        -> value is clearly below the printed range
     - "high"       -> value is clearly above the printed range
     - "borderline" -> value is at or just outside the edge of the range
     - "unknown"    -> no reference range is printed and the test is not
                       common enough to assume
3. Put EVERY parameter you read into the "findings" array. Only parameters
   that are "low", "high", or "borderline" should also appear in
   "abnormal_findings". Do not duplicate items between the two arrays
   beyond that.
4. In "problems", list the most likely clinical problems suggested by the
   abnormal values. Use plain language (e.g. "Possible iron-deficiency
   anemia", "Elevated blood sugar consistent with pre-diabetes"). Limit
   to the 3-5 most likely issues, ordered by clinical importance.
5. In "todolist", list 3-7 concrete actions the patient SHOULD do:
   - "Drink at least 2 liters of water daily"
   - "Repeat the CBC test in 4 weeks"
   - "Consult a hematologist within 2 weeks"
   Each item must be a short, imperative sentence.
6. In "dontdolist", list 3-7 concrete actions the patient SHOULD AVOID:
   - "Avoid self-medicating with iron supplements"
   - "Reduce intake of saturated fats and fried foods"
   - "Do not skip prescribed thyroid medication"
7. NEVER prescribe medication, suggest a specific drug brand, or give a
   definitive diagnosis. Always recommend consulting a qualified doctor.
8. If the image is illegible, a value is unreadable, or a unit is
   ambiguous, list it in "warnings" and mark the parameter "unknown".
9. "overall_assessment" must be 2-4 sentences in plain language, end
   with a clear reminder that this analysis is informational and not a
   substitute for professional medical advice.
10. Return ONLY valid JSON. No markdown, no code fences, no prose before
    or after the JSON. The JSON must match the schema exactly.
`;
    return s.trim();
}

/**
 * Try to recover a top-level JSON object from a string by scanning for
 * the first "{" and the matching closing "}". Returns null when nothing
 * plausible is found.
 */
function recoverJsonObject(s) {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    return s.slice(start, end + 1);
}

/**
 * Strip a `data:image/...;base64,` prefix from a base64 string, if present.
 */
function stripDataUrlPrefix(base64String) {
    const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,(.*)$/s.exec(base64String);
    return match ? { mimeType: `image/${match[1]}`, data: match[2] } : null;
}

/**
 * Guess a MIME type from a file extension. Falls back to image/jpeg.
 */
function mimeFromPath(filePath) {
    const ext = filePath.toLowerCase().split(".").pop();
    switch (ext) {
        case "png":
            return "image/png";
        case "webp":
            return "image/webp";
        case "gif":
            return "image/gif";
        case "jpg":
        case "jpeg":
        default:
            return "image/jpeg";
    }
}

/**
 * Convert raw file bytes to a base64 string.
 *
 * Throws GeminiInputError if the file is missing, unreadable, empty,
 * or larger than `MAX_IMAGE_BYTES` (e.g. a corrupt 0-byte upload, or a
 * 100 MB selfie that would blow up the token bill).
 */
function fileToBase64(filePath) {
    let bytes;
    try {
        bytes = readFileSync(filePath);
    } catch (e) {
        if (e && e.code === "ENOENT") {
            throw new GeminiInputError(`Image file not found: ${filePath}`);
        }
        throw new GeminiInputError(`Could not read image: ${e.message}`);
    }
    if (!bytes || bytes.length === 0) {
        throw new GeminiInputError("Uploaded image is empty (0 bytes).");
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
        throw new GeminiInputError(
            `Image too large (${(bytes.length / 1024 / 1024).toFixed(1)} MB). ` +
            `Maximum allowed is ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB.`
        );
    }
    return bytes.toString("base64");
}

/**
 * Wrap a Promise with a timeout. If the original promise hasn't settled
 * within `ms` milliseconds, reject with a GeminiTimeoutError. The
 * optional `onAbort` hook is called so callers can cancel their work
 * (e.g. pass an AbortSignal into the SDK).
 */
function withTimeout(promise, ms, onAbort) {
    let timer;
    const timeout = new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
            try { if (onAbort) onAbort(); } catch (_) { /* ignore */ }
            reject(new GeminiTimeoutError(
                `Gemini request timed out after ${ms}ms.`
            ));
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Inspect an error thrown by the Google GenAI SDK and rethrow it as
 * the most specific Gemini* error we know about. We rely on the SDK
 * exposing `err.status` (HTTP code) and `err.code` (string), and on
 * Node-level signals (AbortError) for timeouts.
 */
function classifySdkError(err) {
    // 1) Our own AbortController trip from withTimeout() surfaces as
    //    a DOMException with name === "AbortError".
    if (err && (err.name === "AbortError" || err.code === 20)) {
        throw new GeminiTimeoutError(
            `Gemini request was aborted (likely timeout): ${err.message || ""}`.trim()
        );
    }

    // 2) If we got a typed error back already (e.g. wrapped by us earlier),
    //    just propagate it.
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

    // 3) The SDK tends to put the HTTP status on `err.status` or `err.response.status`.
    const status = Number(
        err?.status ?? err?.response?.status ?? err?.httpStatus ?? 0
    );
    const message = (err?.message || String(err || "unknown error")).slice(0, 500);

    if (status === 401 || status === 403) {
        throw new GeminiAuthError(
            `Gemini authentication failed (HTTP ${status}). ` +
            `Check that GEMINI_API_KEY is valid and has access to ${GEMINI_MODEL}.`,
            err
        );
    }
    if (status === 408 || status === 504) {
        throw new GeminiTimeoutError(
            `Gemini timed out (HTTP ${status}): ${message}`, err
        );
    }
    if (status === 429) {
        throw new GeminiQuotaError(
            `Gemini quota exceeded (HTTP 429). ` +
            `Try again later, or switch USE_GEMINI=false to use the offline model.`,
            err
        );
    }

    // 4) Everything else is a generic upstream failure.
    throw new GeminiApiError(`Gemini request failed: ${message}`, err);
}

// ---------------------------------------------------------------
// 6. Custom error types (so callers can branch on cause)
//    Every typed error carries `httpStatus` so the Express handler
//    in routes/analysis.js can return a proper status code without
//    needing a giant switch on the cause string.
// ---------------------------------------------------------------

export class GeminiConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = "GeminiConfigError";
        this.httpStatus = 500; // misconfiguration on the server side
        this.code = "GEMINI_CONFIG_ERROR";
    }
}

export class GeminiInputError extends Error {
    constructor(message) {
        super(message);
        this.name = "GeminiInputError";
        this.httpStatus = 400;
        this.code = "GEMINI_INPUT_ERROR";
    }
}

/**
 * Upstream returned a 401/403 — likely an invalid API key.
 */
export class GeminiAuthError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "GeminiAuthError";
        this.httpStatus = 401;
        this.code = "GEMINI_AUTH_ERROR";
        this.cause = cause;
    }
}

/**
 * Upstream returned 429 — quota / rate limit.
 */
export class GeminiQuotaError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "GeminiQuotaError";
        this.httpStatus = 429;
        this.code = "GEMINI_QUOTA_ERROR";
        this.cause = cause;
    }
}

/**
 * Request to Gemini timed out (configurable via GEMINI_TIMEOUT_MS).
 */
export class GeminiTimeoutError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "GeminiTimeoutError";
        this.httpStatus = 504;
        this.code = "GEMINI_TIMEOUT";
        this.cause = cause;
    }
}

/**
 * Gemini returned 2xx but we couldn't parse valid JSON from the body.
 * The caller can choose to fall back to OCR or surface a 502.
 */
export class GeminiInvalidJsonError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "GeminiInvalidJsonError";
        this.httpStatus = 502;
        this.code = "GEMINI_INVALID_JSON";
        this.cause = cause;
    }
}

/**
 * Catch-all for unexpected upstream failures (5xx, network drop, etc.).
 */
export class GeminiApiError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "GeminiApiError";
        this.httpStatus = 502;
        this.code = "GEMINI_API_ERROR";
        this.cause = cause;
    }
}

// ---------------------------------------------------------------
// 7. Public API
// ---------------------------------------------------------------

/**
 * Build the multimodal `contents` payload for the Gemini call.
 * Accepts either `{ imagePath }` or `{ base64, mimeType }`.
 */
function buildImageInput({ imagePath, base64, mimeType }) {
    if (imagePath) {
        const resolvedMime = mimeType || mimeFromPath(imagePath);
        if (!ALLOWED_MIME_TYPES.has(resolvedMime)) {
            throw new GeminiInputError(
                `Unsupported image MIME type: ${resolvedMime}. ` +
                `Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`
            );
        }
        return {
            inlineData: {
                mimeType: resolvedMime,
                data: fileToBase64(imagePath),
            },
        };
    }

    if (base64) {
        let resolvedMime = mimeType;
        let resolvedData = base64;

        // Accept either a raw base64 string or a full data URL.
        const stripped = stripDataUrlPrefix(base64);
        if (stripped) {
            resolvedMime = resolvedMime || stripped.mimeType;
            resolvedData = stripped.data;
        } else {
            resolvedMime = resolvedMime || "image/jpeg";
        }

        if (!ALLOWED_MIME_TYPES.has(resolvedMime)) {
            throw new GeminiInputError(
                `Unsupported image MIME type: ${resolvedMime}. ` +
                `Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`
            );
        }

        return {
            inlineData: {
                mimeType: resolvedMime,
                data: resolvedData,
            },
        };
    }

    throw new GeminiInputError(
        "No image provided. Pass either `{ imagePath }` or `{ base64, mimeType }`."
    );
}

/**
 * Extract structured medicine data from a prescription image using Gemini.
 *
 * @param {Object}  options
 * @param {String} [options.imagePath]   Absolute path to an image file on disk.
 * @param {String} [options.base64]      Base64-encoded image (raw or data URL).
 * @param {String} [options.mimeType]    Image MIME type. Inferred if omitted.
 * @param {String} [options.model]       Override the Gemini model (default: gemini-2.5-flash).
 * @param {String} [options.userPrompt]  Optional extra instructions for this call.
 *
 * @returns {Promise<Object>} A normalized object:
 *   {
 *     document_type: string,
 *     patient_info:  { name, age, gender },
 *     medicines:     [{ name, generic_name, dosage, frequency, duration, instructions }],
 *     raw_text:      string,
 *     confidence:    number,
 *     warnings:      string[]
 *   }
 *
 * @throws {GeminiConfigError}  when the API key is missing.
 * @throws {GeminiInputError}  when the image input is invalid.
 * @throws {GeminiApiError}    when the Gemini call itself fails.
 */
export async function extractMedicinesFromPrescription(options = {}) {
    if (!ai) {
        throw new GeminiConfigError(
            "GEMINI_API_KEY is not configured. Set it in server/.env before calling this service."
        );
    }

    // Build multimodal input. Throws GeminiInputError on bad input
    // (missing file, unreadable file, empty file, oversized file,
    // unsupported MIME).
    const imagePart = buildImageInput(options);

    const model = options.model || GEMINI_MODEL;
    const userPrompt =
        options.userPrompt ||
        "Read this handwritten prescription and return only the JSON specified in the system instructions.";

    // Race the SDK call against a timeout. If the timeout wins, reject
    // with a GeminiTimeoutError; classifySdkError() will then translate
    // any AbortError the SDK may surface into the same typed error.
    let ac; // AbortController — referenced by the cleanup closure.
    try {
        ac = new AbortController();
        const sdkCall = ai.models.generateContent({
            model,
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: userPrompt },
                        imagePart,
                    ],
                },
            ],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: PRESCRIPTION_RESPONSE_SCHEMA,
                temperature: 0.1, // low temperature for deterministic extraction
                maxOutputTokens: 2048,
            },
        });

        const response = await withTimeout(
            sdkCall,
            GEMINI_TIMEOUT_MS,
            () => { try { ac && ac.abort && ac.abort(); } catch (_) {} }
        );

        // The SDK gives us a convenience `.text` property that returns
        // the model's text output. With responseMimeType=application/json
        // this is a JSON string matching the schema above.
        const rawText = response?.text?.trim?.() || "";

        if (!rawText) {
            // The model may have refused or returned an empty payload.
            // Treat as "no medicines found" rather than throwing.
            return { medicines: [] };
        }

        // The model is asked for application/json, but in practice it
        // can wrap the payload in code fences or add prose. Strip the
        // most common wrappers before parsing.
        const stripped = stripJsonWrappers(rawText);

        let parsed;
        let parseErr;
        try {
            parsed = JSON.parse(stripped);
        } catch (e1) {
            parseErr = e1;
            // Last-ditch: try to extract the first {...} block.
            const recovered = recoverJsonObject(stripped);
            if (recovered) {
                try {
                    parsed = JSON.parse(recovered);
                    parseErr = null;
                } catch (_e2) {
                    // fall through; parseErr stays set
                }
            }
        }

        if (!parsed) {
            // Could not parse a usable object. If the caller asked for
            // strict behavior, surface a typed error so the route can
            // fall back. Default: silently return an empty list.
            if (options.strictJson) {
                throw new GeminiInvalidJsonError(
                    "Gemini returned a non-JSON response that could not be recovered.",
                    parseErr || undefined
                );
            }
            return { medicines: [] };
        }

        // Normalize / guard the response so the rest of the app can
        // rely on the shape.
        return normalizeResponse(parsed);
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
        // Anything else (including unknown SDK errors) gets classified.
        classifySdkError(err);
    }
}

/**
 * Normalize and validate the parsed Gemini response so the shape is
 * always predictable for downstream callers.
 *
 * Strict output contract:
 *   {
 *     medicines: [
 *       {
 *         name: string,
 *         generic_name: string,
 *         confidence: "high" | "medium" | "low",
 *         dosage: string,
 *       }
 *     ]
 *   }
 *
 * `generic_name` is the API/generic/salt name (e.g. "Paracetamol",
 * "Amoxicillin + Clavulanic Acid") that downstream code uses to look
 * up alternatives in the medicine DB even when the brand name does
 * not fuzzy-match any local entry.
 */
function normalizeResponse(parsed) {
    const safeArray = (v) => (Array.isArray(v) ? v : []);

    const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

    const medicines = safeArray(parsed.medicines).map((m) => {
        const name = typeof m?.name === "string" ? m.name.trim() : "";
        const generic_name =
            typeof m?.generic_name === "string" ? m.generic_name.trim() : "";
        const dosage = typeof m?.dosage === "string" ? m.dosage.trim() : "";

        let confidence =
            typeof m?.confidence === "string"
                ? m.confidence.trim().toLowerCase()
                : "";
        if (!VALID_CONFIDENCE.has(confidence)) {
            // If the model returns anything unexpected, downgrade to "low".
            confidence = name ? "medium" : "low";
        }

        return { name, generic_name, confidence, dosage };
    });

    return { medicines };
}

/**
 * Extract a structured analysis of a medical/lab report image using Gemini.
 *
 * Uses the dedicated `LAB_REPORT_RESPONSE_SCHEMA` and `LAB_REPORT_SYSTEM_INSTRUCTION`
 * so the model compares every parameter against its standard reference range,
 * identifies abnormal findings, lists possible problems, and recommends
 * concrete to-do / not-to-do actions.
 *
 * Same input contract as `extractMedicinesFromPrescription`:
 *   { imagePath }  OR  { base64, mimeType }
 * Same Gemini error types are raised (GeminiConfigError, GeminiInputError,
 * GeminiAuthError, GeminiQuotaError, GeminiTimeoutError,
 * GeminiInvalidJsonError, GeminiApiError).
 *
 * Returns the normalized report:
 *   {
 *     report_type: string,
 *     patient_info: { name, age, gender, date },
 *     findings:          [{ name, value, unit, ref_range, status, note }],
 *     abnormal_findings: [{ name, value, unit, ref_range, status, note }],
 *     problems:   string[],
 *     todolist:   string[],
 *     dontdolist: string[],
 *     overall_assessment: string,
 *     confidence: "high"|"medium"|"low",
 *     warnings:   string[],
 *   }
 */
export async function extractLabReportAnalysis(options = {}) {
    if (!ai) {
        throw new GeminiConfigError(
            "GEMINI_API_KEY is not configured. Set it in server/.env before calling this service."
        );
    }

    const imagePart = buildImageInput(options);
    const model = options.model || GEMINI_MODEL;
    const userPrompt =
        options.userPrompt ||
        "Analyze this medical lab report and return only the JSON specified in the system instructions.";

    let ac;
    try {
        ac = new AbortController();
        const sdkCall = ai.models.generateContent({
            model,
            contents: [
                {
                    role: "user",
                    parts: [{ text: userPrompt }, imagePart],
                },
            ],
            config: {
                systemInstruction: LAB_REPORT_SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: LAB_REPORT_RESPONSE_SCHEMA,
                temperature: 0.1,
                maxOutputTokens: 4096,
            },
        });

        const response = await withTimeout(
            sdkCall,
            GEMINI_TIMEOUT_MS,
            () => { try { ac && ac.abort && ac.abort(); } catch (_) {} }
        );

        const rawText = response?.text?.trim?.() || "";
        if (!rawText) {
            return normalizeLabReportResponse({});
        }

        const stripped = stripJsonWrappers(rawText);

        let parsed;
        let parseErr;
        try {
            parsed = JSON.parse(stripped);
        } catch (e1) {
            parseErr = e1;
            const recovered = recoverJsonObject(stripped);
            if (recovered) {
                try {
                    parsed = JSON.parse(recovered);
                    parseErr = null;
                } catch (_e2) {
                    // fall through
                }
            }
        }

        if (!parsed) {
            if (options.strictJson) {
                throw new GeminiInvalidJsonError(
                    "Gemini returned a non-JSON response that could not be recovered.",
                    parseErr || undefined
                );
            }
            return normalizeLabReportResponse({});
        }

        return normalizeLabReportResponse(parsed);
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
        classifySdkError(err);
    }
}

/**
 * Normalize and validate a parsed lab-report Gemini response so the shape
 * is always predictable for downstream callers (and the frontend).
 */
function normalizeLabReportResponse(parsed) {
    const safeArray = (v) => (Array.isArray(v) ? v : []);
    const safeString = (v) => (typeof v === "string" ? v.trim() : "");
    const VALID_STATUS = new Set(["normal", "low", "high", "borderline", "unknown"]);
    const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

    const normalizeFinding = (f) => {
        const name      = safeString(f?.name);
        const value     = safeString(f?.value);
        const unit      = safeString(f?.unit);
        const ref_range = safeString(f?.ref_range);
        let status      = safeString(f?.status).toLowerCase();
        if (!VALID_STATUS.has(status)) {
            status = name ? "unknown" : "unknown";
        }
        const note = safeString(f?.note);
        return { name, value, unit, ref_range, status, note };
    };

    const findings = safeArray(parsed.findings).map(normalizeFinding);
    const abnormal_findings = safeArray(parsed.abnormal_findings).map(normalizeFinding)
        // Drop "normal" rows from abnormal_findings even if the model
        // included them — keeps the list genuinely abnormal.
        .filter((f) => f.status === "low" || f.status === "high" || f.status === "borderline");

    const problems   = safeArray(parsed.problems).map(safeString).filter(Boolean);
    const todolist   = safeArray(parsed.todolist).map(safeString).filter(Boolean);
    const dontdolist = safeArray(parsed.dontdolist).map(safeString).filter(Boolean);
    const warnings   = safeArray(parsed.warnings).map(safeString).filter(Boolean);

    const patient_info = {
        name:   safeString(parsed?.patient_info?.name),
        age:    safeString(parsed?.patient_info?.age),
        gender: safeString(parsed?.patient_info?.gender),
        date:   safeString(parsed?.patient_info?.date),
    };

    let confidence = safeString(parsed?.confidence).toLowerCase();
    if (!VALID_CONFIDENCE.has(confidence)) confidence = "medium";

    return {
        report_type:       safeString(parsed?.report_type),
        patient_info,
        findings,
        abnormal_findings,
        problems,
        todolist,
        dontdolist,
        overall_assessment: safeString(parsed?.overall_assessment),
        confidence,
        warnings,
    };
}

// ---------------------------------------------------------------
// 8. Default export (convenience)
// ---------------------------------------------------------------

export default {
    extractMedicinesFromPrescription,
    extractLabReportAnalysis,
};
