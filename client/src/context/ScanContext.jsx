import { createContext, useContext, useMemo, useState, useCallback } from "react";

/**
 * ScanContext
 * ---------------------------------------------------------------
 * Persists the *result* of a successful analysis across navigations.
 *
 * Why a context instead of component-local useState?
 *   <ScanPage /> unmounts whenever the user navigates to
 *   `/medicine` or `/pharmacy` (and back). Without an external store
 *   the just-fetched prescription / lab-report result would be lost
 *   the moment the user clicked "Find Alternative" or "Find in
 *   Pharmacy". The context keeps the result alive in the React
 *   tree (mounted above <Routes />) so it survives ScanPage unmounts.
 *
 * Storage rules:
 *   - We deliberately do NOT keep `file` / `previewUrl` / `loading`
 *     here. Those are tightly coupled to the per-upload form state
 *     and depend on browser-only APIs (URL.createObjectURL). Putting
 *     them in a context would just be extra work with no benefit,
 *     since the user can re-upload the image for free.
 *   - The result resets only when the user explicitly clicks
 *     "Scan Another", which prevents accidental overwrites (e.g.
 *     by clicking "Find Alternative", browsing a few pages, and
 *     coming back to a fresh blank page).
 */
const ScanContext = createContext(null);

export function ScanProvider({ children }) {
    // shape: { kind: "prescription" | "report", data: <api payload> } | null
    const [result, setResult] = useState(null);

    const clearResult = useCallback(() => setResult(null), []);

    const value = useMemo(
        () => ({ result, setResult, clearResult }),
        [result, clearResult]
    );

    return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

/**
 * Hook used by `ScanPage` and any future consumer that needs to read
 * or mutate the cached analysis result.
 *
 * Throws if used outside of <ScanProvider /> so we never silently
 * operate on `null` and lose a result.
 */
export function useScan() {
    const ctx = useContext(ScanContext);
    if (ctx === null) {
        throw new Error(
            "useScan() must be used inside <ScanProvider>. " +
            "Wrap <Routes /> with <ScanProvider> in App.jsx."
        );
    }
    return ctx;
}
