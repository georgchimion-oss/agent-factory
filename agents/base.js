/**
 * BaseAgent — Foundation class for all Factory agents.
 *
 * Each agent uses `claude -p` subprocess calls — $0 on Claude Max.
 * No Anthropic SDK, no API key, no per-token costs.
 *
 * Agents communicate via SSE events that the factory UI renders
 * as office animations, chat messages, and console logs.
 */

const { spawn } = require('child_process');

class BaseAgent {
    constructor({ broadcast, trackUsage }) {
        this.broadcast = broadcast;
        this.trackUsage = trackUsage || (async () => {});
        this.claudePath = process.env.CLAUDE_PATH || 'claude';
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
     * Call Claude via `claude -p` subprocess — $0 on Max subscription.
     * System prompt is prepended to the user message.
     */
    async callClaude(input, { systemPrompt } = {}) {
        const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
        const system = systemPrompt || this.systemPrompt;

        const fullPrompt = system
            ? `${system}\n\n---\n\n${inputStr}`
            : inputStr;

        this.log(`Calling Claude (claude -p, ${this.id})...`);

        const text = await this._runClaudeProcess(fullPrompt);

        this.log(`Response: ${text.length.toLocaleString()} chars`);
        await this.trackUsage(`factory_${this.id}`, { usage: { input_tokens: 0, output_tokens: 0 } }, null);

        return text;
    }

    /**
     * Spawn claude -p as a subprocess. Writes prompt to stdin, reads stdout.
     */
    _runClaudeProcess(prompt) {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.claudePath, [
                '-p', '-',
                '--output-format', 'text',
                '--max-turns', '1',
            ], {
                env: { ...process.env, TERM: 'dumb' },
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 300000, // 5 min per agent call
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (d) => { stdout += d.toString(); });
            proc.stderr.on('data', (d) => { stderr += d.toString(); });

            proc.on('close', (code) => {
                if (code !== 0 && !stdout) {
                    this.log(`Claude error (exit ${code}): ${stderr.slice(0, 300)}`);
                    reject(new Error(`claude -p failed (exit ${code}): ${stderr.slice(0, 200)}`));
                } else {
                    resolve(stdout.trim());
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to start claude: ${err.message}`));
            });

            // Write prompt to stdin and close
            proc.stdin.write(prompt);
            proc.stdin.end();
        });
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
            model: 'claude -p (Max, $0)',
            systemPrompt: this.systemPrompt,
        };
    }
}

module.exports = BaseAgent;
