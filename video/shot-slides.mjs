// Renders each deck slide to a PNG so layout can be checked without a GUI.
// Usage: node video/shot-slides.mjs file:///opt/data/projecto/video/slides.html video/.shots
import { newTab, closeTab, shot, BASE_URL } from "../scripts/screenshot.mjs";

for (let n = 1; n <= 9; n++) {
  const page = await newTab();
  try {
    await shot(page, {
      url: `${BASE_URL}#${n}`,
      out: `slide-${String(n).padStart(2, "0")}`,
      width: 1280,
      height: 720,
      mobile: false,
      waitMs: 900,
    });
  } catch (e) {
    console.error(`  [error] slide ${n}:`, e.message);
  } finally {
    await closeTab(page.id);
  }
}
