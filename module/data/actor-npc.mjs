import MistEngineActorBase from "./base-actor.mjs";

export default class MistEngineNPC extends MistEngineActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.difficulty = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    // Roles are a list of short descriptive labels (e.g. "Aggressor", "Pursuer").
    schema.roles = new fields.ArrayField(new fields.StringField(), { required: false, initial: [] });

    // Names of Challenge Add-ons applied to this Challenge (issue #55), used to
    // warn before re-applying the same add-on.
    schema.appliedAddons = new fields.ArrayField(new fields.StringField(), { required: false, initial: [] });

    schema.mightyAspects = new fields.ArrayField(
      new fields.SchemaField({
        level: new fields.StringField({ initial: "origin" }), // origin/adventure/greatness, or a custom level
        aspect: new fields.StringField(),
        mightIcon: new fields.StringField({ blank: true, initial: "" }) // "" | adventure | greatness | origin
      }),
      { min: 0, required: false }
    )

    schema.limits = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        value: new fields.StringField(),
        consequence: new fields.StringField()
      }),
      { min: 0, required: false }
    )

    schema.secrets = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        description: new fields.StringField(),
      }),
      { min: 0, required: false }
    )

    schema.specialFeatures = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        description: new fields.StringField()
      }),
      { min: 0, required: false }
    )

    schema.threatsAndConsequences = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField(),
        description: new fields.StringField(),
        list: new fields.ArrayField(new fields.StringField())
      }),
      { min: 0, required: false }
    );
    return schema
  }

  /** Migrate legacy `roles` stored as a comma-separated string into a list. */
  static migrateData(source) {
    if (typeof source?.roles === "string") {
      source.roles = source.roles.split(",").map(r => r.trim()).filter(Boolean);
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // Overcoming a Challenge (Core Book p. 29): a Challenge is overcome when
    // it carries a status of a Limit's tier or higher. Limit and status names
    // rarely match exactly ("wound" vs "wounded"), so we compare word stems.
    const stem = (s) => String(s ?? "").trim().toLowerCase().slice(0, 4);
    const statuses = this.floatingTagsAndStatuses ?? [];
    (this.limits ?? []).forEach(limit => {
      const tier = parseInt(limit.value);
      const limitStem = stem(limit.name);
      limit.reached = Number.isFinite(tier) && tier > 0 && limitStem.length > 0 &&
        statuses.some(t => (t.value ?? 0) >= tier && stem(t.name) === limitStem);
    });
    this.isOvercome = (this.limits ?? []).some(l => l.reached);
  }
}