import MistEngineActorBase from "./base-actor.mjs";

export default class MistEngineCharacter extends MistEngineActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.notes = new fields.StringField({ blank: true, default: "" });

    schema.promises = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.quintessences = new fields.ArrayField(new fields.StringField())
  
    schema.actorSharedSingleThemecardId = new fields.StringField({ blank: true, default: "" });

    schema.fellowships = new fields.ArrayField(
      new fields.SchemaField({
        companion: new fields.StringField(),
        relationshipTag: new fields.StringField(),
        selected: new fields.BooleanField({ default: false })
      }),
      { min: 0, required: false }
    )
    return schema;
  }
}