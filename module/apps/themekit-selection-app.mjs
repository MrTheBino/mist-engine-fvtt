const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import { ThemeKitAdapter } from '../lib/themekit-adapter.mjs';

const FILTER_DATASET_KEYS = {
    powertags:            'searchPowertags',
    weaknesstags:         'searchWeaknesstags',
    specialimprovements:  'searchSpecialimprovements',
    quest:                'searchQuest',
    story:                'searchStory',
};

export class ThemekitSelectionApp extends HandlebarsApplicationMixin(ApplicationV2) {
    currentSelectedThemekit = null;
    actor = null;
    actorThemebook = null;
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
            addThemekit: this.#handleAddThemekit
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
        
        // we set this flag if the currentSelectedThemekit has any special improvements without an empty name
        context.hasSpecialImprovements = context.currentSelectedThemekitAvailable && context.currentSelectedThemekit.system.specialImprovements && context.currentSelectedThemekit.system.specialImprovements.some(si => si.name && si.name.trim() !== "");
        
        return context;
    }

    async getAllThemekits(){
       // Welt
        const worldThemeKits = game.items.filter(i => i.type === "themekit");

        // Kompendien
        const compendiumThemeKits = [];

        for (const pack of game.packs) {
            if (pack.documentName !== "Item") continue;

            const docs = await pack.getDocuments();
            compendiumThemeKits.push(
                ...docs.filter(i => i.type === "themekit")
            );
        }

        // Gesamt
        const allThemeKits = [
        ...worldThemeKits,
        ...compendiumThemeKits
        ];

        // now we group them by property 'themekit_type', if themekit_type in uppercase is not set, we put it in a group called 'OTHER'
        // each group hash is {groupName: string, themekits: array of themekits}
        const themekitsByType = {};
        for(let themekit of allThemeKits){
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