/**
 * Session Saves & Parameter Preservation System
 * 
 * Implements a client-side "save file" mechanism for search parameters and filters,
 * inspired by the Anonimizador integrity methodology (_textoHash / _sumarioHash).
 * Uses canonical parameter sorting and SHA-256 hashing to verify save file integrity.
 * Requires zero user accounts or server-side state.
 */

export interface SearchSessionSave {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    pathname: string;
    params: Record<string, string[]>;
    queryString: string;
    hash: string;
    summary: {
        queryText?: string;
        dateRange?: string;
        filterCount: number;
        filtersPreview: string[];
    };
}

export const STORAGE_KEY_SAVES = "jurisprudencia_saved_sessions_v1";
export const STORAGE_KEY_LAST = "jurisprudencia_last_session_v1";

/**
 * Deterministically canonicalize parameters into a sorted JSON string
 * so that hashes are 100% reproducible regardless of insertion or query order.
 */
export function canonicalizeParams(params: Record<string, string[]>): string {
    const sortedKeys = Object.keys(params).sort();
    const normalized: Record<string, string[]> = {};
    for (const key of sortedKeys) {
        normalized[key] = [...params[key]].sort();
    }
    return JSON.stringify(normalized);
}

/**
 * Compute SHA-256 hash string from canonical parameter representation.
 * Supports both browser Web Crypto API and Node.js crypto for unit tests.
 */
export async function computeParamsHash(params: Record<string, string[]>): Promise<string> {
    const canonical = canonicalizeParams(params);
    
    // 1. Browser Web Crypto API
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(canonical);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    // 2. Node.js Crypto (for SSR / Jest test environment)
    try {
        const crypto = await import("crypto");
        return crypto.createHash("sha256").update(canonical).digest("hex");
    } catch {
        // Fallback lightweight djb2-like string hash if crypto is completely unavailable
        let h = 0;
        for (let i = 0; i < canonical.length; i++) {
            h = (Math.imul(31, h) + canonical.charCodeAt(i)) | 0;
        }
        return `fb-${Math.abs(h).toString(16)}`;
    }
}

export type SearchParamsInput = URLSearchParams | { toString(): string } | string;

/**
 * Extract structured parameters from a URLSearchParams, ReadonlyURLSearchParams, or query string.
 */
export function parseSearchParamsToRecord(searchParams: SearchParamsInput): Record<string, string[]> {
    const rawString = (typeof searchParams === "string" ? searchParams : searchParams.toString()).replace(/^\?+/, "");
    const sp = new URLSearchParams(rawString);
    const record: Record<string, string[]> = {};
    
    for (const key of sp.keys()) {
        const cleanKey = key.replace(/^\?+/, "");
        const values = sp.getAll(key).filter(v => v !== null && v !== undefined && v !== "");
        if (values.length > 0) {
            record[cleanKey] = values;
        }
    }
    return record;
}

/**
 * Build human-readable visual summaries from query parameters.
 */
export function buildParamsSummary(params: Record<string, string[]>): SearchSessionSave["summary"] {
    const queryText = params["q"]?.[0] || undefined;
    
    const minDate = params["MinDate"]?.[0];
    const maxDate = params["MaxDate"]?.[0];
    let dateRange: string | undefined = undefined;
    if (minDate && maxDate) {
        dateRange = `${minDate} até ${maxDate}`;
    } else if (minDate) {
        dateRange = `A partir de ${minDate}`;
    } else if (maxDate) {
        dateRange = `Até ${maxDate}`;
    }

    const filtersPreview: string[] = [];
    let filterCount = 0;

    for (const [key, values] of Object.entries(params)) {
        if (key === "q" || key === "page" || key === "rpp" || key === "sort" || key === "MinDate" || key === "MaxDate") {
            continue;
        }
        for (const val of values) {
            filterCount++;
            if (filtersPreview.length < 5) {
                filtersPreview.push(`${key}: ${val}`);
            }
        }
    }

    return {
        queryText,
        dateRange,
        filterCount,
        filtersPreview,
    };
}

/**
 * Verify whether a saved session has not been corrupted or tampered with,
 * checking the parameters against the embedded SHA-256 hash.
 */
export async function verifySaveIntegrity(save: SearchSessionSave): Promise<boolean> {
    if (!save || !save.params || !save.hash) return false;
    const computed = await computeParamsHash(save.params);
    return computed === save.hash;
}

/**
 * Retrieve all user-saved search sessions from local storage.
 */
export function getSavedSessions(): SearchSessionSave[] {
    if (typeof window === "undefined" || !window.localStorage) return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY_SAVES);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            // Clean up any historical ?? bug from previously saved sessions
            const cleaned = parsed.map(item => {
                if (item && item.queryString) {
                    item.queryString = item.queryString.replace(/^\?+/, "?");
                }
                return item;
            });
            return cleaned.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        }
        return [];
    } catch (e) {
        console.warn("[session-saves] Failed to read saved sessions from localStorage:", e);
        return [];
    }
}

/**
 * Save current search parameters as a new named session slot.
 */
