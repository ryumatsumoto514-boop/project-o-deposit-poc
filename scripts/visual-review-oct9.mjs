import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x9A113b3f5A4792c8639f1b1C5c8b4b8c9F0eA3E5";

const pages = [
  { url: `${BASE}/`, out: "rev-home" },
  { url: `${BASE}/login?ref=kol_alex`, out: "rev-login" },
  {
    url: `${BASE}/deposit`,
    out: "rev-deposit",
    wallet: WALLET,
    chainIdHex: "0x66eee",
    seedFlow: { kolRef: "kol_alex", walletAddress: WALLET },
  },
  {
    url: `${BASE}/deposit/confirm`,
    out: "rev-confirm",
    wallet: WALLET,
    chainIdHex: "0x66eee",
    seedFlow: { kolRef: "kol_alex", walletAddress: WALLET, amount: "250.00" },
  },
  {
    url: `${BASE}/deposit/approve`,
    out: "rev-approve",
    wallet: WALLET,
    chainIdHex: "0x66eee",
    seedFlow: { kolRef: "kol_alex", walletAddress: WALLET, amount: "250.00" },
  },
];

for (const p of pages) {
  const page = await newTab();
  await shot(page, { ...p, width: 390, height: 844, waitMs: 1500 });
  await closeTab(page.id);
}
console.log("done");
