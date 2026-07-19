import { MistSceneApp } from "../apps/scene-app.mjs";
import { DiceRollApp } from "../apps/dice-roll-app.mjs";
import { HowToPlayApp } from "../apps/how-to-play-app.mjs";
import { CampingApp } from "../apps/camping-app.mjs";
import { Collaboration } from "../lib/collaboration.mjs";
import { showCharacterTokenHover, initCharacterTokenHoverKeyListeners } from "./character-token-hover.mjs";

export function setupHooks() {
  initCharacterTokenHoverKeyListeners();
  // prosemirror extensions ..... 
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
      action: "toggle-tag",
      title: game.i18n.localize("MIST_ENGINE.PROSEMIRROR.MarkAsTag"),
      icon: '<i class="fa-solid fa-tag fa-fw"></i>',
      scope: "text",
      cmd: toggleMark("tag"),
      priority: 8,
    });

    config.push({
      action: "toggle-status",
      title: game.i18n.localize("MIST_ENGINE.PROSEMIRROR.MarkAsStatus"),
      icon: '<i class="fa-solid fa-hashtag fa-fw"></i>',
      scope: "text",
      cmd: toggleMark("status"),
      priority: 7,
    });

    const applyLimit = (state, dispatch) => {
      const { from, to } = state.selection;
      if (from === to) return false;

      const hasMark = state.doc.rangeHasMark(from, to, markType);
      if (hasMark) {
        if (dispatch) dispatch(state.tr.removeMark(from, to, markType));
        return true;
      }

      const selectedText = state.doc.textBetween(from, to);
      const parts = selectedText.split("-");
      const lastSegment = parts[parts.length - 1].trim();
      const hasValue = parts.length > 1 && /^\d+$/.test(lastSegment);

      const value = hasValue ? parseInt(lastSegment) : 0;
      const name = hasValue
        ? selectedText.substring(0, selectedText.lastIndexOf("-")).trim()
        : selectedText.trim();

      const limitMark = markType.create({ _preserve: {
        class: "draggable limit",
        draggable: "true",
        "data-type": "limit",
        "data-name": name,
        "data-value": String(value),
      }});

      const newText = state.schema.text(name, [limitMark]);
      if (dispatch) dispatch(state.tr.replaceWith(from, to, newText));
      return true;
    };

    config.push({
      action: "toggle-limit",
      title: "Mark as Limit",
      icon: '<i class="fa-solid fa-shield fa-fw"></i>',
      scope: "text",
      cmd: applyLimit,
      priority: 6,
    });

    const applyWeakness = (state, dispatch) => {
      const { from, to } = state.selection;
      if (from === to) return false;

      const hasMark = state.doc.rangeHasMark(from, to, markType);
      if (hasMark) {
        if (dispatch) dispatch(state.tr.removeMark(from, to, markType));
        return true;
      }

      const name = state.doc.textBetween(from, to).trim();

      const weaknessMark = markType.create({ _preserve: {
        class: "draggable weakness",
        draggable: "true",
        "data-type": "weakness",
        "data-name": name,
      }});

      // Use the schema's icon node type so the icon renders as <i>, not <mark>.
      // Applying weaknessMark to both the icon node and the name text causes ProseMirror's
      // serializer to merge them under a single <mark class="weakness"> wrapper.
      const iconNodeType = state.schema.nodes.icon;
      const iconNode = iconNodeType.create({ classes: "fa-light fa-angles-down" }, null, [weaknessMark]);
      const nameNode = state.schema.text(name, [weaknessMark]);

      if (dispatch) dispatch(state.tr.replaceWith(from, to, [iconNode, nameNode]));
      return true;
    };

    config.push({
      action: "toggle-weakness",
      title: "Mark as Weakness",
      icon: '<i class="fa-light fa-angles-down fa-fw"></i>',
      scope: "text",
      cmd: applyWeakness,
      priority: 5,
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

    const wrapInContentSidebar = () => {
      const { state } = menu.view;
      const { $from, $to } = state.selection;
      const range = $from.blockRange($to);
      if (!range) return;
      const selectedContent = state.doc.slice(range.start, range.end).content;
      const leftContent = selectedContent.size > 0 ? selectedContent : paragraphNode.create();
      const leftBar = divNode.create({ _preserve: { class: "left-bar" } }, leftContent);
      const rightBar = divNode.create({ _preserve: { class: "right-bar" } }, paragraphNode.create({}, menu.schema.text("PLACEHOLDER")));
      const sidebar = divNode.create({ _preserve: { class: "content-with-sidebar" } }, [leftBar, rightBar]);
      menu.view.dispatch(state.tr.replaceWith(range.start, range.end, sidebar));
    };

    const setFakeHeading = (cssClass) => () => {
      if (!paragraphNode) return;
      const cmd = foundry.prosemirror.commands.setBlockType(
        paragraphNode,
        { _preserve: { class: cssClass } }
      );
      cmd(menu.view.state, menu.view.dispatch, menu.view);
    };

    const markType = menu.schema?.marks?.mark;
    const iconNodeType = menu.schema?.nodes?.icon;

    if (markType) {
      const insertIcon = (cssClass) => () => {
        const state = menu.view.state;
        const mark = markType.create({ _preserve: { class: cssClass } });
        const iconNode = state.schema.text('​', [mark]);
        menu.view.dispatch(state.tr.insert(state.selection.from, iconNode));
      };

      const insertIconElement = (cssClass) => () => {
        if (!iconNodeType) return;
        const state = menu.view.state;
        const node = iconNodeType.create({ classes: cssClass });
        menu.view.dispatch(state.tr.insert(state.selection.from, node));
      };

      menus.icons = {
        title: "Icons",
        cssClass: "icons",
        icon: '<i class="fa-solid fa-icons fa-fw"></i>',
        entries: [
          { action: "icon-origin",    title: "Origin Icon",    cmd: insertIcon("icon-origin") },
          { action: "icon-adventure", title: "Adventure Icon", cmd: insertIcon("icon-adventure") },
          { action: "icon-greatness", title: "Greatness Icon", cmd: insertIcon("icon-greatness") },
          { action: "icon-hint", title: "Hint Icon", cmd: insertIconElement("fa-solid fa-circle-question icon-hint") },
        ],
      };
    }

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
          action: "content-with-sidebar",
          title: "Content with Sidebar",
          cmd: wrapInContentSidebar,
        },
        {
          action: "written-block",
          title: "Written Block",
          cmd: wrapInFrame("written-block"),
        },
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
        onChange: () => MistSceneApp.open(),
        button: true,
      },
      camping_app: {
        name: "camping_app",
        title: game.i18n.localize("MIST_ENGINE.CAMPING.Title"),
        icon: "fas fa-campground",
        visible: game.user.isGM,
        onChange: () => CampingApp.openForGM(),
        button: true,
      },
      group_action_app: {
        name: "group_action_app",
        title: game.i18n.localize("MIST_ENGINE.COLLAB.GroupTitle"),
        icon: "fas fa-people-group",
        visible: game.user.isGM,
        onChange: () => Collaboration.openGroupAction(),
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

  // Central live-refresh for the aggregator apps (scene tracker + dice roll).
  // Foundry already broadcasts document updates to every client (including the
  // initiator) and fires these hooks everywhere, so this replaces the old
  // manual `game.socket` refresh messages. Each document's own sheet
  // auto-re-renders on update; only these cross-document aggregators need a
  // nudge. Uses the cached singletons so it never spawns a closed app.
  const refreshSceneTrackers = () => {
    const sceneApp = MistSceneApp.instance;
    if (sceneApp?.rendered && !sceneApp.minimized) sceneApp.render(true);
    if (DiceRollApp.instance) DiceRollApp.instance.updateTagsAndStatuses(true);
    const campingApp = CampingApp.instance;
    if (campingApp?.rendered && !campingApp.minimized) campingApp.render(true);
  };

  Hooks.on("updateActor", (actor) => {
    // Only actors shown in the active scene affect the trackers...
    const inScene = game.scenes?.active?.tokens?.contents?.some(t => t.actor?.id === actor.id);
    // ...plus the journey assigned to the scene (Journeys tab) — it is not a
    // scene token, so it would otherwise never trigger a refresh.
    const isAssignedJourney = MistSceneApp.instance?.getAssignedJourney?.()?.id === actor.id;
    if (inScene || isAssignedJourney) refreshSceneTrackers();
  });

  // Item types whose data feeds the scene tracker / dice roll app:
  // scene-data (scene tags + roll mods), themebook/backpack (power/story tags),
  // shortchallenge (challenge tags).
  const TRACKED_ITEM_TYPES = new Set(["scene-data", "themebook", "backpack", "shortchallenge", "rote"]);
  Hooks.on("updateItem", (item, changes) => {
    if (TRACKED_ITEM_TYPES.has(item.type)) refreshSceneTrackers();

    // Camping & Sojourns: open the dialog on every client when the GM
    // activates the mode on the scene-data item, close it when it ends.
    if (item.type === "scene-data" && changes.system?.camping !== undefined) {
      const active = changes.system.camping.active;
      if (active === true) CampingApp.getInstance().render(true, { focus: true });
      else if (active === false && game.user.isGM === false) CampingApp.instance?.close();
    }
  });

  // Reconnecting players: reopen the camping dialog if the mode is running.
  Hooks.once("ready", () => {
    setTimeout(() => {
      const sd = MistSceneApp.instance?.currentSceneDataItem;
      if (sd?.system.camping?.active) CampingApp.getInstance().render(true);
    }, 3000);
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

  Hooks.on("tokenizer-2.registerFrames", (registry) => {
    registry.registerSection({
      id: "mist-engine-fvtt",
      label: "Legend In The Mist",
      subsections: [
        {
          label: null,
          frames: [
            {
              src: "systems/mist-engine-fvtt/assets/token_frames/litm-token-frame-1.png",
              label: "LitM Frame 1",
            },
            {
              src: "systems/mist-engine-fvtt/assets/token_frames/litm-token-frame-2.png",
              label: "LitM Frame 2",
            },
            {
              src: "systems/mist-engine-fvtt/assets/token_frames/litm-token-frame-3.png",
              label: "LitM Frame 3",
            },
          ],
        },
      ],
    });
  });
}
