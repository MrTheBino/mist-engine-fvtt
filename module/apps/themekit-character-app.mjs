const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;


export class ThemekitCharacterApp extends HandlebarsApplicationMixin(ApplicationV2) {
    currentSelectedThemekit = null;
    actorThemebook = null;
    actor = null;

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'themekit-character-app',
        classes: ['mist-engine', 'dialog', 'themekit-character-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'Themekit',
            icon: 'fa-solid fa-book-atlas',
            positioned: true,
            resizable: true
        },
        position: {
            width: 900,
            height: 600
        },
        actions: {
            addPowertag: this.#handleAddPowertag,
            addWeaknessTag: this.#handleAddWeaknessTag,
            addSpecialImprovement: this.#handleAddSpecialImprovement,
            setQuest: this.#handleSetQuest
        },
    };

    /** @override */
    static PARTS = {
        dialog: {
            template: 'systems/mist-engine-fvtt/templates/themekit-character-app/dialog.hbs',
            scrollable: ['']
        }
    };

       async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.isGM = game.user.isGM;
        context.isNotGM = !game.user.isGM;
        context.currentSelectedThemekit = this.currentSelectedThemekit;
        context.currentSelectedThemekitAvailable = this.currentSelectedThemekit != null;
        
        // we set this flag if the currentSelectedThemekit has any special improvements without an empty name
        context.hasSpecialImprovements = context.currentSelectedThemekitAvailable && context.currentSelectedThemekit.system.specialImprovements && context.currentSelectedThemekit.system.specialImprovements.some(si => si.name && si.name.trim() !== "");
        
        return context;
    }

    static async #handleAddPowertag(event,target){
        const tagName = target.dataset.tag;
        // we find the first empty powertag in the actors themebook and set the name to the tagName, then we break the loop
        for(let i = 1; i <= 10; i++){
            const powertag = this.actorThemebook.system[`powertag${i}`];
            if(powertag && (!powertag.name || powertag.name.trim() === "")){
                await this.actorThemebook.update({ [`system.powertag${i}.name`]: tagName });
                console.log(`Added powertag ${tagName} to powertag${i}`);
                this.actor.render();
                ui.notifications.notify(`Added powertag ${tagName}`);
                break;
            }
        }
    }

    static async #handleAddWeaknessTag(event,target){
        const tagName = target.dataset.tag;
        // we find the first empty weakness tag in the actors themebook and set the name to the tagName, then we break the loop
        for(let i = 1; i <= 10; i++){
            const weaknessTag = this.actorThemebook.system[`weaknesstag${i}`];
            if(weaknessTag && (!weaknessTag.name || weaknessTag.name.trim() === "")){
                await this.actorThemebook.update({ [`system.weaknesstag${i}.name`]: tagName });
                console.log(`Added weakness tag ${tagName} to weaknesstag${i}`);
                this.actor.render();
                ui.notifications.notify(`Added weakness tag ${tagName}`);
                break;
            }
        }
    }

    static async #handleSetQuest(event,target){
        const quest = this.currentSelectedThemekit.system.quest;
        await this.actorThemebook.update({ [`system.quest`]: quest });
        console.log(`Set quest to ${quest}`);
        this.actor.render();
        ui.notifications.notify(`Set quest to ${quest}`);
    }

    static async #handleAddSpecialImprovement(event,target){
        const index = target.dataset.index;
        const specialImprovement = this.currentSelectedThemekit.system.specialImprovements[index];
        if(specialImprovement){
            const improvementData = {
                name: specialImprovement.name,
                description: specialImprovement.description
            };

            // we find the first empty special improvement in the actors themebook and set the name and description to the improvementData, then we break the loop
            // themebook.specialImprovements is an array of objects with name and description properties, we check if the name property is empty to determine if the special improvement is empty
            // if we don't find any empty special improvements, we add it to the end of the array
            let specialImprovements = this.actorThemebook.system.specialImprovements || [];
            let added = false;
            for(let i = 0; i < specialImprovements.length; i++){
                const si = specialImprovements[i];
                if(!si.name || si.name.trim() === ""){
                    console.log(`Adding special improvement ${improvementData.name} to specialImprovements.${i}`);
                    specialImprovements[i] = improvementData;
                    await this.actorThemebook.update({ [`system.specialImprovements`]: specialImprovements });
                    console.log(`Added special improvement ${improvementData.name} to specialImprovements.${i}`);
                    this.actor.render();
                    added = true;

                    break;
                }
            }
            if(!added){
                await this.actorThemebook.update({ [`system.specialImprovements`]: [...specialImprovements, improvementData] });
                console.log(`Added special improvement ${improvementData.name} to specialImprovements.${specialImprovements.length}`);
                this.actor.render();
            }

            // ui notification
            ui.notifications.notify(`Added special improvement ${improvementData.name}`);
        }
    }

    setActor(actor){
        this.actor = actor;
    }

    setThemekit(themekit){
        this.currentSelectedThemekit = themekit;
    }

    setThemebook(themebook){
        this.actorThemebook = themebook;
    }
}