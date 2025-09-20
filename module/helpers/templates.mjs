/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Actor partials.
    'systems/mist-engine-fvtt/templates/actor/parts/character-header.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/tab-litm-character.hbs',
    'systems/mist-engine-fvtt/templates/item/parts/themebook-powertag-line.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/character-themebooks.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/themebook-partial.hbs',
    'systems/mist-engine-fvtt/templates/shared/litm/themebook-powertag-line.hbs',
    'systems/mist-engine-fvtt/templates/shared/litm/themebook-weekness-line.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/development-partial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/backpack-partial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/npc-limits-edit-parial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/npc-tags-status-edit-parial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/npc-special-features-edit-parial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/npc-threats-edit-parial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/npc-beautified-partial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/character-quintessences-partial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/actor-fellowship-partial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/actor-fellowship-themebook-partial.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/floating-tags-and-status-partial.hbs',
    'systems/mist-engine-fvtt/templates/shared/lock-toggle.hbs',
    'systems/mist-engine-fvtt/templates/chat/critical-fumble-partial.hbs',
    'systems/mist-engine-fvtt/templates/chat/selected-tags-partial.hbs',
    'systems/mist-engine-fvtt/templates/actor/litm-fellowship-themecard/themebook.hbs'
  ]);
};