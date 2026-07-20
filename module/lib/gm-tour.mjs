/**
 * GM-only guided tour for the Mist Engine system (Foundry Tour framework).
 *
 * Registered under `game.tours` so it appears in Tour Management, and
 * auto-started once for a GM who has not seen it yet. `canStart` gates it to
 * GMs; `_preStep` activates the scene-controls Notes tools and opens a demo
 * character sheet so the highlighted selectors resolve. Intentionally has NO
 * imports on other app modules so it always loads regardless of which optional
 * features a build ships — the demo actor is fetched via core APIs only.
 */
const SEEN_SETTING = "gmTutorialSeen";
const t = (k) => `MIST_ENGINE.TUTORIAL.${k}`;
const toolSelector = (name) => `#scene-controls-tools button.tool[data-tool="${name}"]`;

// Pregen used to demonstrate the character sheet (Core Book Finn).
const DEMO_PACK = "mist-engine-fvtt.pregen-characters";
const DEMO_ACTOR_ID = "TBY0ztdIZgWGTbZE";
const DEMO_ACTOR_NAME = "Finn The Red Marshal";

/**
 * Steps. `within` = a selector inside the demo character sheet (resolved to
 * `#<sheetId> <within>` in _preStep). `charMode` opens the sheet in the given
 * edit/game mode before the step.
 */
const STEPS = [
    { id: "welcome", selector: "#scene-controls", title: t("WelcomeTitle"), content: t("WelcomeContent"), activateNotes: true },
    { id: "tools", selector: "#scene-controls-tools", title: t("ToolsTitle"), content: t("ToolsContent"), activateNotes: true },
    { id: "sceneTracker", selector: toolSelector("scene_data_app"), title: t("SceneTrackerTitle"), content: t("SceneTrackerContent"), activateNotes: true },
    { id: "camping", selector: toolSelector("camping_app"), title: t("CampingTitle"), content: t("CampingContent"), activateNotes: true },
    { id: "groupAction", selector: toolSelector("group_action_app"), title: t("GroupActionTitle"), content: t("GroupActionContent"), activateNotes: true },

    // --- player character walkthrough (demo actor: Finn) ---
    { id: "charSheet", within: ".sheet-header", title: t("CharSheetTitle"), content: t("CharSheetContent"), charMode: "game" },
    { id: "editToggle", within: ".mode-toggle-button", title: t("EditToggleTitle"), content: t("EditToggleContent"), charMode: "game" },
    { id: "editMode", within: ".card-grid", title: t("EditModeTitle"), content: t("EditModeContent"), charMode: "edit" },
    { id: "gameMode", within: ".roll-button", title: t("GameModeTitle"), content: t("GameModeContent"), charMode: "game" },

    { id: "challenges", selector: "#sidebar", title: t("ChallengesTitle"), content: t("ChallengesContent") },
    { id: "rollConfirm", selector: "#sidebar", title: t("RollConfirmTitle"), content: t("RollConfirmContent") },
    { id: "howToPlay", selector: toolSelector("how_to_play_app"), title: t("HowToPlayTitle"), content: t("HowToPlayContent"), activateNotes: true },
];

export function registerGmTour() {
    const TourBase = foundry.nue?.Tour;
    if (!TourBase) return;

    class MistGmTour extends TourBase {
        #demoActor = null;      // the character sheet used for the walkthrough
        #imported = false;      // did we import it (→ delete on cleanup)?
        #origEditMode = null;   // restore the actor's edit mode afterwards

        /** GM-only tutorial. */
        get canStart() {
            return game.user.isGM;
        }

        /** Ensure a demo character sheet is open in the requested mode. */
        async #ensureDemoActor(mode) {
            if (!this.#demoActor) {
                // prefer an existing world character, else import Finn from the compendium
                let actor = game.actors.getName(DEMO_ACTOR_NAME)
                    ?? game.actors.find(a => a.type === "litm-character" && a.isOwner);
                if (!actor) {
                    const pack = game.packs.get(DEMO_PACK);
                    const src = pack ? await pack.getDocument(DEMO_ACTOR_ID).catch(() => null) : null;
                    if (src) { actor = await Actor.create(src.toObject()); this.#imported = true; }
                }
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

        /** Open/activate the UI a step targets so its selector resolves. */
        async _preStep() {
            await super._preStep();
            const step = this.currentStep;
            if (!step) return;

            if (step.activateNotes) {
                try { ui.controls?.activate({ control: "notes" }); } catch (e) { /* no canvas */ }
                await new Promise(r => setTimeout(r, 250));
            }

            if (step.charMode) {
                const actor = await this.#ensureDemoActor(step.charMode);
                const id = actor?.sheet?.element?.id;
                // resolve the within-sheet selector against the actual sheet element
                step.selector = id ? `#${CSS.escape(id)} ${step.within}` : step.within;
            }
        }

        /** Restore state and close/delete the demo actor when the tour ends. */
        async #cleanup() {
            if (!this.#demoActor) return;
            const actor = this.#demoActor;
            this.#demoActor = null;
            try {
                if (this.#imported) {
                    await actor.delete();
                } else {
                    if (this.#origEditMode !== null && actor.system.editMode !== this.#origEditMode) {
                        await actor.update({ "system.editMode": this.#origEditMode });
                    }
                    actor.sheet?.close();
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
        game.tours.register("mist-engine-fvtt", "gm-tutorial", new MistGmTour(config));
    } catch (e) {
        // already registered (e.g. a re-run of the ready hook) — ignore
    }
}

/** Register the seen-flag setting (init) — client scope so each GM tracks their own. */
export function registerGmTourSettings() {
    game.settings.register("mist-engine-fvtt", SEEN_SETTING, {
        scope: "client",
        config: false,
        type: Boolean,
        default: false,
    });
}

/** Auto-start once for a GM who has not seen the tutorial yet (ready hook). */
export async function maybeAutoStartGmTour() {
    if (!game.user.isGM) return;
    if (game.settings.get("mist-engine-fvtt", SEEN_SETTING)) return;
    const tour = game.tours.get("mist-engine-fvtt.gm-tutorial");
    if (!tour) return;
    await game.settings.set("mist-engine-fvtt", SEEN_SETTING, true);
    setTimeout(() => { try { tour.start(); } catch (e) { console.warn("Mist GM tour failed to start", e); } }, 2000);
}
