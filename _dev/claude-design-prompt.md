# Claude Design — Agent Factory spectator UI

Single HTML page, watched on a giant projector and on phones (via QR), while 4 AI agents collaborate live to ship a real web app in under 3 minutes. Audience: Coinbase, TD Bank, internal PwC executives. They are scanning for theater. They will reward credibility, hate gimmicks, and roll their eyes at AI-aesthetic clichés.

This is the **spectator screen**, not the agents themselves. It mirrors a real-time event stream — voting, then building, then a live URL reveal — across a 65" projector and the audience's iPhones simultaneously. Both surfaces must work without scrolling.

## Goal

Make the audience say "this is a real system" within 10 seconds, "I want to participate" within 30, and "I have to show this to my team" by the end. Earn the applause.

## States (the page must handle all four cleanly)

1. **Idle** — Big QR + headline "VOTE TO BUILD A LIVE APP IN UNDER 3 MINUTES." Nothing else competing. The QR must be the obvious target.
2. **Voting open** — A 30-second countdown dominates. Three vote cards stacked or row-aligned, each with a live tally bar growing in real-time as audience taps phones. Cards are obviously tappable on the big screen too (lifted, glowing border, "TAP TO VOTE" microcopy). Last 5 seconds: countdown turns red, screen pulses subtly.
3. **Building** — Top: persistent banner reading `BUILDING: <prompt>` in display weight. Center stage: 4 abstract agent glyphs (NOT cartoon faces — geometric icons that pulse/light up: clipboard for PM, terminal for Engineer, magnifier for Reviewer, paper-plane for Deployer) arranged in a row. Active glyph glows in neon, others dim. On every handoff, a single neon orb travels along a curved path between glyphs (~800ms), receiving glyph pulses once. Build clock running in tabular monospace, large. Side panel: a real-time governance/build log streaming actual artifacts — `[14:02:11] PII scan passed`, `[14:02:14] CVE check clean`, `Created auth.ts`, `Wrote schema.sql` — like a CI/CD pipeline. Mid-build: progress meter that rhythmically stalls at 70% then surges (predictable bars are boring).
4. **Complete** — Full-screen takeover. The deployed URL types itself character-by-character at 140px in monospace. QR code beside it. One clean chime. Then: live iframe of the actual app loads on-screen WHILE the audience scans. Below: "Built in 2:47 · 0 human edits · Claude Max." A "Send to colleague" pre-fill on the phone view. (Do NOT include any $ cost figure — the user runs on Claude Max so per-call cost is $0 marginal; showing dollar figures would mislead the audience.)

## Vote options (use these exact phrasings — they're already calibrated for this audience)

1. **AML Transaction Monitoring Console** — _SAR-ready alerts, FinCEN-aligned scoring._
2. **KYC/CIP Intake Pipeline** — _OFAC screening, document verification, audit trail._
3. **Engagement Workstream Tracker** — _SOX-auditable assignments, segregation of duties._

## Hierarchy & motion

3-second test from 30 feet: in every state, ONE thing must dominate. Idle → QR. Voting → countdown. Building → build clock + active glyph. Complete → URL. Secondary content fades to ~30% opacity during reveals so it doesn't compete.

Motion only earns its place by signaling state change. Idle = calm. Active glyph breathes (scale 1.0→1.02 over 2s). Walking handoff = the only horizontal motion on screen, ~1.2s ease-in-out, leaves a brief neon trail. No parallax. No confetti spam. No bouncing. No spinners over 2s.

## Visual anchors (lock these, design everything else cohesive)

- Base: deep navy `#0A1628` (NOT pure black — projectors blow it out)
- Primary CTA: PwC orange `#D04A02` — non-negotiable, this is *their* color
- Active state: neon cyan `#00F0FF`
- Deployed/success state: neon green `#39FF14`
- Sunset gradient `#FF6B6B → #FFA94D → #845EC2` allowed ONLY in backgrounds at ≤40% opacity, never on text
- Card surface: frosted glass `rgba(255,255,255,0.08)` with a 1px `#FFA94D` border

## Typography

- Display headline + URL reveal: **Monument Extended** or **Druk Wide**, 120-200px on big screen, tabular numerals
- Body + microcopy: **IBM Plex Sans** or **Inter**, minimum 22px on big screen / 16px on phone
- Build clock + monospace: **JetBrains Mono**, tabular numerals mandatory (numbers must not jitter)

## Banned

No purple-pink gradients on foreground. No glassmorphism overlays stacked on glassmorphism. No emoji. No anthropomorphic agent faces. No talking avatars. No "✨ AI-powered ✨" language. No "magic." No chat bubble UI. No drop shadows on neon. No bouncing characters. No corporate stock illustrations. No multi-step onboarding before the vote.

## Mobile (audience phones)

Different hierarchy: vote buttons fill the screen, headline + countdown above. No decorative palms or sun. Big tap-targets (≥56px), haptic-style scale-down on press. Post-build: live iframe + share button.

## Output

A single self-contained HTML file (one file, ~600-1200 lines). Inline CSS. Inline JS. Only Google Fonts allowed via CDN, plus one tiny QR encoder if needed. The same file serves both the big projector screen and audience phones — fully responsive. The QR code encodes the page's own URL (`window.location.href`) so audience scans → opens the same page on their phone in mobile layout.

The page connects to a Server-Sent Events stream at `/factory/api/live-stream` and handles these event types: `connected`, `voting_state` (with `status: idle|open|closed`, `options[]`, `endsAt`, `winner`), `build_started` (with `brief`), `agent_status` (with `agent: pm|coder|reviewer|deployer`, `status: idle|working|done`, `message`), `chat_message` (with `agent`, `message`), `review_result` (with `score`, `passed`), `build_complete` (with `siteUrl`, `siteName`, `elapsed`), `celebrate`, `error`, `spectator_count`. Reconnect on disconnect with exponential backoff.

The voting endpoint accepts `POST /factory/api/vote` with `{option: 1|2|3}`. Vote cards on BOTH the big screen and phone should POST when tapped. Use `localStorage` key `factory_voted` to prevent double-voting per device — once a device has voted, mark that card with a "YOUR VOTE" badge and silently no-op further taps.

Return the complete HTML, ready to drop in. No commentary.
