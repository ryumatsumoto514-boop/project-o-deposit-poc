import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const OUT_DIR = "shots-out";
const fs = await import("node:fs");
fs.mkdirSync(OUT_DIR, { recursive: true });

const page = await newTab();
await shot(page, {
  url: `${BASE_URL}/?ref=kolohe_surf`,
  out: "kol-prefix-fix",
  width: 390,
  height: 500,
});
await closeTab(page.id);
console.log("done");
