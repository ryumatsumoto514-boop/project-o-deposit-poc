// One-off QA: verify the KOL banner now renders on a deep-link into /login
// (not just the landing page), after moving CaptureKolRef to app/providers.tsx.
import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = process.argv[2] || "http://localhost:3311";
const OUT_DIR = process.argv[3] || "/tmp/qa-login-kolref";
const fs = await import("node:fs");
fs.mkdirSync(OUT_DIR, { recursive: true });

const page = await newTab();
await shot(page, {
  url: `${BASE_URL}/login?ref=kol_alex`,
  out: "login-deeplink-kolref",
  waitMs: 1500,
  width: 390,
  height: 844,
});
await closeTab(page.id);
console.log("done");
