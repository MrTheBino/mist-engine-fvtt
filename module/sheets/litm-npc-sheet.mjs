import { MistEngineActorSheet } from './actor-sheet.mjs';
import { DiceRollAdapter } from '../lib/dice-roll-adapter.mjs';

export class MistEngineLegendInTheMistNpcSheet extends MistEngineActorSheet {
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
            createLimit: this.#handleCreateLimit,
            createTagOrStatus: this.#handleCreateTagOrStatus,
            createSpecialFeature: this.#handleCreateSpecialFeature,
            createThreatAndConsequence: this.#handleCreateThreatAndConsequence,
            createThreatAndConsequenceEntry: this.#handleCreateThreatAndConsequenceEntry,
            deleteLimit: this.#handleDeleteLimit,
            deleteTagOrStatus: this.#handleDeleteTagOrStatus,
            deleteSpecialFeature: this.#handleDeleteSpecialFeature,
            deleteThreadAndConsequence: this.#handleDeleteThreadAndConsequence,
            deleteThreadAndConsequenceEntry: this.#handleDeleteThreadAndConsequenceEntry
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
            template: 'systems/mist-engine-fvtt/templates/actor/parts/npc-header.hbs'
        },
        tabs: {
            id: 'tabs',
            template: 'templates/generic/tab-navigation.hbs'
        },
        npc: {
            id: 'npc',
            template: 'systems/mist-engine-fvtt/templates/actor/parts/tab-litm-npc.hbs'
        },
        biography: {
            id: 'biography',
            template: 'systems/mist-engine-fvtt/templates/shared/tab-biography.hbs'
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
                    { id: 'npc', group: 'sheet', label: 'Details' },
                    { id: 'biography', group: 'sheet', label: 'Biography' }
                ],
            initial: 'npc'
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

        const npcUpdatableNpcArrayStats = this.element.querySelectorAll('.npc-updatable-npc-array-stat');
        for (let input of npcUpdatableNpcArrayStats) {
            input.addEventListener("change", event => this.handleNpcItemNpcArrayUpdate(event));
        }

        const npcUpdatableThreatEntryStats = this.element.querySelectorAll('.npc-updatable-threat-entry-stat');
        for (let input of npcUpdatableThreatEntryStats) {
            input.addEventListener("change", event => this.handleNpcItemThreatEntryUpdate(event));
        }
    }

    static async #handleDeleteThreadAndConsequenceEntry(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        const listIndex = target.dataset.listindex;
        const threatsAndConsequences = this.actor.system.threatsAndConsequences;
        if (threatsAndConsequences && threatsAndConsequences.length > 0) {
            threatsAndConsequences[index].list.splice(listIndex, 1);
            await this.actor.update({ "system.threatsAndConsequences": threatsAndConsequences });
        }
    }

    static async #handleDeleteThreadAndConsequence(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        const threatsAndConsequences = this.actor.system.threatsAndConsequences;
        if (threatsAndConsequences && threatsAndConsequences.length > 0) {
            threatsAndConsequences.splice(index, 1);
            await this.actor.update({ "system.threatsAndConsequences": threatsAndConsequences });
        }
    }

    async handleNpcItemNpcArrayUpdate(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const arrayIndex = parseInt(target.dataset.index);
        const arrayName = target.dataset.array;
        const key = target.dataset.key;

        let path = `system.${arrayName}`;
        let arrayData = foundry.utils.getProperty(this.actor, path);
        foundry.utils.setProperty(arrayData[arrayIndex], key, target.value);

        await this.actor.update({ [path]: arrayData });
    }

    async handleNpcItemThreatEntryUpdate(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const arrayIndex = parseInt(target.dataset.index);
        const listIndex = parseInt(target.dataset.listindex);
        const key = target.dataset.key;
        const arrayName = "threatsAndConsequences";
        let path = `system.${arrayName}`;
        let arrayData = foundry.utils.getProperty(this.actor, path);
        arrayData[arrayIndex].list[listIndex] = target.value;

        await this.actor.update({ [path]: arrayData });
        await this.actor.sheet.render(true);
    }

    static async #handleDeleteTagOrStatus(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        const tags_and_statuses = this.actor.system.tags_and_statuses;
        if (tags_and_statuses && tags_and_statuses.length > 0) {
            tags_and_statuses.splice(index, 1);
            await this.actor.update({ "system.tags_and_statuses": tags_and_statuses });
        }
    }

    static async #handleDeleteLimit(event, target) {
        event.preventDefault();
        const index = target.dataset.index;

        const limits = this.actor.system.limits;
        if (limits && limits.length > 0) {
            limits.splice(index, 1);
            await this.actor.update({ "system.limits": limits });
        }
    }

    static async #handleDeleteSpecialFeature(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        const specialFeatures = this.actor.system.specialFeatures;
        if (specialFeatures && specialFeatures.length > 0) {
            specialFeatures.splice(index, 1);
            await this.actor.update({ "system.specialFeatures": specialFeatures });
        }
    }

    static async #handleCreateThreatAndConsequenceEntry(event, target) {
        event.preventDefault
        const threatsAndConsequences = this.actor.system.threatsAndConsequences;
        const index = parseInt(target.dataset.index);
        if (!threatsAndConsequences || threatsAndConsequences.length <= index) return;

        threatsAndConsequences[index].list.push("New Entry");
        await this.actor.update({ "system.threatsAndConsequences": threatsAndConsequences });
        await this.actor.sheet.render(true);
    }

    static async #handleCreateThreatAndConsequence(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        const threatsAndConsequences = this.actor.system.threatsAndConsequences;

        if (threatsAndConsequences) {
            await this.actor.update({
                "system.threatsAndConsequences": [
                    ...threatsAndConsequences,
                    { name: "New Threat", description: "", list: [] }
                ]
            });
        } else {
            await this.actor.update({
                "system.threatsAndConsequences": [
                    { name: "New Threat", description: "", list: [] }
                ]
            });
        }

        await this.actor.sheet.render(true);
    }

    static async #handleCreateSpecialFeature(event, target) {
        event.preventDefault();

        const specialFeatures = this.actor.system.specialFeatures;

        if (specialFeatures) {
            await this.actor.update({
                "system.specialFeatures": [
                    ...specialFeatures,
                    { name: "New Special", description: "" }
                ]
            });
        } else {
            await this.actor.update({
                "system.specialFeatures": [
                    { name: "New Special", description: "" }
                ]
            });
        }
    }

    static async #handleCreateTagOrStatus(event, target) {
        event.preventDefault();

        const tags_and_statuses = this.actor.system.tags_and_statuses;

        if (tags_and_statuses) {
            await this.actor.update({
                "system.tags_and_statuses": [
                    ...tags_and_statuses,
                    { name: "New Tag / Status", value: 0, symbol: "" }
                ]
            });
        } else {
            await this.actor.update({
                "system.tags_and_statuses": [
                    { name: "New Tag / Status", value: 0, symbol: "" }
                ]
            });
        }
    }

    static async #handleCreateLimit(event, target) {
        event.preventDefault();

        const limits = this.actor.system.limits;

        if (limits) {
            await this.actor.update({
                "system.limits": [
                    ...limits,
                    { name: "New Limit", value: 0 }
                ]
            });
        } else {
            await this.actor.update({
                "system.limits": [
                    { name: "New Limit", value: 0 }
                ]
            });
        }
    }
}