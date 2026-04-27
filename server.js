'use strict';
require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const PMAgent = require('./agents/pm');
const CoderAgent = require('./agents/coder');
const ReviewerAgent = require('./agents/reviewer');
const DeployerAgent = require('./agents/deployer');

// ============================================
// CONFIG — no API key needed, uses claude -p ($0 on Max)
// ============================================

const PORT = process.env.PORT || 3002;
const OPS_AUTH_TOKEN = process.env.OPS_AUTH_TOKEN || 'dev-ops-token';

// ============================================
// EXPRESS APP
// ============================================

const app = express();
app.use(express.json());
app.use('/pixel-assets', express.static(path.join(__dirname, 'views', 'pixel-assets')));

// ============================================
// USAGE TRACKING (no database — log only)
// ============================================

async function trackUsage(endpoint, response, sessionId) {
    if (!response?.usage) return;
    const { input_tokens, output_tokens } = response.usage;
    const costCents = (input_tokens * 0.3 + output_tokens * 1.5) / 100000;
    console.log(`[usage] ${endpoint}: ${input_tokens} in, ${output_tokens} out, $${(costCents / 100).toFixed(4)}`);
}

// ============================================
// SSE CLIENTS
// ============================================

const factoryClients = new Set();
const spectatorClients = new Set();
const factoryBuilds = new Map();
const factorySites = new Map();

let buildStartedAt = null;

function broadcastFactory(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of factoryClients) {
        try { client.write(data); } catch (e) { factoryClients.delete(client); }
    }
}

function broadcastSpectator(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of spectatorClients) {
        try { client.write(data); } catch (e) { spectatorClients.delete(client); }
    }
}

function broadcastAll(event) {
    broadcastFactory(event);
    const allowed = ['connected', 'agent_status', 'chat_message', 'build_started', 'build_complete', 'celebrate', 'review_result', 'task_created', 'error', 'heartbeat', 'voting_state', 'spectator_count'];
    if (allowed.includes(event.type)) {
        broadcastSpectator(event);
    }
}

function broadcastSpectatorCount() {
    broadcastFactory({ type: 'spectator_count', count: spectatorClients.size });
}

// ============================================
// AGENTS
// ============================================

// Load persisted factory sites from disk
DeployerAgent.loadFromDisk(factorySites);

const agents = {
    pm: new PMAgent({ broadcast: broadcastAll, trackUsage }),
    coder: new CoderAgent({ broadcast: broadcastAll, trackUsage }),
    reviewer: new ReviewerAgent({ broadcast: broadcastAll, trackUsage }),
    deployer: new DeployerAgent({ broadcast: broadcastAll, trackUsage, factorySites, factoryBuilds }),
};

// Conversation state
let factoryCurrentSite = null;
let factoryLastReview = null;
let factoryLastPlan = null;
let factoryLastHtml = null;

// ============================================
// AUTH MIDDLEWARE
// ============================================

function opsAuthMiddleware(req, res, next) {
    const token = req.query.token || req.headers['x-ops-token'];
    if (token !== OPS_AUTH_TOKEN) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
}

// ============================================
// ROUTES — Dashboard & Spectator
// ============================================

// Public visitors see the spectator view (read-only)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live.html'));
});

// Georg's operator dashboard (needs auth token)
app.get('/dashboard', opsAuthMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'factory.html'));
});

// Legacy routes
app.get('/factory', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live.html'));
});

app.get('/live', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live.html'));
});

app.get('/factory/live', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live.html'));
});

// Variant spectator pages — all live simultaneously, audience can switch
app.get('/v1', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v1.html'));
});
app.get('/v2', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v2.html'));
});
app.get('/v4', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v4.html'));
});
app.get('/v4-beach', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v4-beach.html'));
});
app.get('/v5', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v5.html'));
});
app.get('/v6', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v6.html'));
});
app.get('/v7', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v7.html'));
});
app.get('/v8', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v8.html'));
});
app.get('/v9', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v9.html'));
});
app.get('/v9b', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v9b.html'));
});
app.get('/v9c', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v9c.html'));
});
app.get('/v10', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'live-v10.html'));
});
app.get('/vote', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'vote.html'));
});

