import { ArrayFieldAdapter } from "./array-field-adapter.mjs";

// Adapter for handling floating tags and statuses logic
// This module provides static methods to manage floating tags and statuses
// for actors and items in a Foundry VTT system.
//
// All element-level mutations delegate to ArrayFieldAdapter, which performs the
// same read -> mutate -> write-whole-array pattern these methods used to hand-roll.
export class FloatingTagAndStatusAdapter {
    /** Dot-path of the floating tags/statuses array within a document's system data. */
    static PATH = "system.floatingTagsAndStatuses";

    /**
     * Add a floating tag/status to a list, stacking statuses per the
     * tracking-card rule (Core Book p. 29): a same-named status marks the box
     * of its tier; if that box is already marked, the next empty box to the
     * right is marked instead. The status tier is the highest marked box.
     * Non-statuses and new names are simply appended.
     * @param {Array} list        current floatingTagsAndStatuses array
     * @param {object} ftsObject  entry to add (from parseFloatingTagAndStatusString or a drop)
     * @returns {Array} a new array with the entry appended or stacked
     */
    static withStatusStacked(list, ftsObject){
        const current = list ?? [];
        const norm = s => String(s ?? "").trim().toLowerCase();
        if (ftsObject.isStatus && norm(ftsObject.name) !== "") {
            const idx = current.findIndex(e => e.isStatus && norm(e.name) === norm(ftsObject.name));
            if (idx !== -1) {
                const existing = foundry.utils.deepClone(current[idx]);
                const markings = [...(existing.markings ?? Array(6).fill(false))];
                while (markings.length < 6) markings.push(false);
                let tier = Math.max(1, Math.min(ftsObject.value || 1, 6)) - 1;
                if (markings[tier]) {
                    tier = markings.findIndex((m, i) => i > tier && !m); // next empty box to the right
                }
                if (tier !== -1) markings[tier] = true;
                existing.markings = markings;
                existing.value = markings.lastIndexOf(true) + 1;
                const result = [...current];
                result[idx] = existing;
                return result;
            }
        }
        return [...current, ftsObject];
    }

    static parseFloatingTagAndStatusString(srcString){
        let ftsObject = { name: srcString, description: "", isStatus: false, positive:true, value: 0, markings: Array(6).fill(false) };
        if (srcString.includes("-")) {
            const parts = srcString.split("-");
            ftsObject.isStatus = true;
            ftsObject.value = parseInt(parts[parts.length - 1]) || 0;
            ftsObject.name = parts.slice(0, parts.length - 1).join("-").trim();
            if(ftsObject.value > 0 && ftsObject.value <= 6){
                ftsObject.markings[ftsObject.value-1] = true;
            }

        }

        return ftsObject;
    }

    static async handleTagStatusModifierToggle(objectToUpdate, arrayIndex){
        return ArrayFieldAdapter.toggle(objectToUpdate, this.PATH, arrayIndex, "positive");
    }

    static async handleTagStatusSelectedToggle(objectToUpdate, arrayIndex){
        return ArrayFieldAdapter.toggle(objectToUpdate, this.PATH, arrayIndex, "selected");
    }

    static async handleTagStatusMightToggle(objectToUpdate, arrayIndex, mightIcon){
        const fts = objectToUpdate?.system?.floatingTagsAndStatuses;
        if (!fts || arrayIndex < 0 || arrayIndex >= fts.length) return false;
        // might toggles between 0 and 3
        const newMight = (fts[arrayIndex].might || 0) === 0 ? 3 : 0;
        return ArrayFieldAdapter.patch(objectToUpdate, this.PATH, arrayIndex, { might: newMight, mightIcon });
    }

    static async handleTagStatusToggle(objectToUpdate, arrayIndex){
        const fts = objectToUpdate?.system?.floatingTagsAndStatuses;
        if (!fts || arrayIndex < 0 || arrayIndex >= fts.length) return false;
        const newStatus = !(fts[arrayIndex].isStatus || false);
        // resetting value/might/markings to keep tag <-> status transitions consistent
        const patch = newStatus
            ? { isStatus: true, might: 0, markings: [true, false, false, false, false, false] }
            : { isStatus: false, value: 0, might: 0, markings: [false, false, false, false, false, false] };
        return ArrayFieldAdapter.patch(objectToUpdate, this.PATH, arrayIndex, patch);
    }

    static async handleDeleteFloatingTagOrStatus(objectToUpdate, arrayIndex){
        return ArrayFieldAdapter.remove(objectToUpdate, this.PATH, arrayIndex);
    }

    static async handleFtStatChanged(objectToUpdate, arrayIndex, key, newValue){
        return ArrayFieldAdapter.set(objectToUpdate, this.PATH, arrayIndex, key, newValue);
    }

    static async handleToggleFloatingTagOrStatusMarking(objectToUpdate, arrayIndex, markingIndex){
        return ArrayFieldAdapter.toggle(objectToUpdate, this.PATH, arrayIndex, `markings.${markingIndex}`);
    }
}
