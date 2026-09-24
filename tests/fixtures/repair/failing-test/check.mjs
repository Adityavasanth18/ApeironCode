import {sum} from "./sum.mjs";
if (sum(2,3) !== 5) { console.error("FAIL sum(2,3) expected 5"); process.exit(1); }
console.log("ok");
