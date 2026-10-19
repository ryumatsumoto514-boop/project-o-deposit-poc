import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
const OUT = "/tmp/shots1";

const targets = [
  { url: `${BASE}/?ref=kol_alex`, out: "home-kol", width: 390, height: 844 },
  { url: `${BASE}/login?ref=kol_alex`, out: "login-kol", width: 390, height: 844 },
  {
    url: `${BASE}/deposit`,
    out: "deposit-roles",
    width: 390,
    height: 844,
    wallet: WALLET,
    chainIdHex: "0x66eee",
    seedFlow: { step: "amount", kolRef: "kol_alex" },
  },
];

for (const t of targets) {
  const page = await newTab();
  await shot(page, { ...t, waitMs: 1800 });
  await closeTab(page.id);
}
