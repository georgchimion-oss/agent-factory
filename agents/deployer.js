/**
 * Deployer Agent — Site Deployment
 *
 * Takes the final approved HTML and deploys it:
 * 1. Writes to disk at /var/www/sites/{name}/index.html (persists across restarts)
 * 2. Stores in memory Map for fast serving
 * 3. Site is live at {name}.georg.miami via nginx wildcard
 */

const BaseAgent = require('./base');
const fs = require('fs');
const path = require('path');

const SITES_DIR = '/var/www/sites';
const SITES_MANIFEST = path.join(SITES_DIR, 'sites.json');

class DeployerAgent extends BaseAgent {
    constructor(opts) {
        super(opts);
        this.factorySites = opts.factorySites;
        this.factoryBuilds = opts.factoryBuilds;
    }

    get id() { return 'deployer'; }
    get name() { return 'Deployer'; }
    get color() { return '#F0845C'; }
    get emoji() { return '🚀'; }
    get maxTokens() { return 500; }
    get description() {
        return 'Deploys generated pages to live subdomain URLs ({name}.georg.miami). Writes to disk for persistence and serves via nginx.';
    }
    get capabilities() {
        return [
            'Subdomain deployment ({name}.georg.miami)',
            'Persistent disk storage (survives restarts)',
            'In-memory caching for fast serving',
            'Build artifact management',
            'Public access (no auth required)',
        ];
    }

    get systemPrompt() { return ''; } // Deployer doesn't call Claude

    async run({ plan, html, review, buildId, brief }) {
        this.setStatus('working', 'Deploying...');
        this.say('Packaging site for deployment...');
        await this.wait(1000);

        // Generate a clean site name from the repo name
        const siteName = (plan.repoName || plan.projectName || 'site')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 30);

        this.log(`Site name: ${siteName}`);
        this.log(`HTML size: ${html.length.toLocaleString()} chars`);
        this.log(`Review score: ${review.score}/10`);

        // Write to disk for persistence
        const siteDir = path.join(SITES_DIR, siteName);
        try {
            fs.mkdirSync(siteDir, { recursive: true });
            fs.writeFileSync(path.join(siteDir, 'index.html'), html);
            this.log(`Written to disk: ${siteDir}/index.html`);
        } catch (err) {
            this.log(`Disk write failed (serving from memory): ${err.message}`);
        }

        // Store in memory for fast serving
        this.factorySites.set(siteName, html);
        await this.wait(500);

        // Subdomain URL (served by nginx wildcard)
        const siteUrl = `https://${siteName}.georg.miami`;
        // Fallback URL (served by Express, always works)
        const fallbackUrl = `https://api.georg.miami/factory/sites/${siteName}`;
        this.log(`Live URL: ${siteUrl}`);
        this.log(`Fallback: ${fallbackUrl}`);

        // Update sites manifest
        this.updateManifest(siteName, {
            name: plan.projectName,
            url: siteUrl,
            fallbackUrl,
            brief,
            score: review.score,
            createdAt: new Date().toISOString(),
        });

        // Store the full build record
        this.factoryBuilds.set(buildId, {
            id: buildId,
            brief,
            plan,
            html,
            review,
            siteName,
            siteUrl,
            fallbackUrl,
            createdAt: new Date().toISOString()
        });

        this.setStatus('done', 'Live!');
        this.say(`Site is live at ${siteUrl}`);

        this.broadcast({
            type: 'build_complete',
            buildId,
            plan,
            review,
            siteName,
            siteUrl,
            fallbackUrl
        });

        return { buildId, siteName, siteUrl, fallbackUrl };
    }

    /** Load existing sites from disk on startup */
    static loadFromDisk(factorySites) {
        try {
            if (!fs.existsSync(SITES_DIR)) return;
            const entries = fs.readdirSync(SITES_DIR, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const htmlPath = path.join(SITES_DIR, entry.name, 'index.html');
                if (fs.existsSync(htmlPath)) {
                    factorySites.set(entry.name, fs.readFileSync(htmlPath, 'utf-8'));
                }
            }
            if (factorySites.size > 0) {
                console.log(`📂 Loaded ${factorySites.size} factory site(s) from disk`);
            }
        } catch (err) {
            console.error('Failed to load factory sites from disk:', err.message);
        }
    }

    /** Update the sites.json manifest */
    updateManifest(siteName, data) {
        try {
            let manifest = {};
            if (fs.existsSync(SITES_MANIFEST)) {
                manifest = JSON.parse(fs.readFileSync(SITES_MANIFEST, 'utf-8'));
            }
            manifest[siteName] = data;
            fs.writeFileSync(SITES_MANIFEST, JSON.stringify(manifest, null, 2));
        } catch (err) {
            this.log(`Manifest update failed: ${err.message}`);
        }
    }
}

module.exports = DeployerAgent;
