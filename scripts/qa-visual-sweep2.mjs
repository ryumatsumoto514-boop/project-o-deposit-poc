import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
const CHAIN_ID_HEX = "0x66eee";

const page = await newTab();
try {
  const { targetId, webSocketDebuggerUrl } = page;
  await shot(page, {
    url: `${BASE_URL}/deposit/approve`,
    out: "sweep-approve-scrolled",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "cryptoqueen", mockIdentity: "email", draftAmount: "42.5", addressConfirmed: true },
    width: 390,
    height: 1900,
    waitMs: 1800,
    click: null,
  });
} finally {
  await closeTab(page.id);
}
