# Agent Factory Demo — Resume Doc

> **Last updated:** 2026-04-27. Demo at PwC playhouse for Coinbase + TD Bank + PwC partners on Thursday 2026-04-30. Use this doc to resume cold after context compaction.

---

## ⚡ One-line status

**The demo works end-to-end on production.** Spectator + voting + simulated build (with reject/revise/approve beat) + 3 deployable apps with functional top-nav are all live. Remaining work: optional pixel-art office UI inspired by `pablodelucca/pixel-agents`, lock the demo prompt + opener, rehearse.

---

## 🌐 Live URLs (everything you click)

### Spectator + control surface (factory.georg.miami)
- **Big screen / projector:** [https://factory.georg.miami/v6](https://factory.georg.miami/v6) — Monument Valley isometric world, characters walk between Pink Watchtower (PM) → Teal Workshop (Coder) → Purple Observatory (Reviewer) → Coral Gateway (Deployer)
- **Phone control (Georg):** [https://factory.georg.miami/admin](https://factory.georg.miami/admin) — Open / Close / Reset voting
- **Audience phone view (QR target):** [https://factory.georg.miami/vote](https://factory.georg.miami/vote)
- **Backup variants in case v6 has issues:** [/v5](https://factory.georg.miami/v5) (Live Pro, light theme) · [/v4-beach](https://factory.georg.miami/v4-beach) (Miami sunset) · [/v2](https://factory.georg.miami/v2) (Mission Control / Bloomberg) · [/v1](https://factory.georg.miami/v1) (The Floor)
- **Other Claude Design outputs (kept but not wired to backend):** [/v7](https://factory.georg.miami/v7) (Mission Control variant) · [/v8](https://factory.georg.miami/v8) (Miami Neon)

### The 3 deployable demo apps (winner becomes the live URL)
- [https://aml.georg.miami](https://aml.georg.miami) — AML Transaction Monitoring Console (7 sections in top nav)
- [https://kyc.georg.miami](https://kyc.georg.miami) — KYC / CIP Intake Pipeline (6 sections)
- [https://tracker.georg.miami](https://tracker.georg.miami) — Engagement Workstream Tracker (6 sections incl. Calendar + People + Risks)

---

## 📐 Architecture (how it runs end-to-end)

```
[Audience phones]              [Big screen / projector]                [Georg's phone]
     │                                  │                                       │
     │ scan QR → /vote                  │  factory.georg.miami/v6               │  factory.georg.miami/admin
     │                                  │                                       │
     ▼                                  ▼                                       ▼
   POST /factory/api/vote     SSE: /factory/api/live-stream         POST /factory/api/voting/{open,close,reset}
                              (subscribes; receives all events)
     │                                  ▲                                       │
     ▼                                  │                                       ▼
        ┌─────────────────────────────────────────────────────────────────────────┐
        │                Production server.js (VPS, pm2 'factory', port 3004)     │
        │                                                                         │
        │   • voting state in memory (status: idle|open|closed, options[3])       │
        │   • /factory/api/voting/{open,close,reset} mutates state                │
        │   • watchForBuilds() loop fires DEMO_BUILD_SEQUENCE on close            │
        │     → broadcasts ~30 SSE events: agent_status, chat_message,            │
        │       review_result(score:6) → coder revises → review_result(score:9)   │
        │       → deployer ships → build_complete with siteUrl=aml.georg.miami    │
        │   • DOES NOT call real claude -p — pure broadcast theater (~32s)        │
        └─────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                       wildcard nginx serves *.georg.miami → /var/www/sites/{name}/
                       So aml.georg.miami → /var/www/sites/aml/index.html (the deployed demo)
```

**Key files** (on local + on VPS at `/var/www/agent-factory/`):
- `server.js` (553 lines) — production server with real factory + demo voting layered on top
- `views/live-v6.html` (1191 lines) — Monument Valley spectator, React via Babel-standalone
- `views/claude_design/monument-valley.jsx` — source of truth for v6, REBUILD live-v6.html from this after edits
- `views/admin.html` — phone control panel
- `views/vote.html` — audience phone voting page
- `views/demo-aml.html`, `demo-kyc.html`, `demo-tracker.html` — the 3 winnable apps with functional top-nav
- `_dev/mock-factory.js` — local-only dev server on port 5050 (mirrors production demo flow)

---

## ✅ What's DONE (all shipped to production)

### Critical fixes (C1-C5)
| | What | Where |
|---|---|---|
| **C1** | **Reviewer-rejection beat** — score 6 (AML structuring rule false-positive cascade), Coder revises threshold to $9,950, Reviewer approves 9/10. Per-winner content for KYC (OFAC ordering bug) + Tracker (SoD violation). | `_dev/mock-factory.js` + `server.js` |
| **C2** | **Deploy-evidence logs** in result cards: `$ npm run build`, `✓ 142 tests passed`, `Deployed: <UTC>`, `Bundle: <slug>-build-XXX.tar.gz`. Credibility signal for execs scanning for theater. | v6 ResultCard, v5 complete pane, v4-beach result card |
| **C3** | Vote state persistence on reload (was already working — verified) | vote.html |
| **C4** | v4-beach character animation reset between rounds — courier no longer stuck mid-air on second cycle | live-v4-beach.html `resetAllAgents()` |
| **C5** | Projector readability media query (+font sizes at >1920px) | demo-aml/kyc/tracker + v5 + v4-beach |

### Important fixes
| | What | Where |
|---|---|---|
| **I3** | Mini-banner on rejection beat — banner flips to coral "FLAGGED" for 2.6s then amber "REVISING" then back to gold "BUILDING" | v6 monument-valley.jsx + Banner component |
| **I8** | Kill switch ("Reset to idle" button) verified | admin.html |
| **Reverse path** | `reviewer-engineer` walking path added (for Reviewer→Coder rejection handoff) | monument-valley.jsx WALK_PATHS |
| **SSE whitelist** | Added `voting_state` + `spectator_count` to broadcastAll's allowed-spectator list (was the bug where /admin clicks didn't reach /v6) | server.js line 65 |
| **All 3 demos**: top-nav functional view-swapping | AML 7 sections, KYC 6, Tracker 6 — every nav click swaps entire content | demo-*.html |
| **`$0.34` cost** | Removed everywhere — replaced with "0 human edits" since user is on Claude Max ($0 marginal) | v4-beach + v5 + claude-design-prompt.md |
| **VPS / API tech-speak** | Removed everywhere visible to audience | All variants |

### Production deploy (Option B from the plan)
- Voting state + endpoints (`/factory/api/voting/{state,open,close,reset}`) added to production `server.js`
- Simulated build sequence (`DEMO_BUILD_SEQUENCE`) with token-replaceable per-winner content
- `watchForBuilds()` loop kicks off when voting closes
- Routes added: `/admin`, `/demo-aml`, `/demo-kyc`, `/demo-tracker`
- pm2 `factory` restarted, no downtime to existing penny/brain/jordan/etc
- 3 demo apps deployed to wildcard subdomains (`aml/kyc/tracker.georg.miami` via `/var/www/sites/{name}/`)

### The pitch (locked in plan)
**Opener:** *"Compliance tools fail because compliance can't fail. What if you could test the logic before you ship it?"*

**Closer:** *"This is how you ship without shipping risk. The agents are your validation layer."*

3-beat arc: Setup (vote open) → Tension (Reviewer flags + Coder revises = the moneyshot) → Reveal (URL types out, audience scans, real app on phones).

Full plan with all details: [/Users/georgchimion/.claude/plans/1-im-not-going-ethereal-graham.md](/Users/georgchimion/.claude/plans/1-im-not-going-ethereal-graham.md)

---

## 🔜 What's LEFT (in priority order)

### 1. Pixel-Agents office ambiance (NEW — Georg's most recent ask)

**Inspiration:** [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents) — a VS Code extension where each Claude Code terminal becomes a pixel-art character in an "office" that walks around, types at its desk, etc. Georg likes the **office ambiance** — pixel-art top-down view, characters at desks, animated work states (typing, reading, idle). He does NOT want all the actions/integrations — just the visual feel.

**Repo finding:** Uses `JIK-A-4 / Metro City` topdown character pack. 6 diverse characters. Pixel-art top-down style. Office layout editor with floors / walls / furniture.

**Proposal: build `/v9` — "Pixel Office" variant**

Single self-contained HTML page (no VS Code extension dependency). Top-down pixel-art office:
- 4 desks (one per agent: PM / Engineer / Reviewer / Deployer)
- 4 pixel characters that animate based on `agent_status` SSE:
  - `idle` → character sits at desk, occasional blink
  - `working` → typing animation at keyboard
  - `done` → stands up briefly, thumbs up
  - On `chat_message` → speech bubble with truncated message text (auto-fades)
  - On handoff → walking sprite traverses tile grid from one desk to another
- Top wall = display strip showing build clock, current prompt, vote tally
- Side panel = scrolling chat log
- Use FREE pixel-art assets — Metro City pack (CC0/free) OR build simple ones inline as canvas/SVG

**Effort estimate:** ~3-4 hrs for a credible v9. Could replace v6 as the hero if Georg likes it.

**Two options:**
- **(A)** Use Metro City character sprites (download, host locally, render to canvas). Authentic to the inspiration.
- **(B)** Build minimal pixel-art via inline canvas drawing — no external assets. Simpler but less polished.

I'd recommend **(A)** if there's time, **(B)** as fallback. Either way, this is a NEW variant — keep v6 as primary, v9 as challenger.

### 2. Lock the demo flow content (15 min)

Open questions from the plan that still need answers:
- **Demo prompt to use Thursday** — the `fullPrompt` is already set per-option in mock + production. The actual SAID prompt (what Georg says aloud during the opener) needs to be locked. Suggested: *"Compliance tools fail because compliance can't fail. What if you could test the logic before you ship it?"* (already in the plan).
- **Backup decision** — keep v4-beach (Miami) as visible fallback in the View switcher? Currently yes.

### 3. Rehearsal (~2 hrs Tue + Wed evenings)

- Run 5 full cycles end-to-end, time each
- Practice the opener until it's muscle memory
- Practice the Reviewer-rejection ad-lib — when "Score 6/10" lands on the screen, what do you say? *"Sometimes the system isn't sure. Watch what happens."*
- Practice the closer
- Practice failure recovery — if SSE drops or browser flakes, what's the move? *"The trace shows the system worked. Let me show you the log."*

### 4. Pre-show checklist (Thursday morning)

- [ ] Force-refresh `/v6` and `/admin` in your browser (Cmd+Shift+R)
- [ ] Tap **Reset to idle** on /admin
- [ ] Verify all 3 demo apps load: aml/kyc/tracker.georg.miami
- [ ] Charge phone (admin control surface)
- [ ] Have backup tab open: factory.georg.miami/v4-beach
- [ ] QR code on slide 1 of any deck pointing to factory.georg.miami/v6
- [ ] Test cellular data on phone — backup if venue WiFi flakes

---

## 🚫 Out of scope (deferred indefinitely)

- v7 (Mission Control JSX) and v8 (Miami Neon JSX) — confirmed dead per Georg's call ("characters don't move enough")
- Service migration VPS → Mini for penny/brain/jordan/etc. (separate plan)
- Slack-bot integration with the Agent Factory voting flow (separate plan)
- `arch.georg.miami` architecture diagram (deferred)
- Claude Managed Agents migration (deferred)
- Claude Code Routines replacement of launchd jobs (deferred)
- I1 — sync v6 agent status text (skipped — React state already syncs naturally)

---

## 🛠 Local dev setup

**Mock server (mirrors production but on localhost:5050 — used during dev):**
```bash
cd /Users/georgchimion/Desktop/Coding/portfolio/agent-factory
node _dev/mock-factory.js
# Then visit http://localhost:5050/v6, /admin, /vote
```

**Update v6 spectator:**
1. Edit `views/claude_design/monument-valley.jsx` (source of truth)
2. Rebuild `views/live-v6.html` by running:
```bash
CD=/Users/georgchimion/Desktop/Coding/portfolio/agent-factory/views/claude_design
V=/Users/georgchimion/Desktop/Coding/portfolio/agent-factory/views
HEAD_STYLE=$(awk '/<link href="https:\/\/fonts.googleapis|<style>/,/<\/style>/' "$CD/Agent Factory - Monument Valley.html")
cat > "$V/live-v6.html" << HEAD
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>Agent Factory — Monument Valley</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${HEAD_STYLE}
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head><body><div id="root"></div>
<script type="text/babel" data-presets="react">
HEAD
cat "$CD/monument-valley.jsx" >> "$V/live-v6.html"
cat >> "$V/live-v6.html" << 'TAIL'

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.MonumentApp));
</script></body></html>
TAIL
```

**Deploy any view change to production:**
```bash
# Single file
scp views/<file>.html root@159.89.185.96:/var/www/agent-factory/views/<file>.html

# Or all views at once
scp views/*.html root@159.89.185.96:/var/www/agent-factory/views/

# If demo-*.html changed, also push to subdomain
scp views/demo-aml.html root@159.89.185.96:/var/www/sites/aml/index.html
scp views/demo-kyc.html root@159.89.185.96:/var/www/sites/kyc/index.html
scp views/demo-tracker.html root@159.89.185.96:/var/www/sites/tracker/index.html

# If server.js changed, restart
ssh root@159.89.185.96 'pm2 restart factory'
```

**Drive the demo from CLI (handy for testing without UI):**
```bash
curl -X POST https://factory.georg.miami/factory/api/voting/reset
curl -X POST https://factory.georg.miami/factory/api/voting/open
curl -X POST -H 'Content-Type: application/json' -d '{"option":1}' https://factory.georg.miami/factory/api/vote
curl -X POST https://factory.georg.miami/factory/api/voting/close
# Then watch SSE: curl -N https://factory.georg.miami/factory/api/live-stream
```

---

## 📋 Standing user instructions (apply across resumed sessions)

- **No Playwright screenshots / Chrome popups during work** — Georg explicitly forbade. Verify changes by reading code + curl. Tell him to look in his own browser.
- **Always provide clickable links when asking him to test** — never paste a bare URL.
- **No ASCII / emoji-heavy UI** — Coinbase / TD Bank / PwC audience. Corporate but warm.
- **No "$" cost displays** — he's on Claude Max, $0 marginal cost. Use "0 human edits" as the credibility signal instead.
- **No mention of "VPS" / "/var/www/" / technical jargon** in audience-facing text.
- **Don't lead with speed** — lead with safety / "de-risked deployment". Speed is the byproduct.
- **Move to `_backup/` before deleting anything** — never `rm -rf` files he's been working on.
