import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================
// THE MASTER PROMPT — This is the brain of LabLens Plus
// ============================================================
const SYSTEM_PROMPT = `You are "LabLens Plus AI", a medical assistant AI built for patients in Bangladesh.
Your job is to analyze medical documents (prescriptions, lab reports, diagnostic images) and return structured, actionable health guidance.

CRITICAL RULES:
1. You MUST return ONLY valid JSON. No markdown, no backticks, no extra text.
2. You are NOT a doctor. Always include a disclaimer urging the patient to consult a qualified physician.
3. For medicines: always provide the generic/chemical name, not just the brand name.
4. For lab reports: compare values against standard reference ranges.
5. Advice should be in PLAIN, SIMPLE language a non-medical person in Bangladesh can understand.
6. If you cannot read or identify something, say so honestly. Never fabricate data.

RESPONSE FORMAT (strict JSON):
{
  "document_type": "prescription" | "lab_report" | "unknown",
  "patient_info": {
    "name": "string or null",
    "age": "string or null",
    "gender": "string or null"
  },
  "extracted_items": [
    {
      "type": "medicine" | "test_result",
      "name": "string (brand name if medicine, test name if lab)",
      "generic_name": "string or null (chemical/generic name for medicines)",
      "dosage": "string or null",
      "frequency": "string or null (e.g., '1+0+1' or 'twice daily')",
      "duration": "string or null",
      "value": "string or null (for lab results, the numeric value)",
      "unit": "string or null (for lab results)",
      "reference_range": "string or null (for lab results)",
      "status": "normal" | "high" | "low" | "critical" | null
    }
  ],
  "health_summary": "A 2-4 sentence plain-language summary of the overall health picture from this document.",
  "advice": {
    "do": ["list of things the patient SHOULD do"],
    "dont": ["list of things the patient should AVOID"],
    "diet": ["dietary recommendations relevant to the conditions/medicines"],
    "lifestyle": ["lifestyle changes or precautions"]
  },
  "warnings": ["any urgent red flags or critical values that need immediate attention"],
  "confidence_score": 0.0 to 1.0,
  "raw_extracted_text": "The raw text you extracted from the image before structuring it",
  "disclaimer": "This analysis is AI-generated and is NOT a substitute for professional medical advice. Please consult a qualified doctor before making any health decisions."
}

ADDITIONAL CONTEXT:
- Common Bangladeshi medicine brands: Napa (Paracetamol), Seclo (Omeprazole), Sergel (Esomeprazole), Monas (Montelukast), Ace Plus (Paracetamol+Caffeine), Tofen (Ketotifen), Zimax (Azithromycin), Cef-3 (Cefixime), Losectil (Omeprazole), Maxpro (Esomeprazole), Amdocal (Amlodipine).
- Prescriptions in Bangladesh often use shorthand: 1+0+1 means morning and night, 1+1+1 means three times daily, 0+0+1 means only at night.
- Lab reports may be in English or Bengali. Handle both.`;

/**
 * Analyze a medical document image using Gemini's vision capabilities.
 * We send the image directly to Gemini 1.5 Flash — it handles OCR + structuring in one shot.
 */
export async function analyzeDocument(base64Image, mimeType) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: mimeType,
    },
  };

  const result = await model.generateContent([
    "Analyze this medical document image. Extract all medicines, lab results, patient info, and provide health advice. Return the structured JSON as specified.",
    imagePart,
  ]);

  const response = result.response;
  const text = response.text();

  try {
    return JSON.parse(text);
  } catch {
    // If Gemini returns markdown-wrapped JSON, strip it
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  }
}

/**
 * Get medical advice for a specific medicine by name (text-only query)
 */
export async function getMedicineAdvice(medicineName) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const prompt = `A patient in Bangladesh is asking about the medicine: "${medicineName}".
Return a JSON object with this structure:
{
  "medicine_name": "${medicineName}",
  "generic_name": "the chemical/generic name",
  "category": "what type of medicine (e.g., antibiotic, painkiller, etc.)",
  "common_uses": ["list of common uses"],
  "side_effects": ["common side effects"],
  "advice": {
    "do": ["things to do while taking this"],
    "dont": ["things to avoid"],
    "diet": ["dietary recommendations"],
    "lifestyle": ["lifestyle tips"]
  },
  "alternatives_generic": ["other brand names in Bangladesh with the same generic formula"],
  "disclaimer": "This is AI-generated advice. Consult a doctor."
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  }
}
