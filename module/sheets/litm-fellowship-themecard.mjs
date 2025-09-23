import { MistEngineActorSheet } from './actor-sheet.mjs';
import { DiceRollAdapter } from '../lib/dice-roll-adapter.mjs';

export class MistEngineLegendInTheMistFellowshipThemecard extends MistEngineActorSheet {
    #dragDrop // Private field to hold dragDrop handlers
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['mist-engine', 'sheet', 'actor'],
        tag: 'form',
        position: {
            width: 400,
            height: 750
        },
        actions: {
        },
        form: {
            submitOnChange: true
        },
        actor: {
            type: 'litm-fellowship-themecard'
        },
        dragDrop: [{
            dragSelector: '[draggable="true"]',
            dropSelector: '.mist-engine.actor'
        }],
        window: {
            resizable: true,
            controls: [
            ]
        }
    }

    static PARTS = {
        header: {
            id: 'header',
            template: 'systems/mist-engine-fvtt/templates/actor/parts/fellowship-themecard-header.hbs'
        },
        themebook:{
          id: 'themebook',
          template: 'systems/mist-engine-fvtt/templates/actor/litm-fellowship-themecard/themebook.hbs'
        }
    }

    /**
   * Define the structure of tabs used by this sheet.
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
    static TABS = {
        sheet: { // this is the group name
            tabs:
                [
                ],
            initial: 'npc'
        }
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);


    }

    async handleThemebookEntryInputChanged(event) {
        this.actor.update({ [event.target.dataset.key]: event.target.value });
    }
}