const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const SYSTEM_ID = "mist-engine-fvtt";
const SETTING_KEY = "themekitSourcePacks";
const WORLD_ITEMS_SETTING_KEY = "themekitIncludeWorldItems";

/**
 * GM-only settings menu (issue #101) letting the GM restrict which visible
 * Item compendiums may supply themekits in the ThemekitSelectionApp.
 *
 * Persists an array of `pack.collection` ids to the world setting
 * `themekitSourcePacks`. An empty array means "no restriction" — every
 * visible Item compendium is allowed, which is also the default and
 * preserves pre-#101 behavior. Whether world items (not in any compendium)
 * are included is governed by the separate boolean setting
 * `themekitIncludeWorldItems`, edited here as the "This World" checkbox.
 */
export class ThemekitSourceSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'themekit-source-settings-app',
        classes: ['mist-engine', 'dialog', 'themekit-source-settings-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'MIST_ENGINE.SETTINGS.ThemekitSourcePacks.WindowTitle',
            icon: 'fa-solid fa-book-atlas',
            positioned: true,
            resizable: true
        },
        position: {
            width: 500,
            height: 'auto'
        },
        actions: {
            saveThemekitSources: this.#handleSave
        },
    };

    /** @override */
    static PARTS = {
        form: {
            template: 'systems/mist-engine-fvtt/templates/themekit-source-settings-app/form.hbs',
            scrollable: ['.themekit-source-list']
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const allowed = ThemekitSourceSettingsApp.#getAllowedCollections();

        // Empty allowlist means "all allowed" — every pack starts checked in
        // that case, matching the current (pre-setting) unfiltered behavior.
        const packs = game.packs
            .filter(pack => pack.documentName === "Item")
            .map(pack => ({
                collection: pack.collection,
                title: pack.title,
                source: pack.metadata.packageType === "world"
                    ? game.i18n.localize("MIST_ENGINE.SETTINGS.ThemekitSourcePacks.WorldSource")
                    : (pack.metadata.packageName ?? pack.metadata.packageType),
                allowed: allowed.length === 0 || allowed.includes(pack.collection)
            }))
            .sort((a, b) => a.title.localeCompare(b.title));

        const groups = new Map();
        for (const pack of packs) {
            if (!groups.has(pack.source)) groups.set(pack.source, { source: pack.source, packs: [] });
            groups.get(pack.source).packs.push(pack);
        }

        context.groups = Array.from(groups.values())
            .sort((a, b) => a.source.localeCompare(b.source));
        context.hasPacks = packs.length > 0;
        context.includeWorldItems = game.settings.get(SYSTEM_ID, WORLD_ITEMS_SETTING_KEY) !== false;
        return context;
    }

    static #getAllowedCollections() {
        const stored = game.settings.get(SYSTEM_ID, SETTING_KEY);
        return Array.isArray(stored) ? stored : [];
    }

    static async #handleSave(event, target) {
        event.preventDefault();
        // Pack checkboxes only — the world-items checkbox (data-world-items)
        // is a separate boolean setting and must not participate in the
        // "all checked → []" normalization below.
        const allCheckboxes = Array.from(
            this.element.querySelectorAll('.themekit-source-list input[type="checkbox"]:not([data-world-items])')
        );
        const checked = allCheckboxes.filter(cb => cb.checked).map(cb => cb.value);

        // Every currently-listed pack checked is functionally identical to
        // none checked (both mean "no restriction" today), but they are NOT
        // identical for the future: storing the full id list would freeze
        // the allowlist to today's packs and silently exclude any
        // compendium installed later, whereas [] keeps meaning "allow
        // everything, including packs that don't exist yet". So normalize
        // "all checked" down to [] rather than storing the literal list.
        const allChecked = allCheckboxes.length > 0 && checked.length === allCheckboxes.length;
        await game.settings.set(SYSTEM_ID, SETTING_KEY, allChecked ? [] : checked);

        const worldItemsCheckbox = this.element.querySelector('.themekit-source-list input[data-world-items]');
        await game.settings.set(SYSTEM_ID, WORLD_ITEMS_SETTING_KEY, worldItemsCheckbox?.checked ?? true);
        this.close();
    }
}
