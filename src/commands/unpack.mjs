import { extractPack } from "@foundryvtt/foundryvtt-cli";

console.log("working directory: " + process.cwd());
//await extractPack("./packs/challenges", "./src/packs/challenges", { nedb: false,log: true,documentType: "Actor" });
await extractPack("./packs/litm-themebooks", "./src/packs/litm-themebooks", { nedb: false,log: true,documentType: "Item" });
//await extractPack("./packs/pregen-heroes", "./src/packs/pregen-heroes", { nedb: false,log: true,documentType: "Actor" });
await extractPack("./packs/system-documentation", "./src/packs/system-documentation", { nedb: false,log: true,documentType: "Journal" });