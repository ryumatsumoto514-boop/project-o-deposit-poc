# Project O — Challenge 1: Deposit Breakdown & Improvement

**Submission by:** Ryu Matsumoto
**Selected challenge:** Challenge 1 — Deposit Breakdown & Improvement
**Live PoC:** https://projecto-blond.vercel.app
**Source code:** https://github.com/ryumatsumoto514-boop/project-o-deposit-poc

---

## 1. The Deposit Journey Today (Breakdown)

The deposit journey runs from a KOL touchpoint to tradable collateral on Hyperliquid. Below, each step is tagged by **who is responsible** (User / Project O / External provider) and what its real completion criterion is — not just "a screen changed."

| # | Step | Responsible | Input → Output | Real failure/delay modes |
|---|------|-------------|-----------------|---------------------------|
| 1 | Arrive via KOL content/link | KOL/partner → Project O | Click w/ attribution param → lands on Exchange O | Broken/expired link; attribution lost if the param drops before login |
| 2 | Sign in (email / Google / wallet) | User + Project O (Privy) | Credential → session + wallet reference | User picks a method that doesn't match where their funds already sit |
| 3 | Identify funding source | User | Existing CEX withdrawal wallet → recognized address | User doesn't know their own address/network; unfamiliar with "which wallet has the money" |
| 4 | Get funds + gas onto Arbitrum | User + external bridge/CEX | Source-chain USDC → Arbitrum USDC + ETH for gas | **No gas token on destination chain** — a common, well-documented dead-end for first-time users |
| 5 | Approve token spend | User + Project O contract | Signed approval → allowance set | Defaults to unlimited allowance; user doesn't understand the popup |
| 6 | Submit deposit tx | User + Project O + external provider | Signed tx → **transaction receipt** | Receipt is issued; this is *not* the same as funds being usable — this is the trap |
| 7 | Collateral reflected on Hyperliquid | External provider (Hyperliquid) | Tx confirmed → account balance credited | Real delay between "tx confirmed" and "credited," with **no visibility** into this gap today |
| 8 | User sees "ready to trade" | Project O | Collateral present → UI shows tradable balance | If step 7 is silent, the user assumes failure and may **re-deposit** — a real, documented failure pattern (see §3) |

**Where the login wallet, source-of-funds wallet, and trading account can differ:** steps 2, 3, and 7 can each reference a *different* address. Nothing in the current flow labels which address is playing which role — a login wallet, a funding wallet, and a Hyperliquid trading account are not guaranteed to match, and the user has no way to tell them apart on-screen today.

