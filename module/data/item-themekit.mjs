import MistEngineItemBase from "./base-item.mjs";
import {buildPowerTag,buildSpecialImprovements} from "./util.mjs";
export default class MistEngineItemBackpack extends MistEngineItemBase {

    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = {};

        const requiredInteger = { required: true, nullable: false, integer: true };

        schema.themekit_type = new fields.StringField({ blank: true });
        
        schema.quest = new fields.StringField({ blank: true });
        schema.story = new fields.StringField({ blank: true });

        schema.powertags = new fields.ArrayField(
            buildPowerTag(),
            { min: 0, required: false }
        );

        schema.weaknesstags = new fields.ArrayField(
            buildPowerTag(),
            { min: 0, required: false }
        );

        foundry.utils.mergeObject(schema, buildSpecialImprovements());
        return schema;
    }
}