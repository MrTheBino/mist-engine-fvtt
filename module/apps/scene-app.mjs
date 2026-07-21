const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import { FloatingTagAndStatusAdapter } from "../lib/floating-tag-and-status-adapter.mjs";
import { enrichShortChallenges, enrichTextWithTags } from "../lib/tag-status-text-helper.mjs";
import { ArrayFieldAdapter } from "../lib/array-field-adapter.mjs";
import { DiceRollApp } from "./dice-roll-app.mjs";

export class MistSceneApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);

        this.currentSceneDataItem = null;
        this.currentSceneId = game.scenes.active ? game.scenes.active.id : null;
        this.currentSceneName = game.scenes.active ? game.scenes.active.name : null;
        this.findOrCreateSceneDataItem();

        MistSceneApp.instance = this;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'scene-data-app',
        classes: ['mist-engine', 'dialog', 'scene-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'Scene Tags & Characters',
            icon: 'fa-solid fa-book-atlas',
            positioned: true,
            resizable: true,
            contentClasses: ['scene-app-body']
        },
        position: {
            left: 100,
            width: 800,
            height: 800
        },
        actions: {
            openAssignedJourney: this.#handleOpenAssignedJourney,
            unassignJourney: this.#handleUnassignJourney,
            openStoryTheme: this.#handleOpenStoryTheme,
            removeStoryTheme: this.#handleRemoveStoryTheme,
            createFloatingTagOrStatus: this.#handleCreateFloatingTagOrStatus,
            deleteFloatingTagOrStatus: this.#handleDeleteFloatingTagOrStatus,
            actorToggleFloatingTagOrStatusMarking: this.#handleActorToggleFloatingTagOrStatusMarking,
            removeSceneAppRollMod: this.#handleRemoveSceneAppRollMod,
            clickToggleLock: this.#handleFtsEditableCheckboxChanged,
            toggleFloatingTagOrStatusMarking: this.#handleToggleFloatingTagOrStatusMarking,
            toggleDiceRollModifier: this.#handleToggleDiceRollModifier,
            // story floating tags and statuses
            toggleFloatingTagOrStatusSelected: this.#handleToggleFloatingTagOrStatusSelected,
            toggleFloatingTagOrStatusModifier: this.#handleToggleFloatingTagOrStatusModifier,
            toggleFloatingTagOrStatus: this.#handleToggleFloatingTagOrStatus,
            clickOpenCharacterSheet: this.#handleClickOpenCharacterSheet,
            toggleWeaknessTag: this.#handleToggleWeaknessTag
        },
    };

    /** @override */
    static PARTS = {
        /*debug: {
            template: 'systems/mist-engine-fvtt/templates/scene-app/debug.hbs',
            scrollable: ['scrollable']
        },*/
        tags: {
            template: 'systems/mist-engine-fvtt/templates/scene-app/tags.hbs',
            scrollable: ['']
        },
        "dice-roll-mods": {
            template: 'systems/mist-engine-fvtt/templates/scene-app/dice-roll-mods.hbs',
            scrollable: ['']
        },
        // GM-only right-side icon tab rail + tab content (see _configureRenderParts).
        tabs: {
            template: 'templates/generic/tab-navigation.hbs'
        },
        actors: {
            template: 'systems/mist-engine-fvtt/templates/scene-app/actors.hbs',
            scrollable: ['.tab-content-inner']
        },
        journeys: {
            template: 'systems/mist-engine-fvtt/templates/scene-app/journeys.hbs',
            scrollable: ['.tab-content-inner']
        },
        storyThemes: {
            template: 'systems/mist-engine-fvtt/templates/scene-app/story-themes.hbs',
            scrollable: ['.tab-content-inner']
        }
    };

    static TABS = {
        "scene-app": {
            tabs: [
                { id: "actors", group: "scene-app", icon: "fa-solid fa-users", label: "MIST_ENGINE.SCENE_APP.TabActors" },
                { id: "journeys", group: "scene-app", icon: "fa-solid fa-route", label: "MIST_ENGINE.SCENE_APP.TabJourneys" },
                { id: "storyThemes", group: "scene-app", icon: "fa-solid fa-scroll", label: "MIST_ENGINE.SCENE_APP.TabStoryThemes" }
            ],
            initial: "actors"
        }
    };

    async _preparePartContext(partId, context) {
        context = await super._preparePartContext(partId, context);
        if (partId === "tabs") {
            context.verticalTabs = true;
            context.tabClasses = "scene-app-side-tabs";
            for (const t of Object.values(context.tabs ?? {})) {
                t.tooltip ??= game.i18n.localize(t.label);
            }
        }
        return context;
    }


    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        if (!game.user.isGM) {
            delete parts.tabs;
            delete parts.actors;
            delete parts.journeys;
            delete parts.storyThemes;
        }
        return parts;
    }

    static getInstance(options = {}) {
        if (!MistSceneApp.instance) {
            MistSceneApp.instance = new MistSceneApp(options);
        }
        return MistSceneApp.instance;
    }

    static open() {
        if (!game.scenes.active) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.SCENE_APP.NoActiveScene"));
            return;
        }
        MistSceneApp.getInstance().render(true, { focus: true });
    }

    /** @inheritDoc */
    _onRender(context, options) {
        // Story floating tags and statuses
        const updateableFtsStats = this.element.querySelectorAll('.updateable-fts-stat')
        for (const input of updateableFtsStats) {
            input.addEventListener("change", event => this.handleFtStatChanged(event))
        }

        this.element.addEventListener("drop", this._onDrop.bind(this));

        // Journeys tab: reuse the assigned journey's custom background 
        const journey = this.getAssignedJourney();
        const journeyEl = journey ? this.element.querySelector(".scene-app-journey") : null;
        const bg = journey?.system.customBackground;
        if (journeyEl && bg && bg.trim() !== "") {
            journeyEl.style.setProperty("background-image",
                `url("${bg}"), url("systems/mist-engine-fvtt/assets/paper_background_1.webp")`);
            journeyEl.style.setProperty("background-size", "contain, cover");
            journeyEl.style.setProperty("background-repeat", "no-repeat");

            // Only honor the journey's custom font color when its background is present 
            const fontColor = journey.system.customFontColor;
            if (fontColor && fontColor.trim() !== "") {
                journeyEl.querySelectorAll(".custom-font-color")
                    .forEach(el => { el.style.color = fontColor; });
            }
        }

        // setr the title of the dialog
        let titleElement = this.element.querySelector(".window-title");
        if (titleElement) {
            titleElement.textContent = `Scene: ${this.currentSceneName}`;
        }
    }

    enableFloatingTagStatusContextMenus() {
        this._createContextMenu(() => [
            {
                name: "Add Adventure Might",
                icon: '<i class="fa-solid fa-circle-plus"></i>',
                condition: li => {
                    if(li.dataset.isStatus === "true"){
                        return false; // might only makes sense for tags, not for statuses, but this can be adjusted if needed
                    }
                    const might = Number(li.dataset.might ?? 0);
                    return might <= 0;
                },
                callback: async li => {
                    const index = Number(li.dataset.index);
                    if (!li.dataset.actorId){
                        await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(this.currentSceneDataItem, index, "adventure");
                        this.sendUpdateHookEvent();
                        return;
                    }else{
                        const actor = this.resolveTargetActor(li);
                        await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(actor, index, "adventure");
                        await actor.sheet.sendFloatableTagOrStatusUpdate();
                    }
                }
            },
            {
                name: "Add Greatness Might",
                icon: '<i class="fa-solid fa-circle-plus"></i>',
                condition: li => {
                    if(li.dataset.isStatus === "true"){
                        return false; // might only makes sense for tags, not for statuses, but this can be adjusted if needed
                    }
                    const might = Number(li.dataset.might ?? 0);
                    return might <= 0;
                },
                callback: async li => {
                    const index = Number(li.dataset.index);
                    if (!li.dataset.actorId){
                        await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(this.currentSceneDataItem, index, "greatness");
                        this.sendUpdateHookEvent();
                        return;
                    }else{
                        const actor = this.resolveTargetActor(li);
                        await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(actor, index, "greatness");
                        await actor.sheet.sendFloatableTagOrStatusUpdate();
                    }
                }
            },
            {
                name: "Add Origin Might",
                icon: '<i class="fa-solid fa-circle-plus"></i>',
                condition: li => {
                    if(li.dataset.isStatus === "true"){
                        return false; // might only makes sense for tags, not for statuses, but this can be adjusted if needed
                    }
                    const might = Number(li.dataset.might ?? 0);
                    return might <= 0;
                },
                callback: async li => {
                    const index = Number(li.dataset.index);
                    if (!li.dataset.actorId){
                        await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(this.currentSceneDataItem, index, "origin");
                        this.sendUpdateHookEvent();
                        return;
                    }else{
                        const actor = this.resolveTargetActor(li);
                        await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(actor, index, "origin");
                        await actor.sheet.sendFloatableTagOrStatusUpdate();
                    }
                }
            },
            {
                name: "Remove Might",
                icon: '<i class="fa-solid fa-circle-minus"></i>',
                condition: li => {
                    if(li.dataset.isStatus === "true"){
                        return false; // might only makes sense for tags, not for statuses, but this can be adjusted if needed
                    }
                    const might = Number(li.dataset.might ?? 0);
                    return might > 0;
                },
                callback: async li => {
                    const index = Number(li.dataset.index);
                    if (!li.dataset.actorId){
                        console.log("Disabling might for scene tag/status at index", index);
                        console.log("Current scene data item before update:", this.currentSceneDataItem);
                        await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(this.currentSceneDataItem, index);
                        this.sendUpdateHookEvent();
                        return;
                    }else{
                        const actor = this.resolveTargetActor(li);
                        await FloatingTagAndStatusAdapter.handleTagStatusMightToggle(actor, index);
                        await actor.sheet.sendFloatableTagOrStatusUpdate();
                    }
                }
            }
        ], ".floating-tag-and-status-entry", {
            fixed: true
        });
    }

    /**
     * Callback actions which occur when a dragged element is dropped on a target.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        const { type, name, value } = data;

        if (type === "Actor" && game.user.isGM) {
            const actor = await fromUuid(data.uuid);
            if (actor?.type === "litm-journey") {
                await this.currentSceneDataItem.update({ "system.assignedJourneyId": actor.id });
                this.sendUpdateHookEvent();
                return;
            }
        }

        // A dropped themebook flagged as a story theme is added to the scene.
        if (type === "Item" && game.user.isGM) {
            const item = await fromUuid(data.uuid);
            if (item?.type === "themebook") {
                if (!this.isStoryThemeItem(item)) {
                    ui.notifications.warn(game.i18n.localize("MIST_ENGINE.SCENE_APP.OnlyStoryThemes"));
                    return;
                }
                const ids = this.currentSceneDataItem.system.storyThemeIds ?? [];
                if (!ids.includes(item.uuid)) {
                    await this.currentSceneDataItem.update({ "system.storyThemeIds": [...ids, item.uuid] });
                    this.sendUpdateHookEvent();
                }
                return;
            }
        }

        const isStatus = type === "status";
        const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses ?? [];

        // Handle different data types
        switch (type) {
            case "tag":
                await this.currentSceneDataItem.update({
                    "system.floatingTagsAndStatuses": [...floatingTagsAndStatuses, { name }],
                });
                this.sendUpdateHookEvent();
                break;
            case "weakness":
                // A dropped weakness / negative tag becomes a negative floating tag.
                await this.currentSceneDataItem.update({
                    "system.floatingTagsAndStatuses": [...floatingTagsAndStatuses, { name, positive: false }],
                });
                this.sendUpdateHookEvent();
                break;
            case "status":
                const markings = new Array(6).fill(false);
                markings[Math.max(0, Math.min(parseInt(value) - 1, 5))] = true;
                await this.currentSceneDataItem.update({
                    "system.floatingTagsAndStatuses": FloatingTagAndStatusAdapter.withStatusStacked(
                        floatingTagsAndStatuses,
                        { name, value, isStatus, markings }
                    ),
                });
                this.sendUpdateHookEvent();
                break;
            default:
                console.warn("Unknown drop type", data);
                break;
        }

        return super._onDrop?.(event);
    }

    /**
     * Re-render THIS client's scene tracker. The cross-client socket broadcast
     * was removed — other clients now refresh via the central `updateActor` /
     * `updateItem` / token hooks in lib/hooks.mjs. This local render is still
     * needed for changes that are NOT a document update those hooks catch
     * (e.g. adding/removing a token, switching scenes via sceneUpdatedHook /
     * sceneChangedHook).
     */
    sendUpdateHookEvent(forceRender = true) {
        if (this.rendered && !this.minimized) {
            this.render(true);
        }
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.currentSceneDataItem = this.currentSceneDataItem;
        context.currentSceneId = this.currentSceneId;
        context.currentSceneName = this.currentSceneName;
        context.isGM = game.user.isGM;
        context.isNotGM = !game.user.isGM;
        context.hasDiceRollModifiers = this.currentSceneDataItem.system.diceRollTagsStatus.length > 0;

        if (game.user.isGM) {
            foundry.utils.mergeObject(context, await this._prepareContextForCharacters());

            const journey = this.getAssignedJourney();
            context.assignedJourney = journey;
            context.assignedJourneyName = journey?.name ?? "";
            context.assignedJourneySystem = journey?.system ?? null;
            // Enriched so @UUID[...]{Label} links render here too (issue #73).
            context.assignedJourneyGeneralConsequencesHTML = journey
                ? await Promise.all((journey.system.generalConsequences ?? []).map((entry) => enrichTextWithTags(entry, journey)))
                : [];
            context.assignedJourneyChallenges = journey
                ? await enrichShortChallenges(journey.items.filter(i => i.type === "shortchallenge"), journey)
                : [];

            // Story Themes tab: themebooks dragged onto the scene, read-only,
            // with their (filled) power and weakness tags exposed for dragging.
            context.storyThemes = (await this.getStoryThemes()).map(item => ({
                uuid: item.uuid,
                name: item.name,
                powertags: (item.system.powertags ?? []).filter(t => t.name?.trim() && !t.planned),
                weaknesstags: (item.system.weaknesstags ?? []).filter(t => t.name?.trim() && !t.planned)
            }));
        }

        return context;
    }

    /** The journey actor assigned to this scene, or null. */
    getAssignedJourney() {
        const id = this.currentSceneDataItem?.system?.assignedJourneyId;
        if (!id) return null;
        const journey = game.actors.get(id);
        return journey?.type === "litm-journey" ? journey : null;
    }

    static async #handleOpenAssignedJourney(event, target) {
        event.preventDefault();
        this.getAssignedJourney()?.sheet.render(true);
    }

    static async #handleUnassignJourney(event, target) {
        event.preventDefault();
        await this.currentSceneDataItem.update({ "system.assignedJourneyId": "" });
        this.sendUpdateHookEvent();
    }

    /** Is this item a story theme? A themebook flagged isStoryTheme. */
    isStoryThemeItem(item) {
        return item?.type === "themebook" && item.system.options?.isStoryTheme === true;
    }

    /** Resolve the assigned story themes (valid + still story themes). */
    async getStoryThemes() {
        const ids = this.currentSceneDataItem?.system?.storyThemeIds ?? [];
        const resolved = await Promise.all(ids.map(uuid => fromUuid(uuid).catch(() => null)));
        return resolved.filter(it => this.isStoryThemeItem(it));
    }

    static async #handleOpenStoryTheme(event, target) {
        event.preventDefault();
        const item = await fromUuid(target.dataset.uuid);
        item?.sheet.render(true);
    }

    static async #handleRemoveStoryTheme(event, target) {
        event.preventDefault();
        const uuid = target.dataset.uuid;
        const ids = (this.currentSceneDataItem.system.storyThemeIds ?? []).filter(u => u !== uuid);
        await this.currentSceneDataItem.update({ "system.storyThemeIds": ids });
        this.sendUpdateHookEvent();
    }

    async _prepareContextForCharacters() {
        let context = {}
        const scene = game.scenes.active;
        const tokens = scene ? scene.tokens.contents : [];
        context.userIsGM = game.user.isGM;

        // Characters: one entry per unique character actor (player characters
        // are linked, so duplicate tokens share the same actor).
        const characterActors = [...new Set(tokens.map(t => t.actor).filter(a => a && a.type === "litm-character"))];
        characterActors.forEach(actor => {
            let selectedTags = DiceRollApp.getPreparedTagsAndStatusesForRoll(actor);
            let floatingTagAndStatuses = actor.system.floatingTagsAndStatuses || [];
            // All weakness tags are exposed to the GM only (issue #85).
            let weaknessTags = game.user.isGM ? this.getCharacterWeaknessTags(actor) : [];
            if (!context.characters) context.characters = [];
            context.characters.push({
                id: actor.id,
                name: actor.name,
                img: actor.img,
                floatingTagsAndStatuses: floatingTagAndStatuses,
                hasFloatingTagsAndStatuses: floatingTagAndStatuses.length > 0,
                selectedTagsForRoll: selectedTags,
                hasSelectedTagsForRoll: selectedTags.length > 0,
                weaknessTags: weaknessTags,
                hasWeaknessTags: weaknessTags.length > 0
            });
        });

        // Challenges (NPCs): one entry PER TOKEN, so multiple instances of the
        // same challenge stay independent. Each unlinked token has its own actor
        // delta, and its per-scene-unique token id is the real identity (the
        // base actor id is shared across duplicates — see issue #88). Linked
        // duplicates share a single actor object, so those collapse to one entry.
        const seenNpcActors = new Set();
        tokens.forEach(token => {
            const actor = token.actor;
            if (!actor || actor.type !== "litm-npc") return;
            if (seenNpcActors.has(actor)) return; // linked duplicate → already added
            seenNpcActors.add(actor);
            let floatingTagAndStatuses = actor.system.floatingTagsAndStatuses || [];
            let mightyAspects = this.getChallengeMightyAspects(actor);
            if (!context.challenges) context.challenges = [];
            context.challenges.push({
                id: actor.id,
                tokenId: token.id,
                name: token.name || actor.name,
                img: actor.img,
                isOvercome: actor.system.isOvercome === true,
                floatingTagsAndStatuses: floatingTagAndStatuses,
                hasFloatingTagsAndStatuses: floatingTagAndStatuses.length > 0,
                mightyAspects: mightyAspects,
                hasMightyAspects: mightyAspects.length > 0
            });
        });

        return context;
    }

    /**
     * Collect ALL named weakness tags for a character (issue #85) from its
     * themebooks and its linked fellowship themecard, with the info needed to
     * display them and to toggle their selected state from the scene app.
     */
    getCharacterWeaknessTags(actor) {
        const result = [];
        const collect = (tags, source, themebookId) => {
            (tags ?? []).forEach((tag, index) => {
                if (!tag?.name || !tag.name.trim()) return;
                if (tag.planned) return; // we don't show planned ones
                result.push({ name: tag.name, selected: !!tag.selected, burned: !!tag.burned, source, themebookId, index });
            });
        };
        for (const item of actor.items) {
            if (item.type === "themebook") collect(item.system.weaknesstags, "themebook", item.id);
        }
        const themecard = game.actors.get(actor.system.actorSharedSingleThemecardId);
        if (themecard) collect(themecard.system.weaknesstags, "fellowship-themecard", null);
        return result;
    }

    /**
     * A Challenge's Mighty aspects for the scene app (issue #90). Display-only —
     * never roll tags. The scene app's challenge list is GM-only, so there is no
     * player-facing reveal.
     * @param {Actor} actor  a litm-npc challenge actor
     */
    getChallengeMightyAspects(actor) {
        const result = [];
        (actor.system.mightyAspects ?? []).forEach(a => {
            if (!a?.aspect || !a.aspect.trim()) return;
            result.push({ level: a.level, aspect: a.aspect, mightIcon: a.mightIcon });
        });
        return result;
    }

    static async #handleClickOpenCharacterSheet(event, target) {
        event.preventDefault();
        const actor = this.resolveTargetActor(target);
        if (actor) {
            actor.sheet.render(true);
        }
    }

    /**
     * GM OBLY: character weakness tag's selected state directly from the
     * scene app
     */
    static async #handleToggleWeaknessTag(event, target) {
        event.preventDefault();
        if (!game.user.isGM) return;
        const actor = this.resolveTargetActor(target);
        if (!actor) return;
        const index = parseInt(target.dataset.index);
        let doc = null;
        if (target.dataset.source === "themebook") {
            doc = actor.items.get(target.dataset.themebookId);
        } else if (target.dataset.source === "fellowship-themecard") {
            doc = game.actors.get(actor.system.actorSharedSingleThemecardId);
        }
        if (!doc) return;
        await ArrayFieldAdapter.toggle(doc, "system.weaknesstags", index, "selected");
        // Themebook edits refresh via the central updateItem hook; this also
        // covers the fellowship-themecard (separate actor) and the dice app.
        this.sendUpdateHookEvent();
        DiceRollApp.instance?.updateTagsAndStatuses(true);
    }


    static async #handleToggleDiceRollModifier(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        let data = this.currentSceneDataItem.system.diceRollTagsStatus;
        if (!data || index >= data.length) return;
        data[index].positive = !data[index].positive;
        await this.currentSceneDataItem.update({ "system.diceRollTagsStatus": data });

        this.sendUpdateHookEvent();
        DiceRollApp.instance?.updateTagsAndStatuses(true);
    }

    static async #handleRemoveSceneAppRollMod(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        let data = this.currentSceneDataItem.system.diceRollTagsStatus;
        if (!data || index >= data.length) return;
        data.splice(index, 1);
        await this.currentSceneDataItem.update({ "system.diceRollTagsStatus": data });

        this.sendUpdateHookEvent();
        DiceRollApp.instance?.updateTagsAndStatuses(true);
    }

    async handleActorFtTagStatusToggle(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const actor = this.resolveTargetActor(event.currentTarget);

        await FloatingTagAndStatusAdapter.handleTagStatusToggle(actor, index);
        this.sendFloatableTagOrStatusUpdateForActor(actor);

    }

    /**
     * Resolve the actor a clicked scene-app control refers to. Challenge
     * controls carry `data-token-id` (per-scene-unique) — the correct identity
     * for duplicate NPC tokens; everything else falls back to `data-actor-id` /
     * `data-id`. See issue #88.
     * @param {HTMLElement} el  The element with the data-* identity attributes.
     * @returns {Actor|null}
     */
    resolveTargetActor(el) {
        const tokenId = el.dataset.tokenId;
        if (tokenId) {
            return game.scenes.active?.tokens.get(tokenId)?.actor ?? null;
        }
        return this.getCorrectActor(el.dataset.actorId ?? el.dataset.id);
    }

    getCorrectActor(actorId) {
        const actor = game.actors.get(actorId);
        if (!actor) return null;
        if (actor.type == "litm-npc") {
            // challenges are not linked, so we need to update the scene's actor
            const scene = game.scenes.active;
            if (!scene) return null;
            const tokens = scene.tokens.contents;
            // match the id of the actor with the id of the token's actor, because the same npc can be used multiple times in the scene
            return tokens.map(t => t.actor).find(a => a && a.id === actor.id);
        }
        return actor;
    }

    // ToDo: this floating and status functions can be encapsulated in a separate class / helper file or whatever to use them in other places as well
    // no need to replicate all the code, but right now it's fine 
    static async #handleActorToggleFloatingTagOrStatusMarking(event, target) {
        event.preventDefault();
        const index = parseInt(target.dataset.index);
        const actor = this.resolveTargetActor(target);
        const markingIndex = parseInt(target.dataset.markingIndex);

        await FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking(actor, index, markingIndex);
        this.sendFloatableTagOrStatusUpdateForActor(actor);
    }

    static async #handleFtsEditableCheckboxChanged(event, target) {
        event.preventDefault();
        if (game.user.isGM === false) return;
        if (!this.currentSceneDataItem) return;

        await this.currentSceneDataItem.update({ "system.floatingTagsAndStatusesEditable": !this.currentSceneDataItem.system.floatingTagsAndStatusesEditable });
        this.sendUpdateHookEvent();
    }

    // Story Floating Tags and Statuses
    static async #handleToggleFloatingTagOrStatusMarking(event, target) {
        event.preventDefault();
        if (game.user.isGM === false) return;
        if (target.dataset.source == "litm-npc" || target.dataset.source == "litm-character"){
            const actor = this.resolveTargetActor(target);
            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking(actor, index, target.dataset.markingIndex);

            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }else{
            if (!this.currentSceneDataItem) return;

            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking(this.currentSceneDataItem, index, target.dataset.markingIndex);

            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }
        
    }

    // Story Floating Tags and Statuses
    async handleFtStatChanged(event) {
        event.preventDefault();
        if (game.user.isGM === false) return;
        if (!this.currentSceneDataItem) return;

        const index = event.currentTarget.dataset.index;
        const key = event.currentTarget.dataset.key;
        const value = event.currentTarget.value;

        await FloatingTagAndStatusAdapter.handleFtStatChanged(this.currentSceneDataItem, index, key, value);
        this.sendUpdateHookEvent();
    }

    static async #handleToggleFloatingTagOrStatusSelected(event, target) {
        event.preventDefault();

        if (game.user.isGM === false) return;
        // check if the target has data-source and data-source is litm-npc
        if (target.dataset.source == "litm-npc" || target.dataset.source == "litm-character"){
            const actor = this.resolveTargetActor(target);
            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleTagStatusSelectedToggle(actor, index);
            this.sendFloatableTagOrStatusUpdateForActor(actor);
            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }else{
            if (!this.currentSceneDataItem) return;

            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleTagStatusSelectedToggle(this.currentSceneDataItem, index);
            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }
    }

    static async #handleToggleFloatingTagOrStatus(event, target) {
        event.preventDefault();
        if (game.user.isGM === false) return;
        if (target.dataset.source == "litm-npc" ||target.dataset.source == "litm-character"){
            const actor = this.resolveTargetActor(target);
            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleTagStatusToggle(actor, index);
            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }else{
            if (!this.currentSceneDataItem) return;

            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleTagStatusToggle(this.currentSceneDataItem, index);
            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }
    }

    static async #handleToggleFloatingTagOrStatusModifier(event, target) {
        event.preventDefault();

        if (game.user.isGM === false) return;
        if (target.dataset.source == "litm-npc" ||target.dataset.source == "litm-character"){
            const actor = this.resolveTargetActor(target);
            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleTagStatusModifierToggle(actor, index);
            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }else{
            if (!this.currentSceneDataItem) return;

            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleTagStatusModifierToggle(this.currentSceneDataItem, index);
            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }
    }

    static async #handleDeleteFloatingTagOrStatus(event, target) {
        event.preventDefault();

        if (game.user.isGM === false) return;

        let confirmed = true;
        if (target.dataset.confirm && target.dataset.confirm == "1") {
            confirmed = await foundry.applications.api.DialogV2.confirm({
                title: "Confirm Deletion",
                content: "Are you sure you want to delete this tag/status?",
                yes: {
                    label: "Yes",
                    callback: () => true
                },
                no: {
                    label: "No",
                    callback: () => false
                }
            });
        }

        if (!confirmed) {
            return;
        }

        if (target.dataset.source == "litm-npc" || target.dataset.source == "litm-character"){
            const actor = this.resolveTargetActor(target);
            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleDeleteFloatingTagOrStatus(actor, index);
            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }else{
            if (!this.currentSceneDataItem) return;
            const index = target.dataset.index;
            await FloatingTagAndStatusAdapter.handleDeleteFloatingTagOrStatus(this.currentSceneDataItem, index);
            this.sendUpdateHookEvent();
            DiceRollApp.instance?.updateTagsAndStatuses(true);
        }
        
    }

    static async #handleCreateFloatingTagOrStatus(event, target) {
        event.preventDefault();
        if (game.user.isGM === false) return;
        if (!this.currentSceneDataItem) return;

        const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses;

        let srcStatusTagStr = "New Status";
        try {
            srcStatusTagStr = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Enter the status or tag" },
                content: '<input name="srcStatusTagStr" type="text" autofocus placeholder="tag or status-2">',
                ok: {
                    label: "Submit",
                    callback: (event, button, dialog) => button.form.elements.srcStatusTagStr.value
                }
            });
        } catch (error) {
            return;
        }

        if (srcStatusTagStr === undefined || srcStatusTagStr.trim().length === 0) {
            return;
        }

        let ftsObject = FloatingTagAndStatusAdapter.parseFloatingTagAndStatusString(srcStatusTagStr);

        await this.currentSceneDataItem.update({
            "system.floatingTagsAndStatuses": FloatingTagAndStatusAdapter.withStatusStacked(floatingTagsAndStatuses, ftsObject)
        });

        this.sendUpdateHookEvent();
    }

    findOrCreateSceneDataItem() {
        this.currentSceneDataItem = null;

        game.items.forEach(item => {
            if (item.type === "scene-data") {
                if (item.system.sceneKey === this.currentSceneId) {
                    this.currentSceneDataItem = item;
                    return;
                }
            }
        });

        if (this.currentSceneId && !this.currentSceneDataItem) {
            // check if the current user is gm
            if (!game.user.isGM) {
                return;
            }

            Item.create({
                name: `Scene Data: ${this.currentSceneName}`,
                type: "scene-data",
                flags: { mistmod: { hidden: true } },
                data: {
                }
            }).then(item => {
                item.update({ "system.sceneKey": this.currentSceneId })
                this.currentSceneDataItem = item;
                this.sendUpdateHookEvent();
            });
        }
    }

    sceneChangedHook(newScene) {
        if (!newScene) return;

        if (this.currentSceneId === newScene.id) {
            return;
        }

        this.currentSceneId = newScene.id;
        this.currentSceneName = newScene.name;
        this.findOrCreateSceneDataItem();
        this.sendUpdateHookEvent(false);
    }

    sceneUpdatedHook() {
        this.findOrCreateSceneDataItem();
        this.sendUpdateHookEvent();
    }

    /**
     * Retained no-op: the actor.update performed before this call fires the
     * central `updateActor` hook (lib/hooks.mjs) on every client, which
     * refreshes the scene tracker and dice roll app.
     */
    sendFloatableTagOrStatusUpdateForActor(actor) {}

    async addRollModification(name, value) {
        if (game.user.isGM === false) return;
        console.log("addRollModification", name, value);
        if (!this.currentSceneDataItem) return;
        let tags = this.currentSceneDataItem.system.diceRollTagsStatus || [];
        tags.push({ name, value: parseInt(value) });
        await this.currentSceneDataItem.update({ "system.diceRollTagsStatus": tags });

        this.sendUpdateHookEvent();
        DiceRollApp.instance?.updateTagsAndStatuses(true);
    }

    getRollModifications() {
        if (!this.currentSceneDataItem) return [];
        return this.currentSceneDataItem.system.diceRollTagsStatus || [];
    }

    getSceneAndStoryTags() {
        if (!this.currentSceneDataItem) return [];
        return this.currentSceneDataItem.system.floatingTagsAndStatuses || [];
    }

    getCombinedSelectedNPCTags(){
        // retrieve all npc from the current scene
        const scene = game.scenes.active;
        if (!scene) return []; // no active scene -> no npc tags
        const tokens = scene.tokens.contents;
        const actors = tokens.map(t => t.actor).filter(a => a && a.type == "litm-npc");
        const uniqueActors = [...new Set(actors)];
        let combinedSelectedTags = [];
        // loop through all npc and combine their selected floating tags and statuses
        uniqueActors.forEach(actor => {
            actor.system.floatingTagsAndStatuses.forEach(fts => {
                if (fts.selected) {
                    combinedSelectedTags.push({ name: fts.name, value: fts.value, isStatus: fts.isStatus, positive: fts.positive, source: 'litm-npc',actorId: actor.id,selected: fts.selected});
                }
            });
        });
        return combinedSelectedTags;
    }

    resetSelection() {
        if (!this.currentSceneDataItem) return;
        if (game.user.isGM === false) return;

        const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses) return;
        floatingTagsAndStatuses.forEach(t => t.selected = false);
        this.currentSceneDataItem.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });

        const scene = game.scenes.active;
        if (scene) {
            const actors = scene.tokens.contents.map(t => t.actor).filter(a => a && a.type == "litm-npc");
            const uniqueActors = [...new Set(actors)];
            for (const actor of uniqueActors) {
                console.log("Resetting selection for actor", actor.name);
                const npcTags = actor.system.floatingTagsAndStatuses;
                if (npcTags && npcTags.some(t => t.selected)) {
                    actor.update({ 'system.floatingTagsAndStatuses': npcTags.map(t => ({ ...t, selected: false })) });
                }
            }
        }

        this.sendUpdateHookEvent();
    }
}