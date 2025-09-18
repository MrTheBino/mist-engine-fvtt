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
                for (let backpackItem of backpackItems) {
                    if (backpackItem.selected) {
                        this.selectedTags.push({ name: backpackItem.name, positive: true });
                    }
                }
            }
            if (item.type === "themebook") {
                for (let i = 0; i < 7; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    if (foundry.utils.getProperty(item, powertagPath)) {
                        this.selectedTags.push({ name: item.system[`powertag${i + 1}`].name, positive: true, toBurn: item.system[`powertag${i + 1}`].toBurn, index: i + 1, themebookId: item.id });
                    }

                    const weeknesstagPath = `system.weeknesstag${i + 1}.selected`;
                    if (foundry.utils.getProperty(item, weeknesstagPath)) {
                        this.selectedTags.push({ name: item.system[`weeknesstag${i + 1}`].name, positive: false });
                    }
                }
            }
        }
    }

    isTagToBurn(index, themebookId) {
        for (let tag of this.selectedTags){
            if (tag.toBurn && tag.index === index && themebookId === tag.themebookId){
                return true;
            }
        }
        return false;
    }

    resetTags() {
        for (let item of this.actor.items) {
            if (item.type === "backpack") {
                const backpackItems = item.system.items;
                for (let backpackItem of backpackItems) {
                    backpackItem.selected = false;
                }
                item.update({ 'system.items': backpackItems });
            }
            if (item.type === "themebook") {
                for (let i = 0; i < 7; i++) {
                    const powertagPath = `system.powertag${i + 1}.selected`;
                    item.update({ [powertagPath]: false });
                    const powertagPathToBurn = `system.powertag${i + 1}.toBurn`;
                    item.update({ [powertagPathToBurn]: false });

                    if (this.isTagToBurn(i + 1,item._id)){
                        const powertagToBurnPath = `system.powertag${i + 1}.burned`;
                        item.update({ [powertagToBurnPath]: true });//mark as burned
                    }
                }
                for(let i = 0; i < 2; i++){
                    const weeknesstagPath = `system.weeknesstag${i + 1}.selected`;
                    item.update({ [weeknesstagPath]: false });
                }
            }
        }
    }

    async rollCallback(event, button, dialog) {

        let numPositiveTags = parseInt(button.form.positiveValue.value);
        let numNegativeTags = parseInt(button.form.negativeValue.value);


        this.selectedTags.forEach(element => {
            if (element.positive) {
                if(element.toBurn){
                    numPositiveTags += 3;
                }else{
                    numPositiveTags++;
                }
            }
            else {
                numNegativeTags++;
            }
        });

        const dicePromises = [];

        let rollFormula = `2d6 + ${numPositiveTags} - ${numNegativeTags}`;
        const diceRoll = new Roll(rollFormula, this.actor.getRollData());
        await diceRoll.evaluate();

        this.addShowDicePromise(dicePromises, diceRoll);
        await Promise.all(dicePromises);

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
            label: 'Quick',
            selectedTags: this.selectedTags,
            consequenceResult: consequenceResult
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