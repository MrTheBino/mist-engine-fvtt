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
     * Resolve and bounds-check the array element targeted by (doc, path, index).
     * @returns {Array|null} the live array, or null if the target is invalid.
     */
    static _resolve(doc, path, index) {
        if (!doc) return null;
        const arr = foundry.utils.getProperty(doc, path);
        if (!Array.isArray(arr) || index < 0 || index >= arr.length) return null;
        return arr;
    }

    /**
     * Set a single field (dot-path relative to the element) on the element at
     * `index`, then persist the array.
     * @returns {Promise<boolean>} true if the update was applied.
     */
    static async set(doc, path, index, key, value) {
        const arr = this._resolve(doc, path, index);
        if (!arr) return false;
        foundry.utils.setProperty(arr[index], key, value);
        await doc.update({ [path]: arr });
        return true;
    }

    /**
     * Toggle a boolean field on the element at `index`, then persist the array.
     * Missing/falsy values are treated as `false`.
     * @returns {Promise<boolean>} true if the update was applied.
     */
    static async toggle(doc, path, index, key) {
        const arr = this._resolve(doc, path, index);
        if (!arr) return false;
        const current = foundry.utils.getProperty(arr[index], key) || false;
        foundry.utils.setProperty(arr[index], key, !current);
        await doc.update({ [path]: arr });
        return true;
    }

    /**
     * Replace the whole element at `index` (e.g. a primitive in a string
     * ArrayField), then persist the array.
     * @returns {Promise<boolean>} true if the update was applied.
     */
    static async setIndex(doc, path, index, value) {
        const arr = this._resolve(doc, path, index);
        if (!arr) return false;
        arr[index] = value;
        await doc.update({ [path]: arr });
        return true;
    }

    /**
     * Merge a patch object into the element at `index` (multi-field update),
     * then persist the array.
     * @returns {Promise<boolean>} true if the update was applied.
     */
    static async patch(doc, path, index, patch) {
        const arr = this._resolve(doc, path, index);
        if (!arr) return false;
        foundry.utils.mergeObject(arr[index], patch, { inplace: true });
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
        const arr = this._resolve(doc, path, index);
        if (!arr) return false;
        arr.splice(index, 1);
        await doc.update({ [path]: arr });
        return true;
    }
}