// ============================================
// ROUTES — SSE Streams
// ============================================

app.get('/factory/api/stream', opsAuthMiddleware, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    agents.pm.resetConversation();
    console.log('Factory: New SSE connection');

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    factoryClients.add(res);
    req.on('close', () => factoryClients.delete(res));
});

app.get('/factory/api/live-stream', (req, res) => {
    if (spectatorClients.size >= 100) {
        return res.status(503).send('Room is full');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    spectatorClients.add(res);
    res.write(`data: ${JSON.stringify({ type: 'connected', spectatorCount: spectatorClients.size })}\n\n`);
    broadcastSpectatorCount();

    req.on('close', () => {
        spectatorClients.delete(res);
        broadcastSpectatorCount();
    });
});

// ============================================
// ROUTES — Build API
// ============================================

app.post('/factory/api/build', opsAuthMiddleware, async (req, res) => {
    const { brief } = req.body;
    if (!brief) return res.status(400).json({ error: 'Brief is required' });

    res.json({ status: 'started', message: 'Build pipeline initiated' });

    runFactory(brief).catch(err => {
        console.error('Factory pipeline error:', err);
        broadcastFactory({ type: 'error', message: err.message });
    });
});

app.get('/factory/api/build/:id', opsAuthMiddleware, (req, res) => {
    const build = factoryBuilds.get(req.params.id);
    if (!build) return res.status(404).json({ error: 'Build not found' });
    res.json(build);
});

app.get('/factory/api/agents', opsAuthMiddleware, (req, res) => {
    res.json(Object.values(agents).map(a => a.getInfo()));
});

// ============================================
// ROUTES — Sites
// ============================================

app.get('/factory/sites/:name', (req, res) => {
    const html = factorySites.get(req.params.name);
    if (!html) return res.status(404).send('<!DOCTYPE html><html><body style="background:#08080A;color:#ccc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h1>Site not found</h1></body></html>');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

app.get('/factory/api/sites', opsAuthMiddleware, (req, res) => {
    const sites = [];
    for (const [name] of factorySites) {
        sites.push({
            name,
            url: `https://${name}.georg.miami`,
            fallbackUrl: `/factory/sites/${name}`
        });
    }
    res.json(sites);
});

app.get('/factory/public/sites', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const fs = require('fs');
        const manifestPath = (process.env.SITES_DIR || '/var/www/sites') + '/sites.json';
        if (!fs.existsSync(manifestPath)) return res.json([]);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const sites = Object.entries(manifest).map(([slug, data]) => ({
            slug, name: data.name, url: data.url, brief: data.brief, score: data.score, createdAt: data.createdAt
        }));
        sites.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(sites);
    } catch (err) {
        res.json([]);
    }
});

app.get('/factory/api/showcase', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const fs = require('fs');
        const manifestPath = (process.env.SITES_DIR || '/var/www/sites') + '/sites.json';
        if (!fs.existsSync(manifestPath)) return res.json([]);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const sites = Object.entries(manifest)
            .map(([slug, data]) => ({ slug, name: data.name, url: data.url, brief: data.brief, score: data.score, createdAt: data.createdAt }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 4);
        res.json(sites);
    } catch (err) {
        res.json([]);
    }
});

// ============================================
// ROUTES — Chat (Conversational Interface)
// ============================================

