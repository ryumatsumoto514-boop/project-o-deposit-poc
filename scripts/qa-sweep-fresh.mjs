import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const OUT_DIR = "shots-out/fresh-sweep";

const pages = [
  { url: `${BASE_URL}/?ref=whale_signals`, out: "landing-kol-mobile" },
  { url: `${BASE_URL}/?ref=whale_signals`, out: "landing-kol-desktop", width: 1440, height: 900, mobile: false },
  { url: `${BASE_URL}/login`, out: "login-mobile" },
  { url: `${BASE_URL}/deposit`, out: "deposit-mobile", wallet: "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5", chainIdHex: "0x66eee" },
];

for (const p of pages) {
  const page = await newTab();
  try {
    await shot(page, { ...p, waitMs: 1800 });
  } catch (e) {
    console.error(`FAILED ${p.out}: ${e.message}`);
  }
  await closeTab(page.id);
}
