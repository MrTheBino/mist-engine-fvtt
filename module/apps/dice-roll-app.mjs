const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import { MistSceneApp } from "./scene-app.mjs";
import { FloatingTagAndStatusAdapter } from "../lib/floating-tag-and-status-adapter.mjs";
import {PowerTagAdapter} from "../lib/power-tag-adapter.mjs";
import { StoryTagAdapter } from "../lib/story-tag-adapter.mjs";

export class DiceRollApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.actor = options.actor;
        this.rollType = options.type || 'quick'; // 'quick' or 'detailed'

        //both are { name: String, positive: Boolean, weakness: Boolean, source: String,value: Number }
        this.selectedTags = [];
        this.selectedGmTags = [];
        this.selectedStoryTags = [];
        this.numModPositive = 0;
        this.numModNegative = 0;
        this.mightScale = 0;

        DiceRollApp.instance = this;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'dice-roll-app',
        classes: ['mist-engine', 'dialog', 'dice-roll-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'Dice Roll',
            icon: 'fa-solid fa-book-atlas',
            positioned: true,
            resizable: true
        },
        position: {
            width: 400,
            height: 600
        },
        actions: {
            clickedRoll: this.#rollCallback,
            clickModPositiveMinus: this.#handleClickModPositiveMinus,
            clickModPositivePlus: this.#handleClickModPositivePlus,
            clickModNegativeMinus: this.#handleClickModNegativeMinus,
            clickModNegativePlus: this.#handleClickModNegativePlus,
            clickDeselectTag: this.#handleClickDeselectTag,
            clickTagStatusModifierToggle: this.#handleTagStatusModifierToggle
        },
    };

    /** @override */
    static PARTS = {
        dialog: {
            template: 'systems/mist-engine-fvtt/templates/dice-roll-app/dialog.hbs',
            scrollable: ['']
        }
    };

    setOptions(options) {
        if (options.actor) {
            this.actor = options.actor;
        }
        if (options.type) {
            this.rollType = options.type || 'quick'; // 'quick' or 'detailed'
        }

        // set the dialog title according to the type
        if (this.rollType === 'quick') {
            this.options.window.title = 'Quick Dice Roll';
        } else if (this.rollType === 'detailed') {
            this.options.window.title = 'Detailed Dice Roll';
        }
        else if( this.rollType === 'reaction'){
            this.options.window.title = 'Reaction Roll';
        }
    }

    updateTagsAndStatuses(renderFlag = false) {
        this.selectedTags = [];
        this.selectedGmTags = [];
        this.selectedStoryTags = [];

        this.prepareTags();
        this.prepareGMTags();
        this.prepareSceneAndStoryTags();
        if (renderFlag == true && this.rendered) {
            this.render(true, { focus: true })
        }
    }

    static getInstance(options = {}) {
        if (!DiceRollApp.instance) {
            DiceRollApp.instance = new DiceRollApp(options);
        }
        let instance = DiceRollApp.instance;
        instance.setOptions(options);
        return instance;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        this.applyRulesPreviewToSelectedTags();
        context.selectedTags = this.selectedTags;
        context.selectedGmTags = this.selectedGmTags;
        context.selectedStoryTags = this.selectedStoryTags;
        context.rollType = this.rollType;
        context.numModPositive = this.numModPositive || 0;
        context.numModNegative = this.numModNegative || 0;
        context.mightScale = this.mightScale;
        context.mightUsageEnabled = game.settings.get("mist-engine-fvtt", "mightUsageEnabled");
        if(context.mightUsageEnabled == false){ // just to be sure
            context.mightScale = 0;
        }
        let countTags =  DiceRollApp.calculatePowerTags(DiceRollApp.applyRulesToSelectedTags(this.selectedTags, this.selectedGmTags, this.selectedStoryTags)); 
        context.powerAmount = (countTags.positive - countTags.negative) + context.mightScale + this.numModPositive - this.numModNegative;
        /*if(context.powerAmount < 0){
            context.powerAmount = 0;
        }*/

        // sort selected tags by first positive ones then negative ones, both alphabetically
        context.selectedTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });

        // sort select gm tags by first positive ones then negative ones, both alphabetically
        context.selectedGmTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });

        // sort select story tags by first positive ones then negative ones, both alphabetically
        context.selectedStoryTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });
        return context;
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);
    }

    prepareGMTags() {
        MistSceneApp.getInstance().getRollModifications().forEach(element => {
            // at present all gm tags are negative
            // the roll modifications have a flag positive(boolean) but it is not used for now
            this.selectedGmTags.push({ name: element.name, positive: element.positive, source: "gm", value: element.value });
        });
    }

    prepareSceneAndStoryTags() {
        MistSceneApp.getInstance().getSceneAndStoryTags().forEach(element => {
            if (element.selected) {
                this.selectedStoryTags.push({ name: element.name, positive: element.positive, source: "scene-and-story", value: element.value });
            }
        });
    }

    static calculatePowerTags(tagsForRoll){
        let numPositiveTags = 0;
        let numNegativeTags = 0;

        tagsForRoll.forEach(element => {
            if (element.value === undefined || element.value == 0) {
                // normal power tags, story tags etc
                if (element.positive) {
                    if (element.toBurn) {
                        numPositiveTags += 3;
                    } else {
                        numPositiveTags++;
                    }
                }
                else {
                    numNegativeTags++;
                }
            } else {
                // statuses
                if (element.positive) {
                    numPositiveTags += element.value;
                }
                else {
                    numNegativeTags += element.value;
                }
            }
        });
        return { positive: numPositiveTags, negative: numNegativeTags };
    }

    applyRulesPreviewToSelectedTags() {
        const tempTagsForRole = DiceRollApp.applyRulesToSelectedTags(this.selectedTags, this.selectedGmTags, this.selectedStoryTags);
        // we got the result, now we add to the single selectedTags array a new property 'isAppliedInPreview' to indicate if the tag/status is applied in the preview
        this.selectedTags.forEach(tag => {
            const foundTag = tempTagsForRole.find(t => t.name === tag.name && t.positive === tag.positive && t.source === tag.source);
            if (foundTag) {
                tag.isAppliedInPreview = true;
            } else {
                tag.isAppliedInPreview = false;
            }
        });

        // we do the same for selectedGmTags
        this.selectedGmTags.forEach(tag => {
            const foundTag = tempTagsForRole.find(t => t.name === tag.name && t.positive === tag.positive && t.source === tag.source);
            if (foundTag) {
                tag.isAppliedInPreview = true;
            } else {
                tag.isAppliedInPreview = false;
            }
        });

        // the same for selectedStoryTags
        this.selectedStoryTags.forEach(tag => {
            const foundTag = tempTagsForRole.find(t => t.name === tag.name && t.positive === tag.positive && t.source === tag.source);
            if (foundTag) {
                tag.isAppliedInPreview = true;
            } else {
                tag.isAppliedInPreview = false;
            }
        });
    }

    static applyRulesToSelectedTags(selectedTags, selectedGmTags, selectedStoryTags) {
        const tagsForRole = [];

        // first the take all normal tags
        selectedGmTags.forEach(gmTag => {
            if (gmTag.value === 0 || gmTag.value === undefined) {
                tagsForRole.push(gmTag);
            }
        });

        selectedTags.forEach(tag => {
            if (tag.value === 0 || tag.value === undefined) {
                tagsForRole.push(tag);
            }
        });

        selectedStoryTags.forEach(tag => {
            if (tag.value === 0 || tag.value === undefined) {
                tagsForRole.push(tag);
            }
        });

        let statuses = selectedTags.filter(t => t.value && t.value > 0);
        statuses = selectedStoryTags.filter(t => t.value && t.value > 0).concat(statuses);
        statuses = selectedGmTags.filter(t => t.value && t.value > 0).concat(statuses);

        let positiveStatuses = statuses.filter(s => s.positive);
        let negativeStatuses = statuses.filter(s => !s.positive);

        // lets go through the statuses, but we only take the highest value one for each type
        if (positiveStatuses.length > 0) {
            let biggestPositiveStatus = positiveStatuses.reduce(function (prev, current) {
                return (prev && prev.value > current.value) ? prev : current
            }) //returns object
            if (biggestPositiveStatus) {
                tagsForRole.push(biggestPositiveStatus);
            }
        }


        if (negativeStatuses.length > 0) {
            let biggestNegativeStatus = negativeStatuses.reduce(function (prev, current) {
                return (prev && prev.value > current.value) ? prev : current
            }) //returns object
            if (biggestNegativeStatus) {
                tagsForRole.push(biggestNegativeStatus);
            }
        }

        return tagsForRole;
    }

    static getPreparedTagsAndStatusesForRoll(actor) {
        let selectedTags = [];
        if(!actor || (actor.type !== "character" && actor.type !== "litm-character")){
            return selectedTags;
        }
        
        if(!actor){
            console.warn("No actor provided for getPreparedTagsAndStatusesForRoll");
            return selectedTags;
        
        }
        for (let item of actor.items) {
            if (item.type === "backpack") {
                const backpackItems = item.system.items;
                if (backpackItems) {
                    for (const [i, backpackItem] of backpackItems.entries()) {
                        if (backpackItem.selected) {
                            selectedTags.push({ name: backpackItem.name, positive: true, toBurn: backpackItem.toBurn, index: i + 1, themebookId: backpackItem.id, source: 'backpack' });
                        }
                    }
                }
            }

            if (item.type === "themebook") {
                for (let i = 0; i < 10; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    if (foundry.utils.getProperty(item, powertagPath)) {
                        selectedTags.push({ name: item.system[`powertag${i + 1}`].name, positive: true, toBurn: item.system[`powertag${i + 1}`].toBurn, index: i + 1, themebookId: item.id, source: null });
                    }

                    const weaknesstagPath = `system.weaknesstag${i + 1}.selected`;
                    if (foundry.utils.getProperty(item, weaknesstagPath)) {
                        selectedTags.push({ name: item.system[`weaknesstag${i + 1}`].name, positive: false, weakness: true, source: null,index: i+1,themebookId: item.id });
                    }
                }
            }
        }

        if (actor.system.fellowships && actor.system.fellowships.length > 0) {
            actor.system.fellowships.forEach((entry, index) => {
                if (entry.selected) {
                    selectedTags.push({ name: entry.relationshipTag, positive: true, fellowship: true, source: 'fellowship-relationship', index: index + 1});
                }
            });
        }

        // fellowship themecard tags
        if (actor.sheet.getActorFellowshipThemecard()) {
            let actorFellowshipThemecard = actor.sheet.getActorFellowshipThemecard();
            if (actorFellowshipThemecard) {
                for (let i = 0; i < 10; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    if (foundry.utils.getProperty(actorFellowshipThemecard, powertagPath)) {
                        selectedTags.push({ name: actorFellowshipThemecard.system[`powertag${i + 1}`].name, positive: true, toBurn: actorFellowshipThemecard.system[`powertag${i + 1}`].toBurn, index: i + 1, source: "fellowship-themecard" });
                    }

                    const weaknesstagPath = `system.weaknesstag${i + 1}.selected`;
                    if (foundry.utils.getProperty(actorFellowshipThemecard, weaknesstagPath)) {
                        selectedTags.push({ name: actorFellowshipThemecard.system[`weaknesstag${i + 1}`].name, positive: false, weakness: true,index: i + 1, source: "fellowship-themecard" });
                    }
                }
            }
        } else {
            console.log("No fellowship themecard in the actor getActorFellowshipThemecard():", actor.name);
        }

        // floating tags and statuses from the actor
        if (actor.system.floatingTagsAndStatuses && actor.system.floatingTagsAndStatuses.length > 0) {
            actor.system.floatingTagsAndStatuses.forEach((entry,index) => {
                if (entry.selected) {
                    let t = { name: entry.name, positive: entry.positive, source: "floating-tag", value: entry.value,index: index + 1,isStatus: true };
                    if(entry.value === undefined || entry.value > 0){
                        t.isStatus = true;
                    }
                    selectedTags.push(t);
                }
            });
        }

        // sort selected tags by first positive ones then negative ones, both alphabetically
        selectedTags.sort((a, b) => {
            if (a.positive === b.positive) { 
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });

        return selectedTags;
    }

    prepareTags() {

        this.selectedTags = DiceRollApp.getPreparedTagsAndStatusesForRoll(this.actor);

    }

    // ToDo, Needs fixing, not working as expected
    isTagToBurn(index, themebookId, source = null) {
        for (let tag of this.selectedTags) {
            if (tag.toBurn && tag.index === index && themebookId === tag.themebookId && source === null) {
                return true;
            }
            else if (tag.toBurn && tag.index === index && source !== null) {
                if (tag.source === source) {
                    return true;
                }
            }
        }
        return false;
    }

    wasTagSelected(index, themebookId, source = null) {
       for (let tag of this.selectedTags) {
            if (tag.index === index && themebookId === tag.themebookId && source === null) {
                return true;
            }
            else if (tag.index === index && source !== null) {
                if (tag.source === source) {
                    return true;
                }
            }
        }
        return false;
    }

    async resetTags() {
        let alreadyImprovedThemebooks = [];

        for (let item of this.actor.items) {
            if (item.type === "backpack") {
                const backpackItems = item.system.items;
                if (backpackItems) {
                    for (let [bi, backpackItem] of backpackItems.entries()) {
                        backpackItem.selected = false;
                        if (backpackItem.toBurn) {
                            backpackItem.burned = true;
                            backpackItem.toBurn = false;
                        }
                    }
                }

                await item.update({ 'system.items': backpackItems });
            }
            if (item.type === "themebook") {
                for (let i = 0; i < 10; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    item.update({ [powertagPath]: false });
                    const powertagPathToBurn = `system.powertag${i + 1}.toBurn`;
                    item.update({ [powertagPathToBurn]: false });

                    if (this.isTagToBurn(i + 1, item._id)) {
                        const powertagToBurnPath = `system.powertag${i + 1}.burned`;
                        item.update({ [powertagToBurnPath]: true });//mark as burned
                    }
                }
                for (let i = 0; i < 4; i++) {
                    const weaknesstagPath = `system.weaknesstag${i + 1}.selected`;
                    if(foundry.utils.getProperty(item, weaknesstagPath) == true){
                        if(item.system.improve < 3){
                            if(alreadyImprovedThemebooks.includes(item.id) == false){
                                alreadyImprovedThemebooks.push(item.id);
                                await item.update({ 'system.improve': item.system.improve + 1 });
                            }
                        }
                    };
                    await item.update({ [weaknesstagPath]: false });
                }
            }
        }

        const fellowships = this.actor.system.fellowships;
        let fellowshipTagsToCheck = this.selectedTags.filter(t => t.source === "fellowship-relationship").map(t => t.name);
        if (fellowships && fellowships.length > 0) {
            fellowships.forEach((entry) => {
                //check if fellowship tag was selected
                if(fellowshipTagsToCheck.includes(entry.relationshipTag)) {
                    // mark as scratched
                    if(entry.selected){
                        entry.scratched = true;
                    }
                }
                entry.selected = false;
            });
            await this.actor.update({ 'system.fellowships': fellowships });
        }

        // fellowship themecard tags
        if (this.actor.sheet.getActorFellowshipThemecard()) {
            let actorFellowshipThemecard = this.actor.sheet.getActorFellowshipThemecard();
            if (actorFellowshipThemecard) {
                for (let i = 0; i < 10; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    await actorFellowshipThemecard.update({ [powertagPath]: false });
                    const powertagPathToBurn = `system.powertag${i + 1}.toBurn`;
                    await actorFellowshipThemecard.update({ [powertagPathToBurn]: false });

                    if (this.wasTagSelected(i + 1, null, "fellowship-themecard")) {
                        const powertagToBurnPath = `system.powertag${i + 1}.burned`;
                        await actorFellowshipThemecard.update({ [powertagToBurnPath]: true });//mark as burned
                    }
                }
                for (let i = 0; i < 4; i++) {
                    const weaknesstagPath = `system.weaknesstag${i + 1}.selected`;
                    if(foundry.utils.getProperty(actorFellowshipThemecard, weaknesstagPath) == true){
                        if(actorFellowshipThemecard.system.improve < 3){
                            if(alreadyImprovedThemebooks.includes(actorFellowshipThemecard.id) == false){
                                alreadyImprovedThemebooks.push(actorFellowshipThemecard.id);
                                await actorFellowshipThemecard.update({ 'system.improve': actorFellowshipThemecard.system.improve + 1 });
                            }
                        }
                    };
                    await actorFellowshipThemecard.update({ [weaknesstagPath]: false });
                }
            }
            if (this.actor.sheet) {
                this.actor.sheet.reloadFellowshipThemecard(true); // true for emitting data to others    
            } else {
                console.log("No actor sheet to send reload signal for fellowship themecard");
            }

        }

        // floating tags and statuses from the actor
        if (this.actor.system.floatingTagsAndStatuses && this.actor.system.floatingTagsAndStatuses.length > 0) {
            let floatingTagsAndStatuses = this.actor.system.floatingTagsAndStatuses;
            floatingTagsAndStatuses.forEach((entry) => {
                entry.selected = false;
            });
            await this.actor.update({ 'system.floatingTagsAndStatuses': floatingTagsAndStatuses });
        }

        this.actor.sheet.render();
        MistSceneApp.getInstance().resetSelection();
    }

      static async #rollCallback(event,target) {
        let numPositiveTags = parseInt(target.form.positiveValue.value);
        let numNegativeTags = parseInt(target.form.negativeValue.value);

        // first check if might usage is enabled
        let mightScale = 0;
        if(game.settings.get("mist-engine-fvtt", "mightUsageEnabled") == true){
            mightScale = parseInt(target.form.might_scale.value);
        }

        let tagsAndStatusForRoll = DiceRollApp.applyRulesToSelectedTags(this.selectedTags, this.selectedGmTags, this.selectedStoryTags);
        let countTags = DiceRollApp.calculatePowerTags(tagsAndStatusForRoll);
        numPositiveTags += countTags.positive;
        numNegativeTags += countTags.negative;


        const dicePromises = [];

        let rollFormula = `2d6`;
        if (numPositiveTags > 0) rollFormula += ` + ${numPositiveTags}`;
        if (numNegativeTags > 0) rollFormula += ` - ${numNegativeTags}`;

        let numPowerTags = parseInt(numPositiveTags) - parseInt(numNegativeTags);
        if (numPowerTags <= 0) numPowerTags = 1; // at least 1 power tag

        if(mightScale != 0){
            rollFormula += ` + ${mightScale}`;
            numPowerTags += mightScale;
            if (numPowerTags <= 0){
                numPowerTags = 1; // is this correct?
            }
        }

        const diceRoll = new Roll(rollFormula, this.actor.getRollData());
        await diceRoll.evaluate();

        this.addShowDicePromise(dicePromises, diceRoll);
        await Promise.all(dicePromises);

        let diceResults = [...diceRoll.terms[0].results].map(r => r.result);

        let isCritical = (diceResults[0] === 6 && diceResults[1] === 6);
        let isFumble = (diceResults[0] === 1 && diceResults[1] === 1);

        let diceRollHTML = await diceRoll.render();

        let consequenceResult = -1;
        if (diceRoll.total >= 10) {
            consequenceResult = 1;
        }
        else if (diceRoll.total >= 7 && diceRoll.total <= 9) {
            consequenceResult = 0;
        }

        let positiveTags = tagsAndStatusForRoll.filter(t => t.positive);
        let negativeTags = tagsAndStatusForRoll.filter(t => !t.positive);

        const chatVars = {
            diceRollHTML: diceRollHTML,
            label: game.i18n.localize(`MIST_ENGINE.ROLL_TYPES.${this.rollType}`),
            tagsAndStatusForRoll: this.tagsAndStatusForRoll,
            positiveTags: positiveTags,
            negativeTags: negativeTags,
            consequenceResult: consequenceResult,
            isCritical: isCritical,
            isFumble: isFumble,
            numPowerTags: numPowerTags,
        };

        const html = await foundry.applications.handlebars.renderTemplate(
            `systems/mist-engine-fvtt/templates/chat/${this.rollType}-result.hbs`,
            chatVars
        );
        ChatMessage.create({
            content: html,
            speaker: ChatMessage.getSpeaker({ ctor: this.actor }),
        });

        this.resetTags();
        this.close();
    }

    addShowDicePromise(promises, roll) {
        if (game.dice3d) {
            // we pass synchronize=true so DSN dice appear on all players' screens
            promises.push(game.dice3d.showForRoll(roll, game.user, true, null, false));
        }
    }

    static async #handleClickModPositiveMinus(event, target) {
        const input = target.parentElement.querySelector("#positiveInput");
        input.stepDown();
        this.numModPositive = parseInt(input.value);
        if(this.numModPositive < 0){
            this.numModPositive = 0;
            input.value = 0;
        }
        this.render()
    }
    static async #handleClickModPositivePlus(event, target) {
        const input = target.parentElement.querySelector("#positiveInput");
        input.stepUp();
        this.numModPositive = parseInt(input.value);
        this.render()
    }
    static async #handleClickModNegativeMinus(event, target) {
        const input = target.parentElement.querySelector("#negativeInput");
        input.stepDown();
        this.numModNegative = parseInt(input.value);
        if(this.numModNegative < 0){
            this.numModNegative = 0;
            input.value = 0;
        }
        this.render()
    }

    static async #handleClickModNegativePlus(event, target) {
        const input = target.parentElement.querySelector("#negativeInput");
        input.stepUp();
        this.numModNegative = parseInt(input.value);
        this.render()
    }

    static async #handleTagStatusModifierToggle(event, target) {
        const index = parseInt(target.dataset.index);
        await FloatingTagAndStatusAdapter.handleTagStatusModifierToggle(this.actor, index -1);
        this.updateTagsAndStatuses(true);
    }

    static async #handleClickDeselectTag(event, target) {
        const index = parseInt(target.dataset.index);
        
        const tagToDeselect = this.selectedTags[index]; 
        if (!tagToDeselect) {
            console.warn("No tag found to deselect at index:", index);
            return;
        }
        else{
            // we check if this is a power tag or weakness tag from a themebook and if a themebook id is provided
            if(tagToDeselect.source === null && tagToDeselect.themebookId){
                if(tagToDeselect.weakness){
                    await PowerTagAdapter.deselectPowerTag(this.actor, tagToDeselect.themebookId, `system.weaknesstag${tagToDeselect.index}.selected`, tagToDeselect.index - 1);
                }
                else{
                    await PowerTagAdapter.deselectPowerTag(this.actor, tagToDeselect.themebookId, `system.powertag${tagToDeselect.index}.selected`, tagToDeselect.index - 1);
                }
                this.updateTagsAndStatuses(true);
            }
            // now the backpack
            else if(tagToDeselect.source === "backpack"){
                //get the backpack from the actor in one line
                let backpackItem = this.actor.items.find(i => i.type === "backpack");
                // backpacks contains powertags 
                if(backpackItem){
                    await StoryTagAdapter.toggleStoryTagSelection(this.actor, backpackItem.id, 'system.items', tagToDeselect.index -1);
                    this.updateTagsAndStatuses(true);
                }
            }
            // now floating tag or status
            else if(tagToDeselect.source === "floating-tag"){
                await FloatingTagAndStatusAdapter.handleTagStatusSelectedToggle(this.actor, tagToDeselect.index -1);
                this.updateTagsAndStatuses(true);
            }
            // now for fellowship theme cards
            else if(tagToDeselect.source === "fellowship-themecard"){
                let fellowshipThemecard = this.actor.sheet.getActorFellowshipThemecard();
                if(fellowshipThemecard){
                    if(tagToDeselect.weakness){
                        await fellowshipThemecard.update({ [`system.weaknesstag${tagToDeselect.index}.selected`]: false });
                    }
                    else{
                        await fellowshipThemecard.update({ [`system.powertag${tagToDeselect.index}.selected`]: false });
                    }
                    this.updateTagsAndStatuses(true);
                    this.actor.render({force: false})
                }
            }
            // now for fellowship-relationship
            else if(tagToDeselect.source === "fellowship-relationship"){
                let fellowships = this.actor.system.fellowships;
                let indexOfTag = tagToDeselect.index -1;
                if(fellowships && fellowships.length > indexOfTag){
                    fellowships[indexOfTag].selected = false;
                    await this.actor.update({ 'system.fellowships': fellowships });
                    this.updateTagsAndStatuses(true);
                    this.actor.render({force: false})
                }
            }
        }
    }
}