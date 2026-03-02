import { MistEngineActorSheet } from './actor-sheet.mjs';
import { DiceRollApp } from '../apps/dice-roll-app.mjs';
import { PowerTagAdapter } from '../lib/power-tag-adapter.mjs';
import { MistSceneApp } from '../apps/scene-app.mjs';
import { CustomBackgroundEditorApp } from '../apps/custom_background_editor.mjs';
import { ThemekitSelectionApp } from '../apps/themekit-selection-app.mjs';
import { ThemekitCharacterApp } from '../apps/themekit-character-app.mjs';

export class MistEngineLegendInTheMistCharacterSheet extends MistEngineActorSheet {
    #dragDrop // Private field to hold dragDrop handlers
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'actor', 'litm-character'],
        tag: 'form',
        position: {
            width: 1100,
            height: 800
        },
        actions: {
            createBackpackItem: this.#handleCreateBackpackItem,
            deleteBackpackItem: this.#handleDeleteBackpackItem,
            clickRoll: this.#handleClickRoll,
            toggleToBurn: this.#handleToggleToBurn,
            createQuintessence: this.#handleCreateQuintessence,
            deleteQuintessence: this.#handleDeleteQuintessence,
            createFellowship: this.#handleCreateFellowship,
            deleteFellowship: this.#handleDeleteFellowship,
            removeFellowshipThemecard: this.#handleRemoveFellowshipThemecard,
            assignFellowshipThemecard: this.#handleAssignFellowshipThemecard,
            createFellowshipThemecard: this.#handleCreateFellowshipThemecard,
            clickedCustomBackground: this.#handleClickedCustomBackground,
            clickedRemoveCustomBackground: this.#handleRemoveCustomBackground,
            clickedCustomBackgroundEditor: this.#handleClickedCustomBackgroundEditor,
            openThemekitSelection: this.#handleOpenThemekitSelection,
            openThemekitCharacterApp: this.#handleOpenThemekitCharacterApp,
            removeThemekit: this.#handleRemoveThemekit
        },
        form: {
            submitOnChange: true
        },
        actor: {
            type: 'character'
        },
        dragDrop: [{
            dragSelector: '[draggable="true"]',
            dropSelector: '.mist-engine.actor'
        }],
        window: {
            resizable: true,
            controls: [
            ]
        }
    }

    static PARTS = {
        header: {
            id: 'header',
            template: 'systems/mist-engine-fvtt/templates/actor/parts/character-header.hbs'
        },
        tabs: {
            id: 'tabs',
            template: 'templates/generic/tab-navigation.hbs',
            classes: ["litm-character-sheet-tabs"]
        },
        character: {
            id: 'character',
            template: 'systems/mist-engine-fvtt/templates/actor/parts/tab-litm-character.hbs',
            scrollable: ['']
        },
        biography: {
            id: 'biography',
            template: 'systems/mist-engine-fvtt/templates/shared/tab-biography.hbs'
        },
        notes: {
            id: 'notes',
            template: 'systems/mist-engine-fvtt/templates/shared/tab-notes.hbs'
        }
    }

    constructor(options = {}) {
        super(options)
        this.activateSocketListeners();
        this.loadFellowshipThemecard();
    }

    /** @override */
  _getHeaderControls() {
    const controls = super._getHeaderControls();

    controls.unshift({
      action: "openThemekit",
      icon: "fa-solid fa-layer-group",
      label: "Themekits",
      visible: () => this.isEditable,
      onClick: () => this.menuOpenThemekitSelection()
    });

    return controls;
  }

    /**
   * Define the structure of tabs used by this sheet.
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
    static TABS = {
        "litm-character-sheet": { // this is the group name
            tabs:
                [
                    { id: 'character', group: 'litm-character-sheet', label: 'MIST_ENGINE.LABELS.Themebooks' },
                    { id: 'biography', group: 'litm-character-sheet', label: 'MIST_ENGINE.LABELS.Biography' },
                    { id: 'notes', group: 'litm-character-sheet', label: 'MIST_ENGINE.LABELS.Notes' }
                ],
            initial: 'character',
        }
    }

    activateSocketListeners() {
        game.socket.on("system.mist-engine-fvtt", (msg) => {
            console.log("socket message received in character sheet: ", msg);
            if (msg?.type === "hook" && msg.hook == "fellowshipThemeCardUpdated") {
                this.reloadFellowshipThemecard(false);
                if (this.rendered) {
                    this.render();
                }

            }
            else if (msg?.type === "hook" && msg.hook == "floatingTagOrStatusUpdated" && msg.data?.actorId === this.actor.id) {
                this.render(true, { focus: true });
            }
        });
    }

    /** @override */
    async _prepareContext(options) {
        let context = await super._prepareContext(options);
        //context.usedGearSlots = this.options.document.usedGearSlots;
        //context.defenseCalculated = this.options.document.defenseCalculated;

        let items = this._prepareItems();

        context.notesHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            this.document.system.notes,
            {
                // Whether to show secret blocks in the finished html
                secrets: this.document.isOwner,
                // Necessary in v11, can be removed in v12
                async: true,
                // Data to fill in for inline rolls
                rollData: this.document.getRollData(),
                // Relative UUID resolution
                relativeTo: this.document,
            }
        );

        if (this.actorFellowshipThemecard != null && this.actorFellowshipThemecard !== false) {
            context.fellowshipThemecard = this.actorFellowshipThemecard.system;
            context.fellowshipThemecardName = this.actorFellowshipThemecard.name;
        } else {
            console.log("no fellowship themecard assigned, so no context");
        }

        foundry.utils.mergeObject(context, items);

        return context;
    }

    getActorFellowshipThemecard() {
        return this.actorFellowshipThemecard;
    }

    static async #handleRemoveFellowshipThemecard(event, target) {
        event.preventDefault();
        const proceed = await foundry.applications.api.DialogV2.confirm({
            content: game.i18n.format("MIST_ENGINE.QUESTIONS.RemoveFellowshipThemecardConfirmation"),
            rejectClose: false,
            modal: true
        });
        if (proceed) {
            await this.actor.update({ "system.actorSharedSingleThemecardId": "" });
            this.actorFellowshipThemecard = false;
            this.render(true);
        }
    }

    static async #handleAssignFellowshipThemecard(event, target) {
        event.preventDefault();
        await this.assignFellowshipThemecard();
        this.render(true);
    }

    static async #handleCreateFellowshipThemecard(event, target) {
        event.preventDefault();
        await this.createAndAssignFellowshipThemecard();
        this.render(true);
    }

    isActorAssignedToUser() {
        // find the user (not gm) assigned to this actor
        let assignedUserNotGM = game.users.find(u => u.character?._id === this.actor.id && !u.isGM);
        if (!assignedUserNotGM) {
            ui.notifications.error("This character is not assigned to any non GM user. Please assign the character to a user before assigning a fellowship themecard. Press F5 to reload foundry and its permissions if you encounter problems.");
            return false;
        }
        return true;
    }

    _getFellowshipThemecards() {
        const assignedUserNotGM = game.users.find(u => u.character?._id === this.actor.id && !u.isGM);
        if (assignedUserNotGM) {
            return game.actors.filter(a =>
                a.id !== this.actor.id &&
                a.type === "litm-fellowship-themecard" &&
                a.testUserPermission(assignedUserNotGM, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
            );
        }
        // Solo / GM play — return all fellowship themecards in the world
        return game.actors.filter(a => a.type === "litm-fellowship-themecard");
    }

    async assignFellowshipThemecard() {
        const fellowshipThemecards = this._getFellowshipThemecards();

        if (!fellowshipThemecards || fellowshipThemecards.length === 0) {
            ui.notifications.warn("No Fellowship Themecard actors found. Use \"Create New\" to make one first.");
            return;
        }

        let selectedThemecard;
        if (fellowshipThemecards.length === 1) {
            selectedThemecard = fellowshipThemecards[0];
        } else {
            // Multiple options — let the user pick one
            const options = fellowshipThemecards.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
            let selectedId;
            try {
                selectedId = await foundry.applications.api.DialogV2.prompt({
                    window: { title: "Select Fellowship Themecard" },
                    content: `<select name="themecardId">${options}</select>`,
                    ok: {
                        label: "Select",
                        callback: (event, button, dialog) => button.form.elements.themecardId.value
                    }
                });
            } catch (error) {
                return;
            }
            if (!selectedId) return;
            selectedThemecard = game.actors.get(selectedId);
        }

        if (selectedThemecard) {
            this.actorFellowshipThemecard = selectedThemecard;
            await this.actor.update({ "system.actorSharedSingleThemecardId": this.actorFellowshipThemecard.id });
        }
    }

    async createAndAssignFellowshipThemecard() {
        const assignedUserNotGM = game.users.find(u => u.character?._id === this.actor.id && !u.isGM);

        let newName;
        try {
            newName = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Create Fellowship Themecard" },
                content: `<label>Name</label><input name="themecardName" type="text" value="Fellowship" autofocus>`,
                ok: {
                    label: "Create",
                    callback: (event, button, dialog) => button.form.elements.themecardName.value
                }
            });
        } catch (error) {
            return;
        }
        if (!newName || newName.trim().length === 0) return;

        const actorData = { name: newName.trim(), type: "litm-fellowship-themecard" };
        if (assignedUserNotGM) {
            actorData.ownership = { [assignedUserNotGM.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
        }
        const created = await Actor.create(actorData);
        if (created) {
            this.actorFellowshipThemecard = created;
            await this.actor.update({ "system.actorSharedSingleThemecardId": created.id });
        }
    }

    async loadFellowshipThemecard() {
        if (this.actor.system.actorSharedSingleThemecardId && this.actor.system.actorSharedSingleThemecardId !== "") {
            this.actorFellowshipThemecard = game.actors.get(this.actor.system.actorSharedSingleThemecardId);
        }
    }

    reloadFellowshipThemecard(sendMessageToOthers = false) {
        this.loadFellowshipThemecard();
        if (sendMessageToOthers == true) {
            game.socket.emit("system.mist-engine-fvtt", {
                type: "hook",
                hook: "fellowshipThemeCardUpdated",
                data: {}
            });
        }
    }

    _prepareItems() {
        const themebooks = [];
        const quintessences = [];
        let backpack = null;

        let inventory = this.options.document.items;
        for (let i of inventory) {
            if (i.type === 'themebook') {
                themebooks.push(i);
            } else if (i.type === 'backpack') {
                backpack = i;
            } else if (i.type === 'quintessence') {
                quintessences.push(i);
            }
        }

        return { themebooks: themebooks, backpack: backpack, quintessences: quintessences, themebooksEmpty: themebooks.length === 0 };
    }

    getBackpack() {
        return this.options.document.items.find(i => i.type === 'backpack');
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        // If the actor has a custom background, set it as the background image of the sheet.
        if(this.actor.system.customBackground){
             const el = this.element.querySelector?.(".window-content") ?? this.element;
             el.style.backgroundImage = `url("${this.actor.system.customBackground}")`;
        }

        // set custom font color if defined for the charname
        if(this.actor.system.customFontColor && this.actor.system.customFontColor.trim() !== ""){
             const el = this.element.querySelector?.(".charname") ?? this.element;
             el.style.color = this.actor.system.customFontColor;

             const elShort = this.element.querySelector?.(".short-description") ?? this.element;
             elShort.style.color = this.actor.system.customFontColor;
        }

        const selectablePowertags = this.element.querySelectorAll('.pt-selectable');
        for (const tag of selectablePowertags) {
            tag.addEventListener("click", event => this.handlePowerTagSelectableClick(event));
            tag.addEventListener("contextmenu", event => this.handlePowerTagSelectableRightClick(event));
        }

        const selectableFellowShipRelationshipTags = this.element.querySelectorAll('.pcfr-selectable');
        for (const tag of selectableFellowShipRelationshipTags) {
            tag.addEventListener("click", event => this.handleFellowshipRelationshipSelectableClick(event));
            tag.addEventListener("contextmenu", event => this.handleFellowshipRelationshipSelectableToggleClick(event));
        }

        const selectableweaknesses = this.element.querySelectorAll('.wt-selectable');
        for (const tag of selectableweaknesses) {
            tag.addEventListener("click", event => this.handleWeaknessSelectableClick(event));
        }

        const developmentPartialContainers = this.element.querySelectorAll('.development-partial-container');
        for (const container of developmentPartialContainers) {
            container.addEventListener("click", event => this.handleDevelopmentPartialClick(event));
            container.addEventListener("contextmenu", event => this.handleDevelopmentPartialRightClick(event));
        }

        const characterUpdatableQuintessences = this.element.querySelectorAll('.character-updatable-quintessence');
        for (const input of characterUpdatableQuintessences) {
            input.addEventListener("change", event => this.handleCharacterUpdatableQuintessenceChange(event));
        }

        const characterUpdatableFellowships = this.element.querySelectorAll('.character-updatable-fellowship');
        for (const input of characterUpdatableFellowships) {
            input.addEventListener("change", event => this.handleCharacterUpdatableFellowshipChange(event));
        }

        const fellowshipPromisesContainers = this.element.querySelectorAll('.fellowship-promises-container');
        for (const container of fellowshipPromisesContainers) {
            container.addEventListener("click", event => this.handleFellowshipPromiseClick(event));
            container.addEventListener("contextmenu", event => this.handleFellowshipPromiseRightClick(event));
        }
    }


    async handleFellowshipRelationshipSelectableClick(event) {
        event.preventDefault();
        const tag = event.currentTarget;
        const index = tag.dataset.index;
        let fellowships = this.options.document.system.fellowships;
        if (!fellowships || index >= fellowships.length) return;
        if (fellowships[index].scratched) return; // do not allow selecting scratched tags
        fellowships[index].selected = !fellowships[index].selected;
        await this.options.document.update({ "system.fellowships": fellowships });
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    async handleFellowshipRelationshipSelectableToggleClick(event) {
        event.preventDefault();
        const tag = event.currentTarget;
        const index = tag.dataset.index;
        let fellowships = this.options.document.system.fellowships;
        if (!fellowships || index >= fellowships.length) return;
        fellowships[index].scratched = !fellowships[index].scratched;
        fellowships[index].selected = false;
        await this.options.document.update({ "system.fellowships": fellowships });
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    async handleFellowshipPromiseClick(event) {
        event.preventDefault();
        let num = this.actor.system.promises;
        num = num ? num + 1 : 1;
        if (num > 5) num = 5;
        await this.options.document.update({ "system.promises": num });
    }

    async handleFellowshipPromiseRightClick(event) {
        event.preventDefault();
        let num = this.actor.system.promises;
        num = num ? num - 1 : 0;
        if (num < 0) num = 0;
        await this.options.document.update({ "system.promises": num });
    }

    async handleCharacterUpdatableFellowshipChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const index = input.dataset.index;
        const key = input.dataset.key;
        const newValue = input.value;
        let fellowships = this.options.document.system.fellowships;
        if (!fellowships || index >= fellowships.length) return;
        foundry.utils.setProperty(fellowships[index], key, newValue);
        await this.options.document.update({ "system.fellowships": fellowships });
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleDeleteFellowship(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        let fellowships = this.actor.system.fellowships;
        if (!fellowships || index >= fellowships.length) return;
        fellowships.splice(index, 1);
        await this.actor.update({ "system.fellowships": fellowships });
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleCreateFellowship(event, target) {
        event.preventDefault();
        const currentFellowships = this.actor.system.fellowships;
        if (currentFellowships) {
            await this.actor.update({
                "system.fellowships": [...currentFellowships, { companion: "", relationshipTag: "", selected: false }]
            });
        } else {
            await this.actor.update({
                "system.fellowships": [{ companion: "", relationshipTag: "", selected: false }]
            });
        }
    }

    static async #handleDeleteQuintessence(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        let quintessences = this.actor.system.quintessences;
        if (!quintessences || index >= quintessences.length) return;
        quintessences.splice(index, 1);
        await this.actor.update({ "system.quintessences": quintessences });
    }

    async handleCharacterUpdatableQuintessenceChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const index = input.dataset.index;
        const newName = input.value;
        let quintessences = this.options.document.system.quintessences;
        if (!quintessences || index >= quintessences.length) return;
        quintessences[index] = newName;
        await this.options.document.update({ "system.quintessences": quintessences });
    }

    async handleDevelopmentPartialClick(event) {
        event.preventDefault();
        const target = event.currentTarget;
        let object = this.actor.items.get(target.dataset.itemId);
        const source = target.dataset.source;

        if (source === "fellowship-themecard") {
            if (this.actorFellowshipThemecard) {
                object = this.actorFellowshipThemecard;
            }
        }
        if (!object) {
            console.log("WARNING: no object found for power tag selectable click");
            return;
        }

        const key = target.dataset.valueKey;
        let path = `${key}`;

        let prop = foundry.utils.getProperty(object, path);
        prop = prop ? prop + 1 : 1;
        if (prop > 3) prop = 3;

        await object.update({ [path]: prop });
        this.reloadFellowshipThemecard(true);
        this.render();
    }

    async handleDevelopmentPartialRightClick(event) {
        const target = event.currentTarget;
        let object = this.actor.items.get(target.dataset.itemId);
        const source = target.dataset.source;

        if (source === "fellowship-themecard") {
            if (this.actorFellowshipThemecard) {
                object = this.actorFellowshipThemecard;
            }
        }
        if (!object) {
            console.log("WARNING: no object found for power tag selectable click");
            return;
        }

        const key = target.dataset.valueKey;
        let path = `${key}`;

        let prop = foundry.utils.getProperty(object, path);
        prop = prop ? prop - 1 : 0;
        if (prop < 0) prop = 0;

        await object.update({ [path]: prop });
        this.reloadFellowshipThemecard(true);
        this.render();
    }

    async handleWeaknessSelectableClick(event) {
        event.preventDefault();
        const tag = event.currentTarget;
        const itemId = tag.dataset.itemId;
        const actor = this.options.document;
        const source = tag.dataset.source;
        let object = this.actor.items.get(itemId);

        if (source === "fellowship-themecard") {
            if (this.actorFellowshipThemecard) {
                object = this.actorFellowshipThemecard;
            }
        }
        if (!object) {
            console.log("WARNING: no object found for power tag selectable click");
            return;
        }

        if (!object) return;
        if (object.system.burned) return;

        const ptIndex = tag.dataset.weaknesstagIndex;
        let path = `system.weaknesstag${ptIndex}.selected`;
        let prop = foundry.utils.getProperty(object, path);

        await object.update({ [path]: !prop });
        this.reloadFellowshipThemecard(true);
        this.render();
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    async handlePowerTagSelectableRightClick(event) {
        event.preventDefault();
        const tag = event.currentTarget;
        const itemId = tag.dataset.itemId;
        const actor = this.options.document;
        const source = tag.dataset.source;
        let object = this.actor.items.get(itemId);

        if (source === "fellowship-themecard") {
            if (this.actorFellowshipThemecard) {
                object = this.actorFellowshipThemecard;
            }
        }
        if (!object) {
            console.log("WARNING: no object found for power tag selectable click");
            return;
        }

        if (!object) return;
        const ptIndex = tag.dataset.powertagIndex;
        let path = `system.powertag${ptIndex}.burned`;
        let prop = foundry.utils.getProperty(object, path);
        await object.update({ [path]: !prop });

        if (foundry.utils.getProperty(object, path) == true) {//if it was not burned and now is, remove selected and toBurn
            let selectedPath = `system.powertag${ptIndex}.selected`;
            let toBurnPath = `system.powertag${ptIndex}.toBurn`;
            await object.update({ [selectedPath]: false });
            await object.update({ [toBurnPath]: false });
        }

        this.reloadFellowshipThemecard(true);
        this.render();
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    async handlePowerTagSelectableClick(event) {
        event.preventDefault();
        const tag = event.currentTarget;
        const itemId = tag.dataset.itemId;
        const source = tag.dataset.source;
        const actor = this.options.document;
        let object = this.actor.items.get(itemId);

        if (source === "fellowship-themecard") {
            if (this.actorFellowshipThemecard) {
                object = this.actorFellowshipThemecard;
            }
        }
        if (!object) {
            console.log("WARNING: no object found for power tag selectable click");
            return;
        }
        const ptIndex = parseInt(tag.dataset.powertagIndex);
        let path = `system.powertag${ptIndex}.selected`;
        let prop = foundry.utils.getProperty(object, path);

        let burnedPath = `system.powertag${ptIndex}.burned`;
        if (foundry.utils.getProperty(object, burnedPath)) {
            return;
        }

        await object.update({ [path]: !prop });

        if (!prop == false) {//if it was not selected and now is, remove toBurn
            await object.update({ [`system.powertag${ptIndex}.toBurn`]: false });
        }

        if (source === "fellowship-themecard") {
            this.reloadFellowshipThemecard(true);
        }

        if (this.rendered) {
            this.render();
        }
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleDeleteBackpackItem(event, target) {
        event.preventDefault();
        const backpack = this.actor.items.get(target.dataset.itemId);
        const itemIndex = target.dataset.itemIndex;
        const backpackItems = backpack.system.items;
        if (!backpackItems || itemIndex >= backpackItems.length) return;
        backpackItems.splice(itemIndex, 1);

        await backpack.update({
            "system.items": backpackItems
        });
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleCreateQuintessence(event, target) {
        event.preventDefault();
        const currentQuintessences = this.actor.system.quintessences;
        if (currentQuintessences) {
            await this.actor.update({
                "system.quintessences": [
                    ...currentQuintessences,
                    "New Quintessence"
                ]
            });
        } else {
            await this.actor.update({
                "system.quintessences": [
                    "New Quintessence"
                ]
            });
        }
    }

    static async #handleCreateBackpackItem(event, target) {
        event.preventDefault();
        const backpack = this.actor.items.get(target.dataset.itemId);

        const backpackItems = backpack.system.items;

        let itemName = "New Item";
        try {
            itemName = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Enter the backpack item name" },
                content: '<input name="itemName" type="text" autofocus>',
                ok: {
                    label: "Submit",
                    callback: (event, button, dialog) => button.form.elements.itemName.value
                }
            });
        } catch (error){
            return;
        }

        if (itemName === undefined || itemName.trim().length === 0) {
            return;
        }

        if (backpackItems) {
            await backpack.update({
                "system.items": [
                    ...backpackItems,
                    { name: itemName, selected: false }
                ]
            });
        } else {
            await backpack.update({
                "system.items": [
                    { name: itemName, selected: false }
                ]
            });
        }

    }

    static async #handleToggleToBurn(event, target) {
        event.preventDefault();
        const actor = this.actor;
        const itemId = target.dataset.itemId;
        const source = target.dataset.source;
        let object = this.actor.items.get(itemId);

        if (source === "fellowship-themecard") {
            if (this.actorFellowshipThemecard) {
                object = this.actorFellowshipThemecard;
            }
        }
        if (!object) {
            console.log("WARNING: no object found for power tag selectable click");
            return;
        }

        const powertagIndex = target.dataset.powertagIndex;
        const powertag = foundry.utils.getProperty(object, `system.powertag${powertagIndex}`);
        if (!powertag) return;

        let burnedPath = `system.powertag${powertagIndex}.burned`;
        if (foundry.utils.getProperty(object, burnedPath)) {
            return;
        }

        powertag.toBurn = !powertag.toBurn;
        await object.update({ [`system.powertag${powertagIndex}`]: powertag });

        let path = `system.powertag${powertagIndex}.selected`;
        let prop = foundry.utils.getProperty(object, path);

        await object.update({ [path]: powertag.toBurn });
        this.reloadFellowshipThemecard(true);
        this.render();
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleClickRoll(event, target) {
        event.preventDefault();
        const actor = this.actor;
        DiceRollApp.getInstance({ actor: actor, type: target.dataset.rollType }).updateTagsAndStatuses()
        DiceRollApp.getInstance({ actor: actor, type: target.dataset.rollType }).render(true, { focus: true });
    }

    static async #handleClickedCustomBackground(event,target){
        event.preventDefault();
         const picker = new FilePicker({
            type: "image",
            current: this.actor.system.customBackground || "",
            callback: async (path) => {
            await this.actor.update({
                "system.customBackground": path
            });
            }
        });

        picker.render(true);
    }

    static async #handleRemoveCustomBackground(event,target){
        event.preventDefault();
        // question if we shall remove the background
        const proceed = await foundry.applications.api.DialogV2.confirm({
            content: game.i18n.format("MIST_ENGINE.QUESTIONS.RemoveCustomBackgroundConfirmation"),
            rejectClose: false,
        });
        if (proceed) {
            await this.actor.update({
                "system.customBackground": null
            });
            
            this.render(true); // this doesn't work
            // so let's enforce it by directly setting the background to default here as well
            // after reloading the sheet it works, but this way the user gets immediate feedback that the background was removed without needing to wait for the sheet to reload
            const el = this.element.querySelector?.(".window-content") ?? this.element;
             el.style.backgroundImage = `url(/systems/mist-engine-fvtt/assets/default_sheet_background.webp)`;
        }
    }

    static async #handleClickedCustomBackgroundEditor(event,target){
        event.preventDefault();
        const app = new CustomBackgroundEditorApp();
        app.setActor(this.actor);
        app.render(true);
    }

    menuOpenThemekitSelection(){
        const app = new ThemekitSelectionApp();
        app.setActor(this.actor);
        app.render(true);
    }

    static async #handleOpenThemekitSelection(event,target){
        event.preventDefault();
        const themebookId = target.dataset.themebookId;
        const themebook = this.actor.items.get(themebookId);

        const app = new ThemekitSelectionApp();
        app.setActor(this.actor);
        if(themebook){
            app.setThemebook(themebook);
        }
        app.render(true);
    }

    static async #handleOpenThemekitCharacterApp(event,target){
        event.preventDefault();

        const themebookId = target.dataset.themebookId;
        const themebook = this.actor.items.get(themebookId);

        const app = new ThemekitCharacterApp();
        app.setActor(this.actor);
        app.setThemebook(themebook);
        app.setThemekit(themebook.system.themekit);
        app.render(true);
    }

    static async #handleRemoveThemekit(event,target){
        event.preventDefault();

        //confirm dialog if we really want to delete the themekit
        const proceed = await foundry.applications.api.DialogV2.confirm({
            content: game.i18n.format("MIST_ENGINE.QUESTIONS.RemoveThemekitConfirmation"),
            rejectClose: false,
        });
        if (!proceed) {
            return;
        }
        const themebookId = target.dataset.themebookId;
        const themebook = this.actor.items.get(themebookId);
        if(!themebook) return;

        // simply set the themekitUUID to null, the themekit selection app will handle the rest
        await themebook.update({
            "system.themeKitUUID": ""
        });
        console.log("themekit removed from themebook ", themebook.name);
        this.render();
    }
}