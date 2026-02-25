const { ItemSheetV2 } = foundry.applications.sheets
const { HandlebarsApplicationMixin } = foundry.applications.api
const { TextEditor, DragDrop } = foundry.applications.ux

export class MistEngineItemThemekitSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
    #dragDrop // Private field to hold dragDrop handlers

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'item'],
        tag: 'form',
        position: {
            width: 700,
            height: 750
        },
        actions: {
            addPowertag: this.#handleAddPowertag,
            addWeaknesstag: this.#handleAddWeaknesstag,
            deletePowertag: this.#handleDeletePowertag,
            deleteWeaknesstag: this.#handleDeleteWeaknesstag,
            addSpecialImprovement: this.#handleAddSpecialImprovement,
            importCSV: this.#handleImportCSV,
            deleteSpecialImprovement: this.#handleDeleteSpecialImprovement
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
            template: 'systems/mist-engine-fvtt/templates/item/parts/item-themekit-header.hbs'
        },
        tabs: {
            // Foundry-provided generic template
            template: 'templates/generic/tab-navigation.hbs',
            // classes: ['sysclass'], // Optionally add extra classes to the part for extra customization
        },
        powertags: {
            template: 'systems/mist-engine-fvtt/templates/item/parts/item-themekit-powertags.hbs'
        },
        weaknesstags: {
            template: 'systems/mist-engine-fvtt/templates/item/parts/item-themekit-weaknesstags.hbs'
        },
        specialimprovements:{
            template: 'systems/mist-engine-fvtt/templates/item/parts/item-themekit-specialimprovements.hbs'
        },
        quest: {
            template: 'systems/mist-engine-fvtt/templates/item/parts/item-themekit-quest.hbs'
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
                    { id: 'powertags', group: 'sheet', label: 'MIST_ENGINE.THEMEKITS.Powertags' },
                    { id: 'weaknesstags', group: 'sheet', label: 'MIST_ENGINE.THEMEKITS.WeaknessTags' },
                    { id: 'specialimprovements', group: 'sheet', label: 'MIST_ENGINE.THEMEKITS.SpecialImprovements' },
                    { id: 'quest', group: 'sheet', label: 'MIST_ENGINE.THEMEKITS.Quest' },
                    { id: 'description', group: 'sheet', label: 'MIST_ENGINE.LABELS.Description' },
                ],
            initial: 'powertags'
        }
    }

    constructor(options = {}) {
        super(options)
        this.#dragDrop = this.#createDragDropHandlers()
    }
    
    /* @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options)
        const itemData = this.document.toPlainObject();

        context.system = itemData.system;
        context.flags = itemData.flags;
        context.item = this.document;

        // Adding a pointer to CONFIG.SHADOWCITY
        context.config = CONFIG.SHADOWCITY;

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

    static async #handleAddPowertag(event, target) {
            event.preventDefault();
            // adds a new powertag to the themekit
            const item = this.document;
            const powertags = item.system.powertags || [];
            powertags.push({ name: "New Powertag" });
            await item.update({ "system.powertags": powertags });
    }

    static async #handleAddWeaknesstag(event, target) {
        event.preventDefault();
        // adds a new weaknesstag to the themekit
        const item = this.document;
        const weaknesstags = item.system.weaknesstags || [];
        weaknesstags.push({ name: "New Weaknesstag" });
        await item.update({ "system.weaknesstags": weaknesstags });
    }

    static async #handleDeletePowertag(event, target) {
        event.preventDefault();
        const item = this.document;
        const powertags = item.system.powertags || [];
        const index = target.dataset.index;
        if (index !== undefined) {
            powertags.splice(index, 1);
            await item.update({ "system.powertags": powertags });
        }
    }

    static async #handleDeleteWeaknesstag(event, target) {
        event.preventDefault();
        const item = this.document;
        const weaknesstags = item.system.weaknesstags || [];
        const index = target.dataset.index;
        if (index !== undefined) {
            weaknesstags.splice(index, 1);
            await item.update({ "system.weaknesstags": weaknesstags });
        }
    }

    static async #handleAddSpecialImprovement(event, target) {
        event.preventDefault();
        // adds a new special improvement to the themekit
        const item = this.document;
        const specialImprovements = item.system.specialImprovements || [];
        specialImprovements.push({ name: "New Special Improvement" });
        await item.update({ "system.specialImprovements": specialImprovements });
    }

    static async #handleDeleteSpecialImprovement(event, target) {
        event.preventDefault();
        const item = this.document;
        const specialImprovements = item.system.specialImprovements || [];
        const index = target.dataset.index;
        if (index !== undefined) {
            specialImprovements.splice(index, 1);
            await item.update({ "system.specialImprovements": specialImprovements });
        }
    }

    static async #handleImportCSV(event, target) {
        // we open a foundry input dialog to paste CSV data, then parse it and add powertags accordingly
        event.preventDefault();
        const item = this.document;

        // use data-type to determine if we're importing powertags or weaknesstags
        const type = target.dataset.type;
        
        // use dialogv2 to create a dialog with a textarea input for the CSV data
        const csvData = await foundry.applications.api.DialogV2.prompt({
            window: {title: "Import Tags from CSV"},
            content: `<p>Paste your CSV data below. Commas separate tags.</p><textarea name="csvData" rows="10" style="width: 100%;"></textarea>`,
            ok: {
                label: "Import",
                callback: (event, button, dialog) => {
                    return button.form.elements.csvData.value;
                }
            }
        });

        // we clear each entry in the csv and split by commas, then add each as a powertag or weaknesstag
        if (csvData) {
            const tags = item.system[type] || [];
            const csvEntries = csvData.split(',').map(sub => sub.trim()).filter(sub => sub.length > 0);
            for (const entry of csvEntries) {
                tags.push({ name: entry });
            }
            await item.update({ [`system.${type}`]: tags });
        }
    }
}