export class PowerTagAdapter{
    /**
     * Deselect a single power/weakness tag by fetching the full array,
     * setting selected=false at the given index, and writing the array back.
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
        const parts = key.split(".");                      // ["system", "powertags", "N", "selected"]
        const arrayPath = parts.slice(0, 2).join(".");     // "system.powertags"
        const tagIndex  = parseInt(parts[2]);
        const field     = parts[3];                        // "selected"

        const array = foundry.utils.getProperty(item, arrayPath);
        if(!array || tagIndex < 0 || tagIndex >= array.length){
            console.warn("PowerTagAdapter.deselectPowerTag: invalid array or index", {arrayPath, tagIndex, array});
            return;
        }

        array[tagIndex][field] = false;
        await item.update({ [arrayPath]: array });
        await actor.render({force: false});
    }
}
