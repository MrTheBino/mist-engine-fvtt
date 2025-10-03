import MistEngineItemBase from "./base-item.mjs";
import {buildPowerTag} from "./util.mjs";
export default class MistEngineItemBackpack extends MistEngineItemBase {

    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = {};

        const requiredInteger = { required: true, nullable: false, integer: true };


        schema.items = new fields.ArrayField(
            buildPowerTag(),
            { min: 0, required: false }
        );

        return schema;
    }
}