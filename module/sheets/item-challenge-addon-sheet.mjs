const { ItemSheetV2 } = foundry.applications.sheets
const { HandlebarsApplicationMixin } = foundry.applications.api
import { ArrayFieldAdapter } from "../lib/array-field-adapter.mjs";
import { confirmDeletion } from "../lib/confirm-deletion.mjs";
import { wireEditUx } from "../lib/sheet-edit-ux.mjs";


export class MistEngineChallengeAddonItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

    #scrollPositions; // preserves scroll across submitOnChange re-renders
    #scrollListenerAttached = false;

    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'item', 'npc'],
        tag: 'form',
        position: { width: 600, height: 700 },
        actions: {
            createRole: this.#handleCreateRole,
            deleteRole: this.#handleDeleteRole,
            createMightyAspect: this.#handleCreateMightyAspect,
            deleteMightyAspect: this.#handleDeleteMightyAspect,
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
                'systems/mist-engine-fvtt/templates/actor/parts/mighty-aspects-edit-partial.hbs',
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
        this._restoreScrollPositions();

        if (!this.#scrollListenerAttached) {
            this.#scrollListenerAttached = true;
            this.element.addEventListener("change", () => this._saveScrollPositions(), true);
            this.element.addEventListener("pointerdown", (event) => {
                if (event.target.closest("[data-action]")) this._saveScrollPositions();
            }, true);
        }

        for (const input of this.element.querySelectorAll('.npc-updatable-npc-array-stat')) {
            input.addEventListener("change", event => this.handleArrayUpdate(event));
            input.addEventListener("keydown", event => this.handleInputShortCutsForGM(event));
        }
        for (const select of this.element.querySelectorAll('.npc-might-level-select')) {
            select.addEventListener("change", event => this.handleMightLevelSelect(event));
        }
        for (const input of this.element.querySelectorAll('.npc-updatable-threat-entry-stat')) {
            input.addEventListener("change", event => this.handleThreatEntryUpdate(event));
            input.addEventListener("keydown", event => this.handleInputShortCutsForGM(event));
        }
        const rolesInput = this.element.querySelector('.addon-roles-input');
        rolesInput?.addEventListener("change", event => this.handleRolesInput(event));
        for (const input of this.element.querySelectorAll('.addon-tagstatus-input')) {
            input.addEventListener("change", event => this.handleTagStatusUpdate(event));
        }
        wireEditUx(this, this.element);
    }

    _saveScrollPositions() {
        this.#scrollPositions = {};
        this.element?.querySelectorAll('.scrollable').forEach((el, index) => {
            this.#scrollPositions[index] = el.scrollTop;
        });
    }

    _restoreScrollPositions() {
        if (!this.#scrollPositions) return;
        requestAnimationFrame(() => {
            this.element?.querySelectorAll('.scrollable').forEach((el, index) => {
                if (this.#scrollPositions[index] === undefined) return;
                const original = el.style.scrollBehavior;
                el.style.scrollBehavior = 'auto';
                el.scrollTop = this.#scrollPositions[index];
                if (original) el.style.scrollBehavior = original;
                else el.style.removeProperty('scroll-behavior');
            });
        });
    }

    handleInputShortCutsForGM(event) {
        const input = event.currentTarget;
        if (!(event.ctrlKey && event.shiftKey)) return;
        const key = event.key.toLowerCase();
        if (key !== "s" && key !== "y" && key !== "a" && key !== "x") return;

        event.preventDefault();
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const value = input.value ?? "";
        if (start === end) return; // nothing selected

        const selectedText = value.slice(start, end);
        const wrap = { s: `[/s ${selectedText}]`, y: `[/b ${selectedText}]`, a: `[${selectedText}]`, x: `[/m ${selectedText}]` };
        input.value = value.slice(0, start) + wrap[key] + value.slice(end);
        input.setSelectionRange(start + 1, end + 1);
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // ---- field/array change handlers (operate on this.document) ----

    async handleArrayUpdate(event) {
        event.preventDefault();
        const t = event.currentTarget;
        await ArrayFieldAdapter.set(this.document, `system.${t.dataset.array}`, parseInt(t.dataset.index), t.dataset.key, t.value);
    }

    async handleMightLevelSelect(event) {
        event.preventDefault();
        const select = event.currentTarget;
        const index = parseInt(select.dataset.index);
        const customInput = select.parentElement?.querySelector(".npc-might-level-custom");

        if (select.value === "__custom__") {
            if (customInput) {
                customInput.hidden = false;
                customInput.focus();
            }
            return;
        }

        if (customInput) customInput.hidden = true;
        await ArrayFieldAdapter.set(this.document, "system.mightyAspects", index, "level", select.value);
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
        if (!(await confirmDeletion())) return;
        await ArrayFieldAdapter.remove(this.document,"system.roles", parseInt(target.dataset.index));
    }

    static async #handleCreateMightyAspect(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.mightyAspects", { level: "origin", aspect: "", mightIcon: "" });
    }
    static async #handleDeleteMightyAspect(event, target) {
        event.preventDefault();
        if (!(await confirmDeletion())) return;
        await ArrayFieldAdapter.remove(this.document, "system.mightyAspects", parseInt(target.dataset.index));
    }

    static async #handleCreateTagStatus(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.floatingTagsAndStatuses", { name: "", value: 0, isStatus: false });
    }
    static async #handleDeleteTagStatus(event, target) {
        event.preventDefault();
        if (!(await confirmDeletion())) return;
        await ArrayFieldAdapter.remove(this.document,"system.floatingTagsAndStatuses", parseInt(target.dataset.index));
    }

    static async #handleCreateLimit(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.limits", { name: "", value: "", consequence: "" });
    }
    static async #handleDeleteLimit(event, target) {
        event.preventDefault();
        if (!(await confirmDeletion())) return;
        await ArrayFieldAdapter.remove(this.document,"system.limits", parseInt(target.dataset.index));
    }

    static async #handleCreateSecret(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.secrets", { name: "", description: "" });
    }
    static async #handleDeleteSecret(event, target) {
        event.preventDefault();
        if (!(await confirmDeletion())) return;
        await ArrayFieldAdapter.remove(this.document,"system.secrets", parseInt(target.dataset.index));
    }

    static async #handleCreateSpecialFeature(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.specialFeatures", { name: "", description: "" });
    }
    static async #handleDeleteSpecialFeature(event, target) {
        event.preventDefault();
        if (!(await confirmDeletion())) return;
        await ArrayFieldAdapter.remove(this.document,"system.specialFeatures", parseInt(target.dataset.index));
    }

    static async #handleCreateThreatAndConsequence(event, target) {
        event.preventDefault();
        await ArrayFieldAdapter.add(this.document, "system.threatsAndConsequences", { name: "", description: "", list: [] });
    }
    static async #handleDeleteThreatAndConsequence(event, target) {
        event.preventDefault();
        if (!(await confirmDeletion())) return;
        await ArrayFieldAdapter.remove(this.document,"system.threatsAndConsequences", parseInt(target.dataset.index));
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
        if (!(await confirmDeletion())) return;
        const index = parseInt(target.dataset.index);
        const listIndex = parseInt(target.dataset.listindex);
        const list = this.document.system.threatsAndConsequences;
        if (!list || index < 0 || index >= list.length) return;
        list[index].list.splice(listIndex, 1);
        await this.document.update({ "system.threatsAndConsequences": list });
    }
}
