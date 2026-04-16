/**
 * Coder Agent — Frontend Developer
 *
 * Takes a PM's project spec and generates a complete, production-ready
 * single-page HTML site matching Georg's design system. Generates
 * interactive pages with JavaScript animations, not just static HTML.
 */

const BaseAgent = require('./base');

class CoderAgent extends BaseAgent {
    get id() { return 'coder'; }
    get name() { return 'Coder'; }
    get color() { return '#10B981'; }
    get emoji() { return '💻'; }
    get maxTokens() { return 16000; }
    get description() {
        return 'Generates complete, production-ready web projects — apps, dashboards, tools, landing pages — as single-file HTML/CSS/JS.';
    }
    get capabilities() {
        return [
            'Single-file HTML/CSS/JS generation (any project type)',
            'Light SaaS theme design system (Inter, #FAFAFA, blue/purple accents)',
            'Responsive layouts with CSS Grid/Flexbox',
            'JavaScript animations and interactivity',
            'Functional features: forms, local storage, charts, filtering',
            'Code revision based on reviewer feedback',
        ];
    }

    get systemPrompt() {
        return `You are a senior frontend developer at Georg's AI Factory. You build complete web projects as single-file HTML applications — landing pages, dashboards, web apps, tools, calculators, games, interactive demos, anything.

DESIGN SYSTEM (mandatory):
- Clean, modern LIGHT theme: background #FAFAFA, surface #FFFFFF, cards #FFFFFF with subtle shadow, border #E5E7EB
- Fonts: Inter (headings, 600/700 weight), Inter (body, 400/500) — clean and professional
- Load from: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap
- Accent colors: Primary #2563EB (blue, CTAs), Secondary #7C3AED (purple, highlights), Success #059669 (green), Warm #F59E0B (amber, warnings)
- Text: #111827 headings, #374151 body, #6B7280 muted
- Subtle shadows (box-shadow: 0 1px 3px rgba(0,0,0,0.1)), rounded corners (8-12px), clean whitespace, professional look
- The generated sites should look like polished SaaS products or enterprise tools — the kind of thing a Fortune 500 exec would trust

CHARTS — THIS IS CRITICAL:
- NEVER use Chart.js or any external charting library. They break in single-file apps.
- Build ALL charts with pure CSS (flexbox bar charts, CSS grid) or inline SVG
- Bar charts: use div elements with percentage heights/widths and background colors
- Line charts: use SVG <polyline> or <path> elements with viewBox
- Pie/donut charts: use SVG <circle> with stroke-dasharray and stroke-dashoffset
- Sparklines: small inline SVG with <polyline>
- Use CSS transitions on hover for interactivity — no canvas, no requestAnimationFrame for charts
- Populate charts with realistic hardcoded data that tells a business story

JAVASCRIPT — adapt to project type:
- Landing pages: smooth scroll, mobile nav, counters
- Dashboards: CSS/SVG charts, data tables, filtering, metric cards, tab switching
- Web apps: form handling, local storage, state management, validation
- Tools/calculators: input processing, real-time output, copy-to-clipboard
- Keep animations minimal and professional — no flashy effects
Always include: mobile nav, smooth transitions, responsive behavior

STRUCTURE:
- Single index.html with all CSS in <style> and all JS in <script>
- NO external dependencies except Google Fonts. No Chart.js, no D3, no CDN libs.
- Proper <meta> tags, viewport, Open Graph
- Semantic HTML5
- Mobile-responsive (mobile-first)

QUALITY:
- Clean, well-structured code
- CSS custom properties for the design system
- Professional micro-interactions
- Accessible: alt tags, semantic elements, sufficient contrast
- IMPORTANT: Generate the COMPLETE file — never truncate. If the project is complex, prioritize working functionality over extra sections.

Given a project plan (JSON), generate a complete, production-ready index.html.
Return ONLY the raw HTML code. No markdown fences. No explanation.`;
    }

    async run(plan) {
        this.setStatus('working', 'Writing HTML...');
        this.say(`Building "${plan.projectName}" with ${plan.sections.length} sections...`);
        this.log(`Starting code generation for: ${plan.projectName}`);
        this.log(`Sections: ${plan.sections.map(s => s.name).join(', ')}`);
        this.log(`Interactive features: ${(plan.interactiveFeatures || []).join(', ')}`);

        const text = await this.callClaude(plan);
        const html = this.stripFences(text);

        this.setStatus('done', 'Code complete!');
        this.say(`Built "${plan.projectName}" — ${html.length.toLocaleString()} chars of HTML`);
        this.log(`Generated ${html.length.toLocaleString()} chars`);
        this.log(`Preview (first 30 lines):\n${html.split('\n').slice(0, 30).join('\n')}`);

        this.broadcast({ type: 'code_generated', preview: html.substring(0, 500) });

        return html;
    }

    /**
     * Revise HTML based on reviewer feedback.
     * Called when the Reviewer scores < 8.
     */
    async revise(originalHtml, feedback) {
        this.setStatus('working', 'Revising code...');
        this.say('Got feedback from Reviewer. Revising...');
        this.log(`Revision requested. Feedback:\n${feedback}`);

        const revisionPrompt = `You previously generated this HTML page. The code reviewer found issues that need fixing.

REVIEWER FEEDBACK:
${feedback}

ORIGINAL HTML:
${originalHtml}

Please generate the COMPLETE revised HTML incorporating all the feedback. Fix every issue mentioned.
Return ONLY the raw HTML code. No markdown fences. No explanation.`;

        const text = await this.callClaude(revisionPrompt, { maxTokens: 16000 });
        const html = this.stripFences(text);

        this.setStatus('done', 'Revision complete!');
        this.say(`Revised — ${html.length.toLocaleString()} chars`);
        this.log(`Revision complete: ${html.length.toLocaleString()} chars`);

        this.broadcast({ type: 'code_generated', preview: html.substring(0, 500) });

        return html;
    }
}

module.exports = CoderAgent;
