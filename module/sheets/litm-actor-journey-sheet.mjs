import { MistEngineActorSheet } from './actor-sheet.mjs';
import { DiceRollApp } from '../apps/dice-roll-app.mjs';
import { PowerTagAdapter } from '../lib/power-tag-adapter.mjs';
import { MistSceneApp } from '../apps/scene-app.mjs';

export class MistEngineLegendInTheMistJourneySheet extends MistEngineActorSheet {
#dragDrop // Private field to hold dragDrop handlers
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'actor', 'litm-journey'],
        tag: 'form',
        position: {
            width: 1000,
            height: 750
        },
        actions: {
            deleteChallengeListItem: this.#handleDeleteChallengeListItem,
            createChallengeListEntry: this.#handleCreateChallengeListEntry,
            createChallenge: this.#handleCreateChallenge,
            deleteChallenge: this.#handleDeleteChallenge
        },
        form: {
            submitOnChange: true
        },
        actor: {
            type: 'joruney'
        },
        dragDrop: [{
            dragSelector: '[draggable="true"]',
            dropSelector: '.mist-engine.journey'
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
            template: 'systems/mist-engine-fvtt/templates/actor/parts/journey-header.hbs'
        },
        tabs: {
            id: 'tabs',
            template: 'templates/generic/tab-navigation.hbs'
        },
        "journey-consequences": {
            id: 'journey-consequences',
            template: 'systems/mist-engine-fvtt/templates/actor/parts/journey-consequences.hbs'
        },
        notes: {
            id: 'notes',
            template: 'systems/mist-engine-fvtt/templates/shared/tab-notes.hbs'
        }
    }

      /**
   * Define the structure of tabs used by this sheet.
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
    static TABS = {
        "litm-journey-sheet": { // this is the group name
            tabs:
                [
                    { id: 'journey-consequences', group: 'litm-journey-sheet', label: 'MIST_ENGINE.LABELS.JourneyConsequences' },
                    { id: 'notes', group: 'litm-journey-sheet', label: 'MIST_ENGINE.LABELS.Notes' }
                    
                ],
            initial: 'journey-consequences'
        }
    }

    async _prepareContext(options) {
        let context = await super._prepareContext(options);
        const actorData = this.document.toPlainObject();
        let items = this._prepareItems();
        context.editMode = actorData.system.editMode;

        foundry.utils.mergeObject(context, items);

        return context;
    }

    _prepareItems() {
        const challenges = [];

        let inventory = this.options.document.items;
        for (let i of inventory) {
            if (i.type === 'shortchallenge') {
                challenges.push(i);
            }
        }

        return { challenges: challenges};
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        const editableChallengeItems =  this.element.querySelectorAll('.editable-challenge-item');
        for (const input of editableChallengeItems) {
            input.addEventListener("change", event => this.handleChallengeItemUpdate(event)) // right click is for changing the burn state
        }

        const editableChallengeItemListEntries = this.element.querySelectorAll('.editable-challenge-item-list-entry');
        for (const input of editableChallengeItemListEntries) {
            input.addEventListener("change", event => this.handleChallengeItemListUpdate(event)) // right click is for changing the burn state
        }
    }

    async handleChallengeItemUpdate(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const field = event.currentTarget.dataset.key;
        const value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;
      

        await item.update({ [field]: value });
    }

    async handleChallengeItemListUpdate(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const index = parseInt(event.currentTarget.dataset.index);
        const value = event.currentTarget.value;
        const list = item.system.list;
        list[index] = value;
        await item.update({ 'system.list': list });
    }

    static async #handleDeleteChallengeListItem(event, target) {
        event.preventDefault();
        const itemId = target.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const index = parseInt(target.dataset.index);
        const list = item.system.list;
        list.splice(index, 1);
        await item.update({ 'system.list': list });
    }

    static async #handleCreateChallengeListEntry(event, target) {
        event.preventDefault();
        const itemId = target.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const list = item.system.list;
        list.push("");
        await item.update({ 'system.list': list });
    }

    static async #handleCreateChallenge(event, target) {
        event.preventDefault();
        await this.actor.createEmbeddedDocuments("Item", [{
            name: "New Challenge",
            type: "shortchallenge",
            system: {
                shortDescription: "",
                list: []
            }
        }]);
    }

    static async #handleDeleteChallenge(event, target) {
        event.preventDefault();
        const proceed = await foundry.applications.api.DialogV2.confirm({
            content: game.i18n.format("MIST_ENGINE.QUESTIONS.DeleteChallenge"),
            rejectClose: false,
            modal: true
        });
        if (proceed) {
            const itemId = target.dataset.itemId;
            await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
        }
    }
}