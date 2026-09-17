# Testnet Evidence — Deposit Reconciliation Engine PoC

This documents the real, on-chain testnet transactions backing this PoC. All
transactions below are independently verifiable on **Arbiscan Sepolia**
(https://sepolia.arbiscan.io) — no hash below is invented; every one was
submitted by a script in `scripts/` during this build and confirmed on-chain
before being recorded here.

## Why a self-deployed mock ERC-20 instead of official Circle testnet USDC

SPEC.md's preferred path was Circle's official Arbitrum Sepolia testnet USDC
(`0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`, verified live on-chain). We
could not get testnet USDC onto either the relayer wallet or a test user
wallet:

- `faucet.circle.com`'s public drip page returned **HTTP 404** for its
  unauthenticated API endpoint overnight — the current version of that
  faucet requires a Circle Developer account API key (`Authorization: Bearer
  <token>`), which we don't have and can't obtain without a human signing up.
- Neither wallet had a pre-existing testnet USDC balance to test with.

Per OVERNIGHT_BRIEF.md's explicit fallback guidance, we deployed a minimal
mock ERC-20 (`MockUSDC`, `scripts/MockUSDC.sol`) with **identical
`approve()` / `transferFrom()` / `balanceOf()` / `allowance()` semantics** to
real USDC (6 decimals, standard ERC-20). The reconciliation engine, UI, and
state machine treat it exactly as they would real USDC — only the constant
in `lib/chain.ts` (`USDC_ADDRESS`) would need to change to point at real
Circle USDC once a faucet API key is available. This substitution is
labeled here, in `lib/chain.ts`, and in `README.md` — it is not hidden.

The "test user" wallet referenced in earlier planning notes
(`0x1e9d508D...`) had no recoverable private key in this environment and
held 0 ETH / 0 USDC, so a **fresh throwaway wallet** was generated instead
(`scripts/setup-test-user.js`) and funded from the relayer. Both wallets are
testnet-only and hold no real value.

## 1. MockUSDC contract deployment

| Field | Value |
|---|---|
| Network | Arbitrum Sepolia (chain id `421614`) |
| Contract address | [`0x950A2C07CD9d6489691625272a8f9f4df4D0342C`](https://sepolia.arbiscan.io/address/0x950A2C07CD9d6489691625272a8f9f4df4D0342C) |
| Deploy tx hash | [`0xa102d9af190a53964805c43a89f5f1d53b7bca2a80162f9962a3ae48b39c10fd`](https://sepolia.arbiscan.io/tx/0xa102d9af190a53964805c43a89f5f1d53b7bca2a80162f9962a3ae48b39c10fd) |
| Deploy block | 309872783 |
| Deployer | `0xCEfAe626B7CFfC6Ab72f7df4F9609018Ee5a09a6` (relayer wallet) |
| Reproduce | `node scripts/deploy-mock-usdc.js` |

## 2. Funding the test user wallet

A fresh test-user wallet was generated and funded with gas + mock USDC by
the relayer, so it could act as the "depositor" in the flow below.

| Field | Value |
|---|---|
| Test user address | `0x1dF4656F7c33499F3Bf1E230B4A4c0e86e8D6537` |
| Gas funding tx (ETH, relayer → test user) | [`0x018e1b8182927808b262d507ec370d385186b4c8d91e1f9ee7ba150b3ff68a01`](https://sepolia.arbiscan.io/tx/0x018e1b8182927808b262d507ec370d385186b4c8d91e1f9ee7ba150b3ff68a01) |
| mUSDC transfer tx (relayer → test user, 100 mUSDC) | [`0xf45b244749a56abee5f457f4079e631fe3024603cf81853702a4ec743e848b16`](https://sepolia.arbiscan.io/tx/0xf45b244749a56abee5f457f4079e631fe3024603cf81853702a4ec743e848b16) |
| Reproduce | `node scripts/setup-test-user.js` |

## 3. The core deposit proof: real `approve()` + `transferFrom()`

This is the required real state-changing transaction pair simulating the
happy-path deposit flow: the "user" (test wallet) signs an **exact-amount**
`approve()`, then the "deposit contract" (relayer wallet, playing the role
described in `lib/relayer.ts`) signs `transferFrom()` to pull the funds —
exactly the pattern the live app performs for a real MetaMask user via
`app/deposit/approve/page.tsx` → `/api/deposits/[id]/pull`.

**Inputs:** depositor = `0x1dF4656F7c33499F3Bf1E230B4A4c0e86e8D6537`, deposit
address = `0xCEfAe626B7CFfC6Ab72f7df4F9609018Ee5a09a6`, amount = 25.0 mUSDC
(exact, matches the "approve exact amount, not unlimited" UX requirement).

| Step | Tx hash | Block | Result |
|---|---|---|---|
| 1. `approve(relayer, 25000000)` — signed by test user | [`0xc110d16ae895b7bc9ec8483c6c788a3967f072b16eaaeb0964d46b6f1a3f6022`](https://sepolia.arbiscan.io/tx/0xc110d16ae895b7bc9ec8483c6c788a3967f072b16eaaeb0964d46b6f1a3f6022) | 309873172 | success |
| 2. `transferFrom(testUser, relayer, 25000000)` — signed by relayer | [`0xbaf69d4752b4f1e3a54614e71a1eb25b0c7b553bb829c5a8a5111df1e513e723`](https://sepolia.arbiscan.io/tx/0xbaf69d4752b4f1e3a54614e71a1eb25b0c7b553bb829c5a8a5111df1e513e723) | 309873206 | success |

**Balance / allowance state:**

| | User (depositor) mUSDC balance | Relayer (deposit address) mUSDC balance | Allowance (user → relayer) |
|---|---|---|---|
| Before | 100.0 | 999900.0 | 0.0 |
| After `approve()` | 100.0 | 999900.0 | 25.0 |
| After `transferFrom()` | 75.0 | 999925.0 | 0.0 (fully consumed — exact amount, no leftover approval) |

**Expected vs actual:** expected the depositor's balance to drop by exactly
25.0 and the deposit address's balance to rise by exactly 25.0, with the
allowance fully consumed back to 0 afterward (proving the "exact amount"
approval — not unlimited — was correctly scoped and spent). Actual result
matched exactly.

**Reproduce:** `node scripts/run-real-deposit-proof.js` (requires
`.env.local` with `ARBITRUM_RELAYER_PRIVATE_KEY` and
`.data/testnet-evidence.json` with the test user's key, both gitignored,
PoC-scope-only, no real value).

**What this validates:** that the exact two-transaction pattern
(`approve(exact)` → `transferFrom`) the live app's deposit flow performs
works correctly on real Arbitrum Sepolia infrastructure, with real gas,
real nonces, real block confirmations, and a real allowance state machine.

**What this does NOT validate:** it does not exercise the MetaMask
signature-popup UX itself (no human was available to click through it
overnight — see README "known limitations"), and it does not touch
Hyperliquid in any way (the Hyperliquid-side "credited" check is explicitly
mocked throughout, see `lib/hyperliquidMock.ts`).

## 4. Full state machine exercised live through the app's own API routes

Beyond the scripted proof above, the actual `/api/deposits`,
`/api/deposits/[id]/reconcile`, and `/api/deposits/[id]/pull` routes were
exercised against a running `npm run dev` instance with a second real
approve() transaction, to confirm the reconciliation engine itself (not
just the raw chain calls) works end-to-end:

1. A fresh `approve(relayer, 10000000)` (10.0 mUSDC) was signed by the test
   user: tx [`0xb1c1caa7d1b37c5848434d24d509fd17585611d389a914587146a8ee259d956a`](https://sepolia.arbiscan.io/tx/0xb1c1caa7d1b37c5848434d24d509fd17585611d389a914587146a8ee259d956a).
2. `POST /api/deposits` created a record in `SIGNED` state referencing that
   approve tx hash.
3. `POST /api/deposits/[id]/reconcile` (the same endpoint the status-tracker
   UI polls) independently verified the approve tx succeeded on-chain, then
   triggered the relayer's real `transferFrom()` — producing a **new** real
   tx hash: [`0x1f5988767d76b9048096780911ca6d21e1dc055bb7724272d2ea086410b8c59c`](https://sepolia.arbiscan.io/tx/0x1f5988767d76b9048096780911ca6d21e1dc055bb7724272d2ea086410b8c59c).
   Status moved to `SIGNED` (with `txHash` now set).
4. Polling `reconcile` again ~13s later: the engine independently re-read
   the transfer's receipt via RPC, confirmed `status: success`, and
   transitioned the record to `CONFIRMED_ONCHAIN`
   (`onchainConfirmed: true`, `onchainConfirmedAt` frozen to that moment).
5. Polling again ~25s after on-chain confirmation: the mocked Hyperliquid
   check agreed (elapsed time past its 15s minimum), and the engine
   transitioned the record to `CREDITED` — the only true "done" state.

This confirms the reconciliation engine's core claim: it does not trust a
single "pending → done" signal, it independently checks the real on-chain
receipt AND the (mocked) Hyperliquid-side signal, and only calls a deposit
done when both agree.

## 5. Duplicate-deposit blocking — verified working

With the deposit above still in `SIGNED` state (not yet `CREDITED`),
`POST /api/deposits` was called again with the **same wallet + same
amount** (25.0 mUSDC) and a different (fake) approve tx hash:

```
HTTP 409
{
  "error": "DUPLICATE_IN_FLIGHT",
  "message": "You already have a deposit in progress for this amount,
    opened at 2026-09-17T14:53:12.605Z. Do not send again — here's its
    current status.",
  "deposit": { ...the original in-flight record... }
}
```

The second (duplicate) request was blocked before any new transaction was
attempted — this is the core hypothesis validation the assignment calls
for. Once the original deposit later reached `CREDITED`,
`GET /api/deposits/check?wallet=...&amount=...` correctly reported
`{"conflict": null}` — the block only applies while a deposit for that
wallet+amount is genuinely still in-flight, not permanently.

## Summary of all real transaction hashes (Arbiscan Sepolia)

| Purpose | Tx hash |
|---|---|
| MockUSDC deploy | `0xa102d9af190a53964805c43a89f5f1d53b7bca2a80162f9962a3ae48b39c10fd` |
| Fund test user (ETH gas) | `0x018e1b8182927808b262d507ec370d385186b4c8d91e1f9ee7ba150b3ff68a01` |
| Fund test user (mUSDC) | `0xf45b244749a56abee5f457f4079e631fe3024603cf81853702a4ec743e848b16` |
| approve(25.0) — scripted proof | `0xc110d16ae895b7bc9ec8483c6c788a3967f072b16eaaeb0964d46b6f1a3f6022` |
| transferFrom(25.0) — scripted proof | `0xbaf69d4752b4f1e3a54614e71a1eb25b0c7b553bb829c5a8a5111df1e513e723` |
| approve(10.0) — via live API/engine | `0xb1c1caa7d1b37c5848434d24d509fd17585611d389a914587146a8ee259d956a` |
| transferFrom(10.0) — triggered by `/reconcile` | `0x1f5988767d76b9048096780911ca6d21e1dc055bb7724272d2ea086410b8c59c` |

All seven are real, confirmed, independently verifiable Arbitrum Sepolia
transactions. None are invented.
