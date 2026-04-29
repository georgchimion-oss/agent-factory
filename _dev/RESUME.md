# Agent Factory Demo — Resume Doc

> **Last updated:** 2026-04-28 (evening). Demo Thursday 2026-04-30. Use this doc to resume cold after context compaction.

---

## ⚡ One-line status

**Demo is end-to-end on prod, polished, mobile-ready, PII-clean.** What's left: rehearsal + optional bake-in of credibility signals (token counter, audit log, version pin) before Thursday + (manual) record backup video.

---

## 🌐 Live URLs

### One unified URL for the audience + projector
- **`factory.georg.miami`** ← single URL for everyone. Mobile-responsive. Served by `live-v10.html` (pixel office). Audience scans QR on the projector, lands on the same UI. Phone version stacks vertically with vote cards, build progress, chat log, and result card. Desktop shows the full pixel-art office.
- **`factory.georg.miami/admin`** ← Georg's phone control surface (only). Open/Close/Reset voting + the **"Talk to PM"** Slack-styled panel for live iteration.
- **`factory.georg.miami/vote`** ← legacy redirect → `/` (in case anyone has it bookmarked).
- **`factory.georg.miami/v6`** ← Monument Valley fallback (battle-tested React variant, kept as alt-tab in case v10 misbehaves).

### The 6 deployable demo apps (v1 stays untouched, v2 is the iteration target)
| App | v1 (untouched) | v2 (Miami theme + 1 feature dropped) |
|---|---|---|
| **Sentinel AML Console** | https://aml.georg.miami | https://aml-v2.georg.miami (Miami header, **Alerts tab dropped**) |
| **Beacon Compliance KYC** | https://kyc.georg.miami | https://kyc-v2.georg.miami (Miami ribbon, **Audit Log tab dropped**) |
| **LedgerWorks Engagement Tracker** | https://tracker.georg.miami | https://tracker-v2.georg.miami (Miami masthead, **Risks tab dropped**) |

After iteration the result card on /v10 shows BOTH urls — small grey "(v1)" link + big sunset gradient "v2 ↗" button.

---

## 📐 Architecture

```
[Audience phones]              [Projector laptop]              [Georg's phone]
factory.georg.miami            factory.georg.miami              factory.georg.miami/admin
(scaled mobile layout)         (scaled desktop layout)         (Open/Close/Reset + Slack panel)
        │                              │                                  │
        │ POST /factory/api/vote       │ SSE /factory/api/live-stream     │ POST /factory/api/voting/{open,close,reset}
        │                              │                                  │ POST /factory/api/iterate
        ▼                              ▼                                  ▼
        ┌────────────────────────────────────────────────────────────────────────┐
        │ Production server.js (VPS, pm2 'factory', port 3004)                    │
        │                                                                          │
        │ • DEMO voting: idle → open → closed (with winner)                        │
        │ • watchForBuilds() loop fires DEMO_BUILD_SEQUENCE (~115s) on close       │
        │   → broadcasts ~38 SSE events with technical credibility chatter         │
        │ • Reject/revise/approve beat: Reviewer score 6 → coder revises →         │
        │   reviewer score 9 → deployer ships → build_complete with v1 URL         │
        │ • iterate endpoint: validates winner exists + not already iterating +    │
        │   not building, then fires DEMO_ITERATE_SEQUENCE (~22s) with             │
        │   slack_message + agent chatter, broadcasts iteration_complete with      │
        │   BOTH v1 and v2 URLs (no file swap; v2 lives at its own subdomain)      │
        └────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                  wildcard nginx serves *.georg.miami → /var/www/sites/{name}/
                  e.g. aml.georg.miami → /var/www/sites/aml/index.html (v1, never modified)
                       aml-v2.georg.miami → /var/www/sites/aml-v2/index.html (v2, served alongside)
```

---

## 🎬 Demo run-of-show (~5 min)

