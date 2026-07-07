import { Link } from "react-router-dom";
import {
  ScanLine,
  Pill,
  MapPin,
  Shield,
  Brain,
  Zap,
  ArrowRight,
  FileText,
  Stethoscope,
  Search,
} from "lucide-react";

const features = [
  {
    icon: ScanLine,
    title: "Smart Document Scanner",
    desc: "Upload a photo of any prescription or lab report — handwritten or printed. Our AI reads and extracts every detail.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: Brain,
    title: "AI Health Analysis",
    desc: "Get plain-language explanations of your lab results and medicines. Understand what's normal, what's not, and what to do.",
    color: "from-purple-500 to-pink-600",
  },
  {
    icon: Pill,
    title: "Generic Medicine Finder",
    desc: "Find affordable alternatives with the same formula. Compare prices across Bangladeshi pharmaceutical brands.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: MapPin,
    title: "Pharmacy Locator",
    desc: "Instantly find trusted online and local pharmacies in Bangladesh where you can purchase your medicines.",
    color: "from-orange-500 to-red-600",
  },
];

const steps = [
  { icon: FileText, step: "1", title: "Upload", desc: "Take a photo or upload your prescription/report" },
  { icon: Stethoscope, step: "2", title: "Analyze", desc: "AI extracts and interprets medical data" },
  { icon: Search, step: "3", title: "Discover", desc: "Find generic alternatives & nearby pharmacies" },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 pb-20 pt-16">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -left-4 top-20 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-accent-400 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
              <Zap className="h-4 w-4 text-yellow-400" />
              Powered by Google Gemini AI
            </div>
            <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Your AI-Powered
              <br />
              <span className="bg-gradient-to-r from-accent-300 to-accent-400 bg-clip-text text-transparent">
                Medical Assistant
              </span>
            </h1>
            <p className="mb-10 text-lg leading-relaxed text-primary-100 sm:text-xl">
              Upload prescriptions, understand lab reports, find affordable generic medicines,
              and locate trusted pharmacies — all in one place.
              Built for the people of Bangladesh.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/scan" className="btn-primary bg-white !text-primary-700 shadow-xl shadow-black/20 hover:bg-gray-100">
                <ScanLine className="h-5 w-5" />
                Scan Prescription
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/medicine" className="btn-secondary border-white/30 !text-white hover:bg-white/10">
                <Pill className="h-5 w-5" />
                Search Medicine
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-gray-900">
              How It Works
            </h2>
            <p className="text-gray-500">Three simple steps to better health understanding</p>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.step} className="relative text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
                  <s.icon className="h-7 w-7" />
                </div>
                <div className="absolute -top-2 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white shadow-lg">
                  {s.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-gray-900">
              Key Features
            </h2>
            <p className="text-gray-500">Everything you need to understand your health better</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="card group hover:shadow-md transition-shadow">
                <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${f.color} p-3 shadow-lg`}>
                  <f.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-r from-primary-50 to-accent-50 p-8 text-center">
            <Shield className="mx-auto mb-4 h-10 w-10 text-primary-600" />
            <h3 className="mb-2 text-xl font-bold text-gray-900">Your Privacy Matters</h3>
            <p className="mx-auto max-w-xl text-sm text-gray-600">
              We do not store your medical documents or personal health data.
              All analysis is performed in real-time and results are only shown to you.
              Your images are never saved on our servers.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
