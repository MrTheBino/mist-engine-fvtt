import MistEngineActorBase from "./base-actor.mjs";

export default class MistEngineCharacter extends MistEngineActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.notes = new fields.StringField({ blank: true, default: "" });

    schema.promises = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
  
    schema.actorSharedSingleThemecardId = new fields.StringField({ blank: true, default: "" });

    schema.fellowships = new fields.ArrayField(
      new fields.SchemaField({
        companion: new fields.StringField(),
        relationshipTag: new fields.StringField(),
        selected: new fields.BooleanField({ default: false }),
        scratched: new fields.BooleanField({ default: false }),
      }),
      { min: 0, required: false }
    )

    // Ordered layout of the cards shown in the Main/Other tab grid.
    // Each entry references a card by a stable key and the tab it lives in.
    // Array order (within a tab) is the display order. Self-healed on render,
    // so an empty/partial layout still renders correctly.
    //   key: "themebook:<itemId>" | "backpack" | "quintessences" | "fellowships" | "fellowship-themecard"
    //   tab: "main" | "other"
    schema.cardLayout = new fields.ArrayField(
      new fields.SchemaField({
        key: new fields.StringField({ required: true, blank: false }),
        tab: new fields.StringField({ required: true, blank: false, initial: "main" }),
      }),
      { required: false, initial: [] }
    )

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    // Heroes are overcome at tier 5 (Core Book p. 29): a negative status of
    // tier 5+ takes them out of the scene.
    this.isOvercome = (this.floatingTagsAndStatuses ?? []).some(t => t.isStatus && !t.positive && (t.value ?? 0) >= 5);
  }
}