// Checks the AppHeader's 3-pill layout (GAS / SEPOLIA / wallet address) right
// at and above the `sm` (640px) breakpoint where the gas pill first appears,
// with a wallet actually connected (not just the 2-pill disconnected state
// already checked by check-gas-pill-breakpoint.mjs).
import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
const CHAIN_ID_HEX = "0x66eee";

const widths = [640, 700, 768];
for (const width of widths) {
  const tab = await newTab();
  try {
    await shot(tab, {
      url: `${BASE}/deposit`,
      out: `connect-setup-${width}`,
      wallet: WALLET,
      chainIdHex: CHAIN_ID_HEX,
      width,
      height: 500,
      mobile: false,
      click: "Connect",
      waitMs: 1500,
    });
    await shot(tab, {
      url: `${BASE}/`,
      out: `home-connected-${width}`,
      width,
      height: 500,
      mobile: false,
      waitMs: 1200,
    });
  } finally {
    await closeTab(tab.id);
  }
}
console.log("done");
