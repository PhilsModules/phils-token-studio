const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class QuickTokenStudio extends HandlebarsApplicationMixin(ApplicationV2) {
    
    constructor(options = {}) {
        super(options);
        this.actor = options.actor;
        
        // Settings
        this.resolution = game.settings.get("phils-token-studio", "outputResolution") || 512;
        this.storagePath = game.settings.get("phils-token-studio", "storagePath") || "phils-token-studio/user-tokens";
        
        // State
        const defaults = this.actor?.getFlag("phils-token-studio", "lastState") || {};
        
        this.uiState = {
            activeView: "token", // 'token' or 'avatar'
            activeLayer: "character", // 'character' or 'background'
            activeTab: "transform",
            drafts: defaults.drafts || {}, // Persistence
            sourcePath: defaults.sourcePath || null, // Track original source
            token: {
                transforms: {
                    x: defaults.token?.transforms?.x || 0,
                    y: defaults.token?.transforms?.y || 0,
                    scale: defaults.token?.transforms?.scale || 1.0,
                    rotation: defaults.token?.transforms?.rotation || 0
                },
                frame: {
                    transforms: {
                        x: defaults.token?.frame?.transforms?.x || 0,
                        y: defaults.token?.frame?.transforms?.y || 0,
                        scale: defaults.token?.frame?.transforms?.scale || 1.0,
                        rotation: defaults.token?.frame?.transforms?.rotation || 0
                    },
                    path: (defaults.token?.frame?.path && !defaults.token.frame.path.includes("circle.svg")) 
                               ? defaults.token.frame.path 
                               : this._getDefaultFramePath()
                },
                fx: {
                    shadowBlur: defaults.token?.fx?.shadowBlur ?? 0,
                    shadowColor: defaults.token?.fx?.shadowColor ?? "#000000",
                    backgroundColor: defaults.token?.fx?.backgroundColor || null 
                },
                // dynamicRingScale & useFoundryRing moved to Root
                avatarAspectRatio: 1.0,
                
                background: {
                    active: defaults.token?.background?.active || false,
                    path: defaults.token?.background?.path || null,
                    transforms: { 
                        x: defaults.token?.background?.transforms?.x || 0, 
                        y: defaults.token?.background?.transforms?.y || 0, 
                        scale: defaults.token?.background?.transforms?.scale || 1, 
                        rotation: defaults.token?.background?.transforms?.rotation || 0 
                    }
                },
                /* framePath: REMOVED - Moved to frame.path */
            },
            avatar: { 
                layer: 'character', 
                transforms: { 
                    x: defaults.avatar?.transforms?.x || 0,
                    y: defaults.avatar?.transforms?.y || 0,
                    scale: defaults.avatar?.transforms?.scale || 1.0,
                    rotation: defaults.avatar?.transforms?.rotation || 0
                },
                fx: {
                    shadowBlur: 0,
                    shadowColor: "#000000",
                    backgroundColor: null 
                }
            },
            
            // Shared State
            frames: [], // This will be populated by _loadUserFrames
            isEraserActive: false,
            eraserMode: "remove", // remove | add
            eraserSize: 50, // Default Eraser Size

            isPopOutActive: false,
            popOutMode: "add", // add | remove
            popOutSize: 50, // Default Pop-Out Size
            
            chromaTolerance: 50,
            chromaColor: "#00ff00",
            
            // Root Level Settings
            dynamicRingScale: defaults.dynamicRingScale || 1.0,
            useFoundryRing: defaults.useFoundryRing || false,
            
            // Paint Tool State
            isPaintActive: false,
            paintMode: "add", // add | remove
            paintSize: 20,
            paintColor: "#ff0000"
        };
        
        this.isCanvasPainting = false; // Flag to track actual canvas painting vs generic dragging
        
        // Assets
        this.frameImage = null; // CanvasImageSource
        this.sourceImage = null; // CanvasImageSource
        this.userFrames = []; // List of frame paths
        
        // Undo History
        this.history = [];
        this.maxHistory = 50;
        
        // Initial load
        console.log("Phils Quick Tokens | Init | Defaults:", defaults);
        this._loadUserFrames();
        this.canvasToken = null;
        this.canvasAvatar = null;
        this.ctxToken = null;
        this.ctxAvatar = null;
        
        // Editable Buffers (Separated)
        this.tokenBuffer = null;
        this.avatarBuffer = null;
        this.backgroundBuffer = null;
        this.frameBuffer = null; // New Frame Buffer
        this.popOutBuffer = null; // New Pop-Out Mask
        this.paintBuffer = null; // Paint Buffer
        this.originalImage = null; // Keep raw ref (Character)
        this.originalFrameImage = null; // Frame Raw
        this.originalBackgroundImage = null; // Background Raw
        
        // Session Flag
        this._sessionRestored = false;
        
        // Bindings
        this._pasteHandler = this._onPaste.bind(this);
        this._moveHandler = this._onCanvasMouseMove.bind(this);
        this._upHandler = this._onCanvasMouseUp.bind(this);
        
        // Actions
        // This specific line should ideally be in _attachEventListeners after HTML is rendered
        // this.element.querySelector("[data-action='toggle-layer']").addEventListener("change", this._onToggleLayer.bind(this));
        
    }
    
    _getDefaultFramePath() {
        const setting = game.settings.get("phils-token-studio", "defaultFrame");
            // Legacy fix: If setting is the broken "circle.svg" or empty, use the new friend frame
        if (!setting || setting.includes("circle.svg")) {
            return "modules/phils-token-studio/assets/frames/token_friend.webp";
        }
        return setting;
    }
    
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "token-studio-app",
        classes: ["token-studio-app"],
        window: {
            title: "Phils Token Studio",
            icon: "fas fa-user-circle",
            resizable: true,
            width: 1200,
            height: 750 // Optimal height for 350px canvas
        },
        form: {
            handler: QuickTokenStudio.submit,
            closeOnSubmit: false
        }
    };

    /**
     * EXTEND CLOSE to save state
     */
    async close(options) {
        // Save Draft State (Buffers)
        await this._saveDraftState();
        
        window.removeEventListener("paste", this._pasteHandler);
        window.removeEventListener("mousemove", this._moveHandler);
        window.removeEventListener("mouseup", this._upHandler);
        return super.close(options);
    }
    
    static PARTS = {
        main: {
            template: "modules/phils-token-studio/templates/token-studio.hbs"
        }
    };

    async _loadUserFrames() {
        // Pre-defined defaults
        const defaults = [
            "modules/phils-token-studio/assets/frames/token_friend.webp",
            "modules/phils-token-studio/assets/frames/token_enemy.webp"
        ];
        
        for (const path of defaults) {
            if (!this.userFrames.includes(path)) {
                this.userFrames.push(path);
            }
        }

        // Also check settings default if different?
        const settingsDefault = game.settings.get("phils-token-studio", "defaultFrame");
        
        // Sanitize: Ignore circle.svg
        if (settingsDefault && !settingsDefault.includes("circle.svg") && !this.userFrames.includes(settingsDefault)) {
            this.userFrames.push(settingsDefault);
        }
    }

    /* ------------------------------------------- */
    /*  Lifecycle                                  */
    /* ------------------------------------------- */

    async _renderHTML(context, options) {
        const result = await super._renderHTML(context, options);
        return result;
    }
    
    _onRender(context, options) {
        super._onRender(context, options);
        
        // Canvas Setup
        this.canvasToken = this.element.querySelector("#canvas-token");
        this.canvasAvatar = this.element.querySelector("#canvas-avatar");
        
        if (this.canvasToken) this.ctxToken = this.canvasToken.getContext("2d");
        if (this.canvasAvatar) this.ctxAvatar = this.canvasAvatar.getContext("2d");
        
        this.drawAll();

        // --------------------------------------------------
        // APP LAYOUT LISTENERS
        // --------------------------------------------------

        // View Selection (Top Bar Toggle)
        // Handled via data-action="setView"


        // Tab Navigation
        const tabs = this.element.querySelectorAll(".tabs-nav .item");
        for (const tab of tabs) {
            tab.addEventListener("click", (e) => {
                this._onTabClick(e);
            });
        }
        
        // Manual Event Listeners
        this._attachEventListeners();
    }

    _attachEventListeners() {
        const html = this.element;
        
        // Click Actions
        html.querySelectorAll("[data-action]").forEach(el => {
            el.addEventListener("click", (ev) => {
                const action = el.dataset.action;
                // Convert kebab-case to camelCase (e.g. toggle-popout -> togglePopOut)
                const camelAction = action.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                const handler = this[`_on${camelAction.charAt(0).toUpperCase() + camelAction.slice(1)}`];
                
                // Only hijack if we actually handle it
                if (handler) {
                    // FIX: Do not preventDefault on inputs (checkboxes) or selects, otherwise they don't toggle/open
                    if (el.tagName !== "INPUT" && el.tagName !== "SELECT") {
                        ev.preventDefault();
                    }
                    ev.stopPropagation();
                    handler.call(this, ev, el);
                }
            });
        });


        
        // Drag & Drop for Frames
        const trash = html.querySelector(".trash-can");
        if (trash) {
            trash.addEventListener("dragover", (e) => {
                e.preventDefault();
                trash.classList.add("drag-hover");
            });
            trash.addEventListener("dragleave", (e) => {
                trash.classList.remove("drag-hover");
            });
            trash.addEventListener("drop", (e) => this._onDropTrash(e));
        }
        
        html.querySelectorAll(".frame-item.draggable").forEach(el => {
            el.addEventListener("dragstart", (e) => this._onDragStartFrame(e));
        });

        // Drop Zone (Entire Stage)
        const dropZone = this.element.querySelector("#quick-token-drop-zone");
        if (dropZone) {
            dropZone.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                // dropZone.classList.add("active"); 
            });
            // The global drop listener on `this.element` handles this now.
            // dropZone.addEventListener("drop", this._onDropFile.bind(this));
        }

        // Floating Fit Button
        const fitBtn = this.element.querySelector("button[data-action='autoFit']");
        if (fitBtn) fitBtn.addEventListener("click", this._onAutoFit.bind(this));


        // Global Paste Listener
        window.addEventListener("paste", this._pasteHandler);
        
        // Global Drag Listeners (for canvas interaction)
        window.addEventListener("mousemove", this._moveHandler);
        window.addEventListener("mouseup", this._upHandler);
        
        // Prevent default drag/drop on this element
        this.element.addEventListener("dragover", e => e.preventDefault());
        this.element.addEventListener("drop", this._onDropFile.bind(this));
        
        // Canvas Painting State Listeners
        const canvasToken = html.querySelector("#canvas-token");
        const canvasAvatar = html.querySelector("#canvas-avatar");
        
        const startPainting = () => { this.isCanvasPainting = true; };
        const stopPainting = () => { this.isCanvasPainting = false; };
        
        if(canvasToken) canvasToken.addEventListener("mousedown", startPainting);
        if(canvasAvatar) canvasAvatar.addEventListener("mousedown", startPainting);
        window.addEventListener("mouseup", stopPainting);
        
        // Color Inputs (Shadow/Background) - FIX: Explicit Listeners
        html.querySelectorAll("input[type='color']").forEach(input => {
            input.addEventListener("input", (e) => {
                const name = e.target.name;
                const value = e.target.value;
                
                if (name === "shadowColor") {
                    this.uiState.token.fx.shadowColor = value;
                    this.drawAll();
                } else if (name === "backgroundColor") {
                    this.uiState.token.fx.backgroundColor = value;
                    this.drawAll();
                } else if (name === "chromaColor") {
                    this.uiState.chromaColor = value;
                    this.uiState.token.chromaColor = value; // ?
                    // this.drawAll(); // Chroma is applied on click
                } else if (name === "paintColor") {
                    this.uiState.paintColor = value;
                }
            });
        });


        // TRANSFORM INPUTS (Sliders & Manual Entry)
        html.querySelectorAll("input[type='range']").forEach(input => {
            input.addEventListener("input", this._onTransformChange.bind(this));
            input.addEventListener("change", () => this._saveHistory()); // Save history on release
        });
        
        html.querySelectorAll(".val-input").forEach(input => {
            // Commit on Change (Blur/Enter)
            input.addEventListener("change", (event) => {
                const target = event.currentTarget;
                const name = target.dataset.target;
                let val = parseFloat(target.value);
                if(isNaN(val)) return;

                // Sync to slider (which triggers the logic)
                const slider = this.element.querySelector(`input[type='range'][name='${name}']`);
                if (slider) {
                    slider.value = val;
                    // Trigger logic, passing the INPUT as the target so we don't overwrite it
                    this._onTransformChange({ currentTarget: slider, originalTarget: target });
                } else {
                    // Direct update for non-slider inputs
                    if (name === 'chromaTolerance') {
                         this.element.querySelector("#chroma-tolerance").value = val;
                         this.uiState.chromaTolerance = val;
                         this.drawAll(); // Force redraw
                    }
                }
            });
            
            // Blur on Enter
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter") event.currentTarget.blur();
            });
        });

        // Layer Selection
        html.querySelectorAll("input[name='layer']").forEach(input => {
            input.addEventListener("change", this._onLayerChange.bind(this));
        });

        // New Actions
        const btnDeleteBG = html.querySelector("[data-action='deleteBackground']");
        if (btnDeleteBG) btnDeleteBG.addEventListener("click", this._onDeleteBackground.bind(this));
        
        const btnUploadPortrait = html.querySelector("[data-action='uploadPortrait']");
        if (btnUploadPortrait) btnUploadPortrait.addEventListener("click", this._onUploadPortrait.bind(this));
        
        const inputAvatarRatio = html.querySelector("[data-action='changeAvatarRatio']");
        if (inputAvatarRatio) inputAvatarRatio.addEventListener("change", this._onChangeAvatarRatio.bind(this));
        
        const inputRingScale = html.querySelector("[data-action='changeRingScale']");
        if (inputRingScale) inputRingScale.addEventListener("change", this._onChangeRingScale.bind(this));

        const checkFoundryRing = html.querySelector("[data-action='toggleFoundryRing']");
        if (checkFoundryRing) checkFoundryRing.addEventListener("change", this._onToggleFoundryRing.bind(this));




        // Layer Toggle Listener
        const layerToggles = this.element.querySelectorAll("[data-action='toggle-layer']");
        layerToggles.forEach(toggle => {
            toggle.addEventListener("change", this._onLayerChange.bind(this));
        });
        
        // Interactive Canvas Listeners (Bind to BOTH)
        this._bindCanvasEvents(this.canvasToken, "token");
        this._bindCanvasEvents(this.canvasAvatar, "avatar");
        
        // Load Initial Images if not loaded
        const loadPromises = [];

        if (!this.originalImage) {
            if (this.uiState.sourcePath) {
                 console.log("Phils Quick Tokens | Render | Loading saved sourcePath:", this.uiState.sourcePath);
                 loadPromises.push(this._loadSourceImage(this.uiState.sourcePath));
            } else if (this.actor?.img) {
                 console.log("Phils Quick Tokens | Render | Capturing original actor.img:", this.actor.img);
                 this.uiState.sourcePath = this.actor.img;
                 loadPromises.push(this._loadSourceImage(this.actor.img));
            }
        }
        
        // Frame Load
        if (!this.frameBuffer) {
             loadPromises.push(this._loadFrameImage(this.uiState.token.frame.path));
        }
        
        // Background Load
        if (this.uiState.token.background?.path && !this.backgroundBuffer) {
             loadPromises.push(this._loadBackground(this.uiState.token.background.path));
        }

        // Wait for ALL assets to be ready before restoring session
        Promise.all(loadPromises).then(() => {
             this.drawAll(); 
             // Restore Drafts only after buffers exist
             this._restoreSession();
             // Initial View
             this._updateViewVisibility(this.uiState.activeView);
        });

        this._isDragging = false;
        this._dragStart = { x: 0, y: 0 };
    }
    
    async _restoreSession() {
        if (this._sessionRestored) return;
        
        if (this.uiState.drafts) {
            console.log("Phils Quick Tokens | Restoring Draft Session...");
            await this._loadDraftState();
            this.drawAll();
        }
        
        this._sessionRestored = true;
    }
    
    _onTabClick(e) {
        const target = e.currentTarget;
        const group = target.dataset.tab;
        
        this.uiState.activeTab = group;
        // Optimization: Do NOT full re-render on tab switch, just toggle classes
        // this.render(); 

        // Update Nav
        this.element.querySelectorAll(".tabs-nav .item").forEach(t => t.classList.remove("active"));
        target.classList.add("active");
        
        // Update Content
        this.element.querySelectorAll(".tab-content .tab").forEach(t => t.classList.remove("active"));
        this.element.querySelector(`.tab-content .tab[data-tab='${group}']`)?.classList.add("active");
        
        // Update context controls if needed (e.g. if we switch to Style for Avatar)
        this._updateContextControls(this.uiState.activeView);
    }

    _bindCanvasEvents(canvas, viewName) {
         if (!canvas) return;
         canvas.addEventListener("wheel", (e) => this._onCanvasWheel(e, viewName), { passive: false });
         canvas.addEventListener("mousedown", (e) => this._onCanvasMouseDown(e, viewName));
    }

    _setActiveView(view) {
        if (this.uiState.activeView === view) return;
        this.uiState.activeView = view;
        
        // Update Canvas Highlighting
        this._updateViewVisibility(view);
        
        // Update Sliders to match new view's transforms
        this._updateTransformUI();
        
        // Update Context-Specific UI (Disable Frame controls if Avatar)
        this._updateContextControls(view);
    }
    
    _updateContextControls(view) {
        const isToken = view === 'token';
        
        // Frame Selector
        const frameGroup = this.element.querySelector(".control-group:has(.frame-selector)") || 
                          this.element.querySelector(".frame-selector")?.closest(".control-group");
                          
        if (frameGroup) {
            frameGroup.classList.toggle("disabled", !isToken);
        }
        
        // Scene BG (already handled in _updateViewVisibility somewhat, but good to be explicit)
    }
    
    _updateViewVisibility(view) {
        const tokenContainer = this.element.querySelector("#container-token");
        const avatarContainer = this.element.querySelector("#container-avatar");
        const tokenBtn = this.element.querySelector("button[data-view='token']");
        const avatarBtn = this.element.querySelector("button[data-view='avatar']");
        
        if (tokenContainer) tokenContainer.classList.toggle("hidden", view !== "token");
        if (avatarContainer) avatarContainer.classList.toggle("hidden", view !== "avatar");
        
        if (tokenBtn) tokenBtn.classList.toggle("active", view === "token");
        if (avatarBtn) avatarBtn.classList.toggle("active", view === "avatar");

    }

    // async close(options) moved up
    /* ------------------------------------------- */
    /*  Data Preparation                           */
    /* ------------------------------------------- */

    /* ------------------------------------------- */
    /*  Data Preparation                           */
    /* ------------------------------------------- */

    async _onDragStartFrame(e) {
        const path = e.currentTarget.dataset.path;
        e.dataTransfer.setData("text/plain", path);
    }
    
    async _onDropTrash(e) {
        e.preventDefault();
        e.currentTarget.classList.remove("drag-hover");
        const path = e.dataTransfer.getData("text/plain");
        
        if (!path || path === "default") return;
        
        const { DialogV2 } = foundry.applications.api;
        
        const confirm = await DialogV2.confirm({
            window: { title: game.i18n.localize("TOKEN-STUDIO.RemoveFrameTitle") },
            content: `<p>${game.i18n.localize("TOKEN-STUDIO.RemoveFrameConfirm")}</p><small>${path}</small>`,
            rejectClose: false,
            modal: true
        });
        
        if (confirm) {
            // Remove from list
            this.userFrames = this.userFrames.filter(p => p !== path);
            
            // If active, reset
            if (this.uiState.token.frame.path === path) {
                this.uiState.token.frame.path = this._getDefaultFramePath();
                await this._loadFrameImage(this.uiState.token.frame.path);
            }
            
            this.render();
            this.render();
            ui.notifications.info(game.i18n.localize("TOKEN-STUDIO.FrameRemoved"));
        }
    }

    async _prepareContext(options) {

        const view = this.uiState.activeView;
        const activeState = this.uiState[view];
        
        // Determine which transforms to show based on Layer
        let currentTransforms = activeState.transforms;
        if (view === 'token') {
             if (this.uiState.activeLayer === 'background') {
                 currentTransforms = this.uiState.token.background.transforms;
             } else if (this.uiState.activeLayer === 'frame') {
                 currentTransforms = this.uiState.token.frame.transforms;
             }
        }

        return {
            title: `Token Studio: ${this.actor?.name || "Generic"}`,
            activeView: view,
            isTokenActive: view === 'token',
            isAvatarActive: view === 'avatar',
            
            // Layer State
            activeLayer: this.uiState.activeLayer,
            isCharacterLayer: this.uiState.activeLayer === 'character',
            isBackgroundLayer: this.uiState.activeLayer === 'background',
            isFrameLayer: this.uiState.activeLayer === 'frame',
            
            hasSourceImage: !!this.originalImage,
            
            // Sliders (Mapped to current layer)
            transforms: currentTransforms,
            fx: this.uiState.token.fx, // Background color/shadow is global to token for now? Or per layer? Usually global.
            
            isTokenActive: view === 'token',
            frames: (this.userFrames || []).map(f => ({
                name: f.split("/").pop(),
                path: f,
                active: f === this.uiState.token.frame.path
            })),
            /* showSceneBackground: REMOVED */         
            
            // Tools
            eraserSize: this.uiState.eraserSize,
            popOutSize: this.uiState.popOutSize,
            eraserMode: this.uiState.eraserMode,
            popOutMode: this.uiState.popOutMode,
            isEraserActive: this.uiState.isEraserActive,
            isPopOutActive: this.uiState.isPopOutActive,
            chromaTolerance: this.uiState.chromaTolerance,
            chromaColor: this.uiState.chromaColor,

            // Paint Tool
            isPaintActive: this.uiState.isPaintActive,
            paintMode: this.uiState.paintMode,
            paintSize: this.uiState.paintSize,
            paintColor: this.uiState.paintColor,

            // Tab State (Booleans for HBS)
            isTabTransform: (this.uiState.activeTab || "transform") === "transform",
            isTabStyle: this.uiState.activeTab === "style",

            // New State
            // New State
            dynamicRingScale: this.uiState.dynamicRingScale,
            useFoundryRing: this.uiState.useFoundryRing,
            avatarAspectRatio: this.uiState.avatarAspectRatio
        };
    }
    

    async _loadFrameImage(src) {
        if (!src) {
            this.frameImage = null;
            this.drawAll();
            return;
        }
        try {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = src;
            await img.decode();
            img.src = src;
            await img.decode();
            // this.frameImage = img; // We don't use the raw image anymore for drawing
            this.originalFrameImage = img; // Keep for restore
            
            // Create Buffer
            this.frameBuffer = this._createBufferFromImage(img);
            
            // Ensure state matches
            this.uiState.token.frame.path = src;
            this.drawAll();
        } catch (err) {
            console.error("Phils Quick Tokens | Failed to load frame:", err);
            // Don't break the app, just don't show frame
            this.frameImage = null;
            this.frameBuffer = null;
            this.drawAll();
        }
    }

    async _onDropFile(ev) {
        ev.preventDefault();
        
        if (ev.dataTransfer.files && ev.dataTransfer.files[0]) {
            const file = ev.dataTransfer.files[0];
            if (!file.type.startsWith("image/")) return ui.notifications.warn(game.i18n.localize("TOKEN-STUDIO.NotImageFile"));
            
            // If we are in "Background" mode, load as background??
            // For now, let's keep drag/drop as MAIN source to prevent confusion, 
            // unless we have specific drop zones. 
            // Or.. if activeLayer is background, drop there?
            if (this.uiState.activeLayer === 'background') {
                const path = await this._uploadFile(file);
                this._loadBackground(path);
            } else {
                const path = await this._uploadFile(file);
                this.uiState.sourcePath = path;
                this._isLocalSource = true;
                this._loadSourceImage(path);
            }
        }
    }

    async _loadSourceImage(src) {
        if (!src) return;
        
        try {
            // Load the raw image first
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = src;
            await img.decode();
            
            this.originalImage = img;
            
            // Create SEPARATE Buffers
            this.tokenBuffer = this._createBufferFromImage(img);
            this.avatarBuffer = this._createBufferFromImage(img);
            
            // Initialize Pop-Out Buffer (Matches Resolution)
            if (!this.popOutBuffer) {
                this.popOutBuffer = this._createPopOutBuffer();
            }
            if (!this.paintBuffer) {
                this.paintBuffer = this._createPopOutBuffer(); // Same size/logic
            }
            
            
            this.drawAll();

            // Note: Draft loading is now handled in _restoreSession called by _onRender
            // to ensure it happens AFTER initial load but not on every image swap.
            
            this.render();
            return true;
        } catch (err) {
            console.error("Phils Quick Tokens | Failed to load source:", err);
            ui.notifications.error(game.i18n.localize("TOKEN-STUDIO.FailedLoadImage"));
        }
    }

    _createPopOutBuffer() {
        const canvas = document.createElement("canvas");
        const scale = this.uiState.dynamicRingScale || 1.0;
        const size = Math.round(this.resolution * scale);
        canvas.width = size;
        canvas.height = size;
        return canvas;
    }

    async _loadBackground(src) {
        if (!src) return;
        try {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = src;
            await img.decode();

            this.originalBackgroundImage = img; // Keep for restore

            this.uiState.token.background.path = src;
            this.uiState.token.background.active = true;
            this.backgroundBuffer = this._createBufferFromImage(img);
            
            this.drawToken(); // Only affects token
            
            // Auto-activate background layer to show it?
            // this.uiState.activeLayer = 'background';
            // this.render();
        } catch (err) {
            console.error("Phils Quick Tokens | Failed to load background:", err);
            return false;
        }
        return true;
    }

    _createBufferFromImage(img) {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return canvas;
    }

    _onDropFile(ev) {
        ev.preventDefault();
        
        const file = ev.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (this.uiState.activeLayer === 'background') {
                    // Load as background (no storage change yet, just visual)
                    this._loadBackground(e.target.result);
                } else {
                    this.uiState.sourcePath = null; // Clear old path
                    this._isLocalSource = true; // Mark as needing upload
                    this._loadSourceImage(e.target.result);
                }
            };
            reader.readAsDataURL(file);
        }
    }

    _onPaste(ev) {
        const items = (ev.clipboardData || ev.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") !== -1) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (this.uiState.activeLayer === 'background') {
                        this._loadBackground(e.target.result);
                    } else {
                        this.uiState.sourcePath = null; 
                        this._isLocalSource = true; 
                        this._loadSourceImage(e.target.result);
                    }
                };
                reader.readAsDataURL(blob);
                ev.preventDefault(); 
                break;
            }
        }
    }

    async _onPickSourceFile() {
        try {

            const FilePickerClass = FilePicker;
            new FilePickerClass({
                type: "image",
                callback: (path) => {
                    this.uiState.sourcePath = path; // Save the source!
                    this._loadSourceImage(path);
                }
            }).browse();
        } catch (err) {
            console.error("Phils Quick Tokens | FilePicker Error:", err);
            ui.notifications.error("Could not open File Picker.");
        }
    }

    async _onUploadBackground() {
        try {

            console.log("Phils Quick Tokens | Opening Background Uploader...");
            const FilePickerClass = FilePicker;
            new FilePickerClass({
                type: "image",
                callback: (path) => {
                    this._loadBackground(path);
                }
            }).browse();
        } catch (err) {
            console.error("Phils Quick Tokens | FilePicker Error:", err);
            ui.notifications.error("Could not open File Picker.");
        }
    }

    /* ------------------------------------------- */
    /*  Canvas Rendering                           */
    /* ------------------------------------------- */

    drawAll() {
        this.drawTokenSandwich();
        this.drawAvatar();
    }

    drawAll() {
        this.drawTokenSandwich();
        this.drawAvatar();
    }
    
    // Listeners for Paint Tool
    _onTogglePaint(ev) {
        // Toggle Paint
        this.uiState.isPaintActive = !this.uiState.isPaintActive;
        
        // Disable others
        if(this.uiState.isPaintActive) {
            this.uiState.isEraserActive = false;
            this.uiState.isPopOutActive = false;
        }
        this.render();
    }
    
    _onSetPaintMode(ev, el) {
        this.uiState.paintMode = el.dataset.mode;
        this.render();
    }
    
    _onClearPaint(ev) {
        if(!this.paintBuffer) return;
        const ctx = this.paintBuffer.getContext("2d");
        ctx.clearRect(0, 0, this.paintBuffer.width, this.paintBuffer.height);
        this.drawAll();
    }

    drawTokenSandwich(targetCtx = null, isExport = false) {
        // if (!this.canvasToken || !this.ctxToken) return;
        // Allow rendering to offscreen canvas
        if (!targetCtx && (!this.canvasToken || !this.ctxToken)) return;
        
        const ctx = targetCtx || this.ctxToken;
        const state = this.uiState.token;
        const size = this.resolution;
        
        // ----------------------------------------------------
        // PREPARE GEOMETRY
        // ----------------------------------------------------
        // Dynamic Ring Scale:
        // By default, Resolution = 1 Grid Unit.
        // If scale is 1.5, Canvas Size = Resolution * 1.5.
        // But the RING itself must remain at Resolution size (centered).
        
        const ringScale = this.uiState.dynamicRingScale || 1.0;
        const canvasSize = Math.round(size * ringScale);
        
        if (this.canvasToken.width !== canvasSize || this.canvasToken.height !== canvasSize) {
            this.canvasToken.width = canvasSize;
            this.canvasToken.height = canvasSize;
        }
        
        // Clean Slate (New Size)
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        const fState = state.frame;
        // Center acts as the anchor (Offset by canvas center)
        const cx = canvasSize/2 + fState.transforms.x;
        const cy = canvasSize/2 + fState.transforms.y;
        
        // Ring Radius is based on BASE RESOLUTION (Grid Unit), not canvas size
        const r = (size/2) * fState.transforms.scale; 

        // ----------------------------------------------------
        // RENDER LAYERS (Order: BG -> Char-In-Hole -> Frame -> Char-Pop-Out)
        // ----------------------------------------------------
        
        ctx.save();
        
        // 1. Background (Clipped to Circle)
        if (state.fx.backgroundColor || (state.background?.active && this.backgroundBuffer)) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
            ctx.clip();
            
            if (state.fx.backgroundColor && !this.uiState.isEraserActive) {
                 ctx.fillStyle = state.fx.backgroundColor;
                 ctx.fill();
            }
            if (state.background?.active && this.backgroundBuffer) {
                const bgState = state.background;
                ctx.translate(canvasSize/2 + bgState.transforms.x, canvasSize/2 + bgState.transforms.y);
                ctx.rotate((bgState.transforms.rotation * Math.PI) / 180);
                ctx.scale(bgState.transforms.scale, bgState.transforms.scale);
                ctx.drawImage(this.backgroundBuffer, -this.backgroundBuffer.width/2, -this.backgroundBuffer.height/2);
            }
            ctx.restore();
        }

        // 1.5 PAINT LAYER (Painted manually) - Merged on top of Background
        if (this.paintBuffer && this._bufferHasContent(this.paintBuffer)) {
            ctx.save();
             // CLIP to Circle (same as BG)
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
            ctx.clip();
            
            // Draw Paint
            ctx.drawImage(this.paintBuffer, 0, 0); // Paint buffer is canvasSize
            
            ctx.restore();
        }

        // 2. Character (Part 1: Inside the Hole)
        // This draws the character UNDER the frame, so edges are hidden by the ring.
        if (this.tokenBuffer) {
            ctx.save();
            // CLIP to Circle
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
            ctx.clip();
            
            // Draw Character
             if (state.fx.shadowBlur > 0) {
                 ctx.shadowColor = state.fx.shadowColor;
                 ctx.shadowBlur = state.fx.shadowBlur;
             }
             ctx.translate(canvasSize/2 + state.transforms.x, canvasSize/2 + state.transforms.y);
             ctx.rotate((state.transforms.rotation * Math.PI) / 180);
             ctx.scale(state.transforms.scale, state.transforms.scale);
             ctx.drawImage(this.tokenBuffer, -this.tokenBuffer.width/2, -this.tokenBuffer.height/2);
            
            ctx.restore();
        }

        // 3. Draw The Frame (The Ring)
        // SKIP if Exporting OR if using Foundry Ring (since we only show guide)
        const usingFoundryRing = this.uiState.useFoundryRing;
        
        // VISUAL GUIDE: If using Foundry Ring use dashed line
        if (usingFoundryRing && !isExport) {
             ctx.save();
             ctx.translate(canvasSize/2 + fState.transforms.x, canvasSize/2 + fState.transforms.y);
             ctx.rotate((fState.transforms.rotation * Math.PI) / 180);
             ctx.scale(fState.transforms.scale, fState.transforms.scale);
             
             ctx.beginPath();
             ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
             ctx.lineWidth = 2;
             ctx.setLineDash([5, 5]); // Dashed Line
             ctx.arc(0, 0, size/2 - 2, 0, Math.PI * 2); // Slightly inside
             ctx.stroke();
             
             ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
             ctx.lineWidth = 1;
             ctx.setLineDash([]); // Solid contrast
             ctx.stroke();
             
             ctx.restore();
        }

        // Only draw the ACTUAL frame buffer if we are NOT using Foundry Ring
        // (And implicitly not exporting with skipFrame logic, but usingFoundryRing covers both now)
        if (this.frameBuffer && !usingFoundryRing) {
            ctx.save();
            ctx.translate(canvasSize/2 + fState.transforms.x, canvasSize/2 + fState.transforms.y);
            ctx.rotate((fState.transforms.rotation * Math.PI) / 180);
            ctx.scale(fState.transforms.scale, fState.transforms.scale);
            // Draw Buffer instead of Image
            // We draw it at SIZE (Rez), centered.
            ctx.drawImage(this.frameBuffer, -size/2, -size/2, size, size); 
            ctx.restore();
        }
        
        // 4. Character (Part 2: Pop-Out / Brush Only)
        // This draws ONLY the parts painted by the brush, ON TOP of the frame.
        if (this.tokenBuffer && this.popOutBuffer && this._bufferHasContent(this.popOutBuffer)) {
             ctx.save();
             
             // Temp Canvas for Outer Character
             const charC = document.createElement("canvas");
             charC.width = canvasSize;
             charC.height = canvasSize;
             const charCtx = charC.getContext("2d");
             
             // Draw Character + Shadow (Same logic as above)
             charCtx.save();
             if (state.fx.shadowBlur > 0) {
                 charCtx.shadowColor = state.fx.shadowColor;
                 charCtx.shadowBlur = state.fx.shadowBlur;
             }
             charCtx.translate(canvasSize/2 + state.transforms.x, canvasSize/2 + state.transforms.y);
             charCtx.rotate((state.transforms.rotation * Math.PI) / 180);
             charCtx.scale(state.transforms.scale, state.transforms.scale);
             charCtx.drawImage(this.tokenBuffer, -this.tokenBuffer.width/2, -this.tokenBuffer.height/2);
             charCtx.restore();
             
             // Apply MASK (Destination-In) using ONLY the Brush Buffer
             charCtx.globalCompositeOperation = "destination-in";
             // PopOut Buffer defaults to Resolution Size currently. 
             // We align it to center.
             // Ensure PopOut Buffer matches Canvas Size (Resize clears it!)
             if (this.popOutBuffer.width !== canvasSize || this.popOutBuffer.height !== canvasSize) {
                 this.popOutBuffer.width = canvasSize;
                 this.popOutBuffer.height = canvasSize;
             }
             
             charCtx.drawImage(this.popOutBuffer, 0, 0);
             
             // Draw Result onto Main Canvas (Over Frame)
             ctx.drawImage(charC, 0, 0);
             
             ctx.restore();
        }
        
        // Pop-Out Mask Overlay (Visual Guide)
        if (this.uiState.isPopOutActive && this.popOutBuffer && !isExport) {
            ctx.save();
            ctx.globalAlpha = 0.3;
             // Ensure alignment (resize only if needed, though usually handled above)
             if (this.popOutBuffer.width !== canvasSize) {
                 this.popOutBuffer.width = canvasSize;
                 this.popOutBuffer.height = canvasSize;
             }
             ctx.drawImage(this.popOutBuffer, 0, 0);
            ctx.restore();
        }


        ctx.restore();
    }

    drawToken() {
        this.drawTokenSandwich();
    }

    drawToken_unused() {
        if (!this.canvasToken || !this.ctxToken) return;
        const ctx = this.ctxToken;
        const state = this.uiState.token;
        const size = this.resolution;
        
        if (this.canvasToken.width !== size || this.canvasToken.height !== size) {
            this.canvasToken.width = size;
            this.canvasToken.height = size;
        }

        // Clean Slate
        ctx.clearRect(0, 0, size, size);

        // ----------------------------------------------------
        // PREPARE MASK BUFFER (Base Circle + Brush)
        // ----------------------------------------------------
        if (!this._maskBuffer) {
             const c = document.createElement("canvas");
             c.width = size;
             c.height = size;
             this._maskBuffer = c;
        }
        if (this._maskBuffer.width !== size) { this._maskBuffer.width = size; this._maskBuffer.height = size; }
        
        const mCtx = this._maskBuffer.getContext("2d");
        mCtx.clearRect(0, 0, size, size);
        
        // 1. Draw Base Circle (The Hole in the Frame)
        const fState = state.frame;
        
        mCtx.save();
        mCtx.beginPath();
        const cx = size/2 + fState.transforms.x;
        const cy = size/2 + fState.transforms.y;
        const r = (size/2) * fState.transforms.scale; 
        
        mCtx.fillStyle = "#ffffff";
        mCtx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
        mCtx.fill();
        mCtx.restore();
        
        // 2. Add Pop-Out Brush Strokes (White)
        if (this.popOutBuffer && this._bufferHasContent(this.popOutBuffer)) {
            mCtx.drawImage(this.popOutBuffer, 0, 0, size, size);
        }

        // ----------------------------------------------------
        // RENDER LAYERS
        // ----------------------------------------------------
        
        ctx.save();
        
        // Step 2: Draw Background (Texture/Color)
        if (state.fx.backgroundColor || (state.background?.active && this.backgroundBuffer)) {
            ctx.save();
            // Clip to Circle (Background stays inside ring)
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
            ctx.clip();
            
            if (state.fx.backgroundColor) {
                 ctx.fillStyle = state.fx.backgroundColor;
                 ctx.fill();
            }
            if (state.background?.active && this.backgroundBuffer) {
                const bgState = state.background;
                ctx.translate(size/2 + bgState.transforms.x, size/2 + bgState.transforms.y);
                ctx.rotate((bgState.transforms.rotation * Math.PI) / 180);
                ctx.scale(bgState.transforms.scale, bgState.transforms.scale);
                ctx.drawImage(this.backgroundBuffer, -this.backgroundBuffer.width/2, -this.backgroundBuffer.height/2);
            }
            ctx.restore();
        }

        // Step 3: Draw The Frame (The Ring PNG) <--- FRAME COMES FIRST
        if (this.frameBuffer) {
            ctx.save();
            ctx.translate(size/2 + fState.transforms.x, size/2 + fState.transforms.y);
            ctx.rotate((fState.transforms.rotation * Math.PI) / 180);
            ctx.scale(fState.transforms.scale, fState.transforms.scale);
            ctx.drawImage(this.frameBuffer, -size/2, -size/2, size, size);
            ctx.restore();
        }
        
        // Step 4: Draw The Character (Masked)
        // We use a temp canvas to avoid masking the Frame we just drew
        if (this.tokenBuffer) {
             ctx.save();
             
             const charC = document.createElement("canvas");
             charC.width = size;
             charC.height = size;
             const charCtx = charC.getContext("2d");
             
             // Draw Character + Shadow ON TOP
             charCtx.save();
             if (state.fx.shadowBlur > 0) {
                 charCtx.shadowColor = state.fx.shadowColor;
                 charCtx.shadowBlur = state.fx.shadowBlur;
             }
             charCtx.translate(size/2 + state.transforms.x, size/2 + state.transforms.y);
             charCtx.rotate((state.transforms.rotation * Math.PI) / 180);
             charCtx.scale(state.transforms.scale, state.transforms.scale);
             charCtx.drawImage(this.tokenBuffer, -this.tokenBuffer.width/2, -this.tokenBuffer.height/2);
             charCtx.restore();
             
             // Apply MASK (Destination-In)
             // Keeps Character ONLY where Mask is White (Circle + Brush)
             charCtx.globalCompositeOperation = "destination-in";
             charCtx.drawImage(this._maskBuffer, 0, 0, size, size);
             
             // Draw Result onto Main Canvas (Over Frame)
             ctx.drawImage(charC, 0, 0);
             
             ctx.restore();
        }
        
        // Pop-Out Mask Overlay (Visual Guide)
        if (this.uiState.isPopOutActive && this.popOutBuffer) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.drawImage(this.popOutBuffer, 0, 0, size, size);
            ctx.restore();
        }

        ctx.restore();
    }
    
    _bufferHasContent(canvas) {
        // Quick check if canvas is empty? 
        // For now assume yes if we are using it.
        // Performance heavy to check pixels every frame.
        return true; 
    }

    drawAvatar() {
        if (!this.canvasAvatar || !this.ctxAvatar) return;
        const ctx = this.ctxAvatar;
        const state = this.uiState.avatar;
        
        const ratio = this.uiState.avatarAspectRatio || 1.0;
        const width = this.resolution;
        const height = this.resolution * ratio;
        
        if (this.canvasAvatar.width !== width || this.canvasAvatar.height !== height) {
             this.canvasAvatar.width = width;
             this.canvasAvatar.height = height;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.save();

        // Background
        if (state.fx.backgroundColor) {
             ctx.fillStyle = state.fx.backgroundColor;
             ctx.fillRect(0, 0, width, height);
        }

        // Image
        if (this.avatarBuffer) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, height);
            ctx.clip();
            
            // Center is width/2, height/2
            ctx.translate(width/2 + state.transforms.x, height/2 + state.transforms.y);
            ctx.rotate((state.transforms.rotation * Math.PI) / 180);
            ctx.scale(state.transforms.scale, state.transforms.scale);
            
            const imgW = this.avatarBuffer.width;
            const imgH = this.avatarBuffer.height;
            ctx.drawImage(this.avatarBuffer, -imgW/2, -imgH/2);
            ctx.restore();
        }
        ctx.restore();
    }

    /* ------------------------------------------- */
    /*  Interactive Canvas                         */
    /* ------------------------------------------- */

    _onCanvasMouseDown(event, viewName) {
        event.preventDefault(); 
        this._isDragging = true;
        this._activeDragView = viewName;
        this._dragStart = { x: event.clientX, y: event.clientY };
        
        // Save history if we are about to Erase (Left Click only) or Paint PopOut or Paint Color
        if ((this.uiState.isEraserActive || this.uiState.isPopOutActive || this.uiState.isPaintActive) && (event.buttons === 1)) {
            // We need to know WHICH buffer we are about to modify to save IT
            let targetLayer = 'token'; // default
            if (viewName === 'token') {
                if (this.uiState.activeLayer === 'background') targetLayer = 'background';
                else if (this.uiState.activeLayer === 'character') targetLayer = 'token'; // tokenBuffer is the character
            } else {
                targetLayer = 'avatar';
            }
            this._saveHistory(targetLayer);
        }

        // Store initial transform of the Dragged View, respecting Active Layer
        // Store initial transform of the Dragged View, respecting Active Layer
        if (viewName === 'token') {
             if (this.uiState.activeLayer === 'background') {
                 this._lastTransform = { ...this.uiState.token.background.transforms };
             } else if (this.uiState.activeLayer === 'frame') {
                 this._lastTransform = { ...this.uiState.token.frame.transforms };
             } else {
                 this._lastTransform = { ...this.uiState.token.transforms };
             }
        } else {
             this._lastTransform = { ...this.uiState[viewName].transforms };
        }
        
        // Auto-activate this view if needed
        // this._setActiveView(viewName); // Maybe redundant if we are already seeing it
    }

    /* ------------------------------------------- */
    /*   Canvas Interaction (Brush / Eraser)       */
    /* ------------------------------------------- */

    _onCanvasMouseMove(event) {
        // Painting Security Check: Only paint if we started clicking ON the canvas
        // This prevents sliders from triggering paint logic when dragging over canvas
        if (!this.isCanvasPainting) return;
        
        // Double Check: If we are hovering an input, ignore (Safety Net)
        if (event.target.tagName === 'INPUT' || event.target.closest('.control-group')) return;

        // 0.5 paint brush (Color)
        if (this.uiState.isPaintActive && (event.buttons === 1)) {
             event.preventDefault();
             // Only works on Token View
             if (this.uiState.activeView !== 'token') return;
             
             if (!this.canvasToken || !this.paintBuffer) return;
             const r = this.canvasToken.getBoundingClientRect();
             const mx = event.clientX - r.left;
             const my = event.clientY - r.top;
             
             // Map Mouse -> Canvas Coords
             const width = this.canvasToken.width;
             const height = this.canvasToken.height;
             const scaleX = width / r.width;
             const scaleY = height / r.height;
             
             const canvasX = mx * scaleX;
             const canvasY = my * scaleY;
             
             const ctx = this.paintBuffer.getContext("2d");
             ctx.save();
             
             // MODE LOGIC
             if (this.uiState.paintMode === 'remove') {
                 ctx.globalCompositeOperation = "destination-out"; // Erase paint
             } else {
                 ctx.globalCompositeOperation = "source-over"; // Add paint
                 ctx.fillStyle = this.uiState.paintColor;
             }
             
             ctx.beginPath();
             ctx.arc(canvasX, canvasY, this.uiState.paintSize / 2, 0, Math.PI * 2);
             ctx.fill();
             ctx.restore();
             
             this.drawAll();
             return;
        }

        // 0. POP-OUT BRUSH (Handle if Token View + PopOut Active + Button Down)
        // This is a "Masking" brush. Painting White reveals the image on top of frame.
        if (this.uiState.isPopOutActive && (event.buttons === 1)) {
             // console.log("PopOut Brush Active"); 
             event.preventDefault();
             // Only works on Token View
             if (this.uiState.activeView !== 'token') return;
             
             if (!this.canvasToken || !this.popOutBuffer) return;
             const r = this.canvasToken.getBoundingClientRect();
             const mx = event.clientX - r.left;
             const my = event.clientY - r.top;
             
             // Map Mouse -> Canvas Coords
             const width = this.canvasToken.width;
             const height = this.canvasToken.height;
             const scaleX = width / r.width;
             const scaleY = height / r.height;
             
             const canvasX = mx * scaleX;
             const canvasY = my * scaleY;
             
             const ctx = this.popOutBuffer.getContext("2d");
             ctx.save();
             
             // MODE LOGIC
             if (this.uiState.popOutMode === 'remove') {
                 ctx.globalCompositeOperation = "destination-out"; // Erase mask
             } else {
                 ctx.globalCompositeOperation = "source-over"; // Add mask (White)
                 ctx.fillStyle = "#ffffff";
             }
             
             ctx.beginPath();
             ctx.arc(canvasX, canvasY, this.uiState.popOutSize / 2, 0, Math.PI * 2);
             ctx.fill();
             ctx.restore();
             
             this.drawTokenSandwich();
             return;
        }

        // 1. STANDARD ERASER (Handle regardless of Drag state if Eraser is Active + Button Down)
        // Only if PopOut is NOT active
        if (this.uiState.isEraserActive && (event.buttons === 1) && !this.uiState.isPopOutActive) {
            event.preventDefault();
            
            // Geometric Detection for Robustness
            const mx = event.clientX;
            const my = event.clientY;
            
            let viewName = null;
            let canvas = null;
            
            // Check Token Canvas
            if (this.canvasToken) {
                const r = this.canvasToken.getBoundingClientRect();
                if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
                    viewName = 'token';
                    canvas = this.canvasToken;
                }
            }
            
            // Check Avatar Canvas (if not found yet)
            if (!viewName && this.canvasAvatar) {
                const r = this.canvasAvatar.getBoundingClientRect();
                if (mx >= r.left && mx >= r.right && my >= r.top && my <= r.bottom) {
                    viewName = 'avatar';
                    canvas = this.canvasAvatar;
                }
            }
            
            if (!viewName) return;

        // Select active buffer based on DETECTED view AND Active Layer
        let targetBuffer = null;
        let state = null;

        if (viewName === 'token') {
            if (this.uiState.activeLayer === 'background') {
                 targetBuffer = this.backgroundBuffer;
                 state = this.uiState.token.background;
            } else if (this.uiState.activeLayer === 'frame') {
                 targetBuffer = this.frameBuffer;
                 state = this.uiState.token.frame;
            } else {
                 targetBuffer = this.tokenBuffer;
                 state = this.uiState.token; // Character state
            }
        } else {
             targetBuffer = this.avatarBuffer;
             state = this.uiState.avatar;
        }

        if (!targetBuffer) return;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Map Mouse -> Canvas Internal Coordinates
        const width = canvas.width; 
        const height = canvas.height;
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;
        
        const canvasX = mouseX * scaleX;
        const canvasY = mouseY * scaleY;

        // Map Canvas -> Source Image Coordinates (Inverse Transform)
        // Center depends on View Size
        let cx = 0;
        let cy = 0;
        
        if (viewName === 'token') {
             const ringScale = this.uiState.dynamicRingScale || 1.0;
             cx = (this.resolution * ringScale) / 2;
             cy = (this.resolution * ringScale) / 2;
        } else {
             // Avatar
             const ratio = this.uiState.avatarAspectRatio || 1.0;
             cx = this.resolution / 2;
             cy = (this.resolution * ratio) / 2;
        }

        // Apply Inverse Translation
        let dx = canvasX - (cx + state.transforms.x);
        let dy = canvasY - (cy + state.transforms.y);
        
        // Apply Inverse Rotation
        const rad = (-state.transforms.rotation * Math.PI) / 180;
        const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
        
        // Map to Image Coordinates (Center origin -> TopLeft origin)
        // CRITICAL FIX: We must account for the ratio between the "Rendered Size" (e.g. 512px) and the "Actual Buffer Size" (e.g. 2048px).
        // The previous logic assumed 1:1 mapping (or depended on user scaling), which broke high-res frames forced into 512px boxes.

        let renderW, renderH;

        if (viewName === 'token') {
             // 1. Determine how this layer was drawn (Logic matches drawTokenSandwich)
             const size = this.resolution; // 512
             
             if (this.uiState.activeLayer === 'frame') {
                 // Frame is uniquely forced to Square (size x size)
                 renderW = size;
                 renderH = size;
             } else {
                 // Character and Background are drawn NATIVE (centered)
                 renderW = targetBuffer.width;
                 renderH = targetBuffer.height;
             }
        } else {
            // Avatar View: Draws native size centered
             renderW = targetBuffer.width;
             renderH = targetBuffer.height;
        }

        const ratioX = targetBuffer.width / renderW;
        const ratioY = targetBuffer.height / renderH;

        // Apply Ratio
        const rxScaled = rx * ratioX; // Scale the "rotated distance" by the resolution ratio
        const ryScaled = ry * ratioY;

        // Apply User Scale (Inverse)
        // Note: state.transforms.scale was applied to the Rendered output. 
        // So zooming IN (2.0) means we see LESS pixels. 
        // Mouse moves 10px -> matches 5px of image.
        const sx = rxScaled / state.transforms.scale;
        const sy = ryScaled / state.transforms.scale;
        
        const imgX = sx + (targetBuffer.width / 2);
        const imgY = sy + (targetBuffer.height / 2);

        // Adjust Brush Radius to match Buffer Resolution
        // If buffer is HUGE, a 50px brush needs to be larger in pixel-space to look same size?
        // Wait, if I zoom in, brush stays screen-relative (constant visual size)?
        // Yes, usually.
        // So brushRadius (pixels on buffer) = (ScreenBrushSize * Ratio) / Zoom
        const eSize = this.uiState.eraserSize;
        let brushRadius = (eSize / 2);
        
        // We take the average ratio if non-square? usually square brush.
        // Just use X ratio
        brushRadius = (brushRadius * ratioX) / state.transforms.scale;

        const ctx = targetBuffer.getContext("2d");
        ctx.save();

            if (this.uiState.eraserMode === 'add') {
                // RESTORE (Magic!)
                // Determine Source based on Layer
                let sourceImg = null;
                if (viewName === 'token') {
                    if (this.uiState.activeLayer === 'background') sourceImg = this.originalBackgroundImage;
                    else if (this.uiState.activeLayer === 'frame') sourceImg = this.originalFrameImage;
                    else sourceImg = this.originalImage;
                } else {
                    sourceImg = this.originalImage;
                }

                if (sourceImg) {
                     ctx.globalCompositeOperation = "source-over"; // Default
                     ctx.beginPath();
                     ctx.arc(imgX, imgY, brushRadius, 0, Math.PI * 2);
                     ctx.clip(); // Restrict drawing to this circle
                     
                     // Draw ORIGINAL image
                     // Note: We assume the buffer size matches the original image size exactly
                     // which it does because _createBufferFromImage sets canvas size to img size.
                     
                     // Optimization: Use Source-In or just drawImage
                     // For 'frame', the buffer might be different size if we swapped frames? 
                     // No, _loadFrameImage resets buffer.
                     
                     ctx.drawImage(sourceImg, 0, 0, targetBuffer.width, targetBuffer.height);
                }
            } else {
                 // ERASE (remove)
                ctx.globalCompositeOperation = "destination-out";
                ctx.beginPath();
                ctx.arc(imgX, imgY, brushRadius, 0, Math.PI * 2); 
                ctx.fill();
            }

            ctx.restore();

            // Repaint ONLY the view we erased
            if (viewName === 'token') this.drawToken();
            else this.drawAvatar();
            
            return;
        }

        // 2. DRAG (Pan) - Only if NOT erasing
        if (!this._isDragging || !this._activeDragView) return;
        // If Eraser is active, do NOT drag
        if (this.uiState.isEraserActive) return;

        event.preventDefault();
        
        const view = this._activeDragView;
        let targetTransforms;

        if (view === 'token') {
             if (this.uiState.activeLayer === 'background') {
                 targetTransforms = this.uiState.token.background.transforms;
             } else if (this.uiState.activeLayer === 'frame') {
                 targetTransforms = this.uiState.token.frame.transforms;
             } else {
                 targetTransforms = this.uiState.token.transforms;
             }
        } else {
            targetTransforms = this.uiState[view].transforms;
        }

        const dx = event.clientX - this._dragStart.x;
        const dy = event.clientY - this._dragStart.y;
        
        targetTransforms.x = this._lastTransform.x + dx;
        targetTransforms.y = this._lastTransform.y + dy;
        
        if (view === 'token') this.drawToken();
        else this.drawAvatar();
        
        this._updateTransformUI();
    }
    
    _onCanvasMouseUp(event) {
        if (this._isDragging) {
            this._saveHistory(); // Save new position
        }
        this._isDragging = false;
        this._activeDragView = null;
    }

    _onCanvasWheel(event, viewName) {
        event.preventDefault();
        const delta = event.deltaY;
        // User reported 0.005 was too slow/locked. 0.05 was too fast. Trying 0.02.
        const speed = 0.02; 
        
        let targetTransforms;
        if (viewName === 'token') {
             if (this.uiState.activeLayer === 'background') targetTransforms = this.uiState.token.background.transforms;
             else if (this.uiState.activeLayer === 'frame') targetTransforms = this.uiState.token.frame.transforms;
             else targetTransforms = this.uiState.token.transforms;
        } else {
            targetTransforms = this.uiState[viewName].transforms;
        }

        const currentScale = targetTransforms.scale;
        let newScale = currentScale - (Math.sign(delta) * speed);
        newScale = Math.min(Math.max(newScale, 0.1), 5.0);
        
        targetTransforms.scale = parseFloat(newScale.toFixed(2));
        
        if (viewName === 'token') this.drawToken();
        else this.drawAvatar();
        
        this._updateTransformUI();
    }

    _getLayerState() {
        const view = this.uiState.activeView;
        let state = this.uiState[view];
        if (view === 'token') {
            if (this.uiState.activeLayer === 'background') return this.uiState.token.background;
            else if (this.uiState.activeLayer === 'frame') return this.uiState.token.frame;
            else return this.uiState.token; // Character layer
        }
        return state; // Avatar view
    }

    _updateTransformUI() {
        // Updates the sliders/inputs to match the current state (called after switching layers/views)
        const state = this._getLayerState();
        if (!state) return; // Should handle avatar vs token logic
        
        const html = this.element;
        
        const setVal = (name, val) => {
            const input = html.querySelector(`input[name='${name}']`);
            if (input) input.value = val;
            
            // Update Number Input
            const numInput = html.querySelector(`.val-input[data-target='${name}']`);
            if (numInput) numInput.value = val;
        };
        
        setVal("x", state.transforms.x);
        setVal("y", state.transforms.y);
        setVal("scale", state.transforms.scale);
        setVal("rotation", state.transforms.rotation);
        
        // Update Brush Sizes inputs too if they exist
        setVal("eraserSize", this.uiState.eraserSize);
        setVal("popOutSize", this.uiState.popOutSize);
        
        // Special handle for Chroma since it's ID based
        const chromaSlider = html.querySelector("#chroma-tolerance");
        if(chromaSlider) chromaSlider.value = this.uiState.chromaTolerance || 50;
        const chromaInput = html.querySelector(".val-input[data-target='chromaTolerance']");
        if(chromaInput) chromaInput.value = this.uiState.chromaTolerance || 50;

        // FX are always on the view root (token/avatar), not sub-layers
        const fxState = this.uiState[this.uiState.activeView].fx;
        setVal("shadowBlur", fxState.shadowBlur);
        
        const shadowColorPicker = this.element.querySelector("color-picker[name='shadowColor']");
        if (shadowColorPicker) shadowColorPicker.value = fxState.shadowColor;
        
        const bgColorPicker = this.element.querySelector("color-picker[name='backgroundColor']");
        if (bgColorPicker) bgColorPicker.value = fxState.backgroundColor;
    }

    /* ------------------------------------------- */
    /*  Actions                                    */
    /* ------------------------------------------- */
    
    _onClose(event, target) {
        this.close();
    }

    _onMinimize(event, target) {
        this.minimize();
    }
    
    _onToggleEraser(event, target) {
        this.uiState.isEraserActive = !this.uiState.isEraserActive;
        // Exclusive: Turn off PopOut if Eraser ON
        if (this.uiState.isEraserActive) this.uiState.isPopOutActive = false;
        this.render();
    }
    
    _onTogglePopout(event, target) {
        this.uiState.isPopOutActive = !this.uiState.isPopOutActive;
        // Exclusive: Turn off Eraser if PopOut ON
        if (this.uiState.isPopOutActive) {
            this.uiState.isEraserActive = false;
            this.uiState.activeView = 'token';
            this._setActiveView('token');
        }
        this.render();
    }
    
    _onSetEraserMode(event, target) {
        const mode = target.dataset.mode;
        this.uiState.eraserMode = mode;
        this.render();
    }
    _onSetPopOutMode(event, target) {
        const mode = target.dataset.mode;
        this.uiState.popOutMode = mode;
        this.render();
    }

    _onTransformChange(event) {
        const target = event.currentTarget; // The Slider
        const sourceInput = event.originalTarget; // The Manual Input (if applicable)
        
        const prop = target.name;
        const val = parseFloat(target.value);
        const view = this.uiState.activeView;
        
        // Update Number Display (Manual Input)
        // Only update if the source was NOT this input (to prevent cursor jumps/overwrites while typing)
        const numInput = this.element.querySelector(`.val-input[data-target='${prop}']`);
        if (numInput && numInput !== sourceInput) { 
             numInput.value = val;
        }

        // Special handling for brush sizes (Action-less sliders)
        if (prop === "eraserSize") {
             this.uiState.eraserSize = val;
             return;
        }
        if (prop === "popOutSize") {
             this.uiState.popOutSize = val;
             return;
        }
        if (prop === "chromaTolerance") {
            this.uiState.chromaTolerance = val;
            return;
        }

        // Route based on name
        if (["scale", "rotation", "x", "y"].includes(prop)) {
            // Target Background Logic
            let state = this.uiState[view];
            if (view === 'token') {
                if (this.uiState.activeLayer === 'background') state = this.uiState.token.background;
                else if (this.uiState.activeLayer === 'frame') state = this.uiState.token.frame;
            }
            
            console.log(`Phils Quick Tokens | Update Transform: ${prop} = ${val} | View: ${view} | Layer: ${this.uiState.activeLayer}`);

            state.transforms[prop] = val;
            
            this.drawAll();
        } else if (["shadowBlur", "shadowColor", "backgroundColor"].includes(prop)) {
            this._onUpdateFX(event, target);
        }
    }
    
    _onLayerChange(event) {
        const val = event.target.value; // 'character' or 'background'
        console.log("Phils Quick Tokens | Toggle Layer:", val);
        this.uiState.activeLayer = val;
        
        // Sync sliders to show correct values for the new layer
        this._updateTransformUI();
        
        // If we switch to background, and no background exists, we might want to prompt? 
        // nah, just let them see 0 values or upload one.
        
        // Force re-render to update UI toggles (if HBS relies on activeLayer for other things)
        this.render();
    }
    



    _onSetLayer(event, target) {
        const layer = target.dataset.layer;
        if (!layer) return;
        
        console.log("Phils Quick Tokens | Set Layer Button:", layer);
        this.uiState.activeLayer = layer;
        this.render(); // Re-render to update UI states (buttons and radio slots)
    }
    
    _onSetView(event, target) {
        const view = target.dataset.view;
        this._setActiveView(view);
    }

    /* ------------------------------------------- */
    /*  History & Undo                             */
    /* ------------------------------------------- */

    _saveHistory() {
        if (!this.tokenBuffer || !this.avatarBuffer) return;
        
        // Save simple state
        const stateSnapshot = JSON.parse(JSON.stringify(this.uiState));
        
        // Save buffers
        const tokenData = this.tokenBuffer.getContext("2d").getImageData(0, 0, this.tokenBuffer.width, this.tokenBuffer.height);
        const avatarData = this.avatarBuffer.getContext("2d").getImageData(0, 0, this.avatarBuffer.width, this.avatarBuffer.height);
        
        let bgData = null;
        if (this.backgroundBuffer) {
            bgData = this.backgroundBuffer.getContext("2d").getImageData(0, 0, this.backgroundBuffer.width, this.backgroundBuffer.height);
        }

        let popData = null;
        if (this.popOutBuffer) {
            popData = this.popOutBuffer.getContext("2d").getImageData(0, 0, this.popOutBuffer.width, this.popOutBuffer.height);
        }

        let frameData = null;
        if (this.frameBuffer) {
            frameData = this.frameBuffer.getContext("2d").getImageData(0, 0, this.frameBuffer.width, this.frameBuffer.height);
        }

        let paintData = null;
        if (this.paintBuffer) {
            paintData = this.paintBuffer.getContext("2d").getImageData(0, 0, this.paintBuffer.width, this.paintBuffer.height);
        }

        this.history.push({
            tokenData,
            avatarData,
            bgData,
            popData,
            frameData,
            paintData,
            state: stateSnapshot
        });
        
        if (this.history.length > this.maxHistory) {
            this.history.shift(); // Remove oldest
        }
    }

    _onUndo() {
        if (this.history.length === 0) return ui.notifications.info("Nothing to Undo.");
        
        const step = this.history.pop();
        
        // Restore State (Deep Copy)
        if (step.state) {
            this.uiState = JSON.parse(JSON.stringify(step.state));
            this._updateTransformUI(); // Sync sliders
        }
        
        if (step.tokenData && this.tokenBuffer) {
             this.tokenBuffer.getContext("2d").putImageData(step.tokenData, 0, 0);
        }
        
        if (step.avatarData && this.avatarBuffer) {
             this.avatarBuffer.getContext("2d").putImageData(step.avatarData, 0, 0);
        }

        if (step.bgData && this.backgroundBuffer) {
            this.backgroundBuffer.getContext("2d").putImageData(step.bgData, 0, 0);
        }

        if (step.frameData && this.frameBuffer) {
             this.frameBuffer.getContext("2d").putImageData(step.frameData, 0, 0);
        }

        if (step.popData && this.popOutBuffer) {
            this.popOutBuffer.getContext("2d").putImageData(step.popData, 0, 0);
        }

        if (step.paintData && this.paintBuffer) {
            this.paintBuffer.getContext("2d").putImageData(step.paintData, 0, 0);
        }

        this.drawAll();
        // Force render to update toggles (like Eraser ON/OFF) if they changed
        this.render();
    }


    
    _onUpdateFX(event, target) {
        const prop = target.name;
        const val = target.type === 'range' ? Number(target.value) : target.value;
        const view = this.uiState.activeView;
        
        this.uiState[view].fx[prop] = val;
        
        if (target.type === 'range') {
             const label = this.element.querySelector(`#val-${prop}`);
             if(label) label.innerText = `${val}px`;
        }
        
        // Update numeric input for chroma
        if (prop === 'chromaColor') {
            const cInput = this.element.querySelector(".val-input[data-target='chromaColor']");
            if(cInput) cInput.value = val;
        }
        
        this.drawAll();
    }

    async _onAutoFit() {
        if (!this.originalImage) return;
        
        const size = this.resolution;
        const imgMax = Math.max(this.originalImage.naturalWidth, this.originalImage.naturalHeight);
        
        // Scale to Fit Canvas (0.9 margin)
        let scale = (size / imgMax) * 0.9;
        
        // If Frame is present, scale to fit the FRAME (approximate)
        if (this.frameImage) {
            const frameScale = this.uiState.token.frame.transforms.scale || 1;
            scale = scale * frameScale;
        }
        
        // Apply to CURRENT View (usually Token or Character Layer)
        const view = this.uiState.activeView;
        
        // If we are editing Frame, Auto-Fit resets Frame to 1.0? 
        // Or fits Frame to Canvas?
        if (view === 'token' && this.uiState.activeLayer === 'frame') {
            // Fit Frame to Canvas
             this.uiState.token.frame.transforms.scale = 1.0;
             this.uiState.token.frame.transforms.x = 0;
             this.uiState.token.frame.transforms.y = 0;
        } else {
             // Fit Character/Background
             this.uiState[view].transforms.scale = parseFloat(scale.toFixed(2));
             this.uiState[view].transforms.x = 0;
             this.uiState[view].transforms.y = 0;
        }
        
        this.drawAll();
        this._syncSliders();
    }
    
    _onReset() {
        const view = this.uiState.activeView;
        this.uiState[view].transforms = { x: 0, y: 0, scale: 1, rotation: 0 };
        this.drawAll();
        this._syncSliders();
    }


    
    async _onPickFrameFile() {
        try {
            const FilePickerClass = FilePicker; // Fallback for V12/older if needed, but V13 prefers namespaced
            new FilePickerClass({
                type: "image",
                callback: (path) => {
                     this.uiState.token.frame.path = path;
                     if (!this.userFrames.includes(path)) {
                         this.userFrames.push(path);
                     }
                     this._loadFrameImage(path);
                     this.render(); 
                }
            }).browse();
        } catch (err) {
            console.error("Phils Quick Tokens | FilePicker Error:", err);
            ui.notifications.error("Could not open File Picker.");
        }
    }
    
    _onRemoveFrame(event, target) {
        this.uiState.token.frame.path = null;
        this.frameBuffer = null;
        this.originalFrameImage = null;
        this.drawAll();
        // Do not render here if we want to avoid flicker, but we need to update the active state of the list.
        this.render();
    }

    _onSelectFrame(event, target) {
        const path = target.dataset.path;
        // Handle "default" keyword which might be passed safely
        if (path === "default") {
             const defaultFrame = game.settings.get("phils-token-studio", "defaultFrame");
             this.uiState.token.frame.path = defaultFrame;
             this._loadFrameImage(defaultFrame);
        } else {
             this.uiState.token.frame.path = path;
             this._loadFrameImage(path);
        }
        this.render();
    }

    async _onClearPopout(event, target) {
        if (!this.popOutBuffer) return;
        const ctx = this.popOutBuffer.getContext("2d");
        ctx.clearRect(0, 0, this.popOutBuffer.width, this.popOutBuffer.height);
        this.drawTokenSandwich();
    }

    async _onSaveToken(event, target) {
        if (!this.canvasToken) return;
        
        try {
            // ui.notifications.info("Updating Token...");

            // 1. Upload Source if it's local (dropped/pasted)
            if (this._isLocalSource && this.originalImage) {
                // We need to convert sourceImage (img tag) to Blob, 
                // but since it's a DOM element, we can draw it to a temp canvas or fetch it
                // Easiest is to re-fetch the src since it's a data URL
                const res = await fetch(this.originalImage.src);
                const blob = await res.blob();
                const fileName = `source_${this.actor.id}_${Date.now()}.webp`; // Store as webp or original? Webp is safe.
                const file = new File([blob], fileName, { type: blob.type });
                
                const upPath = await this._uploadFile(file);
                this.uiState.sourcePath = upPath;
                this._isLocalSource = false;
            }

            const newScale = this.uiState.dynamicRingScale || 1.0;
            
            // Create Export Blob using Temp Canvas
            // This ensures we can skip the ring if needed
            const size = Math.round(this.resolution * newScale);
            const tempC = document.createElement("canvas");
            tempC.width = size;
            tempC.height = size;
            const tempCtx = tempC.getContext("2d");
            
            // Draw Scoped
            this.drawTokenSandwich(tempCtx, true);

            const blob = await new Promise(resolve => tempC.toBlob(resolve, "image/webp", 0.9));
            const fileName = `token_${this.actor.id}_${Date.now()}.webp`;
            const file = new File([blob], fileName, { type: "image/webp" });
            const result = await this._uploadFile(file);
            
            // Update Prototype & Active Tokens
            const updates = {
                "prototypeToken.texture.src": result
            };
            
            // Get Frame Scale (default 1.0)
            const fScale = this.uiState.token.frame.transforms.scale || 1.0;

            // Auto-Configure Dynamic Token Ring if enabled
            if (this.uiState.useFoundryRing) {
                 // DYNAMIC RING MODE:
                 // "Both values must match" - User Request
                 
                 // 1. Enable Ring
                 updates["prototypeToken.ring.enabled"] = true;
                 
                 // 2. Set Subject Scale (to match our padding)
                 updates["prototypeToken.ring.subject.scale"] = newScale;
                 
                 // 3. Set Global Scale to MATCH Subject Scale
                 // User manual testing confirms this is required for correct fit.
                 updates["prototypeToken.texture.scaleX"] = newScale;
                 updates["prototypeToken.texture.scaleY"] = newScale;
                 
            } else {
                 // BAKED RING MODE:
                 // 1. Disable Ring
                 updates["prototypeToken.ring.enabled"] = false;
                 
                 // 2. Apply Scale to Global Token
                 // This makes the whole image (Ring + Art) larger so the Ring (which is smaller in the image) matches the grid.
                 updates["prototypeToken.texture.scaleX"] = newScale;
                 updates["prototypeToken.texture.scaleY"] = newScale;
            }
            
            await this.actor.update(updates);
            
            const activeTokens = this.actor.getActiveTokens();
            const tokenUpdates = activeTokens.map(t => {
                const update = { 
                    _id: t.id, 
                    "texture.src": result
                };
                
                if (this.uiState.useFoundryRing) {
                    update["ring.enabled"] = true;
                    update["ring.subject.scale"] = newScale;
                    update["texture.scaleX"] = newScale;
                    update["texture.scaleY"] = newScale;
                } else {
                    update["ring.enabled"] = false;
                    update["texture.scaleX"] = newScale;
                    update["texture.scaleY"] = newScale;
                }
                return update;
            });
            
            if (tokenUpdates.length > 0) await canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
            
            // ui.notifications.info("Token Updated!");
            
            // Save state but don't close
            await this.actor.setFlag("phils-token-studio", "lastState", this.uiState);
            
        } catch (err) {
            console.error(err);
            ui.notifications.error("Token Update Failed.");
        }
    }
    
    async _onApplyChroma(event, target) {
        
        const view = this.uiState.activeView;
        let buffer;
        
        // Target Logic
        if (view === 'token') {
             buffer = (this.uiState.activeLayer === 'background') ? this.backgroundBuffer : this.tokenBuffer;
        } else {
             buffer = this.avatarBuffer;
        }
        
        if (!buffer) return ui.notifications.warn("No source image loaded for this layer.");
        
        // Save State for Undo
        this._saveHistory();
        
        const colorInput = this.element.querySelector("#chroma-color");
        const toleranceInput = this.element.querySelector("#chroma-tolerance");
        
        const hex = colorInput.value;
        const tolerance = parseInt(toleranceInput.value);
        
        // Convert Hex to RGB
        const rTarget = parseInt(hex.substring(1,3), 16);
        const gTarget = parseInt(hex.substring(3,5), 16);
        const bTarget = parseInt(hex.substring(5,7), 16);
        
        const ctx = buffer.getContext("2d");
        const width = buffer.width;
        const height = buffer.height;
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            // alpha data[i+3]
            
            // Simple Euclidean distance
            const dist = Math.sqrt(
                Math.pow(r - rTarget, 2) + 
                Math.pow(g - gTarget, 2) + 
                Math.pow(b - bTarget, 2)
            );
            
            if (dist < tolerance) {
                data[i+3] = 0; // Transparent
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Update View
        // Update View
        this.drawAll();
        // ui.notifications.info(`Chroma Key Applied to ${view}.`);
    }
    
    async _onSaveAvatar(event, target) {
        if (!this.canvasAvatar) return;
        
        try {
            // ui.notifications.info("Updating Avatar...");
            const blob = await new Promise(resolve => this.canvasAvatar.toBlob(resolve, "image/webp", 0.9));
            const fileName = `avatar_${this.actor.id}_${Date.now()}.webp`;
            const file = new File([blob], fileName, { type: "image/webp" });
            const result = await this._uploadFile(file);
            
            // Update Actor Image
            await this.actor.update({ "img": result });

            // ui.notifications.info("Avatar Updated!");
             // Save state but don't close
            await this.actor.setFlag("phils-token-studio", "lastState", this.uiState);

        } catch (err) {
            console.error(err);
            ui.notifications.error("Avatar Update Failed.");
        }
    }

    _onDeleteBackground(event) {
        if (this.uiState.token.background) {
            this.uiState.token.background.active = false;
            this.uiState.token.background.path = null;
        }
        this.backgroundBuffer = null;
        this.drawToken();
        this.render();
    }

    _onUploadPortrait(event) {
        this.uiState.activeView = 'token'; 
        this.uiState.activeLayer = 'character'; // Force character layer
        this._onPickSourceFile();
    }

    _onChangeAvatarRatio(event) {
        const val = parseFloat(event.target.value);
        this.uiState.avatarAspectRatio = val;
        this.drawAvatar(); 
    }

    _onChangeRingScale(event) {
        const val = parseFloat(event.target.value);
        const oldScale = this.uiState.dynamicRingScale || 1.0;
        this.uiState.dynamicRingScale = val;
        
        // Resize PopOut Buffer if it exists
        if (this.popOutBuffer) {
             const oldSize = this.popOutBuffer.width;
             const newSize = Math.round(this.resolution * val);
             
             // Create temp buffer to save content
             const temp = document.createElement("canvas");
             temp.width = oldSize;
             temp.height = oldSize;
             const tCtx = temp.getContext("2d");
             tCtx.drawImage(this.popOutBuffer, 0, 0);
             
             // Resize Main Buffer
             this.popOutBuffer.height = newSize;
             const ctx = this.popOutBuffer.getContext("2d");
             
             // Redraw centered
             const off = (newSize - oldSize) / 2;
             ctx.drawImage(temp, off, off);
        }

        // Resize Paint Buffer (Same Logic)
        if (this.paintBuffer) {
             const oldSize = this.paintBuffer.width;
             const newSize = Math.round(this.resolution * val);
             
             const temp = document.createElement("canvas");
             temp.width = oldSize;
             temp.height = oldSize;
             const tCtx = temp.getContext("2d");
             tCtx.drawImage(this.paintBuffer, 0, 0);
             
             this.paintBuffer.width = newSize;
             this.paintBuffer.height = newSize;
             const ctx = this.paintBuffer.getContext("2d");
             
             const off = (newSize - oldSize) / 2;
             ctx.drawImage(temp, off, off);
        }
        
        this.drawToken(); 
    }
    
    _onToggleFoundryRing(event) {
        this.uiState.useFoundryRing = event.target.checked;
        this.drawAll(); // Re-draw to show/hide the dashed guide
    }

    async _uploadFile(file) {
        const parts = this.storagePath.split("/");
        let currentPath = "";
        
        // Use correct namespace
        const FP = foundry.applications?.apps?.FilePicker || FilePicker;

        for (const part of parts) {
            if (!part) continue;
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            try {
                await FP.createDirectory("data", currentPath);
            } catch (e) {}
        }

        // Force Silence: Trap notifications
        const originalInfo = ui.notifications.info;
        ui.notifications.info = () => {}; // Mute

        try {
            const res = await FP.upload("data", this.storagePath, file, { notify: false });
            // Manually log but don't spam UI
            console.log(`Phils Quick Tokens | Uploaded ${file.name} to ${res.path}`);
            return res.path;
        } finally {
            ui.notifications.info = originalInfo; // Restore
        }
    }
    
    async _onSaveDefault() {
         // ui.notifications.info("Defaults saved.");
    }

    /* ------------------------------------------- */
    /*  DRAFT PERSISTENCE                          */
    /* ------------------------------------------- */

    async _saveDraftState() {
        if (!this.actor) return;
        // ui.notifications.notify("Saving Draft State..."); // Silenced

        try {
            const drafts = {};
            const timestamp = Date.now();

            // 1. Save Token Buffer (Eraser State)
            if (this.tokenBuffer) {
                const blob = await new Promise(r => this.tokenBuffer.toBlob(r, "image/webp", 0.9));
                const file = new File([blob], `draft_token_${this.actor.id}.webp`, { type: "image/webp" });
                const path = await this._uploadFile(file);
                drafts.token = path;
            }

            // 1b. Save Frame Buffer
            if (this.frameBuffer) {
                 const blob = await new Promise(r => this.frameBuffer.toBlob(r, "image/webp", 0.9));
                 const file = new File([blob], `draft_frame_${this.actor.id}.webp`, { type: "image/webp" });
                 const path = await this._uploadFile(file);
                 drafts.frame = path;
            }

            // 1c. Save Background Buffer (New)
            if (this.backgroundBuffer) {
                 const blob = await new Promise(r => this.backgroundBuffer.toBlob(r, "image/webp", 0.9));
                 const file = new File([blob], `draft_bg_${this.actor.id}.webp`, { type: "image/webp" });
                 const path = await this._uploadFile(file);
                 drafts.background = path;
            }

            // 2. Save PopOut Buffer (PopOut State)
            if (this.popOutBuffer) {
                 // Optimization: Only save if it has content? 
                 // For now save always to clear old ones if empty.
                 const blob = await new Promise(r => this.popOutBuffer.toBlob(r, "image/webp", 0.9));
                 const file = new File([blob], `draft_popout_${this.actor.id}.webp`, { type: "image/webp" });
                 const path = await this._uploadFile(file);
                 drafts.popout = path;
            }

            // 3. Save Paint Buffer (Paint State)
            if (this.paintBuffer && this._bufferHasContent(this.paintBuffer)) {
                 const blob = await new Promise(r => this.paintBuffer.toBlob(r, "image/webp", 0.9));
                 const file = new File([blob], `draft_paint_${this.actor.id}.webp`, { type: "image/webp" });
                 const path = await this._uploadFile(file);
                 drafts.paint = path;
            }

            // Update State
            this.uiState.drafts = drafts;
            
            // Save BOTH flags to ensure consistency
            // 'drafts' stores the paths to the WEBP files
            // 'lastState' stores the config (transforms, background path, etc)
            const p1 = this.actor.setFlag("phils-token-studio", "drafts", this.uiState.drafts);
            const p2 = this.actor.setFlag("phils-token-studio", "lastState", this.uiState);
            
            await Promise.all([p1, p2]);
            
            console.log("Phils Quick Tokens | Draft State & Configuration Saved.");
            // ui.notifications.info("Draft State Saved.");
            
        } catch (err) {
            console.error("Phils Quick Tokens | Failed to save draft:", err);
        }
    }

    async _loadDraftState() {
        if (!this.uiState.drafts) return;
        console.log("Phils Quick Tokens | Loading Drafts:", this.uiState.drafts);
        
        const loadBuffer = async (src, targetBuffer) => {
            if (!src || !targetBuffer) return;
            try {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = src + "?t=" + Date.now(); // Bust cache
                await img.decode();
                
                // Clear and Draw
                const ctx = targetBuffer.getContext("2d");
                ctx.clearRect(0, 0, targetBuffer.width, targetBuffer.height);
                ctx.drawImage(img, 0, 0, targetBuffer.width, targetBuffer.height);
            } catch (e) {
                console.error("Failed to load draft:", src, e);
            }
        };

        if (this.uiState.drafts.token && this.tokenBuffer) {
            await loadBuffer(this.uiState.drafts.token, this.tokenBuffer);
        }
        
        // Load Frame Draft (Must target frameBuffer, which exists if frame path exists)
        if (this.uiState.drafts.frame && this.frameBuffer) {
             await loadBuffer(this.uiState.drafts.frame, this.frameBuffer);
        }

        // Load Background Draft
        if (this.uiState.drafts.background && this.backgroundBuffer) {
             await loadBuffer(this.uiState.drafts.background, this.backgroundBuffer);
        }

        if (this.uiState.drafts.popout && this.popOutBuffer) {
            await loadBuffer(this.uiState.drafts.popout, this.popOutBuffer);
        }

        if (this.uiState.drafts.paint && this.paintBuffer) {
            await loadBuffer(this.uiState.drafts.paint, this.paintBuffer);
        }
        
        this.drawAll();
        // ui.notifications.notify("Draft State Restored.");
    }
    
    static async submit(event, form, formData) {
    }
}
