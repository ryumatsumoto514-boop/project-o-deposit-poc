import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";
const page = await newTab();
await shot(page, {
  url: `${BASE_URL}/deposit/confirm`, out: "confirm-375-longwait", wallet: WALLET, chainIdHex: CHAIN_ID_HEX,
  seedFlow: { draftAmount: "125.50", approvalMode: "exact", kolRef: "cryptoalpha", mockIdentity: "demo.user" },
  width: 375, height: 812, waitMs: 6000,
});
await closeTab(page.id);
