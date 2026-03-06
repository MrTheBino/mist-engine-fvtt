const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;


export class HowToPlayApp extends HandlebarsApplicationMixin(ApplicationV2) {
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'how-to-play-app',
        classes: ['mist-engine', 'dialog', 'how-to-play-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'How to Play',
            icon: 'fa-solid fa-book-atlas',
            positioned: true,
            resizable: true
        },
        position: {
            width: 950,
            height: 700
        },
        actions: {
        },
    };

    /** @override */
    static PARTS = {
        dialog: {
            template: 'systems/mist-engine-fvtt/templates/how-to-play-app/dialog.hbs',
            scrollable: ['']
        }
    };

    constructor(options = {}) {
        super(options);
        HowToPlayApp.instance = this;
    }
    async _prepareContext(options) {

        
        return context;
    }

    static getInstance(options = {}) {
        if (!HowToPlayApp.instance) {
            HowToPlayApp.instance = new HowToPlayApp(options);
        }
        return HowToPlayApp.instance;
    }
}