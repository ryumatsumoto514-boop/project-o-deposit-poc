# Project O — spoken walkthrough

**Target runtime: 2:59, including clicks and pauses.** Read only the spoken paragraphs. Headings, delivery notes, and practice tips are not spoken. Sections match the nine slides in [slides.html](slides.html); advance manually at the timestamps below.

## 1. Title [0:00–0:10]

I'm Ryu. This is my Project O deposit PoC. The idea is simple: a transaction receipt doesn't mean you're ready to trade.

## 2. The problem / deposit breakdown [0:10–0:32]

The journey starts with a KOL referral: sign in, identify the funding wallet, get USDC and gas onto Arbitrum, approve spending, then submit the deposit. Hyperliquid still needs to credit the intended account before we show “ready to trade.” Login, funding, and trading can involve different addresses.

[DELIVERY NOTE: Trace the journey on screen. Pause briefly between “submit the deposit” and “Hyperliquid still needs to credit.” That's the gap this PoC addresses.]

## 3. Why this is the biggest friction point [0:32–0:52]

I prioritized that gap because silence can make someone send money twice. The brief defines completion as tradable collateral, and the research documents stuck-deposit confusion. For newcomers arriving from Korean exchanges or KOL links, that's hard to diagnose. It's a priority judgment; we don't have internal funnel data.

## 4. The fix: reconciliation engine [0:52–1:16]

The Deposit Reconciliation Engine tracks signed, confirmed on-chain, bridging, then credited. It checks the receipt through RPC and requires a separate collateral signal. Here, that second signal is explicitly mocked. No gas, timeout, and ambiguous outcomes get named states. The duplicate guard checks for the same wallet and amount already in flight.

[DELIVERY NOTE: Point across SIGNED → CONFIRMED_ONCHAIN → BRIDGING → CREDITED, then at STALLED_NO_GAS, STALLED_TIMEOUT, and AMBIGUOUS. Slow down on “explicitly mocked”; don't imply a real Hyperliquid balance was verified.]

## 5. The five UX layers [1:16–1:41]

Alongside live status, these five cards show the user-facing protections. Exact-amount approval limits what I'm authorizing. Plain-language failures tell me what to do. Full-address confirmation helps me check the destination. Wallet-role labels separate login, funding, and trading. And the KOL disclosure makes clear that Exchange O is independent and the decision is mine.

[DELIVERY NOTE: Point left to right across slide 5's actual cards. The submission numbers live status as Layer 1 and KOL disclosure as Layer 6; this deck covers live status on slide 4 and groups the remaining five protections here. All six documented elements are covered across the two slides. The disclosure wording is illustrative, not legally reviewed.]

## 6. Live demo / screenshot [1:41–2:04]

Let me show the review step. Here's the full destination, and these labels separate the wallet roles. I'll confirm the address and continue. Approval defaults to this amount only. The broader option explains its extra risk before I choose it.

[DELIVERY NOTE: Switch to the live app, already on “Confirm destination address,” with a testnet wallet connected and an amount entered. Point to the address and wallet roles. Actually click the confirmation checkbox and “Continue.” Point to “Approve this amount only,” then select “Approve for future deposits too” to show its warning and return to the exact-amount option. Leave “Approve & deposit” untouched; the next slide supplies the recorded transaction evidence. Allow roughly six seconds within this section for clicks and visual pauses. If the page stalls, show a prepared screenshot and replace “I'll confirm the address and continue” with “This screenshot shows the approval step after address confirmation.”]

## 7. Real testnet evidence [2:04–2:25]

These are real Arbitrum Sepolia transactions using MockUSDC. In the scripted proof, twenty-five tokens moved, and the exact allowance returned to zero. This transfer, starting “zero x, baf six nine d,” is shown here. The API test also blocked a duplicate with HTTP four-oh-nine. Hyperliquid wasn't involved.

[DELIVERY NOTE: Point to the recorded approve/transfer pair and the zero remaining allowance. Say only the short hash prefix; keep the full transfer hash visible or open its explorer tab: [0xbaf69d4752b4f1e3a54614e71a1eb25b0c7b553bb829c5a8a5111df1e513e723](https://sepolia.arbiscan.io/tx/0xbaf69d4752b4f1e3a54614e71a1eb25b0c7b553bb829c5a8a5111df1e513e723). The corresponding approval is [0xc110d16ae895b7bc9ec8483c6c788a3967f072b16eaaeb0964d46b6f1a3f6022](https://sepolia.arbiscan.io/tx/0xc110d16ae895b7bc9ec8483c6c788a3967f072b16eaaeb0964d46b6f1a3f6022). These are the scripted 25 mUSDC proof, not the separate 10 mUSDC engine test.]

## 8. Measurement plan [2:25–2:43]

I'd measure the share reaching credited without a repeat attempt or support contact. Guardrails are median and ninetieth-percentile time to credit, ambiguous outcomes, and duplicate blocks. We'd need real funnel events and support records tied to deposits. These are proposed measures, not results.

## 9. Closing / limitations [2:43–2:59]

Login and Hyperliquid credit are mocked. Storage isn't durable, so duplicate blocking isn't reliable across serverless instances. Production needs a shared database, real integrations, and deposit-rail verification. The goal: help users understand where their money is before they act again.

## PRACTICE TIPS

- Rehearse to the timestamps, especially the state names in section 4 and the metrics in section 8. Speak “ninetieth percentile” naturally. Aim to start the demo at 1:41 and finish by 2:59; don't read full hashes or rush the mock disclosures.
- Before recording, open [the deck](slides.html), [live app](https://projecto-blond.vercel.app), and the linked Arbiscan transfer in separate tabs. Use the deck's arrow keys to advance; clicking anywhere on it also changes slides. Rehearse the connected-wallet path to address confirmation, and have [confirmation](../submission/screens/04-confirm-address.png) and [approval](../submission/screens/05-approve.png) screenshots ready. The documented proofs used scripts and API calls; they don't establish that a human completed the MetaMask popup flow.
- If Vercel responds slowly, switch immediately to the screenshot and use the replacement sentence in section 6, keeping the same time slot. Don't wait for a fresh deposit to credit during the take. Serverless recycling can lose tracking records, so use the saved evidence for the transaction proof.