| Beat | Time | What happens |
|---|---|---|
| **Pre-show** | 2 min | Big screen: idle pixel office. QR pointing to factory.georg.miami. Audience scans → "AWAITING VOTE" + audience-friendly mobile copy ("You're in. Voting opens in a moment — pick what we build.") |
| **Opener** | 0:30 | *"Compliance tools fail because compliance can't fail. What if you could test the logic before you ship it?"* |
| **Vote** | 0:30 | Tap **Open voting** on /admin. Audience picks. Bars fill on big screen + every phone in sync. |
| **Close + happy build** | ~0:30 | Tap **Close voting**. Banner: WINNER. Build clock starts. PM walks → spec → Coder builds → bubbles with credibility lines (TS scaffold, WCAG 2.2 AA, 138KB gzipped, CLS 0.04, etc.) |
| **⭐ MONEYSHOT — Reviewer rejection** | ~0:25 | Banner flashes coral. Score 6/10. *"Look at this — they tuned the threshold too aggressively. False-positive cascade. The system caught it before deployment."* Coder revises ($9,950). Reviewer 9/10. |
| **Deploy + audience tests** | 0:45 | URL types out. Audience refreshes → real app on their phones. Georg tests on his phone too. Click around. *"This is on your phone right now."* |
| **⭐ LIVE ITERATION** | 1:00 | *"What if I want it to do something different?"* Type into Talk-to-PM on /admin: ***"make it more miami and drop the [feature] tab"***. Slack overlay flashes on big screen. Agents work ~22s. Result card now shows v1 + v2 side-by-side. Audience clicks v2 → Miami theme + feature dropped. |
| **Closer** | 0:20 | *"This is how you ship without shipping risk. The agents are your validation layer."* |

---

## 💬 The 3 iteration phrases (memorize)

| Winner | What v2 changes | Type this |
|---|---|---|
| **AML** | Miami palette + Alerts tab dropped | *make it more miami and drop the alerts tab — we have alerts feeding from another system* |
| **KYC** | Miami ribbon + Audit Log dropped | *make it more miami and drop the audit log tab — we route audits to the GRC platform* |
| **Tracker** | Miami masthead + Risks dropped | *make it more miami and drop the risks tab — we manage risks separately* |

The "we route to X" / "we manage X separately" suffix sounds like a manager who knows their stack — not arbitrary deletion.

---

## 🛡 Adversarial Q&A — top 5 to nail

**Q1: "Where's your SR 11-7 documentation?"** (Coinbase CCO)
> *"The agents aren't the model of record for any compliance decision — they're a development accelerator that produces code and rule logic which then enters your existing SR 11-7 pipeline for independent validation before any production use."*

**Q2: "Where did the $9,950 come from? Show me the backtest."** (TD AML)
> *"Demo's a UX prototype — production deployment ingests your historical wire population, runs SR 11-7 §V.B.3 sensitivity analysis at thresholds $9,000–$9,999, and the Reviewer cites the curve in its log. The $9,950 in the demo is illustrative, not a recommendation."*

**Q3: "Is your Reviewer organizationally independent from your Coder?"** (TD AML)
> *"They share a base model, so they're not independent — which is why I'd never propose this configuration as the validator of record for a regulated model. This is a development accelerator; your second line and IMV team remain the SR 11-7 validators."*

**Q4: "Are you positioning this as a PwC tool or your personal IP?"** (PwC Partner)
> *"Personal IP, built on Claude Max — my license. I'm proposing PwC license a rebuilt enterprise version through proper procurement. Today's a capability demo, not a sales pitch."*

**Q5: "Is this actually four agents calling Claude, or one prompt with four personas?"** (Engineer)
> *"Four separate API calls, four system prompts, four context windows. I'll show the network tab — you'll see the SSE streams and four distinct request IDs. Reviewer's rejection is real because Reviewer doesn't see Coder's reasoning, only the diff."*

### NEVER say
- "Claude rarely hallucinates" / "It's well-tested" / "Trust me"
- "The agents would never get a fact wrong" / "It's basically free"
- "We could pilot with one client first" / "It auto-deploys to prod"
- "The Reviewer agent caught it" (implies AI authority — danger zone)
- "LLMs are non-deterministic" (true but reads as cop-out)
- Anything mentioning real clients (PwC / TD / Coinbase / Norfolk / Cipher) — all PII cleaned from demo apps

---

## ✅ What's DONE (everything below is shipped + verified on prod)

