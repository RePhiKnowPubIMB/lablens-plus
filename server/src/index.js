import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { analysisRouter } from "./routes/analysis.js";
import { medicineRouter } from "./routes/medicine.js";
import { pharmacyRouter } from "./routes/pharmacy.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin:"lablens-plus-de7i.vercel.app",
    credentials: true,
  })
);
app.use(express.json({ limit: "20mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "LabLens Plus API", version: "1.0.0" });
});

// Routes
app.use("/api/analysis", analysisRouter);
app.use("/api/medicine", medicineRouter);
app.use("/api/pharmacy", pharmacyRouter);

// Global error handler — last line of defense for anything that escapes a
// route's try/catch. Honors the typed-error pattern used in routes/analysis.js:
//   - `err.httpStatus` from our typed errors (OcrEngineError, Gemini*, …)
//   - `err.status` from libraries that set it (multer, etc.)
//   - falls back to 500
// Also surfaces `err.code` in the response body so the client can branch
// on cause without having to string-match the message.
app.use((err, _req, res, _next) => {
  const status = Number(err?.httpStatus) || Number(err?.status) || 500;
  if (status >= 500) {
    console.error("Server Error:", err);
  } else {
    console.warn(`Server Error (${status}):`, err?.message);
  }
  res.status(status).json({
    success: false,
    error: err?.message || "Internal Server Error",
    code: err?.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
  });
});

app.listen(PORT, () => {
  console.log(`🩺 LabLens Plus server running on port ${PORT}`);
});
