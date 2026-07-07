import { useState, useRef, useCallback } from "react";
import {
  Upload,
  Camera,
  FileImage,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus,
  Pill,
  Activity,
  Heart,
  XCircle,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { analyzeDocument } from "../services/api.js";
import { Link } from "react-router-dom";

export default function ScanPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
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
    setResult(null);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await analyzeDocument(file);
      if (res.success) {
        setResult(res.data);
        toast.success("Analysis complete!");
      } else {
        throw new Error(res.error || "Analysis failed");
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
    setResult(null);
    setError(null);
    setShowRawText(false);
  };

  const statusIcon = (status) => {
    if (status === "high" || status === "critical") return <ArrowUp className="h-4 w-4 text-red-500" />;
    if (status === "low") return <ArrowDown className="h-4 w-4 text-blue-500" />;
    if (status === "normal") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const statusBadge = (status) => {
    const styles = {
      normal: "bg-green-100 text-green-700",
      high: "bg-red-100 text-red-700",
      low: "bg-blue-100 text-blue-700",
      critical: "bg-red-200 text-red-800 font-bold",
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-600"}`}>
        {statusIcon(status)}
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : "—"}
      </span>
    );
  };

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

      {/* Upload Section */}
      {!result && (
        <div className="mx-auto max-w-2xl">
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
                Drop your document here
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

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Analysis Complete</p>
                <p className="text-xs text-gray-400">
                  Document type: <span className="font-medium capitalize text-gray-600">{result.document_type?.replace("_", " ")}</span>
                  {result.confidence_score != null && (
                    <> • Confidence: <span className="font-medium text-gray-600">{Math.round(result.confidence_score * 100)}%</span></>
                  )}
                </p>
              </div>
            </div>
            <button onClick={resetScan} className="btn-secondary text-sm">
              Scan Another
            </button>
          </div>

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="font-semibold text-red-800">Important Warnings</p>
              </div>
              <ul className="ml-7 list-disc space-y-1 text-sm text-red-700">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Patient Info */}
          {result.patient_info && (result.patient_info.name || result.patient_info.age) && (
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                <Info className="h-4 w-4" /> Patient Information
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {result.patient_info.name && (
                  <div>
                    <p className="text-xs text-gray-400">Name</p>
                    <p className="font-medium text-gray-900">{result.patient_info.name}</p>
                  </div>
                )}
                {result.patient_info.age && (
                  <div>
                    <p className="text-xs text-gray-400">Age</p>
                    <p className="font-medium text-gray-900">{result.patient_info.age}</p>
                  </div>
                )}
                {result.patient_info.gender && (
                  <div>
                    <p className="text-xs text-gray-400">Gender</p>
                    <p className="font-medium capitalize text-gray-900">{result.patient_info.gender}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Health Summary */}
          {result.health_summary && (
            <div className="card border-l-4 border-l-primary-500">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
                <Heart className="h-5 w-5 text-primary-600" /> Health Summary
              </h3>
              <p className="leading-relaxed text-gray-600">{result.health_summary}</p>
            </div>
          )}

          {/* Extracted Items */}
          {result.extracted_items?.length > 0 && (
            <div className="card">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
                {result.document_type === "prescription" ? (
                  <><Pill className="h-5 w-5 text-purple-600" /> Prescribed Medicines</>
                ) : (
                  <><Activity className="h-5 w-5 text-blue-600" /> Extracted Results</>
                )}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-3 font-semibold text-gray-500">Name</th>
                      {result.document_type === "prescription" ? (
                        <>
                          <th className="pb-3 font-semibold text-gray-500">Generic Name</th>
                          <th className="pb-3 font-semibold text-gray-500">Dosage</th>
                          <th className="pb-3 font-semibold text-gray-500">Frequency</th>
                          <th className="pb-3 font-semibold text-gray-500">Duration</th>
                          <th className="pb-3 font-semibold text-gray-500">Action</th>
                        </>
                      ) : (
                        <>
                          <th className="pb-3 font-semibold text-gray-500">Value</th>
                          <th className="pb-3 font-semibold text-gray-500">Unit</th>
                          <th className="pb-3 font-semibold text-gray-500">Reference</th>
                          <th className="pb-3 font-semibold text-gray-500">Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.extracted_items.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">{item.name}</td>
                        {item.type === "medicine" ? (
                          <>
                            <td className="py-3 text-gray-600">{item.generic_name || "—"}</td>
                            <td className="py-3 text-gray-600">{item.dosage || "—"}</td>
                            <td className="py-3 text-gray-600">{item.frequency || "—"}</td>
                            <td className="py-3 text-gray-600">{item.duration || "—"}</td>
                            <td className="py-3">
                              {item.generic_name && (
                                <Link
                                  to={`/medicine?q=${encodeURIComponent(item.generic_name)}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 transition"
                                >
                                  Find Generic <ExternalLink className="h-3 w-3" />
                                </Link>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 font-mono text-gray-900">{item.value || "—"}</td>
                            <td className="py-3 text-gray-500">{item.unit || "—"}</td>
                            <td className="py-3 text-gray-400">{item.reference_range || "—"}</td>
                            <td className="py-3">{statusBadge(item.status)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Advice Section */}
          {result.advice && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {result.advice.do?.length > 0 && (
                <div className="card border-l-4 border-l-green-500">
                  <h4 className="mb-3 flex items-center gap-2 font-semibold text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> Do
                  </h4>
                  <ul className="space-y-2">
                    {result.advice.do.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.advice.dont?.length > 0 && (
                <div className="card border-l-4 border-l-red-500">
                  <h4 className="mb-3 flex items-center gap-2 font-semibold text-red-700">
                    <XCircle className="h-4 w-4" /> Don't
                  </h4>
                  <ul className="space-y-2">
                    {result.advice.dont.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.advice.diet?.length > 0 && (
                <div className="card border-l-4 border-l-orange-500">
                  <h4 className="mb-3 font-semibold text-orange-700">Diet Recommendations</h4>
                  <ul className="space-y-2">
                    {result.advice.diet.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.advice.lifestyle?.length > 0 && (
                <div className="card border-l-4 border-l-purple-500">
                  <h4 className="mb-3 font-semibold text-purple-700">Lifestyle Tips</h4>
                  <ul className="space-y-2">
                    {result.advice.lifestyle.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Raw Extracted Text (collapsible) */}
          {result.raw_extracted_text && (
            <div className="card">
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="flex w-full items-center justify-between text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <span>Raw Extracted Text</span>
                {showRawText ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showRawText && (
                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
                  {result.raw_extracted_text}
                </pre>
              )}
            </div>
          )}

          {/* Disclaimer */}
          {result.disclaimer && (
            <div className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-700">
              <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-500" />
              {result.disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
