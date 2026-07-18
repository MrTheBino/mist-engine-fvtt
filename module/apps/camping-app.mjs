const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import { MistSceneApp } from "./scene-app.mjs";
import { DiceRollApp } from "./dice-roll-app.mjs";
import { FloatingTagAndStatusAdapter } from "../lib/floating-tag-and-status-adapter.mjs";
import { ArrayFieldAdapter } from "../lib/array-field-adapter.mjs";

/**
 * Camping & Sojourns (Core Book p. 179-181).
 * WIP-Implementation
 *
 */
export class CampingApp extends HandlebarsApplicationMixin(ApplicationV2) {

    static FLAG_SCOPE = "mist-engine-fvtt";
    static FLAG_KEY = "camping";
    static SOJOURN_BONUS = { days: 1, weeks: 2, months: 3 };

    constructor(options = {}) {
        super(options);
        CampingApp.instance = this;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'camping-app',
        classes: ['mist-engine', 'dialog', 'camping-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'MIST_ENGINE.CAMPING.Title',
            icon: 'fa-solid fa-campground',
            positioned: true,
            resizable: true
        },
        position: {
            width: 640,
            height: 820
        },
        actions: {
            campingNextPeriod: this.#handleNextPeriod,
            campingOpenThirdPeriod: this.#handleOpenThirdPeriod,
            campingEnd: this.#handleEnd,
            campingAddCampsiteTag: this.#handleAddCampsiteTag,
            campingDeleteCampsiteTag: this.#handleDeleteCampsiteTag,
            campingChooseRest: this.#handleChooseRest,
            campingExpireStatus: this.#handleExpireStatus,
            campingChooseReflect: this.#handleChooseReflect,
            campingActionRoll: this.#handleCampActionRoll,
            campingActionSpendPower: this.#handleCampActionSpendPower,
            campingToggleExpiring: this.#handleToggleExpiring,
            campingApplyExpiration: this.#handleApplyExpiration,
            campingRecoverFellowship: this.#handleRecoverFellowship,
            campingNewRelationshipTag: this.#handleNewRelationshipTag
        },
    };

    /** @override */
    static PARTS = {
        main: {
            template: 'systems/mist-engine-fvtt/templates/camping-app/main.hbs',
            scrollable: ['']
        }
    };

    static getInstance(options = {}) {
        if (!CampingApp.instance) {
            CampingApp.instance = new CampingApp(options);
        }
        return CampingApp.instance;
    }

    /** The active scene's scene-data item (holds system.camping). */
    static sceneData() {
        const sceneApp = MistSceneApp.getInstance();
        // players may have processed canvasReady before the GM's scene-data
        // item arrived — re-resolve it before giving up
        if (!sceneApp.currentSceneDataItem) sceneApp.findOrCreateSceneDataItem();
        return sceneApp.currentSceneDataItem;
    }

    /** All player-owned characters taking part in the camping scene. */
    static campingCharacters() {
        let chars = game.actors.filter(a => a.type === "litm-character" && a.hasPlayerOwner);
        if (chars.length === 0) chars = game.actors.filter(a => a.type === "litm-character");
        return chars;
    }

    /** The current user's own character (players only). */
    static ownCharacter() {
        return game.user.character ?? game.actors.find(a => a.isOwner && a.type === "litm-character") ?? null;
    }

    campingFlags(actor) {
        return actor.getFlag(CampingApp.FLAG_SCOPE, CampingApp.FLAG_KEY) ?? {};
    }

