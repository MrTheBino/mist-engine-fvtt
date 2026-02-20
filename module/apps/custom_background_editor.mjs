const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class CustomBackgroundEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: 'custom-background-editor-app',
        classes: ['mist-engine', 'dialog', 'custom-background-editor-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'Custom Background Editor',
            icon: 'fa-solid fa-image',
            positioned: true,
            resizable: true
        },
        position: {
            left: 100,
            width: 1200,
            height: 1000
        },
        actions: {
            clickedReset: this.#handleClickedReset,
            clickedSelectBackground: this.#pickBackground,
            clickedSetAsCustomBackground: this.#handleClickedSetAsCustomBackground,
            clickedUploadOverlay: this.#handleClickedUploadOverlay
        },
    };

    static PARTS = {

        editor: {
            template: 'systems/mist-engine-fvtt/templates/custom_background_editor/editor.hbs',
            scrollable: ['']
        },
    };

    canvas = null;
    ctx = null;
    bgImg = null;
    overlayImg = null;

    actor = null;

    // Drag state
    dragging = false;
    dragOffset = { x: 0, y: 0 };

    // System defaults
    static SYSTEM_ID = "mist-engine-fvtt";
    static DEFAULT_BG_DIR = `systems/${CustomBackgroundEditorApp.SYSTEM_ID}/assets/backgrounds`;
    static DEFAULT_BG_FILE = `${CustomBackgroundEditorApp.DEFAULT_BG_DIR}/default.png`;

    constructor(options = {}) {
        super(options);

        // Hintergrundpfad aus Settings (oder Default)
        this.backgroundSrc = '/systems/mist-engine-fvtt/assets/default_sheet_background.webp';
    }

    setActor(actor) {
        this.actor = actor;
    }

    async close(options) {
        window.removeEventListener("paste", this.#onPaste, true);

        if (this.canvas) {
            this.canvas.removeEventListener("pointerdown", this.#onPointerDown);
            this.canvas.removeEventListener("pointermove", this.#onPointerMove);
            this.canvas.removeEventListener("pointerup", this.#onPointerUp);
        }
        return super.close(options);
    }

    _onRender(context, options) {
        super._onRender(context, options);

        this.canvas = this.element.querySelector("[data-ref='canvas']");
        this.ctx = this.canvas?.getContext("2d", { alpha: true });

        window.addEventListener("paste", this.#onPaste.bind(this), true);

        // Click Actions
        this.element.addEventListener("click", (ev) => {
            const el = ev.target.closest("[data-action]");
            if (!el) return;

            switch (el.dataset.action) {
                case "export-png":
                    this.#exportPng();
                    break;
            }
        });

        // File input overlay
        this.element.addEventListener("change", (ev) => {
            const input = ev.target.closest("input[type='file'][data-action='clickedPickOverlay']");
            if (!input) return;
            const file = input.files?.[0];
            if (file) this.#loadOverlayFromFile(file);
            input.value = "";
        });

        this.canvas.addEventListener("pointerdown", this.#onPointerDown);
        this.canvas.addEventListener("pointermove", this.#onPointerMove);
        this.canvas.addEventListener("pointerup", this.#onPointerUp);
        this.canvas.addEventListener("wheel", this.#onWheel, { passive: false });


        // Load background initial
        this.loadBackground(this.backgroundSrc).then(() => this.draw());
    }

    canvasPoint(ev) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (ev.clientX - rect.left) * scaleX,
            y: (ev.clientY - rect.top) * scaleY,
        };
    }

    #hitTestOverlay(px, py) {
        const img = this.overlayImg;
        if (!img) return false;

        const w = img.width * this.#overlay.scale;
        const h = img.height * this.#overlay.scale;

        const left = this.#overlay.x - w * this.#overlay.anchor.x;
        const top = this.#overlay.y - h * this.#overlay.anchor.y;

        return px >= left && px <= left + w && py >= top && py <= top + h;
    }

    static async #pickBackground(event, target) {
        const startPath = CustomBackgroundEditorApp.DEFAULT_BG_DIR;

        const fp = new FilePicker({
            type: "image",
            current: this.backgroundSrc,
            startPath,
            callback: async (path) => {
                this.backgroundSrc = path;

                await this.loadBackground(path);
                this.draw();
            },
        });

        fp.browse(startPath);
    }

    async loadBackground(src) {
        this.bgImg = await this.#loadImage(src);
    }

    async #loadOverlayFromFile(file) {
        return this.#loadOverlayFromBlob(file);
    }

    static async #handleClickedReset(event, target) {
        this.overlayImg = null;
        this.draw();
    }

    #overlay = { x: 200, y: 200, scale: 1.0, anchor: { x: 0.5, y: 0.5 } };

    draw(line = true) {
        const ctx = this.ctx, canvas = this.canvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (this.bgImg) this.#drawCover(ctx, this.bgImg, 0, 0, canvas.width, canvas.height);

        if(line == true){
            const lineX = 300;
            ctx.save();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.moveTo(lineX, 0);
            ctx.lineTo(lineX, canvas.height);
            ctx.stroke();
            ctx.strokeStyle = "black";
            ctx.beginPath();
            ctx.moveTo(lineX + 1, 0);
            ctx.lineTo(lineX + 1, canvas.height);
            ctx.stroke();
            ctx.restore();
        }
        if (this.overlayImg) {
            const img = this.overlayImg;
            const w = img.width * this.#overlay.scale;
            const h = img.height * this.#overlay.scale;
            const dx = this.#overlay.x - w * this.#overlay.anchor.x;
            const dy = this.#overlay.y - h * this.#overlay.anchor.y;
            ctx.drawImage(img, dx, dy, w, h);
        }
    }

    #drawCover(ctx, img, x, y, w, h) {
        const iw = img.width, ih = img.height;
        const scale = Math.max(w / iw, h / ih);
        const sw = w / scale, sh = h / scale;
        const sx = (iw - sw) / 2, sy = (ih - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    }

    async #exportPng() {
        const canvas = this.canvas;
        if (!canvas) return;

        this.draw(false); // redraw without line for export
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement("a");
            a.href = url;
            a.download = "export.png";
            a.click();
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    #loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // --- Clipboard paste handler (als Feld, damit removeEventListener funktioniert)
    #onPaste(event) {
        console.log("Paste event triggered on window:", event);

        const cd = event.clipboardData;
        console.log("Paste event, clipboardData:", cd);
        if (!cd?.items?.length) return;

        // Suche nach erstem Bild im Clipboard
        const imgItem = Array.from(cd.items).find((it) => it.kind === "file" && it.type?.startsWith("image/"));
        if (!imgItem) return;

        const file = imgItem.getAsFile();
        if (!file) return;

        event.preventDefault(); // verhindert z.B. dass ein <input> Text bekommt
        this.#loadOverlayFromBlob(file);
    };

    async #loadOverlayFromBlob(blobOrFile) {
        const url = URL.createObjectURL(blobOrFile);
        try {
            this.overlayImg = await this.#loadImage(url);

            // Overlay zentrieren
            this.#overlay.x = this.canvas.width / 2;
            this.#overlay.y = this.canvas.height / 2;
            this.#overlay.scale = 1.0;

            this.draw();
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    #onPointerDown = (ev) => {
        if (!this.overlayImg) return;
        const { x, y } = this.canvasPoint(ev);

        if (this.#hitTestOverlay(x, y)) {
            this.dragging = true;
            this.canvas.classList.add("dragging");
            this.dragOffset.x = x - this.#overlay.x;
            this.dragOffset.y = y - this.#overlay.y;
            this.canvas.setPointerCapture(ev.pointerId);
        }
    };

    #onPointerMove = (ev) => {
        if (!this.dragging) return;
        const { x, y } = this.canvasPoint(ev);

        this.#overlay.x = x - this.dragOffset.x;
        this.#overlay.y = y - this.dragOffset.y;

        this.draw();
    };

    #onPointerUp = (ev) => {
        if (!this.dragging) return;
        this.dragging = false;
        this.canvas?.classList.remove("dragging");
        try { this.canvas?.releasePointerCapture(ev.pointerId); } catch { }
    };

    #onWheel = (ev) => {
        if (!this.overlayImg) return;
        ev.preventDefault();

        const delta = Math.sign(ev.deltaY);
        const factor = delta > 0 ? 0.95 : 1.05;

        // Optional: skalieren um Mausposition statt um Mittelpunkt
        this.#overlay.scale = Math.clamp(this.#overlay.scale * factor, 0.1, 10);

        this.draw();
    };

    static async #handleClickedSetAsCustomBackground(event, target) {
        if (!this.actor) {
            console.log("No actor set for CustomBackgroundEditorApp; cannot upload background.");
            return;
        }

        if (!game.user.can("FILES_UPLOAD")) {
            ui.notifications.error(game.i18n.localize("MIST_ENGINE.NOTIFICATIONS.NotAllowedToUploadFilesForCustomBackground"));
            return;
        }

        try {
            this.draw(false); // redraw without line for export
            const blob = await new Promise(r => this.canvas.toBlob(r, "image/png"));
            const file_path = await this.uploadToWorldAssets(blob, {
                subdir: `custom_backgrounds/generated/${this.actor.id}`,
                filename: `${this.actor.id}-${Date.now()}.png`
            });

            // check if file_path is valid and exists on the server
            if (!file_path) {
                ui.notifications.error("Failed to upload background image. No file path returned.");
                return;
            }

            // Update actor's custom background path
            await this.actor.update({
                "system.customBackground": file_path
            });
            ui.notifications.success("Custom background set successfully.");

            // close the app
            this.close();
        } catch (err) {
            console.error("Error exporting canvas to blob or uploading:", err);
            ui.notifications.error("Failed to set custom background. See console for details.");
            return;
        }
    }

    async uploadToWorldAssets(blobOrFile, {
        subdir = "custom_backgrounds/generated",
        filename = `export-${randomID()}.png`,
        notify = true
    } = {}) {
        // Permission gate
        if (!game.user?.can?.("FILES_UPLOAD")) {
            // show users without permissions a notification instead of failing silently
            ui.notifications.error("You do not have permission to upload files. Please contact your GM.");
            return null;
        }

        // World ID is the world datapath name (Setup -> Edit World -> Data Path). :contentReference[oaicite:2]{index=2}
        const worldId = game.world?.id ?? game.world?.name;
        if (!worldId) {
            ui.notifications.error("Could not determine world ID.");
            return null;
        }

        // Target directory inside User Data (source: "data")
        const dir = `worlds/${worldId}/assets/`.replaceAll("//", "/");

        console.log("Resolved upload directory:", dir);

        // Ensure we upload a File object
        const file = (blobOrFile instanceof File)
            ? blobOrFile
            : new File([blobOrFile], filename, { type: "image/png" });

        // Upload
        const resp = await foundry.applications.apps.FilePicker.implementation.upload("data", dir, file, {}, { notify });

        // Foundry returns the resulting path in resp.path (common), but keep a safe fallback.
        return resp?.path ?? `${dir}/${file.name}`;
    }

    static async #handleClickedUploadOverlay(event, target) {
        // Trigger click on hidden file input
        const input = this.element.querySelector("input[type='file'][data-action='clickedPickOverlay']");
        if (input) input.click();
    }
}
