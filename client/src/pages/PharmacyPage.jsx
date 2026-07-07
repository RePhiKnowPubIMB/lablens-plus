import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MapPin,
  Globe,
  Truck,
  ExternalLink,
  Search,
  ShieldCheck,
  Store,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { getPharmacies } from "../services/api.js";

export default function PharmacyPage() {
  const [searchParams] = useSearchParams();
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medicine, setMedicine] = useState(searchParams.get("medicine") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "");

  useEffect(() => {
    fetchPharmacies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPharmacies = async () => {
    setLoading(true);
    try {
      const res = await getPharmacies(medicine, location);
      setPharmacies(res.data || []);
    } catch (err) {
      toast.error("Failed to load pharmacies.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">
          Find a Pharmacy
        </h1>
        <p className="text-gray-500">
          Trusted online and retail pharmacies in Bangladesh
        </p>
      </div>

      {/* Filters */}
      <div className="mx-auto mb-8 max-w-2xl">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={medicine}
              onChange={(e) => setMedicine(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPharmacies()}
              placeholder="Medicine name (optional)..."
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 pr-4 text-sm shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">All Locations</option>
            <option value="Dhaka">Dhaka</option>
            <option value="Chittagong">Chittagong</option>
            <option value="Sylhet">Sylhet</option>
            <option value="Nationwide">Nationwide</option>
          </select>
          <button onClick={fetchPharmacies} className="btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
        {medicine && (
          <p className="mt-3 text-center text-sm text-gray-400">
            Showing pharmacies where you can buy <span className="font-semibold text-gray-700">{medicine}</span>
          </p>
        )}
      </div>

      {/* Pharmacy Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {pharmacies.map((pharmacy, idx) => (
            <div key={idx} className="card group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      pharmacy.type === "online"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {pharmacy.type === "online" ? (
                      <Globe className="h-6 w-6" />
                    ) : (
                      <Store className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{pharmacy.name}</h3>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        pharmacy.type === "online"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {pharmacy.type}
                    </span>
                  </div>
                </div>
                {pharmacy.trusted && (
                  <ShieldCheck className="h-5 w-5 text-green-500" title="Verified & Trusted" />
                )}
              </div>

              <p className="mt-3 text-sm text-gray-500">{pharmacy.description}</p>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>
                    <strong className="text-gray-700">Location:</strong> {pharmacy.location}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Truck className="h-4 w-4 text-gray-400" />
                  <span>
                    <strong className="text-gray-700">Delivery:</strong> {pharmacy.delivery}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-3 border-t border-gray-100 pt-4">
                <a
                  href={pharmacy.search_url || pharmacy.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex-1 text-xs"
                >
                  {medicine ? `Search "${medicine}"` : "Visit Website"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
