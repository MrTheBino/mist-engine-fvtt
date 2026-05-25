// Markup tokens supported are as follows...

// [tag] - a simple tag
// [/w weakness] - a weakness tag
// [status-X] - a status with a tier of X (1-6)
// [/s status] - a status without a tier, used in a journal for example
// [/l limit] - a limit without a value, used in a journal for example
// [/l limit-X] - a limit with the value X (1-6)

// [/ma might] - a might of type adventure
// [/mg might] - a might of type greatness
// [/mo might] - a might of type origin

// Tag types
const TAG = 1;
const STATUS = 2;
const MIGHT = 3;
const BOLD = 4;
const LIMIT = 5;
const WEAKNESS = 6;

/**
 * Convert raw text with above markup tokens to text with HTML mark elements
 *
 * @param {String} the raw text
 * @returns the same text with markup converted to HTML mark elements
 */
export function textWithTags(str) {
  let result = str;

  str.matchAll(/\[(.*?)\]/g).forEach(([token, markup]) => {
    result = result.replace(token, makeStyledTagOrStatusText(markup.trim()));
  });

  return result;
}

/**
 * Parse and convert token markup into a styled HTML mark element
 *
 * @param {String} token the token to convert
 * @returns {String} the corresponding HTML mark element
 */
export function makeStyledTagOrStatusText(markup) {
  let isOfType = TAG; // type is TAG by default
  let extraIcon = ""; // No extra icon prefix

  // status
  if (markup.includes("/s")) {
    isOfType = STATUS;
    markup = markup.replace("/s", "");
  }

  // weakness
  if (markup.includes("/w")) {
    isOfType = WEAKNESS;
    extraIcon = '<i class="fa-light fa-angles-down"></i>';
    markup = markup.replace("/w", "");
  }

  // limit
  if (markup.includes("/l")) {
    isOfType = LIMIT;
    markup = markup.replace("/l", "");
  }

  //might
  if (markup.includes("/mg")) {
    isOfType = MIGHT;
    extraIcon =
      '<img src="systems/mist-engine-fvtt/assets/icons/might-icon-greatness.webp" alt="Greatness Icon" class="might-icon">';
    markup = markup.replace("/mg", "");
  } else if (markup.includes("/mo")) {
    //might origin
    isOfType = MIGHT;
    extraIcon =
      '<img src="systems/mist-engine-fvtt/assets/icons/might-icon-origin.webp" alt="Origin Icon" class="might-icon">';
    markup = markup.replace("/mo", "");
  } else if (markup.includes("/ma")) {
    isOfType = MIGHT;
    extraIcon =
      '<img src="systems/mist-engine-fvtt/assets/icons/might-icon-adventure.webp" alt="Might Icon" class="might-icon">';
    markup = markup.replace("/ma", "");
  } else if (markup.includes("/m")) {
    //might standard
    isOfType = MIGHT;
    extraIcon =
      '<img src="systems/mist-engine-fvtt/assets/icons/might-icon-adventure.webp" alt="Might Icon" class="might-icon">';
    markup = markup.replace("/m", "");
  }

  // bold
  if (markup.includes("/b")) {
    markup = markup.replace("/b", "");
    isOfType = BOLD;
  }

  if (!markup.includes("-")) {
    // Name without value
    const name = markup.trim();
    if (isOfType === STATUS) {
      return `<mark class="draggable status" draggable="true" data-type="status" data-name="${name}" data-value="0">${name}</mark>`;
    } else if (isOfType === WEAKNESS) {
      return `<mark class="draggable weakness" draggable="true" data-type="weakness" data-name="${name}">${extraIcon}${name}</mark>`;
    } else if (isOfType === LIMIT) {
      return `<mark class="draggable limit" draggable="true" data-type="limit" data-name="${name}" data-value="0">${name}</mark>`;
    } else if (isOfType === MIGHT) {
      return `<mark class="might" data-type="might" data-name="${name}">${extraIcon}${name}</mark>`;
    } else if (isOfType === BOLD) {
      return `<strong>${name}</strong>`;
    } else {
      return `<mark class="draggable tag" draggable="true" data-type="tag" data-name="${name}">${name}</mark>`;
    }
  } else {
    // Name with value
    const value = parseInt(markup.split("-").pop()) || 0;
    const name = markup.substring(0, markup.lastIndexOf("-")).trim();
    if (isOfType === LIMIT) {
      return `<div class="limit-inline"><mark class="draggable limit" draggable="true" data-type="limit" data-name="${name}" data-value="${value}">${name}</mark><span class="limit-value">${value}</span></div>`;
    } else {
      return `<mark class="draggable status" draggable="true" data-type="status" data-name="${name}" data-value="${value}">${name}-${value}</mark>`;
    }
  }
}
