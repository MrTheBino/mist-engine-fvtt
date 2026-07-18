import { DiceRollApp } from '../apps/dice-roll-app.mjs';
import { MistSceneApp } from '../apps/scene-app.mjs';
import { ThemekitCharacterApp } from '../apps/themekit-character-app.mjs';
import { ThemekitSelectionApp } from '../apps/themekit-selection-app.mjs';
import { MistEngineActorSheet } from './actor-sheet.mjs';
import { ThemeKitAdapter } from '../lib/themekit-adapter.mjs';
import { ArrayFieldAdapter } from '../lib/array-field-adapter.mjs';
import { clearOtherBurns } from '../lib/burn-helper.mjs';

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
            openThemekitSelection: this.#handleOpenThemekitSelection,
            openThemekitCharacterApp: this.#handleOpenThemekitCharacterApp,
            removeThemekit: this.#handleRemoveThemekit,
            toggleRoteSelection: this.#handleToggleRoteSelection,
            clickSacrificeRoll: this.#handleClickSacrificeRoll
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
            scrollable: ['.scrollable']
        },
        other: {
            id: 'other',
            template: 'systems/mist-engine-fvtt/templates/actor/parts/tab-litm-other.hbs',
            scrollable: ['.scrollable']
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
        this.activateRefreshHooks();
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
                    { id: 'character', group: 'litm-character-sheet', label: 'MIST_ENGINE.LABELS.MainThemebooks' },
                    { id: 'other', group: 'litm-character-sheet', label: 'MIST_ENGINE.LABELS.OtherThemebooks' },
                    { id: 'biography', group: 'litm-character-sheet', label: 'MIST_ENGINE.LABELS.Biography' },
                    { id: 'notes', group: 'litm-character-sheet', label: 'MIST_ENGINE.LABELS.Notes' }
                ],
            initial: 'character',
        }
    }

    activateRefreshHooks() {
        // The character sheet auto-re-renders on its own actor's updates; the
        // scene tracker / dice roll app are refreshed by the central hooks in
        // lib/hooks.mjs. The only cross-document case left is re-rendering when
        // the *linked* fellowship themecard (a separate actor) changes.
        this._fellowshipUpdateHookId = Hooks.on("updateActor", (actor) => {
            if (this.actorFellowshipThemecard?.id === actor.id && this.rendered) {
                this.render();
            }
        });
    }

    /** @override */
    _onClose(options) {
        if (this._fellowshipUpdateHookId) {
            Hooks.off("updateActor", this._fellowshipUpdateHookId);
            this._fellowshipUpdateHookId = null;
        }
        super._onClose(options);
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

        // Build the ordered card lists for the Main/Other tab grids.
        const cards = this._orderedCardEntries();
        const toDescriptor = (c) => ({ key: c.key, type: c.type, themebook: c.themebook, rote: c.rote });
        context.mainCards = cards.filter(c => c.tab === "main").map(toDescriptor);
        context.otherCards = cards.filter(c => c.tab === "other").map(toDescriptor);

        return context;
    }

    /**
     * The stable keys for the four singleton cards, in default display order
     * (after the themebooks). `key` doubles as the descriptor `type`.
     * @type {string[]}
     */
    static SINGLETON_CARD_KEYS = ["quintessences", "fellowships", "backpack", "fellowship-themecard"];

    /**
     * Reconcile the persisted `system.cardLayout` against the live set of cards
     * (themebook items + the four singletons) and return an ordered list of card
     * entries: `{ key, type, tab, themebook? }`.
     *
     * Self-healing: keeps saved order/tab for still-valid keys, appends any
     * missing cards (themebooks default to their `tabCategory`, singletons to
     * "main") in a stable default order, and drops entries for deleted items.
     * Rendering therefore never depends on the layout being complete; the first
     * drag persists a fully-normalized layout.
     * @returns {Array<{key:string,type:string,tab:string,themebook?:Item}>}
     */
    _orderedCardEntries() {
        const themebookItems = this.actor.items.filter(i => i.type === "themebook");
        const roteItems = this.actor.items.filter(i => i.type === "rote");

        // Expected cards keyed by their stable key.
        const expected = new Map();
        for (const t of themebookItems) {
            expected.set(`themebook:${t.id}`, {
                key: `themebook:${t.id}`,
                type: "themebook",
                defaultTab: t.system.tabCategory === "other" ? "other" : "main",
                themebook: t,
            });
        }
        // one card per rote, like themebooks
        for (const r of roteItems) {
            expected.set(`rote:${r.id}`, {
                key: `rote:${r.id}`,
                type: "rote",
                defaultTab: "main",
                rote: r,
            });
        }
        for (const key of MistEngineLegendInTheMistCharacterSheet.SINGLETON_CARD_KEYS) {
            expected.set(key, { key, type: key, defaultTab: "main" });
        }

        const result = [];
        const used = new Set();

        // 1) Honour the persisted layout order/tab for keys that still exist.
        for (const entry of (this.actor.system.cardLayout ?? [])) {
            const exp = expected.get(entry.key);
            if (!exp || used.has(entry.key)) continue;
            used.add(entry.key);
            result.push({ ...exp, tab: entry.tab === "other" ? "other" : "main" });
        }

        // 2) Append any not-yet-placed cards in a stable default order:
        //    themebooks first (item order), then rotes, then the singletons.
        const defaultOrder = [
            ...themebookItems.map(t => `themebook:${t.id}`),
            ...roteItems.map(r => `rote:${r.id}`),
            ...MistEngineLegendInTheMistCharacterSheet.SINGLETON_CARD_KEYS,
        ];
        for (const key of defaultOrder) {
            if (used.has(key)) continue;
            const exp = expected.get(key);
            used.add(key);
            result.push({ ...exp, tab: exp.defaultTab });
        }

        return result;
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
            this.render(false);
        }
    }

    static async #handleAssignFellowshipThemecard(event, target) {
        event.preventDefault();
        await this.assignFellowshipThemecard();
        this.render(false);
    }

    static async #handleCreateFellowshipThemecard(event, target) {
        event.preventDefault();
        await this.createAndAssignFellowshipThemecard();
        this.render(false);
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

        return game.actors.filter(a => a.type === "litm-fellowship-themecard");
    }

    async assignFellowshipThemecard() {
        const fellowshipThemecards = this._getFellowshipThemecards();

        if (!fellowshipThemecards || fellowshipThemecards.length === 0) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.NOTIFICATIONS.NoFellowshipThemecardFound"));
            return;
        }

        let selectedThemecard;
        if (fellowshipThemecards.length === 1) {
            selectedThemecard = fellowshipThemecards[0];
        } else {
            const options = fellowshipThemecards.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
            let selectedId;

            try {
                selectedId = await foundry.applications.api.DialogV2.prompt({
                    window: { title: game.i18n.localize("MIST_ENGINE.LABELS.SelectFellowshipThemecard") },
                    content: `<select name="themecardId">${options}</select>`,
                    ok: {
                        label: game.i18n.localize("MIST_ENGINE.LABELS.Select"),
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
                window: { title: game.i18n.localize("MIST_ENGINE.LABELS.CreateFellowshipThemecard") },
                content: `<label>${game.i18n.localize("MIST_ENGINE.LABELS.Name")}</label><input name="themecardName" type="text" value="${game.i18n.localize("MIST_ENGINE.THEMEBOOKS.Fellowship")}" autofocus>`,
                ok: {
                    label: game.i18n.localize("MIST_ENGINE.LABELS.Create"),
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

    reloadFellowshipThemecard() {
        this.loadFellowshipThemecard();
    }

    _prepareItems() {
        const themebooks = [];
        const themebooksOther = [];
        const quintessences = [];
        const rotes = [];
        let backpack = null;

        let inventory = this.options.document.items;
        for (let i of inventory) {
            if (i.type === 'themebook') {
                if(i.system.tabCategory === "other"){
                    themebooksOther.push(i);
                }else{
                    themebooks.push(i);
                }

            } else if (i.type === 'backpack') {
                backpack = i;
            } else if (i.type === 'quintessence') {
                quintessences.push(i);
            } else if (i.type === 'rote') {
                rotes.push(i);
            }
        }

        // The empty-state / "open themekit selection" prompt is about the
        // character having NO themebooks at all (placement is driven by
        // cardLayout now, not the per-themebook tabCategory).
        const totalThemebooks = themebooks.length + themebooksOther.length;
        rotes.sort((a, b) => a.name.localeCompare(b.name));
        return { themebooks: themebooks, backpack: backpack, quintessences: quintessences, rotes: rotes, themebooksEmpty: totalThemebooks === 0, themebooksOther: themebooksOther, themebooksOtherEmpty: themebooksOther.length === 0 };
    }

    getBackpack() {
        return this.options.document.items.find(i => i.type === 'backpack');
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        // A canceled drag (ESC / drop outside) fires no drop event — clean the
        // indicators on dragend. Bound once; this.element survives re-renders.
        if (!this._cardDragendBound) {
            this._cardDragendBound = true;
            this.element.addEventListener("dragend", () => this._clearCardDragIndicators());
        }
        // Restore scroll positions after render to prevent jumping
        this._restoreScrollPositions();

        // If the actor has a custom background, set it as the background image of the sheet.
        const el = this.element.querySelector?.(".window-content") ?? this.element;
        if(this.actor.system.customBackground){
            el.style.setProperty("background-image", `url("${this.actor.system.customBackground}")`);
        } else {
            el.style.removeProperty("background-image");
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

        this.enableFloatingTagStatusContextMenus();
        this.enableMoveThemebookContextMenu();
    }


    async handleFellowshipRelationshipSelectableClick(event) {
        event.preventDefault();
        const index = parseInt(event.currentTarget.dataset.index);
        const doc = this.options.document;
        const fellowships = doc.system.fellowships;
        if (!fellowships || index < 0 || index >= fellowships.length) return;
        if (fellowships[index].scratched) return; // do not allow selecting scratched tags
        this._saveScrollPositions();
        await ArrayFieldAdapter.toggle(doc, "system.fellowships", index, "selected");
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    async handleFellowshipRelationshipSelectableToggleClick(event) {
        event.preventDefault();
        const index = parseInt(event.currentTarget.dataset.index);
        const doc = this.options.document;
        const fellowships = doc.system.fellowships;
        if (!fellowships || index < 0 || index >= fellowships.length) return;
        await ArrayFieldAdapter.patch(doc, "system.fellowships", index, { scratched: !fellowships[index].scratched, selected: false });
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
        const index = parseInt(input.dataset.index);
        const doc = this.options.document;
        const fellowships = doc.system.fellowships;
        if (!fellowships || index < 0 || index >= fellowships.length) return;
        this._saveScrollPositions();
        await ArrayFieldAdapter.set(doc, "system.fellowships", index, input.dataset.key, input.value);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleDeleteFellowship(event, target) {
        event.preventDefault();
        const ok = await ArrayFieldAdapter.remove(this.actor, "system.fellowships", parseInt(target.dataset.index));
        if (ok) MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleCreateFellowship(event, target) {
        event.preventDefault();
        this._saveScrollPositions();
        await ArrayFieldAdapter.add(this.actor, "system.fellowships", { companion: "", relationshipTag: "", selected: false });
    }

    static async #handleDeleteQuintessence(event, target) {
        event.preventDefault();
        const index = parseInt(target.dataset.index);
        const quintessences = this.actor.system.quintessences;
        if (!quintessences || index < 0 || index >= quintessences.length) return;
        this._saveScrollPositions();
        await ArrayFieldAdapter.remove(this.actor, "system.quintessences", index);
    }

    async handleCharacterUpdatableQuintessenceChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const index = parseInt(input.dataset.index);
        await ArrayFieldAdapter.setIndex(this.options.document, "system.quintessences", index, input.value);
    }

    async handleDevelopmentPartialClick(event) {
        event.preventDefault();
        const target = event.currentTarget;
        let object = this.actor.items.get(target.dataset.itemId);
        const source = target.dataset.source;

        this._saveScrollPositions();
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
        this.reloadFellowshipThemecard();
        this.render();
    }

    async handleDevelopmentPartialRightClick(event) {
        this._saveScrollPositions();
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
        this.reloadFellowshipThemecard();
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

        const ptIndex = parseInt(tag.dataset.weaknesstagIndex);
        const weaknesstags = foundry.utils.getProperty(object, "system.weaknesstags");
        weaknesstags[ptIndex].selected = !weaknesstags[ptIndex].selected;
        await object.update({ "system.weaknesstags": weaknesstags });
        this.reloadFellowshipThemecard();
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
        const ptIndex = parseInt(tag.dataset.powertagIndex);
        const powertags = foundry.utils.getProperty(object, "system.powertags");
        powertags[ptIndex].burned = !powertags[ptIndex].burned;
        if (powertags[ptIndex].burned) {
            powertags[ptIndex].selected = false;
            powertags[ptIndex].toBurn = false;
        }
        await object.update({ "system.powertags": powertags });

        this.reloadFellowshipThemecard();
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
        this._saveScrollPositions();

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
        const powertags = foundry.utils.getProperty(object, "system.powertags");
        if (powertags[ptIndex].burned) return;
        const wasSelected = powertags[ptIndex].selected;
        powertags[ptIndex].selected = !wasSelected;
        if (wasSelected) {
            powertags[ptIndex].toBurn = false;
        }
        await object.update({ "system.powertags": powertags });

        if (source === "fellowship-themecard") {
            this.reloadFellowshipThemecard();
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
        const itemIndex = parseInt(target.dataset.itemIndex);
        if (!backpack?.system?.items || itemIndex < 0 || itemIndex >= backpack.system.items.length) return;
        this._saveScrollPositions();
        await ArrayFieldAdapter.remove(backpack, "system.items", itemIndex);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleCreateQuintessence(event, target) {
        event.preventDefault();
        this._saveScrollPositions();
        await ArrayFieldAdapter.add(this.actor, "system.quintessences", "New Quintessence");
    }

    static async #handleCreateBackpackItem(event, target) {
        event.preventDefault();
        const backpack = this.actor.items.get(target.dataset.itemId);
        this._saveScrollPositions();

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

        await ArrayFieldAdapter.add(backpack, "system.items", { name: itemName, selected: false });
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

        const powertagIndex = parseInt(target.dataset.powertagIndex);
        const powertags = foundry.utils.getProperty(object, "system.powertags");
        if (!powertags[powertagIndex]) return;
        if (powertags[powertagIndex].burned) return;
        const willBurn = !powertags[powertagIndex].toBurn;
        powertags[powertagIndex].toBurn = !powertags[powertagIndex].toBurn;
        powertags[powertagIndex].selected = powertags[powertagIndex].toBurn;
        await object.update({ "system.powertags": powertags });
        if (willBurn) await clearOtherBurns(this.actor, object, "system.powertags", powertagIndex);
        this.reloadFellowshipThemecard();
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

    /**
     * Making a Sacrifice (Core Book p. 134): a Quick outcome without any
     * Power. The player picks the level of Sacrifice, the Narrator may grant
     * a modifier. 10+ Miracle (sacrifice lessened one level), 7-9 Fate
     * (success, pay in full), 6- In Vain (pay in full, no success).
     */
    static async #handleClickSacrificeRoll(event, target) {
        event.preventDefault();
        const levels = ["painful", "scarring", "grave"];
        const content = `
            <p class="hint">${game.i18n.localize("MIST_ENGINE.SACRIFICE.Hint")}</p>
            <div class="form-group">
                <label>${game.i18n.localize("MIST_ENGINE.SACRIFICE.Level")}</label>
                <select name="level">
                    ${levels.map(l => `<option value="${l}">${game.i18n.localize("MIST_ENGINE.SACRIFICE.Levels." + l)}</option>`).join("")}
                </select>
            </div>
            <div class="form-group">
                <label>${game.i18n.localize("MIST_ENGINE.SACRIFICE.Modifier")}</label>
                <input type="number" name="modifier" value="0">
            </div>`;
        const result = await foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize("MIST_ENGINE.SACRIFICE.Title"), icon: "fa-solid fa-heart-crack" },
            classes: ["mist-engine", "dialog"],
            content,
            ok: {
                label: game.i18n.localize("MIST_ENGINE.SACRIFICE.Roll"),
                icon: "fa-solid fa-dice",
                callback: (event, button) => ({
                    level: button.form.elements.level.value,
                    modifier: parseInt(button.form.elements.modifier.value) || 0
                })
            },
            rejectClose: false
        });
        if (!result) return;

        let formula = "2d6";
        if (result.modifier > 0) formula += ` + ${result.modifier}`;
        else if (result.modifier < 0) formula += ` - ${Math.abs(result.modifier)}`;

        const roll = new Roll(formula, this.actor.getRollData());
        await roll.evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true, null, false);

        let outcome = "invain";
        if (roll.total >= 10) outcome = "miracle";
        else if (roll.total >= 7) outcome = "fate";

        const lessened = { grave: "scarring", scarring: "painful", painful: "none" }[result.level];
        const html = await foundry.applications.handlebars.renderTemplate(
            "systems/mist-engine-fvtt/templates/chat/sacrifice-result.hbs",
            {
                diceRollHTML: await roll.render(),
                levelLabel: game.i18n.localize(`MIST_ENGINE.SACRIFICE.Levels.${result.level}`),
                lessenedLabel: game.i18n.localize(`MIST_ENGINE.SACRIFICE.Levels.${lessened}`),
                isMiracle: outcome === "miracle",
                isFate: outcome === "fate",
                isInVain: outcome === "invain"
            }
        );
        await ChatMessage.create({
            content: html,
            speaker: ChatMessage.getSpeaker({ actor: this.actor })
        });
    }

    /** Select/deselect a rote for the next roll — its title joins the roll as a tag. */
    static async #handleToggleRoteSelection(event, target) {
        event.preventDefault();
        const rote = this.actor.items.get(target.dataset.itemId);
        if (!rote) return;
        this._saveScrollPositions();
        await rote.update({ "system.selected": !rote.system.selected });
        this.render();
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
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

    /** @override */
    _onDragStart(event) {
        // Fade the dragged card so the origin stays visible during the drag.
        const el = event.currentTarget;
        if (el.dataset?.dragType === "card") {
            el.closest(".themebook-container")?.classList.add("card-dragging");
        }
        return super._onDragStart(event);
    }

    /** Remove all card drag & drop indicator classes. */
    _clearCardDragIndicators() {
        for (const el of this.element.querySelectorAll(".drag-over, .drag-over-append, .card-dragging")) {
            el.classList.remove("drag-over", "drag-over-append", "card-dragging");
        }
    }

    /** @override */
    _onDragOver(event) {
        // Visual drop indicators: an insertion bar on the card the dragged card
        // would be inserted BEFORE, a dashed grid outline when it would be
        // appended at the end, or the Main/Other tab button it would move to.
        for (const el of this.element.querySelectorAll(".drag-over, .drag-over-append")) {
            el.classList.remove("drag-over", "drag-over-append");
        }
        const grid = event.target.closest(".card-grid");
        if (grid) {
            const card = event.target.closest(".themebook-container");
            if (card && !card.classList.contains("card-dragging")) {
                card.classList.add("drag-over");
            } else if (!card) {
                grid.classList.add("drag-over-append");
            }
        } else {
            const tabBtn = event.target.closest('a[data-action="tab"]');
            if (tabBtn?.dataset.tab === "character" || tabBtn?.dataset.tab === "other") {
                tabBtn.classList.add("drag-over");
            }
        }
        return super._onDragOver?.(event);
    }

    /** @override */
    async _onDrop(event) {
        this._clearCardDragIndicators();
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);

        // Reorder / move a card within the Main/Other tab grid.
        if (data.dragType === "card" && data.cardKey) {
            return this._onDropCard(event, data.cardKey);
        }

        if (data.type === "Item") {
            const item = await fromUuid(data.uuid);
            if (item?.type === "themekit") {
                const adapter = new ThemeKitAdapter();
                await adapter.importThemekitToCharacter(this.actor, item);
                return;
            }
            // A dropped backpack item must never become a second embedded
            // backpack (the sheet renders exactly one) — see issue #99.
            if (item?.type === "backpack") {
                const backpack = this.getBackpack();
                if (backpack) {
                    const entries = backpack.system.items ?? [];
                    const dropped = (item.system.items ?? [])
                        .filter(e => e.name && String(e.name).trim().length > 0)
                        .map(e => ({ ...e, selected: false, toBurn: false }));
                    if (dropped.length > 0) {
                        // merge the dropped backpack's gear into the existing one
                        await backpack.update({ "system.items": [...entries, ...dropped] });
                    } else {
                        // empty backpack item -> its name becomes a gear entry
                        await backpack.update({ "system.items": [...entries, { name: item.name, selected: false, burned: false }] });
                    }
                    return;
                }
                // no backpack yet -> fall through, the drop becomes THE backpack
            }
        }

        return super._onDrop(event);
    }

    /**
     * Resolve a card drop into a new persisted `system.cardLayout`.
     * Destination tab comes from the grid wrapper under the cursor; the dragged
     * card is inserted before the card it was dropped on (or appended when
     * dropped on empty grid space).
     * @param {DragEvent} event
     * @param {string} cardKey  The dragged card's stable key.
     */
    async _onDropCard(event, cardKey) {
        // Destination tab: a card grid under the cursor, or a Main/Other tab
        // navigation button (so a card can be moved to the hidden tab).
        let destTab = null;
        // Target the grid wrapper specifically via `.card-grid` — themebook
        // cards also carry a (now-stale) `data-tab-category`, so a bare
        // `[data-tab-category]` match would read the wrong tab when dropping
        // onto a themebook.
        const grid = event.target.closest(".card-grid");
        if (grid) {
            destTab = grid.dataset.tabCategory === "other" ? "other" : "main";
        } else {
            const tabBtn = event.target.closest('a[data-action="tab"]');
            if (tabBtn?.dataset.tab === "character") destTab = "main";
            else if (tabBtn?.dataset.tab === "other") destTab = "other";
        }
        if (!destTab) return; // dropped somewhere irrelevant → ignore

        const targetEl = event.target.closest(".themebook-container[data-card-key]");
        const targetKey = targetEl?.dataset.cardKey || null;
        if (targetKey === cardKey) return; // dropped onto itself → no-op

        // Start from the reconciled, fully-materialized layout (prunes stale keys).
        const entries = this._orderedCardEntries().map(c => ({ key: c.key, tab: c.tab }));
        const dragged = entries.find(e => e.key === cardKey);
        if (!dragged) return;

        const without = entries.filter(e => e.key !== cardKey);
        dragged.tab = destTab;

        let insertAt = without.length;
        if (targetKey) {
            const idx = without.findIndex(e => e.key === targetKey);
            if (idx !== -1) insertAt = idx;
        }
        without.splice(insertAt, 0, dragged);

        this._saveScrollPositions();
        await this.actor.update({ "system.cardLayout": without });
    }

    /**
     * The tab a card currently lives in, per the reconciled layout.
     * @param {string} cardKey
     * @returns {"main"|"other"}
     */
    _getCardTab(cardKey) {
        const entry = this._orderedCardEntries().find(c => c.key === cardKey);
        return entry ? entry.tab : "main";
    }

    /**
     * Move a card to a tab (used by the right-click menu), keeping its position.
     * @param {string} cardKey
     * @param {"main"|"other"} tab
     */
    async _setCardTab(cardKey, tab) {
        const entries = this._orderedCardEntries().map(c => ({ key: c.key, tab: c.tab }));
        const entry = entries.find(e => e.key === cardKey);
        if (!entry || entry.tab === tab) return;
        entry.tab = tab;
        this._saveScrollPositions();
        await this.actor.update({ "system.cardLayout": entries });
    }

    enableMoveThemebookContextMenu() {
        // rote cards carry data-card-key on their .themebook-item; themebook
        // cards keep the legacy "themebook:<id>" key derived from data-id
        const cardKeyOf = (li) => li.dataset.cardKey ?? ("themebook:" + li.dataset.id);
        this._createContextMenu(() => [
            {
                name: "Move to Other Tab",
                icon: '<i class="fa-solid fa-right-left"></i>',
                condition: li => this._getCardTab(cardKeyOf(li)) === "main",
                callback: li => this._setCardTab(cardKeyOf(li), "other")
            },
            {
                name: "Move to Main Tab",
                icon: '<i class="fa-solid fa-right-left"></i>',
                condition: li => this._getCardTab(cardKeyOf(li)) === "other",
                callback: li => this._setCardTab(cardKeyOf(li), "main")
            }
        ], ".themebook-item", {
            fixed: true
        });
    }
}