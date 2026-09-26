const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import { Collaboration } from "../lib/collaboration.mjs";

/**
 * Acting Together — group action (Core Book p. 158). GM-facing.
 *
 * The GM starts a group action; each online hero contributes a single tag
 * (Fellowship relationship tags count against that one-tag maximum), and one
 * hero may burn a tag for Power. Any or all of the Fellowship theme power tags
 * may be invoked on top of that (+1 each). The GM makes one roll for the group
 * and the outcome affects everyone. Contributions arrive via the Collaboration
 * socket; after the roll the GM persists the burn and scratched relationships.
 */
export class GroupActionApp extends HandlebarsApplicationMixin(ApplicationV2) {

    static instance = null;

    constructor(options = {}) {
        super(options);
        this.groupId = null;
        // { actorId, actorName, userId, source, docId, index, tagName, burn }
        this.contributions = [];
        this.selectedExtras = new Set(); // Fellowship theme tag keys "<themecardId>:<index>"
        this.gmMod = 0;
        GroupActionApp.instance = this;
    }

    static getInstance(options = {}) {
        if (!GroupActionApp.instance) GroupActionApp.instance = new GroupActionApp(options);
        return GroupActionApp.instance;
    }

    static open() {
        if (!game.user.isGM) return;
        GroupActionApp.getInstance().render(true, { focus: true });
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "group-action-app",
        classes: ["mist-engine", "dialog", "group-action-app"],
        tag: "div",
        window: { frame: true, title: "MIST_ENGINE.COLLAB.GroupTitle", icon: "fa-solid fa-people-group", positioned: true, resizable: true },
        position: { width: 460, height: 560 },
        actions: {
            groupStart: this.#handleStart,
            groupRoll: this.#handleRoll,
            groupRemove: this.#handleRemove,
            groupToggleExtra: this.#handleToggleExtra,
            groupModMinus: this.#handleModMinus,
            groupModPlus: this.#handleModPlus,
        },
    };

    /** @override */
    static PARTS = { dialog: { template: "systems/mist-engine-fvtt/templates/group-action-app/dialog.hbs", scrollable: [""] } };

    /**
     * Fellowship theme power tags available to the group: the unburned, named,
     * non-planned power tags of every Fellowship themecard linked to a
     * contributing hero (deduped). Each { key, name, themecardName, selected }.
     */
    fellowshipTags() {
        const themecards = new Map();
        for (const c of this.contributions) {
            const id = game.actors.get(c.actorId)?.system.actorSharedSingleThemecardId;
            const themecard = id ? game.actors.get(id) : null;
            if (themecard) themecards.set(themecard.id, themecard);
        }
        const tags = [];
        for (const themecard of themecards.values()) {
            (themecard.system.powertags ?? []).forEach((t, i) => {
                if (!t.name?.trim() || t.burned || t.planned) return;
                const key = `${themecard.id}:${i}`;
                tags.push({ key, themecardId: themecard.id, index: i, name: t.name.trim(), themecardName: themecard.name, selected: this.selectedExtras.has(key) });
            });
        }
        return tags;
    }

    /** Selected Fellowship theme tags that are still available. */
    selectedFellowshipTags() {
        return this.fellowshipTags().filter(t => t.selected);
    }

    /** Number of Power the group has: 1 per tag, a burn adds +2 more, +1 per Fellowship theme tag, plus GM mod. */
    computePower() {
        const base = this.contributions.length;
        const burnBonus = this.contributions.some(c => c.burn) ? 2 : 0;
        const extras = this.selectedFellowshipTags().length;
        return Math.max(1, base + burnBonus + extras + (this.gmMod || 0));
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.started = !!this.groupId;
        context.contributions = this.contributions;
        context.fellowshipTags = this.fellowshipTags();
        context.gmMod = this.gmMod;
        context.power = this.computePower();
        context.hasBurn = this.contributions.some(c => c.burn);
        return context;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        Collaboration.groupApp = this; // route socket contributions here
    }

    _onClose(options) {
        super._onClose(options);
        if (Collaboration.groupApp === this) Collaboration.groupApp = null;
    }

    /** Socket callback: a hero contributed a tag. Enforce one-per-hero + single burn. */
    receiveContribution(msg) {
        if (msg.groupId !== this.groupId || !msg.actorId) return;
        // one tag per hero: replace an earlier contribution from the same actor
        this.contributions = this.contributions.filter(c => c.actorId !== msg.actorId);
        // only power tags / backpack items can burn; only one hero may burn — a
        // second burn is accepted as a plain tag and that player is told so
        let burn = !!msg.burn && Collaboration.BURNABLE_SOURCES.has(msg.source);
        if (burn && this.contributions.some(c => c.burn)) {
            burn = false;
            game.socket.emit(Collaboration.SOCKET, { action: "groupBurnRejected", groupId: this.groupId, userId: msg.userId, tagName: msg.tagName });
        }
        this.contributions.push({
            actorId: msg.actorId, actorName: msg.actorName, userId: msg.userId,
            source: msg.source, docId: msg.docId, index: msg.index, tagName: msg.tagName, burn,
        });
        this.render();
    }

