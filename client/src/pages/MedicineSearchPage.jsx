import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Pill,
  Loader2,
  ArrowRight,
  Tag,
  Building2,
  DollarSign,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { searchMedicine, getMedicineAdvice, findGenericAlternatives } from "../services/api.js";
import { Link } from "react-router-dom";

export default function MedicineSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(null);
  const [advice, setAdvice] = useState({});
  const [expandedGeneric, setExpandedGeneric] = useState(null);

  // Auto-search if query param is present
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q.length >= 2) {
      setQuery(q);
      handleSearch(q);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query;
    if (q.length < 2) {
      toast.error("Enter at least 2 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await searchMedicine(q);
      setResults(res.data || []);
      setSearchParams({ q });
      if (res.data?.length === 0) toast("No medicines found.", { icon: "🔍" });
    } catch (err) {
      toast.error("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGetAdvice = async (medicineName) => {
    setAdviceLoading(medicineName);
    try {
      const res = await getMedicineAdvice(medicineName);
      setAdvice((prev) => ({ ...prev, [medicineName]: res.data }));
    } catch (err) {
      toast.error("Could not fetch advice.");
    } finally {
      setAdviceLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">
          Medicine Search
        </h1>
        <p className="text-gray-500">
          Find generic alternatives, compare prices, and get AI-powered medicine advice
        </p>
      </div>

      {/* Search Bar */}
      <div className="mx-auto mb-8 max-w-2xl">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by medicine name (e.g., Napa, Seclo, Zimax)..."
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 pr-4 text-sm shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {results.map((med, idx) => (
          <div key={idx} className="card hover:shadow-md transition-shadow">
            {/* Medicine Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
                    <Pill className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{med.brand_name}</h3>
                    <p className="text-sm text-gray-500">{med.strength} • {med.form}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                  <FlaskConical className="h-3.5 w-3.5" />
                  {med.generic_name}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                  <Building2 className="h-3.5 w-3.5" />
                  {med.manufacturer}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                  <DollarSign className="h-3.5 w-3.5" />
                  ৳{med.price_bdt} / unit
                </span>
              </div>
            </div>

            {/* Generic Alternatives */}
            {med.alternatives?.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() =>
                    setExpandedGeneric(expandedGeneric === idx ? null : idx)
                  }
                  className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  <Tag className="h-4 w-4" />
                  {med.alternatives.length} Generic Alternative{med.alternatives.length > 1 ? "s" : ""} Available
                  {expandedGeneric === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expandedGeneric === idx && (
                  <div className="mt-3 rounded-xl bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Same Generic: {med.generic_name}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {med.alternatives.map((alt, j) => (
                        <div
                          key={j}
                          className="flex items-center justify-between rounded-lg bg-white p-3 border border-gray-100"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{alt.brand_name}</p>
                            <p className="text-xs text-gray-400">
                              {alt.manufacturer} • {alt.strength}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-emerald-600">
                              ৳{alt.price_bdt}
                            </span>
                            <Link
                              to={`/pharmacy?medicine=${encodeURIComponent(alt.brand_name)}`}
                              className="text-xs text-primary-600 hover:text-primary-700"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Advice Button */}
            <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={() => handleGetAdvice(med.brand_name)}
                disabled={adviceLoading === med.brand_name}
                className="btn-secondary text-xs"
              >
                {adviceLoading === med.brand_name ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Getting Advice...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> AI Advice</>
                )}
              </button>
              <Link
                to={`/pharmacy?medicine=${encodeURIComponent(med.brand_name)}`}
                className="btn-secondary text-xs"
              >
                Find in Pharmacy <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* AI Advice Display */}
            {advice[med.brand_name] && (
              <div className="mt-4 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 p-4">
                <h4 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                  <Sparkles className="h-4 w-4 text-primary-600" /> AI Advice for {med.brand_name}
                </h4>
                <p className="mb-2 text-xs text-gray-500">
                  Category: <span className="font-medium text-gray-700">{advice[med.brand_name].category}</span>
                </p>
                {advice[med.brand_name].common_uses?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Common Uses:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {advice[med.brand_name].common_uses.map((use, i) => (
                        <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-gray-600">{use}</span>
                      ))}
                    </div>
                  </div>
                )}
                {advice[med.brand_name].advice && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {advice[med.brand_name].advice.do?.length > 0 && (
                      <div>
                        <p className="font-medium text-green-700 mb-1">Do:</p>
                        <ul className="space-y-1 text-gray-600">
                          {advice[med.brand_name].advice.do.slice(0, 3).map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-green-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {advice[med.brand_name].advice.dont?.length > 0 && (
                      <div>
                        <p className="font-medium text-red-700 mb-1">Don't:</p>
                        <ul className="space-y-1 text-gray-600">
                          {advice[med.brand_name].advice.dont.slice(0, 3).map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-red-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {!loading && results.length === 0 && query.length === 0 && (
        <div className="mx-auto max-w-md text-center py-12">
          <Pill className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-lg font-medium text-gray-400">Search for a medicine</p>
          <p className="mt-1 text-sm text-gray-300">
            Try "Napa", "Seclo", "Zimax", or any Bangladeshi medicine brand
          </p>
        </div>
      )}
    </div>
  );
}
