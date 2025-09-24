// Adapter for handling floating tags and statuses logic
// This module provides static methods to manage floating tags and statuses
// for actors and items in a Foundry VTT system.
export class FloatingTagAndStatusAdapter {
    static async handleTagStatusToggle(objectToUpdate,arrayIndex){
        //console.log("FloatingTagAndStatusAdapter.handleTagStatusToggle: called with", {objectToUpdate,arrayIndex});
        if(objectToUpdate===undefined){
            //console.log("FloatingTagAndStatusAdapter.handleTagStatusToggle: no object to update");
            return;
        }

        const floatingTagsAndStatuses = objectToUpdate.system.floatingTagsAndStatuses;
        //console.log("FloatingTagAndStatusAdapter.handleTagStatusToggle: current floatingTagsAndStatuses", floatingTagsAndStatuses);
        if (!floatingTagsAndStatuses || arrayIndex >= floatingTagsAndStatuses.length){
            //console.log("FloatingTagAndStatusAdapter.handleTagStatusToggle: invalid array index");
            return;
        }

        let oldStatus = floatingTagsAndStatuses[arrayIndex].isStatus || false;
        let newStatus = !oldStatus;
        //console.log(`FloatingTagAndStatusAdapter.handleTagStatusToggle: changing from ${oldStatus} to ${newStatus}`);
        foundry.utils.setProperty(floatingTagsAndStatuses[arrayIndex], 'isStatus', newStatus);
        await objectToUpdate.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
    }

    static async handleDeleteFloatingTagOrStatus(objectToUpdate,arrayIndex){
        const floatingTagsAndStatuses = objectToUpdate.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses || arrayIndex >= floatingTagsAndStatuses.length) return;
        floatingTagsAndStatuses.splice(arrayIndex, 1);
        await objectToUpdate.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
    }

    static async handleFtStatChanged(objectToUpdate,arrayIndex,key,newValue){
        const floatingTagsAndStatuses = objectToUpdate.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses || arrayIndex >= floatingTagsAndStatuses.length) return;

        foundry.utils.setProperty(floatingTagsAndStatuses[arrayIndex], key, newValue);
        await objectToUpdate.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
    }

    static async handleToggleFloatingTagOrStatusMarking(objectToUpdate,arrayIndex,markingIndex){
        const floatingTagsAndStatuses = objectToUpdate.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses || arrayIndex >= floatingTagsAndStatuses.length) return;

        foundry.utils.setProperty(floatingTagsAndStatuses[arrayIndex], 'markings.' + markingIndex, !floatingTagsAndStatuses[arrayIndex].markings[markingIndex]);
        await objectToUpdate.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
    }
}