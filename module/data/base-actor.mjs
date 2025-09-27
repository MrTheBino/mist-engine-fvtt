import MistEngineDataModel from "./base-model.mjs";
import {buildFloatingTagsAndStatuses} from "./util.mjs";

export default class MistEngineActorBase extends MistEngineDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.biography = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.editMode = new fields.BooleanField({ initial: false })
    schema.shortDescription = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields

    foundry.utils.mergeObject(schema, buildFloatingTagsAndStatuses());

    return schema;
  }

  prepareDerivedData() {
    this.floatingTagsAndStatuses.forEach(tag =>{
      let max = 0;
      for(let i = 0; i < tag.markings.length; i++){
        if(tag.markings[i]) max = i+1;
      }
      tag.value = max;
    });
  }
}