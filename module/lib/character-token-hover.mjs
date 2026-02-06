

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

export async function showCharacterTokenHover(token, hovered) {
    // we show the tooltip only for GMs
    if (game.settings.get("mist-engine-fvtt", "disableCharacterHoverTooltip")) {
        return;
    }
    if (!game.user.isGM) {
        return;
    }

    // get the actor of the token
    const actor = token.actor;
    const elementID = `character-hover-${token.id}`;
    const element = ensureOverlay(elementID);

    if (!hovered) {
        element.style.display = "none";
        return;
    }

    const overlayVars = {};
    // get themebook items from actor
    overlayVars.themebooks = actor.items.filter(i => i.type === "themebook");
    overlayVars.actor = actor;
    // get the single backitemm, if it exists
    overlayVars.backpack = actor.items.find(i => i.type === "backpack");
    overlayVars.fellowshipThemecard = actor.sheet.getActorFellowshipThemecard();
    overlayVars.hasFellowshipThemecard = !!overlayVars.fellowshipThemecard;

    element.innerHTML = await foundry.applications.handlebars.renderTemplate(
        `systems/mist-engine-fvtt/templates/overlay/character-overlay.hbs`,
        overlayVars
    );
    const { x, y } = tokenToScreen(token);
    element.style.left = `${Math.round(x + 14)}px`;
    element.style.top = `${Math.round(y + 14)}px`;
    element.style.display = "block";
}