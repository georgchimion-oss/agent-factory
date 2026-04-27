/**
 * PM Agent — Project Manager
 *
 * The user's primary point of contact. Maintains conversation memory,
 * decides what action to take (new build, modify existing site,
 * answer questions), and coordinates the other agents.
 */

const BaseAgent = require('./base');

class PMAgent extends BaseAgent {
    constructor(opts) {
        super(opts);
        this.conversationHistory = [];
    }

    get id() { return 'pm'; }
    get name() { return 'PM'; }
    get color() { return '#4A9EFF'; }
    get emoji() { return '📋'; }
    get maxTokens() { return 2000; }
    get description() {
        return 'Your point of contact. Analyzes briefs, creates specs, coordinates agents, and responds to feedback and questions conversationally.';
    }
    get capabilities() {
        return [
            'Natural conversation and context memory',
            'Brief analysis and requirement extraction',
            'Project planning with section breakdowns',
            'Content copywriting for each section',
            'Design direction and feature specification',
            'Agent coordination and task delegation',
            'Post-build modification handling',
        ];
    }

    get planPrompt() {
        return `You are the Project Manager at Georg's AI Factory — a multi-agent system that builds and deploys web projects.

You build ANYTHING: landing pages, dashboards, web apps, tools, calculators, portfolios, booking systems, interactive demos, games — not just landing pages.

Your job: Take a user's brief and produce a detailed project specification that the Coder agent can implement as a single-file HTML/CSS/JS application.

Return ONLY valid JSON (no markdown fences):
{
  "projectName": "Human-readable project name",
  "repoName": "lowercase-hyphen-name",
  "projectType": "landing-page | dashboard | web-app | tool | portfolio | booking | demo | other",
  "description": "What the project does in 1-2 sentences",
  "sections": [
    {
      "name": "Section or component name",
      "headline": "The main headline text",
      "subtext": "Supporting paragraph text",
      "features": ["feature or element 1", "feature 2"],
      "cta": "Call to action button text (if applicable)"
    }
  ],
  "designNotes": "Overall design direction — mood, style, special effects",
  "interactiveFeatures": ["scroll animations", "animated counters", "mobile hamburger menu", "smooth scroll navigation"],
  "functionalFeatures": ["form validation", "local storage", "filtering", "search", "charts", "real-time updates"]
}

Guidelines:
- Generate 4-8 sections/components appropriate to the project type
- For apps/tools: focus on functional components (inputs, outputs, state, calculations)
- For dashboards: include data visualization, metrics cards, charts, tables
- For landing pages: compelling copy, CTAs, social proof, testimonials
- For games/demos: describe mechanics, controls, scoring
- Include both interactive (visual) AND functional (logic) features
- Keep repoName lowercase with hyphens, max 30 chars
- Write content that sounds professional and specific to the brief`;
    }

    get systemPrompt() { return this.planPrompt; }

    get chatPrompt() {
        return `You are the Project Manager at Georg's AI Factory — a multi-agent system that builds and deploys web projects. Georg talks to you like a teammate.

You build ANYTHING — landing pages, dashboards, web apps, tools, calculators, portfolios, booking systems, games, interactive demos. Not just landing pages.

You have a team: Coder (builds HTML/CSS/JS), Reviewer (QA), and Deployer (ships to live URLs).

Your job: Read the user's message and decide what to do. Respond naturally — short, friendly, professional. You're a colleague, not a chatbot.

IMPORTANT: Return ONLY valid JSON (no markdown fences):
{
  "action": "build" | "modify" | "chat",
  "response": "Your natural language response to show in chat",
  "brief": "Only if action=build: the build brief extracted from the message",
  "instructions": "Only if action=modify: specific modification instructions for the Coder"
}

ACTION RULES:
- "build": User wants a NEW project built. Extract the brief from their message.
- "modify": User wants to CHANGE the current project. Write specific instructions the Coder can follow (e.g. "Add a dark mode toggle in the top-right corner", "Change the hero gradient to warm orange #F0845C").
- "chat": User is asking a question, giving feedback, saying hello, or anything that doesn't need a build/modify. Just respond conversationally.

RESPONSE STYLE:
- Be brief and direct. 1-2 sentences max.
- Sound like a real teammate, not an AI. Use casual professional tone.
- For builds: show excitement, mention what you're planning
- For modifications: acknowledge the feedback, say you're on it
- For chat: be helpful and friendly`;
    }

    /**
     * Chat — conversational entry point.
     * Decides whether to build, modify, or just respond.
     */
    async chat(message, context = {}) {
        this.setStatus('working', 'Thinking...');

        // Build the conversation context for Claude
        const contextLines = [];
        if (context.currentSite) {
            contextLines.push(`CURRENT SITE: "${context.currentSite.name}" deployed at ${context.currentSite.url}`);
        }
        if (context.lastReview) {
            contextLines.push(`LAST REVIEW: Score ${context.lastReview.score}/10 — ${context.lastReview.feedback}`);
        }

        const userContent = contextLines.length > 0
            ? `CONTEXT:\n${contextLines.join('\n')}\n\nUSER MESSAGE: ${message}`
            : `USER MESSAGE: ${message}`;

        // Add to conversation history
        this.conversationHistory.push({ role: 'user', content: userContent });

        // Keep only last 10 exchanges to avoid token bloat
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }

        this.log(`Processing message: "${message}"`);

        // Build conversation into a single prompt for claude -p
        const historyText = this.conversationHistory
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n\n');

        const text = await this.callClaude(historyText, { systemPrompt: this.chatPrompt });
        this.log(`Chat response: ${text}`);

        // Add assistant response to history
        this.conversationHistory.push({ role: 'assistant', content: text });

        const result = this.parseJSON(text, {
            action: 'chat',
            response: text.replace(/[{}"\n]/g, '').substring(0, 200),
        });

        this.setStatus('idle', '');
        this.say(result.response);

        return result;
    }

    /**
     * Run — full build pipeline planning (called by orchestrator).
     */
    async run(brief) {
        this.setStatus('working', 'Analyzing brief...');
        this.say(`On it! Planning the build...`);
        await this.wait(800);

        this.moveTo('whiteboard');
        this.log(`Brief received: "${brief}"`);
        await this.wait(1500);

        const text = await this.callClaude(brief, { systemPrompt: this.planPrompt });

        const plan = this.parseJSON(text, {
            projectName: brief.substring(0, 50),
            repoName: brief.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30),
            description: brief,
            sections: [
                { name: 'Hero', headline: brief, subtext: 'Welcome', features: [], cta: 'Get Started' },
                { name: 'Features', headline: 'Features', subtext: 'What we offer', features: [] },
                { name: 'Contact', headline: 'Get in Touch', subtext: 'Reach out', features: [], cta: 'Contact Us' }
            ],
            designNotes: 'Dark theme, professional, modern',
            interactiveFeatures: ['scroll animations', 'smooth scroll']
        });

        this.setStatus('done', 'Plan ready!');
        this.say(`Project: "${plan.projectName}" — ${plan.sections.length} sections: ${plan.sections.map(s => s.name).join(', ')}`);
        this.log(`Plan created:\n${JSON.stringify(plan, null, 2)}`);

        this.broadcast({ type: 'task_created', plan });

        return plan;
    }

    /** Reset conversation for a new session */
    resetConversation() {
        this.conversationHistory = [];
    }
}

module.exports = PMAgent;
