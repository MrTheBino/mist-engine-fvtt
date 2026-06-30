import { ArrayFieldAdapter } from "./array-field-adapter.mjs";
import { clearOtherBurns } from "./burn-helper.mjs";

// Adapter for story tags stored as an ArrayField on an item within an actor.
// `key` is the dot-path of the array on the item (e.g. "system.items").
// Element mutations delegate to ArrayFieldAdapter (read -> mutate -> write).
export class StoryTagAdapter {
    static async deleteStoryTag(actor, itemId, key, index){
        const item = actor.items.get(itemId);
        if(!item) return false;
        return ArrayFieldAdapter.remove(item, key, index);
    }

    static async updateStoryTag(actor, itemId, key, index, value, subKey){
        const item = actor.items.get(itemId);
        if(!item) return false;
        return ArrayFieldAdapter.set(item, key, index, subKey != null ? subKey : "name", value);
    }

    static async toggleStoryTagSelection(actor, itemId, key, index){
        const item = actor.items.get(itemId);
        if(!item) return false;
        const data = foundry.utils.getProperty(item, key);
        if(!data || index < 0 || index >= data.length) return false;
        if(data[index].burned) return false; // cannot select burned tags
        return ArrayFieldAdapter.toggle(item, key, index, "selected");
    }

    static async toggleBurnSelection(actor, itemId, key, index){
        const item = actor.items.get(itemId);
        if(!item) return false;
        const data = foundry.utils.getProperty(item, key);
        if(!data || index < 0 || index >= data.length) return false;
        if(data[index].burned) return false; // cannot toggle burned tags
        const willBurn = !data[index].toBurn;
        const ok = await ArrayFieldAdapter.toggle(item, key, index, "toBurn");
        // Only one tag may be queued to burn (#92) — clear it on all other tags.
        if(ok && willBurn) await clearOtherBurns(actor, item, key, index);
        return ok;
    }

    static async toggleBurnedState(actor, itemId, key, index){
        const item = actor.items.get(itemId);
        if(!item) return false;
        const data = foundry.utils.getProperty(item, key);
        if(!data || index < 0 || index >= data.length) return false;
        const newBurned = !(data[index].burned || false);
        // a burned tag can no longer be queued-to-burn or selected
        const patch = newBurned ? { burned: true, toBurn: false, selected: false } : { burned: false };
        return ArrayFieldAdapter.patch(item, key, index, patch);
    }
}
