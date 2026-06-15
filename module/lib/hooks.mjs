import { MistSceneApp } from "../apps/scene-app.mjs";
import { HowToPlayApp } from "../apps/how-to-play-app.mjs";
import { showCharacterTokenHover } from "./character-token-hover.mjs";

export function setupHooks() {
  Hooks.on("getProseMirrorMenuItems", (menu, config) => {
    const schema = menu.schema;
    const markType = schema?.marks?.mark;
    if (!markType) return;

    const toggleMark = (cssClass) => (state, dispatch) => {
      const { from, to } = state.selection;
      const mark = markType.create({ _preserve: { class: cssClass } });
      const hasMark = state.doc.rangeHasMark(from, to, markType);
      if (dispatch) {
        const tr = hasMark
          ? state.tr.removeMark(from, to, markType)
          : state.tr.addMark(from, to, mark);
        dispatch(tr);
      }
      return true;
    };

    config.push({
      action: "toggle-status",
      title: "Als Status markieren",
      icon: '<i class="fa-solid fa-tag fa-fw"></i>',
      scope: "text",
      cmd: toggleMark("tag"),
      priority: 8,
    });

    config.push({
      action: "toggle-tag",
      title: "Als Tag markieren",
      icon: '<i class="fa-solid fa-hashtag fa-fw"></i>',
      scope: "text",
      cmd: toggleMark("status"),
      priority: 7,
    });
  });

  Hooks.on("getProseMirrorMenuDropDowns", (menu, menus) => {
    const divNode = menu.schema?.nodes?.div;
    if (!divNode) return;

    const wrapInFrame = (cssClass) => () => {
      menu._toggleBlock(divNode, foundry.prosemirror.commands.wrapIn, {
        attrs: { _preserve: { class: cssClass } },
      });
    };

    const paragraphNode = menu.schema?.nodes?.paragraph;
    const setFakeHeading = (cssClass) => () => {
      if (!paragraphNode) return;
      const cmd = foundry.prosemirror.commands.setBlockType(
        paragraphNode,
        { _preserve: { class: cssClass } }
      );
      cmd(menu.view.state, menu.view.dispatch, menu.view);
    };

    menus.fakeHeadings = {
      title: "Fake Headings",
      cssClass: "fake-headings",
      icon: '<i class="fa-solid fa-heading fa-fw"></i>',
      entries: [
        {
          action: "fake-h1",
          title: "Fake Heading 1",
          cmd: setFakeHeading("fh1"),
        },
        {
          action: "fake-h2",
          title: "Fake Heading 2",
          cmd: setFakeHeading("fh2"),
        },
        {
          action: "fake-h3",
          title: "Fake Heading 3",
          cmd: setFakeHeading("fh3"),
        },
      ],
    };

    menus.textframes = {
      title: "Textframes",
      cssClass: "textframes",
      icon: '<i class="fa-solid fa-layer-group fa-fw"></i>',
      entries: [
        {
          action: "text-container-long-paper-background",
          title: "Long Paper Background",
          cmd: wrapInFrame("text-container-long-paper-background"),
        },
        {
          action: "text-container-300",
          title: "Container 300",
          cmd: wrapInFrame("text-container-300"),
        },
        {
          action: "text-container-500",
          title: "Container 500",
          cmd: wrapInFrame("text-container-500"),
        },
      ],
    };
  });

  //make live a little bit easier, themekits have OBSERVER rights per default
  Hooks.on("preCreateItem", (doc, data, _options, _userId) => {
    // Nur GM darf Ownership setzen
    if (!game.user.isGM) return;

    // Nur für deinen Item-Typ
    if (data.type !== "themekit"){
      console.log(`Not setting default ownership for item ${data.name} because it is not a themekit`);
      return;
    }

    // Falls bereits gesetzt: optional nicht überschreiben
    const ownership = data.ownership ?? doc._source.ownership ?? {};

    doc.updateSource({
      ownership: {
        ...ownership,
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
      }
    });

    console.log(`Set default ownership for themekit ${data.name} to OBSERVER`);
  });

  Hooks.on("createActor", async (actor, _data, _options, _userId) => {
    // Creating a backpack for each new LITM-Character
    if (actor.type !== "litm-character") return;

    // check first if the items of the actor already has a backpack, if yes, do nothing
    const hasBackpack = actor.items.find(i => i.type === "backpack");
    if (hasBackpack) return;

    const itemData = {
      name: "Backpack",
      type: "backpack",
      system: {
        /* ... */
      },
      flags: { mist: { autoAdded: true } },
    };

    await Item.implementation.create(
      [itemData],
      { parent: actor }
    );
  });

  Hooks.on("renderPause", (_, html) => {
    html
      .find("img")
      .attr("src", "systems/mist-engine-fvtt/assets/marshal-crest.webp")
      .removeAttr("class");
  });

  Hooks.on("renderGamePause", (_, html) => {
    const img = html.querySelector("img");
    if (!img) return;
    img.src = "systems/mist-engine-fvtt/assets/marshal-crest.webp";
    img.classList.remove("fa-spin");
  });

  Hooks.on("getSceneControlButtons", (controls) => {
    let sidebarControls = {
      scene_data_app: {
        name: "scene_data_app",
        title: "Scene Tags",
        icon: "fas fa-scroll",
        visible: true,
        onChange: () => MistSceneApp.getInstance().render(true, { focus: true }),
        button: true,
      },
      how_to_play_app: {
        name: "how_to_play_app",
        title: "How To Play",
        icon: "fas fa-circle-question",
        visible: true,
        onChange: () => HowToPlayApp.getInstance().render(true, { focus: true }),
        button: true,
      },
    };

    controls.notes.tools = foundry.utils.mergeObject(
      controls.notes.tools,
      sidebarControls
    );
  });

  Hooks.on("renderItemDirectory", (_app, html) => {
    // ToDo: is this the correct way? maybe move them to a compendium?
    const sceneDataIds = game.items
      .filter((item) => item.type === "scene-data")
      .map((i) => i.id);
    for (const id of sceneDataIds) {
      let t = html.querySelector(`li.directory-item[data-entry-id="${id}"]`);
      if (t) t.remove();
    }
  });

  Hooks.on("renderDialogV2", (_dialog, html) => {
    html.querySelector('select[name="type"] option[value="scene-data"]')?.remove();
  });

  Hooks.on("mistengine:sceneAppUpdated", (_data) => {
    const instance = MistSceneApp.getInstance();
    console.log("Received sceneAppUpdated , app rendered: ", instance.rendered);
    if (instance.rendered && !instance.minimized) {
      instance.render(true);
    }
  });

  Hooks.on("canvasReady", (canvas) => {
    MistSceneApp.getInstance().sceneChangedHook(canvas.scene);
  });

  Hooks.on("createToken", (_tokenDocument, _options, _userId) => {
    const instance = MistSceneApp.getInstance();
    if (instance.rendered) { // only if shown
      instance.sceneUpdatedHook();
    }
  });

  const TOKEN_POSITIONAL_KEYS = new Set(["x", "y", "rotation", "elevation", "_id"]);
  Hooks.on("updateToken", (_tokenDocument, changes) => {
    const hasNonPositionalChange = Object.keys(changes).some(k => !TOKEN_POSITIONAL_KEYS.has(k));
    if (!hasNonPositionalChange) return;
    const instance = MistSceneApp.getInstance();
    if (instance.rendered) { // only if shown
      instance.sceneUpdatedHook();
    }
  });

  Hooks.on("deleteToken", (_tokenDocument, _options, _userId) => {
    const instance = MistSceneApp.getInstance();
    if (instance.rendered) { // only if shown
      instance.sceneUpdatedHook();
    }
  });

  Hooks.on("hoverToken", (token, hovered) => {
    // we only show the hover effect if the token belongs to a character actor
    if (token.actor?.type === "litm-character") {
      showCharacterTokenHover(token, hovered);
    }
  });

  Hooks.on("preDeleteToken", (token, _options, _userId) => {
    if (token.actor?.type === "litm-character") {
      showCharacterTokenHover(token, false);
    }
  });
}
