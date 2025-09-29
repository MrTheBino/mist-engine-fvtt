const { ActorSheetV2 } = foundry.applications.sheets
const { HandlebarsApplicationMixin } = foundry.applications.api
const { TextEditor, DragDrop } = foundry.applications.ux
import { MistSceneApp } from '../apps/scene-app.mjs'
import { MistEngineItem } from '../documents/item.mjs'
import { FloatingTagAndStatusAdapter } from "../lib/floating-tag-and-status-adapter.mjs";

export class MistEngineActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
    #dragDrop // Private field to hold dragDrop handlers

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
            deleteFloatingTagOrStatus: this.#handleDeleteFloatingTagOrStatus,
            toggleFloatingTagOrStatusMarking: this.#handleToggleFloatingTagOrStatusMarking,
            clickToggleLock: this.#handleClickToggleLock
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
        this._renderModeToggle();

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

        const itemEditableStatsElements = this.element.querySelectorAll('.item-editable-stat')
        for (const input of itemEditableStatsElements) {
            input.addEventListener("change", event => this.handleItemStatChanged(event))
        }

        // floating tags and statuses
        const updateableFtsStats = this.element.querySelectorAll('.updateable-fts-stat')
        for (const input of updateableFtsStats) {
            input.addEventListener("change", event => this.handleFtStatChanged(event))
        }

        const ftsTagStatusToggle = this.element.querySelectorAll('.fts-tag-status-toggle')
        for (const toggle of ftsTagStatusToggle) {
            toggle.addEventListener("contextmenu", event => this.handleFtTagStatusToggle(event))
        }

        const themebookEntryInputs = this.element.querySelectorAll('.themebook-entry-input')
        for (const input of themebookEntryInputs) {
            input.addEventListener("change", event => this.handleThemebookEntryInputChanged(event))
        }
    }

    async handleFtTagStatusToggle(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        FloatingTagAndStatusAdapter.handleTagStatusToggle(this.actor, index);
        this.sendFloatableTagOrStatusUpdate();
    }

    static async #handleClickToggleLock(event, target) {
        console.log("toggle lock");
        event.preventDefault();
        const name = target.dataset.name;
        const isLocked = foundry.utils.getProperty(this.actor, name);
        await this.actor.update({ [name]: !isLocked });

        await this.actor.sheet.render({ force: true });
    }

    static async #handleDeleteFloatingTagOrStatus(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        FloatingTagAndStatusAdapter.handleDeleteFloatingTagOrStatus(this.actor, index);
        this.sendFloatableTagOrStatusUpdate();
    }

    async handleFtStatChanged(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const key = event.currentTarget.dataset.key;
        const value = event.currentTarget.value;

        await FloatingTagAndStatusAdapter.handleFtStatChanged(this.actor, index, key, value);
        this.sendFloatableTagOrStatusUpdate();
    }

    static async #handleToggleFloatingTagOrStatusMarking(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking(this.actor, index, target.dataset.markingIndex);

        this.sendFloatableTagOrStatusUpdate();
    }

    async handleItemStatChanged(event) {
        event.preventDefault();
        console.log("DEPRECATED: handleItemStatChanged, use handleThemebookEntryInputChanged instead");
        let item = null;
        const source = event.target.dataset.source;

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
                    foundry.utils.setProperty(item, arrayName + "." + key, event.target.value);
                    item.update({ [arrayName]: array });
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
                if (event.currentTarget.dataset.array !== undefined) { // update for arrays
                    let arrayName = event.currentTarget.dataset.array;

                    let index = parseInt(event.currentTarget.dataset.index);
                    let key = event.currentTarget.dataset.key;
                    let array = foundry.utils.getProperty(this.actorFellowshipThemecard, arrayName);

                    if (isNaN(index) || index < 0 || index >= array.length) {
                        console.error("Invalid index for array update", event.currentTarget.dataset);
                        return;
                    }

                    if (event.target.type === 'checkbox') {
                        let keyToUpdate = arrayName + `.${index}.` + key;
                        foundry.utils.setProperty(this.actorFellowshipThemecard, keyToUpdate, event.target.checked);
                        await this.actorFellowshipThemecard.update({ [arrayName]: array });
                    } else {
                        foundry.utils.setProperty(this.actorFellowshipThemecard, arrayName + "." + key, event.target.value);
                        await this.actorFellowshipThemecard.update({ [arrayName]: array });
                    }
                } else {
                    let key = event.currentTarget.dataset.key;
                    let value = event.currentTarget.value;
                    await this.actorFellowshipThemecard.update({ [key]: value });

                }
            }else{
                console.warn("No fellowship themecard found for actor");
            }
        }
    }

    static async #handleCreateFloatingTagOrStatus(event, target) {
        event.preventDefault();
        const floatingTagsAndStatuses = this.actor.system.floatingTagsAndStatuses;

        if (floatingTagsAndStatuses) {
            await this.actor.update({
                "system.floatingTagsAndStatuses": [
                    ...floatingTagsAndStatuses,
                    { name: "New Floating Tag", description: "", value: 0, markings: Array(6).fill(false) }
                ]
            });
        } else {
            await this.actor.update({
                "system.floatingTagsAndStatuses": [
                    { name: "New Floating Tag", description: "", value: 0, markings: Array(6).fill(false) }
                ]
            });
        }

        if (this.actor.type == "litm-character") {
            this.actor.update({ "system.floatingTagsAndStatusesEditable": true });
        }
        this.sendFloatableTagOrStatusUpdate();

    }

    static async #handleCreateItem(event, target) {
        event.preventDefault();
        const actor = this.actor;
        this._onItemCreate(event, target, actor);
    }

    async _onItemCreate(event, target, actor) {
        event.preventDefault();

        // Get the type of item to create.
        const type = target.dataset.type;
        // Grab any data associated with this control.
        const data = duplicate(target.dataset);
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
                li.slideUp(200, () => this.render(false));
            }
        }

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
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    _onDragOver(event) { }


    /**
     * Callback actions which occur when a dragged element is dropped on a target.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);

        // Handle different data types
        switch (data.type) {
            case 'tag':
            case 'status':
                const floatingTagsAndStatuses = this.actor.system.floatingTagsAndStatuses;
                let value = data.value;
                if (value == undefined || value == null || isNaN(parseInt(value))) {
                    value = 0;
                }

                let newEntry = { name: data.name, value: parseInt(value), description: "", markings: Array(6).fill(false) };
                if (parseInt(value) > 0 && parseInt(value) <= 6) {
                    newEntry.markings[parseInt(value) - 1] = true;
                    newEntry.isStatus = true;
                } else {
                    newEntry.isStatus = false;
                }

                floatingTagsAndStatuses.push(newEntry);
                this.actor.update({
                    "system.floatingTagsAndStatuses": floatingTagsAndStatuses,
                });
                break;
            case 'limit':
                const limits = this.actor.system.limits;
                if (limits) {
                    limits.push({ name: data.name, value: data.value });
                    this.actor.update({ "system.limits": limits });
                }
                break;
            default:
                console.warn("Unknown drop type", data);
                break;
        }

        return super._onDrop?.(event);
    }

    async sendFloatableTagOrStatusUpdate() {
        game.socket.emit("system.mist-engine-fvtt", {
            type: "hook",
            hook: "floatableTagOrStatusUpdate",
            data: {
                actorId: this.actor.id,
                actorType: this.actor.type
            }
        });

        // socket events are not getting send to the sender itself, so we need to update our own scene app too
        const instance = MistSceneApp.getInstance();
        if (instance.rendered) { // only if shown
            instance.render(true, { focus: true });
        }
    }
}