import { newTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";

const tab = await newTab();
await shot(tab, { url: `${BASE}/deposit?ref=kol_alex`, out: "03-deposit-longwait", waitMs: 8000 });
process.exit(0);
