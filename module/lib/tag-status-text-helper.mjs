export function textWithTags(str) {
  const tags = extractBrackets(str);
  let result = str;
  tags.forEach((tag) => {
    const [name, value] = tag.split("-");
    if (tag.includes("-")) {
      result = result.replace(
        `[${tag}]`,
        makeStyledTagOrStatusText(tag)
      );
    } else {
      result = result.replace(
        `[${tag}]`,
        makeStyledTagOrStatusText(tag)
      );
    }
  });
  return result;
}

export function extractBrackets(text) {
  // Regulärer Ausdruck, der Inhalte zwischen [] findet
  const regex = /\[(.*?)\]/g;
  let matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]); // match[1] = Inhalt innerhalb der []
  }

  return matches;
}

export function makeStyledTagOrStatusText(source) {
  let isOfType = 1; // 1 = tag, 2 = status, 3 = might, 4 - bold
  let extraClass = '';
  let extraIcon = '';

  // status
  if (source.includes("/s")) {
    isOfType = 2;

    if (source.includes("/sg")) {
      extraClass = "green";
      source = source.replace("/sg", "");
    }
    else if (source.includes("/sr")) {
      extraClass = "red";
      source = source.replace("/sr", "");
    }
    else if (source.includes("/so")) {
      extraClass = "orange";
      source = source.replace("/so", "");
    } else {
      source = source.replace("/s", "");
    }
  }

  // weakness
  if (source.includes("/w")) {
    extraIcon = '<i class="fa-light fa-angles-down"></i>';
    if (source.includes("/wo")) {
      extraClass = "orange";
      source = source.replace("/wo", "");
    } else {
      source = source.replace("/w", "");
    }
  }

  //might
  if (source.includes("/m")) {
    extraIcon = '<img src="systems/mist-engine-fvtt/assets/icons/icon-sword.svg" alt="Might Icon" class="might-icon">';
    source = source.replace("/m", "");
    extraClass= "transparent";
    isOfType = 3;
  }

  // bold
  if(source.includes("/b")) {
    source = source.replace("/b", "");
    extraClass = "";
    isOfType = 4;
  }

  if (!source.includes("-")) {
    let tag = source;
    tag = tag.trim();
    if (isOfType === 2) {
      return `<mark class="draggable status ${extraClass}" draggable="true" data-type="status" data-name="${tag}" data-value="0">${extraIcon}${tag}</mark>`;
    } else if (isOfType === 3) {
      return `<mark class="draggable might ${extraClass}" data-type="might" data-name="${tag}">${extraIcon}${tag}</mark>`;
    } 
    else if(isOfType === 4){
      // remove all whitespace from the beginning and ending
      return `<strong>${tag}</strong>`;
    }
    else {
      return `<mark class="draggable tag ${extraClass}" draggable="true" data-type="tag" data-name="${tag}">${extraIcon}${tag}</mark>`;
    }
  } else {
    const value = source.split("-").pop();
    const name = source.substring(0, source.lastIndexOf("-"));
    return `<mark class="draggable status ${extraClass}" draggable="true" data-type="status" data-name="${name}" data-value="${value}">${name}-${value}</mark>`;
  }

  /*const [name, value] = source.split("-");
  console.log("name:", name, "value:", value);
  return;
  if (tag.includes("-")) {
    result = result.replace(
      `[${tag}]`,
      `<mark class="draggable status" draggable="true" data-type="status" data-name="${name}" data-value="${value}">${tag}</mark>`
    );
  } else {
    result = result.replace(
      `[${tag}]`,
      `<mark class="draggable tag" draggable="true" data-type="tag" data-name="${name}">${tag}</mark>`
    );
  }*/
}