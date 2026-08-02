import { ThemekitSourceSettingsApp } from "../apps/themekit-source-settings-app.mjs";
import { MistSceneTagsOverlay } from "../apps/scene-tags-overlay.mjs";

export function setupConfiguration() {

    game.settings.register("mist-engine-fvtt", "systemVersion", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });


    // game.settings.get("mist-engine-fvtt", "mightUsageEnabled");
    game.settings.register("mist-engine-fvtt", "mightUsageEnabled", {
        name: "Might Usage Enabled",
        hint: "Enable or disable the usage of Might in the game.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("mist-engine-fvtt", "disableCustomDice", {
        name: "Disable LiTM Custom Dice",
        hint: "Disable the use of custom dice in Legend In The Mist. This will revert to using standard dice rolls.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("mist-engine-fvtt", "disableCharacterHoverTooltip", {
        name: "Disable Character Hover Tooltip (GM Only)",
        hint: "Disable the character hover power tag tooltip for GMs",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("mist-engine-fvtt", "showCustomJSONImport", {
        name: "Show Custom JSON Import",
        hint: "Enable the custom JSON import feature for challenges and vignettes. This allows you to import content from external sources using a specific JSON format.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    // game.settings.get("mist-engine-fvtt", "gmRollConfirmation");
    game.settings.register("mist-engine-fvtt", "gmRollConfirmation", {
        name: "GM Roll Confirmation",
        hint: "Player rolls from the roll dialog must be confirmed by the GM before the dice are rolled. The GM sees the player's selection and can approve or reject it.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    // Read-only Tags & Statuses bar docked at the top of the screen
    // (apps/scene-tags-overlay.mjs). Per user, so nobody gets screen space
    // taken away against their will.
    game.settings.register("mist-engine-fvtt", "showSceneTagsOverlay", {
        name: "MIST_ENGINE.SETTINGS.ShowSceneTagsOverlay",
        hint: "MIST_ENGINE.SETTINGS.ShowSceneTagsOverlayHint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => MistSceneTagsOverlay.refresh()
    });

    game.settings.register("mist-engine-fvtt", "sceneTagsOverlayPosition", {
        name: "MIST_ENGINE.SETTINGS.SceneTagsOverlayPosition",
        hint: "MIST_ENGINE.SETTINGS.SceneTagsOverlayPositionHint",
        scope: "client",
        config: true,
        type: String,
        choices: {
            below: "MIST_ENGINE.SETTINGS.SceneTagsOverlayPosBelow",
            above: "MIST_ENGINE.SETTINGS.SceneTagsOverlayPosAbove",
            hotbar: "MIST_ENGINE.SETTINGS.SceneTagsOverlayPosHotbar"
        },
        default: "below",
        // A re-render re-docks the element into the chosen slot.
        onChange: () => { if (ui.litmSceneTags?.rendered) ui.litmSceneTags.render(); }
    });

    // Story themes are GM-only everywhere else (the Scene App drops the whole
    // tab for players), so surfacing their tags to the table is the Narrator's
    // call — hence world scope and a default that keeps today's boundary.
    game.settings.register("mist-engine-fvtt", "sceneTagsOverlayStoryTags", {
        name: "MIST_ENGINE.SETTINGS.SceneTagsOverlayStoryTags",
        hint: "MIST_ENGINE.SETTINGS.SceneTagsOverlayStoryTagsHint",
        scope: "world",
        config: true,
        type: String,
        choices: {
            off: "MIST_ENGINE.SETTINGS.SceneTagsOverlayStoryOff",
            gm: "MIST_ENGINE.SETTINGS.SceneTagsOverlayStoryGM",
            all: "MIST_ENGINE.SETTINGS.SceneTagsOverlayStoryAll"
        },
        default: "gm",
        onChange: () => { if (ui.litmSceneTags?.rendered) ui.litmSceneTags.render(); }
    });

    game.settings.register("mist-engine-fvtt", "tidyTagsOnCharacterSheet", {
        name: "Tidy Tags on Character Sheet",
        hint: "Hide planned tags and eliminate blank lines in a character's themes",
        scope: "user",
        config: true,
        type: Boolean,
        default: false
    });

    // Issue #101: allowlist of compendium pack collection ids that may
    // supply themekits in ThemekitSelectionApp#getAllThemekits(). Hidden
    // (config: false) since it's edited through the registerMenu below;
    // an empty array means "no restriction" (every visible Item pack is
    // allowed), which is also the default and preserves prior behavior.
    game.settings.register("mist-engine-fvtt", "themekitSourcePacks", {
        scope: "world",
        config: false,
        type: Array,
        default: []
    });

    // Companion toggle to themekitSourcePacks: whether themekits from
    // in-world items (game.items) are offered in ThemekitSelectionApp.
    // Hidden (config: false) — edited through the same menu below.
    // Default true preserves prior behavior (world items always included).
    game.settings.register("mist-engine-fvtt", "themekitIncludeWorldItems", {
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });

    game.settings.registerMenu("mist-engine-fvtt", "themekitSourcePacksMenu", {
        name: "MIST_ENGINE.SETTINGS.ThemekitSourcePacks.MenuName",
        label: "MIST_ENGINE.SETTINGS.ThemekitSourcePacks.MenuLabel",
        hint: "MIST_ENGINE.SETTINGS.ThemekitSourcePacks.MenuHint",
        icon: "fa-solid fa-book-atlas",
        type: ThemekitSourceSettingsApp,
        restricted: true
    });

}