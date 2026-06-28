import { ArrayFieldAdapter } from "./array-field-adapter.mjs";

export class PowerTagAdapter{
    /**
     * Deselect a single power/weakness tag.
     *
     * @param {Actor}  actor
     * @param {string} itemId
     * @param {string} key    - dot-path of the form "system.powertags.N.selected"
     *                          or "system.weaknesstags.N.selected"
     */
    static async deselectPowerTag(actor, itemId, key){
        const item = actor.items.get(itemId);
        if(!item){
            console.log("PowerTagAdapter.deselectPowerTag: item not found", {itemId, key});
            return;
        }

        // key format: "system.powertags.N.selected" or "system.weaknesstags.N.selected"
        const parts = key.split(".");                  // ["system", "powertags", "N", "selected"]
        const arrayPath = parts.slice(0, 2).join(".");  // "system.powertags"
        const tagIndex  = parseInt(parts[2]);
        const field     = parts[3];                     // "selected"

        const ok = await ArrayFieldAdapter.set(item, arrayPath, tagIndex, field, false);
        if(ok) await actor.render({force: false});
    }
}
