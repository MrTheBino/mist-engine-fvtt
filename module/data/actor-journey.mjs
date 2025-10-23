import MistEngineActorBase from "./base-actor.mjs";

export default class MistEngineNPC extends MistEngineActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.tags = new fields.StringField({ required: true, blank: true });

    schema.generalConsequences = new fields.SchemaField({
        name: new fields.StringField(),
        description: new fields.StringField(),
        list: new fields.ArrayField(new fields.StringField())
      });
      
    return schema
  }

  prepareDerivedData() {
    super.prepareDerivedData();
  }
}