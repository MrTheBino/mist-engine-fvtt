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
      positive: new fields.BooleanField({ initial: false }),
      markings: new fields.ArrayField(new fields.BooleanField({ initial: false }), { min: 6, max: 6, initial: Array(6).fill(false) })
    }));

    return schema;
}

export function buildSpecialImprovements(){
  const fields = foundry.data.fields;
  const requiredInteger = { required: true, nullable: false, integer: true };
  const schema = {};

  // no max value for the array, later on we will add functionality to add more manually
  schema.specialImprovements = new fields.ArrayField(new fields.SchemaField({
            name: new fields.StringField({ blank: true }),
            active: new fields.BooleanField({ initial: false }),
            description: new fields.StringField({ blank: true })
        }),{ min: 5, initial: Array(5).fill({name: "", active: false, description: ""}) });

  return schema;
}