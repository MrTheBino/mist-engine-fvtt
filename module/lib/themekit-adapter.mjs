export class ThemeKitAdapter{
    async populateThemekitForThemebook(actor,themebook, themekit){
        // copy powertags from the themekit to the new themebook
        if(themekit.system.powertags && themekit.system.powertags.length > 0){
            themebook.system.powertags = themekit.system.powertags.map(tag => ({ name: tag.name }));
        }


        // we set the first three as active (not planned) and the other ones as planned
        if(themebook.system.powertags && themebook.system.powertags.length > 0){
            themebook.system.powertags = themebook.system.powertags.map((tag, index) => ({ ...tag, planned: index >= 3 }));
        }


        // we copy the weaknesstags from the themekit to the new themebook
        if(themekit.system.weaknesstags && themekit.system.weaknesstags.length > 0){
            themebook.system.weaknesstags = themekit.system.weaknesstags.map(tag => ({ name: tag.name }));
        }

        // we set the first one as active (not planned) and the other ones as planned
        if(themebook.system.weaknesstags && themebook.system.weaknesstags.length > 0){
            themebook.system.weaknesstags = themebook.system.weaknesstags.map((tag, index) => ({ ...tag, planned: index >= 1 }));
        }
        await themebook.update({ [`system.weaknesstags`]: themebook.system.weaknesstags, [`system.powertags`]: themebook.system.powertags });
        
        await themebook.update({ [`system.themeKitUUID`]: themekit.uuid });

        await themebook.update({ [`system.quest`]: themekit.system.quest, [`system.story`]: themekit.system.story });

        // now we create the themebook item in the actor's inventory
        ui.notifications.info( game.i18n.format("MIST_ENGINE.NOTIFICATIONS.AddedThemekit", { themekitName: themekit.name, actorName: actor.name }));
        // we need to save the themebook after updating it, because the changes we made to the themebook are not saved yet
    }
    async importThemekitToCharacter(actor,themekit){

        // first we create a themebook item from the selected themekit
        // we use the themekit_type as the name for the themebook, then we set the themeKitUUID to the uuid of the selected themekit, we also copy the quest and story fields from the themekit to the themebook
        const themebookData = {
            name: themekit.system.themekit_type || "Themebook",
            type: "themebook",
            system: {
                themeKitUUID: themekit.uuid,
                quest: themekit.system.quest,
                story: themekit.system.story,
                type: themekit.system.themebook_type || "litm-origin"
            }
        };

        // copy powertags from the themekit to the new themebook
        if(themekit.system.powertags && themekit.system.powertags.length > 0){
            themebookData.system.powertags = themekit.system.powertags.map(tag => ({ name: tag.name }));
        }


        // we set the first three as active (not planned) and the other ones as planned
        if(themebookData.system.powertags && themebookData.system.powertags.length > 0){
            themebookData.system.powertags = themebookData.system.powertags.map((tag, index) => ({ ...tag, planned: index >= 3 }));
        }


        // we copy the weaknesstags from the themekit to the new themebook
        if(themekit.system.weaknesstags && themekit.system.weaknesstags.length > 0){
            themebookData.system.weaknesstags = themekit.system.weaknesstags.map(tag => ({ name: tag.name }));
        }

        // we set the first one as active (not planned) and the other ones as planned
        if(themebookData.system.weaknesstags && themebookData.system.weaknesstags.length > 0){
            themebookData.system.weaknesstags = themebookData.system.weaknesstags.map((tag, index) => ({ ...tag, planned: index >= 1 }));
        }

        // now we create the themebook item in the actor's inventory
        await actor.createEmbeddedDocuments("Item", [themebookData]);
        ui.notifications.info( game.i18n.format("MIST_ENGINE.NOTIFICATIONS.AddedThemekit", { themekitName: themekit.name, actorName: actor.name }));
    }
}