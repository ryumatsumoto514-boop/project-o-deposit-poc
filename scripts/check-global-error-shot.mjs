import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = process.argv[2] || "http://localhost:3100";
const OUT_DIR = "/tmp/global-error-shots";

const page = await newTab();
await shot(page, { url: BASE_URL + "/", out: "global-error", width: 390, height: 844, waitMs: 2500 });
await closeTab(page.id);
console.log("done");
