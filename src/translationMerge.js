/**
 * Merge Firestore translation overrides (dot-path keys) into default ar/en trees.
 */

export const TRANSLATION_OVERRIDES_DOC = ['admin_settings', 'translation_overrides'];

export function deepClone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(deepClone);
    const next = {};
    for (const [k, v] of Object.entries(value)) {
        next[k] = deepClone(v);
    }
    return next;
}

export function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[p];
    }
    return cur;
}

export function setByPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const p = parts[i];
        if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
        cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
}

export function collectLeafPaths(obj, prefix = '', out = new Set()) {
    if (!obj || typeof obj !== 'object') return out;
    for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            collectLeafPaths(v, path, out);
        } else {
            out.add(path);
        }
    }
    return out;
}

/**
 * @param {{ ar: object, en: object }} defaultSource same shape as i18n defaults
 * @param {Record<string, { ar?: string, en?: string }>} entries
 */
export function mergeTranslationOverrides(defaultSource, entries) {
    const ar = deepClone(defaultSource.ar);
    const en = deepClone(defaultSource.en);
    const safe = entries && typeof entries === 'object' ? entries : {};
    for (const [path, perLang] of Object.entries(safe)) {
        if (!perLang || typeof perLang !== 'object') continue;
        if (Object.prototype.hasOwnProperty.call(perLang, 'ar') && perLang.ar !== undefined) {
            setByPath(ar, path, perLang.ar);
        }
        if (Object.prototype.hasOwnProperty.call(perLang, 'en') && perLang.en !== undefined) {
            setByPath(en, path, perLang.en);
        }
    }
    return { ar, en };
}

/**
 * Build Firestore entries: only paths where ar/en differ from defaults.
 */
export function computeOverrideDiff(defaultSource, rows) {
    const entries = {};
    for (const row of rows) {
        const key = row.key;
        if (!key) continue;
        const defAr = getByPath(defaultSource.ar, key);
        const defEn = getByPath(defaultSource.en, key);
        const ar = row.ar;
        const en = row.en;
        const o = {};
        if (ar !== defAr) o.ar = ar;
        if (en !== defEn) o.en = en;
        if (Object.keys(o).length) entries[key] = o;
    }
    return entries;
}

export function unionLeafPaths(defaultSource) {
    const a = collectLeafPaths(defaultSource.ar);
    const b = collectLeafPaths(defaultSource.en);
    return Array.from(new Set([...a, ...b])).sort((x, y) => x.localeCompare(y));
}