app.post('/factory/api/chat', opsAuthMiddleware, async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    console.log(`Factory chat: "${message}"`);
    broadcastAll({ type: 'chat_message', agent: 'user', message });
    res.json({ status: 'received' });

    try {
        const context = {
            currentSite: factoryCurrentSite,
            lastReview: factoryLastReview,
        };

        const result = await agents.pm.chat(message, context);
        console.log(`PM decided: action=${result.action}`);

        if (result.action === 'build') {
            runFactory(result.brief || message).catch(err => {
                console.error('Factory pipeline error:', err);
                broadcastAll({ type: 'error', message: err.message });
            });
        } else if (result.action === 'modify' && factoryLastHtml && factoryCurrentSite) {
            runModify(result.instructions).catch(err => {
                console.error('Factory modify error:', err);
                broadcastAll({ type: 'error', message: err.message });
            });
        } else if (result.action === 'modify' && !factoryCurrentSite) {
            broadcastAll({ type: 'chat_message', agent: 'pm',
                message: "There's no active site to modify yet. Tell me what to build first!" });
        }
    } catch (err) {
        console.error('Factory chat error:', err);
        broadcastAll({ type: 'error', message: 'Chat failed: ' + err.message });
    }
});

// ============================================
// PIPELINE — runModify
// ============================================

async function runModify(instructions) {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    broadcastAll({ type: 'build_started', buildId: factoryCurrentSite?.buildId || 'modify', modify: true });

    try {
        agents.pm.moveTo('coder');
        await wait(800);
        agents.pm.say('Sending your feedback to Coder...');
        agents.pm.moveTo('pm');
        await wait(500);

        let html = await agents.coder.revise(factoryLastHtml, instructions);
        await wait(800);

        agents.pm.moveTo('reviewer');
        await wait(800);
        agents.pm.say('Quick review on the changes...');
        agents.pm.moveTo('pm');

        let review = await agents.reviewer.run(html);
        factoryLastReview = review;
        await wait(800);

        if (review.score < 8 && review.revisionInstructions) {
            agents.pm.say(`Reviewer wants a tweak (${review.score}/10). One more round...`);
            agents.pm.moveTo('coder');
            await wait(800);
            agents.pm.moveTo('pm');

            html = await agents.coder.revise(html, review.revisionInstructions);
            await wait(500);

            agents.pm.moveTo('reviewer');
            await wait(800);
            agents.pm.moveTo('pm');
            review = await agents.reviewer.run(html);
            factoryLastReview = review;
            await wait(500);
        }

        factoryLastHtml = html;
        const siteName = factoryCurrentSite.siteName;
        factorySites.set(siteName, html);

        try {
            const fs = require('fs');
            const sitesDir = process.env.SITES_DIR || '/var/www/sites';
            const siteDir = `${sitesDir}/${siteName}`;
            fs.mkdirSync(siteDir, { recursive: true });
            fs.writeFileSync(`${siteDir}/index.html`, html);
        } catch (err) { console.error('Disk write on modify failed:', err.message); }

        const buildId = factoryCurrentSite.buildId;
        const existing = factoryBuilds.get(buildId);
        if (existing) {
            existing.html = html;
            existing.review = review;
            existing.modifiedAt = new Date().toISOString();
        }

        agents.pm.moveTo('deployer');
        await wait(600);
        agents.deployer.setStatus('working', 'Updating...');
        agents.deployer.log(`Updated site: ${siteName}`);
        await wait(500);
        agents.deployer.setStatus('done', 'Updated!');
        agents.deployer.say(`Site updated! ${factoryCurrentSite.url}`);
        agents.pm.moveTo('pm');

        broadcastAll({ type: 'celebrate' });
        broadcastAll({ type: 'chat_message', agent: 'system',
            message: `Site updated! <a href="${factoryCurrentSite.url}" target="_blank">${factoryCurrentSite.url}</a>`
        });

        await wait(3000);
        for (const id of ['pm', 'coder', 'reviewer', 'deployer']) {
            broadcastAll({ type: 'agent_status', agent: id, status: 'idle', message: '' });
        }

        console.log(`Factory modify complete: ${siteName}`);
    } catch (err) {
        console.error('Factory modify error:', err);
        broadcastAll({ type: 'error', message: 'Modification failed: ' + err.message });
        for (const id of ['pm', 'coder', 'reviewer', 'deployer']) {
            broadcastAll({ type: 'agent_status', agent: id, status: 'idle', message: '' });
        }
    }
}

// ============================================
// PIPELINE — runFactory
// ============================================

