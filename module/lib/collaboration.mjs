import { DiceRollApp } from "../apps/dice-roll-app.mjs";

/**
 * Cross-player collaboration (Core Book p. 131):
 *
 *  - Helping Each Other: while one hero rolls, other heroes may each contribute
 *    a single tag (+1 Power, cannot be burned).
 *  - Acting Together: a group action collects one tag per hero into a single
 *    roll (one hero may burn); the outcome affects the whole group. The GM
 *    side of that lives in GroupActionApp; this module carries the socket.
 *
 * Socket channel "system.mist-engine-fvtt" (shared with RollConfirmation;
 * multiple listeners coexist, each filters its own actions).
 */
export class Collaboration {
    static SOCKET = "system.mist-engine-fvtt";

    /** GroupActionApp registers itself here so socket contributions reach it. */
    static groupApp = null;

    static setup() {
        game.socket.on(Collaboration.SOCKET, (msg) => Collaboration.#onMessage(msg));
    }

    /** The current user's own character (players), or null. */
    static ownCharacter() {
        return game.user.character ?? game.actors.find(a => a.isOwner && a.type === "litm-character") ?? null;
    }

    /** Are there other active players (besides me) who could help? */
    static hasOtherPlayers() {
        return game.users.some(u => u.active && u.id !== game.user.id && !u.isGM);
    }

    /** All contributable tag names of an actor (power tags + fellowship relationships). */
    static contributableTags(actor) {
        const tags = [];
        for (const item of actor?.items ?? []) {
            if (item.type === "themebook") {
                (item.system.powertags ?? []).forEach(t => {
                    if (t.name?.trim() && !t.planned && !t.burned) tags.push(t.name.trim());
                });
            }
        }
        (actor?.system.fellowships ?? []).forEach(f => {
            if (f.relationshipTag?.trim() && !f.scratched) tags.push(f.relationshipTag.trim());
        });
        return [...new Set(tags)];
    }

    /* ------------------------------------------------------------------ */
    /*  Helping Each Other                                                 */
    /* ------------------------------------------------------------------ */

    /** Roller side: broadcast a help request for the current dice roll. */
    static requestHelp(app) {
        if (!app?.actor) return;
        const reqId = foundry.utils.randomID();
        app.pendingHelpReqId = reqId;
        game.socket.emit(Collaboration.SOCKET, {
            action: "helpRequest", reqId, actorId: app.actor.id, actorName: app.actor.name, byUserId: game.user.id,
        });
        ui.notifications.info(game.i18n.localize("MIST_ENGINE.COLLAB.HelpRequested"));
    }

    /** Roller side: withdraw the pending help request. */
    static cancelHelp(reqId) {
        if (!reqId) return;
        game.socket.emit(Collaboration.SOCKET, { action: "helpCancel", reqId });
    }

    static async #onMessage(msg) {
        switch (msg?.action) {
            case "helpRequest":
                if (msg.byUserId !== game.user.id) await Collaboration.#offerHelp(msg);
                break;
            case "helpOffer":
                if (DiceRollApp.instance?.pendingHelpReqId === msg.reqId) DiceRollApp.instance.addHelpingTag(msg);
                break;
            case "groupStart":
                if (msg.gmUserId !== game.user.id) await Collaboration.#contributeToGroup(msg);
                break;
            case "groupContribute":
                Collaboration.groupApp?.receiveContribution?.(msg);
                break;
        }
    }

    /** GM side: open the group action app. */
    static openGroupAction() {
        import("../apps/group-action-app.mjs").then(m => m.GroupActionApp.open());
    }

    /** Helper side: prompt to contribute one tag to the roller's action. */
    static async #offerHelp(msg) {
        const actor = Collaboration.ownCharacter();
        if (!actor) return; // GM / players without a character skip
        const tags = Collaboration.contributableTags(actor);
        if (tags.length === 0) return;
        const options = tags.map(t => `<option value="${t.replace(/"/g, "&quot;")}">${t}</option>`).join("");
        let choice;
        try {
            choice = await foundry.applications.api.DialogV2.prompt({
                window: { title: game.i18n.localize("MIST_ENGINE.COLLAB.HelpTitle"), icon: "fa-solid fa-hands-helping" },
                classes: ["mist-engine", "dialog"],
                content: `<p>${game.i18n.format("MIST_ENGINE.COLLAB.HelpPrompt", { actor: msg.actorName })}</p>`
                    + `<div class="form-group"><label>${game.i18n.localize("MIST_ENGINE.COLLAB.YourTag")}</label><select name="tag">${options}</select></div>`,
                ok: { label: game.i18n.localize("MIST_ENGINE.COLLAB.Contribute"), icon: "fa-solid fa-hands-helping", callback: (e, b) => b.form.elements.tag.value },
                rejectClose: false,
            });
        } catch (e) { return; }
        if (!choice) return;
        game.socket.emit(Collaboration.SOCKET, { action: "helpOffer", reqId: msg.reqId, helperName: actor.name, tagName: choice, byUserId: game.user.id });
    }

    /* ------------------------------------------------------------------ */
    /*  Acting Together (player contribution side)                         */
    /* ------------------------------------------------------------------ */

    /** Player side: contribute one tag (optionally burned) to a group action. */
    static async #contributeToGroup(msg) {
        const actor = Collaboration.ownCharacter();
        if (!actor) return;
        const tags = Collaboration.contributableTags(actor);
        if (tags.length === 0) return;
        const options = tags.map(t => `<option value="${t.replace(/"/g, "&quot;")}">${t}</option>`).join("");
        let result;
        try {
            result = await foundry.applications.api.DialogV2.prompt({
                window: { title: game.i18n.localize("MIST_ENGINE.COLLAB.GroupTitle"), icon: "fa-solid fa-people-group" },
                classes: ["mist-engine", "dialog"],
                content: `<p>${game.i18n.localize("MIST_ENGINE.COLLAB.GroupPrompt")}</p>`
                    + `<div class="form-group"><label>${game.i18n.localize("MIST_ENGINE.COLLAB.YourTag")}</label><select name="tag">${options}</select></div>`
                    + `<div class="form-group"><label><input type="checkbox" name="burn"> ${game.i18n.localize("MIST_ENGINE.COLLAB.BurnForPower")}</label></div>`,
                ok: { label: game.i18n.localize("MIST_ENGINE.COLLAB.Contribute"), callback: (e, b) => ({ tag: b.form.elements.tag.value, burn: b.form.elements.burn.checked }) },
                rejectClose: false,
            });
        } catch (e) { return; }
        if (!result?.tag) return;
        game.socket.emit(Collaboration.SOCKET, { action: "groupContribute", groupId: msg.groupId, actorName: actor.name, tagName: result.tag, burn: result.burn, byUserId: game.user.id });
    }
}
