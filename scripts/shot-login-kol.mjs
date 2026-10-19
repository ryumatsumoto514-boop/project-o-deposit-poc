import { newTab, closeTab, shot } from "./screenshot.mjs";
const page = await newTab();
try {
  await shot(page, {
    url: "https://projecto-blond.vercel.app/login?ref=whale_signals_premium_alpha",
    out: "kol-login-mobile-check2",
    width: 390,
    height: 844,
    waitMs: 2500,
  });
} catch (e) {
  console.error("FAILED:", e.message);
}
await closeTab(page.id);
