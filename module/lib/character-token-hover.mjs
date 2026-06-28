
let ctrlHeld = false;
const hoveredTokens = new Set();

function ensureOverlay(element_id) {
    let el = document.getElementById(element_id);
    if (el) return el;

    el = document.createElement("div");
    el.id = element_id;
    el.style.position = "fixed";
    el.style.zIndex = 1000;
    el.style.display = "none";
    el.style.minWidth = "600px";
    el.style.maxWidth = "600px";
    el.style.pointerEvents = "none";
    el.style.padding = "8px 10px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,0.85)";
    el.style.color = "white";
    el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.35)";
    document.body.appendChild(el);
    return el;
}

function tokenToScreen(token) {
    // PIXI DisplayObject -> Screen-Koordinaten
    const p = token.toGlobal(new PIXI.Point(token.w / 2, 0)); // "oben mittig" am Token
    // Foundry Canvas hat Offset durch UI/Zoom; toGlobal gibt Renderer-Screen-Koords zurück
    return { x: p.x, y: p.y };
}

async function renderOverlay(token) {
    const actor = token.actor;
    const elementID = `character-hover-${token.id}`;
    const element = ensureOverlay(elementID);

    const overlayVars = {};
    overlayVars.themebooks = actor.items.filter(i => i.type === "themebook");
    overlayVars.actor = actor;
    overlayVars.backpack = actor.items.find(i => i.type === "backpack");
    overlayVars.fellowshipThemecard = actor.sheet.getActorFellowshipThemecard();
    overlayVars.hasFellowshipThemecard = !!overlayVars.fellowshipThemecard;

    element.innerHTML = await foundry.applications.handlebars.renderTemplate(
        `systems/mist-engine-fvtt/templates/overlay/character-overlay.hbs`,
        overlayVars
    );
    const { x, y } = tokenToScreen(token);
    element.style.left = `${Math.round(x - 300)}px`;
    element.style.top = `${Math.round(y + 60)}px`;
    element.style.display = "block";
}

function isTooltipEnabled() {
    return !game.settings.get("mist-engine-fvtt", "disableCharacterHoverTooltip") && game.user.isGM;
}

export function initCharacterTokenHoverKeyListeners() {
    window.addEventListener("keydown", async (e) => {
        if (e.key !== "Control" || ctrlHeld) return;
        ctrlHeld = true;
        if (!isTooltipEnabled()) return;
        for (const token of hoveredTokens) {
            await renderOverlay(token);
        }
    });

    window.addEventListener("keyup", (e) => {
        if (e.key !== "Control") return;
        ctrlHeld = false;
        for (const token of hoveredTokens) {
            const element = document.getElementById(`character-hover-${token.id}`);
            if (element) element.style.display = "none";
        }
    });
}

export async function showCharacterTokenHover(token, hovered) {
    if (!isTooltipEnabled()) return;

    const elementID = `character-hover-${token.id}`;
    const element = ensureOverlay(elementID);

    if (!hovered) {
        element.style.display = "none";
        hoveredTokens.delete(token);
        return;
    }

    hoveredTokens.add(token);

    if (!ctrlHeld) return;

    await renderOverlay(token);
}
