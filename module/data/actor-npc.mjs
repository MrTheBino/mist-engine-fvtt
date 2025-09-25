import MistEngineActorBase from "./base-actor.mjs";

export default class MistEngineNPC extends MistEngineActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.difficulty = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });

    schema.limits = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        value: new fields.StringField()
      }),
      { min: 0, required: false }
    )

    schema.tags_and_statuses = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        value: new fields.NumberField(),
        symbol: new fields.StringField(),
      }),
      { min: 0, required: false }
    )

    schema.specialFeatures = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        description: new fields.StringField()
      }),
      { min: 0, required: false }
    )

    schema.threatsAndConsequences = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        description: new fields.StringField(),
        list: new fields.ArrayField(new fields.StringField())
      }),
      { min: 0, required: false }
    );
    return schema
  }

  prepareDerivedData() {
    super.prepareDerivedData();
  }
}