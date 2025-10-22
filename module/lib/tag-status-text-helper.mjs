export function makeStyledTagOrStatusText(source){
    let isStatus = false;
    if(source.includes("/s")){
        isStatus = true;
        source = source.replace("/s", "");
    }

    if(!source.includes("-")){
        let tag = source;
        if(isStatus){
            return `<mark class="draggable status" draggable="true" data-type="status" data-name="${tag}" data-value="0">${tag}</mark>`
        }else{
            return `<mark class="draggable tag" draggable="true" data-type="tag" data-name="${tag}">${tag}</mark>`
        }
    }else{
        const value = source.split("-").pop();
        const name = source.substring(0, source.lastIndexOf("-"));
        return `<mark class="draggable status" draggable="true" data-type="status" data-name="${name}" data-value="${value}">${name}-${value}</mark>`;
    }

    const [name, value] = source.split("-");
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
    }
}