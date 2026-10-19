// Checks the deposit flow at a tablet width (768px) — a breakpoint between
// the heavily-tested mobile (320-390px) and desktop (1280px) widths that
// prior cycles only mentioned in passing without a direct screenshot.
import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
const OUT_DIR = process.argv[3] || "/tmp/tablet-768";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";

const seedFlow = {
  mockIdentity: "demo@exchangeo.test",
  draftAmount: "250.00",
  approvalMode: "exact",
  addressConfirmed: true,
};

const fs = await import("node:fs");
fs.mkdirSync(OUT_DIR, { recursive: true });

const pages = [
  { url: `${BASE_URL}/?ref=kol_alex`, out: "home-768", seedFlow: null },
  { url: `${BASE_URL}/deposit/amount`, out: "amount-768", seedFlow: { ...seedFlow, draftAmount: "" } },
  { url: `${BASE_URL}/deposit/confirm`, out: "confirm-768", seedFlow: { ...seedFlow, addressConfirmed: false } },
  { url: `${BASE_URL}/deposit/approve`, out: "approve-768", seedFlow },
];

for (const p of pages) {
  const page = await newTab();
  try {
    await shot(page, {
      url: p.url,
      out: p.out,
      wallet: WALLET,
      chainIdHex: "0x66eee",
      seedFlow: p.seedFlow,
      width: 768,
      height: 1024,
      mobile: false,
      waitMs: 1500,
    });
  } finally {
    await closeTab(page.id ?? page.targetId);
  }
}
console.log("done:", OUT_DIR);
