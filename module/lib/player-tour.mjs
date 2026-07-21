/**
 * Player-facing guided tour for the Mist Engine system (Foundry Tour framework).
 *
 * The counterpart to the GM tour (`gm-tour.mjs`): registered under `game.tours`
 * so it shows in Tour Management, and auto-started once for a player who has not
 * seen it yet. `canStart` gates it to non-GM users who actually own a character;
 * `_preStep` opens that character's sheet (in the requested edit/game mode) so
 * the highlighted selectors resolve.
 *
 * Unlike the GM tour it never imports a demo actor — players lack the permission
 * to create actors, so it always walks the player's own assigned/owned hero.
 * Intentionally has NO imports on other app modules so it always loads
 * regardless of which optional features a build ships.
 */
const SEEN_SETTING = "playerTutorialSeen";
const t = (k) => `MIST_ENGINE.PLAYER_TUTORIAL.${k}`;
const toolSelector = (name) => `#scene-controls-tools button.tool[data-tool="${name}"]`;

/**
 * Steps. `within` = a selector inside the player's character sheet (resolved to
 * `#<sheetId> <within>` in _preStep). `charMode` opens the sheet in the given
 * edit/game mode before the step. Steps without `charMode` target standalone UI.
 */
const STEPS = [
    { id: "welcome", within: ".sheet-header", title: t("WelcomeTitle"), content: t("WelcomeContent"), charMode: "game" },
    { id: "editToggle", within: ".mode-toggle-button", title: t("EditToggleTitle"), content: t("EditToggleContent"), charMode: "game" },
    { id: "editMode", within: ".themebooks-container", title: t("EditModeTitle"), content: t("EditModeContent"), charMode: "edit" },
    { id: "themes", within: ".themebooks-container", title: t("ThemesTitle"), content: t("ThemesContent"), charMode: "game" },
    { id: "rolling", within: ".roll-button", title: t("RollingTitle"), content: t("RollingContent"), charMode: "game" },
    // NOTE: no `selector` on purpose — this renders as a centre-screen step.
    // Anchoring the tour tooltip to the floating #dice-roll-app window makes
    // Foundry's TooltipManager auto-dismiss it (its pointerleave handler lacks
    // the tour guard), so the explanation vanished after ~1s. The dialog is
    // still opened via `openRollDialog` so the player sees it on screen.
    { id: "diceDialog", title: t("DiceDialogTitle"), content: t("DiceDialogContent"), openRollDialog: true },
    { id: "sacrifice", within: '[data-action="clickSacrificeRoll"]', title: t("SacrificeTitle"), content: t("SacrificeContent"), charMode: "game" },
    { id: "statuses", within: ".col-status", title: t("StatusesTitle"), content: t("StatusesContent"), charMode: "game" },
    { id: "backpack", within: ".litm-backpack", title: t("BackpackTitle"), content: t("BackpackContent"), charMode: "game" },
    { id: "quintessences", within: ".litm-quintessence", title: t("QuintessencesTitle"), content: t("QuintessencesContent"), charMode: "game" },
    { id: "fellowship", within: ".litm-fellowship-relationship", title: t("FellowshipTitle"), content: t("FellowshipContent"), charMode: "game" },
    { id: "otherTab", within: '.litm-character-sheet-tabs [data-tab="other"]', title: t("OtherTabTitle"), content: t("OtherTabContent"), charMode: "game" },
    { id: "bioNotes", within: '.litm-character-sheet-tabs [data-tab="biography"]', title: t("BioNotesTitle"), content: t("BioNotesContent"), charMode: "game" },
    { id: "howToPlay", selector: toolSelector("how_to_play_app"), title: t("HowToPlayTitle"), content: t("HowToPlayContent"), activateControl: "mist-engine" },
];

