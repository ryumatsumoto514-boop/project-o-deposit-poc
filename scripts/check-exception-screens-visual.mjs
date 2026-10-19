// No prior cycle had ever actually screenshotted the STALLED_NO_GAS /
// AMBIGUOUS exception screens live (grep of OVERNIGHT_LOG.md for scripts
// referencing those statuses turned up zero hits) despite the brief calling
// out exception screens by name as needing deliberate, reassuring design.
// This seeds a real deposit record via the live API (POST then PATCH to
// STALLED_NO_GAS, same path a genuinely-stalled user would hit) and shoots
// the actual /deposit/status/[id] page at mobile width.
import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const id = process.argv[2];
if (!id) {
  console.error("usage: node scripts/check-exception-screens-visual.mjs <depositId>");
  process.exit(1);
}

const tab = await newTab();
try {
  await shot(tab, {
    url: `${BASE}/deposit/status/${id}`,
    out: "exception-stalled-no-gas",
    width: 390,
    height: 844,
    waitMs: 3500,
  });
  console.log("saved shots-out/exception-stalled-no-gas.png");
} finally {
  await closeTab(tab.id);
}
