import { MistEngineItemSheet } from "./item-sheet.mjs";
import { ArrayFieldAdapter } from "../lib/array-field-adapter.mjs";

export class MistEngineRoteItemSheet extends MistEngineItemSheet {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        position: {
            width: 620,
            height: 720
        },
        actions: {
            addRotePowertag: this.#handleAddPowertag,
            deleteRotePowertag: this.#handleDeletePowertag,
            addRoteWeaknesstag: this.#handleAddWeaknesstag,
            deleteRoteWeaknesstag: this.#handleDeleteWeaknesstag
        }
    }

    /* @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        const enrich = (html) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", {
            secrets: this.document.isOwner,
            rollData: this.document.getRollData(),
            relativeTo: this.document,
        });

        context.successHTML = await enrich(this.document.system.success);
        context.consequencesHTML = await enrich(this.document.system.consequences);
        return context;
    }

    static async #handleAddPowertag(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.powertags", { name: "" });
    }

    static async #handleDeletePowertag(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.remove(this.document, "system.powertags", parseInt(target.dataset.index));
    }

    static async #handleAddWeaknesstag(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.weaknesstags", { name: "" });
    }

    static async #handleDeleteWeaknesstag(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.remove(this.document, "system.weaknesstags", parseInt(target.dataset.index));
    }
}