export function registerPlayerTour() {
    const TourBase = foundry.nue?.Tour;
    if (!TourBase) return;

    class MistPlayerTour extends TourBase {
        #demoActor = null;      // the player's own character used for the walkthrough
        #origEditMode = null;   // restore the sheet's edit mode afterwards

        /** The player's own hero: their assigned character, else any owned one. */
        static #ownCharacter() {
            return game.user.character
                ?? game.actors.find(a => a.type === "litm-character" && a.isOwner)
                ?? null;
        }

        /** Players only, and only when they actually own a character to show. */
        get canStart() {
            return !game.user.isGM && !!MistPlayerTour.#ownCharacter();
        }

        /** Ensure the player's character sheet is open in the requested mode. */
        async #ensureDemoActor(mode) {
            if (!this.#demoActor) {
                const actor = MistPlayerTour.#ownCharacter();
                if (!actor) return null;
                this.#demoActor = actor;
                this.#origEditMode = actor.system.editMode;
            }
            const wantEdit = mode === "edit";
            if (this.#demoActor.system.editMode !== wantEdit) {
                await this.#demoActor.update({ "system.editMode": wantEdit });
            }
            if (!this.#demoActor.sheet.rendered) this.#demoActor.sheet.render(true);
            await new Promise(r => setTimeout(r, 600)); // allow (re)render
            return this.#demoActor;
        }

        /** Close the standalone dice-roll dialog if it is currently open. */
        #closeRollDialog() {
            try { foundry.applications.instances.get("dice-roll-app")?.close(); } catch (e) { /* not open */ }
        }

        /** Open/activate the UI a step targets so its selector resolves. */
        async _preStep() {
            await super._preStep();
            const step = this.currentStep;
            if (!step) return;

            // The dice dialog only makes sense on its own step — dismiss it again
            // as soon as the tour moves on so it never covers a sheet step.
            if (!step.openRollDialog) this.#closeRollDialog();

            if (step.activateControl) {
                try { ui.controls?.activate({ control: step.activateControl }); } catch (e) { /* no canvas */ }
                await new Promise(r => setTimeout(r, 250));
            }

            // Open the real Quick-roll dialog by clicking the sheet's own button
            // (no app-module import needed — keeps this file dependency-free).
            // This step is a centre-screen step (no selector): the tooltip is NOT
            // anchored to the floating dialog, which would otherwise be auto-
            // dismissed by the TooltipManager's pointerleave handler (~1s).
            if (step.openRollDialog) {
                const actor = await this.#ensureDemoActor("game");
                const btn = actor?.sheet?.element?.querySelector('.roll-button[data-roll-type="quick"]');
                btn?.click();
                await new Promise(r => setTimeout(r, 500)); // allow the dialog to render
            }

            if (step.charMode) {
                const actor = await this.#ensureDemoActor(step.charMode);
                const id = actor?.sheet?.element?.id;
                // resolve the within-sheet selector against the actual sheet element
                step.selector = id ? `#${CSS.escape(id)} ${step.within}` : step.within;
            }
        }

        /** Restore the sheet's original edit mode when the tour ends. */
        async #cleanup() {
            this.#closeRollDialog();
            if (!this.#demoActor) return;
            const actor = this.#demoActor;
            this.#demoActor = null;
            try {
                if (this.#origEditMode !== null && actor.system.editMode !== this.#origEditMode) {
                    await actor.update({ "system.editMode": this.#origEditMode });
                }
            } catch (e) { /* actor may already be gone */ }
        }

        async complete() {
            await this.#cleanup();
            return super.complete();
        }

        exit() {
            this.#cleanup();
            return super.exit();
        }
    }

    const config = {
        title: t("Title"),
        description: t("Description"),
        canBeResumed: true,
        display: true,
        steps: STEPS,
    };

    try {
        game.tours.register("mist-engine-fvtt", "player-tutorial", new MistPlayerTour(config));
    } catch (e) {
        // already registered (e.g. a re-run of the ready hook) — ignore
    }
}

/** Register the seen-flag setting (init) — client scope so each player tracks their own. */
export function registerPlayerTourSettings() {
    game.settings.register("mist-engine-fvtt", SEEN_SETTING, {
        scope: "client",
        config: false,
        type: Boolean,
        default: false,
    });
}

/** Auto-start once for a player who has not seen the tutorial yet (ready hook). */
export async function maybeAutoStartPlayerTour() {
    if (game.user.isGM) return;
    if (game.settings.get("mist-engine-fvtt", SEEN_SETTING)) return;
    const tour = game.tours.get("mist-engine-fvtt.player-tutorial");
    if (!tour || !tour.canStart) return;
    await game.settings.set("mist-engine-fvtt", SEEN_SETTING, true);
    setTimeout(() => { try { tour.start(); } catch (e) { console.warn("Mist player tour failed to start", e); } }, 2000);
}
