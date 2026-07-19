const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import { Collaboration } from "../lib/collaboration.mjs";

/**
 * Acting Together — group action (Core Book p. 131). GM-facing.
 *
 * The GM starts a group action; each online hero contributes a single tag
 * (Fellowship relationship tags count against that one-tag maximum), and one
 * hero may burn a tag for Power. The GM makes one roll for the group and the
 * outcome affects everyone. Contributions arrive via the Collaboration socket.
 */
export class GroupActionApp extends HandlebarsApplicationMixin(ApplicationV2) {

    static instance = null;

    constructor(options = {}) {
        super(options);
        this.groupId = null;
        this.contributions = []; // { actorName, tagName, burn }
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
            groupModMinus: this.#handleModMinus,
            groupModPlus: this.#handleModPlus,
        },
    };

    /** @override */
    static PARTS = { dialog: { template: "systems/mist-engine-fvtt/templates/group-action-app/dialog.hbs", scrollable: [""] } };

    /** Number of Power the group has: 1 per tag, a burn adds +2 more, plus GM mod. */
    computePower() {
        const base = this.contributions.length;
        const burnBonus = this.contributions.some(c => c.burn) ? 2 : 0;
        return Math.max(1, base + burnBonus + (this.gmMod || 0));
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.started = !!this.groupId;
        context.contributions = this.contributions;
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
        if (msg.groupId !== this.groupId) return;
        // one tag per hero: replace an earlier contribution from the same actor
        this.contributions = this.contributions.filter(c => c.actorName !== msg.actorName);
        // only one hero may burn: if someone already burns, downgrade this to non-burn
        const someoneBurns = this.contributions.some(c => c.burn);
        this.contributions.push({ actorName: msg.actorName, tagName: msg.tagName, burn: msg.burn && !someoneBurns });
        this.render();
    }

    static async #handleStart(event, target) {
        this.groupId = foundry.utils.randomID();
        this.contributions = [];
        this.gmMod = 0;
        game.socket.emit(Collaboration.SOCKET, { action: "groupStart", groupId: this.groupId, gmUserId: game.user.id });
        ui.notifications.info(game.i18n.localize("MIST_ENGINE.COLLAB.GroupStarted"));
        this.render();
    }

    static async #handleRemove(event, target) {
        const idx = parseInt(target.dataset.index);
        if (idx >= 0 && idx < this.contributions.length) { this.contributions.splice(idx, 1); this.render(); }
    }

    static async #handleModMinus(event, target) { this.gmMod -= 1; this.render(); }
    static async #handleModPlus(event, target) { this.gmMod += 1; this.render(); }

    static async #handleRoll(event, target) {
        if (!this.groupId) return;
        const power = this.computePower();
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

        const html = await foundry.applications.handlebars.renderTemplate(
            "systems/mist-engine-fvtt/templates/chat/group-result.hbs",
            {
                diceRollHTML: await roll.render(),
                contributions: this.contributions,
                power, consequenceResult, isCritical, isFumble,
            }
        );
        await ChatMessage.create({ content: html, speaker: { alias: game.i18n.localize("MIST_ENGINE.COLLAB.GroupTitle") } });

        // group action complete → tell players and reset
        game.socket.emit(Collaboration.SOCKET, { action: "groupEnd", groupId: this.groupId });
        this.groupId = null;
        this.contributions = [];
        this.gmMod = 0;
        this.close();
    }
}
