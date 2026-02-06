export function setupConfiguration() {

    // game.settings.get("mist-engine-fvtt", "mightUsageEnabled");
    game.settings.register("mist-engine-fvtt", "mightUsageEnabled", {
    name: "Might Usage Enabled",
    hint: "Enable or disable the usage of Might in the game.",
    scope: "world", 
    config: true,   
    type: Boolean,
    default: true
  });

  game.settings.register("mist-engine-fvtt", "disableCustomDice", {
        name: "Disable LiTM Custom Dice",
        hint: "Disable the use of custom dice in Legend In The Mist. This will revert to using standard dice rolls.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("mist-engine-fvtt", "disableCharacterHoverTooltip", {
        name: "Disable Character Hover Tooltip (GM Only)",
        hint: "Disable the character hover power tag tooltip for GMs",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });
}