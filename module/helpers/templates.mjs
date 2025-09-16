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
    'systems/mist-engine-fvtt/templates/actor/parts/themebook-powertag-line.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/themebook-weekness-line.hbs',
    'systems/mist-engine-fvtt/templates/actor/parts/development-partial.hbs'
  ]);
};
