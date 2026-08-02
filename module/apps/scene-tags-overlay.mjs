import { MistSceneApp } from "./scene-app.mjs";
import { FloatingTagAndStatusAdapter } from "../lib/floating-tag-and-status-adapter.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Read-only Tags & Statuses bar docked at the top edge of the screen.
 *
 * Mirrors the scene's floating tags/statuses (the Scene App's "Tags" tab) and —
 * when the world setting allows it — the power/weakness tags of the scene's
 * story themes. Nothing here is interactive: the bar carries no `data-action`
 * and inherits `pointer-events: none` from `#ui-middle`, so clicks fall through
 * to the canvas. Editing stays in the Scene App.
 *
 * Registered as `CONFIG.ui.litmSceneTags`, so Foundry constructs it as the
 * singleton `ui.litmSceneTags` during `Game#initializeUI`.
 *
 * Live refresh piggybacks on the central `refreshSceneTrackers()` in
 * lib/hooks.mjs — the same `updateItem` hook that already keeps the Scene App
 * in sync covers both data sources here (`scene-data` for the scene tags,
 * `themebook` for the story themes).
 */
export class MistSceneTagsOverlay extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "litm-scene-tags-overlay",
        // `mist-engine` is what the SCSS is scoped to; without it none of the
        // tag colours apply.
        classes: ["mist-engine"],
        tag: "aside",
        window: {
            frame: false,
            positioned: false
        }
    };

    static PARTS = {
        overlay: {
            root: true,
            template: "systems/mist-engine-fvtt/templates/overlay/scene-tags-overlay.hbs"
        }
    };

    /** Is the bar switched on for THIS user? */
    static get enabled() {
        return game.settings.get("mist-engine-fvtt", "showSceneTagsOverlay") === true;
    }

    /**
     * Locate the scene-data item of the scene the user is looking at.
     *
     * Deliberately a pure lookup: unlike `MistSceneApp#findOrCreateSceneDataItem`
     * this never creates the item, because a display-only overlay must not write
     * documents — and must not depend on the Scene App ever having been opened.
     *
     * Prefers the Scene App's tracked scene when it exists (that is the *viewed*
     * scene, not necessarily `game.scenes.active` — see issue #93), and falls
     * back to `game.scenes.current`, which resolves the same way.
     * @returns {Item|null}
     */
    static resolveSceneDataItem() {
        const sceneId = MistSceneApp.instance?.currentSceneId ?? game.scenes?.current?.id ?? null;
        if (!sceneId) return null;
        return game.items.find(i => i.type === "scene-data" && i.system.sceneKey === sceneId) ?? null;
    }

    /**
     * Should story-theme tags appear for this user? The world setting is a
     * three-way choice because story themes are GM-only everywhere else in the
     * system (the Scene App drops the whole tab for players), so switching them
     * on for everyone is a deliberate call by the Narrator.
     * @returns {boolean}
     */
    static get showStoryTags() {
        const mode = game.settings.get("mist-engine-fvtt", "sceneTagsOverlayStoryTags");
        if (mode === "all") return true;
        if (mode === "gm") return game.user.isGM;
        return false;
    }

    /** @override */
    async _prepareContext() {
        const sd = MistSceneTagsOverlay.resolveSceneDataItem();

        // Same display-only sort as the Scene App: tags before statuses (#28).
        // No `originalIndex` is needed — nothing here mutates the array.
        const sceneTags = FloatingTagAndStatusAdapter.sortedFloatingView(
            sd?.system.floatingTagsAndStatuses ?? []
        ).map(entry => ({
            name: entry.name,
            isStatus: FloatingTagAndStatusAdapter.isStatusEntry(entry),
            value: entry.value ?? 0,
            positive: entry.positive !== false,
            might: entry.might ?? 0,
            mightIcon: entry.mightIcon ?? "",
            // Marked by the Narrator in the Scene App. Display-only here, but
            // worth showing: it tells the table which tags are in play.
            selected: entry.selected === true
        })).filter(t => t.name?.trim());

        const storyTags = MistSceneTagsOverlay.showStoryTags ? await this.#storyTags(sd) : [];

        return {
            sceneTags,
            storyTags,
            hasSceneTags: sceneTags.length > 0,
            hasStoryTags: storyTags.length > 0,
            isEmpty: sceneTags.length === 0 && storyTags.length === 0
        };
    }

    /**
     * Power and weakness tags of the scene's story themes, flattened into one
     * list. Uses the same filter as the Scene App's Story Themes tab: named,
     * non-planned tags only.
     * @param {Item|null} sd  the scene-data item
     * @returns {Promise<Array<{name: string, weakness: boolean, theme: string}>>}
     */
    async #storyTags(sd) {
        const uuids = sd?.system?.storyThemeIds ?? [];
        const out = [];
        for (const uuid of uuids) {
            const theme = await fromUuid(uuid).catch(() => null);
            if (theme?.type !== "themebook") continue;
            const pick = (list, weakness) => (list ?? [])
                .filter(t => t.name?.trim() && !t.planned)
                .forEach(t => out.push({ name: t.name, weakness, theme: theme.name }));
            pick(theme.system.powertags, false);
            pick(theme.system.weaknesstags, true);
        }
        return out;
    }

    /**
     * @override
     * Dock the bar into the UI column the user picked. `#ui-top` stacks its
     * children from the top (`justify-content: flex-start`), so prepending puts
     * the bar at the very screen edge and appending puts it under the scene
     * navigation. `#ui-bottom` stacks from the bottom (`flex-end`), so the bar
     * goes in right before the macro hotbar.
     *
     * Every branch checks the current position first: `_onRender` runs on every
     * refresh, and re-inserting an already correctly placed element would make
     * it flicker.
     */
    async _onRender(context, options) {
        await super._onRender(context, options);

        this.element.classList.toggle("litm-sto-empty", context.isEmpty);

        const position = game.settings.get("mist-engine-fvtt", "sceneTagsOverlayPosition");
        this.element.classList.toggle("litm-sto-at-hotbar", position === "hotbar");

        if (position === "hotbar") {
            const bottom = document.getElementById("ui-bottom");
            if (!bottom) return;
            const hotbar = document.getElementById("hotbar");
            // Sit directly above the hotbar; if it is missing (a user may have
            // it hidden), fall back to the bottom of the column.
            if (hotbar?.parentElement === bottom) {
                if (this.element.nextElementSibling !== hotbar) bottom.insertBefore(this.element, hotbar);
            } else if (bottom.lastElementChild !== this.element) {
                bottom.append(this.element);
            }
            return;
        }

        const top = document.getElementById("ui-top");
        if (!top) return;
        if (position === "above") {
            if (top.firstElementChild !== this.element) top.prepend(this.element);
        } else if (top.lastElementChild !== this.element) {
            top.append(this.element);
        }
    }

    /**
     * Render or close the singleton according to the user's setting. Safe to
     * call before `ui.litmSceneTags` exists (very early hooks) and safe to call
     * repeatedly.
     */
    static refresh() {
        const app = ui.litmSceneTags;
        if (!app) return;
        if (MistSceneTagsOverlay.enabled) app.render({ force: true });
        else if (app.rendered) app.close({ animate: false });
    }
}
