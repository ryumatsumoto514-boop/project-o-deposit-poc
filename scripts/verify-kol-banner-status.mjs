import { newTab, closeTab, shot } from "./screenshot.mjs";

const page = await newTab();
try {
  await shot(page, {
    url: "https://projecto-blond.vercel.app/deposit/status/359a631b-9e01-4129-80dc-aa46f572e6fe",
    out: "verify-kol-banner-status",
    waitMs: 6000,
  });
} catch (e) {
  console.error(`FAILED: ${e.message}`);
}
await closeTab(page.id);
