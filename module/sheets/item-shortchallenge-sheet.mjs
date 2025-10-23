const { ItemSheetV2 } = foundry.applications.sheets
const { HandlebarsApplicationMixin } = foundry.applications.api
const { TextEditor, DragDrop } = foundry.applications.ux

export class MistEngineShortChallengeItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
    #dragDrop // Private field to hold dragDrop handlers

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'item'],
        tag: 'form',
        position: {
            width: 600,
            height: 550
        },
        actions: {
            createEntry: this.#handleCreateEntry,
            deleteEntry: this.#handleDeleteEntry
        },
        form: {
            // handler: DCCActorSheet.#onSubmitForm,
            submitOnChange: true
        },
        actor: {
            type: 'item'
        },
        dragDrop: [{
            dragSelector: '[draggable="true"]',
            dropSelector: '.mist-engine.item'
        }],
        window: {
            resizable: true,
            controls: [
            ]
        }
    }

    /** @inheritDoc */
    static PARTS = {
        header: {
            template: 'systems/mist-engine-fvtt/templates/item/parts/item-header.hbs'
        },
        tabs: {
            // Foundry-provided generic template
            template: 'templates/generic/tab-navigation.hbs',
            // classes: ['sysclass'], // Optionally add extra classes to the part for extra customization
        },
        form: {
            template: 'systems/mist-engine-fvtt/templates/item/item-shortchallenge-sheet.hbs'
        },
        description: {
            template: 'systems/mist-engine-fvtt/templates/shared/tab-description.hbs',
            id: 'description',
            scrollable: ['scrollable']
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
                    { id: 'form', group: 'sheet', label: 'MIST_ENGINE.LABELS.Form' },
                    { id: 'description', group: 'sheet', label: 'MIST_ENGINE.LABELS.Description' },
                ],
            initial: 'form'
        }
    }

    constructor(options = {}) {
        super(options)
        this.#dragDrop = this.#createDragDropHandlers()
    }
    
    /* @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options)
        const actorData = this.document.toPlainObject();

        context.system = actorData.system;
        context.flags = actorData.flags;
        context.item = this.document;

        context.descriptionHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            this.document.system.description,
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

    _onRender(context, options) {
        super._onRender(context, options)
        const editableItems = this.element.querySelectorAll('.editable-item');
        for (const input of editableItems) {
            input.addEventListener("change", event => this.handleInputUpdate(event))
        }
    }

    async handleInputUpdate(event) {
        const item = this.document;
        const target = event.currentTarget;
        const value = target.value;
        const index = target.dataset.index;

        const data = foundry.utils.duplicate(item.system);

        // Update the specific entry in the list
        data.list[index] = value;
        await item.update({ 'system.list': data.list });
    }

    static async #handleDeleteEntry(event, target) {
        event.preventDefault();
        const item = this.document;
        const index = parseInt(target.dataset.index);
        const data = duplicate(item.system);

        // Remove the entry at the specified index
        data.list.splice(index, 1);
        await item.update({ 'system.list': data.list });
    }

    static async #handleCreateEntry(event, target) {
        event.preventDefault();
        const item = this.document;
        const data = duplicate(item.system);

        // Create a new entry in the consequences array
        data.list = data.list || [];
        data.list.push('');
        await item.update({ 'system.list': data.list });
    }

    /** @override */
    async _processSubmitData(event, form, formData) {
        // Process the actor data normally
        const result = await super._processSubmitData(event, form, formData)
        return result
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
        let dragData = null;

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

        //console.log(data.type);
        // Handle different data types
        switch (data.type) {
            // write your cases
        }

        return super._onDrop?.(event);
    }
}