import { FloatingTagAndStatusAdapter } from "./floating-tag-and-status-adapter.mjs";

export async function importShortChallengeForJSON(item, jsonData) {
    let challenge =
    {
        name: jsonData.title,
        system: {
            shortDescription: jsonData.description || "",
            list: jsonData.entries
        }
    };

    await item.update(challenge);
}

export async function importVignetteForActorJSON(actor, jsonData) {

    let challenge =
    {
        name: jsonData.title,
        type: "shortchallenge",
        system: {
            shortDescription: jsonData.description || "",
            list: jsonData.entries
        }
    };

    await actor.createEmbeddedDocuments("Item", [challenge]);
}

export async function parseChallengeJSON(actor, jsonData) {
    if (jsonData.name) {
        await actor.update({ name: jsonData.name });
        await actor.update({ "prototypeToken.name": jsonData.name });
    }

    if (jsonData.text) {
        await actor.update({ "system.shortDescription": jsonData.text });
    }

    if (jsonData.rating) {
        await actor.update({ "system.difficulty": jsonData.rating });
    }

    if (jsonData.role) {
        await actor.update({ "system.roles": jsonData.role });
    }

    if (jsonData.threats) {
        const threatsAndConsequences = jsonData.threats.map(threat => {
            return {
                name: threat.name || "",
                description: threat.text || "",
                list: threat.consequences || []
            }
        });
        await actor.update({ "system.threatsAndConsequences": threatsAndConsequences });
    }

    // floating tags and statuses 
    if (jsonData.tags) {
        const tags = jsonData.tags.map(tag => {
            tag = tag.replace(/^\[|\]$/g, '');
            tag = tag.replace("/s", '');
            tag = tag.trim();
            return FloatingTagAndStatusAdapter.parseFloatingTagAndStatusString(tag);
        });

        await actor.update({
            "system.floatingTagsAndStatuses": tags
        });
    }

    if (jsonData.limits) {
        const limits = Object.entries(jsonData.limits).map(([name, value]) => {
            return { name, value };
        });
        await actor.update({ "system.limits": limits });
    }

    // special features
    if (jsonData.special_features) {
        const specialFeatures = jsonData.special_features.map(feature => {
            return {
                name: feature.name || "",
                description: feature.text || ""
            }
        });
        await actor.update({ "system.specialFeatures": specialFeatures });
    }
}