async function runFactory(brief) {
    const buildId = crypto.randomUUID();
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    // Demo budget: total wall-clock <3 min. Skip optional revision if past this threshold.
    const DEMO_BUDGET_MS = 165 * 1000;

    buildStartedAt = Date.now();
    broadcastAll({ type: 'build_started', buildId, startedAt: buildStartedAt });

    try {
        // 1. PM PHASE
        const plan = await agents.pm.run(brief);
        await wait(500);

        // 2. CODER PHASE
        agents.pm.moveTo('coder');
        await wait(600);
        agents.pm.say('Handing specs to the Coder...');
        agents.pm.moveTo('pm');
        await wait(250);

        let html;
        const coderHeartbeat = setInterval(() => {
            broadcastAll({ type: 'heartbeat', agent: 'coder', message: 'Still coding...' });
        }, 30000);
        try {
            html = await agents.coder.run(plan);
        } catch (coderErr) {
            agents.coder.say('Hit a snag, trying again...');
            html = await agents.coder.run(plan);
        }
        clearInterval(coderHeartbeat);
        await wait(500);

        // 3. REVIEWER PHASE
        agents.pm.moveTo('reviewer');
        await wait(500);
        agents.pm.say('Sending code to Reviewer for QA...');
        agents.pm.moveTo('pm');

        const reviewerHeartbeat = setInterval(() => {
            broadcastAll({ type: 'heartbeat', agent: 'reviewer', message: 'Still reviewing...' });
        }, 30000);
        let review = await agents.reviewer.run(html);
        clearInterval(reviewerHeartbeat);
        await wait(500);

        // 4. ITERATION (max one round, only if review failed AND we're under budget)
        const elapsedSoFar = Date.now() - buildStartedAt;
        const wouldBeOverBudget = elapsedSoFar > DEMO_BUDGET_MS;

        if (review.score < 8 && review.revisionInstructions && !wouldBeOverBudget) {
            agents.pm.say(`Reviewer found issues (${review.score}/10). Sending feedback to Coder for revision...`);
            agents.pm.moveTo('coder');
            await wait(600);
            agents.pm.moveTo('pm');

            const reviseHeartbeat = setInterval(() => {
                broadcastAll({ type: 'heartbeat', agent: 'coder', message: 'Still coding...' });
            }, 30000);
            html = await agents.coder.revise(html, review.revisionInstructions);
            clearInterval(reviseHeartbeat);
            await wait(400);

            agents.pm.say('Revised code ready. Back to Reviewer...');
            agents.pm.moveTo('reviewer');
            await wait(500);
            agents.pm.moveTo('pm');

            const reviewerHeartbeat2 = setInterval(() => {
                broadcastAll({ type: 'heartbeat', agent: 'reviewer', message: 'Still reviewing...' });
            }, 30000);
            review = await agents.reviewer.run(html);
            clearInterval(reviewerHeartbeat2);
            await wait(500);
        } else if (review.score < 8 && wouldBeOverBudget) {
            console.log(`[budget] Skipping revision: ${Math.round(elapsedSoFar/1000)}s elapsed already exceeds ${DEMO_BUDGET_MS/1000}s threshold`);
            agents.pm.say('Time-boxed — shipping current build.');
        }

        // 5. DEPLOYER PHASE
        agents.pm.moveTo('deployer');
        await wait(500);
        agents.pm.say(review.score >= 8
            ? 'Approved! Deployer, take it live!'
            : 'Shipping it — Deployer, deploy!');
        agents.pm.moveTo('pm');

        const result = await agents.deployer.run({ plan, html, review, buildId, brief });
        await wait(300);

        // Save state for conversational context
        factoryCurrentSite = { name: plan.projectName, siteName: result.siteName, url: result.siteUrl, buildId };
        factoryLastReview = review;
        factoryLastPlan = plan;
        factoryLastHtml = html;

        // 6. CELEBRATION
        const elapsed = buildStartedAt ? Math.round((Date.now() - buildStartedAt) / 1000) : null;
        broadcastAll({ type: 'build_complete', buildId, plan, review, siteName: result.siteName, siteUrl: result.siteUrl, elapsed });
        await wait(300);
        broadcastAll({ type: 'celebrate', elapsed });
        broadcastAll({ type: 'chat_message', agent: 'system',
            message: `Build complete! "${plan.projectName}" is live at <a href="${result.siteUrl}" target="_blank">${result.siteUrl}</a>`
        });

        await wait(4000);
        for (const id of ['pm', 'coder', 'reviewer', 'deployer']) {
            broadcastAll({ type: 'agent_status', agent: id, status: 'idle', message: '' });
        }

        console.log(`Factory build ${buildId} complete: ${plan.projectName} -> ${result.siteUrl}`);
    } catch (err) {
        console.error('Factory pipeline error:', err);
        broadcastAll({ type: 'error', message: 'Build failed: ' + err.message });
        for (const id of ['pm', 'coder', 'reviewer', 'deployer']) {
            broadcastAll({ type: 'agent_status', agent: id, status: 'idle', message: '' });
        }
        throw err;
    }
}

