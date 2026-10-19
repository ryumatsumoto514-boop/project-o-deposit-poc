// Checks for layout issues at a very wide desktop viewport (2560px) —
// never previously tested per OVERNIGHT_LOG.md grep (only narrow/mobile
// widths and the two page-shell variants' max-width classes were verified
// by reading CSS, not by actually rendering at this size).
import { shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const OUT_DIR = "/tmp/ultrawide-shots";

const pages = [
  { url: `${BASE_URL}/?ref=kol_alex`, out: "01-home.png" },
  { url: `${BASE_URL}/login`, out: "02-login.png" },
];

for (const p of pages) {
  await shot(null, { ...p, width: 2560, height: 1440, out: `${OUT_DIR}/${p.out}` });
}
console.log("done");
