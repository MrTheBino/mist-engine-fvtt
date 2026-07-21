import { MistEngineActorSheet } from './actor-sheet.mjs';
import { DiceRollApp } from '../apps/dice-roll-app.mjs';
import { PowerTagAdapter } from '../lib/power-tag-adapter.mjs';
import { MistSceneApp } from '../apps/scene-app.mjs';
import { importVignetteForActorJSON } from '../lib/json-importer.mjs';
import { confirmDeletion } from '../lib/confirm-deletion.mjs';
import { enrichShortChallenges, enrichTextWithTags } from '../lib/tag-status-text-helper.mjs';
import { ArrayFieldAdapter } from '../lib/array-field-adapter.mjs';

export class MistEngineLegendInTheMistJourneySheet extends MistEngineActorSheet {
    #dragDrop // Private field to hold dragDrop handlers
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'actor', 'litm-journey'],
        tag: 'form',
        position: {
            width: 800,
            height: 750
        },
        actions: {
            createGeneralConsequence: this.#handleCreateGeneralConsequence,
            deleteGeneralConsequence: this.#handleDeleteGeneralConsequence,
            deleteChallengeListItem: this.#handleDeleteChallengeListItem,
            createChallengeListEntry: this.#handleCreateChallengeListEntry,
            createChallenge: this.#handleCreateChallenge,
            deleteChallenge: this.#handleDeleteChallenge,
            importChallengeJSON: this.#handleImportChallengeJSON
        },
        form: {
            submitOnChange: true
        },
        actor: {
            type: 'journey'
        },
        dragDrop: [{
            dragSelector: '[draggable="true"]',
            // Must match the sheet's root classes (mist-engine sheet actor
            // litm-journey) — the previous '.mist-engine.journey' matched
            // nothing, so the sheet never received drops at all.
            dropSelector: '.mist-engine.actor'
        }],
        window: {
            resizable: true,
            controls: [
            ]
        },
        scrollY: ['.journey-consequences']
    }

    static PARTS = {
        header: {
            id: 'header',
            template: 'systems/mist-engine-fvtt/templates/actor/parts/journey-header.hbs'
        },
        tabs: {
            id: 'tabs',
            template: 'templates/generic/tab-navigation.hbs',
            classes: ["litm-journey-sheet-tabs"]
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

        foundry.utils.mergeObject(context, items);

        // Enrich view-mode text so @UUID[...]{Label} links render as real
        // content links (issue #73, same treatment as the Challenge sheet).
        context.generalConsequencesHTML = await Promise.all(
            (this.document.system.generalConsequences ?? []).map((entry) => enrichTextWithTags(entry, this.document))
        );
        context.challenges = await enrichShortChallenges(context.challenges ?? [], this.document);

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

        return { challenges: challenges };
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);
        this._restoreScrollPositions();

        // If the actor has a custom background, set it as the background image of the sheet.
        const el = this.element.querySelector?.(".window-content") ?? this.element;
        if (this.actor.system.customBackground){
            el.style.setProperty("background-image", `url("${this.actor.system.customBackground}"), url("systems/mist-engine-fvtt/assets/paper_background_1.webp")`);
            el.style.setProperty("background-size", "contain, cover");
        } else {
            el.style.removeProperty("background-image");
            el.style.removeProperty("background-size");
        }

        const editableChallengeItems = this.element.querySelectorAll('.editable-challenge-item');
        for (const input of editableChallengeItems) {
            input.addEventListener("change", event => this.handleChallengeItemUpdate(event));
            input.addEventListener("keydown", (event) => this.handleInputShortCutsForGM(event));
        }

        const editableChallengeItemListEntries = this.element.querySelectorAll('.editable-challenge-item-list-entry');
        for (const input of editableChallengeItemListEntries) {
            input.addEventListener("change", event => this.handleChallengeItemListUpdate(event));
            input.addEventListener("keydown", (event) => this.handleInputShortCutsForGM(event));
        }

        const textareasShortDescriptions = this.element.querySelectorAll('.textarea-short-description');
        for (const input of textareasShortDescriptions) {
            input.addEventListener("keydown", (event) => this.handleInputShortCutsForGM(event));
        }

        const taggableText = this.element.querySelectorAll('.taggable-text');
        for (const input of taggableText) {
            input.addEventListener("keydown", (event) => this.handleInputShortCutsForGM(event));
        }
    }

    /**
     * @override The journey's general-consequence inputs (list entries
     * without a data-item-id), then the shared challenge fields.
     */
    _getUuidDroppableField(target) {
        if (target instanceof HTMLInputElement
            && target.classList.contains("editable-challenge-item-list-entry")
            && !target.dataset.itemId) {
            return target;
        }
        return super._getUuidDroppableField(target);
    }

    /** @override Persist general consequences; shared challenge fields defer to the base. */
    async _persistUuidDroppedText(field, value) {
        if (field.classList.contains("editable-challenge-item-list-entry") && !field.dataset.itemId) {
            const index = Number.parseInt(field.dataset.index, 10);
            if (Number.isNaN(index)) return;
            await ArrayFieldAdapter.setIndex(this.actor, "system.generalConsequences", index, value);
            return;
        }
        return super._persistUuidDroppedText(field, value);
    }

    async handleChallengeItemUpdate(event) {
        event.preventDefault();
        this._saveScrollPositions();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const field = event.currentTarget.dataset.key;
        const value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;


        await item.update({ [field]: value });
    }

    async handleChallengeItemListUpdate(event) {
        event.preventDefault();
        this._saveScrollPositions();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const index = parseInt(event.currentTarget.dataset.index);
        const value = event.currentTarget.value;
        const list = item.system.list;
        list[index] = value;
        await item.update({ 'system.list': list });
    }

    static async #handleCreateGeneralConsequence(event, target) {
        event.preventDefault();
        this._saveScrollPositions();
        this.actor.system.generalConsequences.push("");
        this.actor.update({ system: { generalConsequences: this.actor.system.generalConsequences } });
    }

    static async #handleDeleteGeneralConsequence(event, target) {
        event.preventDefault();
        if (!(await confirmDeletion())) return;
        this._saveScrollPositions();
        this.actor.system.generalConsequences.splice(target.dataset.index, 1);
        this.actor.update({ system: { generalConsequences: this.actor.system.generalConsequences } });
    }

    static async #handleDeleteChallengeListItem(event, target) {
        event.preventDefault();
        if (!(await confirmDeletion())) return;
        this._saveScrollPositions();
        const itemId = target.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const index = parseInt(target.dataset.index);
        const list = item.system.list;
        list.splice(index, 1);
        await item.update({ 'system.list': list });
    }

    static async #handleCreateChallengeListEntry(event, target) {
        event.preventDefault();
        this._saveScrollPositions();
        const itemId = target.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const list = item.system.list;
        list.push("");
        await item.update({ 'system.list': list });
    }

    static async #handleCreateChallenge(event, target) {
        event.preventDefault();
        this._saveScrollPositions();
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

    static async #handleImportChallengeJSON(event, target) {
        event.preventDefault();
        // Open dialog for entering JSON data
        const jsonText = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Import Vignette from JSON" },
            content: `<textarea name="jsonData" rows="10" autofocus></textarea>`,
            ok: {
                label: "Import",
                callback: (event, button, dialog) => button.form.elements.jsonData.value
            }
        });
        console.log("JSON data entered:", jsonText);
        if (jsonText) {
            try {
                const parsedData = JSON.parse(jsonText);
                await importVignetteForActorJSON(this.actor, parsedData);
                ui.notifications.info(game.i18n.format("MIST_ENGINE.NOTIFICATIONS.ImportChallengeJSONSuccess"));
            } catch (error) {
                console.error("Error parsing JSON:", error);
                ui.notifications.error(game.i18n.format("MIST_ENGINE.NOTIFICATIONS.ImportChallengeJSONError"));
            }
        }
    }

}