const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import {FloatingTagAndStatusAdapter} from "../lib/floating-tag-and-status-adapter.mjs";

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
            title: 'Scene Tags',
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
            deleteFloatingTagOrStatus: this.#handleDeleteFloatingTagOrStatus,
            actorToggleFloatingTagOrStatusMarking: this.#handleActorToggleFloatingTagOrStatusMarking,
            removeSceneAppRollMod: this.#handleRemoveSceneAppRollMod,
            clickToggleLock: this.#handleFtsEditableCheckboxChanged,
            toggleFloatingTagOrStatusMarking: this.#handleToggleFloatingTagOrStatusMarking,
            deleteFloatingTagOrStatus: this.#handleDeleteFloatingTagOrStatus,
            toggleDiceRollModifier: this.#handleToggleDiceRollModifier,
            // story floating tags and statuses
            toggleFloatingTagOrStatusSelected: this.#handleToggleFloatingTagOrStatusSelected,
            toggleFloatingTagOrStatusModifier: this.#handleToggleFloatingTagOrStatusModifier,
            toggleFloatingTagOrStatus: this.#handleToggleFloatingTagOrStatus,
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
            scrollable: ['']
        },
        "dice-roll-mods": {
            template: 'systems/mist-engine-fvtt/templates/scene-app/dice-roll-mods.hbs',
            scrollable: ['']
        },
        characters: {
            template: 'systems/mist-engine-fvtt/templates/scene-app/characters.hbs',
            scrollable: ['']
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
        // Story floating tags and statuses
        const updateableFtsStats = this.element.querySelectorAll('.updateable-fts-stat')
        for (const input of updateableFtsStats) {
            input.addEventListener("change", event => this.handleFtStatChanged(event))
        }

        this.element.addEventListener("drop", this._onDrop.bind(this));
    }

    /**
     * Callback actions which occur when a dragged element is dropped on a target.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    async _onDrop(event) {
      const { type, name, value } = TextEditor.getDragEventData(event);
      const isStatus = type === "status";
      const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses ?? [];

      // Handle different data types
      switch (type) {
        case "tag":
          await this.currentSceneDataItem.update({
              "system.floatingTagsAndStatuses": [...floatingTagsAndStatuses, { name }],
          });
          this.sendUpdateHookEvent();
          break;
        case "status":
          const markings = new Array(6).fill(false);
          markings[Math.max(0, Math.min(parseInt(value) - 1, 5))] = true;
          await this.currentSceneDataItem.update({
            "system.floatingTagsAndStatuses": [
              ...floatingTagsAndStatuses,
              { name, value, isStatus, markings }
            ],
          });
          this.sendUpdateHookEvent();
          break;
        default:
          console.warn("Unknown drop type", data);
          break;
      }

      return super._onDrop?.(event);
    }

    activateSocketListeners() {
        game.socket.on("system.mist-engine-fvtt", (msg) => {
            if (msg?.type === "hook" && msg.hook == "sceneAppUpdated") {
                MistSceneApp.getInstance().render(true, { focus: true });
            }
            else if (msg?.type === "hook" && msg.hook == "floatableTagOrStatusUpdate") {
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
        context.currentSceneDataItem = this.currentSceneDataItem;
        context.currentSceneId = this.currentSceneId;
        context.currentSceneName = this.currentSceneName;
        context.isGM = game.user.isGM;
        context.isNotGM = !game.user.isGM;
        context.hasDiceRollModifiers = this.currentSceneDataItem.system.diceRollTagsStatus.length > 0;

        if(game.user.isGM){
            foundry.utils.mergeObject(context, await this._prepareContextForCharacters());
        }
        
        return context;
    }

    async _prepareContextForCharacters(){
        let context= {}
        const scene = game.scenes.active;
        const tokens = scene.tokens.contents;
        const actors = tokens.map(t => t.actor).filter(a => a);
        const uniqueActors = [...new Set(actors)];

        uniqueActors.forEach(actor => {
            if(actor.type == "litm-character"){
                if(!context.characters) context.characters = [];
                context.characters.push({
                    id: actor.id,
                    name: actor.name,
                    img: actor.img,
                    floatingTagsAndStatuses: actor.system.floatingTagsAndStatuses || []
                });
            }
        });
        return context;
    }

    static async #handleToggleDiceRollModifier(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        let data = this.currentSceneDataItem.system.diceRollTagsStatus;
        if (!data || index >= data.length) return;
        data[index].positive = !data[index].positive;
        await this.currentSceneDataItem.update({ "system.diceRollTagsStatus": data });
        
        this.sendUpdateHookEvent();
    }

    static async #handleRemoveSceneAppRollMod(event, target) {
        event.preventDefault();
        const index = target.dataset.index;
        let data = this.currentSceneDataItem.system.diceRollTagsStatus;
        if (!data || index >= data.length) return;
        data.splice(index, 1);
        await this.currentSceneDataItem.update({ "system.diceRollTagsStatus": data });
        
        this.sendUpdateHookEvent();
    }

    async handleActorFtTagStatusToggle(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const actor = game.actors.get(event.currentTarget.dataset.actorId);
        await FloatingTagAndStatusAdapter.handleTagStatusToggle(actor, index);
        this.sendFloatableTagOrStatusUpdateForActor(actor);
    }

    // ToDo: this floating and status functions can be encapsulated in a separate class / helper file or whatever to use them in other places as well
    // no need to replicate all the code, but right now it's fine 
    static async #handleActorToggleFloatingTagOrStatusMarking(event, target) {
        event.preventDefault();
        const index = parseInt(target.dataset.index);
        const actor = game.actors.get(target.dataset.actorId);
        const markingIndex = parseInt(target.dataset.markingIndex);
        await FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking(actor, index, markingIndex);
        this.sendFloatableTagOrStatusUpdateForActor(actor);
    }
    
    static async #handleFtsEditableCheckboxChanged(event,target) {
        event.preventDefault();
        if(game.user.isGM === false) return;
        if(!this.currentSceneDataItem) return;

        await this.currentSceneDataItem.update({ "system.floatingTagsAndStatusesEditable": !this.currentSceneDataItem.system.floatingTagsAndStatusesEditable  });
        this.sendUpdateHookEvent();
    }

    // Story Floating Tags and Statuses
    static async #handleToggleFloatingTagOrStatusMarking(event, target) {
        event.preventDefault();
        if(game.user.isGM === false) return;
        if(!this.currentSceneDataItem) return;

        const index = target.dataset.index;
        await FloatingTagAndStatusAdapter.handleToggleFloatingTagOrStatusMarking(this.currentSceneDataItem, index, target.dataset.markingIndex);

        this.sendUpdateHookEvent();
    }

    // Story Floating Tags and Statuses
    async handleFtStatChanged (event) {
        event.preventDefault();
        if(game.user.isGM === false) return;
        if(!this.currentSceneDataItem) return;

        const index = event.currentTarget.dataset.index;
        const key = event.currentTarget.dataset.key;
        const value = event.currentTarget.value;
        
        await FloatingTagAndStatusAdapter.handleFtStatChanged(this.currentSceneDataItem, index, key, value);
        this.sendUpdateHookEvent();
    }

    static async #handleToggleFloatingTagOrStatusSelected(event, target) {
        event.preventDefault();

        if(game.user.isGM === false) return;
        if(!this.currentSceneDataItem) return;

        const index = target.dataset.index;
        await FloatingTagAndStatusAdapter.handleTagStatusSelectedToggle(this.currentSceneDataItem, index);
        this.sendUpdateHookEvent();
    }

    static async #handleToggleFloatingTagOrStatus(event,target) {
        event.preventDefault();
        if(game.user.isGM === false) return;
        if(!this.currentSceneDataItem) return;

        const index = target.dataset.index;
        await FloatingTagAndStatusAdapter.handleTagStatusToggle(this.currentSceneDataItem, index);
        this.sendUpdateHookEvent();
    }

    static async #handleToggleFloatingTagOrStatusModifier(event, target) {
        event.preventDefault();

        if(game.user.isGM === false) return;
        if(!this.currentSceneDataItem) return;

        const index = target.dataset.index;
        await FloatingTagAndStatusAdapter.handleTagStatusModifierToggle(this.currentSceneDataItem, index);
        this.sendUpdateHookEvent();
    }

    static async #handleDeleteFloatingTagOrStatus(event, target) {
        event.preventDefault();
        
        if(game.user.isGM === false) return;
        if(!this.currentSceneDataItem) return;

        const index = target.dataset.index;
        await FloatingTagAndStatusAdapter.handleDeleteFloatingTagOrStatus(this.currentSceneDataItem, index);
        this.sendUpdateHookEvent();
    }

    static async #handleCreateFloatingTagOrStatus(event, target) {
        event.preventDefault();
        if(game.user.isGM === false) return;
        if(!this.currentSceneDataItem) return;
        
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

    sceneUpdatedHook(){
        this.findOrCreateSceneDataItem();
        this.sendUpdateHookEvent();
    }

    sendFloatableTagOrStatusUpdateForActor(actor){
        if(game.user.isGM){
            game.socket.emit("system.mist-engine-fvtt", {
            type: "hook",
            hook: "floatableTagOrStatusUpdateViaSceneApp",
            data: { actorId: actor.id }
            });
        }
        this.sendUpdateHookEvent();
    }

    async addRollModification(name, value){
        if(game.user.isGM === false) return;
        console.log("addRollModification", name, value);
        if(!this.currentSceneDataItem) return;
        let tags = this.currentSceneDataItem.system.diceRollTagsStatus || [];
        tags.push({name, value: parseInt(value)});
        await this.currentSceneDataItem.update({ "system.diceRollTagsStatus": tags });
        
        this.sendUpdateHookEvent();
    }

    getRollModifications(){
        if(!this.currentSceneDataItem) return [];
        return this.currentSceneDataItem.system.diceRollTagsStatus || [];
    }

    getSceneAndStoryTags(){
        if(!this.currentSceneDataItem) return [];
        return this.currentSceneDataItem.system.floatingTagsAndStatuses || [];
    }

    resetSelection(){
        if(!this.currentSceneDataItem) return;
        if(game.user.isGM === false) return;

        const floatingTagsAndStatuses = this.currentSceneDataItem.system.floatingTagsAndStatuses;
        if (!floatingTagsAndStatuses) return;
        floatingTagsAndStatuses.forEach(t => t.selected = false);
        this.currentSceneDataItem.update({ [`system.floatingTagsAndStatuses`]: floatingTagsAndStatuses });

        this.sendUpdateHookEvent();
    }
}