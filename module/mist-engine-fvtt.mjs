// Import document classes.
import { MistEngineActor } from "./documents/actor.mjs";
import { MistEngineItem } from "./documents/item.mjs";

// Import sheet classes.
import { MistEngineActorSheet } from "./sheets/actor-sheet.mjs";
import { MistEngineLegendInTheMistCharacterSheet } from "./sheets/litm-character-sheet.mjs";
import { MistEngineLegendInTheMistNpcSheet } from "./sheets/litm-npc-sheet.mjs";
import { MistEngineLegendInTheMistFellowshipThemecard } from "./sheets/litm-fellowship-themecard.mjs"
import { MistEngineItemSheet } from "./sheets/item-sheet.mjs";
import { MistEngineShortChallengeItemSheet } from "./sheets/item-shortchallenge-sheet.mjs";
import { MistEngineItemThemekitSheet } from "./sheets/item-themekit-sheet.mjs";
import { MistEngineLegendInTheMistJourneySheet } from "./sheets/litm-actor-journey-sheet.mjs";
import { MistEngineThemebookItemSheet } from "./sheets/item-themebook-sheet.mjs";
import { MistEngineChallengeAddonItemSheet } from "./sheets/item-challenge-addon-sheet.mjs";
import { MistEngineJournalEntrySheet } from "./sheets/journal-entry-sheet.mjs";
import { MistSceneApp } from "./apps/scene-app.mjs";
import { HowToPlayApp } from "./apps/how-to-play-app.mjs";
import { ChangelogApp } from "./apps/changelog-app.mjs";

// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { MIST_ENGINE } from "./helpers/config.mjs";
import { registerHandlebarHelpers } from "./lib/handlebars.mjs";
import { FloatingTagAndStatusAdapter } from "./lib/floating-tag-and-status-adapter.mjs";
// Import DataModel classes
import * as models from "./data/_module.mjs";
import { setupMistEngineKeyBindings } from "./lib/key-binding.mjs";
import { setupConfiguration } from "./lib/configuration.mjs";
import { setupHooks } from "./lib/hooks.mjs";
import { RollConfirmation } from "./lib/roll-confirmation.mjs";
import { registerMigrationSettings, needsMigration, migrateWorld } from "./migration.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.mistenginefvtt = {
    MistEngineActor,
    MistEngineItem,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.MIST_ENGINE = MIST_ENGINE;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d20 + @abilities.dex.mod",
    decimals: 2,
  };

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = MistEngineActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    character: models.MistEngineCharacter,
    "litm-character": models.MistEngineCharacter,
    "litm-npc": models.MistEngineNPC,
    "litm-fellowship-themecard": models.MistEngineActorFellowshipThemecard,
    "litm-journey": models.MistEngineActorJourney
  };

  CONFIG.Item.documentClass = MistEngineItem;
  CONFIG.Item.dataModels = {
    item: models.MistEngineItem,
    feature: models.MistEngineFeature,
    spell: models.MistEngineSpell,
    themebook: models.MistEngineItemThemeBook,
    backpack: models.MistEngineItemBackpack,
    "scene-data": models.MistEngineSceneData,
    quintessence: models.MistEngineQuintessence,
    shortchallenge: models.MistEngineShortChallenge,
    themekit: models.MistEngineThemekit,
    "challenge-addon": models.MistEngineChallengeAddon
  };

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);

  foundry.documents.collections.Actors.registerSheet(
    "mist-engine-fvtt",
    MistEngineLegendInTheMistCharacterSheet,
    {
      makeDefault: true,
      types: ["litm-character"],
      label: "MIST_ENGINE.SheetLabels.Actor",
    }
  );

  foundry.documents.collections.Actors.registerSheet("mist-engine-fvtt", MistEngineLegendInTheMistNpcSheet, {
    makeDefault: true,
    types: ["litm-npc"],
    label: "MIST_ENGINE.SheetLabels.Actor",
  });

  foundry.documents.collections.Actors.registerSheet("mist-engine-fvtt", MistEngineLegendInTheMistJourneySheet, {
    makeDefault: true,
    types: ["litm-journey"],
    label: "MIST_ENGINE.SheetLabels.Journey",
  });

  foundry.documents.collections.Actors.registerSheet(
    "mist-engine-fvtt",
    MistEngineLegendInTheMistFellowshipThemecard,
    {
      makeDefault: true,
      types: ["litm-fellowship-themecard"],
      label: "MIST_ENGINE.SheetLabels.FellowshipThemecard",
    }
  );

  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("mist-engine-fvtt", MistEngineItemSheet, {
    makeDefault: true,
    label: "MIST_ENGINE.SheetLabels.Item",
  });

  foundry.documents.collections.Items.registerSheet("mist-engine-fvtt", MistEngineShortChallengeItemSheet, {
    makeDefault: true,
    types: ["shortchallenge"],
    label: "MIST_ENGINE.SheetLabels.ShortChallengeItem",
  });

  foundry.documents.collections.Items.registerSheet("mist-engine-fvtt", MistEngineItemThemekitSheet, {
    makeDefault: true,
    types: ["themekit"],
    label: "MIST_ENGINE.SheetLabels.ThemekitItem",
  });

  foundry.documents.collections.Items.registerSheet("mist-engine-fvtt",MistEngineThemebookItemSheet,{
    makeDefault: true,
    types: ["themebook"],
    label: "MIST_ENGINE.SheetLabels.Themebook",
  })

  foundry.documents.collections.Items.registerSheet("mist-engine-fvtt", MistEngineChallengeAddonItemSheet, {
    makeDefault: true,
    types: ["challenge-addon"],
    label: "MIST_ENGINE.SheetLabels.ChallengeAddon",
  });

  // Use our own journal sheet so journals open at a wider default width. The
  // core JournalEntrySheet stays registered as a selectable fallback.
  foundry.documents.collections.Journal.registerSheet("mist-engine-fvtt", MistEngineJournalEntrySheet, {
    makeDefault: true,
    label: "MIST_ENGINE.SheetLabels.JournalEntry",
  });


  setupMistEngineKeyBindings();
  setupConfiguration();
  registerMigrationSettings();

  if(game.settings.get("mist-engine-fvtt", "disableCustomDice") !== true) {
    CONFIG.Dice.terms["6"] = D6ToD12;
  }

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

