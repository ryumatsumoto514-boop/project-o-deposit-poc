// Fresh-eyes desktop visual sweep — captures real screenshots of key routes
// so they can actually be looked at, rather than just curled/parsed as HTML.
import { newTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";
const routes = [
  { url: `${BASE_URL}/?ref=kol_alex`, out: "home", width: 1280, height: 900, mobile: false },
  { url: `${BASE_URL}/login`, out: "login", width: 1280, height: 900, mobile: false },
  {
    url: `${BASE_URL}/deposit`,
    out: "deposit",
    width: 1280,
    height: 900,
    mobile: false,
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "25", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE_URL}/deposit/confirm`,
    out: "confirm",
    width: 1280,
    height: 900,
    mobile: false,
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "25", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE_URL}/deposit/approve`,
    out: "approve",
    width: 1280,
    height: 900,
    mobile: false,
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "25", approvalMode: "exact", addressConfirmed: true },
  },
];

for (const r of routes) {
  const page = await newTab();
  await shot(page, r);
  await fetch("http://127.0.0.1:9333/json/close/" + page.id);
}
