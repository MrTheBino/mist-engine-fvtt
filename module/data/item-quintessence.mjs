import MistEngineItemBase from "./base-item.mjs";

export default class MistEngineQuintessence extends MistEngineItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    return schema;
  }

  prepareDerivedData() {
  }
}