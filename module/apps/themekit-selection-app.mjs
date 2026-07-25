const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import { ThemeKitAdapter } from '../lib/themekit-adapter.mjs';

const FILTER_DATASET_KEYS = {
    powertags:            'searchPowertags',
    weaknesstags:         'searchWeaknesstags',
    specialimprovements:  'searchSpecialimprovements',
    quest:                'searchQuest',
    story:                'searchStory',
};

/**
 * Filters a flat list of themekit documents down to those belonging to the
 * launching themebook (issue #102).
 *
 * A kit "belongs to" a themebook by name: `system.themekit_type` holds the
 * name of the themebook the kit fills in (e.g. "Skill or Trade" — the
 * adapter uses it as the created themebook's name). Matching is trimmed and
 * case-insensitive. Note `system.themebook_type` is NOT the themebook — it
 * is the might level (litm-origin/adventure/greatness) and plays no part
 * here: two books of the same might are still different books.
 *
 * Kits with a blank/empty `system.themekit_type` are always kept — they
 * predate this field and are treated as legacy content that should stay
 * visible regardless of which themebook opened the app.
 *
 * When `themebookName` is blank/falsy (no launching themebook — nothing to
 * filter against) or `showAll` is true (user hit the "show all" escape
 * hatch), the list passes through unfiltered.
 *
 * Pure function, no Foundry API dependency, so it can be exercised by a
 * standalone Node script without stubbing the Foundry runtime.
 *
 * @param {Array<object>} themekits                Themekit documents (or plain objects with a `system.themekit_type`).
 * @param {string|null|undefined} themebookName    The launching themebook's name (e.g. "Skill or Trade"), or blank/falsy to disable filtering.
 * @param {boolean} [showAll=false]                Escape hatch — when true, disables filtering regardless of `themebookName`.
 * @returns {Array<object>}
 */
export function filterThemekitsForThemebook(themekits, themebookName, showAll = false) {
    const bookName = themebookName?.trim().toLowerCase();
    if (!bookName || showAll) return themekits;
    return themekits.filter(themekit => {
        const kitBookName = themekit?.system?.themekit_type?.trim().toLowerCase();
        return !kitBookName || kitBookName === bookName;
    });
}

