import { DiceRollApp } from "../apps/dice-roll-app.mjs";

/**
 * Optional GM confirmation for player rolls (system setting
 * "gmRollConfirmation"). A player's roll from the dice roll dialog is sent to
 * the active GM as a request first; the dice are only rolled on the player's
 * client after the GM approved the selection. On rejection the player can
 * adjust the selection and submit again.
 *
 * Socket protocol (channel "system.mist-engine-fvtt"):
 *  - rollConfirmRequest  player -> GM   { requestId, userId, actorId, rollType, snapshot }
 *  - rollConfirmResponse GM -> player   { requestId, userId, approved }
 *  - rollConfirmCancel   player -> GM   { requestId }
 */
export class RollConfirmation {

    static SOCKET = "system.mist-engine-fvtt";

    /** GM side: open confirmation dialogs by requestId, so a player cancel can close them. */
    static #openDialogs = new Map();

    static setup() {
        game.socket.on(RollConfirmation.SOCKET, (msg) => RollConfirmation.#onSocketMessage(msg));
    }

    /** Does a roll of the current user need a GM confirmation right now? */
    static needsConfirmation() {
        if (game.settings.get("mist-engine-fvtt", "gmRollConfirmation") !== true) return false;
        if (game.user.isGM) return false;
        return !!game.users.activeGM;
    }

    /**
     * Player side: send the roll request to the GM.
     * @param {DiceRollApp} app        the requesting dice roll app
     * @param {object} formValues      { numModPositive, numModNegative, mightScale }
     * @returns {string} requestId
     */
    static sendRequest(app, formValues) {
        const requestId = foundry.utils.randomID();
        game.socket.emit(RollConfirmation.SOCKET, {
            action: "rollConfirmRequest",
            requestId,
            userId: game.user.id,
            actorId: app.actor?.id ?? null,
            rollType: app.rollType,
            snapshot: {
                selectedTags: foundry.utils.deepClone(app.selectedTags),
                selectedGmTags: foundry.utils.deepClone(app.selectedGmTags),
                selectedStoryTags: foundry.utils.deepClone(app.selectedStoryTags),
                challengeTags: foundry.utils.deepClone(app.challengeTags),
                numModPositive: formValues.numModPositive,
                numModNegative: formValues.numModNegative,
                mightScale: formValues.mightScale,
                power: app.computePowerAmount()
            }
        });
        return requestId;
    }

    /** Player side: tell the GM that a pending request was withdrawn. */
    static sendCancel(requestId) {
        game.socket.emit(RollConfirmation.SOCKET, { action: "rollConfirmCancel", requestId });
    }

    static async #onSocketMessage(msg) {
        switch (msg?.action) {
            case "rollConfirmRequest":
                if (game.user === game.users.activeGM) await RollConfirmation.#showGmDialog(msg);
                break;
            case "rollConfirmCancel":
                if (game.user === game.users.activeGM) RollConfirmation.#onPlayerCancel(msg);
                break;
            case "rollConfirmResponse":
                if (msg.userId === game.user.id) DiceRollApp.instance?.handleConfirmationResponse(msg);
                break;
        }
    }

    static #respond(msg, approved) {
        game.socket.emit(RollConfirmation.SOCKET, {
            action: "rollConfirmResponse",
            requestId: msg.requestId,
            userId: msg.userId,
            approved
        });
    }

    static #onPlayerCancel(msg) {
        const dialog = RollConfirmation.#openDialogs.get(msg.requestId);
        if (!dialog) return;
        dialog._mistCanceledByPlayer = true;
        dialog.close();
        ui.notifications.info(game.i18n.localize("MIST_ENGINE.GM_CONFIRM.CanceledByPlayer"));
    }

    /** GM side: show the player's selection and approve or reject the roll. */
    static async #showGmDialog(msg) {
        const player = game.users.get(msg.userId);
        const actor = game.actors.get(msg.actorId);
        const snapshot = msg.snapshot ?? {};

        const content = await foundry.applications.handlebars.renderTemplate(
            "systems/mist-engine-fvtt/templates/dice-roll-app/gm-roll-confirm.hbs",
            {
                playerName: player?.name ?? "?",
                actorName: actor?.name ?? "?",
                rollTypeLabel: game.i18n.localize(`MIST_ENGINE.ROLL_TYPES.${msg.rollType}`),
                selectedTags: snapshot.selectedTags ?? [],
                selectedStoryTags: snapshot.selectedStoryTags ?? [],
                challengeTags: snapshot.challengeTags ?? [],
                selectedGmTags: snapshot.selectedGmTags ?? [],
                numModPositive: snapshot.numModPositive ?? 0,
                numModNegative: snapshot.numModNegative ?? 0,
                mightScale: snapshot.mightScale ?? 0,
                mightUsageEnabled: game.settings.get("mist-engine-fvtt", "mightUsageEnabled") === true,
                power: snapshot.power ?? 0
            }
        );

        let decided = false;
        const dialog = new foundry.applications.api.DialogV2({
            id: `gm-roll-confirm-${msg.requestId}`,
            classes: ["mist-engine", "dialog", "gm-roll-confirm-dialog"],
            window: {
                title: game.i18n.localize("MIST_ENGINE.GM_CONFIRM.Title"),
                icon: "fa-solid fa-dice"
            },
            position: { width: 420 },
            content,
            buttons: [
                {
                    action: "approve",
                    label: game.i18n.localize("MIST_ENGINE.GM_CONFIRM.Approve"),
                    icon: "fa-solid fa-check",
                    default: true
                },
                {
                    action: "reject",
                    label: game.i18n.localize("MIST_ENGINE.GM_CONFIRM.Reject"),
                    icon: "fa-solid fa-xmark"
                }
            ],
            submit: (result) => {
                decided = true;
                RollConfirmation.#respond(msg, result === "approve");
            }
        });

        // Closing the dialog without a decision (X button) rejects the roll so
        // the player is not left waiting forever. A player cancel closes the
        // dialog too but must not send a (stale) response.
        dialog.addEventListener("close", () => {
            RollConfirmation.#openDialogs.delete(msg.requestId);
            if (!decided && !dialog._mistCanceledByPlayer) RollConfirmation.#respond(msg, false);
        });

        RollConfirmation.#openDialogs.set(msg.requestId, dialog);
        dialog.render({ force: true });
    }
}
