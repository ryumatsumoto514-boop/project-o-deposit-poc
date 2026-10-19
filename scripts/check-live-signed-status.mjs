// Screenshots the real live status page for a deposit record actually
// created via the production API (SIGNED state), to visually confirm the
// SIGNED step renders correctly for a genuine record rather than curl-only.
import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const ID = process.argv[2];
if (!ID) {
  console.error("usage: node scripts/check-live-signed-status.mjs <depositId>");
  process.exit(1);
}

const page = await newTab();
await shot(page, {
  url: `${BASE}/deposit/status/${ID}`,
  out: "live-signed-status",
  waitMs: 2500,
  width: 390,
  height: 844,
});
await closeTab(page.id);
