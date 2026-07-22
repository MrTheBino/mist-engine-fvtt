import { MistEngineActorSheet } from "./actor-sheet.mjs";
import { MistSceneApp } from '../apps/scene-app.mjs'
import { parseChallengeJSON } from '../lib/json-importer.mjs';
import { ArrayFieldAdapter } from "../lib/array-field-adapter.mjs";
import { ChallengeAddonAdapter } from "../lib/challenge-addon-adapter.mjs";
import { confirmDeletion } from "../lib/confirm-deletion.mjs";
import { enrichShortChallenges, enrichTextWithTags } from "../lib/tag-status-text-helper.mjs";

export class MistEngineLegendInTheMistNpcSheet extends MistEngineActorSheet {
  #dragDrop; // Private field to hold dragDrop handlers

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["mist-engine", "sheet", "actor", "npc"],
    position: {
      width: 900,
      height: 800,
    },
    actions: {
      createLimit: this.#handleCreateLimit,
      createMightyAspect: this.#handleCreateMightyAspect,
      deleteMightyAspect: this.#handleDeleteMightyAspect,
      createSecret: this.#handleCreateSecret,
      createSpecialFeature: this.#handleCreateSpecialFeature,
      createThreatAndConsequence: this.#handleCreateThreatAndConsequence,
      createThreatAndConsequenceEntry: this.#handleCreateThreatAndConsequenceEntry,
      deleteLimit: this.#handleDeleteLimit,
      deleteSecret: this.#handleDeleteSecret,
      deleteSpecialFeature: this.#handleDeleteSpecialFeature,
      deleteThreatAndConsequence: this.#handleDeleteThreadAndConsequence,
      deleteThreatAndConsequenceEntry: this.#handleDeleteThreadAndConsequenceEntry,
      addSceneAppRollMod: this.#handleAddSceneAppRollMod,
      deleteChallengeListItem: this.#handleDeleteChallengeListItem,
      createChallengeListEntry: this.#handleCreateChallengeListEntry,
      deleteChallenge: this.#handleDeleteChallenge,
      importJSON: this.#handleImportJSON
    },
    form: {
      submitOnChange: true,
    },
    actor: {
      type: "character",
    },
    dragDrop: [
      {
        dragSelector: '[draggable="true"]',
        dropSelector: ".mist-engine.actor",
      },
    ],
    window: {
      resizable: true,
      controls: [],
    },
  };

  static PARTS = {
    header: {
      id: "header",
      template: "systems/mist-engine-fvtt/templates/actor/parts/npc-header.hbs",
    },
    tabs: {
      id: "tabs",
      template: "templates/generic/tab-navigation.hbs",
    },
    details: {
      id: "details",
      template: "systems/mist-engine-fvtt/templates/actor/parts/tab-litm-npc.hbs",
      templates: [
        "systems/mist-engine-fvtt/templates/actor/parts/npc-limits-edit-partial.hbs",
        "systems/mist-engine-fvtt/templates/actor/parts/mighty-aspects-edit-partial.hbs",
        "systems/mist-engine-fvtt/templates/actor/parts/npc-secrets.hbs",
        "systems/mist-engine-fvtt/templates/actor/parts/npc-special-features-edit-partial.hbs",
        "systems/mist-engine-fvtt/templates/actor/parts/npc-threats-edit-partial.hbs",
        "systems/mist-engine-fvtt/templates/actor/parts/npc-beautified-partial.hbs",
        "systems/mist-engine-fvtt/templates/actor/parts/floating-tags-and-status-partial.hbs",
      ],
      scrollable: [".scrollable"],
    },
    biography: {
      id: "biography",
      template: "systems/mist-engine-fvtt/templates/shared/tab-biography.hbs",
    },
  };

  /**
   * Define the structure of tabs used by this sheet.
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
  static TABS = {
    "npc-sheet": {
      // this is the group name
      tabs: [
        { id: "details", group: "npc-sheet" },
        { id: "biography", group: "npc-sheet" },
      ],
      initial: "details",
      labelPrefix: "MIST_ENGINE.LABELS.Npc",
    },
  };

  /** @override */
  async _prepareContext(options) {
    let context = await super._prepareContext(options);
    //context.usedGearSlots = this.options.document.usedGearSlots;
    //context.defenseCalculated = this.options.document.defenseCalculated;

    let items = this._prepareItems();

    foundry.utils.mergeObject(context, items);
    context.hasSpecialFeatures = this.options.document.system.specialFeatures && this.options.document.system.specialFeatures.length > 0;
    context.hasSecrets = this.options.document.system.secrets && this.options.document.system.secrets.length > 0;

    // Issue #73: enrich consequence/threat text so @UUID[...]{Label} document
    // links render as real, clickable content links in the view-mode
    // ("beautified") partial. `context.system` is a plain clone from
    // toPlainObject() (see actor-sheet.mjs), so extending these arrays with
    // sibling *HTML fields is safe - it never touches the live document, and
    // the edit-mode partials (which read the same array by index) keep
    // reading the untouched raw string fields.
    context.system.limits = await Promise.all((context.system.limits ?? []).map(async (limit) => ({
      ...limit,
      consequenceHTML: await this.#enrichTaggedText(limit.consequence),
    })));

    context.system.secrets = await Promise.all((context.system.secrets ?? []).map(async (secret) => ({
      ...secret,
      descriptionHTML: await this.#enrichTaggedText(secret.description),
    })));

    context.system.specialFeatures = await Promise.all((context.system.specialFeatures ?? []).map(async (feature) => ({
      ...feature,
      nameHTML: await this.#enrichTaggedText(feature.name),
      descriptionHTML: await this.#enrichTaggedText(feature.description),
    })));

    context.system.threatsAndConsequences = await Promise.all((context.system.threatsAndConsequences ?? []).map(async (threat) => ({
      ...threat,
      descriptionHTML: await this.#enrichTaggedText(threat.description),
      listHTML: await Promise.all((threat.list ?? []).map((entry) => this.#enrichTaggedText(entry))),
    })));

    // The challenge templates render through the shared challenge-partial.hbs,
    // whose view branch expects enriched plain objects.
    context.challenges = await enrichShortChallenges(context.challenges ?? [], this.document);

    return context;
  }

  /**
   * Convert a raw consequence/threat string into final display HTML (see
   * enrichTextWithTags in tag-status-text-helper.mjs for why the tag pass
   * must run before enrichHTML).
   * @param {string} raw
   * @returns {Promise<string>}
   */
  async #enrichTaggedText(raw) {
    return enrichTextWithTags(raw, this.document);
  }

  _prepareItems() {
    const challenges = [];

    let inventory = this.options.document.items;
    for (let i of inventory) {
      if (i.type === 'shortchallenge') {
        challenges.push(i);
      }
    }

    return { challenges: challenges,hasChallenges: challenges.length > 0 };
  }

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);

    // Restore scroll positions after render to prevent jumping
    this._restoreScrollPositions();

    const npcUpdatableNpcArrayStats = this.element.querySelectorAll(".npc-updatable-npc-array-stat");
    for (let input of npcUpdatableNpcArrayStats) {
      input.addEventListener("change", (event) => this.handleNpcItemNpcArrayUpdate(event));
      input.addEventListener("keydown", (event) => this.handleInputShortCutsForGM(event));
    }

    const mightLevelSelects = this.element.querySelectorAll(".npc-might-level-select");
    for (const select of mightLevelSelects) {
      select.addEventListener("change", (event) => this.handleMightLevelSelect(event));
    }

    const rolesInput = this.element.querySelector(".npc-roles-input");
    rolesInput?.addEventListener("change", (event) => this.handleRolesInput(event));

    const npcUpdatableThreatEntryStats = this.element.querySelectorAll(".npc-updatable-threat-entry-stat");
    for (let input of npcUpdatableThreatEntryStats) {
      input.addEventListener("change", (event) => this.handleNpcItemThreatEntryUpdate(event));
      input.addEventListener("keydown", (event) => this.handleInputShortCutsForGM(event));
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

    this.enableFloatingTagStatusContextMenus();
  }

  
  enableFloatingTagStatusContextMenus() {}

  /** Parse the comma-separated roles input into the `system.roles` list. easies way*/
  handleRolesInput(event) {
    event.preventDefault();
    const roles = event.currentTarget.value.split(",").map(r => r.trim()).filter(Boolean);
    this.actor.update({ "system.roles": roles });
  }

  /**
   * The edit-mode text fields whose content is enriched in view mode (see
   * #enrichTaggedText, issue #73), keyed by data-array with the accepted
   * data-key values. Only these fields accept a dropped Actor as a
   * `@UUID[...]{Name}` link — anywhere else a link would never render.
   */
  static #UUID_DROPPABLE_FIELDS = {
    limits: ["consequence"],
    secrets: ["description"],
    specialFeatures: ["name", "description"],
    threatsAndConsequences: ["description"],
  };

  /** @override Apply a dropped Challenge Add-on, otherwise fall back to the base drop handling. */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type === "Item") {
      const item = await fromUuid(data.uuid);
      if (item?.type === "challenge-addon") {
        await ChallengeAddonAdapter.applyToChallenge(this.actor, item);
        return;
      }
    }
    return super._onDrop(event);
  }

  /** @override The NPC's enriched consequence/threat fields, then the shared challenge fields. */
  _getUuidDroppableField(target) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      if (target.classList.contains("npc-updatable-threat-entry-stat")) return target;
      const acceptedKeys = MistEngineLegendInTheMistNpcSheet.#UUID_DROPPABLE_FIELDS[target.dataset.array] ?? [];
      if (target.classList.contains("npc-updatable-npc-array-stat") && acceptedKeys.includes(target.dataset.key)) {
        return target;
      }
    }
    return super._getUuidDroppableField(target);
  }

  /** @override Persist the NPC's array-backed fields; shared challenge fields defer to the base. */
  async _persistUuidDroppedText(field, value) {
    const index = Number.parseInt(field.dataset.index, 10);
    if (field.classList.contains("npc-updatable-threat-entry-stat")) {
      const listIndex = Number.parseInt(field.dataset.listindex, 10);
      if (Number.isNaN(index) || Number.isNaN(listIndex)) return;
      await ArrayFieldAdapter.set(this.actor, "system.threatsAndConsequences", index, `list.${listIndex}`, value);
      return;
    }
    if (field.classList.contains("npc-updatable-npc-array-stat")) {
      if (Number.isNaN(index)) return;
      await ArrayFieldAdapter.set(this.actor, `system.${field.dataset.array}`, index, field.dataset.key, value);
      return;
    }
    return super._persistUuidDroppedText(field, value);
  }

  static async #handleAddSceneAppRollMod(event, target) {
    event.preventDefault();
    const value = target.dataset.value;
    const name = target.dataset.name;
    if (!value) return;
    console.log("handleAddSceneAppRollMod", name, value);

    await MistSceneApp.getInstance().addRollModification(name, value);
  }

  static async #handleDeleteThreadAndConsequenceEntry(event, target) {
    event.preventDefault();
    if (!(await confirmDeletion())) return;
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
    if (!(await confirmDeletion())) return;
    await ArrayFieldAdapter.remove(this.actor,"system.threatsAndConsequences", parseInt(target.dataset.index));
  }

  async handleNpcItemNpcArrayUpdate(event) {
    event.preventDefault();

    // Save scroll position before update
    this._saveScrollPositions();

    const target = event.currentTarget;
    const arrayIndex = parseInt(target.dataset.index);
    const arrayName = target.dataset.array;
    const key = target.dataset.key;

    await ArrayFieldAdapter.set(this.actor, `system.${arrayName}`, arrayIndex, key, target.value);
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
    this._saveScrollPositions();
    await ArrayFieldAdapter.set(this.actor, "system.mightyAspects", index, "level", select.value);
  }

  async handleNpcItemThreatEntryUpdate(event) {
    event.preventDefault();
    
    // Save scroll position before update
    this._saveScrollPositions();
    
    const target = event.currentTarget;
    const arrayIndex = parseInt(target.dataset.index);
    const listIndex = parseInt(target.dataset.listindex);

    await ArrayFieldAdapter.set(this.actor, "system.threatsAndConsequences", arrayIndex, `list.${listIndex}`, target.value);
  }

  static async #handleDeleteSecret(event, target) {
    event.preventDefault();
    if (!(await confirmDeletion())) return;
    await ArrayFieldAdapter.remove(this.actor,"system.secrets", parseInt(target.dataset.index));
  }

  static async #handleDeleteLimit(event, target) {
    event.preventDefault();
    if (!(await confirmDeletion())) return;
    await ArrayFieldAdapter.remove(this.actor,"system.limits", parseInt(target.dataset.index));
  }

  static async #handleDeleteSpecialFeature(event, target) {
    event.preventDefault();
    if (!(await confirmDeletion())) return;
    await ArrayFieldAdapter.remove(this.actor,"system.specialFeatures", parseInt(target.dataset.index));
  }

  static async #handleCreateMightyAspect(event, target) {
    event.preventDefault();
    await ArrayFieldAdapter.add(this.actor, "system.mightyAspects", { level: "origin", aspect: "", mightIcon: "" });
  }

  static async #handleDeleteMightyAspect(event, target) {
    event.preventDefault();
    if (!(await confirmDeletion())) return;
    await ArrayFieldAdapter.remove(this.actor, "system.mightyAspects", parseInt(target.dataset.index));
  }

  static async #handleCreateThreatAndConsequenceEntry(event, target) {
    event.preventDefault;
    const threatsAndConsequences = this.actor.system.threatsAndConsequences;
    const index = parseInt(target.dataset.index);
    if (!threatsAndConsequences || threatsAndConsequences.length <= index) return;

    this._saveScrollPositions();
    threatsAndConsequences[index].list.push("");
    await this.actor.update({ "system.threatsAndConsequences": threatsAndConsequences });
  }

  static async #handleCreateThreatAndConsequence(event, target) {
    event.preventDefault();
    this._saveScrollPositions();
    await ArrayFieldAdapter.add(this.actor, "system.threatsAndConsequences", { name: "", description: "", list: [] });
  }

  static async #handleCreateSpecialFeature(event, target) {
    event.preventDefault();
    this._saveScrollPositions();
    await ArrayFieldAdapter.add(this.actor, "system.specialFeatures", { name: "", description: "" });
  }

  static async #handleCreateSecret(event, target) {
    event.preventDefault();
    this._saveScrollPositions();
    await ArrayFieldAdapter.add(this.actor, "system.secrets", { name: "", description: "" });
  }

  static async #handleCreateLimit(event, target) {
    event.preventDefault();
    await ArrayFieldAdapter.add(this.actor, "system.limits", { name: "", value: 0, positive: false });
  }

  async handleChallengeItemUpdate(event) {
    event.preventDefault();
    
    // Save scroll position before update
    this._saveScrollPositions();
    
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    const field = event.currentTarget.dataset.key;
    const value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;


    await item.update({ [field]: value });
  }

  async handleChallengeItemListUpdate(event) {
    event.preventDefault();
    
    // Save scroll position before update
    this._saveScrollPositions();
    
    const item = this.actor.items.get(event.currentTarget.dataset.itemId);
    const index = parseInt(event.currentTarget.dataset.index);
    await ArrayFieldAdapter.setIndex(item, "system.list", index, event.currentTarget.value);
  }

  static async #handleDeleteChallengeListItem(event, target) {
    event.preventDefault();
    if (!(await confirmDeletion())) return;
    const item = this.actor.items.get(target.dataset.itemId);
    await ArrayFieldAdapter.remove(item, "system.list", parseInt(target.dataset.index));
  }

  static async #handleCreateChallengeListEntry(event, target) {
    event.preventDefault();
    const item = this.actor.items.get(target.dataset.itemId);
    await ArrayFieldAdapter.add(item, "system.list", "");
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

   static async #handleImportJSON(event, target) {
        event.preventDefault();

        const jsonText = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Import Character from JSON" },
            content: `<textarea name="jsonData" rows="10" autofocus></textarea>`,
            ok: {
                label: "Import",
                callback: (event, button, dialog) => button.form.elements.jsonData.value
            }
        });
        if (!jsonText) return;

        try {
            const data = JSON.parse(jsonText);
            parseChallengeJSON(this.actor, data);
            ui.notifications.info("Character imported from JSON. Please check the imported data and adjust as necessary.");
        } catch (error) {
            ui.notifications.error("Failed to import character from JSON: " + error.message);
        }
    }
}
