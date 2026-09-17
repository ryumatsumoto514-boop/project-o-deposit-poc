import fs from "node:fs";
import path from "node:path";
import type { DepositRecord } from "./types";

// PoC-scope persistence: an in-memory Map backed by a JSON file on disk so
// data survives dev-server hot reloads. NOT a real database — see README
// "Known limitations". Do not use this in production.
//
// Vercel's serverless functions have a read-only filesystem everywhere
// except /tmp, and /tmp itself is wiped between cold starts / not shared
// across instances. So on Vercel this file is best-effort only — the
// module-level in-memory Map (below) is what actually keeps state alive
// across requests within the same warm lambda instance, which is the real
// persistence mechanism in production. Locally, the JSON file gives real
// persistence across dev-server restarts.
const DATA_FILE = process.env.VERCEL
  ? path.join("/tmp", "projecto-deposits.json")
  : path.join(process.cwd(), ".data", "deposits.json");

function loadFromDisk(): Map<string, DepositRecord> {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const arr = JSON.parse(raw) as DepositRecord[];
    return new Map(arr.map((d) => [d.id, d]));
  } catch {
    return new Map();
  }
}

function persistToDisk(map: Map<string, DepositRecord>) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(Array.from(map.values()), null, 2));
  } catch (err) {
    // Non-fatal: the in-memory Map is still authoritative for this
    // process. Don't let a filesystem hiccup crash the API route.
    console.error("depositStore: failed to persist to disk", err);
  }
}

// Module-level singleton, reused across API route invocations within the
// same server process.
const globalForStore = globalThis as unknown as {
  __depositStore?: Map<string, DepositRecord>;
};

const deposits = globalForStore.__depositStore ?? loadFromDisk();
globalForStore.__depositStore = deposits;

export const depositStore = {
  create(record: DepositRecord) {
    deposits.set(record.id, record);
    persistToDisk(deposits);
    return record;
  },
  get(id: string): DepositRecord | undefined {
    return deposits.get(id);
  },
  update(id: string, patch: Partial<DepositRecord>): DepositRecord | undefined {
    const existing = deposits.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    deposits.set(id, updated);
    persistToDisk(deposits);
    return updated;
  },
  list(): DepositRecord[] {
    return Array.from(deposits.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  findInFlightByWalletAndAmount(
    userWallet: string,
    amount: string
  ): DepositRecord | undefined {
    return Array.from(deposits.values()).find(
      (d) =>
        d.userWallet?.toLowerCase() === userWallet.toLowerCase() &&
        d.amount === amount &&
        d.status !== "CREDITED"
    );
  },
};