// ============================================
// DEMO VOTING + SIMULATED BUILD (PwC playhouse demo)
// Audience-vote workflow that drives a SIMULATED build sequence on the SSE
// stream. Does NOT call real agents or claude -p — pure broadcast theater
// timed to ~32 seconds. Used for the live demo where audience scans QR →
// votes → admin closes → simulated reject/revise/approve build → real
// pre-built demo URL displayed at the end.
// ============================================

const DEMO_OPTS_DEFAULT = () => ([
  { id: 1, label: 'AML Transaction Monitoring Console',
    description: 'SAR-ready alerts. FinCEN-aligned scoring. Live drill-down.',
    fullPrompt: 'Build a real-time anti-money-laundering transaction monitoring dashboard. Show: top KPIs (transactions today, high-risk flagged, SARs in review, avg response time); live transaction feed with risk scores 0-100; alert panel with rule names (Structuring, Smurfing, Layering, OFAC SDN match, PEP exposure, Velocity anomaly); inline-SVG risk distribution histogram; stylized geographic risk map. Filters by time/threshold/jurisdiction. Drill-down side panel per transaction with FinCEN-quoted recommended action. Light theme, deep blue accent. Mobile-perfect.',
    deployPath: '/demo-aml', deployHost: 'aml.georg.miami', votes: 0 },
  { id: 2, label: 'KYC / CIP Intake Pipeline',
    description: 'OFAC screening. Document verification. Audit trail.',
    fullPrompt: 'Build a client onboarding system with KYC/CIP flow. Show: 7-stage pipeline stepper (Identity Capture → Document Verification → OFAC Screen → Risk Tier → EDD → Final Review → Approved); active case detail card with document upload status (Verified/Pending/Failed); sanctions screening (OFAC SDN, EU consolidated, UN, PEP); risk tier assignment with rationale; audit log streaming. Queue panel with 8-12 in-progress cases. KYC/CIP/EDD/PEP/UBO terminology. Light theme, deep teal accent. Mobile-perfect.',
    deployPath: '/demo-kyc', deployHost: 'kyc.georg.miami', votes: 0 },
  { id: 3, label: 'Engagement Workstream Tracker',
    description: 'SOX-auditable assignments. Segregation of duties. Live status.',
    fullPrompt: 'Build a consulting/audit engagement tracker. Show: portfolio grid of 6-9 active engagements (SOX 404, M&A due diligence, IPO readiness) with health badges; selected-engagement detail with workstream tabs (Planning/Fieldwork/Testing/Reporting/Wrap-up); Kanban board (To Do / In Progress / In Review / Completed) with assignees, hours estimated/actual, blocking flags, SoD conflict flags; audit trail panel with timestamped events. SOX 404, ICFR, COSO, PCAOB AS terminology. Light theme, deep purple accent. Mobile-perfect.',
    deployPath: '/demo-tracker', deployHost: 'tracker.georg.miami', votes: 0 },
]);

