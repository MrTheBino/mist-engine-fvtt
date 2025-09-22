import { MistEngineRollDialog } from "../roll-dialog.mjs";
export class DiceRollAdapter {
    constructor(options = {}) {
        this.actor = options.actor;
        this.rollType = options.type || 'quick'; // 'quick' or 'detailed'
        this.selectedTags = [];
    }


    async render() {
        this.prepareTags();

        const html = await foundry.applications.handlebars.renderTemplate(
            "systems/mist-engine-fvtt/templates/dialogs/roll-dialog.hbs",
            { selectedTags: this.selectedTags }
        );

        return new Promise((resolve) => {
            new MistEngineRollDialog({
                window: { title: "RollDialog" },
                content: html,
                buttons: [
                    {
                        action: 'roll',
                        icon: '<i class="fas fa-dice-d6"></i>',
                        label: "Roll",
                        callback: (event, button, dialog) => this.rollCallback(event, button, dialog),
                    },
                ],
                default: "roll",
                close: () => resolve(null),
            }).render(true);
        });
    }

    prepareTags() {

        for (let item of this.actor.items) {
            if (item.type === "backpack") {
                const backpackItems = item.system.items;
                if (backpackItems) {
                    for (let backpackItem of backpackItems) {
                        if (backpackItem.selected) {
                            this.selectedTags.push({ name: backpackItem.name, positive: true, source: null });
                        }
                    }
                }
            }

            if (item.type === "themebook") {
                for (let i = 0; i < 7; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    if (foundry.utils.getProperty(item, powertagPath)) {
                        this.selectedTags.push({ name: item.system[`powertag${i + 1}`].name, positive: true, toBurn: item.system[`powertag${i + 1}`].toBurn, index: i + 1, themebookId: item.id, source: null });
                    }

                    const weaknesstagPath = `system.weaknesstag${i + 1}.selected`;
                    if (foundry.utils.getProperty(item, weaknesstagPath)) {
                        this.selectedTags.push({ name: item.system[`weaknesstag${i + 1}`].name, positive: false, weakness: true, source: null });
                    }
                }
            }
        }

        if (this.actor.system.fellowships && this.actor.system.fellowships.length > 0) {
            this.actor.system.fellowships.forEach((entry, index) => {
                if (entry.selected) {
                    this.selectedTags.push({ name: entry.relationshipTag, positive: true, fellowship: true, source: null });
                }
            });
        }

        // fellowship themecard tags
        if (this.actor.system.actorSharedSingleThemecardId && this.actor.system.actorSharedSingleThemecardId !== "") {
            let actorFellowshipThemecard = game.actors.get(this.actor.system.actorSharedSingleThemecardId);
            console.log(actorFellowshipThemecard);
            if (actorFellowshipThemecard) {
                for (let i = 0; i < 7; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    if (foundry.utils.getProperty(actorFellowshipThemecard, powertagPath)) {
                        this.selectedTags.push({ name: actorFellowshipThemecard.system[`powertag${i + 1}`].name, positive: true, toBurn: actorFellowshipThemecard.system[`powertag${i + 1}`].toBurn, index: i + 1, source: "fellowship-themecard" });
                    }

                    const weaknesstagPath = `system.weaknesstag${i + 1}.selected`;
                    if (foundry.utils.getProperty(actorFellowshipThemecard, weaknesstagPath)) {
                        this.selectedTags.push({ name: actorFellowshipThemecard.system[`weaknesstag${i + 1}`].name, positive: false, weakness: true, source: "fellowship-themecard" });
                    }
                }
            }
        } else {
            console.log("No fellowship themecard in the actor actor.system.actorSharedSingleThemecardId:", this.actor.system.actorSharedSingleThemecardId);
        }

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

    async resetTags() {
        for (let item of this.actor.items) {
            if (item.type === "backpack") {
                const backpackItems = item.system.items;
                if (backpackItems) {
                    for (let backpackItem of backpackItems) {
                        backpackItem.selected = false;
                    }
                }

                item.update({ 'system.items': backpackItems });
            }
            if (item.type === "themebook") {
                for (let i = 0; i < 7; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    item.update({ [powertagPath]: false });
                    const powertagPathToBurn = `system.powertag${i + 1}.toBurn`;
                    item.update({ [powertagPathToBurn]: false });

                    if (this.isTagToBurn(i + 1, item._id)) {
                        const powertagToBurnPath = `system.powertag${i + 1}.burned`;
                        item.update({ [powertagToBurnPath]: true });//mark as burned
                    }
                }
                for (let i = 0; i < 2; i++) {
                    const weaknesstagPath = `system.weaknesstag${i + 1}.selected`;
                    item.update({ [weaknesstagPath]: false });
                }
            }
        }

        const fellowships = this.actor.system.fellowships;
        if (fellowships && fellowships.length > 0) {
            fellowships.forEach((entry) => {
                entry.selected = false;
            });
            await this.actor.update({ 'system.fellowships': fellowships });
        }

        // fellowship themecard tags
        if (this.actor.system.actorSharedSingleThemecardId && this.actor.system.actorSharedSingleThemecardId !== "") {
            let actorFellowshipThemecard = game.actors.get(this.actor.system.actorSharedSingleThemecardId);
            if (actorFellowshipThemecard) {
                for (let i = 0; i < 7; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    await actorFellowshipThemecard.update({ [powertagPath]: false });
                    const powertagPathToBurn = `system.powertag${i + 1}.toBurn`;
                    await actorFellowshipThemecard.update({ [powertagPathToBurn]: false });

                    if (this.isTagToBurn(i + 1, null, "fellowship-themecard")) {
                        const powertagToBurnPath = `system.powertag${i + 1}.burned`;
                        await actorFellowshipThemecard.update({ [powertagToBurnPath]: true });//mark as burned
                    }
                }
                for (let i = 0; i < 2; i++) {
                    const weaknesstagPath = `system.weaknesstag${i + 1}.selected`;
                    await actorFellowshipThemecard.update({ [weaknesstagPath]: false });
                }
            }
            this.actor.sheet?.reloadFellowshipThemecard(true); // true for emitting data to others
        }

        this.actor.sheet.render();
    }

    async rollCallback(event, button, dialog) {

        let numPositiveTags = parseInt(button.form.positiveValue.value);
        let numNegativeTags = parseInt(button.form.negativeValue.value);


        this.selectedTags.forEach(element => {
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
        });

        const dicePromises = [];

        let rollFormula = `2d6`;
        if (numPositiveTags > 0) rollFormula += ` + ${numPositiveTags}`;
        if (numNegativeTags > 0) rollFormula += ` - ${numNegativeTags}`;

        let numPowerTags = parseInt(numPositiveTags) - parseInt(numNegativeTags);
        if (numPowerTags <= 0) numPowerTags = 1; // at least 1 power tag

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

        const chatVars = {
            diceRollHTML: diceRollHTML,
            label: game.i18n.localize(`MIST_ENGINE.ROLL_TYPES.${this.rollType}`),
            selectedTags: this.selectedTags,
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
    }

    addShowDicePromise(promises, roll) {
        if (game.dice3d) {
            // we pass synchronize=true so DSN dice appear on all players' screens
            promises.push(game.dice3d.showForRoll(roll, game.user, true, null, false));
        }
    }
}