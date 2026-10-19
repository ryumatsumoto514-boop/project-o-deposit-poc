import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT = "shots-out";

const page = await newTab();
try {
  await shot(page, {
    url: `${BASE}/login`,
    out: "login-before-connect",
    width: 375,
    height: 812,
    wallet: "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37",
    chainIdHex: "0x66eee",
    waitMs: 1500,
  });
  await shot(page, {
    url: `${BASE}/login`,
    out: "login-after-connect",
    width: 375,
    height: 812,
    wallet: "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37",
    chainIdHex: "0x66eee",
    waitMs: 1500,
    click: "Sign in with",
  });
} finally {
  await closeTab(page.id);
}
console.log("done");
