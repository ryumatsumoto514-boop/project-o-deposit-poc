import { newTab, closeTab, shot } from "./screenshot.mjs";
const ID = process.argv[2];
const page = await newTab();
await shot(page, {
  url: `https://projecto-blond.vercel.app/deposit/status/${ID}`,
  out: "stalled-no-gas-375",
  width: 375,
  height: 1400,
  waitMs: 4000,
});
await closeTab(page.id);
console.log("done");
