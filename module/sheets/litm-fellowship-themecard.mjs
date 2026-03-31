import { MistEngineActorSheet } from './actor-sheet.mjs';

export class MistEngineLegendInTheMistFellowshipThemecard extends MistEngineActorSheet {
    #dragDrop // Private field to hold dragDrop handlers
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'actor','litm-fellowship-themecard'],
        tag: 'form',
        position: {
            width: 600,
            height: 850
        },
        actions: {
            deletePowertag: this.#handleDeletePowertag,
            deleteWeaknessTag: this.#handleDeleteWeaknessTag,
            addEmptyPowertag: this.#handleAddEmptyPowertag,
            addEmptyWeaknessTag: this.#handleAddEmptyWeaknessTag
        },
        form: {
            submitOnChange: true
        },
        actor: {
            type: 'litm-fellowship-themecard'
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
            template: 'systems/mist-engine-fvtt/templates/actor/parts/fellowship-themecard-header.hbs',
            scrollable: ['.scrollable']
        },
        tabs: {
            id: 'tabs',
            template: 'templates/generic/tab-navigation.hbs'
        },
        themebook:{
          id: 'themebook',
          template: 'systems/mist-engine-fvtt/templates/actor/litm-fellowship-themecard/tab-themebook.hbs',
          scrollable: ['']
        },
        special_improvements:{
          id: 'special_improvements',
          template: 'systems/mist-engine-fvtt/templates/actor/litm-fellowship-themecard/tab-special-improvements.hbs',
          scrollable: ['']
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
                    { id: 'themebook', group: 'sheet', label: 'Themebook' },
                    { id: 'special_improvements', group: 'sheet', label: 'Special Improvements' },
                ],
            initial: 'themebook'
        }
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        const elements = this.element.querySelectorAll('.themebook-entry-input');
        for (const el of elements) {
            el.addEventListener("change", event => this.handleThemebookEntryInputChanged(event));
        }
    }

    async handleThemebookEntryInputChanged(event) {
        //console.log("Themebook entry input changed", event.target);
        //console.log("Dataset:", event.target.dataset);
        //console.log("Value:", event.target.value);
        //console.log("Key:", event.target.dataset.key);
        await this.actor.update({ [event.target.dataset.key]: event.target.value });
    }

    /*
        @override
    */
    static async #handleAddEmptyPowertag(event, target) {
        event.preventDefault();

        this._saveScrollPositions();
        let powertags = this.actor.system.powertags || [];
        powertags.push({ name: "New Powertag", value: "" });
        await this.actor.update({ "system.powertags": powertags });
    }

    static async #handleAddEmptyWeaknessTag(event, target) {
        event.preventDefault();
        
        this._saveScrollPositions();
        let weaknesses = this.actor.system.weaknesstags || [];
        weaknesses.push({ name: "New Weakness", value: "" });
        await this.actor.update({ "system.weaknesstags": weaknesses });
    }

    static async #handleDeletePowertag(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        
        this._saveScrollPositions();
        let powertags = this.actor.system.powertags || [];
        if (index < 0 || index >= powertags.length) {
            console.error("Invalid powertag index for deletion", { itemId, index });
            return;
        }
        powertags.splice(index, 1);
        await this.actor.update({ "system.powertags": powertags });
    }

    static async #handleDeleteWeaknessTag(event, target) {
        event.preventDefault();
        const index = target.dataset.index;

        this._saveScrollPositions();
        let weaknesses = this.actor.system.weaknesstags || [];
        if (index < 0 || index >= weaknesses.length) {
            console.error("Invalid weakness index for deletion", { index });
            return;
        }
        
        weaknesses.splice(index, 1);
        await this.actor.update({ "system.weaknesstags": weaknesses });
    }
}