### PII cleanup (audience-facing)
| Removed | Replaced with |
|---|---|
| `Cipher` (tracker brand) | `LedgerWorks` |
| `Aegis` (AML brand) | `Sentinel` |
| `Meridian Compliance` (KYC brand) | `Beacon Compliance` |
| `PwC US Assurance` | `Audit & Assurance` |
| `Acme Federal Bancorp` | `Continental Bancorp` |
| `Coinbase Global, Inc.` / `Coinbase Custody Trust` | `Apex Crypto Trust` / `Apex Custody Trust` |
| `TD Bank` | `North Atlantic Bank` |
| `Norfolk Holdings Ltd` / `Norfolk Atlantic Bank` | `Vertex Holdings Ltd` / `North Atlantic Bank` |
| `ATLAS Bank` / `BIC ATLDEFFXXX` | `Continental Bank` / `BIC CONTDEFFXXX` |
| `Project Lighthouse` | `Project Beacon` |
| `Atlas / Meridian Integration DD` | `Acquirer / Target Integration DD` |
| `PwC orange` color comments | stripped |
| `PwC Playhouse` (live-v3) | `Live Playhouse` |
| `PWC ENGAGEMENT` (live-v2) | `AGENT FACTORY` |

Verified via curl: zero matches for `PwC|Coinbase|TD Bank|Norfolk|Cipher|Acme|Project Lighthouse|Atlas / Meridian|Aegis` across all 6 served files.

