const { ItemSheetV2 } = foundry.applications.sheets
const { HandlebarsApplicationMixin } = foundry.applications.api
import { ArrayFieldAdapter } from "../lib/array-field-adapter.mjs";


export class MistEngineChallengeAddonItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'item', 'npc'],
        tag: 'form',
        position: { width: 600, height: 700 },
        actions: {
            createRole: this.#handleCreateRole,
            deleteRole: this.#handleDeleteRole,
            createTagStatus: this.#handleCreateTagStatus,
            deleteTagStatus: this.#handleDeleteTagStatus,
            createLimit: this.#handleCreateLimit,
            deleteLimit: this.#handleDeleteLimit,
            createSecret: this.#handleCreateSecret,
            deleteSecret: this.#handleDeleteSecret,
            createSpecialFeature: this.#handleCreateSpecialFeature,
            deleteSpecialFeature: this.#handleDeleteSpecialFeature,
            createThreatAndConsequence: this.#handleCreateThreatAndConsequence,
            deleteThreatAndConsequence: this.#handleDeleteThreatAndConsequence,
            createThreatAndConsequenceEntry: this.#handleCreateThreatAndConsequenceEntry,
            deleteThreatAndConsequenceEntry: this.#handleDeleteThreatAndConsequenceEntry,
        },
        form: { submitOnChange: true },
        window: { resizable: true, controls: [] }
    }

    static PARTS = {
        header: {
            template: 'systems/mist-engine-fvtt/templates/item/parts/item-header.hbs'
        },
        form: {
            template: 'systems/mist-engine-fvtt/templates/item/item-challenge-addon-sheet.hbs',
            scrollable: ['.scrollable'],
            templates: [
                'systems/mist-engine-fvtt/templates/actor/parts/npc-limits-edit-partial.hbs',
                'systems/mist-engine-fvtt/templates/actor/parts/npc-secrets.hbs',
                'systems/mist-engine-fvtt/templates/actor/parts/npc-special-features-edit-partial.hbs',
                'systems/mist-engine-fvtt/templates/actor/parts/npc-threats-edit-partial.hbs',
            ]
        }
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options)
        const itemData = this.document.toPlainObject();
        context.system = itemData.system;
        context.flags = itemData.flags;
        context.item = this.document;
        return context;
    }

    _onRender(context, options) {
        super._onRender(context, options)

        for (const input of this.element.querySelectorAll('.npc-updatable-npc-array-stat')) {
            input.addEventListener("change", event => this.handleArrayUpdate(event));
        }
        for (const input of this.element.querySelectorAll('.npc-updatable-threat-entry-stat')) {
            input.addEventListener("change", event => this.handleThreatEntryUpdate(event));
        }
        const rolesInput = this.element.querySelector('.addon-roles-input');
        rolesInput?.addEventListener("change", event => this.handleRolesInput(event));
        for (const input of this.element.querySelectorAll('.addon-tagstatus-input')) {
            input.addEventListener("change", event => this.handleTagStatusUpdate(event));
        }
    }

    // ---- field/array change handlers (operate on this.document) ----

    async handleArrayUpdate(event) {
        event.preventDefault();
        const t = event.currentTarget;
        await ArrayFieldAdapter.set(this.document, `system.${t.dataset.array}`, parseInt(t.dataset.index), t.dataset.key, t.value);
    }

    async handleThreatEntryUpdate(event) {
        event.preventDefault();
        const t = event.currentTarget;
        await ArrayFieldAdapter.set(this.document, "system.threatsAndConsequences", parseInt(t.dataset.index), `list.${parseInt(t.dataset.listindex)}`, t.value);
    }

    async handleRolesInput(event) {
        event.preventDefault();
        const roles = event.currentTarget.value.split(",").map(r => r.trim()).filter(Boolean);
        await this.document.update({ "system.roles": roles });
    }

    async handleTagStatusUpdate(event) {
        event.preventDefault();
        const t = event.currentTarget;
        const value = t.type === "checkbox" ? t.checked : (t.type === "number" ? parseInt(t.value) || 0 : t.value);
        await ArrayFieldAdapter.set(this.document, "system.floatingTagsAndStatuses", parseInt(t.dataset.index), t.dataset.key, value);
    }

    // ---- create/delete actions ----

    static async #handleCreateRole(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.roles", "");
    }
    static async #handleDeleteRole(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.remove(this.document, "system.roles", parseInt(target.dataset.index));
    }

    static async #handleCreateTagStatus(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.floatingTagsAndStatuses", { name: "", value: 0, isStatus: false });
    }
    static async #handleDeleteTagStatus(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.remove(this.document, "system.floatingTagsAndStatuses", parseInt(target.dataset.index));
    }

    static async #handleCreateLimit(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.limits", { name: "", value: "", consequence: "" });
    }
    static async #handleDeleteLimit(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.remove(this.document, "system.limits", parseInt(target.dataset.index));
    }

    static async #handleCreateSecret(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.secrets", { name: "", description: "" });
    }
    static async #handleDeleteSecret(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.remove(this.document, "system.secrets", parseInt(target.dataset.index));
    }

    static async #handleCreateSpecialFeature(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.specialFeatures", { name: "", description: "" });
    }
    static async #handleDeleteSpecialFeature(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.remove(this.document, "system.specialFeatures", parseInt(target.dataset.index));
    }

    static async #handleCreateThreatAndConsequence(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.threatsAndConsequences", { name: "", description: "", list: [] });
    }
    static async #handleDeleteThreatAndConsequence(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.remove(this.document, "system.threatsAndConsequences", parseInt(target.dataset.index));
    }

    static async #handleCreateThreatAndConsequenceEntry(event, target) {
        event.preventDefault();
        const index = parseInt(target.dataset.index);
        const list = this.document.system.threatsAndConsequences;
        if (!list || index < 0 || index >= list.length) return;
        list[index].list.push("");
        await this.document.update({ "system.threatsAndConsequences": list });
    }
    static async #handleDeleteThreatAndConsequenceEntry(event, target) {
        event.preventDefault();
        const index = parseInt(target.dataset.index);
        const listIndex = parseInt(target.dataset.listindex);
        const list = this.document.system.threatsAndConsequences;
        if (!list || index < 0 || index >= list.length) return;
        list[index].list.splice(listIndex, 1);
        await this.document.update({ "system.threatsAndConsequences": list });
    }
}
