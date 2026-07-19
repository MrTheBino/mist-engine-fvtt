/**
 * Interactive Power spending for the Detailed action (Core Book p. 154).
 *
 * On a successful detailed roll the result chat card offers a "Spend Power"
 * menu with the rulebook effects and their costs. The roller (message author)
 * or the GM allocates Power by clicking; the state lives in the message flag
 * `mist-engine-fvtt.detailedSpend` so it syncs to all clients and survives a
 * reload. The card content is re-rendered from the flag on every change.
 */
const SCOPE = "mist-engine-fvtt";
const FLAG = "detailedSpend";
const TEMPLATE = "systems/mist-engine-fvtt/templates/chat/detailed-result.hbs";

/** Spend menu. `kind:"status"` increments a status tier by 1 per click. */
export const SPEND_OPTIONS = [
    { id: "tag", labelKey: "MIST_ENGINE.DETAILED_SPEND.AddTag", cost: 2, kind: "fixed" },
    { id: "status", labelKey: "MIST_ENGINE.DETAILED_SPEND.Status", cost: 1, kind: "status" },
    { id: "discover", labelKey: "MIST_ENGINE.DETAILED_SPEND.Discover", cost: 1, kind: "fixed" },
    { id: "feat", labelKey: "MIST_ENGINE.DETAILED_SPEND.Feat", cost: 1, kind: "fixed" },
    { id: "singleUse", labelKey: "MIST_ENGINE.DETAILED_SPEND.SingleUse", cost: 1, kind: "fixed" },
];

const spent = (data) => (data.entries ?? []).reduce((s, e) => s + e.cost, 0);
const remaining = (data) => Math.max(0, (data.total ?? 0) - spent(data));

/** Build the render context (static roll parts come straight from the flag). */
function cardContext(data) {
    const rem = remaining(data);
    return {
        ...data,
        canSpend: data.consequenceResult >= 0 && (data.total ?? 0) > 0,
        spentTotal: spent(data),
        remaining: rem,
        options: SPEND_OPTIONS.map(o => ({
            id: o.id,
            label: game.i18n.localize(o.labelKey),
            cost: o.cost,
            kind: o.kind,
            disabled: o.cost > rem,
        })),
        entries: data.entries ?? [],
    };
}

/** Render the detailed card HTML from its flag data. */
export async function renderDetailedCard(data) {
    return foundry.applications.handlebars.renderTemplate(TEMPLATE, cardContext(data));
}

/**
 * Create the detailed result chat message with the spend state stored as a
 * flag. `chatVars` is the render context produced by the dice roll app.
 */
export async function createDetailedMessage(chatVars, speaker) {
    const data = {
        total: chatVars.numPowerTags,
        entries: [],
        // static parts needed to re-render the card
        label: chatVars.label,
        diceRollHTML: chatVars.diceRollHTML,
        positiveTags: chatVars.positiveTags,
        negativeTags: chatVars.negativeTags,
        consequenceResult: chatVars.consequenceResult,
        isCritical: chatVars.isCritical,
        isFumble: chatVars.isFumble,
        numPowerTags: chatVars.numPowerTags,
    };
    const content = await renderDetailedCard(data);
    return ChatMessage.create({ content, speaker, flags: { [SCOPE]: { [FLAG]: data } } });
}

/** Register the render hook that wires up the spend controls. */
export function setup() {
    Hooks.on("renderChatMessageHTML", (message, element) => {
        const data = message.getFlag(SCOPE, FLAG);
        if (!data) return;

        // only the roller (author) or the GM may spend; hide controls for others
        const mayEdit = message.isAuthor || game.user.isGM;
        const spendEl = element.querySelector(".detailed-spend");
        if (spendEl && !mayEdit) spendEl.classList.add("readonly");
        if (!mayEdit) return;

        element.querySelectorAll("[data-spend-option]").forEach(btn => {
            btn.addEventListener("click", () => onSpend(message, btn.dataset.spendOption));
        });
        element.querySelectorAll("[data-spend-undo]").forEach(btn => {
            btn.addEventListener("click", () => onUndo(message, parseInt(btn.dataset.spendUndo)));
        });
    });
}

async function updateCard(message, data) {
    const content = await renderDetailedCard(data);
    await message.update({ content, [`flags.${SCOPE}.${FLAG}`]: data });
}

async function onSpend(message, optionId) {
    const data = foundry.utils.deepClone(message.getFlag(SCOPE, FLAG));
    if (!data) return;
    const opt = SPEND_OPTIONS.find(o => o.id === optionId);
    if (!opt) return;
    if (opt.cost > remaining(data)) return; // cannot overspend

    data.entries = data.entries ?? [];
    if (opt.kind === "status") {
        // merge consecutive status tiers into one growing entry
        const last = data.entries[data.entries.length - 1];
        if (last?.type === "status") {
            last.tier += 1;
            last.cost += 1;
            last.label = game.i18n.format("MIST_ENGINE.DETAILED_SPEND.StatusEntry", { tier: last.tier });
        } else {
            data.entries.push({ type: "status", tier: 1, cost: 1, label: game.i18n.format("MIST_ENGINE.DETAILED_SPEND.StatusEntry", { tier: 1 }) });
        }
    } else {
        data.entries.push({ type: opt.id, cost: opt.cost, label: game.i18n.localize(opt.labelKey) });
    }
    await updateCard(message, data);
}

async function onUndo(message, index) {
    const data = foundry.utils.deepClone(message.getFlag(SCOPE, FLAG));
    if (!data?.entries || index < 0 || index >= data.entries.length) return;
    const entry = data.entries[index];
    if (entry.type === "status" && entry.tier > 1) {
        entry.tier -= 1;
        entry.cost -= 1;
        entry.label = game.i18n.format("MIST_ENGINE.DETAILED_SPEND.StatusEntry", { tier: entry.tier });
    } else {
        data.entries.splice(index, 1);
    }
    await updateCard(message, data);
}
