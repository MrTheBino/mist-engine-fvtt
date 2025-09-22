import MistEngineItemBase from "./base-item.mjs";
import {buildFloatingTagsAndStatuses} from "./util.mjs";

export default class MistEngineSceneData extends MistEngineItemBase {
    static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.sceneKey = new fields.StringField({ required: true, blank: true }); 
    foundry.utils.mergeObject(schema, buildFloatingTagsAndStatuses());

    return schema;
  }
}