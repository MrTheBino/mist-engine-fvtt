const { ActorSheetV2 } = foundry.applications.sheets
const { HandlebarsApplicationMixin } = foundry.applications.api
const { TextEditor, DragDrop } = foundry.applications.ux
import { CustomBackgroundEditorApp } from '../apps/custom_background_editor.mjs';
import { MistSceneApp } from '../apps/scene-app.mjs'
import { DiceRollApp } from '../apps/dice-roll-app.mjs'
import { MistEngineItem } from '../documents/item.mjs'
import { FloatingTagAndStatusAdapter } from "../lib/floating-tag-and-status-adapter.mjs";
import { StoryTagAdapter } from "../lib/story-tag-adapter.mjs";
import { ArrayFieldAdapter } from "../lib/array-field-adapter.mjs";
import { wireEditUx } from "../lib/sheet-edit-ux.mjs";

export class MistEngineActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
    #dragDrop // Private field to hold dragDrop handlers
    #scrollPositions; // Store scroll positions to prevent jumping

    /**
     * Last known text selection in a UUID-droppable field, as
     * `{ field, start, end }`. Kept because the field blurs (and its selection
     * collapses) the moment a drag starts in the sidebar, so at drop time the
     * live selection is already gone. Updated on every selection change while
     * the field is focused; consumed by #dropUuidLinkOnField. A re-render
     * replaces the field elements, which invalidates the cache via its
     * `field` identity check.
     */
    #lastFieldSelection = null;

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['sheet', 'actor'],
        tag: 'form',
        position: {
            width: 600,
            height: 600
        },
        actions: {
            createItem: this.#handleCreateItem,
            editItem: this.#handleEditItem,
            deleteItem: this.#handleDeleteItem,
            createFloatingTagOrStatus: this.#handleCreateFloatingTagOrStatus,
            addEmptyPowertag: this.#handleAddEmptyPowertag,
            addEmptyWeaknessTag: this.#handleAddEmptyWeaknessTag,
            deleteFloatingTagOrStatus: this.#handleDeleteFloatingTagOrStatus,
            toggleFloatingTagOrStatusMarking: this.#handleToggleFloatingTagOrStatusMarking,
            toggleFloatingTagOrStatus: this.#handleToggleFloatingTagOrStatus,
            toggleFloatingTagOrStatusModifier: this.#handleToggleFloatingTagOrStatusModifier,
            toggleFloatingTagOrStatusSelected: this.#handleToggleFloatingTagOrStatusSelected,
            deleteStoryTag: this.#handleDeleteStoryTag,
            toggleStoryTagSelection: this.#handleToggleStoryTagSelection,
            toggleStoryTagBurn: this.#handleToggleStoryTagBurn,
            clickToggleLock: this.#handleClickToggleLock,
            deletePowertag: this.#handleDeletePowertag,
            deleteWeaknessTag: this.#handleDeleteWeaknessTag,
            clickedCustomBackground: this.#handleClickedCustomBackground,
            clickedRemoveCustomBackground: this.#handleRemoveCustomBackground,
            clickedCustomBackgroundEditor: this.#handleClickedCustomBackgroundEditor,

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

    /** @inheritDoc */
    static PARTS = {
        tabs: {
            id: 'tabs',
            template: 'templates/generic/tab-navigation.hbs'
        }
    }

    /**
   * Define the structure of tabs used by this sheet.
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
    static TABS = {
        sheet: { // this is the group name
            tabs:
                [
                    { id: 'character', group: 'sheet', label: 'DCC.Character' },
                ],
            initial: 'character'
        }
    }

    constructor(options = {}) {
        super(options)
        this.#dragDrop = this.#createDragDropHandlers()
        this.actorFellowshipThemecard = null;
    }

    _renderModeToggle() {
        const header = this.element.querySelector(".window-header");

        let button = header.querySelector(".mode-toggle-button");
        if (!button) {
            button = document.createElement("button");
            button.classList.add("header-control", "fa-solid", "icon", "mode-toggle-button");
            const h1Element = header.querySelector("h1");
            header.insertBefore(button, h1Element);
        }

        button.onclick = ev => this._onToggleEditMode(ev);


        if (this.actor.system.editMode) {
            button.classList.add("fa-lock-open");
            button.classList.remove("fa-lock");
            button.title = "Switch to Edit Mode";
        } else {
            button.classList.add("fa-lock");
            button.classList.remove("fa-lock-open");
            button.title = "Switch to Game Mode";

        }
        button.onclick = ev => this._onToggleEditMode(ev);
    }

    async _onToggleEditMode(event) {
        event.preventDefault();
        await this.actor.update({ "system.editMode": !this.actor.system.editMode });
        this.render(false);
    }

    /* @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options)
        const actorData = this.document.toPlainObject();

        context.system = actorData.system;
        context.flags = actorData.flags;
        context.actor = this.document;
        context.editMode = actorData.system.editMode;

        // Adding a pointer to CONFIG.MISTENGINE
        context.config = CONFIG.MISTENGINE;

        context.tidyTags = game.settings.get("mist-engine-fvtt", "tidyTagsOnCharacterSheet");
        context.biographyHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            this.document.system.biography,
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
        return context;
    }

    /** @inheritDoc */
    _onRender(context, options) {
        this.#dragDrop.forEach((d) => d.bind(this.element))

        // Track selections in UUID-droppable fields so an actor dragged from
        // the sidebar (which blurs the field) can still use the selection as
        // the link label (see #lastFieldSelection).
        for (const field of this.element.querySelectorAll("input, textarea")) {
            if (!this._getUuidDroppableField(field)) continue;
            // `selectionchange` (Chromium 111+) also fires when the selection
            // collapses; `select` is kept as a fallback for older embedders.
            field.addEventListener("selectionchange", () => this.#cacheFieldSelection(field));
            field.addEventListener("select", () => this.#cacheFieldSelection(field));
        }

        if (this.actor.type === "litm-character" || this.actor.type === "litm-npc" || this.actor.type === "litm-journey") {
            this._renderModeToggle();
        }

        // set custom font color if defined for the actor-name
        if (this.actor.system.customFontColor && this.actor.system.customFontColor.trim() !== "") {
            this.element
            .querySelectorAll(".custom-font-color")
            .forEach((el) => {
                el.style.color = this.actor.system.customFontColor ?? "black";
            });
        }

        // Input Event Listener for preventing toggling the enter mode, this is a strange behaviour of foundry, didn't know to handle it otherwise
        const constAllInputs = this.element.querySelectorAll('input');
        for (const input of constAllInputs) {
            input.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault(); // optional, verhindert Default-Verhalten (z.B. Formular-Submit)
                }
            });
        };

        const expandableTriggerElements = this.element.querySelectorAll('.expandable-trigger');
        for (const trigger of expandableTriggerElements) {
            trigger.addEventListener("click", event => {
                const targetId = trigger.dataset.expandableTarget;
                const target = this.element.querySelector(`[data-expandable-id="${targetId}"]`);
                if (target.classList.contains('closed')) {
                    target.classList.remove('closed');
                    target.classList.add('open');
                }
                else {
                    target.classList.remove('open');
                    target.classList.add('closed');
                }
            });
        }

        // Story Tags
        const storytagItemEditableElements = this.element.querySelectorAll('.storytag-item-editable')
        for (const input of storytagItemEditableElements) {
            input.addEventListener("change", event => this.handleStoryTagItemChanged(event))
        }

        const storytagSelectableElements = this.element.querySelectorAll('.storytag-selectable')
        for (const input of storytagSelectableElements) {
            input.addEventListener("contextmenu", event => this.handleStoryTagBurnState(event)) // right click is for changing the burn state
        }

        const itemEditableStatsElements = this.element.querySelectorAll('.item-editable-stat')
        for (const input of itemEditableStatsElements) {
            input.addEventListener("change", event => this.handleItemStatChanged(event))
        }

        // floating tags and statuses
        const updateableFtsStats = this.element.querySelectorAll('.updateable-fts-stat')
        for (const input of updateableFtsStats) {
            input.addEventListener("change", event => this.handleFtStatChanged(event))
        }

        const themebookEntryInputs = this.element.querySelectorAll('.themebook-entry-input')
        for (const input of themebookEntryInputs) {
            input.addEventListener("change", event => this.handleThemebookEntryInputChanged(event))
        }

        // Shared edit-mode data-entry UX (autofocus on new rows, Enter-to-add,
        // no scroll jump). The player charcter sheet is excluded on purpose.
        if (this.actor?.type !== "litm-character") wireEditUx(this, this.element);
    }

    async handleStoryTagBurnState(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const index = target.dataset.index;
        const itemId = target.dataset.itemId;
        const key = target.dataset.key;
        await StoryTagAdapter.toggleBurnedState(this.actor, itemId, key, index);
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleToggleStoryTagBurn(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        const itemId = target.dataset.itemId;
        const key = target.dataset.key;
        await StoryTagAdapter.toggleBurnSelection(this.actor, itemId, key, index);
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleToggleStoryTagSelection(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        const itemId = target.dataset.itemId;
        const key = target.dataset.key;

        this._saveScrollPositions();
        await StoryTagAdapter.toggleStoryTagSelection(this.actor, itemId, key, index);
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    async handleStoryTagItemChanged(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const key = event.currentTarget.dataset.key;
        const subKey = event.currentTarget.dataset.subKey;
        const itemId = event.currentTarget.dataset.itemId;

        this._saveScrollPositions();
        if (event.currentTarget.type === 'checkbox') {
            console.log("Updating story tag selection to", event.currentTarget.checked);
            console.log("Item ID:", itemId, "Key:", key, "Index:", index);
            await StoryTagAdapter.updateStoryTag(this.actor, itemId, key, index, event.currentTarget.checked,subKey);
        } else {
            await StoryTagAdapter.updateStoryTag(this.actor, itemId, key, index, event.currentTarget.value,null);
        }
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
    }

    static async #handleToggleFloatingTagOrStatusSelected(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        this._saveScrollPositions();
        await FloatingTagAndStatusAdapter.handleTagStatusSelectedToggle(this.actor, index);
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        this.sendFloatableTagOrStatusUpdate();
    }

    static async #handleToggleFloatingTagOrStatusModifier(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        this._saveScrollPositions();
        await FloatingTagAndStatusAdapter.handleTagStatusModifierToggle(this.actor, index);
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        this.sendFloatableTagOrStatusUpdate();
    }

    static async #handleToggleFloatingTagOrStatus(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        this._saveScrollPositions();
        await FloatingTagAndStatusAdapter.handleTagStatusToggle(this.actor, index);
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
        this.sendFloatableTagOrStatusUpdate();
    }

    static async #handleClickToggleLock(event, target) {
        event.preventDefault();
        const name = target.dataset.name;
        const isLocked = foundry.utils.getProperty(this.actor, name);
        await this.actor.update({ [name]: !isLocked });

        await this.actor.sheet.render({ force: true });
    }

    static async #handleDeleteFloatingTagOrStatus(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        this._saveScrollPositions();
        let confirmed = true;
        if (target.dataset.confirm && target.dataset.confirm == "1") {
            confirmed = await foundry.applications.api.DialogV2.confirm({
                title: "Confirm Deletion",
                content: "Are you sure you want to delete this tag/status?",
                yes: {
                    label: "Yes",
                    callback: () => true
                },
                no: {
                    label: "No",
                    callback: () => false
                }
            });
        }

        if (confirmed) {
            await FloatingTagAndStatusAdapter.handleDeleteFloatingTagOrStatus(this.actor, index);
            this.sendFloatableTagOrStatusUpdate();
        }
    }

    async handleFtStatChanged(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const key = event.currentTarget.dataset.key;
        const value = event.currentTarget.value;

        await FloatingTagAndStatusAdapter.handleFtStatChanged(this.actor, index, key, value);
        this.sendFloatableTagOrStatusUpdate();
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
    }

    static async #handleToggleFloatingTagOrStatusMarking(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        this._saveScrollPositions();
        await FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking(this.actor, index, target.dataset.markingIndex);

        this.sendFloatableTagOrStatusUpdate();
        DiceRollApp.getInstance({ actor: this.actor }).updateTagsAndStatuses(true);
    }

    async handleItemStatChanged(event) {
        event.preventDefault();
        console.log("DEPRECATED: handleItemStatChanged, use handleThemebookEntryInputChanged instead");
        let item = null;
        const source = event.target.dataset.source;

        this._saveScrollPositions();
        // Update items like Themebooks
        if (source == null || source == undefined || source.trim().length === 0) {
            if (event.currentTarget.dataset.itemId == undefined) {
                const li = $(event.currentTarget).parents('.item');
                item = this.actor.items.get(li.data('itemId'));
            } else {
                item = this.actor.items.get(event.currentTarget.dataset.itemId);
            }

            if (event.target.type === 'checkbox') {
                item.update({ [event.target.dataset.itemStat]: event.target.checked });
            } else {
                item.update({ [event.target.dataset.itemStat]: event.target.value });
            }
        }
        else if (source === "fellowship-themecard") {
            if (this.actorFellowshipThemecard) {
                this.actorFellowshipThemecard.update({ [event.target.dataset.key]: event.target.value });
            }
        }
    }

    async handleThemebookEntryInputChanged(event) {
        event.preventDefault();
        let item = null;
        const source = event.target.dataset.source;

        this._saveScrollPositions();
        // Update items like Themebooks
        if (source == null || source == undefined || source.trim().length === 0) {
            if (event.currentTarget.dataset.itemId == undefined) {
                const li = $(event.currentTarget).parents('.item');
                item = this.actor.items.get(li.data('itemId'));
            } else {
                item = this.actor.items.get(event.currentTarget.dataset.itemId);
            }

            if (event.currentTarget.dataset.array !== undefined) { // update for arrays
                let arrayName = event.currentTarget.dataset.array;
                let array = foundry.utils.getProperty(item, event.currentTarget.dataset.array);
                let index = parseInt(event.currentTarget.dataset.index);
                let key = event.currentTarget.dataset.key;
                if (isNaN(index) || index < 0 || index >= array.length) {
                    console.error("Invalid index for array update", event.currentTarget.dataset);
                    return;
                }

                if (event.target.type === 'checkbox') {
                    let keyToUpdate = arrayName + `.${index}.` + key;
                    foundry.utils.setProperty(item, keyToUpdate, event.target.checked);
                    item.update({ [arrayName]: array });
                } else {
                    // fetch the array and set the value at the right index
                    let tArray = foundry.utils.getProperty(item, arrayName);
                    tArray[index][key] = event.target.value;
                    await item.update({ [arrayName]: array });
                }
            }
            // update for hashmaps
            else if (event.target.type === 'checkbox') {
                item.update({ [event.target.dataset.key]: event.target.checked });
            } else {
                item.update({ [event.target.dataset.key]: event.target.value });
            }
        }
        else if (source === "fellowship-themecard") {
            if (this.actorFellowshipThemecard) {
                console.log("I'm hERE!!!!!!!");
                if (event.currentTarget.dataset.array !== undefined) { // update for arrays
                    let arrayName = event.currentTarget.dataset.array;

                    let index = parseInt(event.currentTarget.dataset.index);
                    let key = event.currentTarget.dataset.key;
                    let array = foundry.utils.getProperty(this.actorFellowshipThemecard, arrayName);
                    console.log("array name:", arrayName, "index:", index, "key:", key);
                    console.log("Array before update:", array);

                    if (isNaN(index) || index < 0 || index >= array.length) {
                        console.error("Invalid index for array update", event.currentTarget.dataset);
                        return;
                    }

                    if (event.target.type === 'checkbox') {
                        let keyToUpdate = arrayName + `.${index}.` + key;
                        array[index][key] = event.target.checked;
                        await this.actorFellowshipThemecard.update({ [arrayName]: array });
                    } else {
                        array[index][key] = event.target.value;
                        await this.actorFellowshipThemecard.update({ [arrayName]: array });
                    }
                } else {
                    let key = event.currentTarget.dataset.key;
                    if (event.target.type === 'checkbox') {
                        let value = event.currentTarget.checked;
                        await this.actorFellowshipThemecard.update({ [key]: value });
                        return;
                    } else {
                        let value = event.currentTarget.value;
                        await this.actorFellowshipThemecard.update({ [key]: value });
                    }
                }
            } else {
                console.warn("No fellowship themecard found for actor");
            }
        }
    }

    static async #handleCreateFloatingTagOrStatus(event, target) {
        event.preventDefault();
        const floatingTagsAndStatuses = this.actor.system.floatingTagsAndStatuses;
        this._saveScrollPositions();

        let srcStatusTagStr = "New Status";
        try {
            srcStatusTagStr = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Enter the status or tag" },
                content: '<input name="srcStatusTagStr" type="text" autofocus placeholder="tag or status-2">',
                ok: {
                    label: "Submit",
                    callback: (event, button, dialog) => button.form.elements.srcStatusTagStr.value
                }
            });
        } catch (error) {
            return;
        }

        if (srcStatusTagStr === undefined || srcStatusTagStr.trim().length === 0) {
            return;
        }

        let ftsObject = FloatingTagAndStatusAdapter.parseFloatingTagAndStatusString(srcStatusTagStr);
        await this.actor.update({
            "system.floatingTagsAndStatuses": FloatingTagAndStatusAdapter.withStatusStacked(floatingTagsAndStatuses, ftsObject)
        });

        /*if (this.actor.type == "litm-character") {
            this.actor.update({ "system.floatingTagsAndStatusesEditable": true });
        }*/
        this.sendFloatableTagOrStatusUpdate();

    }

    static async #handleCreateItem(event, target) {
        event.preventDefault();
        const actor = this.actor;
        this._saveScrollPositions();
        this._onItemCreate(event, target, actor);
    }

    async _onItemCreate(event, target, actor) {
        event.preventDefault();

        // Get the type of item to create.
        const type = target.dataset.type;
        // Grab any data associated with this control.
        const data = foundry.utils.duplicate(target.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()}`;
        // Prepare the item object.

        const itemData = {
            name: name,
            type: type,
            system: data
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.system['type'];

        // Finally, create the item!
        return await MistEngineItem.create(itemData, { parent: actor });
    }

    static async #handleEditItem(event, target) {
        event.preventDefault();
        if (target.dataset.itemId == undefined) {
            const li = $(target).parents('.item');
            const item = this.options.document.items.get(li.data('itemId'))
            await item.sheet.render({ force: true });
        } else {
            const item = this.options.document.items.get(target.dataset.itemId)
            await item.sheet.render({ force: true });
        }
    }

    static async #handleDeleteItem(event, target) {
        const proceed = await foundry.applications.api.DialogV2.confirm({
            content: game.i18n.format("MIST_ENGINE.QUESTIONS.DeleteItem"),
            rejectClose: false,
            modal: true
        });
        if (proceed) {
            if (target.dataset.itemId == undefined) {
                const li = $(target).parents('.item');
                const item = this.actor.items.get(li.data('itemId'));
                item.delete();
                li.slideUp(200, () => this.render(false));
            } else {
                const item = this.actor.items.get(target.dataset.itemId);
                item.delete();
            }
        }

    }

    static async #handleDeleteStoryTag(event, target) {
        event.preventDefault();
        const itemId = target.dataset.itemId;
        const index = target.dataset.index;
        const key = target.dataset.key;

        this._saveScrollPositions();
        StoryTagAdapter.deleteStoryTag(this.actor, itemId, key, index);
        MistSceneApp.getInstance().sendUpdateHookEvent(false);
        this.render(true);
    }

    static async #handleClickedCustomBackground(event,target){
        event.preventDefault();
            const picker = new foundry.applications.apps.FilePicker.implementation({
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
            this.actor.update({ system: { customBackground: globalThis._del }}, { render: true });
        }
    }

    static async #handleClickedCustomBackgroundEditor(event,target){
        event.preventDefault();
        const app = new CustomBackgroundEditorApp();
        app.setActor(this.actor);
        app.render(true);
    }

    /**
  * Create drag-and-drop workflow handlers for this Application
  * @returns {DragDrop[]} An array of DragDrop handlers
  * @private
  */
    #createDragDropHandlers() {
        return this.options.dragDrop.map((d) => {
            d.permissions = {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this)
            }
            d.callbacks = {
                dragstart: this._onDragStart.bind(this),
                dragover: this._onDragOver.bind(this),
                drop: this._onDrop.bind(this)
            }
            return new DragDrop(d)
        })
    }

    /**
     * Define whether a user is able to begin a dragstart workflow for a given drag selector
     * @param {string} selector       The candidate HTML selector for dragging
     * @returns {boolean}             Can the current user drag this selector?
     * @protected
     */
    _canDragStart(selector) {
        // game.user fetches the current user
        return this.isEditable;
    }


    /**
     * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
     * @param {string} selector       The candidate HTML selector for the drop target
     * @returns {boolean}             Can the current user drop on this selector?
     * @protected
     */
    _canDragDrop(selector) {
        // game.user fetches the current user
        return this.isEditable;
    }


    /**
     * Callback actions which occur at the beginning of a drag start workflow.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    _onDragStart(event) {
        const el = event.currentTarget;
        if ('link' in event.target.dataset) return;

        // Extract the data you need
        let dragData = el.dataset;

        if (!dragData) return;

        // Set data transfer
        event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    }


    /**
     * Callback actions which occur when a dragged element is over a drop target.
     * Marks the UUID-droppable text fields as generic drop targets: this
     * suppresses the browser's native text-drop handling during the drag (the
     * moving insertion caret), which would otherwise disturb the field's text
     * selection before #dropUuidLinkOnField can read it as the link label.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    _onDragOver(event) {
        if (this._getUuidDroppableField(event.target)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        }
    }

    /**
     * Resolve the text field a drag event points at, if that field accepts a
     * dropped Actor as a `@UUID[...]{Label}` link — i.e. its content is
     * enriched in view mode via enrichTextWithTags (issue #73). The base
     * implementation covers the fields of the shared challenge-partial.hbs;
     * subclasses extend it with their own enriched fields.
     * @param {EventTarget} target
     * @returns {HTMLInputElement|HTMLTextAreaElement|null}
     * @protected
     */
    _getUuidDroppableField(target) {
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return null;
        if (target.classList.contains("editable-challenge-item") && target.dataset.itemId && target.dataset.key === "system.shortDescription") return target;
        if (target.classList.contains("editable-challenge-item-list-entry") && target.dataset.itemId) return target;
        return null;
    }

    /**
     * Persist `value` as the new raw text of a UUID-droppable field, mirroring
     * the field's change handler. The base implementation covers the embedded
     * shortchallenge item fields of challenge-partial.hbs; subclasses handle
     * their own fields and defer here for the shared ones.
     * @param {HTMLInputElement|HTMLTextAreaElement} field
     * @param {string} value
     * @protected
     */
    async _persistUuidDroppedText(field, value) {
        const item = this.actor.items.get(field.dataset.itemId);
        if (!item) return;
        if (field.classList.contains("editable-challenge-item")) {
            await item.update({ [field.dataset.key]: value });
        } else if (field.classList.contains("editable-challenge-item-list-entry")) {
            const index = Number.parseInt(field.dataset.index, 10);
            const list = item.system.list;
            if (Number.isNaN(index) || !Array.isArray(list) || index < 0 || index >= list.length) return;
            list[index] = value;
            await item.update({ "system.list": list });
        }
    }

    /**
     * Remember `field`'s current selection (collapsed selection clears the
     * cache). Only honored while the field is focused: the selection collapse
     * caused by blurring into a sidebar drag also fires `selectionchange`, and
     * must not clear the cache we need at drop time.
     */
    #cacheFieldSelection(field) {
        if (document.activeElement !== field) return;
        const start = field.selectionStart ?? 0;
        const end = field.selectionEnd ?? 0;
        this.#lastFieldSelection = start !== end ? { field, start, end } : null;
    }

    /**
     * Insert a `@UUID[...]{...}` link into the text field the drop landed on
     * and persist it via _persistUuidDroppedText. If the field has (or had,
     * before the drag blurred it) a text selection, the selection is replaced
     * by the link and becomes its label; otherwise the link is appended with
     * the document's name as label.
     * @param {DragEvent} event
     * @param {string} uuid
     * @returns {Promise<boolean>} true if the drop was consumed by a field.
     */
    async #dropUuidLinkOnField(event, uuid) {
        const field = this._getUuidDroppableField(event.target);
        if (!field) return false;

        // Without this the browser's default drop pastes the raw drag JSON into the field.
        event.preventDefault();

        // The drag from the sidebar blurs the field, which collapses its live
        // selection — fall back to the selection cached while it was focused.
        let start = field.selectionStart ?? 0;
        let end = field.selectionEnd ?? 0;
        if (start === end && this.#lastFieldSelection?.field === field) {
            end = Math.min(this.#lastFieldSelection.end, field.value.length);
            start = Math.min(this.#lastFieldSelection.start, end);
        }
        this.#lastFieldSelection = null;

        const doc = await fromUuid(uuid);
        if (!doc) return true;

        let value;
        if (start !== end) {
            // `}` would terminate the enricher's label match early; `{` is stripped for symmetry.
            const label = field.value.slice(start, end).trim().replace(/[{}]/g, "");
            const link = `@UUID[${uuid}]{${label || doc.name}}`;
            value = field.value.slice(0, start) + link + field.value.slice(end);
        } else {
            const link = `@UUID[${uuid}]{${doc.name}}`;
            value = field.value.trim() ? `${field.value.trimEnd()} ${link}` : link;
        }

        this._saveScrollPositions();
        await this._persistUuidDroppedText(field, value);
        return true;
    }

    /**
     * Callback actions which occur when a dragged element is dropped on a target.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);

        // An actor dropped onto an enriched text field becomes a @UUID link (issue #73).
        if (data.type === "Actor" && data.uuid && (await this.#dropUuidLinkOnField(event, data.uuid))) {
            return;
        }

        // Handle different data types
        const floatingTagsAndStatuses = this.actor.system.floatingTagsAndStatuses;
        switch (data.type) {
            case 'tag':
                floatingTagsAndStatuses.push({ name: data.name });
                this.actor.update({
                    "system.floatingTagsAndStatuses": floatingTagsAndStatuses,
                });
                break;
            case 'status':
                const value = parseInt(data.value) || 0;
                // stacks with an existing same-named status per the tracking-card rule (p. 29)
                this.actor.update({
                    "system.floatingTagsAndStatuses": FloatingTagAndStatusAdapter.withStatusStacked(
                        floatingTagsAndStatuses,
                        { name: data.name, isStatus: true, value, description: "", markings: Array(6).fill(false).fill(true, Math.max(value - 1, 0), value) }
                    ),
                });
                break;
            case 'limit':
                const limits = this.actor.system.limits;
                if (limits) {
                    limits.push({ name: data.name, value: data.value });
                    this.actor.update({ "system.limits": limits });
                }
                break;
            case 'backpack':
                // Story Tag from Backpack
                if (data.name && data.name.trim().length > 0) {
                    if (this.actor.type !== "litm-character") {
                        return;
                    }
                    let backpack = this.getBackpack();
                    if (backpack) {
                        const backpackItems = backpack.system.items;
                        backpackItems.push({ name: data.name, selected: false, burned: false });
                        await backpack.update({ "system.items": backpackItems });
                        this.render(true);
                    }
                }
            default:
                //console.warn("Unknown drop type", data);
                break;
        }

        return super._onDrop?.(event);
    }

    /**
     * Retained no-op: the actor.update performed before this call fires the
     * central `updateActor` hook (lib/hooks.mjs) on every client, refreshing
     * the scene tracker / dice roll app, while this sheet auto-re-renders on
     * its own document update. No manual socket message is needed.
     */
    async sendFloatableTagOrStatusUpdate() {}

    handleInputShortCutsForGM(event) {
        const input = event.currentTarget;

        if (!(event.ctrlKey && event.shiftKey)) {
            return
        }
        else if (event.key.toLowerCase() !== "s" && event.key.toLowerCase() !== "y" && event.key.toLowerCase() !== "a" && event.key.toLowerCase() !== "x") {
            return;
        }

        event.preventDefault();

        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const value = input.value ?? "";

        // Nur markierten Text einklammern
        if (start === end) return;

        const selectedText = value.slice(start, end);

        if ((event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s")) {
            input.value = value.slice(0, start) + `[/s ${selectedText}]` + value.slice(end);
        }

        if ((event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "y")) {
            input.value = value.slice(0, start) + `[/b ${selectedText}]` + value.slice(end);
        }

        if ((event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "a")) {
            input.value = value.slice(0, start) + `[${selectedText}]` + value.slice(end);
        }

        if ((event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "x")) {
            input.value = value.slice(0, start) + `[/m ${selectedText}]` + value.slice(end);
        }

        // Markierung innerhalb der neuen Klammern wiederherstellen
        input.setSelectionRange(start + 1, end + 1);

        // Änderung an deine bestehende change-Logik weitergeben
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    enableFloatingTagStatusContextMenus() {
        this._createContextMenu(() => [
            {
                name: "Add Adventure Might",
                icon: '<i class="fa-solid fa-circle-plus"></i>',
                condition: li => {
                    if (li.dataset.isStatus === "true") {
                        return false; // might only makes sense for tags, not for statuses, but this can be adjusted if needed
                    }
                    const might = Number(li.dataset.might ?? 0);
                    return might <= 0;
                },
                callback: async li => {
                    const index = Number(li.dataset.index);
                    await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(this.actor, index, "adventure");
                    await this.sendFloatableTagOrStatusUpdate();
                }
            },
            {
                name: "Add Greatness Might",
                icon: '<i class="fa-solid fa-circle-plus"></i>',
                condition: li => {
                    if (li.dataset.isStatus === "true") {
                        return false; // might only makes sense for tags, not for statuses, but this can be adjusted if needed
                    }
                    const might = Number(li.dataset.might ?? 0);
                    return might <= 0;
                },
                callback: async li => {
                    const index = Number(li.dataset.index);
                    await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(this.actor, index, "greatness");
                    await this.sendFloatableTagOrStatusUpdate();
                }
            },
            {
                name: "Add Origin Might",
                icon: '<i class="fa-solid fa-circle-plus"></i>',
                condition: li => {
                    if (li.dataset.isStatus === "true") {
                        return false; // might only makes sense for tags, not for statuses, but this can be adjusted if needed
                    }
                    const might = Number(li.dataset.might ?? 0);
                    return might <= 0;
                },
                callback: async li => {
                    const index = Number(li.dataset.index);
                    await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(this.actor, index, "origin");
                    await this.sendFloatableTagOrStatusUpdate();
                }
            },
            {
                name: "Remove Might",
                icon: '<i class="fa-solid fa-circle-minus"></i>',
                condition: li => {
                    if (li.dataset.isStatus === "true") {
                        return false; // might only makes sense for tags, not for statuses, but this can be adjusted if needed
                    }
                    const might = Number(li.dataset.might ?? 0);
                    return might > 0;
                },
                callback: async li => {
                    const index = Number(li.dataset.index);
                    await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(this.actor, index);
                    await this.sendFloatableTagOrStatusUpdate();
                }
            }
        ], ".floating-tag-and-status-entry", {
            fixed: true
        });
    }


    /**
     * Store current scroll positions before updates that might trigger re-renders
     * @private
     */
    _saveScrollPositions() {
        this.#scrollPositions = {};
        const scrollableElements = this.element?.querySelectorAll('.scrollable');
        scrollableElements?.forEach((el, index) => {
            this.#scrollPositions[index] = el.scrollTop;
        });
    }

    /**
     * Restore scroll positions after render to prevent sheet jumping
     * @private
     */
    _restoreScrollPositions() {
        if (this.#scrollPositions) {
            // Use requestAnimationFrame to ensure DOM is fully rendered
            requestAnimationFrame(() => {
                const scrollableElements = this.element?.querySelectorAll('.scrollable');
                scrollableElements?.forEach((el, index) => {
                    if (this.#scrollPositions[index] !== undefined) {
                        // Force instant scroll by temporarily disabling smooth behavior
                        const originalBehavior = el.style.scrollBehavior;
                        el.style.scrollBehavior = 'auto';
                        el.scrollTop = this.#scrollPositions[index];
                        // Restore original scroll behavior
                        if (originalBehavior) {
                            el.style.scrollBehavior = originalBehavior;
                        } else {
                            el.style.removeProperty('scroll-behavior');
                        }
                    }
                });
            });
        }
    }

    /**
     * Resolve the document a powertag/weakness action targets: either the
     * fellowship themecard actor or a themebook item owned by this actor.
     * @returns {Document|null}
     */
    _resolvePowertagTarget(target) {
        if (target.dataset.source === "fellowship-themecard") return this.actorFellowshipThemecard ?? null;
        return this.actor.items.get(target.dataset.itemId) ?? null;
    }

    static async #handleAddEmptyPowertag(event, target) {
        event.preventDefault();
        this._saveScrollPositions();
        const doc = this._resolvePowertagTarget(target);
        if (!doc) { console.error("Item not found for adding powertag", { itemId: target.dataset.itemId }); return; }
        await ArrayFieldAdapter.add(doc, "system.powertags", { name: "New Powertag", question: "" });
    }

    static async #handleAddEmptyWeaknessTag(event, target) {
        event.preventDefault();
        this._saveScrollPositions();
        const doc = this._resolvePowertagTarget(target);
        if (!doc) { console.error("Item not found for adding weakness", { itemId: target.dataset.itemId }); return; }
        await ArrayFieldAdapter.add(doc, "system.weaknesstags", { name: "New Weakness", question: "" });
    }

    static async #handleDeletePowertag(event, target) {
        event.preventDefault();
        this._saveScrollPositions();
        const doc = this._resolvePowertagTarget(target);
        if (!doc) { console.error("Item not found for deleting powertag", { itemId: target.dataset.itemId }); return; }
        await ArrayFieldAdapter.remove(doc, "system.powertags", parseInt(target.dataset.index));
    }

    static async #handleDeleteWeaknessTag(event, target) {
        event.preventDefault();
        this._saveScrollPositions();
        const doc = this._resolvePowertagTarget(target);
        if (!doc) { console.error("Item not found for deleting weakness", { itemId: target.dataset.itemId }); return; }
        await ArrayFieldAdapter.remove(doc, "system.weaknesstags", parseInt(target.dataset.index));
    }
}