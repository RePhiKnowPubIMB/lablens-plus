/**
 * Hardcoded Bangladeshi Medicine Database
 * This is the "fake database" for the hackathon MVP.
 * In production, this would come from DGDA (Directorate General of Drug Administration) API.
 *
 * Each entry has: brand_name, generic_name, strength, form, manufacturer, price_bdt
 */
export const medicineDB = [
  // === PARACETAMOL ===
  { brand_name: "Napa", generic_name: "Paracetamol", strength: "500mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 1.2 },
  { brand_name: "Napa Extra", generic_name: "Paracetamol + Caffeine", strength: "500mg+65mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 3.0 },
  { brand_name: "Ace", generic_name: "Paracetamol", strength: "500mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 1.1 },
  { brand_name: "Ace Plus", generic_name: "Paracetamol + Caffeine", strength: "500mg+65mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 3.0 },
  { brand_name: "Fast", generic_name: "Paracetamol", strength: "500mg", form: "Tablet", manufacturer: "ACI Ltd", price_bdt: 1.0 },
  { brand_name: "Renova", generic_name: "Paracetamol", strength: "500mg", form: "Tablet", manufacturer: "Renata Ltd", price_bdt: 1.2 },
  { brand_name: "Xcel", generic_name: "Paracetamol", strength: "500mg", form: "Tablet", manufacturer: "Incepta Pharma", price_bdt: 1.0 },
  { brand_name: "Tylenol", generic_name: "Paracetamol", strength: "500mg", form: "Tablet", manufacturer: "Johnson & Johnson", price_bdt: 12.0 },

  // === OMEPRAZOLE / ESOMEPRAZOLE (ANTACIDS) ===
  { brand_name: "Seclo", generic_name: "Omeprazole", strength: "20mg", form: "Capsule", manufacturer: "Square Pharma", price_bdt: 6.0 },
  { brand_name: "Losectil", generic_name: "Omeprazole", strength: "20mg", form: "Capsule", manufacturer: "Beximco Pharma", price_bdt: 5.5 },
  { brand_name: "Proceptin", generic_name: "Omeprazole", strength: "20mg", form: "Capsule", manufacturer: "Incepta Pharma", price_bdt: 5.0 },
  { brand_name: "Sergel", generic_name: "Esomeprazole", strength: "20mg", form: "Capsule", manufacturer: "Square Pharma", price_bdt: 8.0 },
  { brand_name: "Maxpro", generic_name: "Esomeprazole", strength: "20mg", form: "Capsule", manufacturer: "Renata Ltd", price_bdt: 8.0 },
  { brand_name: "Nexium", generic_name: "Esomeprazole", strength: "20mg", form: "Capsule", manufacturer: "AstraZeneca", price_bdt: 25.0 },
  { brand_name: "Esonix", generic_name: "Esomeprazole", strength: "20mg", form: "Capsule", manufacturer: "Beximco Pharma", price_bdt: 7.5 },

  // === ANTIBIOTICS ===
  { brand_name: "Zimax", generic_name: "Azithromycin", strength: "500mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 30.0 },
  { brand_name: "Azith", generic_name: "Azithromycin", strength: "500mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 28.0 },
  { brand_name: "Azithrocin", generic_name: "Azithromycin", strength: "500mg", form: "Tablet", manufacturer: "ACI Ltd", price_bdt: 25.0 },
  { brand_name: "Cef-3", generic_name: "Cefixime", strength: "200mg", form: "Capsule", manufacturer: "Square Pharma", price_bdt: 22.0 },
  { brand_name: "Cefim", generic_name: "Cefixime", strength: "200mg", form: "Capsule", manufacturer: "Beximco Pharma", price_bdt: 20.0 },
  { brand_name: "Cefix", generic_name: "Cefixime", strength: "200mg", form: "Capsule", manufacturer: "Incepta Pharma", price_bdt: 18.0 },
  { brand_name: "Cephacid", generic_name: "Cefixime", strength: "200mg", form: "Capsule", manufacturer: "Aristopharma", price_bdt: 19.0 },
  { brand_name: "Moxacil", generic_name: "Amoxicillin", strength: "500mg", form: "Capsule", manufacturer: "Square Pharma", price_bdt: 5.0 },
  { brand_name: "Tycil", generic_name: "Amoxicillin", strength: "500mg", form: "Capsule", manufacturer: "Beximco Pharma", price_bdt: 4.5 },
  { brand_name: "Fimoxyl", generic_name: "Amoxicillin", strength: "500mg", form: "Capsule", manufacturer: "Incepta Pharma", price_bdt: 4.5 },
  { brand_name: "Ciprox", generic_name: "Ciprofloxacin", strength: "500mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 8.0 },
  { brand_name: "Ciprocin", generic_name: "Ciprofloxacin", strength: "500mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 7.0 },

  // === BLOOD PRESSURE ===
  { brand_name: "Amdocal", generic_name: "Amlodipine", strength: "5mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 3.0 },
  { brand_name: "Amlopin", generic_name: "Amlodipine", strength: "5mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 3.0 },
  { brand_name: "Amlovas", generic_name: "Amlodipine", strength: "5mg", form: "Tablet", manufacturer: "Incepta Pharma", price_bdt: 2.5 },
  { brand_name: "Losartan", generic_name: "Losartan Potassium", strength: "50mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 6.0 },
  { brand_name: "Losar", generic_name: "Losartan Potassium", strength: "50mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 5.5 },
  { brand_name: "Anazid", generic_name: "Losartan Potassium", strength: "50mg", form: "Tablet", manufacturer: "ACI Ltd", price_bdt: 5.0 },

  // === DIABETES ===
  { brand_name: "Daonil", generic_name: "Metformin HCl", strength: "500mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 3.0 },
  { brand_name: "Comet", generic_name: "Metformin HCl", strength: "500mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 3.0 },
  { brand_name: "Informet", generic_name: "Metformin HCl", strength: "500mg", form: "Tablet", manufacturer: "Incepta Pharma", price_bdt: 2.5 },
  { brand_name: "Sugamet", generic_name: "Metformin HCl", strength: "500mg", form: "Tablet", manufacturer: "Renata Ltd", price_bdt: 2.5 },
  { brand_name: "Glimep", generic_name: "Glimepiride", strength: "2mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 6.0 },

  // === ALLERGY / ANTIHISTAMINE ===
  { brand_name: "Fexo", generic_name: "Fexofenadine", strength: "120mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 8.0 },
  { brand_name: "Fixal", generic_name: "Fexofenadine", strength: "120mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 7.5 },
  { brand_name: "Telfast", generic_name: "Fexofenadine", strength: "120mg", form: "Tablet", manufacturer: "Sanofi", price_bdt: 18.0 },
  { brand_name: "Monas", generic_name: "Montelukast", strength: "10mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 12.0 },
  { brand_name: "Montec", generic_name: "Montelukast", strength: "10mg", form: "Tablet", manufacturer: "Incepta Pharma", price_bdt: 10.0 },
  { brand_name: "Tofen", generic_name: "Ketotifen", strength: "1mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 3.0 },
  { brand_name: "Zaditen", generic_name: "Ketotifen", strength: "1mg", form: "Tablet", manufacturer: "Novartis", price_bdt: 15.0 },
  { brand_name: "Histacin", generic_name: "Chlorpheniramine", strength: "4mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 1.0 },

  // === PAIN / NSAID ===
  { brand_name: "Toricel", generic_name: "Ketorolac", strength: "10mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 5.0 },
  { brand_name: "Keto-R", generic_name: "Ketorolac", strength: "10mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 4.5 },
  { brand_name: "Clofenac", generic_name: "Diclofenac Sodium", strength: "50mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 2.5 },
  { brand_name: "Voltalin", generic_name: "Diclofenac Sodium", strength: "50mg", form: "Tablet", manufacturer: "Novartis", price_bdt: 10.0 },
  { brand_name: "Naprox", generic_name: "Naproxen", strength: "250mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 5.0 },
  { brand_name: "Sonap", generic_name: "Naproxen", strength: "250mg", form: "Tablet", manufacturer: "ACI Ltd", price_bdt: 4.5 },

  // === VITAMINS / SUPPLEMENTS ===
  { brand_name: "Calbo-D", generic_name: "Calcium + Vitamin D3", strength: "500mg+200IU", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 7.0 },
  { brand_name: "Acical-D", generic_name: "Calcium + Vitamin D3", strength: "500mg+200IU", form: "Tablet", manufacturer: "ACI Ltd", price_bdt: 6.5 },
  { brand_name: "Oscal-D", generic_name: "Calcium + Vitamin D3", strength: "500mg+200IU", form: "Tablet", manufacturer: "Incepta Pharma", price_bdt: 6.0 },
  { brand_name: "Neurobion", generic_name: "Vitamin B Complex", strength: "B1+B6+B12", form: "Tablet", manufacturer: "Merck", price_bdt: 12.0 },
  { brand_name: "Nervex", generic_name: "Vitamin B Complex", strength: "B1+B6+B12", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 6.0 },
  { brand_name: "D-Rise", generic_name: "Cholecalciferol (Vitamin D3)", strength: "40000IU", form: "Capsule", manufacturer: "Square Pharma", price_bdt: 40.0 },

  // === GASTRIC / GI ===
  { brand_name: "Ranitid", generic_name: "Ranitidine", strength: "150mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 2.0 },
  { brand_name: "Neoceptin-R", generic_name: "Ranitidine", strength: "150mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 2.0 },
  { brand_name: "Pantonix", generic_name: "Pantoprazole", strength: "40mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 8.0 },
  { brand_name: "Panoral", generic_name: "Pantoprazole", strength: "40mg", form: "Tablet", manufacturer: "Incepta Pharma", price_bdt: 7.0 },
  { brand_name: "Domet", generic_name: "Domperidone", strength: "10mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 2.5 },

  // === ASTHMA ===
  { brand_name: "Salbinol", generic_name: "Salbutamol", strength: "2mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 1.5 },
  { brand_name: "Brodil", generic_name: "Salbutamol", strength: "100mcg/puff", form: "Inhaler", manufacturer: "Beximco Pharma", price_bdt: 120.0 },
  { brand_name: "Ventolin", generic_name: "Salbutamol", strength: "100mcg/puff", form: "Inhaler", manufacturer: "GSK", price_bdt: 250.0 },

  // === MENTAL HEALTH ===
  { brand_name: "Serotia", generic_name: "Sertraline", strength: "50mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 8.0 },
  { brand_name: "Serta", generic_name: "Sertraline", strength: "50mg", form: "Tablet", manufacturer: "Incepta Pharma", price_bdt: 7.0 },
  { brand_name: "Anxinil", generic_name: "Clonazepam", strength: "0.5mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 3.0 },

  // === THYROID ===
  { brand_name: "Tyrox", generic_name: "Levothyroxine Sodium", strength: "50mcg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 3.0 },
  { brand_name: "Thyrox", generic_name: "Levothyroxine Sodium", strength: "50mcg", form: "Tablet", manufacturer: "Renata Ltd", price_bdt: 3.0 },
  { brand_name: "Euthyrox", generic_name: "Levothyroxine Sodium", strength: "50mcg", form: "Tablet", manufacturer: "Merck", price_bdt: 15.0 },

  // === CHOLESTEROL ===
  { brand_name: "Lipicon", generic_name: "Atorvastatin", strength: "10mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 6.0 },
  { brand_name: "Atorva", generic_name: "Atorvastatin", strength: "10mg", form: "Tablet", manufacturer: "Incepta Pharma", price_bdt: 5.0 },
  { brand_name: "Tiginor", generic_name: "Atorvastatin", strength: "10mg", form: "Tablet", manufacturer: "Beximco Pharma", price_bdt: 5.5 },

  // === ANTI-FUNGAL ===
  { brand_name: "Flucan", generic_name: "Fluconazole", strength: "150mg", form: "Capsule", manufacturer: "Square Pharma", price_bdt: 40.0 },
  { brand_name: "Flugal", generic_name: "Fluconazole", strength: "150mg", form: "Capsule", manufacturer: "Beximco Pharma", price_bdt: 35.0 },

  // === IRON SUPPLEMENT ===
  { brand_name: "Ferogen", generic_name: "Ferrous Sulfate + Folic Acid", strength: "200mg+0.5mg", form: "Tablet", manufacturer: "Square Pharma", price_bdt: 3.0 },
  { brand_name: "Feron", generic_name: "Ferrous Sulfate + Folic Acid", strength: "200mg+0.5mg", form: "Tablet", manufacturer: "Incepta Pharma", price_bdt: 2.5 },
];
