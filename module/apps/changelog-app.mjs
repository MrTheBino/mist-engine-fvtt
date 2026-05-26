const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class ChangelogApp extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'changelog-app',
        classes: ['mist-engine', 'dialog', 'changelog-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'Changelog',
            icon: 'fa-solid fa-clock-rotate-left',
            positioned: true,
            resizable: true
        },
        position: {
            width: 680,
            height: 620
        },
        actions: {
            closeDialog: function () { this.close(); }
        },
    };

    /** @override */
    static PARTS = {
        changelog: {
            template: 'systems/mist-engine-fvtt/templates/changelog-app/changelog.hbs',
            scrollable: []
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        try {
            const response = await fetch('systems/mist-engine-fvtt/CHANGELOG.md');
            const markdown = await response.text();
            context.changelogHtml = ChangelogApp.#parseChangelog(markdown);
        } catch (e) {
            context.changelogHtml = '<p>Could not load changelog.</p>';
        }
        context.version = game.system.version;
        return context;
    }

    static #parseChangelog(markdown) {
        const lines = markdown.split('\n');
        let html = '';
        let inList = false;
        let firstH1 = true;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                if (inList) { html += '</ul>'; inList = false; }
                continue;
            }
            if (trimmed.startsWith('# ')) {
                if (inList) { html += '</ul>'; inList = false; }
                if (firstH1) { firstH1 = false; continue; }
                html += `<h2 class="version-header">${trimmed.slice(2)}</h2>`;
            } else if (trimmed.startsWith('- ')) {
                if (!inList) { html += '<ul>'; inList = true; }
                html += `<li>${trimmed.slice(2)}</li>`;
            } else {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<p class="changelog-note">${trimmed}</p>`;
            }
        }
        if (inList) html += '</ul>';
        return html;
    }

    async close(options = {}) {
        const checkbox = this.element?.querySelector('.changelog-dont-show');
        if (checkbox?.checked) {
            await game.settings.set('mist-engine-fvtt', 'systemVersion', game.system.version);
        }
        return super.close(options);
    }

    static async checkAndShow() {
        if (!game.user.isGM) return;
        const saved = game.settings.get('mist-engine-fvtt', 'systemVersion');
        if (game.system.version !== saved) {
            new ChangelogApp().render(true);
        }
    }
}
