/**
 * ChallengeAddonAdapter
 * finaly, we're going the last mile...
 *
 * Merges a `challenge-addon` item's fields onto a Challenge (`litm-npc` actor),
 * following the merge rules from the ticket / Vol. II "Challenge Add-ons":
 *  - name:            "Base (Addon)"
 *  - difficulty:      base + addon.ratingIncrease
 *  - roles:           union, de-duplicated (case-insensitive)
 *  - limits:          merge by name — "-"/blank defers to the other side, a
 *                     literal 0 forces 0, otherwise the higher; newest non-empty
 *                     consequence wins on duplicates
 *  - tags & statuses: de-dup by name, keep the higher status value
 *  - threats / secrets / special fetures: appended
 */
export class ChallengeAddonAdapter {

    static async applyToChallenge(npc, addon) {
        if (!npc || npc.type !== "litm-npc") {
            ui.notifications?.warn(game.i18n.localize("MIST_ENGINE.CHALLENGE_ADDON.OnlyOnChallenges"));
            return;
        }
        const a = addon.system;
        const n = npc.system;
        const addonName = (addon.name ?? "").replace(/\s*\+\s*$/, "").trim() || addon.name;

        // Confirm before merging; warn extra if this add-on was already applied.
        const applied = n.appliedAddons ?? [];
        const alreadyApplied = applied.includes(addonName);
        const content = alreadyApplied
            ? game.i18n.format("MIST_ENGINE.CHALLENGE_ADDON.ConfirmReapply", { name: addonName, challenge: npc.name })
            : game.i18n.format("MIST_ENGINE.CHALLENGE_ADDON.ConfirmApply", { name: addonName, challenge: npc.name });
        const proceed = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize("MIST_ENGINE.CHALLENGE_ADDON.ConfirmTitle") },
            content,
            rejectClose: false,
            modal: true
        });
        if (!proceed) return;

        const update = {
            name: `${npc.name} (${addonName})`,
            "system.difficulty": (n.difficulty ?? 0) + (a.ratingIncrease ?? 0),
            "system.roles": this._mergeRoles(n.roles ?? [], a.roles ?? []),
            "system.appliedAddons": [...applied, addonName],
        };

        if ((a.limits ?? []).length) {
            update["system.limits"] = this._mergeLimits(n.limits ?? [], a.limits);
        }
        if ((a.floatingTagsAndStatuses ?? []).length) {
            update["system.floatingTagsAndStatuses"] = this._mergeTagsStatuses(n.floatingTagsAndStatuses ?? [], a.floatingTagsAndStatuses);
        }
        if ((a.threatsAndConsequences ?? []).length) {
            update["system.threatsAndConsequences"] = [...(n.threatsAndConsequences ?? []), ...a.threatsAndConsequences];
        }
        if ((a.secrets ?? []).length) {
            update["system.secrets"] = [...(n.secrets ?? []), ...a.secrets];
        }
        if ((a.specialFeatures ?? []).length) {
            update["system.specialFeatures"] = [...(n.specialFeatures ?? []), ...a.specialFeatures];
        }

        await npc.update(update);
        ui.notifications?.info(game.i18n.format("MIST_ENGINE.CHALLENGE_ADDON.Applied", { addon: addonName, challenge: npc.name }));
    }

    static _mergeRoles(base, add) {
        const seen = new Map(); // lowercase key -> original casing
        for (const r of [...base, ...add]) {
            const key = String(r).trim().toLowerCase();
            if (key && !seen.has(key)) seen.set(key, String(r).trim());
        }
        return [...seen.values()];
    }

    /** Limits stored as { name, value(String), consequence }. Merge by name. */
    static _mergeLimits(base, add) {
        const result = base.map(l => ({ ...l }));
        const idxByName = new Map(result.map((l, i) => [String(l.name).trim().toLowerCase(), i]));
        for (const incoming of add) {
            const key = String(incoming.name).trim().toLowerCase();
            if (idxByName.has(key)) {
                const existing = result[idxByName.get(key)];
                existing.value = this._mergeLimitValue(existing.value, incoming.value);
                if (incoming.consequence && incoming.consequence.trim()) existing.consequence = incoming.consequence;
            } else {
                result.push({ ...incoming });
                idxByName.set(key, result.length - 1);
            }
        }
        return result;
    }

    static _mergeLimitValue(a, b) {
        const pa = this._parseLimit(a), pb = this._parseLimit(b);
        if (pa === null && pb === null) return "-";
        if (pa === null) return String(pb);
        if (pb === null) return String(pa);
        if (pa === 0 || pb === 0) return "0";
        return String(Math.max(pa, pb));
    }

    /** @returns {number|null} null = "no limit" ("-"/blank), else the integer. */
    static _parseLimit(v) {
        if (v === undefined || v === null) return null;
        const s = String(v).trim();
        if (s === "" || s === "-") return null;
        const n = parseInt(s, 10);
        return Number.isNaN(n) ? null : n;
    }

    /** De-dup tags/statuses by name; for statuses keep the higher value. */
    static _mergeTagsStatuses(base, add) {
        const result = base.map(t => ({ ...t }));
        const idxByName = new Map(result.map((t, i) => [String(t.name).trim().toLowerCase(), i]));
        for (const incoming of add) {
            const key = String(incoming.name).trim().toLowerCase();
            if (!key) continue;
            if (idxByName.has(key)) {
                const existing = result[idxByName.get(key)];
                if (incoming.isStatus || existing.isStatus) {
                    existing.isStatus = true;
                    existing.value = Math.max(existing.value ?? 0, incoming.value ?? 0);
                }
            } else {
                result.push({ ...incoming });
                idxByName.set(key, result.length - 1);
            }
        }
        return result;
    }
}