export async function saveSession(
    name: string | undefined,
    searchParams: SearchParamsInput,
    pathname: string = "/pesquisa"
): Promise<SearchSessionSave> {
    const cleanQs = (typeof searchParams === "string" ? searchParams : searchParams.toString()).replace(/^\?+/, "");
    const params = parseSearchParamsToRecord(cleanQs);
    const hash = await computeParamsHash(params);
    const summary = buildParamsSummary(params);

    const now = Date.now();
    const defaultName = summary.queryText 
        ? `Pesquisa: "${summary.queryText}"`
        : summary.filterCount > 0
            ? `Pesquisa (${summary.filterCount} filtro${summary.filterCount > 1 ? "s" : ""})`
            : `Pesquisa Geral`;

    const newSave: SearchSessionSave = {
        id: `save-${now}-${Math.random().toString(36).slice(2, 7)}`,
        name: (name && name.trim().length > 0) ? name.trim() : `${defaultName} (${new Date(now).toLocaleDateString("pt-PT")})`,
        createdAt: now,
        updatedAt: now,
        pathname,
        params,
        queryString: cleanQs ? `?${cleanQs}` : "",
        hash,
        summary,
    };

    if (typeof window !== "undefined" && window.localStorage) {
        try {
            const current = getSavedSessions();
            // Prepend new save
            const updated = [newSave, ...current.filter(s => s.id !== newSave.id)];
            window.localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(updated));
            window.dispatchEvent(new Event("juris-sessions-updated"));
        } catch (e) {
            console.error("[session-saves] Failed to save session to localStorage:", e);
        }
    }

    return newSave;
}

/**
 * Rename an existing saved session.
 */
export function updateSessionName(id: string, newName: string): boolean {
    if (typeof window === "undefined" || !window.localStorage) return false;
    try {
        const current = getSavedSessions();
        const item = current.find(s => s.id === id);
        if (!item) return false;
        item.name = newName.trim();
        item.updatedAt = Date.now();
        window.localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(current));
        window.dispatchEvent(new Event("juris-sessions-updated"));
        return true;
    } catch {
        return false;
    }
}

/**
 * Delete a saved session by ID.
 */
export function deleteSavedSession(id: string): boolean {
    if (typeof window === "undefined" || !window.localStorage) return false;
    try {
        const current = getSavedSessions();
        const updated = current.filter(s => s.id !== id);
        window.localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(updated));
        window.dispatchEvent(new Event("juris-sessions-updated"));
        return true;
    } catch {
        return false;
    }
}

/**
 * Retrieve the automatically preserved "Last Session".
 */
export function getLastSession(): SearchSessionSave | null {
    if (typeof window === "undefined" || !window.localStorage) return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY_LAST);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.queryString) {
            parsed.queryString = parsed.queryString.replace(/^\?+/, "?");
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Autosave the last search parameters silently (e.g. on navigation / page unload).
 */
export async function saveLastSession(
    searchParams: SearchParamsInput,
    pathname: string = "/pesquisa"
): Promise<void> {
    if (typeof window === "undefined" || !window.localStorage) return;
    const cleanQs = (typeof searchParams === "string" ? searchParams : searchParams.toString()).replace(/^\?+/, "");
    const params = parseSearchParamsToRecord(cleanQs);
    
    // Don't save empty/trivial sessions as last session
    if (Object.keys(params).length === 0) return;

    const hash = await computeParamsHash(params);
    const summary = buildParamsSummary(params);
    const now = Date.now();

    const lastSave: SearchSessionSave = {
        id: "last-session",
        name: "Última Sessão Aberta",
        createdAt: now,
        updatedAt: now,
        pathname,
        params,
        queryString: cleanQs ? `?${cleanQs}` : "",
        hash,
        summary,
    };

    try {
        window.localStorage.setItem(STORAGE_KEY_LAST, JSON.stringify(lastSave));
    } catch (e) {
        console.warn("[session-saves] Could not write last session:", e);
    }
}

/**
 * Export all saved sessions as a JSON file download.
 */
export function exportSavesToJsonFile(filename: string = "jurisprudencia_pesquisas_guardadas.json"): void {
    if (typeof window === "undefined") return;
    const saves = getSavedSessions();
    const payload = {
        version: "1.0",
        app: "nextjs-jurisprudencia",
        exportedAt: new Date().toISOString(),
        saves,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Import sessions from a JSON string (e.g. from an uploaded file).
 */
export async function importSavesFromJsonString(jsonString: string): Promise<{ imported: number; errors: number }> {
    try {
        const data = JSON.parse(jsonString);
        const candidates: SearchSessionSave[] = Array.isArray(data) ? data : (Array.isArray(data.saves) ? data.saves : []);
        if (candidates.length === 0) return { imported: 0, errors: 0 };

        let imported = 0;
        let errors = 0;
        const validSaves: SearchSessionSave[] = [];

        for (const candidate of candidates) {
            if (!candidate.params || typeof candidate.params !== "object") {
                errors++;
                continue;
            }
            // Ensure valid hash
            if (!candidate.hash) {
                candidate.hash = await computeParamsHash(candidate.params);
            }
            if (!candidate.id) {
                candidate.id = `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            }
            if (!candidate.name) {
                candidate.name = "Pesquisa Importada";
            }
            if (!candidate.summary) {
                candidate.summary = buildParamsSummary(candidate.params);
            }
            validSaves.push(candidate);
            imported++;
        }

        if (typeof window !== "undefined" && window.localStorage && validSaves.length > 0) {
            const current = getSavedSessions();
            const existingIds = new Set(current.map(s => s.id));
            const merged = [...validSaves.filter(s => !existingIds.has(s.id)), ...current];
            window.localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(merged));
            window.dispatchEvent(new Event("juris-sessions-updated"));
        }

        return { imported, errors };
    } catch (e) {
        console.error("[session-saves] Failed to parse imported JSON:", e);
        return { imported: 0, errors: 1 };
    }
}
