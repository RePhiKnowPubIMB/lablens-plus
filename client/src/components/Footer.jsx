import { Microscope, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Microscope className="h-4 w-4 text-primary-600" />
            <span className="font-semibold text-gray-700">LabLens Plus</span>
            <span>— AI-Powered Medical Assistant for Bangladesh</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span>Built with</span>
            <Heart className="h-3 w-3 fill-red-500 text-red-500" />
            <span>for Doridro AI Hackathon 2026</span>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-center text-xs text-amber-700">
          <strong>Disclaimer:</strong> LabLens Plus is an AI tool for informational purposes only.
          It is NOT a substitute for professional medical advice, diagnosis, or treatment.
          Always consult a qualified healthcare professional.
        </div>
      </div>
    </footer>
  );
}
