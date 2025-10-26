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
}