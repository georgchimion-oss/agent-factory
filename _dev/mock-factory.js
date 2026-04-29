// mock-factory.js — local dev SSE server for variant testing
// Serves views/ static + /factory/api/live-stream with a looping fake build.
// Plus a live audience-vote endpoint that gates the demo build.
// Run: node _dev/mock-factory.js
// Then visit: http://localhost:5050/vote (or /v1, /v2, /v4)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5050;
const VIEWS = path.join(__dirname, '..', 'views');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// ---------------------------------------------------------------------------
// Voting state
// ---------------------------------------------------------------------------
const DEFAULT_OPTIONS = () => ([
  {
    id: 1,
    label: 'AML Transaction Monitoring Console',
    description: 'SAR-ready alerts. FinCEN-aligned scoring. Live drill-down.',
    fullPrompt: 'Build a real-time anti-money-laundering transaction monitoring dashboard. Show: top KPIs (transactions today, high-risk flagged, SARs in review, avg response time); live transaction feed with risk scores 0-100; alert panel with rule names (Structuring, Smurfing, Layering, OFAC SDN match, PEP exposure, Velocity anomaly); inline-SVG risk distribution histogram; stylized geographic risk map. Filters by time/threshold/jurisdiction. Drill-down side panel per transaction with FinCEN-quoted recommended action. Light theme, deep blue accent. Mobile-perfect.',
    deployPath: '/demo-aml',
    deployHost: 'aml.georg.miami',
    votes: 0
  },
  {
    id: 2,
    label: 'KYC / CIP Intake Pipeline',
    description: 'OFAC screening. Document verification. Audit trail.',
    fullPrompt: 'Build a client onboarding system with KYC/CIP flow. Show: 7-stage pipeline stepper (Identity Capture → Document Verification → OFAC Screen → Risk Tier → EDD → Final Review → Approved); active case detail card with document upload status (Verified/Pending/Failed); sanctions screening (OFAC SDN, EU consolidated, UN, PEP); risk tier assignment with rationale; audit log streaming. Queue panel with 8-12 in-progress cases. KYC/CIP/EDD/PEP/UBO terminology. Light theme, deep teal accent. Mobile-perfect.',
    deployPath: '/demo-kyc',
    deployHost: 'kyc.georg.miami',
    votes: 0
  },
  {
    id: 3,
    label: 'Engagement Workstream Tracker',
    description: 'SOX-auditable assignments. Segregation of duties. Live status.',
    fullPrompt: 'Build a consulting/audit engagement tracker. Show: portfolio grid of 6-9 active engagements (SOX 404, M&A due diligence, IPO readiness) with health badges; selected-engagement detail with workstream tabs (Planning/Fieldwork/Testing/Reporting/Wrap-up); Kanban board (To Do / In Progress / In Review / Completed) with assignees, hours estimated/actual, blocking flags, SoD conflict flags; audit trail panel with timestamped events. SOX 404, ICFR, COSO, PCAOB AS terminology. Light theme, deep purple accent. Mobile-perfect.',
    deployPath: '/demo-tracker',
    deployHost: 'tracker.georg.miami',
    votes: 0
  },
]);

let votingState = {
  status: 'idle',          // 'idle' | 'open' | 'closed'
  options: DEFAULT_OPTIONS(),
  startedAt: null,
  durationSec: 30,
  endsAt: null,
  winner: null,
};
let autoCloseTimer = null;

function pickWinner() {
  // highest votes; ties → option 1
  let best = votingState.options[0];
  for (const o of votingState.options) {
    if (o.votes > best.votes) best = o;
  }
  if (best.votes === 0) return votingState.options[0].id;
  // ties → lowest id (option 1 wins ties as spec says)
  const top = votingState.options.filter(o => o.votes === best.votes);
  top.sort((a, b) => a.id - b.id);
  return top[0].id;
}

function openVoting() {
  // Reset tallies on open so each round is fresh
  votingState.options = DEFAULT_OPTIONS();
  votingState.status = 'open';
  votingState.startedAt = Date.now();
  votingState.endsAt = Date.now() + votingState.durationSec * 1000;
  votingState.winner = null;
  if (autoCloseTimer) clearTimeout(autoCloseTimer);
  autoCloseTimer = setTimeout(() => {
    closeVoting('auto');
  }, votingState.durationSec * 1000);
  console.log(`[vote] opened — ${votingState.durationSec}s window`);
  broadcastAll({ type: 'voting_state', votingState });
}

