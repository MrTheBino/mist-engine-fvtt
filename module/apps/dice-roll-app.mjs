const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import { MistSceneApp } from "./scene-app.mjs";
import { FloatingTagAndStatusAdapter } from "../lib/floating-tag-and-status-adapter.mjs";
import { PowerTagAdapter } from "../lib/power-tag-adapter.mjs";
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
        this.challengeTags = [];
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
        else if (this.rollType === 'reaction') {
            this.options.window.title = 'Reaction Roll';
        }
    }

    updateTagsAndStatuses(renderFlag = false) {
        this.selectedTags = [];
        this.selectedGmTags = [];
        this.selectedStoryTags = [];
        this.challengeTags = [];

        this.prepareTags();
        this.prepareGMTags();
        this.prepareSceneAndStoryTags();
        this.prepareChallengeTags();
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
        context.challengeTags = this.challengeTags;
        context.rollType = this.rollType;
        context.numModPositive = this.numModPositive || 0;
        context.numModNegative = this.numModNegative || 0;
        context.mightScale = this.mightScale;
        context.mightUsageEnabled = game.settings.get("mist-engine-fvtt", "mightUsageEnabled");
        if (context.mightUsageEnabled == false) { // just to be sure
            context.mightScale = 0;
        }
        context.powerAmount = this.computePowerAmount();
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

        // sort challenge tags
        context.challengeTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });
        return context;
    }

    /** Total power shown in the dialog: tags +/- , might scale and the manul +/- mods. */
    computePowerAmount() {
        const countTags = DiceRollApp.calculatePowerTags(
            DiceRollApp.applyRulesToSelectedTags(this.selectedTags, this.selectedGmTags, this.selectedStoryTags, this.challengeTags)
        );
        const mightEnabled = game.settings.get("mist-engine-fvtt", "mightUsageEnabled") === true;
        const mightScale = mightEnabled ? (this.mightScale || 0) : 0;
        return (countTags.positive - countTags.negative) + mightScale + (this.numModPositive || 0) - (this.numModNegative || 0);
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        const updatePowerLabel = () => {
            const label = this.element.querySelector('.power-label');
            if (label) label.textContent = `Power: ${this.computePowerAmount()}`;
        };

        const posInput = this.element.querySelector('#positiveInput');
        posInput?.addEventListener('input', () => {
            this.numModPositive = Math.max(0, parseInt(posInput.value) || 0);
            updatePowerLabel();
        });

        const negInput = this.element.querySelector('#negativeInput');
        negInput?.addEventListener('input', () => {
            this.numModNegative = Math.max(0, parseInt(negInput.value) || 0);
            updatePowerLabel();
        });

        for (const radio of this.element.querySelectorAll('.might-scale-radio')) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.mightScale = parseInt(radio.value) || 0;
                    updatePowerLabel();
                }
            });
        }
    }

    prepareGMTags() {
        const sceneApp = MistSceneApp.instance;
        if (!sceneApp) return;
        sceneApp.getRollModifications().forEach(element => {
            // at present all gm tags are negative
            // the roll modifications have a flag positive(boolean) but it is not used for now
            this.selectedGmTags.push({ name: element.name, positive: element.positive, source: "gm", value: element.value, might: element.might, mightIcon: element.mightIcon });
        });
    }

    prepareSceneAndStoryTags() {
        const sceneApp = MistSceneApp.instance;
        if (!sceneApp) return;
        sceneApp.getSceneAndStoryTags().forEach(element => {
            if (element.selected) {
                this.selectedStoryTags.push({ name: element.name, positive: element.positive, source: "scene-and-story", value: element.value, might: element.might, mightIcon: element.mightIcon });
            }
        });
    }

    prepareChallengeTags() {
        const sceneApp = MistSceneApp.instance;
        if (!sceneApp) return;
        sceneApp.getCombinedSelectedNPCTags().forEach(element => {
            if (element.selected) {
                let t = { name: element.name, positive: element.positive, source: "npc", value: element.value, actorId: element.actorId, might: element.might, mightIcon: element.mightIcon };
                this.challengeTags.push(t);
            }
        });
    }

    static calculatePowerTags(tagsForRoll) {
        let numPositiveTags = 0;
        let numNegativeTags = 0;

        tagsForRoll.forEach(element => {

            if (element.value === undefined || element.value == 0) {
                // normal power tags, story tags etc
                if (element.positive) {
                    if (element.toBurn) {
                        numPositiveTags += 3;
                    } else {
                        if (element.might > 0) {
                            numPositiveTags += element.might;
                        } else {
                            numPositiveTags++;
                        }
                    }
                }
                else {
                    if (element.might > 0) {
                        numNegativeTags += element.might;
                    } else {
                        numNegativeTags++;
                    }

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
        const tempTagsForRole = DiceRollApp.applyRulesToSelectedTags(this.selectedTags, this.selectedGmTags, this.selectedStoryTags, this.challengeTags);
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

        // the same for challengeTags
        this.challengeTags.forEach(tag => {
            const foundTag = tempTagsForRole.find(t => t.name === tag.name && t.positive === tag.positive && t.source === tag.source && t.actorId === tag.actorId);
            if (foundTag) {
                tag.isAppliedInPreview = true;
            } else {
                tag.isAppliedInPreview = false;
            }
        });
    }

    static applyRulesToSelectedTags(selectedTags, selectedGmTags, selectedStoryTags, selectedChallengeTags) {
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

        selectedChallengeTags.forEach(tag => {
            if (tag.value === 0 || tag.value === undefined) {
                tagsForRole.push(tag);
            }
        });

        let statuses = selectedTags.filter(t => t.value && t.value > 0);
        statuses = selectedStoryTags.filter(t => t.value && t.value > 0).concat(statuses);
        statuses = selectedGmTags.filter(t => t.value && t.value > 0).concat(statuses);
        statuses = selectedChallengeTags.filter(t => t.value && t.value > 0).concat(statuses);

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
        if (!actor || (actor.type !== "character" && actor.type !== "litm-character")) {
            return selectedTags;
        }

        if (!actor) {
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
                if(item.system.powertags){
                    item.system.powertags.forEach((tag, i) => {
                        if (tag.selected) {
                            selectedTags.push({ name: tag.name, positive: true, toBurn: tag.toBurn, index: i, themebookId: item.id, source: null });
                        }
                    });
                }
                if(item.system.weaknesstags){
                    item.system.weaknesstags.forEach((tag, i) => {
                        if (tag.selected) {
                            selectedTags.push({ name: tag.name, positive: false, weakness: true, index: i, themebookId: item.id, source: null });
                        }
                    });
                }
            }
        }

        if (actor.system.fellowships && actor.system.fellowships.length > 0) {
            actor.system.fellowships.forEach((entry, index) => {
                if (entry.selected) {
                    selectedTags.push({ name: entry.relationshipTag, positive: true, fellowship: true, source: 'fellowship-relationship', index: index + 1 });
                }
            });
        }

        // fellowship themecard tags
        if (actor.sheet.getActorFellowshipThemecard()) {
            let actorFellowshipThemecard = actor.sheet.getActorFellowshipThemecard();
            if (actorFellowshipThemecard) {
                // check if ther are any powertags
                if (actorFellowshipThemecard.system.powertags) {
                    actorFellowshipThemecard.system.powertags.forEach((tag, i) => {
                        if (tag.selected) {
                            selectedTags.push({ name: tag.name, positive: true, toBurn: tag.toBurn, index: i, source: "fellowship-themecard" });
                        }
                    });
                }

                if (actorFellowshipThemecard.system.weaknesstags) {
                    actorFellowshipThemecard.system.weaknesstags.forEach((tag, i) => {
                        if (tag.selected) {
                            selectedTags.push({ name: tag.name, positive: false, weakness: true, index: i, source: "fellowship-themecard" });
                        }
                    });
                }
            }
        } else {
            console.log("No fellowship themecard in the actor getActorFellowshipThemecard():", actor.name);
        }

        // floating tags and statuses from the actor
        if (actor.system.floatingTagsAndStatuses && actor.system.floatingTagsAndStatuses.length > 0) {
            actor.system.floatingTagsAndStatuses.forEach((entry, index) => {
                if (entry.selected) {
                    let t = { name: entry.name, positive: entry.positive, source: "floating-tag", value: entry.value,index: index + 1,isStatus: entry.isStatus, might: entry.might, mightIcon: entry.mightIcon, isClickable: true };
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
                if (item.system.powertags && item.system.powertags.length > 0) {
                    const powertags = item.system.powertags.map((tag, i) => {
                        const burned = tag.burned || this.isTagToBurn(i, item._id);
                        return { ...tag, selected: false, toBurn: false, burned };
                    });
                    await item.update({ 'system.powertags': powertags });
                }

                if (item.system.weaknesstags && item.system.weaknesstags.length > 0) {
                    for (const tag of item.system.weaknesstags) {
                        if (tag.selected && item.system.improve < 3 && !alreadyImprovedThemebooks.includes(item.id)) {
                            alreadyImprovedThemebooks.push(item.id);
                            await item.update({ 'system.improve': item.system.improve + 1 });
                        }
                    }

                    const weaknesstags = item.system.weaknesstags.map(tag => ({ ...tag, selected: false }));
                    await item.update({ 'system.weaknesstags': weaknesstags });
                }



            }
        }

        const fellowships = this.actor.system.fellowships;
        let fellowshipTagsToCheck = this.selectedTags.filter(t => t.source === "fellowship-relationship").map(t => t.name);
        if (fellowships && fellowships.length > 0) {
            fellowships.forEach((entry) => {
                //check if fellowship tag was selected
                if (fellowshipTagsToCheck.includes(entry.relationshipTag)) {
                    // mark as scratched
                    if (entry.selected) {
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

                if (actorFellowshipThemecard.system.powertags) {
                    const powertags = actorFellowshipThemecard.system.powertags.map((tag, i) => {
                        const burned = tag.burned || this.wasTagSelected(i, null, "fellowship-themecard");
                        return { ...tag, selected: false, toBurn: false, burned };
                    });
                    await actorFellowshipThemecard.update({ 'system.powertags': powertags });
                }

                if (actorFellowshipThemecard.system.weaknesstags) {
                    for (const tag of actorFellowshipThemecard.system.weaknesstags) {
                        if (tag.selected && actorFellowshipThemecard.system.improve < 3 && !alreadyImprovedThemebooks.includes(actorFellowshipThemecard.id)) {
                            alreadyImprovedThemebooks.push(actorFellowshipThemecard.id);
                            await actorFellowshipThemecard.update({ 'system.improve': actorFellowshipThemecard.system.improve + 1 });
                        }
                    }
                    const weaknesstags = actorFellowshipThemecard.system.weaknesstags.map(tag => ({ ...tag, selected: false }));
                    await actorFellowshipThemecard.update({ 'system.weaknesstags': weaknesstags });
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
        MistSceneApp.instance?.resetSelection();
    }

    static async #rollCallback(event, target) {
        let numPositiveTags = parseInt(target.form.positiveValue.value);
        let numNegativeTags = parseInt(target.form.negativeValue.value);

        // first check if might usage is enabled
        let mightScale = 0;
        if (game.settings.get("mist-engine-fvtt", "mightUsageEnabled") == true) {
            mightScale = parseInt(target.form.might_scale.value);
        }

        let tagsAndStatusForRoll = DiceRollApp.applyRulesToSelectedTags(this.selectedTags, this.selectedGmTags, this.selectedStoryTags, this.challengeTags);
        let countTags = DiceRollApp.calculatePowerTags(tagsAndStatusForRoll);
        numPositiveTags += countTags.positive;
        numNegativeTags += countTags.negative;


        const dicePromises = [];

        let rollFormula = `2d6`;
        if (numPositiveTags > 0) rollFormula += ` + ${numPositiveTags}`;
        if (numNegativeTags > 0) rollFormula += ` - ${numNegativeTags}`;

        let numPowerTags = parseInt(numPositiveTags) - parseInt(numNegativeTags);
        if (numPowerTags <= 0) numPowerTags = 1; // at least 1 power tag

        if (mightScale != 0) {
            rollFormula += ` + ${mightScale}`;
            numPowerTags += mightScale;
            if (numPowerTags <= 0) {
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
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        });

        this.numModPositive = 0;
        this.numModNegative = 0;
        this.mightScale = 0;

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
        if (this.numModPositive < 0) {
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
        if (this.numModNegative < 0) {
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
        await FloatingTagAndStatusAdapter.handleTagStatusModifierToggle(this.actor, index - 1);
        this.updateTagsAndStatuses(true);
    }

    static async #handleClickDeselectTag(event, target) {
        const index = parseInt(target.dataset.index);

        const tagToDeselect = this.selectedTags[index];
        if (!tagToDeselect) {
            console.warn("No tag found to deselect at index:", index);
            return;
        }
        else {
            // we check if this is a power tag or weakness tag from a themebook and if a themebook id is provided
            if (tagToDeselect.source === null && tagToDeselect.themebookId) {
                if (tagToDeselect.weakness) {
                    await PowerTagAdapter.deselectPowerTag(this.actor, tagToDeselect.themebookId, `system.weaknesstags.${tagToDeselect.index}.selected`);
                }
                else {
                    await PowerTagAdapter.deselectPowerTag(this.actor, tagToDeselect.themebookId, `system.powertags.${tagToDeselect.index}.selected`);
                }
                this.updateTagsAndStatuses(true);
            }
            // now the backpack
            else if (tagToDeselect.source === "backpack") {
                //get the backpack from the actor in one line
                let backpackItem = this.actor.items.find(i => i.type === "backpack");
                // backpacks contains powertags 
                if (backpackItem) {
                    await StoryTagAdapter.toggleStoryTagSelection(this.actor, backpackItem.id, 'system.items', tagToDeselect.index - 1);
                    this.updateTagsAndStatuses(true);
                }
            }
            // now floating tag or status
            else if (tagToDeselect.source === "floating-tag") {
                await FloatingTagAndStatusAdapter.handleTagStatusSelectedToggle(this.actor, tagToDeselect.index - 1);
                this.updateTagsAndStatuses(true);
            }
            // now for fellowship theme cards
            else if (tagToDeselect.source === "fellowship-themecard") {
                let fellowshipThemecard = this.actor.sheet.getActorFellowshipThemecard();
                if (fellowshipThemecard) {
                    if (tagToDeselect.weakness) {
                        await fellowshipThemecard.update({ [`system.weaknesstags.${tagToDeselect.index}.selected`]: false });
                    }
                    else {
                        await fellowshipThemecard.update({ [`system.powertags.${tagToDeselect.index}.selected`]: false });
                    }
                    this.updateTagsAndStatuses(true);
                    this.actor.render({ force: false })
                }
            }
            // now for fellowship-relationship
            else if (tagToDeselect.source === "fellowship-relationship") {
                let fellowships = this.actor.system.fellowships;
                let indexOfTag = tagToDeselect.index - 1;
                if (fellowships && fellowships.length > indexOfTag) {
                    fellowships[indexOfTag].selected = false;
                    await this.actor.update({ 'system.fellowships': fellowships });
                    this.updateTagsAndStatuses(true);
                    this.actor.render({ force: false })
                }
            }
        }
    }
}