    /**
     * Persist what the group action spent: the single burned tag (themebook
     * power tag or backpack item), every contributed Fellowship relationship
     * tag (scratched), as the regular roll does in DiceRollApp.resetTags(), and
     * every invoked Fellowship theme power tag — those are single-use and
     * scratched when invoked (Core Book p. 138).
     * Each write checks that the entry at that index still carries the
     * contributed name — the sheet may have changed since — and skips it otherwise.
     */
    async persistContributions(contributions, fellowshipTags) {
        const matches = (entry, name, field = "name") => entry && entry[field]?.trim() === name;
        for (const c of contributions) {
            const actor = game.actors.get(c.actorId);
            if (!actor) continue;
            if (c.burn) {
                const item = actor.items.get(c.docId);
                const path = c.source === "powertag" ? "powertags" : c.source === "backpack" ? "items" : null;
                const list = path && item ? (item.system[path] ?? []).map(t => ({ ...t })) : null;
                if (list && matches(list[c.index], c.tagName)) {
                    list[c.index] = { ...list[c.index], burned: true, toBurn: false, selected: false };
                    await item.update({ [`system.${path}`]: list });
                } else {
                    console.warn(`mist-engine-fvtt | group action: burned tag "${c.tagName}" of ${actor.name} not found, not burned`);
                }
            }
            if (c.source === "fellowship-relationship") {
                const fellowships = (actor.system.fellowships ?? []).map(f => ({ ...f }));
                if (matches(fellowships[c.index], c.tagName, "relationshipTag")) {
                    fellowships[c.index].scratched = true;
                    await actor.update({ "system.fellowships": fellowships });
                } else {
                    console.warn(`mist-engine-fvtt | group action: relationship tag "${c.tagName}" of ${actor.name} not found, not scratched`);
                }
            }
        }

        // one update per themecard; its linked character sheets refresh via their updateActor hook
        const byThemecard = Map.groupBy(fellowshipTags, t => t.themecardId);
        for (const [themecardId, tags] of byThemecard) {
            const themecard = game.actors.get(themecardId);
            if (!themecard) continue;
            const powertags = (themecard.system.powertags ?? []).map(t => ({ ...t }));
            for (const t of tags) {
                if (matches(powertags[t.index], t.name)) {
                    powertags[t.index] = { ...powertags[t.index], burned: true, toBurn: false, selected: false };
                } else {
                    console.warn(`mist-engine-fvtt | group action: Fellowship tag "${t.name}" of ${themecard.name} not found, not scratched`);
                }
            }
            await themecard.update({ "system.powertags": powertags });
        }
    }

    static async #handleStart(event, target) {
        this.groupId = foundry.utils.randomID();
        this.contributions = [];
        this.selectedExtras.clear();
        this.gmMod = 0;
        game.socket.emit(Collaboration.SOCKET, { action: "groupStart", groupId: this.groupId, gmUserId: game.user.id });
        ui.notifications.info(game.i18n.localize("MIST_ENGINE.COLLAB.GroupStarted"));
        this.render();
    }

    static async #handleRemove(event, target) {
        const idx = parseInt(target.dataset.index);
        if (idx >= 0 && idx < this.contributions.length) { this.contributions.splice(idx, 1); this.render(); }
    }

    static async #handleToggleExtra(event, target) {
        const key = target.dataset.key;
        if (this.selectedExtras.has(key)) this.selectedExtras.delete(key);
        else this.selectedExtras.add(key);
        this.render();
    }

    static async #handleModMinus(event, target) { this.gmMod -= 1; this.render(); }
    static async #handleModPlus(event, target) { this.gmMod += 1; this.render(); }

    static async #handleRoll(event, target) {
        if (!this.groupId) return;
        // Snapshot and close the group before the first await: contributions
        // arriving during the roll are dropped (receiveContribution checks
        // groupId), and a double-click can't roll twice.
        const groupId = this.groupId;
        const contributions = this.contributions;
        const power = this.computePower();
        const fellowshipTags = this.selectedFellowshipTags();
        this.groupId = null;
        let formula = "2d6";
        if (power > 0) formula += ` + ${power}`;
        const roll = new Roll(formula);
        await roll.evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true, null, false);

        const dice = roll.terms[0].results.map(r => r.result);
        const isCritical = dice[0] === 6 && dice[1] === 6;
        const isFumble = dice[0] === 1 && dice[1] === 1;
        let consequenceResult = roll.total >= 10 ? 1 : roll.total >= 7 ? 0 : -1;
        if (isCritical) consequenceResult = 1;
        if (isFumble) consequenceResult = -1;

        await this.persistContributions(contributions, fellowshipTags);

        const html = await foundry.applications.handlebars.renderTemplate(
            "systems/mist-engine-fvtt/templates/chat/group-result.hbs",
            {
                diceRollHTML: await roll.render(),
                contributions,
                fellowshipTags,
                power, consequenceResult, isCritical, isFumble,
            }
        );
        await ChatMessage.create({ content: html, speaker: { alias: game.i18n.localize("MIST_ENGINE.COLLAB.GroupTitle") } });

        // group action complete → tell players and reset
        game.socket.emit(Collaboration.SOCKET, { action: "groupEnd", groupId });
        this.contributions = [];
        this.selectedExtras.clear();
        this.gmMod = 0;
        this.close();
    }
}
