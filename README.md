# LabLens Plus — AI-Powered Medical Assistant for Bangladesh

> Upload prescriptions, understand lab reports, find affordable generic medicines, and locate trusted pharmacies — all powered by Google Gemini AI.

## Track: A — Health & Society

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Google Gemini API key (free: https://aistudio.google.com/apikey)

### 1. Backend Server
```bash
cd lablens-plus/server
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
npm install
npm run dev   # Starts on port 5000
```

### 2. Frontend Client
```bash
cd lablens-plus/client
npm install
npm run dev   # Starts on port 5173 (proxies /api to :5000)
```

Open http://localhost:5173 in your browser.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Lucide Icons |
| Backend | Node.js + Express.js |
| AI Engine | Google Gemini 2.0 Flash (multimodal — handles OCR + analysis in one API call) |
| Medicine DB | Hardcoded JSON (70+ Bangladeshi medicines with generics) |
| Pharmacy Data | Curated list of 7 trusted BD pharmacies |
| Search | Fuse.js (fuzzy search for medicines) |

---

## Architecture

```
User uploads image
       │
       ▼
[React Frontend] ──POST /api/analysis/upload──▶ [Express Backend]
                                                       │
                                                       ▼
                                              [Gemini 2.0 Flash]
                                              (Image → OCR → JSON)
                                                       │
                                                       ▼
                                              Structured JSON Response
                                              (medicines, lab results,
                                               advice, warnings)
                                                       │
       ◀──────────── JSON response ───────────────────┘
       │
       ▼
[Results Display] ──▶ [Find Generic] ──▶ [Pharmacy Locator]
```

**Key Design Decision:** We send the image directly to Gemini 2.0 Flash as a multimodal input. The model handles OCR (reading handwriting/print) AND JSON structuring in a single API call. This eliminates the need for a separate OCR service (Tesseract, Google Vision API, etc.), saving both time and complexity.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analysis/upload` | Upload image file for AI analysis |
| POST | `/api/analysis/base64` | Send base64 image for analysis |
| GET | `/api/medicine/search?q=napa` | Fuzzy search medicines |
| GET | `/api/medicine/generic/:name` | Find all brands for a generic |
| POST | `/api/medicine/advice` | Get AI advice for a medicine |
| GET | `/api/pharmacy/list` | List all pharmacies |
| GET | `/api/pharmacy/search?medicine=X&location=Y` | Search pharmacies |
| GET | `/api/health` | Health check |

---

## 36-HOUR DEVELOPMENT ROADMAP

### Phase 1: Setup & Skeleton (Hours 1–3) ✅ DONE

| Task | Owner | Status |
|------|-------|--------|
| Initialize Vite + React + Tailwind project | Dev 1 | ✅ |
| Initialize Express server + routes skeleton | Dev 2 | ✅ |
| Get Gemini API key, test basic prompt | Dev 3 | ✅ |
| Set up project structure, Git repo | Dev 2 | ✅ |

### Phase 2: Core AI Integration (Hours 4–10)

| Task | Owner | Time |
|------|-------|------|
| Build the master system prompt (see below) | Dev 3 | 2h |
| Implement `/api/analysis/upload` with Gemini | Dev 2 | 2h |
| Build file upload UI + drag & drop | Dev 1 | 2h |
| Test with 5+ real prescription/report images | Dev 3 | 1h |
| Build results display component (tables, badges) | Dev 1 | 2h |
| Iterate on prompt to fix JSON edge cases | Dev 3 | 1h |

### Phase 3: Medicine DB & Pharmacy (Hours 10–16)

| Task | Owner | Time |
|------|-------|------|
| Expand medicine database (add 30+ more meds) | Dev 3 | 2h |
| Build medicine search page with fuzzy search | Dev 1 | 2h |
| Build pharmacy page with cards + search URLs | Dev 1 | 1h |
| Connect "Find Generic" from results → search page | Dev 2 | 1h |
| Add AI advice endpoint for individual medicines | Dev 2 | 1h |
| Add pharmacy data with real URLs | Dev 3 | 1h |

### Phase 4: UI Polish & Deployment (Hours 16–24)

| Task | Owner | Time |
|------|-------|------|
| Responsive design fixes (mobile) | Dev 1 | 2h |
| Loading states, error handling, toast messages | Dev 1 | 1h |
| Deploy backend to Render.com (free) | Dev 2 | 1h |
| Deploy frontend to Vercel (free) | Dev 2 | 1h |
| Record 3-5 min demo video | Dev 3 | 2h |
| Write 8-page PDF report | Dev 3 | 3h |
| Write 1-page Data Card | Dev 3 | 30min |
| Final testing on deployed URL | All | 1h |

---

## TASK DELEGATION

### Dev 1 — Frontend & UI (You need: React, Tailwind)
- All React pages and components
- File upload with drag & drop
- Results display (tables, advice cards, status badges)
- Medicine search page
- Pharmacy page
- Responsive design
- Loading/error states

### Dev 2 — Backend & Infrastructure (You need: Express, deployment)
- Express server setup and all API routes
- Multer file upload handling
- Gemini API integration (calling the model)
- Medicine search with Fuse.js
- Pharmacy routing logic
- CORS, error handling, environment config
- Deployment (Render + Vercel)

### Dev 3 — AI & Data (You need: prompt engineering, research)
- The master system prompt (most critical job!)
- Testing with 10+ real Bangladeshi prescriptions/reports
- Iterating on prompt to improve accuracy
- Expanding the medicine database
- Curating pharmacy data
- Demo video recording
- PDF report + Data Card writing

---

## DEPLOYMENT GUIDE (Free Platforms)

### Backend → Render.com (Free Tier)
1. Push your code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect GitHub repo, set root directory to `lablens-plus/server`
4. Build command: `npm install`
5. Start command: `node src/index.js`
6. Add environment variable: `GEMINI_API_KEY=your_key`
7. Add environment variable: `CLIENT_URL=https://your-frontend.vercel.app`
8. Deploy (takes 2-3 min)

### Frontend → Vercel (Free Tier)
1. Go to https://vercel.com → Import Project
2. Connect GitHub repo, set root directory to `lablens-plus/client`
3. Framework preset: Vite
4. Add environment variable: `VITE_API_URL=https://your-backend.onrender.com/api`
5. Deploy (takes 1-2 min)

### Alternative: Railway.app (both in one)
- Supports monorepos, free tier available
- Can run both frontend and backend from one repo

---

## THE MASTER PROMPT

The complete system prompt is in `server/src/services/geminiService.js`. Key design decisions:

1. **Single-shot multimodal**: Image goes directly to Gemini → it does OCR + structuring + advice in one call
2. **Strict JSON output**: `responseMimeType: "application/json"` forces Gemini to return valid JSON
3. **Low temperature (0.2)**: Medical data needs accuracy, not creativity
4. **Bangladesh context baked in**: Common BD medicine brands, prescription shorthand (1+0+1), Bengali language support
5. **Always includes disclaimer**: Legal protection

---

## CORNERS TO CUT (Hackathon Survival Guide)

### DO Hardcode:
- ✅ Medicine database (JSON, not MongoDB — saves 3+ hours)
- ✅ Pharmacy data (static list, not a dynamic scraper)
- ✅ No user authentication (rules say no login required)
- ✅ No image storage (process in memory, discard after response)

### DO NOT Skip:
- ❌ The system prompt quality (this IS your product)
- ❌ Error handling (judge WILL try weird inputs)
- ❌ Mobile responsiveness (judges often test on phones)
- ❌ The disclaimer (legal requirement for medical AI)

### Demo "Happy Path" Strategy:
1. Pre-test with 3-4 specific prescriptions/reports you KNOW work well
2. Use those exact images in your demo video
3. Keep backup screenshots of successful results in case the live API is slow during demo

---

## DATA CARD (for submission)

| Data/Model | Source | License |
|------------|--------|---------|
| Medicine Database | Manually curated from MedEx.com.bd, DGDA Bangladesh | Public domain |
| Pharmacy List | Manually curated from public websites | Public domain |
| AI Model | Google Gemini 2.0 Flash (via API) | Google AI Terms of Service |
| Prescription/Report Images | Team-sourced test images | Private/consent obtained |

---

## File Structure

```
lablens-plus/
├── client/                     # React frontend (Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── Footer.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── ScanPage.jsx       # Core: upload + results
│   │   │   ├── MedicineSearchPage.jsx
│   │   │   └── PharmacyPage.jsx
│   │   ├── services/
│   │   │   └── api.js             # Axios API calls
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css              # Tailwind + custom styles
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/                     # Express backend
│   ├── src/
│   │   ├── data/
│   │   │   ├── medicines.js       # 70+ BD medicines
│   │   │   └── pharmacies.js      # 7 trusted pharmacies
│   │   ├── routes/
│   │   │   ├── analysis.js        # POST /api/analysis/*
│   │   │   ├── medicine.js        # GET /api/medicine/*
│   │   │   └── pharmacy.js        # GET /api/pharmacy/*
│   │   ├── services/
│   │   │   └── geminiService.js   # AI engine + master prompt
│   │   └── index.js               # Express app entry
│   ├── .env.example
│   └── package.json
└── README.md
```
