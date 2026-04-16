/**
 * Reviewer Agent — Senior Code Reviewer
 *
 * Reviews generated HTML for design system compliance, code quality,
 * accessibility, and interactivity. Provides actionable feedback that
 * the Coder can use for revision when the score is below threshold.
 */

const BaseAgent = require('./base');

class ReviewerAgent extends BaseAgent {
    get id() { return 'reviewer'; }
    get name() { return 'Reviewer'; }
    get color() { return '#8B5CF6'; }
    get emoji() { return '🔍'; }
    get maxTokens() { return 1500; }
    get description() {
        return 'Reviews generated code for quality, design system compliance, accessibility, and interactivity. Provides actionable feedback for revision.';
    }
    get capabilities() {
        return [
            'Design system compliance checking',
            'Mobile responsiveness verification',
            'Accessibility audit (semantic HTML, contrast, alt tags)',
            'JavaScript functionality review',
            'Code quality assessment',
            'Actionable revision instructions',
        ];
    }

    get systemPrompt() {
        return `You are a senior code reviewer at Georg's AI Factory. Review HTML pages for quality and compliance.

CHECK LIST:
1. Design system: Dark theme #08080A, Space Grotesk headings, DM Sans body, correct accent colors
2. Responsiveness: Mobile-first, media queries, flexible layouts
3. Accessibility: Semantic HTML, alt tags, proper heading hierarchy, sufficient contrast
4. JavaScript: Scroll animations present, smooth scroll working, mobile nav, counters (if applicable)
5. Code quality: Clean structure, CSS custom properties, no redundant code
6. Visual polish: Hover effects, transitions, glass-morphism cards, gradient accents

Return ONLY valid JSON (no markdown fences):
{
  "passed": true,
  "score": 8,
  "feedback": "Brief overall assessment",
  "checklist": {
    "designSystem": { "pass": true, "note": "Correct fonts and colors" },
    "responsive": { "pass": true, "note": "Good mobile layout" },
    "accessibility": { "pass": true, "note": "Semantic HTML used" },
    "javascript": { "pass": false, "note": "Missing scroll animations" },
    "codeQuality": { "pass": true, "note": "Clean structure" },
    "visualPolish": { "pass": true, "note": "Smooth transitions" }
  },
  "issues": ["Specific issue 1", "Specific issue 2"],
  "revisionInstructions": "Only include this field if score < 8. Detailed instructions for the Coder to fix the issues. Be specific: which sections, what CSS/JS to add or change."
}

SCORING:
- 9-10: Excellent, production-ready
- 7-8: Good, minor issues
- 5-6: Needs work, specific fixes required
- Below 5: Major issues

If score >= 8, do NOT include revisionInstructions (the code is good enough to ship).
If score < 8, MUST include revisionInstructions with specific, actionable fixes.`;
    }

    async run(html) {
        this.setStatus('working', 'Reviewing code...');
        this.say('Reviewing code quality, design system, accessibility...');
        this.log(`Reviewing ${html.length.toLocaleString()} chars of HTML`);

        const text = await this.callClaude(html);

        const review = this.parseJSON(text, {
            passed: true,
            score: 7,
            feedback: 'Looks good overall.',
            checklist: {},
            issues: []
        });

        const passed = review.score >= 8;
        this.setStatus('done', passed ? 'Approved!' : 'Needs revision');
        this.say(`Score: ${review.score}/10 — ${review.feedback}`);

        // Log detailed checklist to console
        this.log(`Score: ${review.score}/10`);
        if (review.checklist) {
            for (const [key, val] of Object.entries(review.checklist)) {
                this.log(`  ${val.pass ? '✅' : '❌'} ${key}: ${val.note}`);
            }
        }
        if (review.issues && review.issues.length > 0) {
            this.log(`Issues found:\n${review.issues.map(i => `  • ${i}`).join('\n')}`);
        }
        if (review.revisionInstructions) {
            this.log(`Revision instructions:\n${review.revisionInstructions}`);
        }

        this.broadcast({
            type: 'review_result',
            passed,
            score: review.score,
            feedback: review.feedback,
            checklist: review.checklist
        });

        return review;
    }
}

module.exports = ReviewerAgent;
