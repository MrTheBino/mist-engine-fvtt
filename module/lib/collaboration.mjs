import { DiceRollApp } from "../apps/dice-roll-app.mjs";

/**
 * Cross-player collaboration (Core Book p. 158):
 *
 *  - Helping Each Other: while one hero rolls, other heroes may each contribute
 *    a single tag (+1 Power, cannot be burned). A Fellowship relationship tag
 *    is single-use and gets scratched once the roll is made (p. 68 / p. 138).
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

    /** Tag sources a hero may burn for Power in a group action (mirrors DiceRollApp.resetTags). */
    static BURNABLE_SOURCES = new Set(["powertag", "backpack"]);

    /** i18n label per contributable tag source, shown next to the tag name. */
    static SOURCE_LABELS = {
        "powertag": "MIST_ENGINE.COLLAB.SourcePowerTag",
        "backpack": "MIST_ENGINE.COLLAB.SourceBackpack",
        "rote": "MIST_ENGINE.COLLAB.SourceRote",
        "floating-tag": "MIST_ENGINE.COLLAB.SourceStoryTag",
        "fellowship-relationship": "MIST_ENGINE.COLLAB.SourceRelationship",
    };

    /**
     * All tags a hero could contribute to someone else's roll, following the
     * same eligibility as the regular dice roll (getPreparedTagsAndStatusesForRoll):
     * themebook power tags, backpack items, rotes, the hero's own floating story
     * tags (tags only — statuses and hindering tags don't help) and unscratched
     * Fellowship relationship tags. Fellowship theme tags are deliberately left
     * out: in a group action the Narrator adds those for the whole group.
     *
     * Each entry keeps its identity so the GM can persist a burn / scratch:
     * { key, name, source, docId, index, burnable }. `docId` is the item id for
     * themebook/backpack/rote entries and the actor id for actor-level arrays.
     */
    static contributableTags(actor) {
        const tags = [];
        if (!actor) return tags;
        const add = (name, source, docId, index) => tags.push({
            key: `${source}:${docId}:${index}`, name: name.trim(), source, docId, index,
            burnable: Collaboration.BURNABLE_SOURCES.has(source),
        });
        const usable = t => t?.name?.trim() && !t.planned && !t.burned && !t.expired;

        for (const item of actor.items ?? []) {
            if (item.type === "themebook") {
                (item.system.powertags ?? []).forEach((t, i) => { if (usable(t)) add(t.name, "powertag", item.id, i); });
            } else if (item.type === "backpack") {
                (item.system.items ?? []).forEach((t, i) => { if (usable(t)) add(t.name, "backpack", item.id, i); });
            } else if (item.type === "rote" && item.name?.trim()) {
                // a rote's title works as a tag (Core Book p. 98); nothing to burn
                add(item.name, "rote", item.id, 0);
            }
        }
        // floating story tags: DiceRollApp never burns these, so neither do we
        (actor.system.floatingTagsAndStatuses ?? []).forEach((t, i) => {
            if (t.name?.trim() && !t.isStatus && !(t.value > 0) && t.positive && !t.burned) add(t.name, "floating-tag", actor.id, i);
        });
        (actor.system.fellowships ?? []).forEach((f, i) => {
            if (f.relationshipTag?.trim() && !f.scratched) add(f.relationshipTag, "fellowship-relationship", actor.id, i);
        });
        return tags;
    }

    /** <option> list for contributableTags() entries, valued by their stable key. */
    static tagOptionsHtml(tags) {
        const esc = foundry.utils.escapeHTML;
        return tags.map(t => {
            const label = `${t.name} (${game.i18n.localize(Collaboration.SOURCE_LABELS[t.source] ?? t.source)})`;
            return `<option value="${esc(t.key)}" data-burnable="${t.burnable}">${esc(label)}</option>`;
        }).join("");
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
            case "helpUsed":
                if (msg.writerUserId === game.user.id) await Collaboration.#scratchHelpingTags(msg.tags);
                break;
            case "groupStart":
                if (msg.gmUserId !== game.user.id) await Collaboration.#contributeToGroup(msg);
                break;
            case "groupContribute":
                Collaboration.groupApp?.receiveContribution?.(msg);
                break;
            case "groupBurnRejected":
                if (msg.userId === game.user.id) {
                    ui.notifications.warn(game.i18n.format("MIST_ENGINE.COLLAB.BurnRejected", { tag: msg.tagName }));
                }
                break;
            case "groupEnd":
                Collaboration.closeGroupDialog(msg.groupId);
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
        const options = Collaboration.tagOptionsHtml(tags);
        let choice;
        try {
            choice = await foundry.applications.api.DialogV2.prompt({
                window: { title: game.i18n.localize("MIST_ENGINE.COLLAB.HelpTitle"), icon: "fa-solid fa-hands-helping" },
                classes: ["mist-engine", "dialog"],
                content: `<p>${game.i18n.format("MIST_ENGINE.COLLAB.HelpPrompt", { actor: foundry.utils.escapeHTML(msg.actorName ?? "") })}</p>`
                    + `<div class="form-group"><label>${game.i18n.localize("MIST_ENGINE.COLLAB.YourTag")}</label><select name="tag">${options}</select></div>`,
                ok: { label: game.i18n.localize("MIST_ENGINE.COLLAB.Contribute"), icon: "fa-solid fa-hands-helping", callback: (e, b) => tags.find(t => t.key === b.form.elements.tag.value) },
                rejectClose: false,
            });
        } catch (e) { return; }
        if (!choice) return;
        // helping never burns; the identity travels so a relationship tag can be
        // scratched once the roller actually rolls (reportHelpUsed)
        game.socket.emit(Collaboration.SOCKET, {
            action: "helpOffer", reqId: msg.reqId, helperName: actor.name, tagName: choice.name, byUserId: game.user.id,
            helperActorId: actor.id, source: choice.source, docId: choice.docId, index: choice.index,
        });
    }

    /**
     * Roller side, called once the roll that used `helpingTags` was made:
     * scratch every contributed Fellowship relationship tag. Other sources are
     * merely invoked (+1) and stay as they are. The roller usually doesn't own
     * the helper's actor, so exactly one client writes: the helper's user if
     * online, otherwise the active GM.
     */
    static reportHelpUsed(helpingTags) {
        const byWriter = new Map();
        for (const h of helpingTags ?? []) {
            if (h.source !== "fellowship-relationship" || !h.helperActorId) continue;
            const helper = game.users.get(h.helperUserId);
            const writerUserId = helper?.active ? helper.id : game.users.activeGM?.id;
            if (!writerUserId) {
                console.warn(`mist-engine-fvtt | helping: nobody online can scratch "${h.name}" of ${h.helperName}`);
                continue;
            }
            const tag = { helperActorId: h.helperActorId, source: h.source, docId: h.docId, index: h.index, tagName: h.name };
            byWriter.set(writerUserId, [...(byWriter.get(writerUserId) ?? []), tag]);
        }
        for (const [writerUserId, tags] of byWriter) {
            // a socket emit never reaches the sender — write locally when it's us
            if (writerUserId === game.user.id) Collaboration.#scratchHelpingTags(tags);
            else game.socket.emit(Collaboration.SOCKET, { action: "helpUsed", writerUserId, tags });
        }
    }

    /** Serialises scratch writes on this client, so two quick rolls can't overwrite each other's fellowships array. */
    static #scratchQueue = Promise.resolve();

    /** Writer side: set `scratched` on the helpers' relationship tags (name must still match). */
    static #scratchHelpingTags(tags) {
        Collaboration.#scratchQueue = Collaboration.#scratchQueue
            .then(() => Collaboration.#writeHelpingScratches(tags))
            .catch(e => console.error("mist-engine-fvtt | helping: scratching failed", e));
        return Collaboration.#scratchQueue;
    }

    static async #writeHelpingScratches(tags) {
        for (const [actorId, entries] of Map.groupBy(tags ?? [], t => t.helperActorId)) {
            const actor = game.actors.get(actorId);
            if (!actor?.isOwner) continue;
            const fellowships = (actor.system.fellowships ?? []).map(f => ({ ...f }));
            let changed = false;
            for (const t of entries) {
                const entry = fellowships[t.index];
                if (t.source === "fellowship-relationship" && entry?.relationshipTag?.trim() === t.tagName) {
                    fellowships[t.index] = { ...entry, scratched: true, selected: false };
                    changed = true;
                } else {
                    console.warn(`mist-engine-fvtt | helping: relationship tag "${t.tagName}" of ${actor.name} not found, not scratched`);
                }
            }
            if (changed) await actor.update({ "system.fellowships": fellowships });
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Acting Together (player contribution side)                         */
    /* ------------------------------------------------------------------ */

    /** Open contribute dialogs by groupId, so "groupEnd" can close them. */
    static groupDialogs = new Map();

    /** Close the contribute dialog of a finished group action (if still open). */
    static closeGroupDialog(groupId) {
        const dialog = Collaboration.groupDialogs.get(groupId);
        Collaboration.groupDialogs.delete(groupId);
        if (dialog?.rendered) dialog.close();
    }

    /** Player side: contribute one tag (optionally burned) to a group action. */
    static async #contributeToGroup(msg) {
        if (game.user.isGM) return; // the Narrator runs the group action, never contributes
        const actor = Collaboration.ownCharacter();
        if (!actor) return;
        const result = await Collaboration.promptGroupContribution(actor, msg.groupId);
        if (!result) return;
        const { entry, burn } = result;
        game.socket.emit(Collaboration.SOCKET, {
            action: "groupContribute", groupId: msg.groupId, actorId: actor.id, actorName: actor.name, userId: game.user.id,
            source: entry.source, docId: entry.docId, index: entry.index, tagName: entry.name, burn,
        });
    }

    /**
     * Ask the player which tag to contribute. Resolves to { entry, burn } or
     * null when dismissed / closed by "groupEnd". The burn checkbox is only
     * enabled for burnable tags (power tags and backpack items).
     */
    static async promptGroupContribution(actor, groupId) {
        const tags = Collaboration.contributableTags(actor);
        if (tags.length === 0) return null;
        let result;
        try {
            result = await foundry.applications.api.DialogV2.prompt({
                window: { title: game.i18n.localize("MIST_ENGINE.COLLAB.GroupTitle"), icon: "fa-solid fa-people-group" },
                classes: ["mist-engine", "dialog"],
                content: `<p>${game.i18n.localize("MIST_ENGINE.COLLAB.GroupPrompt")}</p>`
                    + `<div class="form-group"><label>${game.i18n.localize("MIST_ENGINE.COLLAB.YourTag")}</label><select name="tag">${Collaboration.tagOptionsHtml(tags)}</select></div>`
                    + `<div class="form-group"><label><input type="checkbox" name="burn"> ${game.i18n.localize("MIST_ENGINE.COLLAB.BurnForPower")}</label></div>`,
                ok: {
                    label: game.i18n.localize("MIST_ENGINE.COLLAB.Contribute"),
                    callback: (e, b) => {
                        const entry = tags.find(t => t.key === b.form.elements.tag.value);
                        return entry ? { entry, burn: entry.burnable && b.form.elements.burn.checked } : null;
                    },
                },
                render: (event, dialog) => {
                    Collaboration.groupDialogs.set(groupId, dialog);
                    const { tag, burn } = dialog.element.querySelector("form").elements;
                    const syncBurn = () => {
                        const burnable = tag.selectedOptions[0]?.dataset.burnable === "true";
                        burn.disabled = !burnable;
                        if (!burnable) burn.checked = false;
                    };
                    tag.addEventListener("change", syncBurn);
                    syncBurn();
                },
                close: (event, dialog) => {
                    if (Collaboration.groupDialogs.get(groupId) === dialog) Collaboration.groupDialogs.delete(groupId);
                },
                rejectClose: false,
            });
        } catch (e) { return null; }
        return result?.entry ? result : null;
    }
}