**Measurement events that should exist at each step (and mostly don't today):** attribution-captured, session-started, funding-source-identified, gas-check-passed/failed, approval-signed, tx-broadcast, tx-confirmed-onchain, collateral-check-started, collateral-credited, deposit-abandoned, duplicate-deposit-attempted.

---

## 2. The Single Biggest Friction Point — and Why

**The problem:** the deposit flow has no explicit state machine communicated to the user between "I signed something" and "I can trade." Every failure mode — no gas, bridge delay, a stuck approval, a receipt that hasn't yet turned into credited collateral — looks *identical* to the user: silence, or a generic spinner.

**Why this is the single highest-priority fix, not one of several equally-good options:**

1. **It's explicitly named in the assignment's own fixed assumptions**: *"A deposit is complete only when tradable collateral is reflected in the intended Hyperliquid account, not when an intermediate transaction receipt is issued."* This is a direct signal about where the real gap is.
2. **It's independently documented as a real, current problem**, not a hypothesis invented for this exercise. Dedicated third-party troubleshooting sites exist specifically for "Hyperliquid deposit stuck" scenarios, and their standard first instruction is *"do not send a second deposit — first find your transaction hash"* — direct evidence that users experiencing this silence panic and duplicate their deposit, risking real financial loss.
3. **It compounds with the exact user profile in scope**: Korean CEX withdrawers and KOL-referred mobile users are explicitly described as unfamiliar with bridges, gas, and contracts — the group least equipped to correctly interpret ambiguous silence, and most likely to assume the worst.
4. **It is the one problem that, left unfixed, actively causes financial harm** (duplicate deposits), not just frustration — this distinguishes it from cosmetic friction (e.g., visual polish) which affects conversion but not safety.

### Alternatives considered and rejected

| Alternative | Why not chosen as the *primary* fix |
|---|---|
| **Gasless/sponsored-gas onboarding** (solve the "no ETH for gas" dead-end directly) | Real and valuable, but requires production paymaster infrastructure beyond PoC scope. It also doesn't address the *core* problem: even with gas solved, the receipt-vs-credited gap remains and can still cause silent failures and duplicate deposits. Documented as a "before production" item instead. |
| **Wallet-identity unification** (force one wallet for login/funding/trading) | Explicitly out of scope — the brief states these addresses *cannot* be assumed to match, and forcing unification would remove real flexibility (e.g., a user funding from a CEX withdrawal address while trading from an embedded wallet). The correct fix is *labeling*, not unification — implemented as a secondary UX layer (see §3). |
| **Reduce steps in the funnel** (remove/merge screens) | A real lever for conversion, but with no real funnel data available (explicitly withheld per the brief), any specific step-removal is a guess. State-transparency is beneficial regardless of the exact step count, making it the safer, evidence-backed choice. |
| **Wrong-network CEX withdrawal prevention** | Investigated and deprioritized: Korean exchanges (Upbit, Bithumb) already enforce Travel-Rule withdrawal-address whitelisting, which structurally reduces (though doesn't eliminate) this specific risk for the primary user segment — making it a lower-leverage fix than the state-visibility gap, which affects 100% of deposits regardless of withdrawal correctness. |

---

## 3. The Improvement: Deposit Reconciliation Engine

**One feature, five UX layers, all addressing the same root cause** (state opacity), not five unrelated patches:

### Core: a real backend state machine, not a UI illusion

The engine tracks every deposit as a persistent record through explicit states — `SIGNED → CONFIRMED_ONCHAIN → BRIDGING → CREDITED`, with `STALLED_NO_GAS`, `STALLED_TIMEOUT`, and `AMBIGUOUS` as first-class exception states. Critically, **`CREDITED` is only reached when the engine independently verifies both sides**: the real on-chain transaction receipt (via RPC, not trusting the client) *and* the Hyperliquid-side balance signal. If the two disagree past a reasonable window, the record is flagged `AMBIGUOUS` — not silently retried forever, and not left in a generic "pending" state.

### Layer 1 — Live status, not a spinner
Every screen shows the real current state in plain language, not a generic loading indicator.

### Layer 2 — Exact-amount approval by default
The approval step defaults to requesting exactly the deposit amount, not an unlimited allowance — with an explicit, honestly-labeled opt-in toggle for "approve more for future deposits," so the trade-off (convenience vs. exposure) is visible, not hidden. *Directly maps to the brief's explicit "approval scope" requirement for user review.*

### Layer 3 — Plain-language failure classification
Copy assumes zero crypto background. Instead of a raw error, the user sees "You don't have enough ETH on Arbitrum to pay the network fee" or "This is taking longer than usual — we're still tracking it, no need to send another deposit" — the second message is a direct countermeasure to the documented duplicate-deposit failure pattern from §2.

### Layer 4 — Full address confirmation before signing
The complete destination address is shown (not truncated), with an explicit note that scammers use near-identical lookalike addresses — a direct, low-cost defense against real, documented "address poisoning" attacks.

### Layer 5 — Explicit wallet-role labeling
Every screen labels which address is playing which role: "Signing in as," "Funds coming from," "Will be tradable in" — never a bare "your wallet." Directly addresses the brief's requirement to handle login/funding/trading-account divergence.

### Layer 6 — KOL attribution as a compliance element, not a marketing widget
A persistent banner discloses the referring KOL and explicitly states that Exchange O is independent and the deposit/trading decision belongs to the user alone — addressing the brief's requirement to communicate source and conflicts of interest, not just display a referral code.

### Duplicate-deposit protection
If a user attempts a second deposit for the same wallet+amount while one is still in-flight, the system blocks it with a clear explanation and a link to the existing deposit's live status — this is the concrete behavioral change the hypothesis predicts, and it is the one directly validated on real testnet infrastructure (see `testnet-evidence.md`).

---

## 4. Before / After

| | Before | After |
|---|---|---|
| **What the user sees between signing and trading** | A spinner or a bare transaction hash | A named state (Signed → Confirmed → Bridging → Credited) updated in real time |
| **What happens if collateral is slow to credit** | Indistinguishable from "stuck" or "failed" | Explicitly tracked; if genuinely ambiguous past a threshold, flagged for investigation rather than silently retried |
| **What happens on a second deposit attempt while one is in-flight** | Silently creates a second deposit (real financial risk) | Blocked with a clear message and a link to the original deposit's status |
| **What the approval step defaults to** | (Industry-common pattern) unlimited allowance | Exact amount, with an explicit, informed opt-in for more |
| **Wallet identity on screen** | Generic "your wallet" | Labeled by role: login / funding / trading account |

---

## 5. Measurement Plan

**Primary metric:** percentage of deposits that reach `CREDITED` without the user re-depositing (triggering the idempotency block) or needing support contact. This directly targets the two concrete failure modes named in §2 and §3 — silent ambiguity and duplicate deposits — rather than a generic "conversion rate," which the state-visibility fix influences but does not directly cause.

**Guardrails (secondary metrics that must not regress):**
- **Time-to-`CREDITED`, p50/p90.** A rising p90 is a real bridging/infrastructure signal, not just a UI concern — the engine's `AMBIGUOUS`/`STALLED_TIMEOUT` rates should be watched directly alongside it.
- **`AMBIGUOUS` rate.** This state exists specifically so the system never silently retries forever. A rising rate means on-chain and Hyperliquid-side reconciliation is genuinely disagreeing more often, and needs infrastructure investigation — not a longer timeout as a band-aid.
- **Duplicate-deposit block rate.** Should stay low in steady state. A spike is a leading indicator that the status UI isn't reassuring users quickly enough that their *first* deposit is progressing.

**What real data would be needed to validate this in production** (explicitly not available per the brief, and not invented here): actual step-by-step funnel drop-off rates, D1/D7 support-ticket volume tied to deposit confusion, and the real distribution of time-to-credit under production bridging conditions.

---

## 6. B2B2C / KOL Considerations Within This Challenge

- **Acquisition & attribution:** the `?ref=` parameter is captured on landing and persisted through the full flow (survives navigation, not just the initial URL) so a completed deposit can be attributed back to the originating KOL.
- **What the KOL may configure vs. what Project O must control:** the KOL controls their own content/link only. Project O controls all deposit-state logic, the disclosure banner's presence and wording, and the wallet/asset/security-relevant UI — none of this is configurable by a partner, by design.
- **Conflict-of-interest disclosure:** the persistent banner explicitly states Exchange O's independence from the referring KOL — addressing the brief's requirement that KOL influence never imply endorsement of a specific outcome.
- **Data boundaries:** in this PoC, no KOL-facing dashboard or partner data-access surface exists yet — flagged as an explicit open item in the appendix, not silently assumed.

---

## 7. Legal / Technical / Operational Conditions to Verify Before Production

- **Hyperliquid's deposit rail is mid-migration.** Hyperliquid's own public statements describe an active transition from the legacy Arbitrum bridge to native cross-chain USDC minting (CCTP-based). Any production implementation must re-confirm the current live deposit path against Hyperliquid's official documentation at build time — this PoC's architecture (Arbitrum → bridge → Hyperliquid) reflects the brief's stated assumptions, not a guaranteed-current production path.
- **Korean regulatory context:** Korea's Virtual Asset User Protection Act (2024, in force) and ongoing FSC guidance are the umbrella legal context for any Korea-facing crypto product; Korean exchanges' Travel-Rule withdrawal whitelisting is a real structural mitigant for some risks discussed here but does not itself constitute compliance for Exchange O's own operations.
- **KOL/influencer disclosure regulation:** South Korea has moved toward requiring crypto/stock-promoting influencers to disclose holdings — relevant to any production KOL-partner agreement and configuration surface, even though it does not directly govern this PoC's UI.
- **Real database required in production** — this PoC's in-memory/`/tmp` store is explicitly not durable across serverless instance recycling (see `README.md` "Known limitations" — this was discovered and documented as a live, observed issue during testing, not a theoretical one).
- **Real Hyperliquid integration required** — the "credited" check is currently a timer-based mock; production requires a real balance-read integration.
