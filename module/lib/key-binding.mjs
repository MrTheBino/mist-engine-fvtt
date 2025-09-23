import { MistSceneApp } from "../apps/scene-app.mjs";

function getActiveTextControl() {
  const el = document.activeElement;
  if (!el) return null;
  const isTextInput =
    (el instanceof HTMLInputElement && ["text", "search", "email", "url", "tel", "password"].includes(el.type)) ||
    (el instanceof HTMLTextAreaElement);
  return isTextInput ? el : null;
}

function surroundSelection(ctrl, prefix, suffix = prefix) {
  const start = ctrl.selectionStart ?? 0;
  const end   = ctrl.selectionEnd ?? 0;
  const before = ctrl.value.slice(0, start);
  const middle = ctrl.value.slice(start, end);
  const after  = ctrl.value.slice(end);

  // Wenn keine Auswahl: an Cursor einfügen und Cursor dazwischen platzieren
  if (start === end) {
    ctrl.value = before + prefix + suffix + after;
    const caret = before.length + prefix.length;
    ctrl.setSelectionRange(caret, caret);
  } else {
    ctrl.value = before + prefix + middle + suffix + after;
    ctrl.setSelectionRange(start + prefix.length, start + prefix.length + middle.length);
  }
  ctrl.dispatchEvent(new Event("input", { bubbles: true }));
}

function withFocusedTextControl(action) {
  const ctrl = getActiveTextControl();
  console.log(ctrl);
  if (!ctrl) {
    ui.notifications?.warn("Plaziere den Cursor in ein Textfeld/Textbereich.");
    return false;
  }
  action(ctrl);
  return true;
}

function setupKBSzeneTagsApp(){
    game.keybindings.register("mist-engine-fvtt", "showSceneTagsApp", {
    name: "Show SceneTags App",
    hint: "opens the scene tags window",
    editable: [
      {
        key: "KeyJ",       
        modifiers: ["Control"]
      }
    ],
    onDown: () => {
        MistSceneApp.getInstance().render(true, { focus: true })
      return true;
    },
    onUp: () => {},
    restricted: false, // true = nur SL darf Shortcut nutzen
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
}

function setupKBTaggingBindings(){
    game.keybindings.register("mist-engine-fvtt", "enrichTextWithTags", {
    name: "Make Tags",
    hint: "Surround selected text with [] to make it a tag",
    editable: [{ key: "KeyB", modifiers: ["Alt"] }],
    onDown: () => withFocusedTextControl(ctrl => surroundSelection(ctrl, "[", "]")),
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
}

export function setupMistEngineKeyBindings(){
    setupKBSzeneTagsApp();
    //setupKBTaggingBindings(); not working yet
}