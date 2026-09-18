#!/bin/bash
# Overnight driver script — runs Claude Code CLI directly, costs $0 in Nous
# tokens (this is a plain shell script executed by the cron scheduler with
# no_agent=true, not an LLM agent). Claude Code itself uses the user's
# Claude Pro subscription login, not any API-billed tokens.
# NOTE: no `set -e` — a Claude Code turn-limit or non-fatal error must not
# prevent this script from at least logging what happened. Each command
# below checks its own exit status explicitly instead.
cd /opt/data/projecto
source .overnight-env.sh 2>/dev/null || true

LOG=/opt/data/projecto/OVERNIGHT_LOG.md
echo "" >> "$LOG"
echo "## Cron tick: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"

# Check Claude Code auth is still valid before spending a turn on it
if ! claude auth status 2>/dev/null | grep -q '"loggedIn": true'; then
  echo "Claude Code session not logged in / expired. Skipping this tick." >> "$LOG"
  exit 0
fi

claude -p "Read /opt/data/projecto/OVERNIGHT_BRIEF.md and /opt/data/projecto/OVERNIGHT_LOG.md (append-only, read the WHOLE thing, it's long but has critical context from 10+ prior design cycles) in full first.

USER GAVE DETAILED, SPECIFIC UI/UX DIRECTION (this supersedes all prior generic 'make it better' instructions — the user looked at real screenshots and said it's good but too generic/SaaS-boilerplate-looking, and gave a precise creative brief). Implement this exactly:

---
Act as a Principal UI/UX Designer and Lead Frontend Engineer specializing in modern Web3 and High-Frequency Trading interfaces (like Hyperliquid, Uniswap, and Solana Terminal). Refactor the design system and layout of Project O to eliminate the generic 'AI-generated SaaS boilerplate' look. Transform it into a distinct, high-performance visual brand ('Project O / Exchange O').

1. Brand Aesthetic: High-precision cryptographic telemetry interface. Dark mode default with rich obsidian background (#0A0C10), razor-sharp borders (1px border with 0.15 opacity), subtle dot-matrix background pattern, neon electric accent (Cyber Amber #FF9E00 or Hyper Turquoise #00F0FF — pick one and use it consistently, do not mix both). Typography: crisp sans-serif for headings (Inter or Space Grotesk) paired strictly with Monospace fonts (JetBrains Mono / SF Mono) for numeric values, contract addresses, and status badges.

2. Hero Section & 'O Engine' Visual Anchor: Replace generic centered text with an asymmetric hero layout. Left side: high-impact typography with a prominent live status ticker ('ARBITRUM SEPOLIA -> HYPERLIQUID | LATENCY: 42ms' style, can be a static realistic-looking value since this is a PoC, just don't fabricate it as if it's a real live measurement in code comments/docs — label it as illustrative). Right side: an interactive visual model representing the 'Reconciliation Engine' — a dynamic, animated cross-chain telemetry pipeline showing incoming USDC deposits being reconciled and credited in real-time (CSS/SVG animation is fine, no need for a canvas library).

3. Pipeline Visualization (replacing the 3 static feature text blocks): an active horizontal/vertical 'Live Pipeline Stepper' showing the 4 real stages: [1. Signed] -> [2. Arbitrum Confirmed] -> [3. Relayed & Bridged] -> [4. Hyperliquid Credited], with real-time progress indicators, transaction hash previews (can show placeholder/example format on the marketing page, real hashes on the actual status tracker), and plain-language telemetry-style state text instead of static descriptions.

4. Micro-interactions & UX details: Nav should feel like a trading terminal — network status indicator (already have Sepolia dot, refine it), a gas fee indicator, custom branded logo mark for 'Project O' (a simple geometric SVG mark, not a generic icon). Primary CTA upgraded with high-contrast styling, subtle hover glints/tactile feedback (CSS transitions/transforms, no heavy JS libraries needed). Micro-copy: highlight 'Zero Unlimited Allowances' and 'Real-time Exception Handling' as crisp status-tag components with glowing LED-style status dots.
---

IMPORTANT CONSTRAINTS:
- This must be implemented in the ACTUAL React/Tailwind/Next.js codebase at /opt/data/projecto — not just described. Write real component code.
- Apply the new design system consistently across EVERY screen (landing, login, deposit amount, address confirm, approval, status tracker, exception screens) — not just the landing page hero. A half-migrated design (new landing page, old-style everything else) is worse than not doing it, so if you run low on turn budget, prioritize getting the design TOKENS (colors, fonts, spacing, border style, the dot-matrix background) applied everywhere consistently over perfecting one flashy hero section.
- Keep all existing functionality working — this is a visual/component refactor, not a rewrite of the reconciliation engine logic. Do not touch lib/*.ts business logic.
- Real screenshots exist in prior OVERNIGHT_LOG.md entries proving a screenshot pipeline works (chrome-headless-shell + scripts/screenshot.mjs via CDP on port 9333) — use it to verify your changes actually render correctly, at both mobile (375px) and a reasonable desktop width, before considering this done. Don't just write CSS blind.
- After verifying with real screenshots: npm run build, commit, push to GitHub, and redeploy to Vercel (source .overnight-env.sh first, then vercel --token \"\$VERCEL_TOKEN\" --yes --prod). Re-verify the LIVE URL https://projecto-blond.vercel.app reflects the changes with a fresh screenshot.
- Append a detailed, specific summary to OVERNIGHT_LOG.md of exactly what changed (files touched, design tokens chosen, what the hero/pipeline/nav look like now) so a future cycle or the user can see real diffs, not just 'made it better'.
- This is a multi-cycle effort — if you don't finish everything in this budget, leave the log in a state where the NEXT cycle can clearly see what's done and what's left of this exact brief, rather than treating it as complete prematurely." \
  --max-turns 100 \
  --model sonnet \
  --dangerously-skip-permissions \
  >> /opt/data/projecto/.overnight-claude-stdout.log 2>&1
CLAUDE_EXIT=$?

echo "Claude Code tick finished, exit code $CLAUDE_EXIT" >> "$LOG"
exit 0
