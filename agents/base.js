/**
 * BaseAgent — Foundation class for all Factory agents.
 *
 * Each agent is a self-contained module with its own system prompt,
 * Claude API integration, and real-time broadcast capabilities.
 *
 * Agents communicate via SSE events that the factory UI renders
 * as office animations, chat messages, and console logs.
 */

class BaseAgent {
    constructor({ anthropic, broadcast, trackUsage }) {
        this.anthropic = anthropic;
        this.broadcast = broadcast;
        this.trackUsage = trackUsage;
        this.model = 'claude-sonnet-4-5-20250929';
    }

    // ---- Override in subclass ----

    get id() { throw new Error('Override id'); }
    get name() { throw new Error('Override name'); }
    get color() { return '#666'; }
    get emoji() { return '🤖'; }
    get description() { return ''; }
    get capabilities() { return []; }
    get maxTokens() { return 1000; }
    get systemPrompt() { throw new Error('Override systemPrompt'); }

    async run(input) {
        throw new Error('Override run()');
    }

    // ---- Shared methods ----

    /**
     * Call Claude API with this agent's system prompt.
     * Logs the call to console, tracks usage, returns raw text.
     */
    async callClaude(input, { maxTokens, systemPrompt } = {}) {
        const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
        const tokens = maxTokens || this.maxTokens;

        this.log(`Calling Claude (${this.model}, max ${tokens} tokens, streaming)...`);

        const stream = await this.anthropic.messages.stream({
            model: this.model,
            max_tokens: tokens,
            system: systemPrompt || this.systemPrompt,
            messages: [{ role: 'user', content: inputStr }]
        });

        const response = await stream.finalMessage();

        await this.trackUsage(`factory_${this.id}`, response, null);

        const text = response.content[0].text;
        this.log(`Response: ${text.length.toLocaleString()} chars, ${response.usage.output_tokens} tokens (stop: ${response.stop_reason})`);

        if (response.stop_reason === 'max_tokens') {
            this.log(`⚠️ OUTPUT TRUNCATED — hit ${tokens} token limit!`);
        }

        return text;
    }

    /**
     * Parse JSON from Claude's response, stripping markdown fences.
     * Returns fallback on parse failure.
     */
    parseJSON(text, fallback = null) {
        const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch {
            this.log(`JSON parse failed, using fallback`);
            return fallback;
        }
    }

    /**
     * Strip markdown code fences from HTML output.
     */
    stripFences(text) {
        return text.replace(/^```html?\n?/, '').replace(/\n?```$/, '').trim();
    }

    // ---- Broadcast helpers ----

    /** Update agent status in the office UI (idle/working/done) */
    setStatus(status, message) {
        this.broadcast({ type: 'agent_status', agent: this.id, status, message });
    }

    /** Send a chat message visible in the Chat tab */
    say(message) {
        this.broadcast({ type: 'chat_message', agent: this.id, message });
    }

    /** Move agent sprite to a target location in the office */
    moveTo(target) {
        this.broadcast({ type: 'agent_move', agent: this.id, target });
    }

    /** Log a message to the Console tab (build log) */
    log(message) {
        this.broadcast({
            type: 'console_log',
            agent: this.id,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /** Pause for dramatic effect in the demo */
    wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // ---- Agent metadata (for Agent Info panel) ----

    getInfo() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            emoji: this.emoji,
            description: this.description,
            capabilities: this.capabilities,
            model: this.model,
            maxTokens: this.maxTokens,
            systemPrompt: this.systemPrompt,
        };
    }
}

module.exports = BaseAgent;
