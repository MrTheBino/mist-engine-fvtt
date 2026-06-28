import MistEngineItemBase from "./base-item.mjs";
import { buildFloatingTagsAndStatuses } from "./util.mjs";

export default class MistEngineChallengeAddon extends MistEngineItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    // How much this add-on raises the Challenge's rating when joined
    schema.ratingIncrease = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });

    // Roles this add-on contributes (e.g. "Mystery", "Sapper").
    schema.roles = new fields.ArrayField(new fields.StringField(), { required: false, initial: [] });

    // Tags & statuses 
    Object.assign(schema, buildFloatingTagsAndStatuses());

    schema.limits = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        value: new fields.StringField(),
        consequence: new fields.StringField()
      }),
      { min: 0, required: false }
    );

    schema.secrets = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        description: new fields.StringField()
      }),
      { min: 0, required: false }
    );

    schema.specialFeatures = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        description: new fields.StringField()
      }),
      { min: 0, required: false }
    );

    schema.threatsAndConsequences = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        description: new fields.StringField(),
        list: new fields.ArrayField(new fields.StringField())
      }),
      { min: 0, required: false }
    );

    return schema;
  }
}
