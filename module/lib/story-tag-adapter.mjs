export class StoryTagAdapter {
    static async deleteStoryTag(actor,itemId,key,index){
        const item = actor.items.get(itemId);
        if(item){
            const data = foundry.utils.getProperty(item,key)
            data.splice(index, 1);
            await item.update({ [key]: data });
            console.log("StoryTagAdapter.deleteStoryTag: deleted", {itemId,key,index});
        } else {
            console.log("StoryTagAdapter.deleteStoryTag: item not found");
        }
    }

    static async updateStoryTag(actor,itemId,key,index,value){
        const item = actor.items.get(itemId);
        if(item){
            const data = foundry.utils.getProperty(item,key)
            if(data && index < data.length){
                data[index].name = value;
                await item.update({ [key]: data });
                console.log("StoryTagAdapter.updateStoryTagName: updated", {itemId,key,index,value});
            } else {
                console.log("StoryTagAdapter.updateStoryTagName: invalid index ", {itemId,key,index,value});
            }
        } else {
            console.log("StoryTagAdapter.updateStoryTagName: item not found");
        }
    }

    static async toggleStoryTagSelection(actor,itemId,key,index){
        const item = actor.items.get(itemId);
        if(item){
            const data = foundry.utils.getProperty(item,key)
            if(data && index < data.length){
                if(data[index].burned){
                    return; // cannot select burned tags
                }
                let oldSelected = data[index].selected || false;
                let newSelected = !oldSelected;
                foundry.utils.setProperty(data[index], 'selected', newSelected);
                await item.update({ [key]: data });
                console.log("StoryTagAdapter.toggleStoryTagSelection: toggled", {itemId,key,index,newSelected});
            } else {
                console.log("StoryTagAdapter.toggleStoryTagSelection: invalid index ", {itemId,key,index});
            }
        } else {
            console.log("StoryTagAdapter.toggleStoryTagSelection: item not found");
        }
    }

    static async toggleBurnSelection(actor,itemId,key,index){
        const item = actor.items.get(itemId);
        if(item){
            const data = foundry.utils.getProperty(item,key)
            if(data && index < data.length){
                if(data[index].burned){
                    return; // cannot toggle burned tags
                }
                let oldToBurn = data[index].toBurn || false;
                let newToBurn = !oldToBurn;
                foundry.utils.setProperty(data[index], 'toBurn', newToBurn);
                await item.update({ [key]: data });
                console.log("StoryTagAdapter.toggleBurnSelection: toggled", {itemId,key,index,newToBurn});
            }
            else {
                console.log("StoryTagAdapter.toggleBurnSelection: invalid index ", {itemId,key,index});
            }
        } else {
            console.log("StoryTagAdapter.toggleBurnSelection: item not found");
        }
    }

    static async toggleBurnedState(actor,itemId,key,index){
        const item = actor.items.get(itemId);
        if(item){
            const data = foundry.utils.getProperty(item,key)
            if(data && index < data.length){
                let oldBurned = data[index].burned || false;
                let newBurned = !oldBurned;
                foundry.utils.setProperty(data[index], 'burned', newBurned);
                if(newBurned){
                    foundry.utils.setProperty(data[index], 'toBurn', false); // cannot be toBurn if already burned
                    foundry.utils.setProperty(data[index], 'selected', false); // cannot be selected if burned
                }
                await item.update({ [key]: data });
                console.log("StoryTagAdapter.toggleBurnedState: toggled", {itemId,key,index,newBurned});
            } else {
                console.log("StoryTagAdapter.toggleBurnedState: invalid index ", {itemId,key,index});
            }
        } else {
            console.log("StoryTagAdapter.toggleBurnedState: item not found");
        }   
    }
}