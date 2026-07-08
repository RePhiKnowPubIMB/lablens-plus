import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import HomePage from "./pages/HomePage.jsx";
import ScanPage from "./pages/ScanPage.jsx";
import MedicineSearchPage from "./pages/MedicineSearchPage.jsx";
import PharmacyPage from "./pages/PharmacyPage.jsx";
import { ScanProvider } from "./context/ScanContext.jsx";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <ScanProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/medicine" element={<MedicineSearchPage />} />
            <Route path="/pharmacy" element={<PharmacyPage />} />
          </Routes>
        </ScanProvider>
      </main>
      <Footer />
    </div>
  );
}
