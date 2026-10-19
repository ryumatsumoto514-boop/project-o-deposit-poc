import { newTab, closeTab, shot } from "./screenshot.mjs";
const ID = process.argv[2];
const page = await newTab();
await shot(page, {
  url: `https://projecto-blond.vercel.app/deposit/status/${ID}`,
  out: "vcenter-short-1280x720",
  width: 1280,
  height: 720,
  waitMs: 5000,
});
await closeTab(page.id);
console.log("done");
