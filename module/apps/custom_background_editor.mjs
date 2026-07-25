const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Canvas editor that composes a character-sheet background out of a base
 * background image plus any number of draggable artwork overlays.
 *
 * - Overlays come from upload, clipboard paste (Ctrl+V), drag & drop or a
 *   restored editor state. Click selects, drag moves, mouse wheel zooms at
 *   the cursor, arrow keys nudge (Shift = 10px), Del removes.
 * - "Set as Custom Background" flattens the canvas to
 *   `worlds/<world>/assets/custom-backgrounds/<actorId>.png` (stable name —
 *   overwrites instead of piling up orphan files) and stores the editor
 *   state in an actor flag so the composition can be re-edited later.
 * - All DOM/window listeners are bound through one AbortController per
 *   render, so re-renders and close() can never leak or double-bind.
 */
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
            clickedUploadOverlay: this.#handleClickedUploadOverlay,
            clickedToggleGuide: this.#handleClickedToggleGuide,
            clickedFlipOverlay: this.#handleClickedFlipOverlay,
            clickedCenterOverlay: this.#handleClickedCenterOverlay,
            clickedDeleteOverlay: this.#handleClickedDeleteOverlay,
            clickedExportPng: this.#handleClickedExportPng
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
    actor = null;

    /**
     * Artwork layers, drawn in array order (last = topmost).
     * @type {Array<{img: HTMLImageElement, src: string|null, blob: Blob|null, x: number, y: number, scale: number, flipped: boolean}>}
     */
    overlays = [];
    selectedIndex = -1;
    showGuide = true;

    // Drag state
    dragging = false;
    dragOffset = { x: 0, y: 0 };

    // System defaults / persistence
    static SYSTEM_ID = "mist-engine-fvtt";
    static FLAG_KEY = "customBackgroundEditorState";
    static DEFAULT_BG_DIR = `systems/${CustomBackgroundEditorApp.SYSTEM_ID}/assets/backgrounds`;
    /** Width of the character sheet's name/portrait column in canvas pixels. */
    static GUIDE_X = 300;

    #listenerAC = null;     // one AbortController per render — aborts every listener
    #stateRestored = false; // restore the saved composition only once per open
    #fontColorDirty = false;

    constructor(options = {}) {
        super(options);
        this.backgroundSrc = 'systems/mist-engine-fvtt/assets/default_sheet_background.webp';
    }

    setActor(actor) {
        this.actor = actor;
        this.#stateRestored = false;
    }

    get selectedOverlay() {
        return this.overlays[this.selectedIndex] ?? null;
    }

    #loc(key) {
        return game.i18n.localize(`MIST_ENGINE.LABELS.CustomBackgroundEditor.${key}`);
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const color = this.actor?.system.customFontColor;
        context.fontColor = /^#[0-9a-fA-F]{6}$/.test(color ?? "") ? color : "#ffffff";
        context.isCharacter = this.actor?.type === "litm-character";
        return context;
    }

    async close(options) {
        this.#listenerAC?.abort();
        this.#listenerAC = null;
        return super.close(options);
    }

    _onRender(context, options) {
        super._onRender(context, options);

        this.canvas = this.element.querySelector("[data-ref='canvas']");
        this.ctx = this.canvas?.getContext("2d", { alpha: true });

        // One controller per render: aborting it detaches every listener below,
        // so a re-render never double-binds and close() can never leak.
        this.#listenerAC?.abort();
        this.#listenerAC = new AbortController();
        const signal = this.#listenerAC.signal;

        window.addEventListener("paste", this.#onPaste, { capture: true, signal });
        window.addEventListener("keydown", this.#onKeyDown, { signal });

        // File input for overlay uploads
        this.element.addEventListener("change", (ev) => {
            const input = ev.target.closest("input[type='file'][data-action='clickedPickOverlay']");
            if (input) {
                const file = input.files?.[0];
                if (file) this.#addOverlayFromBlob(file);
                input.value = "";
                return;
            }
            const color = ev.target.closest("input[data-ref='font-color']");
            if (color) {
                this.#fontColorDirty = true;
                this.draw();
            }
        }, { signal });
        // live preview while dragging inside the colour picker
        this.element.addEventListener("input", (ev) => {
            if (ev.target.closest("input[data-ref='font-color']")) { this.#fontColorDirty = true; this.draw(); }
            if (ev.target.closest("input[data-ref='scale-slider']")) this.#onScaleSlider(ev.target.value);
        }, { signal });

        this.canvas.addEventListener("pointerdown", this.#onPointerDown, { signal });
        this.canvas.addEventListener("pointermove", this.#onPointerMove, { signal });
        this.canvas.addEventListener("pointerup", this.#onPointerUp, { signal });
        this.canvas.addEventListener("wheel", this.#onWheel, { passive: false, signal });

        // Drag & drop an image file straight onto the canvas
        this.canvas.addEventListener("dragover", (ev) => { ev.preventDefault(); }, { signal });
        this.canvas.addEventListener("drop", (ev) => {
            ev.preventDefault();
            const file = [...(ev.dataTransfer?.files ?? [])].find(f => f.type?.startsWith("image/"));
            if (file) this.#addOverlayFromBlob(file, this.canvasPoint(ev));
        }, { signal });

        this.#populateGallery();

        // Load background, then restore a previously saved composition (once)
        this.loadBackground(this.backgroundSrc)
            .then(() => this.#restoreState())
            .then(() => this.draw());
    }

    /* ------------------------------------------------------------------ */
    /*  Background gallery                                                 */
    /* ------------------------------------------------------------------ */

    /** Fill the thumbnail strip from assets/backgrounds; hide it when empty. */
    async #populateGallery() {
        const strip = this.element.querySelector("[data-ref='gallery']");
        if (!strip) return;
        let files = [];
        // systems are served from the "data" source; older setups may expose
        // them as "public" — try both before giving up
        for (const source of ["data", "public"]) {
            try {
                const res = await foundry.applications.apps.FilePicker.implementation.browse(
                    source, CustomBackgroundEditorApp.DEFAULT_BG_DIR);
                files = (res?.files ?? []).filter(f => /\.(webp|png|jpe?g)$/i.test(f));
                if (files.length) break;
            } catch (e) { /* try next source */ }
        }
        if (files.length === 0) { strip.style.display = "none"; return; }

        strip.replaceChildren();
        for (const f of files) {
            const img = document.createElement("img");
            img.src = f;
            img.title = f.split("/").pop();
            img.classList.add("bg-thumb");
            if (f === this.backgroundSrc) img.classList.add("active");
            img.addEventListener("click", async () => {
                this.backgroundSrc = f;
                strip.querySelectorAll(".bg-thumb").forEach(t => t.classList.toggle("active", t === img));
                await this.loadBackground(f);
                this.draw();
            }, { signal: this.#listenerAC.signal });
            strip.appendChild(img);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  State persistence (re-editable compositions)                       */
    /* ------------------------------------------------------------------ */

    /** Restore the actor's saved composition so it can be edited further. */
    async #restoreState() {
        if (this.#stateRestored || !this.actor) return;
        this.#stateRestored = true;
        const state = this.actor.getFlag(CustomBackgroundEditorApp.SYSTEM_ID, CustomBackgroundEditorApp.FLAG_KEY);
        if (!state) return;

        if (state.backgroundSrc) {
            try {
                await this.loadBackground(state.backgroundSrc);
                this.backgroundSrc = state.backgroundSrc;
            } catch (e) { /* keep default */ }
        }
        for (const o of (state.overlays ?? [])) {
            if (!o?.src) continue;
            try {
                const img = await this.#loadImage(o.src);
                this.overlays.push({
                    img, src: o.src, blob: null,
                    x: o.x ?? this.canvas.width / 2,
                    y: o.y ?? this.canvas.height / 2,
                    scale: o.scale ?? 1.0,
                    flipped: !!o.flipped
                });
            } catch (e) { /* stored overlay no longer exists — skip */ }
        }
        if (this.overlays.length) this.selectedIndex = this.overlays.length - 1;
        this.#syncScaleSlider();
    }

    #stateForFlag() {
        return {
            backgroundSrc: this.backgroundSrc,
            overlays: this.overlays
                .filter(o => o.src)   // only persistable sources
                .map(o => ({ src: o.src, x: o.x, y: o.y, scale: o.scale, flipped: o.flipped })),
        };
    }

    /* ------------------------------------------------------------------ */
    /*  Canvas drawing                                                     */
    /* ------------------------------------------------------------------ */

    canvasPoint(ev) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (ev.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (ev.clientY - rect.top) * (this.canvas.height / rect.height),
        };
    }

    #overlayBounds(o) {
        const w = o.img.width * o.scale;
        const h = o.img.height * o.scale;
        return { left: o.x - w / 2, top: o.y - h / 2, w, h };
    }

    #hitTest(px, py) {
        // topmost first
        for (let i = this.overlays.length - 1; i >= 0; i--) {
            const { left, top, w, h } = this.#overlayBounds(this.overlays[i]);
            if (px >= left && px <= left + w && py >= top && py <= top + h) return i;
        }
        return -1;
    }

    draw({ forExport = false } = {}) {
        const ctx = this.ctx, canvas = this.canvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (this.bgImg) this.#drawCover(ctx, this.bgImg, 0, 0, canvas.width, canvas.height);

        for (const o of this.overlays) {
            const { left, top, w, h } = this.#overlayBounds(o);
            if (o.flipped) {
                ctx.save();
                ctx.translate(left + w, top);
                ctx.scale(-1, 1);
                ctx.drawImage(o.img, 0, 0, w, h);
                ctx.restore();
            } else {
                ctx.drawImage(o.img, left, top, w, h);
            }
        }

        if (forExport) return;

        // --- editor-only decorations (never exported) ---
        // 1) layout guide: the sheet's name/portrait column
        if (this.showGuide && this.actor?.type === "litm-character") {
            const gx = CustomBackgroundEditorApp.GUIDE_X;
            ctx.save();
            ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
            ctx.fillRect(0, 0, gx, canvas.height);
            ctx.setLineDash([8, 6]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(255, 80, 80, 0.9)";
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(this.#loc("GuideLabel"), gx / 2, 28);
            ctx.restore();

            // 2) name preview in the picked font colour
            const color = this.element.querySelector("input[data-ref='font-color']")?.value ?? "#ffffff";
            ctx.save();
            ctx.fillStyle = color;
            ctx.font = "bold 44px Labrada, serif";
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(0,0,0,0.6)";
            ctx.shadowBlur = 6;
            ctx.fillText(this.actor.name, gx / 2, canvas.height * 0.62, gx - 20);
            ctx.restore();
        }

        // 3) selection outline
        const sel = this.selectedOverlay;
        if (sel) {
            const { left, top, w, h } = this.#overlayBounds(sel);
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(120, 200, 255, 0.9)";
            ctx.strokeRect(left, top, w, h);
            ctx.restore();
        }
    }

    #drawCover(ctx, img, x, y, w, h) {
        const iw = img.width, ih = img.height;
        const scale = Math.max(w / iw, h / ih);
        const sw = w / scale, sh = h / scale;
        const sx = (iw - sw) / 2, sy = (ih - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    }

    /* ------------------------------------------------------------------ */
    /*  Image loading                                                      */
    /* ------------------------------------------------------------------ */

    async loadBackground(src) {
        this.bgImg = await this.#loadImage(src);
    }

    #loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Could not load image: ${src}`));
            img.src = src;
        });
    }

    /**
     * Add an artwork overlay. `blobOrFile` sources are kept so they can be
     * uploaded on save (making the composition re-editable); `srcPath` is set
     * for images that already live on the server.
     */
    async #addOverlayFromBlob(blobOrFile, at = null) {
        const url = URL.createObjectURL(blobOrFile);
        try {
            const img = await this.#loadImage(url);
            this.overlays.push({
                img, src: null, blob: blobOrFile,
                x: at?.x ?? this.canvas.width / 2,
                y: at?.y ?? this.canvas.height / 2,
                scale: 1.0, flipped: false
            });
            this.selectedIndex = this.overlays.length - 1;
            this.#syncScaleSlider();
            this.draw();
        } catch (err) {
            ui.notifications.error(this.#loc("LoadImageFailed"));
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    /** Add an overlay from a server path (gallery/tests/restored state). */
    async addOverlayFromPath(src, at = null) {
        try {
            const img = await this.#loadImage(src);
            this.overlays.push({
                img, src, blob: null,
                x: at?.x ?? this.canvas.width / 2,
                y: at?.y ?? this.canvas.height / 2,
                scale: 1.0, flipped: false
            });
            this.selectedIndex = this.overlays.length - 1;
            this.#syncScaleSlider();
            this.draw();
        } catch (err) {
            ui.notifications.error(this.#loc("LoadImageFailed"));
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Input handlers (stable arrow-field identities)                     */
    /* ------------------------------------------------------------------ */

    #onPaste = (event) => {
        const cd = event.clipboardData;
        if (!cd?.items?.length) return;
        const imgItem = Array.from(cd.items).find((it) => it.kind === "file" && it.type?.startsWith("image/"));
        if (!imgItem) return;
        const file = imgItem.getAsFile();
        if (!file) return;
        event.preventDefault();
        this.#addOverlayFromBlob(file);
    };

    #onKeyDown = (event) => {
        if (!this.rendered) return;
        const t = event.target;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable) return;
        const sel = this.selectedOverlay;
        if (!sel) return;

        const step = event.shiftKey ? 10 : 1;
        let handled = true;
        switch (event.key) {
            case "ArrowLeft": sel.x -= step; break;
            case "ArrowRight": sel.x += step; break;
            case "ArrowUp": sel.y -= step; break;
            case "ArrowDown": sel.y += step; break;
            case "Delete":
            case "Backspace":
                this.overlays.splice(this.selectedIndex, 1);
                this.selectedIndex = this.overlays.length - 1;
                this.#syncScaleSlider();
                break;
            default: handled = false;
        }
        if (handled) { event.preventDefault(); this.draw(); }
    };

    #onPointerDown = (ev) => {
        const { x, y } = this.canvasPoint(ev);
        const hit = this.#hitTest(x, y);
        this.selectedIndex = hit;
        this.#syncScaleSlider();
        if (hit >= 0) {
            const o = this.overlays[hit];
            this.dragging = true;
            this.canvas.classList.add("dragging");
            this.dragOffset.x = x - o.x;
            this.dragOffset.y = y - o.y;
            this.canvas.setPointerCapture(ev.pointerId);
        }
        this.draw();
    };

    #onPointerMove = (ev) => {
        if (!this.dragging) return;
        const o = this.selectedOverlay;
        if (!o) return;
        const { x, y } = this.canvasPoint(ev);
        o.x = x - this.dragOffset.x;
        o.y = y - this.dragOffset.y;
        this.draw();
    };

    #onPointerUp = (ev) => {
        if (!this.dragging) return;
        this.dragging = false;
        this.canvas?.classList.remove("dragging");
        try { this.canvas?.releasePointerCapture(ev.pointerId); } catch { }
    };

    /** Zoom at the cursor: the canvas point under the mouse stays put. */
    #onWheel = (ev) => {
        const o = this.selectedOverlay ?? this.overlays[this.overlays.length - 1] ?? null;
        if (!o) return;
        ev.preventDefault();

        const p = this.canvasPoint(ev);
        const factor = Math.sign(ev.deltaY) > 0 ? 0.95 : 1.05;
        const ns = Math.clamp(o.scale * factor, 0.05, 10);
        o.x = p.x + (o.x - p.x) * (ns / o.scale);
        o.y = p.y + (o.y - p.y) * (ns / o.scale);
        o.scale = ns;
        this.#syncScaleSlider();
        this.draw();
    };

    #onScaleSlider(value) {
        const o = this.selectedOverlay;
        if (!o) return;
        o.scale = Math.clamp(parseInt(value) / 100, 0.05, 10);
        this.draw();
    }

    #syncScaleSlider() {
        const slider = this.element?.querySelector("input[data-ref='scale-slider']");
        if (slider) slider.value = Math.round((this.selectedOverlay?.scale ?? 1) * 100);
    }

    /* ------------------------------------------------------------------ */
    /*  Toolbar actions                                                    */
    /* ------------------------------------------------------------------ */

    static async #pickBackground(event, target) {
        const startPath = CustomBackgroundEditorApp.DEFAULT_BG_DIR;
        const fp = new foundry.applications.apps.FilePicker.implementation({
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

    static async #handleClickedReset(event, target) {
        this.overlays = [];
        this.selectedIndex = -1;
        this.backgroundSrc = 'systems/mist-engine-fvtt/assets/default_sheet_background.webp';
        await this.loadBackground(this.backgroundSrc);
        this.#syncScaleSlider();
        this.draw();
    }

    static async #handleClickedToggleGuide(event, target) {
        this.showGuide = !this.showGuide;
        target.classList.toggle("active", this.showGuide);
        this.draw();
    }

    static async #handleClickedFlipOverlay(event, target) {
        const o = this.selectedOverlay;
        if (!o) return;
        o.flipped = !o.flipped;
        this.draw();
    }

    static async #handleClickedCenterOverlay(event, target) {
        const o = this.selectedOverlay;
        if (!o) return;
        o.x = this.canvas.width / 2;
        o.y = this.canvas.height / 2;
        this.draw();
    }

    static async #handleClickedDeleteOverlay(event, target) {
        if (this.selectedIndex < 0) return;
        this.overlays.splice(this.selectedIndex, 1);
        this.selectedIndex = this.overlays.length - 1;
        this.#syncScaleSlider();
        this.draw();
    }

    static async #handleClickedUploadOverlay(event, target) {
        const input = this.element.querySelector("input[type='file'][data-action='clickedPickOverlay']");
        if (input) input.click();
    }

    static async #handleClickedExportPng(event, target) {
        const canvas = this.canvas;
        if (!canvas) return;
        this.draw({ forExport: true });
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        this.draw();
        if (!blob) return;

        const slug = (this.actor?.name ?? "background").slugify?.() ?? "background";
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement("a");
            a.href = url;
            a.download = `${slug}-background.png`;
            a.click();
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Save as custom background                                          */
    /* ------------------------------------------------------------------ */

    static async #handleClickedSetAsCustomBackground(event, target) {
        if (!this.actor) return;
        if (!game.user.can("FILES_UPLOAD")) {
            ui.notifications.error(game.i18n.localize("MIST_ENGINE.NOTIFICATIONS.NotAllowedToUploadFilesForCustomBackground"));
            return;
        }

        try {
            // 1) flatten the canvas (without editor decorations)
            this.draw({ forExport: true });
            const blob = await new Promise(r => this.canvas.toBlob(r, "image/png"));
            this.draw();

            // 2) stable filename per actor — overwrites instead of orphaning
            const bgPath = await this.uploadToWorldAssets(blob, { filename: `${this.actor.id}.png` });
            if (!bgPath) return; // uploadToWorldAssets already notified

            // 3) upload blob-based overlay sources once, so the composition
            //    can be restored and edited again later
            for (let i = 0; i < this.overlays.length; i++) {
                const o = this.overlays[i];
                if (o.src || !o.blob) continue;
                o.src = await this.uploadToWorldAssets(o.blob, { filename: `${this.actor.id}-overlay-${i}.png` });
            }

            // 4) persist state + actor updates (cache-buster forces the sheet
            //    to pick up the overwritten file)
            await this.actor.setFlag(CustomBackgroundEditorApp.SYSTEM_ID, CustomBackgroundEditorApp.FLAG_KEY, this.#stateForFlag());
            const update = { "system.customBackground": `${bgPath}?v=${Date.now()}` };
            const colorInput = this.element.querySelector("input[data-ref='font-color']");
            if (this.#fontColorDirty && colorInput) update["system.customFontColor"] = colorInput.value;
            await this.actor.update(update);

            ui.notifications.success(this.#loc("SavedSuccess"));
            this.close();
        } catch (err) {
            console.error("CustomBackgroundEditor: save failed", err);
            ui.notifications.error(this.#loc("SaveFailed"));
        }
    }

    /**
     * Upload a blob/file into this world's custom-backgrounds directory.
     * @returns {Promise<string|null>} the server path, or null on failure.
     */
    async uploadToWorldAssets(blobOrFile, { filename = `export-${foundry.utils.randomID()}.png`, notify = false } = {}) {
        if (!game.user?.can?.("FILES_UPLOAD")) {
            ui.notifications.error(game.i18n.localize("MIST_ENGINE.NOTIFICATIONS.NotAllowedToUploadFilesForCustomBackground"));
            return null;
        }
        const worldId = game.world?.id ?? game.world?.name;
        if (!worldId) {
            ui.notifications.error(this.#loc("NoWorldId"));
            return null;
        }

        const FP = foundry.applications.apps.FilePicker.implementation;
        const dir = `worlds/${worldId}/assets/custom-backgrounds`;
        try { await FP.createDirectory("data", dir); } catch (e) { /* exists */ }

        const file = (blobOrFile instanceof File)
            ? new File([blobOrFile], filename, { type: blobOrFile.type || "image/png" })
            : new File([blobOrFile], filename, { type: "image/png" });

        const resp = await FP.upload("data", dir, file, {}, { notify });
        return resp?.path ?? `${dir}/${file.name}`;
    }
}
