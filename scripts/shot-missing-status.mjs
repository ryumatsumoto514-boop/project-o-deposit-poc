import { newTab, closeTab, shot } from "./screenshot.mjs";

const page = await newTab();
try {
  await shot(page, {
    url: "https://projecto-blond.vercel.app/deposit/status/doesnotexist",
    out: "missing-status-mobile",
    waitMs: 11000,
  });
} catch (e) {
  console.error(`FAILED: ${e.message}`);
}
await closeTab(page.id);
