// Markup tokens supported are as follows...

// [tag] - a simple tag
// [/t tag] - an explicit simple tag (same as [tag])
// [/w weakness] - a weakness tag ([/wo weakness] is an alias)
// [status-X] - a status with a tier of X (1-6)
// [/s status] - a status without a tier, used in a journal for example
// [/sn status] - a negative status without a tier
// [/sn status-X] - a negative status with a tier of X (1-6), counted as -X in rolls
// [/l limit] - a limit without a value, used in a journal for example
// [/l limit-X] - a limit with the value X (1-6)

// [/m might] - a might without a type
// [/ma might] - a might of type adventure
// [/mg might] - a might of type greatness
// [/mo might] - a might of type origin

// [/b text] - bold text, no tag (e.g. "[/b New Challenge]")

// Aliases found in the Core Book module content, rendered as a plain status
// (like [/s status]): /sp, /sg, /sr, /so and /n.

// A token is only recognised at the very start of the markup and must be
// followed by whitespace ("/sg provoked-2"). Anything else - an unknown token,
// or a "/" inside the name ("[fire/ice]") - never changes the type and never
// eats letters of the name: an unknown token renders its remaining text as a
// plain tag.

// Tag types
const TAG = 1;
const STATUS = 2;
const MIGHT = 3;
const BOLD = 4;
const LIMIT = 5;
const WEAKNESS = 6;
const NEGATIVE_STATUS = 7;

// Markup token (without the leading "/") -> tag type and optional icon prefix
const TOKENS = {
  t: { type: TAG },
  w: { type: WEAKNESS, icon: '<i class="fa-light fa-angles-down"></i>' },
  wo: { type: WEAKNESS, icon: '<i class="fa-light fa-angles-down"></i>' }, // alias of /w (#103)
  s: { type: STATUS },
  sn: { type: NEGATIVE_STATUS },
  l: { type: LIMIT },
  m: { type: MIGHT, icon: '<i class="might-icon"></i>' },
  ma: { type: MIGHT, icon: '<i class="might-icon adventure"></i>' },
  mg: { type: MIGHT, icon: '<i class="might-icon greatness"></i>' },
  mo: { type: MIGHT, icon: '<i class="might-icon origin"></i>' },
  b: { type: BOLD },
  // Core Book module aliases, all used for plain statuses there
  sp: { type: STATUS },
  sg: { type: STATUS },
  sr: { type: STATUS },
  so: { type: STATUS },
  n: { type: STATUS },
};

/**
 * Convert raw text with above markup tokens to text with HTML mark elements
 *
 * @param {String} the raw text
 * @returns the same text with markup converted to HTML mark elements
 */
export function textWithTags(str) {
  let result = str;

  // Use regex to find all tokens in the string and replace them with the corresponding HTML
  str.matchAll(/@\w+\[.*?\](?:\{.*?\})?|\[(.*?)\]/g).forEach(([token, markup]) => {
    if (markup !== undefined) {
      result = result.replace(token, makeStyledTagOrStatusText(markup.trim()));
    }
  });

  return result;
}

/**
 * Convert a raw tag/status string into final display HTML with document links
 * (issue #73).
 *
 * Order matters: `textWithTags` runs FIRST, while the string is still plain
 * text. Its regex explicitly skips `@UUID[...]{...}` (and other
 * `@word[...]{...}`) spans - it matches them only so its `[...]` tag-token
 * branch cannot misfire on their brackets - so it hands back a string with
 * `[tag]`/`[/s status]` tokens converted to `<mark>` HTML and any
 * `@UUID[...]{...}` spans still untouched as plain text. `enrichHTML` then
 * runs SECOND on that (now partially-HTML) string, converting the remaining
 * `@UUID[...]{...}` spans into real content-link anchors while leaving the
 * `<mark>` elements alone. Running the plain (non-DOM-aware) textWithTags
 * regex over enrichHTML's output instead would be the riskier direction.
 *
 * @param {string} raw
 * @param {foundry.abstract.Document} doc owns permissions (secrets), roll data
 *   and relative UUID resolution for the enrichment
 * @returns {Promise<string>}
 */
export async function enrichTextWithTags(raw, doc) {
  if (!raw) return "";
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(textWithTags(raw), {
    // Whether to show secret blocks in the finished html
    secrets: doc.isOwner,
    // Necessary in v11, can be removed in v12
    async: true,
    // Data to fill in for inline rolls
    rollData: doc.getRollData(),
    // Relative UUID resolution
    relativeTo: doc,
  });
}

/**
 * Map shortchallenge Items to plain render objects for challenge-partial.hbs:
 * `id`/`name`/`system` for the edit branch, plus enriched
 * `shortDescriptionHTML`/`listHTML` for the view branch.
 *
 * @param {Item[]} challenges shortchallenge items
 * @param {foundry.abstract.Document} doc the actor the enrichment is relative to
 * @returns {Promise<object[]>}
 */
export async function enrichShortChallenges(challenges, doc) {
  return Promise.all(challenges.map(async (challenge) => ({
    id: challenge.id,
    name: challenge.name,
    system: challenge.system,
    shortDescriptionHTML: await enrichTextWithTags(challenge.system.shortDescription, doc),
    listHTML: await Promise.all((challenge.system.list ?? []).map((entry) => enrichTextWithTags(entry, doc))),
  })));
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

  // the token is anchored at the start and needs whitespace after it (a
  // double space typed in the editor arrives as &nbsp;), so a "/l" or "/b"
  // somewhere inside a name is just part of that name
  const tokenMatch = /^\/(\w+)(?:\s|&nbsp;)+/.exec(markup);
  if (tokenMatch) {
    const token = TOKENS[tokenMatch[1].toLowerCase()];
    if (token) {
      isOfType = token.type;
      extraIcon = token.icon ?? "";
    }
    // an unknown token keeps TAG and only drops the token itself
    markup = markup.substring(tokenMatch[0].length);
  }

  const lastSegment = markup.split("-").pop().trim();
  const hasNumericSuffix = markup.includes("-") && /^\d+$/.test(lastSegment);

  if (!hasNumericSuffix) {
    // Name without value
    const name = markup.trim();
    if (isOfType === STATUS) {
      return `<mark class="draggable status" draggable="true" data-type="status" data-name="${name}" data-value="0">${name}</mark>`;
    } else if (isOfType === NEGATIVE_STATUS) {
      return `<mark class="draggable status negative" draggable="true" data-type="status" data-positive="false" data-name="${name}" data-value="0">${name}</mark>`;
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
    // Name with numeric value
    const value = parseInt(lastSegment);
    const name = markup.substring(0, markup.lastIndexOf("-")).trim();
    if (isOfType === LIMIT) {
      return `<div class="limit-inline"><mark class="draggable limit" draggable="true" data-type="limit" data-name="${name}" data-value="${value}">${name}</mark><span class="limit-value">${value}</span></div>`;
    } else if (isOfType === NEGATIVE_STATUS) {
      return `<mark class="draggable status negative" draggable="true" data-type="status" data-positive="false" data-name="${name}" data-value="${value}">${name}-${value}</mark>`;
    } else {
      return `<mark class="draggable status" draggable="true" data-type="status" data-name="${name}" data-value="${value}">${name}-${value}</mark>`;
    }
  }
}