function closeVoting(reason = 'manual') {
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
  votingState.status = 'closed';
  votingState.endsAt = Date.now();
  votingState.winner = pickWinner();
  const w = votingState.options.find(o => o.id === votingState.winner);
  console.log(`[vote] closed (${reason}) — winner: #${votingState.winner} ${w ? w.label : ''}`);
  broadcastAll({ type: 'voting_state', votingState });
}

function resetVoting() {
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
  votingState = {
    status: 'idle',
    options: DEFAULT_OPTIONS(),
    startedAt: null,
    durationSec: 30,
    endsAt: null,
    winner: null,
  };
  console.log('[vote] reset to idle');
  broadcastAll({ type: 'voting_state', votingState });
}

// ---------------------------------------------------------------------------
// Per-winner Reviewer-rejection content (the demo's moneyshot).
// The Reviewer flags an issue, sends back to Coder, who revises, then approves.
// This is what makes the audience say "the agents caught a flaw before it shipped."
// ---------------------------------------------------------------------------
const REVISION_CONTENT = {
  // Option 1 — AML console: false-positive cascade on structuring threshold
  1: {
    rejectFindings:    'Mobile responsiveness — pass. Accessibility — pass. Visual polish — pass.',
    rejectIssue:       'Score 6/10 — structuring rule would flag 12% of legitimate USD wires as suspicious.',
    rejectFeedback:    'Threshold $9,500 too aggressive — false-positive cascade on round-amount clusters.',
    coderRevise1:      'Reverting threshold. Re-tuning rule against 90-day baseline.',
    coderRevise2:      'Threshold adjusted to $9,950. Re-running checks.',
    reviewerApprove:   'Score 9/10 — structuring detection without false-positive cascade. Approved.',
    approveFeedback:   'Tuned rule passes baseline + edge-case set.',
  },
  // Option 2 — KYC: OFAC SDN ordering bug
  2: {
    rejectFindings:    'Document validation — pass. Audit trail — pass. Mobile — pass.',
    rejectIssue:       'Score 6/10 — OFAC SDN check fires AFTER document upload.',
    rejectFeedback:    'Flagged customers retain a sensitive-data exposure window. SDN screen must run first.',
    coderRevise1:      'Reordering pipeline. Sanctions check pre-empts document handling.',
    coderRevise2:      'OFAC + EU + UN screen now block doc upload until cleared.',
    reviewerApprove:   'Score 9/10 — sanctions ordering correct. Approved.',
    approveFeedback:   'Pipeline order matches BSA/AML manual §3.2.',
  },
  // Option 3 — Tracker: SoD violation
  3: {
    rejectFindings:    'Kanban flow — pass. Audit trail — pass. Mobile — pass.',
    rejectIssue:       'Score 6/10 — segregation-of-duties violation: same operator can prepare AND approve.',
    rejectFeedback:    'Violates SOX 404. Need separate approver role.',
    coderRevise1:      'Adding approver gate. Same-operator self-approval blocked.',
    coderRevise2:      'SoD enforced. Approval requires distinct user with approver role.',
    reviewerApprove:   'Score 9/10 — SoD compliant. Approved.',
    approveFeedback:   'PCAOB AS 2315 segregation rules satisfied.',
  },
};

