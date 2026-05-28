import MistEngineActorBase from "./base-actor.mjs";

export default class MistEngineJourney extends MistEngineActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.tags = new fields.StringField({ required: true, blank: true });
    schema.role = new fields.StringField({ required: true, blank: true });
    schema.notes = new fields.StringField({ required: true, blank: true });
    schema.customBackground = new fields.StringField({
      required: true,
      blank: true,
      initial: "systems/mist-engine-fvtt/assets/journey/alone-in-the-woods_background.webp"
    });

    schema.customFontColor = new fields.StringField({ required: false, initial: "#ffffff" });

    schema.generalConsequences = new fields.ArrayField(new fields.StringField());
      
    return schema
  }

  prepareDerivedData() {
    super.prepareDerivedData();
  }
}