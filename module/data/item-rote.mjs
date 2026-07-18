import MistEngineItemBase from "./base-item.mjs";

/**
 * A Rote (Core Book p. 98): the outline of a specific magic ability such as a
 * technique, spell, maneuver, or recipe. Its title works as a tag — a Hero must
 * possess the rote to perform it, and a selected rote joins the dice roll as a
 * positive tag (source "rote").
 */
export default class MistEngineItemRote extends MistEngineItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.practitioners = new fields.StringField({ blank: true });
    // how the rote is resolved: Simple, Quick or Detailed action
    schema.actionType = new fields.StringField({ initial: "quick", choices: ["simple", "quick", "detailed"] });
    // example tags that help (power) / hinder (weakness) performing the rote
    schema.powertags = new fields.ArrayField(
        new fields.SchemaField({ name: new fields.StringField({ blank: true }) }),
        { min: 0, required: false }
    );
    schema.weaknesstags = new fields.ArrayField(
        new fields.SchemaField({ name: new fields.StringField({ blank: true }) }),
        { min: 0, required: false }
    );
    // how Power should be spent on a success (Weaken/Advance/Influence, extra feats)
    schema.success = new fields.HTMLField({ blank: true });
    // typical consequences for this rote
    schema.consequences = new fields.HTMLField({ blank: true });
    // selected for the next dice roll (like a tag)
    schema.selected = new fields.BooleanField({ initial: false });

    return schema;
  }
}
