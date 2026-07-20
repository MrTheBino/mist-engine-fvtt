const TEXTUAL = 'input[type="text"], input[type="number"], input:not([type]), textarea';

/** Derive `{ "system.<array>": length }` for the lists on this sheet. */
function arrayLengths(sheet, root) {
    const lens = {};
    const note = (path, idx) => {
        if (!path || Number.isNaN(idx)) return;
        lens[path] = Math.max(lens[path] ?? 0, idx + 1);
    };
    // From the DOM rows — covers unmarked lists that already have >= 1 row.
    for (const el of root.querySelectorAll("[name]")) {
        const name = el.getAttribute("name");
        // object array: name="system.arr.<i>.<key>"  |  string array: name="system.arr.<i>"
        const m = name?.match(/^(.*)\.(\d+)\.[^.]+$/) ?? name?.match(/^(.*)\.(\d+)$/);
        if (m) note(m[1], parseInt(m[2]));
    }
    for (const el of root.querySelectorAll("[data-array][data-index]")) {
        const raw = el.dataset.array;
        note(raw.startsWith("system.") ? raw : `system.${raw}`, parseInt(el.dataset.index));
    }
    // For declared lists, always register a length (0 when the field is empty or
    // undefined — some models leave empty ArrayFields undefined). This makes a
    // 0 -> 1 add detectable and is stable across tab switches (marker stays in
    // the DOM). Max with the DOM-derived count so we never under-count.
    for (const el of root.querySelectorAll("[data-array-list]")) {
        const path = el.dataset.arrayList;
        const arr = foundry.utils.getProperty(sheet.document, path);
        const n = Array.isArray(arr) ? arr.length : 0;
        lens[path] = Math.max(lens[path] ?? 0, n);
    }
    return lens;
}

/** First visible text/number/textarea field of row `index` for array `path`. */
function firstFieldOfRow(root, path, index) {
    const short = path.startsWith("system.") ? path.slice(7) : path;
    const cands = [
        ...root.querySelectorAll(`[name^="${path}.${index}."]`),      // object array field
        ...root.querySelectorAll(`[name="${path}.${index}"]`),        // string array entry
        ...root.querySelectorAll(`[data-array="${short}"][data-index="${index}"], [data-array="${path}"][data-index="${index}"]`),
    ];
    return cands.find(el => el.matches(TEXTUAL) && el.offsetParent !== null) ?? null;
}

/** Read (index, key) that an input edits, from its name or its data-* attributes. */
function inputTarget(input) {
    const m = input.getAttribute("name")?.match(/\.(\d+)\.([^.]+)$/);
    if (m) return { index: parseInt(m[1]), key: m[2] };
    if (input.dataset.index != null) return { index: parseInt(input.dataset.index), key: input.dataset.key ?? null };
    return { index: NaN, key: null };
}

/** A blank row shaped like `sample` (numbers→0, booleans→false, else empty string). */
function blankLike(sample) {
    if (typeof sample === "string") return "";
    if (typeof sample !== "object" || sample === null) return {};
    const blank = {};
    for (const [k, v] of Object.entries(sample)) {
        blank[k] = typeof v === "number" ? 0 : typeof v === "boolean" ? false : Array.isArray(v) ? [] : "";
    }
    return blank;
}

/** Commit the field's current value and append a blank row — one update, no race. */
async function commitAndAppendRow(sheet, path, input) {
    const doc = sheet.document;
    if (!doc) return;
    const src = foundry.utils.getProperty(doc, path);
    const arr = Array.isArray(src) ? foundry.utils.deepClone(src) : [];

    // fold the current field's (uncommitted) value into the array first
    const { index, key } = inputTarget(input);
    if (Number.isInteger(index) && index >= 0 && index < arr.length) {
        const value = input.type === "number" ? (Number(input.value) || 0) : input.value;
        if (typeof arr[index] === "string") arr[index] = value;
        else if (arr[index] && key) foundry.utils.setProperty(arr[index], key, value);
    }

    // append a blank row shaped like the current last row (falls back to {})
    arr.push(arr.length ? blankLike(arr[arr.length - 1]) : {});
    await doc.update({ [path]: arr });
}

/**
 * Wire the shared edit UX onto a freshly (re)rendered sheet.
 * @param {foundry.applications.api.DocumentSheetV2} sheet
 * @param {HTMLElement} root  the sheet's element
 */
export function wireEditUx(sheet, root) {
    if (!root) return;

    // restore scroll captured before the last re-render 
    if (sheet._mistScroll) {
        const snap = sheet._mistScroll;
        requestAnimationFrame(() => {
            root.querySelectorAll(".scrollable").forEach((el, i) => {
                if (snap[i] != null) el.scrollTop = snap[i];
            });
        });
    }
    // capture scroll just before the next change/action triggers a re-render.
    // The frame element persists across part re-renders, so bind it once.
    if (!sheet._mistScrollBound) {
        sheet._mistScrollBound = true;
        const save = () => {
            sheet._mistScroll = {};
            sheet.element?.querySelectorAll(".scrollable").forEach((el, i) => {
                sheet._mistScroll[i] = el.scrollTop;
            });
        };
        sheet.element.addEventListener("change", save, true);
        sheet.element.addEventListener("pointerdown", ev => {
            if (ev.target.closest?.("[data-action]")) save();
        }, true);
    }

    // --- autofocus a newly appended list row, faster entering of data
    const prev = sheet._mistArrayLens;
    const now = arrayLengths(sheet, root);
    sheet._mistArrayLens = now;
    if (prev) {
        for (const [path, len] of Object.entries(now)) {
            if (prev[path] != null && len > prev[path]) {
                const el = firstFieldOfRow(root, path, len - 1);
                if (el) { el.focus(); el.select?.(); break; }
            }
        }
    }

    // Enter in a single-line list-row field: commit + append next 
    // Only single-line <input>s inside a declared list; textareas and all
     // non-list fields keep their existing behaviour
    for (const input of root.querySelectorAll('input[type="text"], input[type="number"], input:not([type])')) {
        const path = input.closest("[data-array-list]")?.dataset.arrayList;
        if (!path) continue;
        input.addEventListener("keydown", ev => {
            if (ev.key !== "Enter" || ev.shiftKey || ev.isComposing) return;
            ev.preventDefault();
            commitAndAppendRow(sheet, path, input);
        });
    }
}
