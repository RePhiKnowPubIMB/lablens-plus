import { Router } from "express";
import multer from "multer";
import { analyzeDocument } from "../services/geminiService.js";

export const analysisRouter = Router();

// Store uploads in memory (we only need the buffer to send to Gemini)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WebP, GIF) and PDFs are allowed."));
    }
  },
});

/**
 * POST /api/analysis/upload
 * Accepts an image file of a prescription or lab report.
 * Returns structured AI analysis.
 */
analysisRouter.post("/upload", upload.single("document"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded." });
    }

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    console.log(`📄 Analyzing document: ${req.file.originalname} (${mimeType}, ${(req.file.size / 1024).toFixed(1)}KB)`);

    const analysis = await analyzeDocument(base64Image, mimeType);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Analysis error:", error.message);
    next(error);
  }
});

/**
 * POST /api/analysis/base64
 * Accepts a base64-encoded image string (for camera capture or paste).
 */
analysisRouter.post("/base64", async (req, res, next) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "No image data provided." });
    }

    // Strip data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const mime = mimeType || "image/jpeg";

    console.log(`📸 Analyzing base64 image (${mime})`);

    const analysis = await analyzeDocument(base64Data, mime);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Analysis error:", error.message);
    next(error);
  }
});
