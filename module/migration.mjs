/**
 * Migration helpers for mist-engine-fvtt.
 *
 * Current migration: powertag1-10 / weaknesstag1-4  →  powertags[] / weaknesstags[]
 */

const SYSTEM_ID = "mist-engine-fvtt";

/** Setting key that stores the last successfully migrated system version. */
const MIGRATION_VERSION_KEY = "systemMigrationVersion";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Collect a numbered tag series from raw system data into a plain array,
 * skipping entries where both name and question are empty.
 *
 * @param {object} sys   - item.system (plain object from _source or live data)
 * @param {string} prefix - e.g. "powertag" or "weaknesstag"
 * @param {number} count  - how many numbered slots exist (10 / 4)
 * @returns {{ name:string, question:string, burned:boolean, toBurn:boolean, planned:boolean, selected:boolean }[]}
 */
function collectNumberedTags(sys, prefix, count) {
    const result = [];
    for (let i = 1; i <= count; i++) {
        const tag = sys[`${prefix}${i}`];
        console.log(`Collecting ${prefix}${i}:`, tag);
        if (!tag || (!tag.name?.trim() && !tag.question?.trim())) continue;
        result.push({
            name:     tag.name     ?? "",
            question: tag.question ?? "",
            burned:   tag.burned   ?? false,
            toBurn:   tag.toBurn   ?? false,
            planned:  tag.planned  ?? false,
            selected: tag.selected ?? false,
        });
    }
    return result;
}

/**
 * Build an update object for a single themebook Item, or return null when
 * no migration is needed (already migrated, or simply no data to move).
 *
 * @param {Item} item
 * @returns {{ _id: string, "system.powertags": object[], "system.weaknesstags": object[] } | null}
 */
function buildThemebookUpdate(item) {
    if (item.type !== "themebook") return null;

    const sys = item.system;

    // If the new arrays already have entries the item was already migrated.
    if (sys.powertags?.length > 0 || sys.weaknesstags?.length > 0) return null;

    const powertags    = collectNumberedTags(sys, "powertag",    10);
    const weaknesstags = collectNumberedTags(sys, "weaknesstag",  4);

    if (!powertags.length && !weaknesstags.length) return null;

    return {
        _id: item.id,
        "system.powertags":    powertags,
        "system.weaknesstags": weaknesstags,
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register the world setting used to gate migration.
 * Call this inside the "init" hook.
 */
export function registerMigrationSettings() {
    game.settings.register(SYSTEM_ID, MIGRATION_VERSION_KEY, {
        name:    "System Migration Version",
        scope:   "world",
        config:  false,
        type:    String,
        default: "0",
    });
}

/**
 * Return true when the current world needs to run migrations.
 * Should be called by the GM inside the "ready" hook.
 */
export function needsMigration() {
    if (!game.user.isGM) return false;
    const lastMigrated = game.settings.get(SYSTEM_ID, MIGRATION_VERSION_KEY);
    return foundry.utils.isNewerVersion(game.system.version, lastMigrated);
}

/**
 * Execute all pending migrations then record the current version.
 * Safe to call multiple times — each step is idempotent.
 */
export async function migrateWorld() {
    const version = game.system.version;
    console.log(`Starting migration to v${version}`);
    ui.notifications.info(`Migrating world data to v${version}…`);

    await _migrateActorItems();
    await _migrateFellowshipActors();
    await _migrateWorldItems();
    await _migrateCompendiums();

    await game.settings.set(SYSTEM_ID, MIGRATION_VERSION_KEY, version);
    console.log(`Migration complete (v${version})`);
    ui.notifications.info(`Migration to v${version} complete.`);
}

/**
 * Build an update object for a fellowship-themecard actor, or return null when
 * no migration is needed.
 *
 * @param {Actor} actor
 * @returns {{ _id: string, "system.powertags": object[], "system.weaknesstags": object[] } | null}
 */
function buildFellowshipActorUpdate(actor) {
    if (actor.type !== "litm-fellowship-themecard"){
        return null;
    } 
    console.log(`Checking fellowship themecard actor "${actor.name}" for powertag/weaknesstag migration...`);

    const sys = actor.system;

    if (sys.powertags?.length > 0 || sys.weaknesstags?.length > 0){
        console.log(`Fellowship themecard actor "${actor.name}" already has powertags/weaknesstags, skipping migration.`);
        return null;
    }

    console.log("sys.powertag1:", sys.powertag1);
    const powertags    = collectNumberedTags(sys, "powertag",    10);
    const weaknesstags = collectNumberedTags(sys, "weaknesstag",  4);

    if (!powertags.length && !weaknesstags.length) {
        console.log(`Fellowship themecard actor "${actor.name}" has no powertags/weaknesstags, skipping migration.`);
        return null;
    }

    return {
        _id: actor.id,
        "system.powertags":    powertags,
        "system.weaknesstags": weaknesstags,
    };
}

// ---------------------------------------------------------------------------
// Migration steps
// ---------------------------------------------------------------------------

/** Migrate themebook items embedded in every world actor. */
async function _migrateActorItems() {
    for (const actor of game.actors) {
        const updates = actor.items
            .map(buildThemebookUpdate)
            .filter(Boolean);

        if (!updates.length) continue;

        console.log(`Mist Engine | Migrating ${updates.length} themebook(s) on actor "${actor.name}"`);
        await actor.updateEmbeddedDocuments("Item", updates);
        ui.notifications.info(`Mist Engine | Migrated actor "${actor.name}" (${updates.length} themebook(s) updated).`);
    }
}

/** Migrate powertags/weaknesstags on fellowship-themecard actors. */
async function _migrateFellowshipActors() {
    for (const actor of game.actors) {
        const update = buildFellowshipActorUpdate(actor);
        if (!update) continue;

        console.log(`Migrating fellowship themecard actor "${actor.name}"`);
        await actor.update({
            "system.powertags":    update["system.powertags"],
            "system.weaknesstags": update["system.weaknesstags"],
        });
        ui.notifications.info(`Mist Engine | Migrated fellowship themecard "${actor.name}".`);
    }
}

/** Migrate themebook items sitting in the world item directory. */
async function _migrateWorldItems() {
    for (const item of game.items) {
        const update = buildThemebookUpdate(item);
        if (!update) continue;

        console.log(`Migrating world item "${item.name}"`);
        await item.update({
            "system.powertags":    update["system.powertags"],
            "system.weaknesstags": update["system.weaknesstags"],
        });
    }
}

/** Migrate themebook items inside system / module compendium packs. */
async function _migrateCompendiums() {
    for (const pack of game.packs) {
        if (pack.documentName !== "Item" && pack.documentName !== "Actor") continue;

        // Skip locked third-party packs we cannot write to
        if (pack.locked) continue;

        const docs = await pack.getDocuments();

        for (const doc of docs) {
            // Actor pack: migrate embedded items
            if (doc.documentName === "Actor" || doc instanceof Actor) {
                const updates = (doc.items ?? [])
                    .map(buildThemebookUpdate)
                    .filter(Boolean);

                if (updates.length) {
                    console.log(`Mist Engine | Migrating ${updates.length} themebook(s) on compendium actor "${doc.name}" (${pack.collection})`);
                    await doc.updateEmbeddedDocuments("Item", updates);
                }
                continue;
            }

            // Item pack: migrate the item directly
            const update = buildThemebookUpdate(doc);
            if (!update) continue;

            console.log(`Mist Engine | Migrating compendium item "${doc.name}" (${pack.collection})`);
            await doc.update({
                "system.powertags":    update["system.powertags"],
                "system.weaknesstags": update["system.weaknesstags"],
            });
        }
    }
}
