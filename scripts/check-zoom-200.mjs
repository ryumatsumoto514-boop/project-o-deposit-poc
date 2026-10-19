// WCAG 1.4.4 (resize text to 200%) approximation: browser zoom roughly halves
// the effective CSS viewport while keeping the same content, so a 1280x800
// desktop window at 200% zoom ~= a 640x400 layout viewport. Never checked in
// this log (grepped for "200%"/"browser zoom"/"text reflow" - zero hits).
import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT = "shots-zoom200";

const pages = [
  { url: `${BASE}/`, out: "home" },
  { url: `${BASE}/login`, out: "login" },
  { url: `${BASE}/?ref=kol_alex`, out: "home-kol" },
];

for (const p of pages) {
  const page = await newTab();
  await shot(page, {
    url: p.url,
    out: p.out,
    width: 640,
    height: 400,
    mobile: false,
    waitMs: 1500,
  });
  await closeTab(page.targetId);
}
console.log("done");
