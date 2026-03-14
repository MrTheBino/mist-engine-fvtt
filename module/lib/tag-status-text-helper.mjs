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
  let isOfType = 1; // 1 = tag, 2 = status, 3 = might, 4 = bold, limit = 5, weakness = 6
  let extraClass = '';
  let extraIcon = '';

  // status
  if (source.includes("/s")) {
    isOfType = 2;

    if (source.includes("/sg")) {
      extraClass = "green";
      source = source.replace("/sg", "");
    }
    if (source.includes("/sp")) {
      extraClass = "green";
      source = source.replace("/sp", "");
    }
    else if (source.includes("/sr")) {
      extraClass = "red";
      source = source.replace("/sr", "");
    }
    else if (source.includes("/sn")) {
      extraClass = "red";
      source = source.replace("/sn", "");
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
    isOfType = 6;
    extraIcon = '<i class="fa-light fa-angles-down"></i>';
    if (source.includes("/wo")) {
      extraClass = "orange";
      source = source.replace("/wo", "");
    } else {
      source = source.replace("/w", "");
    }
  }

  
  //might greatness
  if (source.includes("/mg")) {
    extraIcon = '<img src="systems/mist-engine-fvtt/assets/icons/might-icon-greatness.webp" alt="Might Icon" class="might-icon">';
    source = source.replace("/mg", "");
    extraClass= "transparent";
    isOfType = 3;
  }
  //might origin
  else if (source.includes("/mo")) {
    extraIcon = '<img src="systems/mist-engine-fvtt/assets/icons/might-icon-origin.webp" alt="Might Icon" class="might-icon">';
    source = source.replace("/mo", "");
    extraClass= "transparent";
    isOfType = 3;
  }
  //might adventure
  else if (source.includes("/ma")) {
    extraIcon = '<img src="systems/mist-engine-fvtt/assets/icons/might-icon-adventure.webp" alt="Might Icon" class="might-icon">';
    source = source.replace("/ma", "");
    extraClass= "transparent";
    isOfType = 3;
  }
  //might standard
  else if (source.includes("/m")) {
    extraIcon = '<img src="systems/mist-engine-fvtt/assets/icons/might-icon-adventure.webp" alt="Might Icon" class="might-icon">';
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

  // limit
  if(source.includes("/l")) {
    source = source.replace("/l", "");
    extraClass = "limit";
    isOfType = 5;
  }

  // tag negative
  if(source.includes("/n")) {
    source = source.replace("/n", "");
    extraClass = "negative";
    isOfType = 1;
  }

  // tag positive
  if(source.includes("/t")) {
    source = source.replace("/t", "");
    extraClass = "";
    isOfType = 1;
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
    else if(isOfType === 6){
      return `<mark class="draggable weakness ${extraClass}" draggable="true" data-type="weakness" data-name="${tag}">${extraIcon}${tag}</mark>`;
    }
    else {
      return `<mark class="draggable tag ${extraClass}" draggable="true" data-type="tag" data-name="${tag}">${extraIcon}${tag}</mark>`;
    }
  } else {
    const value = source.split("-").pop();
    const name = source.substring(0, source.lastIndexOf("-")).trim();
    if(isOfType === 5) { // limit
      return `<div class="npc-limit-item-inline"><mark>${name}</mark><span class="npc-limit-value-armor">${value}</span></div>`;
    }
    else if (isOfType === 1){ // tag 
      return `<mark class="draggable tag ${extraClass}" draggable="true" data-type="tag" data-name="${source}">${extraIcon}${source}</mark>`;
    }
    else if (isOfType === 6){ // weakness
      return `<mark class="draggable weakness ${extraClass}" draggable="true" data-type="weakness" data-name="${source}">${extraIcon}${source}</mark>`;
    }
    else{
      return `<mark class="draggable status ${extraClass}" draggable="true" data-type="status" data-name="${name}" data-value="${value}">${name}-${value}</mark>`;
    }
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