registerHandlebarHelpers();

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
  if (needsMigration()) await migrateWorld();

  RollConfirmation.setup();

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));

  $(document).on(
    "dragstart",
    "mark.draggable",
    (event) => {
      event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(event.currentTarget.dataset));
    }
  );

  globalThis.MistSceneApp = MistSceneApp;
  globalThis.HowToPlayApp = HowToPlayApp;
  globalThis.ChangelogApp = ChangelogApp;

  ChangelogApp.checkAndShow();
});

setupHooks();

// Intercept journal page render and replace text tags/statuses/limits with draggale marks
/*Hooks.on("renderJournalEntrySheet", (_app, html) => {
  html.querySelectorAll(".journal-page-content").forEach((page) => {
    const matches = [...page.innerHTML.matchAll(/\[(.*?)\]/g)].map(m => m[1])
    matches.forEach(tag => {
      page.innerHTML = page.innerHTML.replace(`[${tag}]`, makeStyledTagOrStatusText(tag));
    });
  });
});*/

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== "Item") return;
  if (!data.uuid.includes("Actor.") && !data.uuid.includes("Token.")) {
    return ui.notifications.warn(
      "You can only create macro buttons for owned Items"
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.mistenginefvtt.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "mist-engine-fvtt.itemMacro": true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: "Item",
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}

class D6ToD12 extends foundry.dice.terms.Die {
  constructor(termData) {
    super({ ...termData, faces: 12 });
  }

  static DENOMINATION = "6";
}



Hooks.once('diceSoNiceReady', (dice3d) => {
  if (game.settings.get("mist-engine-fvtt", "disableCustomDice") !== true) {
    
    console.log("Registering Legend in the Mist Dice So Nice Dice");
    dice3d.addSystem({ id: "mist-engine-fvtt", name: "Legend in the Mist", group: "Legend in the Mist" });

    dice3d.addDicePreset({
      system: "mist-engine-fvtt",
      type: "d6",
      labels: ['1', '2', '3', '4', '5', '/systems/mist-engine-fvtt/assets/dice/dice_greatness_color.png',
        '/systems/mist-engine-fvtt/assets/dice/dice_raven_color.png', '5', '4', '3', '2', '1'],
      bumpMaps: [, , , , , '/systems/mist-engine-fvtt/assets/dice/dice_greatness_bump.png',
        '/systems/mist-engine-fvtt/assets/dice/dice_raven_bump.png', , , , ,],
      colorset: "litm-default",
    }, "d12");

    dice3d.addColorset({
      name: "litm-default",
      description: "Legend in the Mist Default",
      category: "Legend in the Mist",
      foreground: ["#000000", "#000000", "#000000", "#000000"],
      background: ["#e9e1d6", "#74774fff", "#5c7979ff", "#c9ac89"],
      outline: ["#000000", "#000000", "#000000", "#000000"],
      edge: ["#f8f3eb", "#c3c3a0ff", "#7ea590ff", "#e9dcbc"],
      texture: "wood",
      material: "stone",
      font: "Times",
      visibility: "visible",
    });
  }
});

