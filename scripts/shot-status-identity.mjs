// usage: node scripts/shot-status-identity.mjs <baseUrl> <outDir> <depositId>
import { newTab, closeTab, shot } from "./screenshot.mjs";

const ID = process.argv[4];

const page = await newTab();
try {
  await shot(page, { url: `${process.argv[2]}/deposit/status/${ID}`, out: "status-identity", waitMs: 2500 });
} finally {
  await closeTab(page.id);
}