// ---------------------------------------------------------------------------
// Build sequence (looped after voting closes)
// Tokens like __WINNER__, __REJECT_FINDINGS__, etc. are rewritten per winner.
// ---------------------------------------------------------------------------
const buildSequence = [
  { delay: 800,  ev: { type: 'build_started', buildId: 'demo', startedAt: Date.now() } },
  { delay: 600,  ev: { type: 'agent_status', agent: 'pm', status: 'working', message: 'Reading the brief' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'pm', message: 'Brief received: __WINNER__. Plan for breadth, not depth.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'pm', message: 'Pulling reference templates from the prior fintech build set.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'pm', message: 'Acceptance criteria locked: WCAG 2.2 AA · mobile-first · no client-side PII.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'pm', message: 'Spec drafted — three sections, server-rendered, charts as inline SVG.' } },
  { delay: 3000, ev: { type: 'agent_status', agent: 'pm', status: 'done', message: 'Spec ready' } },
  { delay: 800,  ev: { type: 'agent_status', agent: 'coder', status: 'working', message: 'Writing the layout' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'coder', message: 'Building the hero — gradient, stat readout, hover states.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: 'TypeScript scaffold up. Tailwind, lucide-react wired. No recharts — inline SVG only.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: 'Hero done. Moving to the data grid.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: 'Color tokens generated against WCAG 2.2 AA — 4.7:1 minimum on body text.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: 'Charts rendered as inline SVG — zero runtime dependencies.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: 'Bundle weighed: 138 KB gzipped. Inside the 200 KB budget.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: 'Viewport tested at 375 / 768 / 1280. No layout shift, CLS 0.04.' } },
  { delay: 2000, ev: { type: 'agent_status', agent: 'coder', status: 'done', message: 'Ready for review' } },

  // --- FIRST REVIEW: rejection beat (the demo's moneyshot) ---
  { delay: 800,  ev: { type: 'agent_status', agent: 'reviewer', status: 'working', message: 'Reviewing' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'reviewer', message: 'Lint clean. Bundle within budget. Running rule-engine smoke test against the 90-day baseline.' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'reviewer', message: '__REJECT_FINDINGS__' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'reviewer', message: '__REJECT_ISSUE__' } },
  { delay: 1500, ev: { type: 'review_result', score: 6, passed: false, feedback: '__REJECT_FEEDBACK__' } },
  { delay: 1500, ev: { type: 'agent_status', agent: 'reviewer', status: 'done', message: 'Sent back for revision' } },

  // --- CODER REVISES ---
  { delay: 800,  ev: { type: 'agent_status', agent: 'coder', status: 'working', message: 'Revising' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'coder', message: '__CODER_REVISE_1__' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: '__CODER_REVISE_2__' } },
  { delay: 2500, ev: { type: 'agent_status', agent: 'coder', status: 'done', message: 'Revision complete' } },

  // --- SECOND REVIEW: approve ---
  { delay: 800,  ev: { type: 'agent_status', agent: 'reviewer', status: 'working', message: 'Re-reviewing' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'reviewer', message: 'Re-running the false-positive set. Threshold change checks out against historical baseline.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'reviewer', message: '__REVIEWER_APPROVE__' } },
  { delay: 1500, ev: { type: 'review_result', score: 9, passed: true, feedback: '__APPROVE_FEEDBACK__' } },
  { delay: 1500, ev: { type: 'agent_status', agent: 'reviewer', status: 'done', message: 'Approved' } },

  // --- DEPLOY ---
  { delay: 800,  ev: { type: 'agent_status', agent: 'deployer', status: 'working', message: 'Shipping to production' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'deployer', message: 'Production bundle built. Uploading to CDN edge.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'deployer', message: 'TLS cert valid. Health check 200. Cutting traffic over.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'deployer', message: 'Live at demo-site.georg.miami' } },
  { delay: 2500, ev: { type: 'agent_status', agent: 'deployer', status: 'done', message: 'Live' } },
  { delay: 500,  ev: { type: 'build_complete', buildId: 'demo', plan: { projectName: 'Demo Site' }, review: { score: 9 }, siteName: 'demo-site', siteUrl: 'https://demo-site.georg.miami', elapsed: 115 } },
  { delay: 300,  ev: { type: 'celebrate', elapsed: 115 } },
];

// Token replacer for per-winner content
function applyRevisionTokens(message, winnerId) {
  if (typeof message !== 'string') return message;
  const c = REVISION_CONTENT[winnerId] || REVISION_CONTENT[1];
  return message
    .replace('__REJECT_FINDINGS__', c.rejectFindings)
    .replace('__REJECT_ISSUE__',    c.rejectIssue)
    .replace('__REJECT_FEEDBACK__', c.rejectFeedback)
    .replace('__CODER_REVISE_1__',  c.coderRevise1)
    .replace('__CODER_REVISE_2__',  c.coderRevise2)
    .replace('__REVIEWER_APPROVE__',c.reviewerApprove)
    .replace('__APPROVE_FEEDBACK__',c.approveFeedback);
}

// ---------------------------------------------------------------------------
// SSE plumbing
// ---------------------------------------------------------------------------
const clients = new Set();

function broadcastTo(client, ev) {
  try { client.write(`data: ${JSON.stringify(ev)}\n\n`); } catch (e) { clients.delete(client); }
}

function broadcastAll(ev) {
  for (const c of clients) broadcastTo(c, ev);
}

// ---------------------------------------------------------------------------
// Build watcher — manually triggered by the admin (Georg).
// Voting does NOT auto-open. Georg POSTs /factory/api/voting/open from /admin
// when ready. When voting closes (auto after durationSec OR manual close),
// the build sequence fires automatically using the winner's label.
// After the build, the page stays IDLE until Georg opens voting again.
// ---------------------------------------------------------------------------
let watcherRunning = false;
let mockBuilding = false;
async function watchForBuilds() {
  if (watcherRunning) return;
  watcherRunning = true;

  while (true) {
    // Wait for voting to be closed (i.e. a winner exists)
    while (votingState.status !== 'closed') {
      await new Promise(r => setTimeout(r, 250));
    }

    // Run the build using the winner's full brief + their pre-built demo URL
    const winner = votingState.options.find(o => o.id === votingState.winner);
    const brief        = winner ? winner.label       : 'Demo Site';
    const fullPrompt   = winner ? winner.fullPrompt  : 'Build a single-page web app.';
    const deployPath   = winner ? winner.deployPath  : '/';
    const deployHost   = winner ? winner.deployHost  : 'demo-site.georg.miami';
    const siteUrlLocal = `http://localhost:${PORT}${deployPath}`;
    const siteUrlProd  = `https://${deployHost}`;
    console.log(`[build] starting: ${brief} → ${siteUrlLocal}`);
    mockBuilding = true;

    const winnerId = votingState.winner || 1;

    for (const step of buildSequence) {
      await new Promise(r => setTimeout(r, step.delay));
      let ev = step.ev;
      if (ev.type === 'build_started') {
        ev = { ...ev, startedAt: Date.now(), brief, fullPrompt };
      } else if (ev.type === 'chat_message' && typeof ev.message === 'string') {
        let m = ev.message;
        if (m.includes('__WINNER__')) m = m.replace('__WINNER__', brief);
        m = applyRevisionTokens(m, winnerId);
        ev = { ...ev, message: m };
      } else if (ev.type === 'review_result' && typeof ev.feedback === 'string') {
        ev = { ...ev, feedback: applyRevisionTokens(ev.feedback, winnerId) };
      } else if (ev.type === 'build_complete') {
        ev = {
          ...ev,
          plan: { projectName: brief },
          siteName: deployHost.split('.')[0],
          siteUrl: siteUrlLocal,        // local clickable URL for demo
          siteUrlProd,                  // production URL for reference
        };
      } else if (ev.type === 'chat_message' && typeof ev.message === 'string' && ev.message.includes('demo-site.georg.miami')) {
        ev = { ...ev, message: ev.message.replace('demo-site.georg.miami', deployHost) };
      }
      broadcastAll(ev);
    }
    mockBuilding = false;

    console.log('[build] complete — staying idle until admin re-opens voting');

    // Stay idle: wait for status to change (admin reset or new voting open)
    while (votingState.status === 'closed') {
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

// ---------------------------------------------------------------------------
// Iteration mini-build (mirrors prod /factory/api/iterate)
// ---------------------------------------------------------------------------
const ITERATE_SEQUENCE = [
  { delay: 1000, ev: { type: 'build_started', buildId: 'iterate', startedAt: Date.now(), iteration: true } },
  { delay: 800,  ev: { type: 'agent_status', agent: 'pm', status: 'working', message: 'On it' } },
  { delay: 2500, ev: { type: 'chat_message', agent: 'pm', message: 'Got it — Miami palette, dropping the unnecessary panel.' } },
  { delay: 2000, ev: { type: 'agent_status', agent: 'pm', status: 'done', message: 'Briefed' } },
  { delay: 600,  ev: { type: 'agent_status', agent: 'coder', status: 'working', message: 'Editing' } },
  { delay: 2500, ev: { type: 'chat_message', agent: 'coder', message: 'Adjusting palette. Removing the panel. Re-running checks.' } },
  { delay: 3000, ev: { type: 'agent_status', agent: 'coder', status: 'done', message: 'Changes ready' } },
  { delay: 600,  ev: { type: 'agent_status', agent: 'reviewer', status: 'working', message: 'Quick review' } },
  { delay: 2500, ev: { type: 'chat_message', agent: 'reviewer', message: 'Cleared. Layout still meets WCAG AA contrast.' } },
  { delay: 1000, ev: { type: 'review_result', score: 9, passed: true, feedback: 'Iteration approved.' } },
  { delay: 1000, ev: { type: 'agent_status', agent: 'reviewer', status: 'done', message: 'Cleared' } },
  { delay: 600,  ev: { type: 'agent_status', agent: 'deployer', status: 'working', message: 'Shipping v2' } },
  { delay: 2000, ev: { type: 'chat_message', agent: 'deployer', message: 'v2 LIVE — same URL, refresh to see' } },
  { delay: 1500, ev: { type: 'agent_status', agent: 'deployer', status: 'done', message: 'Live' } },
  { delay: 500,  ev: { type: 'build_complete', buildId: 'iterate', iteration: true, plan: { projectName: 'v2' }, review: { score: 9 }, elapsed: 22 } },
];

let mockIterating = false;
async function fireMockIterate(message) {
  if (mockIterating) return { ok: false, error: 'already_iterating' };
  if (mockBuilding) return { ok: false, error: 'build_in_progress' };
  mockIterating = true;
  try {
    const winner = votingState.options.find(o => o.id === votingState.winner);
    const deployHost = winner ? winner.deployHost : 'demo-site.georg.miami';
    const deployPath = winner ? winner.deployPath : '/';
    const siteName   = deployHost.split('.')[0];
    // Locally we just point both at the local demo URLs so they're testable
    const siteUrlV1  = `http://localhost:${PORT}${deployPath}`;
    const siteUrlV2  = `http://localhost:${PORT}${deployPath}-v2`;
    broadcastAll({
      type: 'slack_message',
      channel: 'agent-factory-demo',
      sender: 'Georg',
      recipient: 'PM',
      message,
      ts: Date.now(),
    });
    for (const step of ITERATE_SEQUENCE) {
      await new Promise(r => setTimeout(r, step.delay));
      let ev = step.ev;
      if (ev.type === 'build_started') {
        ev = { ...ev, startedAt: Date.now(), brief: `Iteration: ${message}`, iteration: true };
      } else if (ev.type === 'build_complete') {
        ev = { ...ev, plan: { projectName: winner ? winner.label : 'v2' }, siteName, siteUrl: siteUrlV2, siteUrlV1, siteUrlV2, iteration: true, iterationVersion: 2 };
      }
      broadcastAll(ev);
    }
    broadcastAll({ type: 'iteration_complete', siteName, siteUrl: siteUrlV2, siteUrlV1, siteUrlV2, version: 2 });
    console.log('[iterate] mock complete — v2 served at ' + siteUrlV2);
  } finally {
    mockIterating = false;
  }
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) { req.destroy(); reject(new Error('payload too large')); }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS for safety
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  const urlPathRaw = req.url.split('?')[0];

  // ------- SSE -------
  if (urlPathRaw === '/factory/api/live-stream') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'connected', spectatorCount: clients.size + 1 })}\n\n`);
    // Send current voting state so late-joiners catch up
    res.write(`data: ${JSON.stringify({ type: 'voting_state', votingState })}\n\n`);
    clients.add(res);
    watchForBuilds();
    req.on('close', () => clients.delete(res));
    return;
  }

  // ------- Voting API -------
  if (urlPathRaw === '/factory/api/voting-state' && req.method === 'GET') {
    return sendJson(res, 200, votingState);
  }

  if (urlPathRaw === '/factory/api/vote' && req.method === 'POST') {
    let body;
    try { body = await readJsonBody(req); }
    catch (e) { return sendJson(res, 400, { ok: false, error: 'invalid_json' }); }
    const optionId = parseInt(body.option, 10);
    if (![1, 2, 3].includes(optionId)) {
      return sendJson(res, 400, { ok: false, error: 'invalid_option' });
    }
    if (votingState.status !== 'open') {
      return sendJson(res, 409, { ok: false, error: 'voting_not_open', tally: votingState });
    }
    const opt = votingState.options.find(o => o.id === optionId);
    if (!opt) return sendJson(res, 400, { ok: false, error: 'unknown_option' });
    opt.votes += 1;
    console.log(`[vote] +1 option ${optionId} (${opt.label}) → ${opt.votes}`);
    broadcastAll({ type: 'voting_state', votingState });
    return sendJson(res, 200, { ok: true, tally: votingState });
  }

  if (urlPathRaw === '/factory/api/voting/open' && req.method === 'POST') {
    openVoting();
    return sendJson(res, 200, votingState);
  }

  if (urlPathRaw === '/factory/api/voting/close' && req.method === 'POST') {
    if (votingState.status !== 'open') {
      return sendJson(res, 409, { ok: false, error: 'voting_not_open', tally: votingState });
    }
    closeVoting('manual');
    return sendJson(res, 200, votingState);
  }

  if (urlPathRaw === '/factory/api/voting/reset' && req.method === 'POST') {
    resetVoting();
    return sendJson(res, 200, votingState);
  }

  // ------- Iterate API (Talk-to-PM beat) -------
  if (urlPathRaw === '/factory/api/iterate' && req.method === 'POST') {
    let body;
    try { body = await readJsonBody(req); }
    catch (e) { return sendJson(res, 400, { ok: false, error: 'invalid_json' }); }
    const message = (typeof body.message === 'string') ? body.message.trim() : '';
    if (!message) return sendJson(res, 400, { ok: false, error: 'message_required' });
    if (message.length > 500) return sendJson(res, 400, { ok: false, error: 'message_too_long' });
    if (mockIterating)  return sendJson(res, 409, { ok: false, error: 'already_iterating' });
    if (mockBuilding)   return sendJson(res, 409, { ok: false, error: 'build_in_progress' });
    if (votingState.status !== 'closed' || !votingState.winner) {
      return sendJson(res, 409, { ok: false, error: 'no_winner' });
    }
    fireMockIterate(message).catch(err => console.error('[iterate]', err));
    return sendJson(res, 200, { ok: true, accepted: true });
  }
  if (urlPathRaw === '/factory/api/iterate/reset' && req.method === 'POST') {
    // Mock dev: just log — there's no /var/www/sites locally to swap.
    console.log('[iterate] reset request (mock no-op)');
    return sendJson(res, 200, { ok: true, mock: true });
  }

  // ------- Static -------
  let urlPath = urlPathRaw;
  if (urlPath === '/') urlPath = '/live-v10.html';
  if (urlPath === '/live') urlPath = '/live.html';
  if (urlPath === '/vote') urlPath = '/live-v10.html'; // back-compat: legacy /vote → unified view
  if (urlPath === '/v1')       urlPath = '/live-v1.html';
  if (urlPath === '/v2')       urlPath = '/live-v2.html';
  if (urlPath === '/v4')       urlPath = '/live-v4.html';
  if (urlPath === '/v4-beach')     urlPath = '/live-v4-beach.html';
  if (urlPath === '/v5')           urlPath = '/live-v5.html';
  if (urlPath === '/v6')           urlPath = '/live-v6.html';
  if (urlPath === '/v7')           urlPath = '/live-v7.html';
  if (urlPath === '/v8')           urlPath = '/live-v8.html';
  if (urlPath === '/v9')           urlPath = '/live-v9.html';
  if (urlPath === '/v9b')          urlPath = '/live-v9b.html';
  if (urlPath === '/v9c')          urlPath = '/live-v9c.html';
  if (urlPath === '/v10')          urlPath = '/live-v10.html';
  // /vote handled above (back-compat redirect to unified view)
  if (urlPath === '/admin')        urlPath = '/admin.html';
  if (urlPath === '/demo-aml')     urlPath = '/demo-aml.html';
  if (urlPath === '/demo-kyc')     urlPath = '/demo-kyc.html';
  if (urlPath === '/demo-tracker') urlPath = '/demo-tracker.html';
  if (urlPath === '/demo-aml-v2')     urlPath = '/demo-aml-v2.html';
  if (urlPath === '/demo-kyc-v2')     urlPath = '/demo-kyc-v2.html';
  if (urlPath === '/demo-tracker-v2') urlPath = '/demo-tracker-v2.html';

  const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(VIEWS, safePath);
  if (!filePath.startsWith(VIEWS)) {
    res.writeHead(403); res.end('forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('not found: ' + urlPath); return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Mock factory listening on http://localhost:${PORT}`);
  console.log(`  http://localhost:${PORT}/vote     (Audience vote)`);
  console.log(`  http://localhost:${PORT}/v1       (The Floor)`);
  console.log(`  http://localhost:${PORT}/v2       (Mission Control)`);
  console.log(`  http://localhost:${PORT}/v4       (Miami)`);
  console.log(`  http://localhost:${PORT}/v4-beach (Miami Beach)`);
});
