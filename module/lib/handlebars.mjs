import { textWithTags } from "./tag-status-text-helper.mjs";

export function registerHandlebarHelpers() {
  Handlebars.registerHelper("powerTagQuestionPlaceholder", function (index, str) {
    let letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[index];
    let qText = str;
    if (!qText || qText.length <= 0) {
      qText = "PowerTag Question";
    }
    return `${letter} - ${qText}`;
  });

  Handlebars.registerHelper("weaknessTagQuestionPlaceholder", function (index, str) {
    let letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[index];
    let qText = str;
    if (!qText || qText.length <= 0) {
      qText = "Weakness Question";
    }
    return `${letter} - ${qText}`;
  });

  Handlebars.registerHelper('questionIndexToLetter', function (n) {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[n];
  });

  Handlebars.registerHelper('isRenderBlockAllowed', function (showOnlyGM) {
    if (showOnlyGM) {
      return game.user.isGM;
    }
    return true;
  });

  Handlebars.registerHelper('simpleFormatText', function (str) {
    // we convert \n to <br/> for simple text formatting in the sheets
    if (!str) return "";
    str = textWithTags(str);
    return str.replace(/\n/g, "<br/>");
  });

  Handlebars.registerHelper('storyTagDraggableData', function (storytag, source) {
    if (source !== "backpack") {
      return "";
    }
    return `draggable="true" data-type="${source}" data-name="${storytag.name}"`;
  });

  Handlebars.registerHelper("isCustomJSONImportEnabled", function (_n) {
    let t = game.settings.get("mist-engine-fvtt", "showCustomJSONImport") === true;
    console.log("Checking if custom JSON import is enabled: ", t);
    return t;
  });

  Handlebars.registerHelper('npcLimitValue', function (n) {
    if (n === undefined || n === null || parseInt(n) <= 0 || (typeof n === "string" && n.trim().length === 0)) {
      return "-";
    }
    return n;
  });

  Handlebars.registerHelper('indexPlusOne', function (n) {
    return parseInt(n) + 1;
  });

  Handlebars.registerHelper('activeTiersLabel', function (markings) {
    if (!Array.isArray(markings)) return '';
    return markings
      .map((active, i) => active ? i + 1 : null)
      .filter(Boolean)
      .join(',');
  });

  Handlebars.registerHelper('itemTooltipHTML', function (item) {
    let t = textWithTags(item.system.description);
    // replace " with ' to avoid issues with HTML attributes
    t = t.replace(/"/g, "'");
    return `<strong>${item.name}</strong><br/>${t}`;
  });

  Handlebars.registerHelper('tooltipHTML', function (name, desc) {
    let t = textWithTags(desc);
    // replace " with ' to avoid issues with HTML attributes
    t = t.replace(/"/g, "'");
    return `<strong>${name}</strong><br/>${t}`;
  });

  // If you need to add Handlebars helpers, here is a useful example:
  Handlebars.registerHelper("toLowerCase", function (str) {
    return str.toLowerCase();
  });

  Handlebars.registerHelper("tagFilled", function (str) {
    if (str && str.trim().length > 0) {
      return true;
    }
    return false;
  });

  Handlebars.registerHelper("tagFilledAndNotPlanned", function (tag) {
    if (tag.name && tag.name.trim().length > 0 && !tag.planned) {
      return true;
    }
    return false;
  });

  Handlebars.registerHelper("notEmpty", function (str) {
    if (str && str.trim().length > 0) {
      return true;
    }
    return false;
  });

  Handlebars.registerHelper("floatingTagStatusTitleHelper", function (entity) {
    if (entity.isStatus) {
      return `${entity.name}-${entity.value} - ${entity.positive ? "Positive" : "Negative"} Status`;
    } else {
      return `${entity.name} - ${entity.positive ? "Positive" : "Negative"} Tag`;
    }
  });

  Handlebars.registerHelper("times", function (n, block) {
    var accum = "";
    for (var i = 0; i < n; ++i) accum += block.fn(i);
    return accum;
  });

  Handlebars.registerHelper("textWithTags", function (str) {
    return textWithTags(str);
  });
}
