// Adapter for handling floating tags and statuses logic
// This module provides static methods to manage floating tags and statuses
// for actors and items in a Foundry VTT system.
export class FloatingTagAndStatusAdapter {
    static async handleTagStatusToggle(objectToUpdate,arrayIndex){
        if(objectToUpdate===undefined){
            console.log("FloatingTagAndStatusAdapter.handleTagStatusToggle: no object to update");
            return;
        }

        const floatingTagsAndStatuses = objectToUpdate.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses || arrayIndex >= floatingTagsAndStatuses.length){
            console.log("FloatingTagAndStatusAdapter.handleTagStatusToggle: invalid array index");
            return;
        }

        let oldStatus = floatingTagsAndStatuses[arrayIndex].isStatus || false;
        let newStatus = !oldStatus;
        
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

        let tData = floatingTagsAndStatuses[arrayIndex];
        foundry.utils.setProperty(tData, key, newValue);
        floatingTagsAndStatuses[arrayIndex] = tData;

        await objectToUpdate.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
    }

    static async handleToggleFloatingTagOrStatusMarking(objectToUpdate,arrayIndex,markingIndex){
        console.log("FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking called with", {objectToUpdate,arrayIndex,markingIndex});
        if(objectToUpdate===undefined){
            console.log("FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking: no object to update");
            return;
        }
        const floatingTagsAndStatuses = objectToUpdate.system.floatingTagsAndStatuses;
        
        if (!floatingTagsAndStatuses || arrayIndex >= floatingTagsAndStatuses.length){
            console.log("FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking: called with", {objectToUpdate,arrayIndex,markingIndex,floatingTagsAndStatuses});
            console.log("FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking: invalid array index");
            return;
        }

        const path = 'markings.' + markingIndex;
        const currentVal = floatingTagsAndStatuses[arrayIndex].markings[markingIndex];
        let tData = floatingTagsAndStatuses[arrayIndex];
        foundry.utils.setProperty(tData, path, !currentVal);
        floatingTagsAndStatuses[arrayIndex] = tData;
        await objectToUpdate.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
    }
}