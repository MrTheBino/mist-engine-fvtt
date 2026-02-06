import { compilePack } from "@foundryvtt/foundryvtt-cli";

console.log("working directory: " + process.cwd());
//await compilePack("./src/packs/challenges", "./packs/challenges", { nedb: false,log: true });
await compilePack("./src/packs/litm-themebooks", "./packs/litm-themebooks", { nedb: false,log: true });
//await compilePack("./src/packs/pregen-heroes", "./packs/pregen-heroes", { nedb: false,log: true });
await compilePack("./src/packs/system-documentation", "./packs/system-documentation", { nedb: false,log: true });