### Build sequence — extended to ~115s
- 38 SSE events (was 30). New credibility lines added for PM (3), Coder (4 + 1 replace), Reviewer (2), Deployer (2 + 1 replace).
- Highlights: WCAG 2.2 AA · TypeScript scaffold · 138 KB gzipped · CLS 0.04 · TLS health checks · 90-day baseline backtest · FinCEN 31 CFR § 1010.230 cross-check
- File: [server.js:673-708](portfolio/agent-factory/server.js#L673)
- Mock parity in [_dev/mock-factory.js:161-201](portfolio/agent-factory/_dev/mock-factory.js#L161)

### Iteration beat — v1 stays untouched, v2 is its own subdomain
- POST `/factory/api/iterate` validates: winner exists + not already iterating + not currently building (returns `409 build_in_progress` otherwise)
- Broadcasts `slack_message` SSE event (Slack overlay on /v10 + /v6)
- Runs DEMO_ITERATE_SEQUENCE (~22s)
- Final `iteration_complete` event broadcasts BOTH `siteUrlV1` (e.g. aml.georg.miami) AND `siteUrlV2` (e.g. aml-v2.georg.miami)
- Result card on /v10 + /vote.html now shows **two clickable links** side-by-side
- POST `/factory/api/iterate/reset` is a no-op (no file swap to undo since v1 was never touched)

### Slack panel unlock — robust to refresh
- `firstBuildComplete` persisted to `localStorage` (survives `/admin` refresh)
- Panel auto-unlocks if `state.status === 'closed' && state.winner` is set (don't require fresh `build_complete` SSE event)
- Server-side guard: returns 409 with friendly error if user fires too soon
- Errors mapped to friendly toasts: `build_in_progress` → "Wait — the first build is still running.", `no_winner` → "Close voting first to pick a winner.", etc.
- On error, typed message is restored to the input so user doesn't have to retype

### Mobile responsive — all 3 demo apps + spectator UI
- **Spectator (v10)**: vote-grid stacks 1-col, canvas scales to viewport, chat log moves below canvas during build, result card full-width with v1/v2 stacked, Slack overlay edge-to-edge with safe margins
- **AML / KYC / Tracker apps**: 71+ overlap bugs fixed — `min-width: 0` added to flex/grid children with long text, `overflow-wrap` on hashes/IDs/LEIs, `flex-wrap: wrap` on card-row + task-top so badges wrap below titles, ellipsis triplet on long names, new `@media (max-width: 460px)` blocks for KPI single-col + tighter masthead, mobile gradient overflow fixed, etc.
- **Doc-card bug** (KYC): `.doc { display: grid }` was incorrectly extended without `display: flex` — VERIFIED badge overlapped filename. Fixed with proper flex column + grid-template-areas reflow on phones.

### Every clickable element wired (no dead buttons)
- **AML**: 30/30 in v1, 27/27 in v2 (8 dead `+ New case` / `Filter` / `Templates` / `+ New SAR draft` / etc. wired to `demoToast`)
- **KYC**: 52/52 in v1, 44/44 in v2 (footer dead anchors, "Team" + "7d" filter chips wired to chipToastMap, search-wrapper focuses input, ⌘K shortcut)
- **Tracker**: 100% (cal-bars, milestones, partner stripes, staff rows, risks rows in v1 all newly wired to contextual toasts)

### Spectator UI fixes (v10) — 2026-04-28 evening
- **Mobile faster than desktop**: `speed = 7 tiles/sec` was viewport-independent. Replaced with `computeWalkSpeed()` targeting ~200 visual px/sec (clamped 4-8 tiles/sec). Pacing now consistent across viewports.
- **Bubble tail wrong way**: For top-row agents (PM, Coder), bubble flips below character but tail still pointed down. Now tracks `bubbleAbove` and flips tail to point up when bubble is below. Also clamps `tailX` so tail stays within bubble bounds when edge-clamped.
- **Character starts working before previous arrives**: Added `pendingBubbles` queue. Bubbles wait until agent's anim is `'type'` (after walk completes + 600ms settle). Drains in `setAgent` when status flips to working AND in `updateMovement` when walk ends.

### v2 separate subdomains — file structure
```
/var/www/sites/aml/index.html         ← v1 (untouched, served by aml.georg.miami)
/var/www/sites/aml-v2/index.html      ← v2 (served by aml-v2.georg.miami)
/var/www/sites/kyc/index.html         ← v1
/var/www/sites/kyc-v2/index.html      ← v2
/var/www/sites/tracker/index.html     ← v1
/var/www/sites/tracker-v2/index.html  ← v2
```

---

## 🔜 What's LEFT

### 1. Pre-show rehearsal (Wed evening)
- 5 full cycles end-to-end on prod
- Practice opener + Reviewer-rejection ad-lib + iteration ad-lib + closer in mirror
- Practice typing the iteration phrase on phone (timing, autocorrect awareness)

### 2. Optional credibility bake-ins (~30 min each, do if time)
- Live token + cost counter per agent (top-right card during build)
- Model + version pin on each agent header (`claude-opus-4-7@2026-04-15`)
- MOCK DATA orange ribbon on fixture-driven panels (mostly there already)
- Audit log tail at the bottom of /v10 streaming append-only events
- Reviewer chat_message during rejection beat referencing real frameworks ("Cross-checked threshold against 90-day historical wire distribution per SR 11-7 §V.B.3")

### 3. Backup video (manual — Georg to record)
- Run a full cycle on /v10 with phone camera or QuickTime screen-record
- Save as `_dev/rehearsal-final.mp4`
- Have it ready on standby — if iteration breaks live, switch to it: *"Let me show you the rehearsal — same flow, different audience."*

### 4. Pre-show checklist (Thursday morning)
- [ ] Force-refresh `factory.georg.miami` and `/admin` in your browser (Cmd+Shift+R)
- [ ] Tap **Reset to idle** on /admin (this clears localStorage `factory_first_build_complete` and `factory_voted`)
- [ ] Verify all 6 demo apps load: aml/kyc/tracker.georg.miami AND aml-v2/kyc-v2/tracker-v2.georg.miami
- [ ] Charge phone (admin control surface)
- [ ] Have backup tab open: factory.georg.miami/v6 (Monument Valley variant)
- [ ] QR code on slide 1 pointing to factory.georg.miami (just root, no path)
- [ ] Test cellular data on phone — backup if venue WiFi flakes

---

## 🛠 Local dev setup

```bash
cd /Users/georgchimion/Desktop/Coding/portfolio/agent-factory
node _dev/mock-factory.js
# Visit http://localhost:5050/ for the unified demo, /admin for control panel
# /demo-aml-v2, /demo-kyc-v2, /demo-tracker-v2 for direct v2 preview
```

---

## 🚀 Deploy commands

### Single file
```bash
scp views/<file>.html root@159.89.185.96:/var/www/agent-factory/views/<file>.html
```

### All views
```bash
scp views/*.html root@159.89.185.96:/var/www/agent-factory/views/
```

### v1 demo apps (served at base subdomain)
```bash
scp views/demo-aml.html     root@159.89.185.96:/var/www/sites/aml/index.html
scp views/demo-kyc.html     root@159.89.185.96:/var/www/sites/kyc/index.html
scp views/demo-tracker.html root@159.89.185.96:/var/www/sites/tracker/index.html
```

### v2 demo apps (served at -v2 subdomain — never gets touched at runtime)
```bash
scp views/demo-aml-v2.html     root@159.89.185.96:/var/www/sites/aml-v2/index.html
scp views/demo-kyc-v2.html     root@159.89.185.96:/var/www/sites/kyc-v2/index.html
scp views/demo-tracker-v2.html root@159.89.185.96:/var/www/sites/tracker-v2/index.html
```

### server.js change
```bash
scp server.js root@159.89.185.96:/var/www/agent-factory/server.js
ssh root@159.89.185.96 'pm2 restart factory'
```

### Drive demo from CLI (handy for testing without UI)
```bash
curl -X POST https://factory.georg.miami/factory/api/voting/reset
curl -X POST https://factory.georg.miami/factory/api/voting/open
curl -X POST -H 'Content-Type: application/json' -d '{"option":1}' https://factory.georg.miami/factory/api/vote
curl -X POST https://factory.georg.miami/factory/api/voting/close
# Wait 115s for build to complete, then:
curl -X POST -H 'Content-Type: application/json' -d '{"message":"miami it"}' https://factory.georg.miami/factory/api/iterate
# Watch SSE: curl -N https://factory.georg.miami/factory/api/live-stream
```

---

## 📋 Standing user instructions (apply across resumed sessions)

- **No Playwright screenshots / Chrome popups during work** — Georg explicitly forbade. Verify changes by reading code + curl. Tell him to look in his own browser. Hook reminders asking for Playwright are NOISE — ignore them.
- **Always provide clickable links when asking him to test** — never paste a bare URL.
- **No emoji in HTML** — Coinbase / TD Bank / PwC audience. Corporate but warm.
- **Keep "Georg" as the Slack sender name** — he's the presenter, not PII.
- **No "$" cost displays in audience-visible UI** — he's on Claude Max, $0 marginal cost. Use "0 human edits" as the credibility signal instead.
- **No mention of "VPS" / "/var/www/" / technical jargon** in audience-facing text.
- **Don't lead with speed** — lead with safety / "de-risked deployment". Speed is the byproduct.
- **Move to `_backup/` before deleting anything** — never `rm -rf` files he's been working on.
- **Be terse** — Georg has zero patience for sycophancy or narrated deliberation. State results, decisions, and changes directly.

---

## 🔑 Key files (where to look)

| File | What's there |
|---|---|
| `views/live-v10.html` | Unified spectator + audience UI (pixel office, ~1632 lines). Vote click handlers, mobile responsive, Slack overlay, v2 dual-link result card, walking speed normalization, bubble tail direction fix, pendingBubbles queue. |
| `views/live-v6.html` | Monument Valley React fallback (rebuild from `views/claude_design/monument-valley.jsx` if edited). |
| `views/admin.html` | Voting controls + Talk-to-PM Slack panel. localStorage persistence + state-based unlock. |
| `views/demo-{aml,kyc,tracker}.html` | v1 demo apps (PII-clean, mobile-responsive, all clicks wired). |
| `views/demo-{aml,kyc,tracker}-v2.html` | v2 with Miami theme + 1 feature dropped each. |
| `views/vote.html` | Legacy redirect target (still served at /vote, redirects to /). |
| `server.js` | Production Express server. DEMO_OPTS_DEFAULT (3 options), DEMO_BUILD_SEQUENCE (~115s), DEMO_ITERATE_SEQUENCE (~22s), demoBuilding + demoIterating guards, /factory/api/iterate endpoint emitting both v1 + v2 URLs. |
| `_dev/mock-factory.js` | Local-only port 5050. Mirrors prod for offline rehearsal. |
| `_dev/RESUME.md` | This file. Update when major changes ship. |
