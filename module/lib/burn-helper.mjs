export async function clearOtherBurns(actor, keepDoc, keepKey, keepIndex) {
    if (!actor) return;
    const updates = [];

    const clear = (doc, key) => {
        if (!doc) return;
        const arr = foundry.utils.getProperty(doc, key);
        if (!Array.isArray(arr) || !arr.length) return;
        let changed = false;
        const next = arr.map((tag, i) => {
            const keep = doc === keepDoc && key === keepKey && i === keepIndex;
            if (tag.toBurn && !keep) {
                changed = true;
                return { ...tag, toBurn: false };
            }
            return tag;
        });
        if (changed) updates.push(doc.update({ [key]: next }));
    };

    for (const item of actor.items) {
        if (item.type === "themebook") clear(item, "system.powertags");
        else if (item.type === "backpack") clear(item, "system.items");
    }
    const themecard = game.actors.get(actor.system.actorSharedSingleThemecardId);
    if (themecard) clear(themecard, "system.powertags");

    await Promise.all(updates);
}
