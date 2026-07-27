/**
 * ArrayFieldAdapter - to make life simpler in the codebase
 *
 * Shared helper for the system's most common data operation: editing a single
 * element inside an `ArrayField` of `SchemaField` stored in a Document's system
 * data (e.g. `system.powertags`, `system.floatingTagsAndStatuses`, NPC limits).
 *
 * Every method follows the same proven read -> mutate -> write pattern used
 * throughout the codebase: read the live array from the document, mutate the
 * target element in place, and write the whole array back via `document.update`.
 * The update payload it produces is identical to the hand-written handlers it
 * replaces, so behavior is preserved exactly.
 *
 *
 * @typedef {foundry.abstract.Document} Doc
 */
export class ArrayFieldAdapter {
    /**
     * Normalize an index argument to an integer.
     *
     * Callers pass either a number or the raw `dataset.index` string straight
     * from the DOM, so both must be accepted. Everything that is not a whole
     * number — `undefined` (missing data attribute), `""` (empty attribute),
     * `"abc"`, `1.5` — becomes NaN and is rejected by `_resolve`. That matters:
     * every bounds comparison below is false for NaN, and `splice(NaN, 1)`
     * silently removes the *first* element (issue #125).
     * @returns {number} the integer index, or NaN if the input is unusable.
     */
    static _toIndex(index) {
        if (typeof index === "string" && index.trim() === "") return NaN;
        const i = Number(index);
        return Number.isInteger(i) ? i : NaN;
    }

    /**
     * Resolve and bounds-check the array element targeted by (doc, path, index).
     * @returns {Array|null} the live array, or null if the target is invalid.
     */
    static _resolve(doc, path, index) {
        if (!doc) return null;
        const arr = foundry.utils.getProperty(doc, path);
        const i = this._toIndex(index);
        if (!Array.isArray(arr) || Number.isNaN(i) || i < 0 || i >= arr.length) return null;
        return arr;
    }

    /**
     * Set a single field (dot-path relative to the element) on the element at
     * `index`, then persist the array.
     * @returns {Promise<boolean>} true if the update was applied.
     */
    static async set(doc, path, index, key, value) {
        const i = this._toIndex(index);
        const arr = this._resolve(doc, path, i);
        if (!arr) return false;
        foundry.utils.setProperty(arr[i], key, value);
        await doc.update({ [path]: arr });
        return true;
    }

    /**
     * Toggle a boolean field on the element at `index`, then persist the array.
     * Missing/falsy values are treated as `false`.
     * @returns {Promise<boolean>} true if the update was applied.
     */
    static async toggle(doc, path, index, key) {
        const i = this._toIndex(index);
        const arr = this._resolve(doc, path, i);
        if (!arr) return false;
        const current = foundry.utils.getProperty(arr[i], key) || false;
        foundry.utils.setProperty(arr[i], key, !current);
        await doc.update({ [path]: arr });
        return true;
    }

    /**
     * Replace the whole element at `index` (e.g. a primitive in a string
     * ArrayField), then persist the array.
     * @returns {Promise<boolean>} true if the update was applied.
     */
    static async setIndex(doc, path, index, value) {
        const i = this._toIndex(index);
        const arr = this._resolve(doc, path, i);
        if (!arr) return false;
        arr[i] = value;
        await doc.update({ [path]: arr });
        return true;
    }

    /**
     * Merge a patch object into the element at `index` (multi-field update),
     * then persist the array.
     * @returns {Promise<boolean>} true if the update was applied.
     */
    static async patch(doc, path, index, patch) {
        const i = this._toIndex(index);
        const arr = this._resolve(doc, path, i);
        if (!arr) return false;
        foundry.utils.mergeObject(arr[i], patch, { inplace: true });
        await doc.update({ [path]: arr });
        return true;
    }

    /**
     * Append a new element to the array, then persist it. Creates the array if
     * it does not yet exist.
     * @returns {Promise<boolean>} always true.
     */
    static async add(doc, path, element) {
        if (!doc) return false;
        const arr = foundry.utils.getProperty(doc, path) ?? [];
        await doc.update({ [path]: [...arr, element] });
        return true;
    }

    /**
     * Remove the element at `index`, then persist the array.
     * @returns {Promise<boolean>} true if an element was removed.
     */
    static async remove(doc, path, index) {
        const i = this._toIndex(index);
        const arr = this._resolve(doc, path, i);
        if (!arr) return false;
        arr.splice(i, 1);
        await doc.update({ [path]: arr });
        return true;
    }
}
