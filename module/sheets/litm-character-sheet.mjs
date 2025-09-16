import { MistEngineActorSheet } from './actor-sheet.mjs';

export class MistEngineLegendInTheMistCharacterSheet extends MistEngineActorSheet {
    #dragDrop // Private field to hold dragDrop handlers
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'actor'],
        tag: 'form',
        position: {
            width: 800,
            height: 750
        },
        actions: {
        },
        form: {
            submitOnChange: true
        },
        actor: {
            type: 'character'
        },
        dragDrop: [{
            dragSelector: '[data-drag="true"]',
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
            template: 'templates/generic/tab-navigation.hbs'
        },
        character: {
            id: 'character',
            template: 'systems/mist-engine-fvtt/templates/actor/parts/tab-litm-character.hbs'
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
                    { id: 'character', group: 'sheet', label: 'Details' }
                ],
            initial: 'character'
        }
    }

        /** @override */
    async _prepareContext(options) {
        let context = await super._prepareContext(options);
        console.log(context);
        //context.usedGearSlots = this.options.document.usedGearSlots;
        //context.defenseCalculated = this.options.document.defenseCalculated;

        let items = this._prepareItems();

        foundry.utils.mergeObject(context, items);

        console.log(context);
        return context;
    }

    _prepareItems() {
        const themebooks = [];

        let inventory = this.options.document.items;
        for (let i of inventory) {
            if (i.type === 'themebook') {
                themebooks.push(i);
            }
        }

        return { themebooks: themebooks};
    }

      /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        const selectablePowertags = this.element.querySelectorAll('.pt-selectable');
        for (const tag of selectablePowertags) {
            tag.addEventListener("click", event => this.handlePowerTagSelectableClick(event));
        }
    }

    handlePowerTagSelectableClick(event){
        event.preventDefault();
        const tag = event.currentTarget;
        const itemId = tag.dataset.itemId;
        const actor = this.options.document;
        const item = actor.items.get(itemId);
        if (!item) return;
        const ptIndex = tag.dataset.powertagIndex;
        let path = `system.powertag${ptIndex}.selected`;
        let prop = foundry.utils.getProperty(item, path);

        item.update({[path]: !prop});
    }
}