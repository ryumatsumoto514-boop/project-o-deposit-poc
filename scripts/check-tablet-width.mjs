// Tablet-width (834px, iPad portrait) visual check — this breakpoint has
// near-zero prior coverage in OVERNIGHT_LOG.md (almost all prior checks are
// 375-390px mobile or 1280px+ desktop). Shoots the live production site's
// main pages at 834x1194 to look for layout gaps between those two
// extremes (e.g. a max-w-md column stranded in a sea of empty space with
// no intentional centering/background treatment, or a component that only
// has mobile/desktop breakpoints and looks broken in between).
import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";

const pages = [
  { url: `${BASE_URL}/`, out: "tablet-01-home" },
  { url: `${BASE_URL}/login`, out: "tablet-02-login" },
];

for (const p of pages) {
  const page = await newTab();
  await shot(page, { ...p, width: 834, height: 1194, mobile: false, waitMs: 1500 });
  await closeTab(page.targetId);
}
console.log("done -> shots-out/");