let demoVotingState = {
  status: 'idle',
  options: DEMO_OPTS_DEFAULT(),
  startedAt: null,
  durationSec: 30,
  endsAt: null,
  winner: null,
};
let demoAutoCloseTimer = null;

function demoPickWinner() {
  let best = demoVotingState.options[0];
  for (const o of demoVotingState.options) if (o.votes > best.votes) best = o;
  if (best.votes === 0) return demoVotingState.options[0].id;
  const top = demoVotingState.options.filter(o => o.votes === best.votes);
  top.sort((a, b) => a.id - b.id);
  return top[0].id;
}

function demoOpenVoting() {
  demoVotingState.options = DEMO_OPTS_DEFAULT();
  demoVotingState.status = 'open';
  demoVotingState.startedAt = Date.now();
  demoVotingState.endsAt = Date.now() + demoVotingState.durationSec * 1000;
  demoVotingState.winner = null;
  if (demoAutoCloseTimer) clearTimeout(demoAutoCloseTimer);
  demoAutoCloseTimer = setTimeout(() => demoCloseVoting('auto'), demoVotingState.durationSec * 1000);
  console.log(`[demo-vote] opened — ${demoVotingState.durationSec}s window`);
  broadcastAll({ type: 'voting_state', votingState: demoVotingState });
}

function demoCloseVoting(reason = 'manual') {
  if (demoAutoCloseTimer) { clearTimeout(demoAutoCloseTimer); demoAutoCloseTimer = null; }
  demoVotingState.status = 'closed';
  demoVotingState.endsAt = Date.now();
  demoVotingState.winner = demoPickWinner();
  const w = demoVotingState.options.find(o => o.id === demoVotingState.winner);
  console.log(`[demo-vote] closed (${reason}) — winner: #${demoVotingState.winner} ${w ? w.label : ''}`);
  broadcastAll({ type: 'voting_state', votingState: demoVotingState });
}

function demoResetVoting() {
  if (demoAutoCloseTimer) { clearTimeout(demoAutoCloseTimer); demoAutoCloseTimer = null; }
  demoVotingState = {
    status: 'idle',
    options: DEMO_OPTS_DEFAULT(),
    startedAt: null,
    durationSec: 30,
    endsAt: null,
    winner: null,
  };
  console.log('[demo-vote] reset to idle');
  broadcastAll({ type: 'voting_state', votingState: demoVotingState });
}

