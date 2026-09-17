# Exchange O — Deposit Reconciliation Engine (PoC)

A proof of concept for a hiring assignment. Simulates the deposit leg of
"Exchange O," a KOL-driven DEX where users deposit USDC on Arbitrum and
trade it as collateral on Hyperliquid. The feature under test: a **Deposit
Reconciliation Engine** — a real backend state machine that tracks a
deposit from signature to tradable collateral, instead of a spinner that
says "pending" until a receipt shows up.

See `SPEC.md` for the full assignment brief.

## Live deployment

See `OVERNIGHT_LOG.md` for the deployment attempt status — Vercel deploy
requires a `VERCEL_TOKEN` that may or may not have been available overnight;
check there for the final URL or the documented blocker.

## What's real vs. mocked (read this first)

| Piece | Status |
|---|---|
| Wallet connection (MetaMask via wagmi/viem) | **Real** (SDK-wired; not manually click-tested overnight — no human available, see limitations) |
| Arbitrum Sepolia network (chain id 421614) | **Real** testnet |
| USDC contract (`0x950A2C07CD9d6489691625272a8f9f4df4D0342C`) | **A self-deployed mock ERC-20 ("MockUSDC"), NOT Circle's official testnet USDC.** Circle's real testnet USDC exists at `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`, but its public faucet (`faucet.circle.com`) now requires an authenticated Circle API key we don't have, and neither wallet had a pre-existing balance. MockUSDC has identical `approve()`/`transferFrom()`/`balanceOf()` semantics (6 decimals) and was deployed live to Arbitrum Sepolia — see `testnet-evidence.md` for the deploy tx. Swapping back to real Circle USDC is a one-line change in `lib/chain.ts`. |
| `approve()` transaction, exact amount (or unlimited, opt-in) | **Real**, signed and confirmed on Arbitrum Sepolia — see `testnet-evidence.md` for tx hashes (both a scripted proof and one triggered through the app's own live API) |
| `transferFrom()` pulling the approved USDC to the deposit address | **Real** transaction, signed by a testnet-only relayer wallet, confirmed on-chain — see `testnet-evidence.md` |
| On-chain confirmation check (`CONFIRMED_ONCHAIN`) | **Real** — the engine independently reads the transaction receipt via RPC, it does not trust the client. Verified live: see "state machine exercised live" in `testnet-evidence.md`. |
| Duplicate-deposit blocking | **Real and verified working** — tested against the live API, returns HTTP 409 with the existing in-flight deposit. See `testnet-evidence.md` §5. |
| Login (email / Google) | **Mocked** — no real Privy/OAuth. Clicking either button just sets a fake identity string. There is no real authentication in this PoC. |
| Hyperliquid balance / "collateral credited" check | **Mocked** — we do not have Hyperliquid testnet access. A timer (15–30s after on-chain confirmation) simulates the balance becoming available. This is labeled in the UI on every status screen. |
| "Trading account" / destination account shown to the user | **Mocked** — deterministically derived from the wallet address, cosmetic only, not a real Hyperliquid account |
| Data store | **Mocked/PoC-scope** — an in-memory `Map`, backed by a local JSON file (`.data/deposits.json`) so it survives dev-server reloads. Not a real database. Wiped on redeploy. |

**The one thing that must be real and is:** the approve() + transferFrom()
pair moving actual testnet ERC-20 tokens (a self-deployed mock USDC, see
above) from a wallet to a designated deposit address on Arbitrum Sepolia,
with the reconciliation engine's state machine independently verifying it
via RPC — not the client's word for it. Full details and every tx hash in
`testnet-evidence.md`. Everything about "is it now tradable on Hyperliquid"
downstream of on-chain confirmation is explicitly mocked, because
Hyperliquid testnet access isn't available to us — see SPEC.md.

## The relayer wallet (why it exists)

The spec's preferred pattern is `approve(exact amount)` + `transferFrom()`,
where `transferFrom` "simulates the deposit contract call." Since we don't
have a deployed deposit contract, a small testnet-only EOA (an ordinary
wallet, not a smart contract) plays that role: the user approves it as a
spender, then it calls `transferFrom(user, itself, amount)` to pull the
funds — a real on-chain state change, using the real allowance the user
just granted.

This wallet:
- Holds **no real value**, ever. Its private key lives in `.env.local`
  (gitignored) and is never committed.
- Needs a trivial amount of Arbitrum Sepolia ETH to pay gas for the
  `transferFrom` calls it submits. It is currently **unfunded** — see
  "Running the real on-chain flow" below.

## Setup

```bash
npm install
cp .env.example .env.local
```

Generate a relayer keypair and fill in `.env.local`:

```bash
node -e "const{generatePrivateKey,privateKeyToAccount}=require('viem/accounts');const k=generatePrivateKey();console.log('ARBITRUM_RELAYER_PRIVATE_KEY='+k);console.log('NEXT_PUBLIC_DEPOSIT_ADDRESS='+privateKeyToAccount(k).address)"
```

Paste the two output lines into `.env.local`. Then send a small amount of
Arbitrum Sepolia ETH (e.g. 0.01 ETH — gas only) to the printed address, via
any Arbitrum Sepolia faucet or from your own wallet.

```bash
npm run dev
```

Open http://localhost:3000.

## Running the real on-chain flow

1. Fund the relayer address (see above) with a small amount of Arbitrum
   Sepolia ETH.
2. Get a MetaMask (or other injected-wallet) account with:
   - A small amount of Arbitrum Sepolia ETH (gas for the `approve()` tx).
   - Some MockUSDC on Arbitrum Sepolia — since Circle's official faucet
     requires an API key we don't have (see the table above), mint yourself
     some by calling `transfer()` from the relayer address (which holds the
     initial MockUSDC supply) — see `scripts/setup-test-user.js` for the
     pattern, or use any block explorer's "Write Contract" tab against
     `0x950A2C07CD9d6489691625272a8f9f4df4D0342C`.
3. Add Arbitrum Sepolia to MetaMask if it isn't already there (chain id
   `421614`).
