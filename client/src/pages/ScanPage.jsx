import { useState, useRef, useCallback } from "react";
import { useScan } from "../context/ScanContext.jsx";
import {
  Upload,
  Camera,
  FileImage,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pill,
  ExternalLink,
  Sparkles,
  Building2,
  FlaskConical,
  Stethoscope,
  ListChecks,
  Ban,
  Activity,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { analyzeDocument, analyzeMedicalReport } from "../services/api.js";
import { Link } from "react-router-dom";

/**
 * Two supported document types. The "type" maps to the API endpoint and
 * the renderer used for the result screen.
 *   - "prescription"  -> /api/analysis/upload (medicines)
 *   - "report"        -> /api/analysis/report  (lab report)
 */
const DOC_TYPES = {
  prescription: {
    id: "prescription",
    label: "Prescription",
    description: "Extract medicine names, dosages, and find affordable generics.",
    icon: Pill,
    accent: "from-purple-500 to-violet-600",
    ring: "ring-purple-200",
    bg: "bg-purple-50",
    text: "text-purple-700",
  },
  report: {
    id: "report",
    label: "Medical Report",
    description: "Identify abnormal lab values and get to-do / not-to-do advice.",
    icon: FlaskConical,
    accent: "from-emerald-500 to-teal-600",
    ring: "ring-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
};

export default function ScanPage() {
  // The analysis result lives in ScanContext so it survives navigating
  // away to /medicine or /pharmacy and back. Everything else (file,
  // preview, loading, error, docType chooser) is per-upload UI state
  // and stays local to this component.
  const { result, setResult, clearResult } = useScan();

  const [docType, setDocType] = useState(null); // "prescription" | "report"
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((selectedFile) => {
    if (!selectedFile) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(selectedFile.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image.");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB.");
      return;
    }
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    // Picking a new file invalidates the previously shown result — the
    // user is implicitly starting a new scan. Clear the context cache
    // so a stale card doesn't linger behind the upload form.
    clearResult();
    setError(null);
  }, [clearResult]);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const handleAnalyze = async () => {
    if (!file || !docType) return;
    setLoading(true);
    setError(null);
    clearResult();

    try {
      if (docType === "prescription") {
        const res = await analyzeDocument(file);
        if (res?.success) {
          setResult({ kind: "prescription", data: res });
          if (Array.isArray(res.medicines) && res.medicines.length > 0) {
            toast.success("Analysis complete!");
          } else {
            toast("No medicines could be detected from this image.", { icon: "ℹ️" });
          }
        } else {
          throw new Error(res?.error || "Analysis failed");
        }
      } else if (docType === "report") {
        const res = await analyzeMedicalReport(file);
        if (res?.success && res.report) {
          setResult({ kind: "report", data: res.report });
          toast.success("Report analysis complete!");
        } else {
          throw new Error(res?.error || "Analysis failed");
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Something went wrong.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setFile(null);
    setPreview(null);
    // Clear the context-cached result so "Scan Another" returns the
    // user to the type-chooser with a clean slate, exactly like before.
    clearResult();
    setError(null);
    setShowRawText(false);
  };

  const backToTypeChooser = () => {
    resetScan();
    setDocType(null);
  };

  // ----- Prescription helpers -----------------------------------------
  const confidenceStyles = {
    high:   { dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50", label: "High"   },
    medium: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Medium" },
    low:    { dot: "bg-red-500",   text: "text-red-700",   bg: "bg-red-50",   label: "Low"    },
  };
  const renderConfidence = (confidence) => {
    const c = confidenceStyles[confidence] || confidenceStyles.low;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full ${c.bg} px-2.5 py-0.5 text-xs font-medium ${c.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
        {c.label} confidence
      </span>
    );
  };

  // ----- Medical-report helpers ---------------------------------------
  const statusStyles = {
    normal:     { dot: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50",  label: "Normal"     },
    low:        { dot: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-50",   label: "Low"        },
    high:       { dot: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50",    label: "High"       },
    borderline: { dot: "bg-amber-500",  text: "text-amber-700",  bg: "bg-amber-50",  label: "Borderline" },
    unknown:    { dot: "bg-gray-400",   text: "text-gray-600",   bg: "bg-gray-100",  label: "Unknown"    },
  };
  const renderStatus = (status) => {
    const s = statusStyles[status] || statusStyles.unknown;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full ${s.bg} px-2.5 py-0.5 text-xs font-medium ${s.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  };

  const currentType = docType ? DOC_TYPES[docType] : null;
  const TypeIcon = currentType?.icon;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">
          Scan Medical Document
        </h1>
        <p className="text-gray-500">
          Upload a photo of your prescription or lab report for AI-powered analysis
        </p>
      </div>

      {/* Step 1: Document-type chooser */}
      {!docType && !result && (
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-gray-500">
            What are you uploading?
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.values(DOC_TYPES).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDocType(t.id)}
                  className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 ${t.ring}`}
                >
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${t.accent} text-white shadow-sm`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">{t.label}</h3>
                  <p className="text-sm text-gray-500">{t.description}</p>
                  <div className={`mt-4 inline-flex items-center text-sm font-medium ${t.text}`}>
                    Choose
                    <ExternalLink className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Upload (prescription or report) */}
      {docType && !result && (
        <div className="mx-auto max-w-2xl">
          {/* Type badge + back */}
          <div className="mb-4 flex items-center justify-between">
            <div className={`inline-flex items-center gap-2 rounded-full ${currentType.bg} ${currentType.text} px-3 py-1 text-xs font-semibold`}>
              {TypeIcon && <TypeIcon className="h-3.5 w-3.5" />}
              {currentType.label}
            </div>
            <button onClick={backToTypeChooser} className="text-sm text-gray-500 hover:text-gray-700">
              ← Change type
            </button>
          </div>

          {!preview ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`card cursor-pointer border-2 border-dashed p-12 text-center transition-all ${
                dragActive ? "dropzone-active" : "border-gray-300 hover:border-primary-400 hover:bg-primary-50/50"
              }`}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100">
                <Upload className="h-8 w-8 text-primary-600" />
              </div>
              <p className="mb-2 text-lg font-semibold text-gray-700">
                Drop your {currentType.label.toLowerCase()} here
              </p>
              <p className="mb-6 text-sm text-gray-400">
                or click to browse • JPEG, PNG, WebP • Max 10MB
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="btn-primary text-sm">
                  <FileImage className="h-4 w-4" />
                  Choose File
                </div>
                <div className="btn-secondary text-sm">
                  <Camera className="h-4 w-4" />
                  Take Photo
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="card">
              <div className="mb-4 overflow-hidden rounded-xl border border-gray-200">
                <img
                  src={preview}
                  alt="Uploaded document"
                  className="mx-auto max-h-96 object-contain"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{file.name}</span>
                  {" • "}
                  {(file.size / 1024).toFixed(0)} KB
                </div>
                <div className="flex gap-3">
                  <button onClick={resetScan} className="btn-secondary text-sm">
                    Change
                  </button>
                  <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="btn-primary text-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Analyze with AI
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="mt-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 animate-pulse-glow">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
              <p className="text-lg font-semibold text-gray-700">AI is reading your document...</p>
              <p className="text-sm text-gray-400">This may take 10-20 seconds</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="font-medium text-red-800">Analysis Failed</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Results */}
      {result && result.kind === "prescription" && (
        <PrescriptionResult
          data={result.data}
          renderConfidence={renderConfidence}
          onScanAnother={backToTypeChooser}
        />
      )}

      {result && result.kind === "report" && (
        <MedicalReportResult
          report={result.data}
          renderStatus={renderStatus}
          onScanAnother={backToTypeChooser}
        />
      )}
    </div>
  );
}

// =====================================================================
// Prescription result view (preserved from the original page)
// =====================================================================
function PrescriptionResult({ data, renderConfidence, onScanAnother }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Analysis Complete</p>
            <p className="text-xs text-gray-400">
              {data.medicines?.length > 0 ? (
                <>
                  Detected{" "}
                  <span className="font-medium text-gray-600">{data.medicines.length}</span>{" "}
                  medicine{data.medicines.length === 1 ? "" : "s"}
                </>
              ) : (
                "No medicines detected"
              )}
            </p>
          </div>
        </div>
        <button onClick={onScanAnother} className="btn-secondary text-sm">
          Scan Another
        </button>
      </div>

      {data.medicines?.length > 0 ? (
        <div className="space-y-4">
          {data.medicines.map((med, i) => {
            const isMatched = !!med.matchedMedicine;
            return (
              <div
                key={i}
                className={`card border-l-4 ${isMatched ? "border-l-purple-500" : "border-l-red-400"}`}
              >
                <dl className="divide-y divide-gray-100">
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="flex w-28 shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <Pill className="h-3.5 w-3.5 text-purple-500" />
                      Medicine
                    </dt>
                    <dd className="flex-1 text-right font-semibold text-gray-900">
                      {med.matchedMedicine || med.detectedName || "Unnamed"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">Generic</dt>
                    <dd className="flex-1 text-right font-medium text-gray-900">{med.generic || "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">Confidence</dt>
                    <dd className="flex-1 text-right">{renderConfidence(med.confidence)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">Alternative Medicines</dt>
                    <dd className="flex-1 text-right">
                      {isMatched && med.alternatives && med.alternatives.length > 0 ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {med.alternatives.map((alt, j) => (
                            <span key={j} className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                              {alt.brand}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="flex w-28 shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      Manufacturer
                    </dt>
                    <dd className="flex-1 text-right">
                      {isMatched && med.alternatives && med.alternatives.length > 0 ? (
                        <ul className="space-y-1">
                          {med.alternatives.map((alt, j) => (
                            <li key={j} className="text-sm font-medium text-gray-700">{alt.manufacturer || "—"}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="flex w-28 shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <span aria-hidden="true">৳</span>
                      Price
                    </dt>
                    <dd className="flex-1 text-right">
                      {isMatched && med.alternatives && med.alternatives.length > 0 ? (
                        <ul className="space-y-1">
                          {med.alternatives.map((alt, j) => (
                            <li key={j}>
                              {alt.price != null ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                  <span aria-hidden="true">৳</span>
                                  {alt.price}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
                {!isMatched && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-red-700">
                      <span className="font-semibold">Medicine Not Found:</span>{" "}
                      <span className="italic">"{med.detectedName || "this"}"</span>{" "}
                      couldn't be matched. Verify the spelling with your doctor.
                    </p>
                  </div>
                )}
                {((isMatched && med.generic) || med.generic) && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                    <Link
                      to={`/medicine?q=${encodeURIComponent(med.generic)}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 transition"
                    >
                      <Pill className="h-3 w-3" />
                      Find Alternative <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Link
                      to={`/pharmacy?medicine=${encodeURIComponent(
                        med.matchedMedicine || med.detectedName || med.generic
                      )}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                    >
                      <Building2 className="h-3 w-3" />
                      Find in Pharmacy <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold text-gray-900">Medicine Not Found</p>
              <p className="mt-1 text-sm text-gray-600">
                We couldn't detect any medicines in this image. Try a clearer photo
                with the prescription text fully visible, or check the spelling with
                your doctor.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-700">
        <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-500" />
        AI-generated results. Always verify medicines and dosages with a certified
        doctor or pharmacist before taking them.
      </div>
    </div>
  );
}

// =====================================================================
// Medical-report result view (new)
// =====================================================================
function MedicalReportResult({ report, renderStatus, onScanAnother }) {
  const {
    report_type = "",
    patient_info = {},
    findings = [],
    abnormal_findings = [],
    problems = [],
    todolist = [],
    dontdolist = [],
    overall_assessment = "",
    confidence = "medium",
    warnings = [],
  } = report || {};

  const confidenceStyles = {
    high:   "bg-green-50 text-green-700",
    medium: "bg-amber-50 text-amber-700",
    low:    "bg-red-50 text-red-700",
  };
  const confidenceLabel = `AI confidence: ${confidence}`;

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Report Analysis Complete</p>
            <p className="text-xs text-gray-400">
              {report_type || "Medical report"} • {findings.length} parameter{findings.length === 1 ? "" : "s"} read
            </p>
          </div>
        </div>
        <button onClick={onScanAnother} className="btn-secondary text-sm">
          Scan Another
        </button>
      </div>

      {/* Header card: report type + patient info + confidence */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Report Type
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {report_type || "Unidentified report"}
            </p>
            {(patient_info.name || patient_info.age || patient_info.gender || patient_info.date) && (
              <p className="mt-1 text-sm text-gray-500">
                {[
                  patient_info.name,
                  patient_info.age && `${patient_info.age}`,
                  patient_info.gender,
                  patient_info.date,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            )}
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${confidenceStyles[confidence] || confidenceStyles.medium}`}>
            <Info className="h-3 w-3" />
            {confidenceLabel}
          </span>
        </div>
      </div>

      {/* Abnormal findings (highlighted) */}
      {abnormal_findings.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Abnormal Findings ({abnormal_findings.length})
            </h2>
          </div>
          <div className="space-y-3">
            {abnormal_findings.map((f, i) => (
              <div key={i} className="card border-l-4 border-l-red-400">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{f.name || "Unnamed parameter"}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      <span className="font-medium">{f.value || "—"}</span>
                      {f.unit ? ` ${f.unit}` : ""}
                      {f.ref_range ? (
                        <span className="text-gray-400">
                          {" "}(ref: {f.ref_range})
                        </span>
                      ) : null}
                    </p>
                    {f.note && (
                      <p className="mt-1 text-xs text-gray-500">{f.note}</p>
                    )}
                  </div>
                  {renderStatus(f.status)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All findings table */}
      {findings.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              All Parameters ({findings.length})
            </h2>
          </div>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Parameter</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {findings.map((f, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium text-gray-900">{f.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {f.value || "—"}
                        {f.unit ? <span className="text-gray-400"> {f.unit}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{f.ref_range || "—"}</td>
                      <td className="px-4 py-3 text-right">{renderStatus(f.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Problems */}
      {problems.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-rose-600" />
            <h2 className="text-lg font-semibold text-gray-900">Possible Problems</h2>
          </div>
          <div className="card">
            <ul className="space-y-2 text-sm text-gray-800">
              {problems.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* To-do / Don't-do side by side */}
      {(todolist.length > 0 || dontdolist.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900">What to Do</h2>
            </div>
            {todolist.length > 0 ? (
              <div className="card">
                <ul className="space-y-2 text-sm text-gray-800">
                  {todolist.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="card text-sm text-gray-500">No recommendations.</div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">What Not to Do</h2>
            </div>
            {dontdolist.length > 0 ? (
              <div className="card">
                <ul className="space-y-2 text-sm text-gray-800">
                  {dontdolist.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="card text-sm text-gray-500">No restrictions noted.</div>
            )}
          </div>
        </section>
      )}

      {/* Overall assessment */}
      {overall_assessment && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Info className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Overall Assessment</h2>
          </div>
          <div className="card text-sm leading-relaxed text-gray-800">
            {overall_assessment}
          </div>
        </section>
      )}

      {/* Warnings (e.g. illegible values) */}
      {warnings.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Notes &amp; Caveats</h2>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <ul className="list-disc space-y-1 pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Empty-state when nothing came back */}
      {findings.length === 0 && abnormal_findings.length === 0 && !overall_assessment && (
        <div className="card border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold text-gray-900">No values detected</p>
              <p className="mt-1 text-sm text-gray-600">
                We couldn't read any lab values from this image. Try a clearer photo
                with the report text fully visible.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-700">
        <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-500" />
        AI-generated analysis. Always verify results and discuss treatment with a
        certified doctor before changing your medication, diet, or lifestyle.
      </div>
    </div>
  );
}