    /** Sidebar entry point for the GM: setup dialog when inactive, else open. */
    static async openForGM() {
        if (!game.scenes.active) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.CAMPING.NoActiveScene"));
            return;
        }
        const sd = CampingApp.sceneData();
        if (!sd) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.CAMPING.NoActiveScene"));
            return;
        }
        if (sd.system.camping.active) {
            CampingApp.getInstance().render(true, { focus: true });
            return;
        }
        await CampingApp.#showSetupDialog(sd);
    }

    static async #showSetupDialog(sd) {
        const content = `
            <div class="form-group">
                <label>${game.i18n.localize("MIST_ENGINE.CAMPING.Mode")}</label>
                <select name="mode">
                    <option value="camp">${game.i18n.localize("MIST_ENGINE.CAMPING.Camp")}</option>
                    <option value="sojourn">${game.i18n.localize("MIST_ENGINE.CAMPING.Sojourn")}</option>
                </select>
            </div>
            <div class="form-group">
                <label>${game.i18n.localize("MIST_ENGINE.CAMPING.Duration")}</label>
                <select name="duration">
                    <option value="days">${game.i18n.localize("MIST_ENGINE.CAMPING.Durations.days")}</option>
                    <option value="weeks">${game.i18n.localize("MIST_ENGINE.CAMPING.Durations.weeks")}</option>
                    <option value="months">${game.i18n.localize("MIST_ENGINE.CAMPING.Durations.months")}</option>
                </select>
                <p class="hint">${game.i18n.localize("MIST_ENGINE.CAMPING.DurationHint")}</p>
            </div>`;

        const result = await foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize("MIST_ENGINE.CAMPING.SetupTitle"), icon: "fa-solid fa-campground" },
            classes: ["mist-engine", "dialog"],
            content,
            ok: {
                label: game.i18n.localize("MIST_ENGINE.CAMPING.Start"),
                icon: "fa-solid fa-campground",
                callback: (event, button) => ({
                    mode: button.form.elements.mode.value,
                    duration: button.form.elements.duration.value
                })
            },
            rejectClose: false
        });
        if (!result) return;

        await sd.update({
            "system.camping": {
                active: true,
                mode: result.mode,
                duration: result.duration,
                period: 1,
                thirdPeriodOpen: false
            }
        });
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatStartedTitle", null, [
            game.i18n.format("MIST_ENGINE.CAMPING.ChatStartedLine", {
                mode: game.i18n.localize(result.mode === "sojourn" ? "MIST_ENGINE.CAMPING.Sojourn" : "MIST_ENGINE.CAMPING.Camp"),
                duration: game.i18n.localize(`MIST_ENGINE.CAMPING.Durations.${result.duration}`)
            })
        ]);
        CampingApp.getInstance().render(true, { focus: true });
    }

    /**
     * Player activities cannot be taken back — ask before executing.
     * @returns {Promise<boolean>} true if the player confirmed.
     */
    static async confirmAction(messageKey, data = {}) {
        return foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize("MIST_ENGINE.CAMPING.ConfirmTitle"), icon: "fa-solid fa-campground" },
            classes: ["mist-engine", "dialog"],
            content: `<p>${game.i18n.format(messageKey, data)}</p>`,
            rejectClose: false,
            modal: true
        });
    }

    static async postChat(titleKey, actor, lines) {
        const html = await foundry.applications.handlebars.renderTemplate(
            "systems/mist-engine-fvtt/templates/chat/camping-entry.hbs",
            {
                title: game.i18n.localize(titleKey),
                actorName: actor?.name ?? null,
                lines: lines ?? []
            }
        );
        await ChatMessage.create({
            content: html,
            speaker: actor ? ChatMessage.getSpeaker({ actor }) : { alias: game.i18n.localize("MIST_ENGINE.CAMPING.Title") }
        });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const sd = CampingApp.sceneData();
        context.hasSceneData = !!sd && sd.system.camping.active;
        context.isGM = game.user.isGM;
        if (!context.hasSceneData) return context;

        const camping = sd.system.camping;
        context.camping = camping;
        context.isSojourn = camping.mode === "sojourn";
        context.modeLabel = game.i18n.localize(context.isSojourn ? "MIST_ENGINE.CAMPING.Sojourn" : "MIST_ENGINE.CAMPING.Camp");
        context.durationLabel = game.i18n.localize(`MIST_ENGINE.CAMPING.Durations.${camping.duration}`);
        context.bonusPower = context.isSojourn ? CampingApp.SOJOURN_BONUS[camping.duration] : 0;
        context.maxPeriod = camping.thirdPeriodOpen ? 3 : 2;
        context.canAdvancePeriod = camping.period < context.maxPeriod;
        context.isThirdPeriod = camping.period === 3;

        // campsite tags & statuses (scene-data floating tags)
        context.campsiteTags = (sd.system.floatingTagsAndStatuses ?? []).map((t, i) => ({
            name: t.name, value: t.value, isStatus: t.isStatus, positive: t.positive, index: i
        }));

        const mapBackpack = (actor) => {
            const backpack = actor.items.find(i => i.type === "backpack");
            if (!backpack) return [];
            return (backpack.system.items ?? [])
                .map((e, i) => ({ name: e.name, index: i, expiring: e.expiring, expired: e.expired }))
                .filter(e => e.name && e.name.trim() !== "");
        };

        // GM: all camping characters with their state
        if (context.isGM) {
            context.characters = CampingApp.campingCharacters().map(actor => {
                const flags = this.campingFlags(actor);
                return {
                    id: actor.id,
                    name: actor.name,
                    img: actor.img,
                    backpack: mapBackpack(actor),
                    restUsed: !!flags.restUsed,
                    reflectUsed: !!flags.reflectUsed,
                    fellowshipUsed: !!flags.fellowshipUsed,
                    activities: flags.activities ?? []
                };
            });
        }

        // player: own character state
        const own = context.isGM ? null : CampingApp.ownCharacter();
        if (own) {
            const flags = this.campingFlags(own);
            const themebooks = own.items.filter(i => i.type === "themebook" && !i.system.options?.isStoryTheme)
                .map(t => ({ id: t.id, name: t.name, improve: t.system.improve }));
            const themecard = game.actors.get(own.system.actorSharedSingleThemecardId);
            context.own = {
                id: own.id,
                name: own.name,
                statuses: (own.system.floatingTagsAndStatuses ?? []).map((t, i) => ({
                    name: t.name, value: t.value, isStatus: t.isStatus, positive: t.positive, index: i
                })),
                themebooks,
                hasThemecard: !!themecard,
                themecardName: themecard?.name,
                backpack: mapBackpack(own),
                restUsed: !!flags.restUsed,
                reflectUsed: !!flags.reflectUsed,
                fellowshipUsed: !!flags.fellowshipUsed,
                scratchedFellowships: (own.system.fellowships ?? [])
                    .map((f, i) => ({ name: f.relationshipTag, companion: f.companion, index: i, scratched: f.scratched }))
                    .filter(f => f.scratched && f.name)
            };
        }

        return context;
    }

    /* ------------------------------------------------------------------ */
    /*  GM: mode control                                                   */
    /* ------------------------------------------------------------------ */

    static async #handleNextPeriod(event, target) {
        if (!game.user.isGM) return;
        const sd = CampingApp.sceneData();
        if (!sd) return;
        const camping = sd.system.camping;
        const max = camping.thirdPeriodOpen ? 3 : 2;
        if (camping.period >= max) return;
        await sd.update({ "system.camping.period": camping.period + 1 });
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatPeriodTitle", null, [
            game.i18n.format("MIST_ENGINE.CAMPING.ChatPeriodLine", { period: camping.period + 1 })
        ]);
    }

    static async #handleOpenThirdPeriod(event, target) {
        if (!game.user.isGM) return;
        const sd = CampingApp.sceneData();
        if (!sd || sd.system.camping.thirdPeriodOpen) return;
        await sd.update({ "system.camping.thirdPeriodOpen": true });
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatThirdTitle", null, [
            game.i18n.localize("MIST_ENGINE.CAMPING.ChatThirdLine")
        ]);
    }

    static async #handleEnd(event, target) {
        if (!game.user.isGM) return;
        const sd = CampingApp.sceneData();
        if (!sd) return;

        // clear per-hero camping state and pending (unapplied) expiration marks
        for (const actor of CampingApp.campingCharacters()) {
            await actor.unsetFlag(CampingApp.FLAG_SCOPE, CampingApp.FLAG_KEY);
            const backpack = actor.items.find(i => i.type === "backpack");
            if (backpack && (backpack.system.items ?? []).some(e => e.expiring)) {
                const items = backpack.system.items.map(e => ({ ...e, expiring: false }));
                await backpack.update({ "system.items": items });
            }
        }

        await sd.update({ "system.camping": { active: false, period: 1, thirdPeriodOpen: false } });
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatEndedTitle", null, [
            game.i18n.localize("MIST_ENGINE.CAMPING.ChatEndedLine")
        ]);
        this.close();
    }

    /* ------------------------------------------------------------------ */
    /*  GM: campsite tags                                                  */
    /* ------------------------------------------------------------------ */

    static async #handleAddCampsiteTag(event, target) {
        if (!game.user.isGM) return;
        const sd = CampingApp.sceneData();
        if (!sd) return;

        let str;
        try {
            str = await foundry.applications.api.DialogV2.prompt({
                window: { title: game.i18n.localize("MIST_ENGINE.CAMPING.AddCampsiteTag") },
                content: '<input name="srcStatusTagStr" type="text" autofocus placeholder="beautiful vista or rainy-2">',
                ok: {
                    label: game.i18n.localize("MIST_ENGINE.CAMPING.Add"),
                    callback: (event, button) => button.form.elements.srcStatusTagStr.value
                },
                rejectClose: false
            });
        } catch (e) { return; }
        if (!str || str.trim().length === 0) return;

        const ftsObject = FloatingTagAndStatusAdapter.parseFloatingTagAndStatusString(str);
        const list = sd.system.floatingTagsAndStatuses ?? [];
        await sd.update({ "system.floatingTagsAndStatuses": FloatingTagAndStatusAdapter.withStatusStacked(list, ftsObject) });
        MistSceneApp.instance?.sendUpdateHookEvent(false);
    }

    static async #handleDeleteCampsiteTag(event, target) {
        if (!game.user.isGM) return;
        const sd = CampingApp.sceneData();
        if (!sd) return;
        await FloatingTagAndStatusAdapter.handleDeleteFloatingTagOrStatus(sd, parseInt(target.dataset.index));
        MistSceneApp.instance?.sendUpdateHookEvent(false);
    }

    /* ------------------------------------------------------------------ */
    /*  Player: activities                                                 */
    /* ------------------------------------------------------------------ */

    async #logActivity(actor, type, extra = {}) {
        const sd = CampingApp.sceneData();
        const flags = this.campingFlags(actor);
        const activities = [...(flags.activities ?? []), { period: sd?.system.camping.period ?? 1, type }];
        await actor.setFlag(CampingApp.FLAG_SCOPE, CampingApp.FLAG_KEY, { ...flags, ...extra, activities });
    }

    static async #handleChooseRest(event, target) {
        const actor = CampingApp.ownCharacter();
        if (!actor) return;
        if (this.campingFlags(actor).restUsed) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.CAMPING.RestAlreadyUsed"));
            return;
        }
        if (!await CampingApp.confirmAction("MIST_ENGINE.CAMPING.ConfirmRest")) return;
        await this.#logActivity(actor, "rest", { restUsed: true });
        const sojourn = CampingApp.sceneData()?.system.camping.mode === "sojourn";
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatRestTitle", actor, [
            game.i18n.localize(sojourn ? "MIST_ENGINE.CAMPING.ChatRestLineSojourn" : "MIST_ENGINE.CAMPING.ChatRestLine")
        ]);
    }

    /** Rest: expire one of the hero's own statuses / floating tags. */
    static async #handleExpireStatus(event, target) {
        const actor = CampingApp.ownCharacter();
        if (!actor) return;
        const index = parseInt(target.dataset.index);
        const entry = (actor.system.floatingTagsAndStatuses ?? [])[index];
        if (!entry) return;
        if (!await CampingApp.confirmAction("MIST_ENGINE.CAMPING.ConfirmExpireStatus", { name: entry.name })) return;
        await FloatingTagAndStatusAdapter.handleDeleteFloatingTagOrStatus(actor, index);
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatStatusExpiredTitle", actor, [
            game.i18n.format("MIST_ENGINE.CAMPING.ChatStatusExpiredLine", { name: entry.name })
        ]);
    }

    static async #handleChooseReflect(event, target) {
        const actor = CampingApp.ownCharacter();
        if (!actor) return;
        if (this.campingFlags(actor).reflectUsed) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.CAMPING.ReflectAlreadyUsed"));
            return;
        }

        let doc = null;
        if (target.dataset.themeId === "fellowship-themecard") {
            doc = game.actors.get(actor.system.actorSharedSingleThemecardId);
        } else {
            doc = actor.items.get(target.dataset.themeId);
        }
        if (!doc) return;
        if (!await CampingApp.confirmAction("MIST_ENGINE.CAMPING.ConfirmReflect", { theme: doc.name })) return;

        const improve = Math.min((doc.system.improve ?? 0) + 1, 3);
        await doc.update({ "system.improve": improve });
        await this.#logActivity(actor, "reflect", { reflectUsed: true });
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatReflectTitle", actor, [
            game.i18n.format("MIST_ENGINE.CAMPING.ChatReflectLine", { theme: doc.name })
        ]);
        actor.sheet?.render();
    }

    /** Camp Action with a roll: open the normal dice dialog (+ sojourn bonus). */
    static async #handleCampActionRoll(event, target) {
        const actor = CampingApp.ownCharacter();
        if (!actor) return;
        const sd = CampingApp.sceneData();
        const bonus = sd?.system.camping.mode === "sojourn"
            ? CampingApp.SOJOURN_BONUS[sd.system.camping.duration] : 0;

        await this.#logActivity(actor, "action");
        const app = DiceRollApp.getInstance({ actor, type: "quick" });
        app.updateTagsAndStatuses();
        if (bonus > 0) app.numModPositive = bonus;
        app.render(true, { focus: true });
    }

    /** Camp Action without a roll: spend half your Power (rounded up). */
    static async #handleCampActionSpendPower(event, target) {
        const actor = CampingApp.ownCharacter();
        if (!actor) return;
        const sd = CampingApp.sceneData();
        const bonus = sd?.system.camping.mode === "sojourn"
            ? CampingApp.SOJOURN_BONUS[sd.system.camping.duration] : 0;

        const app = DiceRollApp.getInstance({ actor, type: "quick" });
        app.updateTagsAndStatuses();
        app.numModPositive = bonus;
        app.numModNegative = 0;
        const power = app.computePowerAmount();

        // computePowerAmount clamps to 1; require an actual selection of >= 1 Power
        const hasSelection = app.selectedTags.length > 0 || app.selectedStoryTags.length > 0 || bonus > 0;
        if (!hasSelection) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.CAMPING.NoPowerSelected"));
            return;
        }

        const spend = Math.ceil(power / 2);
        if (!await CampingApp.confirmAction("MIST_ENGINE.CAMPING.ConfirmSpendPower", { spend, power })) return;
        await this.#logActivity(actor, "action");
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatActionTitle", actor, [
            game.i18n.format("MIST_ENGINE.CAMPING.ChatActionSpendLine", { spend, power })
        ]);
        app.numModPositive = 0;
        await app.resetTags();
    }

    /* ------------------------------------------------------------------ */
    /*  Backpack expiration review                                         */
    /* ------------------------------------------------------------------ */

    static async #handleToggleExpiring(event, target) {
        const actor = game.actors.get(target.dataset.actorId);
        if (!actor) return;
        if (!game.user.isGM && !actor.isOwner) return;

        const backpack = actor.items.find(i => i.type === "backpack");
        if (!backpack) return;
        const index = parseInt(target.dataset.index);
        const entry = (backpack.system.items ?? [])[index];
        if (!entry) return;

        if (entry.expired) {
            // recreate: only the GM brings an expired tag back to working order
            if (!game.user.isGM) return;
            await ArrayFieldAdapter.patch(backpack, "system.items", index, { expired: false, expiring: false });
            await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatRecreatedTitle", actor, [
                game.i18n.format("MIST_ENGINE.CAMPING.ChatRecreatedLine", { name: entry.name })
            ]);
            return;
        }
        await ArrayFieldAdapter.patch(backpack, "system.items", index, { expiring: !entry.expiring });
    }

    static async #handleApplyExpiration(event, target) {
        if (!game.user.isGM) return;
        for (const actor of CampingApp.campingCharacters()) {
            const backpack = actor.items.find(i => i.type === "backpack");
            if (!backpack) continue;
            const marked = (backpack.system.items ?? []).filter(e => e.expiring);
            if (marked.length === 0) continue;
            const items = backpack.system.items.map(e => e.expiring
                ? { ...e, expiring: false, expired: true, selected: false, toBurn: false }
                : e);
            await backpack.update({ "system.items": items });
            await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatExpiredTitle", actor,
                marked.map(e => game.i18n.format("MIST_ENGINE.CAMPING.ChatExpiredLine", { name: e.name })));
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Fellowship quality time                                            */
    /* ------------------------------------------------------------------ */

    static async #handleRecoverFellowship(event, target) {
        const actor = CampingApp.ownCharacter();
        if (!actor) return;
        if (this.campingFlags(actor).fellowshipUsed) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.CAMPING.FellowshipAlreadyUsed"));
            return;
        }
        const index = parseInt(target.dataset.index);
        const fellowships = actor.system.fellowships ?? [];
        if (!fellowships[index]?.scratched) return;
        if (!await CampingApp.confirmAction("MIST_ENGINE.CAMPING.ConfirmRecoverFellowship", { name: fellowships[index].relationshipTag })) return;
        fellowships[index].scratched = false;
        await actor.update({ "system.fellowships": fellowships });
        await this.#logActivity(actor, "fellowship", { fellowshipUsed: true });
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatFellowshipTitle", actor, [
            game.i18n.format("MIST_ENGINE.CAMPING.ChatFellowshipRecoverLine", { name: fellowships[index].relationshipTag })
        ]);
        actor.sheet?.render();
    }

    static async #handleNewRelationshipTag(event, target) {
        const actor = CampingApp.ownCharacter();
        if (!actor) return;
        if (this.campingFlags(actor).fellowshipUsed) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.CAMPING.FellowshipAlreadyUsed"));
            return;
        }

        const content = `
            <div class="form-group">
                <label>${game.i18n.localize("MIST_ENGINE.PLACEHOLDERS.Companion")}</label>
                <input name="companion" type="text" autofocus>
            </div>
            <div class="form-group">
                <label>${game.i18n.localize("MIST_ENGINE.PLACEHOLDERS.Tag")}</label>
                <input name="relationshipTag" type="text">
            </div>`;
        const result = await foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize("MIST_ENGINE.CAMPING.NewRelationshipTag") },
            classes: ["mist-engine", "dialog"],
            content,
            ok: {
                label: game.i18n.localize("MIST_ENGINE.CAMPING.Add"),
                callback: (event, button) => ({
                    companion: button.form.elements.companion.value,
                    relationshipTag: button.form.elements.relationshipTag.value
                })
            },
            rejectClose: false
        });
        if (!result || !result.relationshipTag?.trim()) return;

        await ArrayFieldAdapter.add(actor, "system.fellowships",
            { companion: result.companion, relationshipTag: result.relationshipTag, selected: false, scratched: false });
        await this.#logActivity(actor, "fellowship", { fellowshipUsed: true });
        await CampingApp.postChat("MIST_ENGINE.CAMPING.ChatFellowshipTitle", actor, [
            game.i18n.format("MIST_ENGINE.CAMPING.ChatFellowshipNewLine", {
                name: result.relationshipTag, companion: result.companion
            })
        ]);
        actor.sheet?.render();
    }
}