4. Open the app, click through: landing → sign in (mock) → connect wallet →
   enter an amount → confirm the destination address → choose an approval
   scope → Approve & deposit.
5. Approve the transaction in your wallet. The app will then submit the
   `transferFrom()` via the relayer automatically and take you to the
   status tracker, which polls the reconciliation engine every few seconds.
6. Once confirmed on-chain, wait ~15–30s for the (mocked) Hyperliquid check
   to agree — the deposit reaches `CREDITED`.

**Testnet transactions:** real — see `testnet-evidence.md` for every tx
hash, block number, and before/after balance state. No human clicked
through the MetaMask popup overnight (nobody was available), so the proof
was run two ways instead: (a) a standalone script signing both
`approve()`/`transferFrom()` directly with test private keys, and (b) the
same flow driven through the app's own live `/api/deposits*` routes
(including the reconciliation engine's automatic retry/pull logic) against
a running `npm run dev` instance — both produced real, confirmed Arbitrum
Sepolia transactions.

## Architecture

- `/app` — Next.js App Router pages: landing (KOL link capture) → mock
  login → deposit amount → address confirmation → approval → status
  tracker, plus the API routes under `/app/api/deposits`.
- `/lib` — the actual reconciliation engine:
  - `types.ts` — `DepositRecord`, `DepositStatus` state enum.
  - `stateMachine.ts` — allowed state transitions.
  - `store.ts` — the PoC-scope deposit store.
  - `chain.ts` — Arbitrum Sepolia config, USDC contract/ABI.
  - `relayer.ts` — server-only; submits the real `transferFrom()`.
  - `reconcile.ts` — the reconciliation loop: independently checks the
    real on-chain receipt *and* the mock Hyperliquid balance, and only
    marks `CREDITED` when both agree. Flags `AMBIGUOUS` instead of
    silently retrying forever if they disagree past a threshold.
  - `hyperliquidMock.ts` — the mocked Hyperliquid-side check.
  - `idempotency.ts` — duplicate in-flight deposit detection.
  - `failures.ts` — plain-language failure copy (assumes zero crypto
    background).

### State machine

```
SIGNED → CONFIRMED_ONCHAIN → BRIDGING → CREDITED
              │                  │
              └──────────────────┴──→ AMBIGUOUS (flagged, not auto-retried)
Any step can also fall into STALLED_NO_GAS or STALLED_TIMEOUT.
```

`CREDITED` is the only true "done" state, and is only reached when the
engine has independently verified both the real on-chain receipt and the
mocked Hyperliquid balance agree.

## Known limitations (PoC scope)

- **No real database.** An in-memory store backed by a local JSON file.
  Restarting on a different machine (e.g. a Vercel redeploy) loses all
  deposit records. Fine for a demo, not for production.
- **No real Hyperliquid integration.** The credited check is a timer, not
  a real balance read. Clearly labeled everywhere it appears.
- **No real authentication.** Login is a mocked identity string, not a
  real session or Privy integration.
- **MockUSDC, not official Circle testnet USDC.** Circle's real testnet
  USDC exists and is documented in `lib/chain.ts`, but its faucet requires
  an API key unavailable in this build; a self-deployed, identical-semantics
  mock ERC-20 was used instead. See `testnet-evidence.md` for full
  reasoning and every transaction.
- **No human click-through of the MetaMask signature popup overnight** —
  this PoC was built and tested autonomously while the user slept, so the
  real testnet transactions were produced by scripts holding test private
  keys directly and by driving the app's own live API routes, not by a
  person clicking "Approve" in an actual browser wallet extension. The
  underlying transactions, contract calls, and reconciliation logic are
  identical either way, but a manual UI click-through has not yet been
  performed by a human and is recommended before relying on this as final
  proof of the UI's wallet-signing path.
- **Single relayer wallet, single-threaded.** No queueing, retry, or nonce
  management beyond what viem does by default. Would need real
  infrastructure (a proper relayer service, monitoring, alerting) before
  this pattern could be trusted with real user funds.
- **No rate limiting or auth on the API routes.** Anyone who can reach the
  deployed app can call the deposit APIs directly.
- **Demo deposit cap** of 1000 USDC in the UI, arbitrary, just to keep test
  amounts sane.

## Primary metric + guardrails

**Primary metric:** percentage of deposits that reach `CREDITED` without
the user re-depositing (i.e., without hitting the idempotency block) or
contacting support. This directly targets the brief's "duplicate deposit"
and "user panic" failure modes.

**Guardrails:**
- **Time-to-CREDITED (p50/p90).** If typical deposits start taking
  meaningfully longer, that's a leading indicator of a real bridging
  problem, not just UI perception — the engine should be flagging
  `AMBIGUOUS`/`STALLED_TIMEOUT` cases, and those rates should be watched
  directly.
- **AMBIGUOUS rate.** This state exists specifically so we never silently
  retry forever; if it starts trending up, on-chain and Hyperliquid-side
  reconciliation is genuinely disagreeing more often and needs
  investigation, not a longer timeout.
- **Duplicate-deposit block rate.** Should stay low in steady state; a
  spike means the status UI isn't reassuring users fast enough that their
  first deposit is progressing.
