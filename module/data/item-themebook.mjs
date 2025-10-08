import MistEngineItemBase from "./base-item.mjs";
import {buildSpecialImprovements} from "./util.mjs";

export default class MistEngineItemThemeBook extends MistEngineItemBase {

    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = super.defineSchema();

        const requiredInteger = { required: true, nullable: false, integer: true };


        schema.type = new fields.StringField({ blank: true });
        schema.quest = new fields.StringField({ blank: true });

        schema.abandon = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
        schema.improve = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
        schema.milestone = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

        schema.powertag1 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.powertag2 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.powertag3 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.powertag4 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.powertag5 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.powertag6 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.powertag7 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.powertag8 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.powertag9 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.powertag10 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });


        schema.weaknesstag1 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.weaknesstag2 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.weaknesstag3 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        schema.weaknesstag4 = new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            question: new fields.StringField({ blank: true }),
            burned: new fields.BooleanField({ initial: false }),
            toBurn: new fields.BooleanField({ initial: false }),
            planned: new fields.BooleanField({ initial: false }),
            selected: new fields.BooleanField({ initial: false })
        });

        foundry.utils.mergeObject(schema, buildSpecialImprovements());
        return schema;
    }

    prepareDerivedData() {
        this.hasSpecialImprovements = this.specialImprovements.some(imp => imp.active);
    }
}