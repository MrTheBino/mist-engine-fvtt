// Shared rules for the scene's story themes (themebooks dragged onto the
// Scene App's Story Themes tab, uuids kept in scene-data.system.storyThemeIds).
// The Scene App and the read-only scene tags overlay both read through here,
// so the two can never disagree on which themes and tags are shown.

/** Is this item a story theme? A themebook flagged isStoryTheme. */
export function isStoryThemeItem(item) {
    return item?.type === "themebook" && item.system.options?.isStoryTheme === true;
}

/**
 * Resolve story theme uuids, dropping stale ones (deleted items) and
 * themebooks that have been un-flagged since they were assigned.
 * @param {string[]} uuids
 * @returns {Promise<Item[]>}
 */
export async function resolveStoryThemes(uuids) {
    const resolved = await Promise.all((uuids ?? []).map(uuid => fromUuid(uuid).catch(() => null)));
    return resolved.filter(isStoryThemeItem);
}

/**
 * The tags of a story theme worth showing: named, not planned, and not
 * expired — expired tags grant no Power (p. 179), same as in the dice roll.
 * @param {object[]} list  system.powertags or system.weaknesstags
 * @returns {object[]}
 */
export function visibleStoryThemeTags(list) {
    return (list ?? []).filter(t => t.name?.trim() && !t.planned && !t.expired);
}

/**
 * Drop a deleted story theme from every scene-data item that references it.
 * Only the active GM writes, so a deletion seen by several clients results in
 * a single update per scene-data item.
 * @param {Item} item  the deleted item
 */
export async function pruneDeletedStoryTheme(item) {
    if (item?.type !== "themebook" || game.user !== game.users.activeGM) return;
    const uuid = item.uuid;
    for (const sd of game.items.filter(i => i.type === "scene-data")) {
        const ids = sd.system.storyThemeIds ?? [];
        if (ids.includes(uuid)) await sd.update({ "system.storyThemeIds": ids.filter(u => u !== uuid) });
    }
}