const DEMO_REVISION_CONTENT = {
  1: {
    rejectFindings:    'Mobile responsiveness — pass. Accessibility — pass. Visual polish — pass.',
    rejectIssue:       'Score 6/10 — structuring rule would flag 12% of legitimate USD wires as suspicious.',
    rejectFeedback:    'Threshold $9,500 too aggressive — false-positive cascade on round-amount clusters.',
    coderRevise1:      'Reverting threshold. Re-tuning rule against 90-day baseline.',
    coderRevise2:      'Threshold adjusted to $9,950. Re-running checks.',
    reviewerApprove:   'Score 9/10 — structuring detection without false-positive cascade. Approved.',
    approveFeedback:   'Tuned rule passes baseline + edge-case set.',
  },
  2: {
    rejectFindings:    'Document validation — pass. Audit trail — pass. Mobile — pass.',
    rejectIssue:       'Score 6/10 — OFAC SDN check fires AFTER document upload.',
    rejectFeedback:    'Flagged customers retain a sensitive-data exposure window. SDN screen must run first.',
    coderRevise1:      'Reordering pipeline. Sanctions check pre-empts document handling.',
    coderRevise2:      'OFAC + EU + UN screen now block doc upload until cleared.',
    reviewerApprove:   'Score 9/10 — sanctions ordering correct. Approved.',
    approveFeedback:   'Pipeline order matches BSA/AML manual §3.2.',
  },
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

// Pacing: each agent_status 'working' triggers a ~2s walk in spectator UI.
// First chat_message fires ~3s after working (giving walk + 1s settle).
// Subsequent chats spaced ~4s apart so bubbles are readable.
// Total demo target: ~63s — enough room to narrate each beat.
const DEMO_BUILD_SEQUENCE = [
  { delay: 800,  ev: { type: 'build_started', buildId: 'demo', startedAt: Date.now() } },
  { delay: 600,  ev: { type: 'agent_status', agent: 'pm', status: 'working', message: 'Reading the brief' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'pm', message: 'Brief: __WINNER__. Plan for breadth, not depth.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'pm', message: 'Spec drafted — three sections, mobile-first, clean charts.' } },
  { delay: 3000, ev: { type: 'agent_status', agent: 'pm', status: 'done', message: 'Spec ready' } },
  { delay: 800,  ev: { type: 'agent_status', agent: 'coder', status: 'working', message: 'Writing the layout' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'coder', message: 'Building the hero — gradient, stat readout, hover states.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: 'Hero done. Moving to the data grid.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: 'Charts in. Animations smooth. No third-party libraries.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: 'Mobile breakpoints look great on a phone.' } },
  { delay: 2000, ev: { type: 'agent_status', agent: 'coder', status: 'done', message: 'Ready for review' } },
  { delay: 800,  ev: { type: 'agent_status', agent: 'reviewer', status: 'working', message: 'Reviewing' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'reviewer', message: '__REJECT_FINDINGS__' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'reviewer', message: '__REJECT_ISSUE__' } },
  { delay: 1500, ev: { type: 'review_result', score: 6, passed: false, feedback: '__REJECT_FEEDBACK__' } },
  { delay: 1500, ev: { type: 'agent_status', agent: 'reviewer', status: 'done', message: 'Sent back for revision' } },
  { delay: 800,  ev: { type: 'agent_status', agent: 'coder', status: 'working', message: 'Revising' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'coder', message: '__CODER_REVISE_1__' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'coder', message: '__CODER_REVISE_2__' } },
  { delay: 2500, ev: { type: 'agent_status', agent: 'coder', status: 'done', message: 'Revision complete' } },
  { delay: 800,  ev: { type: 'agent_status', agent: 'reviewer', status: 'working', message: 'Re-reviewing' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'reviewer', message: '__REVIEWER_APPROVE__' } },
  { delay: 1500, ev: { type: 'review_result', score: 9, passed: true, feedback: '__APPROVE_FEEDBACK__' } },
  { delay: 1500, ev: { type: 'agent_status', agent: 'reviewer', status: 'done', message: 'Approved' } },
  { delay: 800,  ev: { type: 'agent_status', agent: 'deployer', status: 'working', message: 'Shipping to production' } },
  { delay: 3000, ev: { type: 'chat_message', agent: 'deployer', message: 'Uploaded. Going live now.' } },
  { delay: 4000, ev: { type: 'chat_message', agent: 'deployer', message: 'Live at demo-site.georg.miami' } },
  { delay: 2500, ev: { type: 'agent_status', agent: 'deployer', status: 'done', message: 'Live' } },
  { delay: 500,  ev: { type: 'build_complete', buildId: 'demo', plan: { projectName: 'Demo Site' }, review: { score: 9 }, siteName: 'demo-site', siteUrl: 'https://demo-site.georg.miami', elapsed: 63 } },
  { delay: 300,  ev: { type: 'celebrate', elapsed: 63 } },
];

function demoApplyRevisionTokens(message, winnerId) {
  if (typeof message !== 'string') return message;
  const c = DEMO_REVISION_CONTENT[winnerId] || DEMO_REVISION_CONTENT[1];
  return message
    .replace('__REJECT_FINDINGS__', c.rejectFindings)
    .replace('__REJECT_ISSUE__',    c.rejectIssue)
    .replace('__REJECT_FEEDBACK__', c.rejectFeedback)
    .replace('__CODER_REVISE_1__',  c.coderRevise1)
    .replace('__CODER_REVISE_2__',  c.coderRevise2)
    .replace('__REVIEWER_APPROVE__',c.reviewerApprove)
    .replace('__APPROVE_FEEDBACK__',c.approveFeedback);
}

let demoWatcherRunning = false;
async function demoWatchForBuilds() {
  if (demoWatcherRunning) return;
  demoWatcherRunning = true;
  while (true) {
    while (demoVotingState.status !== 'closed') {
      await new Promise(r => setTimeout(r, 250));
    }
    const winner = demoVotingState.options.find(o => o.id === demoVotingState.winner);
    const brief        = winner ? winner.label      : 'Demo Site';
    const fullPrompt   = winner ? winner.fullPrompt : 'Build a single-page web app.';
    const deployHost   = winner ? winner.deployHost : 'demo-site.georg.miami';
    const winnerId     = demoVotingState.winner || 1;
    const siteUrl      = `https://${deployHost}`;
    console.log(`[demo-build] starting: ${brief} → ${siteUrl}`);

    for (const step of DEMO_BUILD_SEQUENCE) {
      await new Promise(r => setTimeout(r, step.delay));
      let ev = step.ev;
      if (ev.type === 'build_started') {
        ev = { ...ev, startedAt: Date.now(), brief, fullPrompt };
      } else if (ev.type === 'chat_message' && typeof ev.message === 'string') {
        let m = ev.message;
        if (m.includes('__WINNER__')) m = m.replace('__WINNER__', brief);
        m = demoApplyRevisionTokens(m, winnerId);
        if (m.includes('demo-site.georg.miami')) m = m.replace('demo-site.georg.miami', deployHost);
        ev = { ...ev, message: m };
      } else if (ev.type === 'review_result' && typeof ev.feedback === 'string') {
        ev = { ...ev, feedback: demoApplyRevisionTokens(ev.feedback, winnerId) };
      } else if (ev.type === 'build_complete') {
        ev = {
          ...ev,
          plan: { projectName: brief },
          siteName: deployHost.split('.')[0],
          siteUrl,
        };
      }
      broadcastAll(ev);
    }
    console.log('[demo-build] complete — staying idle until next vote');
    while (demoVotingState.status === 'closed') {
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

// Routes — admin + demo apps
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});
app.get('/demo-aml', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'demo-aml.html'));
});
app.get('/demo-kyc', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'demo-kyc.html'));
});
app.get('/demo-tracker', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'demo-tracker.html'));
});

