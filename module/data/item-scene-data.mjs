import MistEngineItemBase from "./base-item.mjs";
import { buildFloatingTagsAndStatuses } from "./util.mjs";

export default class MistEngineSceneData extends MistEngineItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.sceneKey = new fields.StringField({ required: true, blank: true });
    foundry.utils.mergeObject(schema, buildFloatingTagsAndStatuses());


    schema.diceRollTagsStatus = new fields.ArrayField(new fields.SchemaField({
      name: new fields.StringField({ required: true, blank: false }),
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      positive: new fields.BooleanField({ initial: false }),
      isStatus: new fields.BooleanField({ initial: false })
    }), { required: true, nullable: false, initial: [] });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.hasDiceRollModifiers = (this.diceRollTagsStatus.length > 0);
  }
}