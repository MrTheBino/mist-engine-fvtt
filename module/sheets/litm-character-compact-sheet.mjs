import { MistEngineLegendInTheMistCharacterSheet } from './litm-character-sheet.mjs';

/**
 * A compact variant of the Legend in the Mist character sheet.
 *
 * Note that ApplicationV2 merges `DEFAULT_OPTIONS` along the inheritance chain
 * (arrays concatenated, objects merged), so only the deltas are declared here.
 * `PARTS` is *not* merged, hence the explicit spread.
 */
export class MistEngineCompactCharacterSheet extends MistEngineLegendInTheMistCharacterSheet {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['litm-compact'],
        // 4 card columns at 186px each + gaps, without the 300px artwork column.
        position: {
            width: 820
        }
    }

    /** @inheritDoc */
    static PARTS = {
        ...MistEngineLegendInTheMistCharacterSheet.PARTS,
        header: {
            id: 'header',
            template: 'systems/mist-engine-fvtt/templates/actor/parts/compact-character-header.hbs'
        }
    }

    /** @override */
    static ALTERNATE_LAYOUT = {
        id: "mist-engine-fvtt.MistEngineLegendInTheMistCharacterSheet",
        icon: "fa-solid fa-expand",
        label: "MIST_ENGINE.LABELS.SwitchToFullSheet"
    };

    /**
     * @override
     * The compact layout has no artwork column, so the custom background is
     * deliberately not painted. The actor keeps `system.customBackground` — it
     * reappears as soon as the actor is switched back to the full sheet.
     */
    _applyCustomBackground() {}
}
