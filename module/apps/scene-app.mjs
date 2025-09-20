const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class MistSceneApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);

        this.currentSceneDataItem = null;
        this.currentSceneId = game.scenes.active ? game.scenes.active.id : null;
        this.currentSceneName = game.scenes.active ? game.scenes.active.name : null;
        this.findOrCreateSceneDataItem();

        this.activateSocketListeners();

        MistSceneApp.instance = this;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'scene-data-app',
        classes: ['mist-engine', 'dialog', 'scene-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'Szene Tags',
            icon: 'fa-solid fa-book-atlas',
            positioned: true,
            resizable: true
        },
        position: {
            left: 100,
            width: 300,
            height: 600
        },
        actions: {
            createFloatingTagOrStatus: this.#handleCreateFloatingTagOrStatus,
            deleteFloatingTagOrStatus: this.#handleDeleteFloatingTagOrStatus
        },
    };

    /** @override */
    static PARTS = {
        /*debug: {
            template: 'systems/mist-engine-fvtt/templates/scene-app/debug.hbs',
            scrollable: ['scrollable']
        },*/
        tags: {
            template: 'systems/mist-engine-fvtt/templates/scene-app/tags.hbs',
            scrollable: ['scrollable']
        }
    };

    static getInstance(options = {}) {
        if (!MistSceneApp.instance) {
            MistSceneApp.instance = new MistSceneApp(options);
        }
        return MistSceneApp.instance;
    }

    /** @inheritDoc */
    _onRender(context, options) {
        // floating tags and statuses
        const updateableFtsStats = this.element.querySelectorAll('.updateable-fts-stat')
        for (const input of updateableFtsStats) {
            input.addEventListener("change", event => this.handleFtStatChanged(event))
        }

        const updateableFtsStatMinus = this.element.querySelectorAll('.updateable-fts-stat-minus')
        for (const input of updateableFtsStatMinus) {
            input.addEventListener("click", event => this.handleFtStatMinus(event))
        }

        const updateableFtsStatPlus = this.element.querySelectorAll('.updateable-fts-stat-plus')
        for (const input of updateableFtsStatPlus) {
            input.addEventListener("click", event => this.handleFtStatPlus(event))
        }

        const ftsEditableCheckbox = this.element.querySelector('#fts-editable-checkbox');
        if (ftsEditableCheckbox) {
            ftsEditableCheckbox.addEventListener("change", event => this.handleFtsEditableCheckboxChanged(event));
        }
    }

    activateSocketListeners() {
        game.socket.on("system.mist-engine-fvtt", (msg) => {
            if (msg?.type === "hook" && msg.hook == "sceneAppUpdated") {
                MistSceneApp.getInstance().render(true, { focus: true });
            }
        });
    }

    sendUpdateHookEvent(){
        this.render(true, { focus: true });
        if(game.user.isGM){
            game.socket.emit("system.mist-engine-fvtt", {
            type: "hook",
            hook: "sceneAppUpdated",
            data: { }
            });
        }
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.currentSceneDataItem = this.currentSceneDataItem
        context.currentSceneId = this.currentSceneId;
        context.currentSceneName = this.currentSceneName;
        context.isGM = game.user.isGM;
        context.isNotGM = !game.user.isGM;
        return context;
    }

    async handleFtsEditableCheckboxChanged(event) {
        event.preventDefault();
        const checked = event.currentTarget.checked;
        await this.currentSceneDataItem.update({ "system.floatingTagsAndStatusesEditable": checked });
        this.sendUpdateHookEvent();
    }

    async handleFtStatChanged(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const key = event.currentTarget.dataset.key;
        const value = event.currentTarget.value;
        const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses || index >= floatingTagsAndStatuses.length) return;

        foundry.utils.setProperty(floatingTagsAndStatuses[index], key, value);
        await this.currentSceneDataItem.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
        this.sendUpdateHookEvent();
    }

    static async #handleDeleteFloatingTagOrStatus(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses || index >= floatingTagsAndStatuses.length) return;
        floatingTagsAndStatuses.splice(index, 1);
        await this.currentSceneDataItem.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
        this.sendUpdateHookEvent();
    }

    async handleFtStatMinus(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses || index >= floatingTagsAndStatuses.length) return;
        const currentValue = floatingTagsAndStatuses[index].value || 0;
        if (currentValue > 1) {
            foundry.utils.setProperty(floatingTagsAndStatuses[index], 'value', currentValue - 1);
            await this.currentSceneDataItem.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
        } else {
            floatingTagsAndStatuses.splice(index, 1);
            await this.currentSceneDataItem.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
        }
        this.sendUpdateHookEvent();
    }

    async handleFtStatPlus(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses || index >= floatingTagsAndStatuses.length) return;
        const currentValue = floatingTagsAndStatuses[index].value || 0;
        foundry.utils.setProperty(floatingTagsAndStatuses[index], 'value', currentValue + 1);
        await this.currentSceneDataItem.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });
        this.sendUpdateHookEvent();
    }

    static async #handleCreateFloatingTagOrStatus(event, target) {
        event.preventDefault();
        const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses;

        if (floatingTagsAndStatuses) {
            await this.currentSceneDataItem.update({
                "system.floatingTagsAndStatuses": [
                    ...floatingTagsAndStatuses,
                    { name: "New Floating Tag", description: "" }
                ]
            });
        } else {
            await this.currentSceneDataItem.update({
                "system.floatingTagsAndStatuses": [
                    { name: "New Floating Tag", description: "" }
                ]
            });
        }

        this.sendUpdateHookEvent();
    }

    findOrCreateSceneDataItem() {
        this.currentSceneDataItem = null;

        game.items.forEach(item => {
            if (item.type === "scene-data") {
                if (item.system.sceneKey === this.currentSceneId) {
                    this.currentSceneDataItem = item;
                    return;
                }
            }
        });

        if (this.currentSceneId && !this.currentSceneDataItem) {
            // ToDo: is this the correct way? maybe move them to a compendium?
            Item.create({
                name: `Scene Data: ${this.currentSceneName}`,
                type: "scene-data",
                flags: { mistmod: { hidden: true } },
                data: {
                }
            }).then(item => {
                item.update({ "system.sceneKey": this.currentSceneId })
                this.currentSceneDataItem = item;
                this.sendUpdateHookEvent();
            });
        }
    }

    sceneChangedHook(newScene){
        if(!newScene) return;

        if(this.currentSceneId === newScene.id){
            return;
        }

        this.currentSceneId = newScene.id;
        this.currentSceneName = newScene.name;
        this.findOrCreateSceneDataItem();
        this.sendUpdateHookEvent();
    }
}