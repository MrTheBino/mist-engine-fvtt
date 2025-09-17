import { MistEngineActorSheet } from './actor-sheet.mjs';
import {DiceRollAdapter} from '../lib/dice-roll-adapter.mjs';

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
            createBackpackItem: this.#handleCreateBackpackItem,
            deleteBackpackItem: this.#handleDeleteBackpackItem,
            clickRoll: this.#handleClickRoll,
            toggleToBurn: this.#handleToggleToBurn
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
        //context.usedGearSlots = this.options.document.usedGearSlots;
        //context.defenseCalculated = this.options.document.defenseCalculated;

        let items = this._prepareItems();

        foundry.utils.mergeObject(context, items);

        return context;
    }

    _prepareItems() {
        const themebooks = [];
        let backpack = null;

        let inventory = this.options.document.items;
        for (let i of inventory) {
            if (i.type === 'themebook') {
                themebooks.push(i);
            } else if (i.type === 'backpack') {
                backpack = i;
            }
        }

        return { themebooks: themebooks, backpack: backpack };
    }


    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        const selectablePowertags = this.element.querySelectorAll('.pt-selectable');
        for (const tag of selectablePowertags) {
            tag.addEventListener("click", event => this.handlePowerTagSelectableClick(event));
            tag.addEventListener("contextmenu", event => this.handlePowerTagSelectableRightClick(event));
        }

        const selectableWeeknesses = this.element.querySelectorAll('.wt-selectable');
        for (const tag of selectableWeeknesses) {
            tag.addEventListener("click", event => this.handleWeaknessSelectableClick(event));
        }

        const selectableBackpackItems = this.element.querySelectorAll('.bpi-selectable');
        for (const item of selectableBackpackItems) {
            item.addEventListener("click", event => this.handleBackpackItemSelectableClick(event));
        }

        const backpackItemUpdates = this.element.querySelectorAll('.backpack-item-editable');
        for (const input of backpackItemUpdates) {
            input.addEventListener("change", event => this.handleBackpackItemUpdate(event));
        }

        const developmentPartialContainers = this.element.querySelectorAll('.development-partial-container');
        for (const container of developmentPartialContainers) {
            container.addEventListener("click", event => this.handleDevelopmentPartialClick(event));
            container.addEventListener("contextmenu", event => this.handleDevelopmentPartialRightClick(event));
        }
    }

    handleDevelopmentPartialClick(event){
        const target = event.currentTarget;
        const item = this.actor.items.get(target.dataset.itemId);
        if (!item) return;
        const key = target.dataset.valueKey;
        let path = `${key}`;
        
        let prop = foundry.utils.getProperty(item, path);
        prop = prop ? prop + 1 : 1;
        if(prop > 3) prop = 3;

        item.update({ [path]: prop });
    }

    handleDevelopmentPartialRightClick(event){
        const target = event.currentTarget;
        const item = this.actor.items.get(target.dataset.itemId);
        if (!item) return;
        const key = target.dataset.valueKey;
        let path = `${key}`;
        
        let prop = foundry.utils.getProperty(item, path);
        prop = prop ? prop - 1 : 0;
        if(prop < 0) prop = 0;

        item.update({ [path]: prop });
    }

    handleBackpackItemUpdate(event){
        event.preventDefault();
        const input = event.currentTarget;
        const itemId = input.dataset.itemId;
        const itemIndex = input.dataset.itemIndex;
        const newName = input.value;

        const backpack = this.options.document.items.get(itemId);
        if (!backpack) return;

        const backpackItems = backpack.system.items;
        backpackItems[itemIndex].name = newName;

        backpack.update({
            "system.items": backpackItems
        });
    }

    handleWeaknessSelectableClick(event) {
         event.preventDefault();
        const tag = event.currentTarget;
        const itemId = tag.dataset.itemId;
        const actor = this.options.document;
        const item = actor.items.get(itemId);
        if (!item) return;
        if(item.system.burned) return;

        const ptIndex = tag.dataset.weeknesstagIndex;
        let path = `system.weeknesstag${ptIndex}.selected`;
        let prop = foundry.utils.getProperty(item, path);

        item.update({ [path]: !prop });
    }

    handlePowerTagSelectableRightClick(event) {
        event.preventDefault();
        const tag = event.currentTarget;
        const itemId = tag.dataset.itemId;
        const actor = this.options.document;
        const item = actor.items.get(itemId);
        if (!item) return;
        const ptIndex = tag.dataset.powertagIndex;
        let path = `system.powertag${ptIndex}.burned`;
        let prop = foundry.utils.getProperty(item, path);

        item.update({ [path]: !prop });
    }

    handlePowerTagSelectableClick(event) {
        event.preventDefault();
        const tag = event.currentTarget;
        const itemId = tag.dataset.itemId;
        const actor = this.options.document;
        const item = actor.items.get(itemId);
        if (!item) return;
        const ptIndex = tag.dataset.powertagIndex;
        let path = `system.powertag${ptIndex}.selected`;
        let prop = foundry.utils.getProperty(item, path);

        let burnedPath = `system.powertag${ptIndex}.burned`;
        if(foundry.utils.getProperty(item, burnedPath)){
            return;
        }

        item.update({ [path]: !prop });

        if(!prop == false){//if it was not selected and now is, remove toBurn
            item.update({ [`system.powertag${ptIndex}.toBurn`]: false });
        }
    }

    async handleBackpackItemSelectableClick(event) {
        event.preventDefault();
        const item = event.currentTarget;
        const itemId = item.dataset.itemId;
        const actor = this.options.document;
        const backpack = actor.items.get(itemId);
        if (!backpack) return;
        const itemIndex = item.dataset.itemIndex;
        let backpackItems = backpack.system.items;
        if (!backpackItems || itemIndex >= backpackItems.length) return;
        backpackItems[itemIndex].selected = !backpackItems[itemIndex].selected;

        await backpack.update({
            "system.items": backpackItems
        });
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
    }

    static async #handleCreateBackpackItem(event, target) {
        event.preventDefault();
        const backpack = this.actor.items.get(target.dataset.itemId);

        const backpackItems = backpack.system.items;
        
        if (backpackItems) {
            await backpack.update({
                "system.items": [
                    ...backpackItems,
                    { name: "New Item", selected: false }
                ]
            });
        } else {
            await backpack.update({
                "system.items": [
                    { name: "New Item", selected: false }
                ]
            });
        }

    }

    static async #handleToggleToBurn(event, target) {
        event.preventDefault();
        const actor = this.actor;
        const itemId = target.dataset.itemId;
        const item = actor.items.get(itemId);
        if (!item) return;

        const powertagIndex = target.dataset.powertagIndex;
        const powertag = foundry.utils.getProperty(item, `system.powertag${powertagIndex}`);
        if (!powertag) return;

        let burnedPath = `system.powertag${powertagIndex}.burned`;
        if(foundry.utils.getProperty(item, burnedPath)){
            return;
        }

        powertag.toBurn = !powertag.toBurn;
        await item.update({ [`system.powertag${powertagIndex}`]: powertag });

        let path = `system.powertag${powertagIndex}.selected`;
        let prop = foundry.utils.getProperty(item, path);

        await item.update({ [path]: powertag.toBurn });
    }

    static async #handleClickRoll(event, target) {
        event.preventDefault();
        const actor = this.actor;
        const diceRollAdapter = new DiceRollAdapter({actor: actor,type: target.dataset.rollType});
        diceRollAdapter.render();
    }
}