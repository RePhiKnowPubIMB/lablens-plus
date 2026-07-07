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
    origin: process.env.CLIENT_URL || "http://localhost:5173",
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

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Server Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

app.listen(PORT, () => {
  console.log(`🩺 LabLens Plus server running on port ${PORT}`);
});
