import { newTab, shot } from "./screenshot.mjs";
const widths = [220, 240, 260, 280, 300, 320, 340];
for (const w of widths) {
  const page = await newTab();
  await shot(page, {
    url: `file:///tmp/repro-${w}.html`,
    out: `orphan-${w}`,
    width: w + 32,
    height: 420,
    waitMs: 200,
  });
}
process.exit(0);
