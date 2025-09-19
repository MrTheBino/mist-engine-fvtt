import MistEngineItemBase from "./base-item.mjs";

export default class MistEngineSceneData extends MistEngineItemBase {
    static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.sceneKey = new fields.StringField({ required: true, blank: true }); 
    schema.floatingTagsAndStatusesEditable = new fields.BooleanField({ initial: false })
    schema.floatingTagsAndStatuses = new fields.ArrayField(new fields.SchemaField({
      name: new fields.StringField({ blank: true }),
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      burned: new fields.BooleanField({ initial: false }),
      toBurn: new fields.BooleanField({ initial: false }),
      selected: new fields.BooleanField({ initial: false })
    }));

    return schema;
  }
}