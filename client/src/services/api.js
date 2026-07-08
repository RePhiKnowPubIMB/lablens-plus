import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60s timeout for AI processing
});

/**
 * Upload a document image for AI analysis
 */
export async function analyzeDocument(file) {
  const formData = new FormData();
  formData.append("document", file);
  const { data } = await api.post("/analysis/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * Analyze a base64-encoded image (from camera capture)
 */
export async function analyzeBase64(base64Image, mimeType = "image/jpeg") {
  const { data } = await api.post("/analysis/base64", { image: base64Image, mimeType });
  return data;
}

/**
 * Upload a medical/lab report image for AI analysis.
 * Returns { success, report: { report_type, findings, abnormal_findings,
 *   problems, todolist, dontdolist, overall_assessment, ... } }.
 */
export async function analyzeMedicalReport(file) {
  const formData = new FormData();
  formData.append("document", file);
  const { data } = await api.post("/analysis/report", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * Search medicines by name
 */
export async function searchMedicine(query) {
  const { data } = await api.get(`/medicine/search?q=${encodeURIComponent(query)}`);
  return data;
}

/**
 * Find all brands with a specific generic name
 */
export async function findGenericAlternatives(genericName) {
  const { data } = await api.get(`/medicine/generic/${encodeURIComponent(genericName)}`);
  return data;
}

/**
 * Get AI-powered advice for a specific medicine
 */
export async function getMedicineAdvice(medicineName) {
  const { data } = await api.post("/medicine/advice", { medicine_name: medicineName });
  return data;
}

/**
 * Get pharmacy list, optionally filtered by medicine and location
 */
export async function getPharmacies(medicine = "", location = "") {
  const params = new URLSearchParams();
  if (medicine) params.set("medicine", medicine);
  if (location) params.set("location", location);
  const { data } = await api.get(`/pharmacy/search?${params.toString()}`);
  return data;
}
