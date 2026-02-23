const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;


export class ThemekitSelectionApp extends HandlebarsApplicationMixin(ApplicationV2) {
    currentSelectedThemekit = null;
    actor = null;
    actorThemebook = null;

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'themekit-selection-app',
        classes: ['mist-engine', 'dialog', 'themekit-selection-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'Themekit Selection',
            icon: 'fa-solid fa-book-atlas',
            positioned: true,
            resizable: true
        },
        position: {
            width: 900,
            height: 600
        },
        actions: {
            selectThemekit: this.#handleSelectThemekit,
            addThemekit: this.#handleAddThemekit
        },
    };

    /** @override */
    static PARTS = {
        dialog: {
            template: 'systems/mist-engine-fvtt/templates/themekit-selection-app/dialog.hbs',
            scrollable: ['']
        }
    };

       async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.isGM = game.user.isGM;
        context.isNotGM = !game.user.isGM;
        context.availableThemekits = await this.getAllThemekits();
        context.currentSelectedThemekit = this.currentSelectedThemekit;
        context.currentSelectedThemekitAvailable = this.currentSelectedThemekit != null;

        if(this.actorThemebook){
            context.addThemekitButtonStr = game.i18n.localize("MIST_ENGINE.THEMEKITS.AssignThemekit");
        }else{
            context.addThemekitButtonStr = game.i18n.localize("MIST_ENGINE.THEMEKITS.AddThemekit");
        }
        
        // we set this flag if the currentSelectedThemekit has any special improvements without an empty name
        context.hasSpecialImprovements = context.currentSelectedThemekitAvailable && context.currentSelectedThemekit.system.specialImprovements && context.currentSelectedThemekit.system.specialImprovements.some(si => si.name && si.name.trim() !== "");
        
        return context;
    }

    async getAllThemekits(){
       // Welt
        const worldThemeKits = game.items.filter(i => i.type === "themekit");

        // Kompendien
        const compendiumThemeKits = [];

        for (const pack of game.packs) {
            if (pack.documentName !== "Item") continue;

            const docs = await pack.getDocuments();
            compendiumThemeKits.push(
                ...docs.filter(i => i.type === "themekit")
            );
        }

        // Gesamt
        const allThemeKits = [
        ...worldThemeKits,
        ...compendiumThemeKits
        ];

        // now we group them by property 'themekit_type', if themekit_type in uppercase is not set, we put it in a group called 'OTHER'
        // each group hash is {groupName: string, themekits: array of themekits}
        const themekitsByType = {};
        for(let themekit of allThemeKits){
            const type = (themekit.system.themekit_type || "OTHER").toUpperCase(); 
            if(!themekitsByType[type]){
                themekitsByType[type] = { groupName: type, themekits: [] };
            }
            themekitsByType[type].themekits.push(themekit);
        }

        // sort themekits by name
        for(let themekitType in themekitsByType){
            themekitsByType[themekitType].themekits.sort((a, b) => a.name.localeCompare(b.name));
        }
        return themekitsByType;
    }

    static async #handleSelectThemekit(event, target){
        event.preventDefault();
        const themekitUuid = target.dataset.themekitUuid;
        const themekitSource = target.dataset.themekitSource;
        let themekit = await fromUuid(themekitUuid);
        this.currentSelectedThemekit = themekit;
        this.render();
    }

    setActor(actor){
        this.actor = actor;
    }

    setThemebook(themebook){
        this.actorThemebook = themebook;
    }

    static async #handleAddThemekit(event, target){
        event.preventDefault();
        if(!this.currentSelectedThemekit){
            ui.notifications.warn("No themekit selected!");
            return;
        }
        if(!this.actor){
            ui.notifications.warn("No actor set for themekit selection app!");
            return;
        }

        if(this.actorThemebook){
            // we only set the UUID of the themebook with the currentSelectedThemekit
            await this.actorThemebook.update({ "system.themeKitUUID": this.currentSelectedThemekit.uuid });
            ui.notifications.notify( game.i18n.format("MIST_ENGINE.NOTIFICATIONS.AssignedThemekit", { themekitName: this.currentSelectedThemekit.name, characterName: this.actor.name }));
            this.close();
            return;
        }

        // first we create a themebook item from the selected themekit
        // we use the themekit_type as the name for the themebook, then we set the themeKitUUID to the uuid of the selected themekit, we also copy the quest and story fields from the themekit to the themebook
        const themebookData = {
            name: this.currentSelectedThemekit.system.themekit_type || "Themebook",
            type: "themebook",
            system: {
                themeKitUUID: this.currentSelectedThemekit.uuid,
                quest: this.currentSelectedThemekit.system.quest,
                story: this.currentSelectedThemekit.system.story,
                type: "litm-origin"
            }
        };

        // we set the first powertag of the themebook to the first powertag of the themekit, if it exists
        if(this.currentSelectedThemekit.system.powertags && this.currentSelectedThemekit.system.powertags.length > 0){
            themebookData.system.powertag1 = {
                name: this.currentSelectedThemekit.system.powertags[0].name,
            };
        }

        // now we create the themebook item in the actor's inventory
        await this.actor.createEmbeddedDocuments("Item", [themebookData]);
        ui.notifications.info( game.i18n.format("MIST_ENGINE.NOTIFICATIONS.AddedThemekit", { themekitName: this.currentSelectedThemekit.name, actorName: this.actor.name }));
    }
}