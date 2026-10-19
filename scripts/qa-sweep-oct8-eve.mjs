import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT = "/tmp/qa-sweep-oct8-eve";

const WALLET = "0x3f2C9A1e5B7d4F8a0C6e2D9b1A4f7E3c8B5d0A62";
const seedFlow = {
  mockIdentity: "demo.user@gmail.com",
  amount: "250",
  approvalScope: "exact",
  addressConfirmed: true,
  kolRef: "whaleAlpha",
};

const targets = [
  { url: `${BASE}/`, out: "home-375", width: 375, height: 812 },
  { url: `${BASE}/login`, out: "login-375", width: 375, height: 812 },
  { url: `${BASE}/?ref=whaleAlpha`, out: "home-kol-375", width: 375, height: 812 },
];

for (const t of targets) {
  const page = await newTab();
  await shot(page, t);
  await closeTab(page.targetId);
}

console.log("done");
