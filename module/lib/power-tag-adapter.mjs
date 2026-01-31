export class PowerTagAdapter{
    static async deselectPowerTag(actor,itemId,key){
        const item = actor.items.get(itemId);
        if(item){
            console.log("PowerTagAdapter.deselectPowerTag: found item", {itemId,key});
            await item.update({ [key]: false });
            console.log("PowerTagAdapter.deselectPowerTag: deselected", {itemId,key});
            //refresh actor to reflect changes
            await actor.render({force: false});
        } else {
            console.log("PowerTagAdapter.deselectPowerTag: item not found");
        }
    }
}