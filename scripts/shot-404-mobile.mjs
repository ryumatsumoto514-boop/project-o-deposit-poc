import { newTab, closeTab, shot } from "./screenshot.mjs";

const page = await newTab();
await shot(page, {
  url: "https://projecto-blond.vercel.app/this-route-does-not-exist",
  out: "shot-404-mobile",
  width: 375,
  height: 812,
  mobile: true,
  waitMs: 1500,
});
await closeTab(page.id);
console.log("done");