export class ThemekitSelectionApp extends HandlebarsApplicationMixin(ApplicationV2) {
    currentSelectedThemekit = null;
    actor = null;
    actorThemebook = null;
    showAllThemekits = false;
    _searchQuery = '';
    _activeFilters = new Set();

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'themekit-selection-app',
        classes: ['mist-engine', 'dialog', 'themekit-selection-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'Themekit Selection',
            icon: 'fa-solid fa-book-atlas',
            positioned: true,
            resizable: true
        },
        position: {
            width: 900,
            height: 600
        },
        actions: {
            selectThemekit: this.#handleSelectThemekit,
            addThemekit: this.#handleAddThemekit,
            toggleShowAllThemekits: this.#handleToggleShowAllThemekits
        },
    };

    /** @override */
    static PARTS = {
        left: {
            template: 'systems/mist-engine-fvtt/templates/themekit-selection-app/left.hbs',
            scrollable: ['']
        },
        right: {
            template: 'systems/mist-engine-fvtt/templates/themekit-selection-app/right.hbs',
            scrollable: ['']
        }
    };

       async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.isGM = game.user.isGM;
        context.isNotGM = !game.user.isGM;
        context.availableThemekits = await this.getAllThemekits();
        context.currentSelectedThemekit = this.currentSelectedThemekit;
        context.currentSelectedThemekitAvailable = this.currentSelectedThemekit != null;
        context.hasAvailableThemekits = Object.keys(context.availableThemekits).length > 0;

        if(this.actorThemebook){
            context.addThemekitButtonStr = game.i18n.localize("MIST_ENGINE.THEMEKITS.AssignThemekit");
        }else{
            context.addThemekitButtonStr = game.i18n.localize("MIST_ENGINE.THEMEKITS.AddThemekit");
        }

        // Issue #102: when opened from a themebook card, offer to filter the
        // list down to kits belonging to that themebook (matched by name),
        // with a toggle to escape it.
        const themebookName = this.actorThemebook?.name?.trim() || null;
        context.hasThemebookFilter = Boolean(themebookName);
        context.isFilteredByThemebook = context.hasThemebookFilter && !this.showAllThemekits;
        context.showAllThemekits = this.showAllThemekits;
        context.themebookFilterLabel = themebookName;

        // we set this flag if the currentSelectedThemekit has any special improvements without an empty name
        context.hasSpecialImprovements = context.currentSelectedThemekitAvailable && context.currentSelectedThemekit.system.specialImprovements && context.currentSelectedThemekit.system.specialImprovements.some(si => si.name && si.name.trim() !== "");

        return context;
    }

    async getAllThemekits(){
        // Welt: only themekits the current user is allowed to see, and only
        // if the GM hasn't disabled world items as a themekit source. The
        // `!== false` guard keeps world items included if the stored value
        // is ever malformed (preserves pre-toggle behavior).
        const includeWorldItems = game.settings.get("mist-engine-fvtt", "themekitIncludeWorldItems") !== false;
        const worldThemeKits = includeWorldItems
            ? game.items.filter(i => i.type === "themekit" && i.visible)
            : [];

        // Kompendien: skip packs hidden from the current user
        const compendiumThemeKits = [];

        // Issue #101: GM-configured allowlist of pack collection ids. An
        // empty/unset array means no restriction (preserves prior behavior,
        // scanning every visible Item pack); a non-empty array restricts
        // scanning to just those packs. World items are governed by the
        // separate themekitIncludeWorldItems toggle above, not this list.
        const allowedSourcePacks = game.settings.get("mist-engine-fvtt", "themekitSourcePacks");
        const hasSourceAllowlist = Array.isArray(allowedSourcePacks) && allowedSourcePacks.length > 0;

        for (const pack of game.packs) {
            if (pack.documentName !== "Item") continue;
            if (!pack.visible) continue;
            if (hasSourceAllowlist && !allowedSourcePacks.includes(pack.collection)) continue;

            const docs = await pack.getDocuments();
            compendiumThemeKits.push(
                ...docs.filter(i => i.type === "themekit" && i.visible)
            );
        }

        // Gesamt
        const allThemeKits = [
        ...worldThemeKits,
        ...compendiumThemeKits
        ];

        // Issue #102: filter to kits belonging to the launching themebook
        // (blank themekit_type kits and the "show all" toggle both bypass this).
        const filteredThemeKits = filterThemekitsForThemebook(allThemeKits, this.actorThemebook?.name, this.showAllThemekits);

        // now we group them by property 'themekit_type', if themekit_type in uppercase is not set, we put it in a group called 'OTHER'
        // each group hash is {groupName: string, themekits: array of themekits}
        const themekitsByType = {};
        for(let themekit of filteredThemeKits){
            const type = (themekit.system.themekit_type || "OTHER").toUpperCase(); 
            if(!themekitsByType[type]){
                themekitsByType[type] = { groupName: type, themekits: [] };
            }
            themekitsByType[type].themekits.push({ themekit, isCompendium: themekit.pack != null });
        }

        // sort themekits by name
        for(let themekitType in themekitsByType){
            themekitsByType[themekitType].themekits.sort((a, b) => a.themekit.name.localeCompare(b.themekit.name));
        }
        return themekitsByType;
    }

    _onRender(context, options) {
        const search = this.element.querySelector('.themekit-search');
        if (!search) return;

        // Restore state after re-render triggered by themekit selection
        search.value = this._searchQuery;
        this.element.querySelectorAll('.search-filter-toggle input[type="checkbox"]').forEach(cb => {
            cb.checked = this._activeFilters.has(cb.dataset.filter);
        });

        const applyFilter = () => {
            this._searchQuery = search.value;
            const query = search.value.trim().toLowerCase();
            this.element.querySelectorAll('.themekit-group').forEach(group => {
                let anyVisible = false;
                group.querySelectorAll('li').forEach(li => {
                    const name = (li.querySelector('.themekit-button')?.textContent ?? '').toLowerCase();
                    let matches = !query || name.includes(query);

                    if (!matches && query) {
                        for (const filter of this._activeFilters) {
                            const val = (li.dataset[FILTER_DATASET_KEYS[filter]] ?? '').toLowerCase();
                            if (val.includes(query)) { matches = true; break; }
                        }
                    }

                    li.style.display = matches ? '' : 'none';
                    if (matches) anyVisible = true;
                });
                group.style.display = anyVisible ? '' : 'none';
            });
        };

        search.addEventListener('input', applyFilter);

        this.element.querySelectorAll('.search-filter-toggle input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) this._activeFilters.add(cb.dataset.filter);
                else this._activeFilters.delete(cb.dataset.filter);
                applyFilter();
            });
        });

        applyFilter();
    }

    static async #handleSelectThemekit(event, target){
        event.preventDefault();
        const themekitUuid = target.dataset.themekitUuid;
        const themekitSource = target.dataset.themekitSource;
        let themekit = await fromUuid(themekitUuid);
        this.currentSelectedThemekit = themekit;
        this.render();
    }

    setActor(actor){
        this.actor = actor;
    }

    setThemebook(themebook){
        this.actorThemebook = themebook;
    }

    static async #handleToggleShowAllThemekits(event, target){
        event.preventDefault();
        this.showAllThemekits = !this.showAllThemekits;
        this.render();
    }

    static async #handleAddThemekit(event, target){
        event.preventDefault();
        if(!this.currentSelectedThemekit){
            ui.notifications.warn("No themekit selected!");
            return;
        }
        if(!this.actor){
            ui.notifications.warn("No actor set for themekit selection app!");
            return;
        }

        if(this.actorThemebook){
            // we only set the UUID of the themebook with the currentSelectedThemekit in the beginning
            await this.actorThemebook.update({ "system.themeKitUUID": this.currentSelectedThemekit.uuid });
            ui.notifications.notify( game.i18n.format("MIST_ENGINE.NOTIFICATIONS.AssignedThemekit", { themekitName: this.currentSelectedThemekit.name, characterName: this.actor.name }));
            // if the themebook is empty, we populate it with the themekit data
            if((!this.actorThemebook.system.powertags || this.actorThemebook.system.powertags.length === 0) && (!this.actorThemebook.system.weaknesstags || this.actorThemebook.system.weaknesstags.length === 0)){
                const adapter = new ThemeKitAdapter();
                await adapter.populateThemekitForThemebook(this.actor, this.actorThemebook, this.currentSelectedThemekit);        
            }
            else{
                const adapter = new ThemeKitAdapter();
                await adapter.mergeThemekitForThemebook(this.actor, this.actorThemebook, this.currentSelectedThemekit);        
            }
            

            this.close();
            return;    
        }
        const adapter = new ThemeKitAdapter();
        await adapter.importThemekitToCharacter(this.actor, this.currentSelectedThemekit);
    }
}