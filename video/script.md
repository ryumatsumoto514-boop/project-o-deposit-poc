# Project O — spoken walkthrough

**Target runtime: ~2:55.** The deck is the only thing on screen — there's no live click-through in this recording. Read only the spoken paragraphs out loud, naturally, like you're explaining this to a person, not reading a report. Headings, delivery notes, and practice tips are not spoken. Advance the deck at the timestamps below (they're a guide, not a stopwatch — talk at your own pace).

## 1. Title [0:00–0:12]

Hey, I'm Ryu. This is my submission for Project O's Challenge 1 — the deposit breakdown and improvement challenge. And the whole idea behind what I built comes down to one sentence: just because you got a transaction receipt doesn't mean your money is actually ready to trade yet.

## 2. The problem / deposit breakdown [0:12–0:38]

So here's the journey a user actually goes through. They click a KOL's link, sign in, figure out which wallet has their funds, get some USDC and a bit of gas onto Arbitrum, approve the spend, and submit the deposit.

[DELIVERY NOTE: pause slightly here before continuing]

But here's the thing — submitting that transaction isn't the finish line. Hyperliquid still needs to actually credit that money before it's tradable. And on top of that, the wallet you log in with, the wallet your funds come from, and your actual trading account? Those can all be different addresses. That's a lot of room for confusion.

## 3. Why this is the biggest friction point [0:38–1:00]

Out of everything I could've focused on, I picked this gap specifically — because when it goes wrong, it's not just annoying, it's actually dangerous. If someone doesn't know their deposit is still processing, they might just send it again. Now they've deposited twice.

This isn't a guess, either — the assignment itself defines a deposit as "complete" only once it's tradable collateral, not when a receipt shows up. And I found real documentation of people getting stuck in exactly this kind of confusion. So I'm confident this was the right thing to prioritize, even without internal data to back it up.

## 4. The fix: reconciliation engine [1:00–1:26]

So what I built is something I'm calling the Deposit Reconciliation Engine. Instead of just showing a spinner, it tracks every deposit through real, named states — signed, confirmed on-chain, bridging, and finally credited.

[DELIVERY NOTE: point at the state machine diagram as you say each state]

And the "credited" state is the important part — it only gets marked complete once the engine checks the receipt on-chain AND gets a signal that Hyperliquid actually has the funds. To be fully transparent, that Hyperliquid signal is mocked in this PoC, since I don't have testnet access there. But the logic and the on-chain half are completely real.

If something stalls — no gas, a timeout, or the two signals disagree — it gets flagged instead of just hanging forever. And if someone tries to deposit the same amount twice while one's still in progress, it gets blocked.

## 5. The five UX layers [1:26–1:50]

On top of that engine, there are five things I added specifically for someone who's never touched crypto before. Approvals default to the exact amount you're depositing, not some unlimited allowance. Every failure message is written in plain English, not a raw error code. Before you sign anything, you see the full destination address, so you can actually check it's right. Every wallet on screen is labeled by its role — so you always know which one's which. And there's a clear banner saying who referred you and that the decision to trade is entirely yours.

## 6. Screenshot walkthrough [1:50–2:12]

Let me actually show you two of those screens. This one's the address confirmation step — full address, clearly labeled roles for each wallet. And this one's the approval screen — you can see it defaults to approving just this amount, and if you want to approve more for future deposits, it tells you upfront that's a bigger risk.

[DELIVERY NOTE: give the viewer a couple seconds of silence here to actually look at the screenshots]

## 7. Real testnet evidence [2:12–2:32]

Now, this isn't just a mockup — I actually ran this on Arbitrum's testnet. I deployed a test token, approved twenty-five of them, and had it pulled through a real transfer transaction — you can see the hash right here, and it's fully verifiable on Arbiscan. The allowance also correctly dropped back to zero afterward, which confirms the exact-amount approval worked exactly as intended. I also tested the duplicate-deposit block, and it correctly returned an error instead of letting a second deposit through.

## 8. Measurement plan [2:32–2:48]

If this went into production, the main thing I'd track is: what percentage of deposits reach "credited" without someone re-depositing or contacting support. And alongside that, I'd watch how long deposits typically take, how often that "ambiguous" state gets triggered, and how often the duplicate block kicks in — those are the numbers that'd tell me if something's actually wrong upstream.

## 9. Closing / limitations [2:48–2:58]

To be upfront about where this stands — login and the Hyperliquid balance check are both mocked, and the current data storage wouldn't hold up in a real production environment yet. But the core idea — giving users real visibility into where their money actually is — that part is real, tested, and working. Thanks for watching.

---

## PRACTICE TIPS

- **Read it a couple times before recording, and then stop reading it word-for-word.** Once you know roughly what each slide is about, just talk — it'll sound way more natural than reciting this script exactly. Small changes in wording are totally fine.
- **Slide 4 and slide 7 are the two easiest places to rush.** Slow down when naming the four states (signed, confirmed, bridging, credited) and when pointing at the transaction hash — these are the most "technical" moments and rushing them makes it sound memorized instead of understood.
- **Everything happens on the slide deck — nothing live.** Have `slides.html` open in your browser in fullscreen (press `f`), and that's it. No other tabs needed. Advance with arrow keys or by clicking.
