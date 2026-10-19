import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
// Deliberately NOT EIP-55 checksummed (mixed case is arbitrary), to match
// how a real injected wallet provider's raw eth_accounts response would
// look before any normalization.
const WALLET = "0x9a11f5b6d8c2a7e4c1d3f0b8e6a9c4d7f2b1a3e5";
const CHAIN_ID_HEX = "0x66eee";

const page = await newTab();
try {
  await shot(page, {
    url: `${BASE}/login`,
    out: "identity-1-connect",
    width: 375,
    height: 812,
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    waitMs: 1200,
    click: "Continue with connect",
  });
  await shot(page, {
    url: `${BASE}/deposit`,
    out: "identity-2-deposit",
    width: 375,
    height: 812,
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    waitMs: 1500,
  });
} finally {
  await closeTab(page.id);
}
console.log("done");