// Voting endpoints
app.get('/factory/api/voting-state', (req, res) => {
  res.json(demoVotingState);
});
app.post('/factory/api/vote', express.json(), (req, res) => {
  const optionId = parseInt(req.body && req.body.option, 10);
  if (![1,2,3].includes(optionId)) return res.status(400).json({ ok: false, error: 'invalid_option' });
  if (demoVotingState.status !== 'open') return res.status(409).json({ ok: false, error: 'voting_not_open', tally: demoVotingState });
  const opt = demoVotingState.options.find(o => o.id === optionId);
  if (!opt) return res.status(400).json({ ok: false, error: 'unknown_option' });
  opt.votes += 1;
  console.log(`[demo-vote] +1 option ${optionId} → ${opt.votes}`);
  broadcastAll({ type: 'voting_state', votingState: demoVotingState });
  res.json({ ok: true, tally: demoVotingState });
});
app.post('/factory/api/voting/open', (req, res) => {
  demoOpenVoting();
  res.json(demoVotingState);
});
app.post('/factory/api/voting/close', (req, res) => {
  if (demoVotingState.status !== 'open') return res.status(409).json({ ok: false, error: 'voting_not_open', tally: demoVotingState });
  demoCloseVoting('manual');
  res.json(demoVotingState);
});
app.post('/factory/api/voting/reset', (req, res) => {
  demoResetVoting();
  res.json(demoVotingState);
});

// Kick off the demo build watcher
demoWatchForBuilds();

// ============================================
// START
// ============================================

app.listen(PORT, () => {
    console.log(`Agent Factory running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}`);
    console.log(`Spectator: http://localhost:${PORT}/live`);
    console.log(`Admin:     http://localhost:${PORT}/admin`);
    console.log(`Vote:      http://localhost:${PORT}/vote`);
});
