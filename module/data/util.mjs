export function buildFloatingTagsAndStatuses(){
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    
    schema.floatingTagsAndStatusesEditable = new fields.BooleanField({ initial: false })
    schema.floatingTagsAndStatuses = new fields.ArrayField(new fields.SchemaField({
      name: new fields.StringField({ blank: true }),
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      isStatus: new fields.BooleanField({ initial: false }),
      burned: new fields.BooleanField({ initial: false }),
      toBurn: new fields.BooleanField({ initial: false }),
      selected: new fields.BooleanField({ initial: false }),
      markings: new fields.ArrayField(new fields.BooleanField({ initial: false }), { min: 6, max: 6, initial: Array(6).fill(false) })
    }));

    return schema;
}