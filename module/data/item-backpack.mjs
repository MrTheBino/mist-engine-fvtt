import MistEngineItemBase from "./base-item.mjs";

export default class MistEngineItemBackpack extends MistEngineItemBase {

    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = {};

        const requiredInteger = { required: true, nullable: false, integer: true };


        schema.items = new fields.ArrayField(
            new fields.SchemaField({
                name: new fields.StringField(),
                selected: new fields.BooleanField()
            }),
            { min: 0, required: false }
        )

        return schema;
    }
}