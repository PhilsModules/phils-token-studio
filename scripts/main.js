import { QuickTokenStudio } from "./token-studio.js";

const MODULE_ID = "phils-token-studio";

Hooks.once("init", () => {
    console.log("Phils Token Studio | Initializing");

    game.settings.register(MODULE_ID, "storagePath", {
        name: "Storage Path",
        hint: "Where uploaded source images and generated tokens will be saved.",
        scope: "world",
        config: true,
        type: String,
        default: "phils-token-studio/user-tokens"
    });

    game.settings.register(MODULE_ID, "outputResolution", {
        name: "Output Resolution",
        hint: "Resolution of the generated token (width/height in pixels).",
        scope: "client",
        config: true,
        type: Number,
        choices: {
            128: "128px",
            256: "256px",
            512: "512px",
            1024: "1024px",
            2048: "2048px"
        },
        default: 512
    });

    game.settings.register(MODULE_ID, "defaultFrame", {
        name: "Default Frame",
        hint: "Path to the default token frame image.",
        scope: "world",
        config: true,
        type: String,
        filePicker: "image",
        default: `modules/${MODULE_ID}/assets/frames/circle.svg`
    });

    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });
});

/**
 * Handle Global Context Menu Rendering
 * Catches the "Three Dots" menu on dnd5e and other systems.
 */
/**
 * Handle Global Context Menu Rendering
 * Catches the "Three Dots" menu on dnd5e and other systems.
 */
Hooks.on("renderContextMenu", (menu, html, data) => {
    // 1. Verify this is a relevant menu
    // 1. Verify this is a relevant menu
    // Browser Debug Finding: D&D 5e context menu is a <nav> with <menu class="context-items">
    
    // Check for Text ("Sheet", "Token", "Artwork", "Configure") OR Icons (Gear, User, Image)
    const contextItems = html.find(".context-item");
    const itemTexts = contextItems.map((i, el) => el.innerText.trim()).get();
    
    const isSheetMenu = itemTexts.some(t => t.includes("Sheet") || t.includes("Token") || t.includes("Artwork") || t.includes("Configure")) ||
                        html.find(".fa-gear, .fa-circle-user, .fa-image, .fa-address-card").length > 0;

    // Strict check for D&D 5e special class (Confirmed in Debug: "dnd5e2")
    const isDnD5eMenu = html.hasClass("dnd5e2");

    if (!isSheetMenu && !isDnD5eMenu) return;

    // 2. Identify the Actor
    let app = null;

    // 'menu.element' is the DOM Element (or jQuery) to which the ContextMenu is attached.
    // In D&D 5e, this is the BUTTON with class="header-control ... context"
    let target = menu.element ? (menu.element instanceof $ ? menu.element[0] : menu.element) : null;

    if (target) {
        // --- STRATEGY: Direct DOM Containment & ID Parsing ---
        // We know from debug that the sheet is a <form ... class="dnd5e2 actor ...">
        // It might NOT have the 'window-app' class in the way we expect, or ui.windows might be tricky with AppV2.
        
        // 1. Find the Sheet Element (Form or Window)
        const sheetElement = target.closest("form.dnd5e2.actor, .window-app, .app.sheet");
        
        if (sheetElement) {
            // 2. Try to map to an Application instance
            // Check standard IDs
            if (sheetElement.id) {
                // Try numeric (legacy)
                const numericId = parseInt(sheetElement.dataset?.appid || sheetElement.id.split('-').pop());
                if (!isNaN(numericId)) app = ui.windows[numericId];
                
                // Try string ID (AppV2)
                if (!app) app = Object.values(ui.windows).find(w => w.id === sheetElement.id);
            }
            
            // 3. If App instance missing, parse DOM for Actor data (Robust Fallback)
            if (!app) {
                // Check ID: "CharacterActorSheet-Actor-UUID" or "actor-123"
                // Debug showed: id="CharacterActorSheet-Actor-PFFIw7T5Sps0w6zK"
                const parts = sheetElement.id.split("-");
                
                // Look for "Actor" segment and take the NEXT segment as ID
                const actorIndex = parts.indexOf("Actor");
                if (actorIndex !== -1 && parts[length - 1] !== "Actor") {
                    const potentialId = parts[actorIndex + 1];
                    if (potentialId) app = { object: game.actors.get(potentialId) };
                }
                
                // Legacy: "actor-123"
                if (!app && parts[0] === "actor") {
                    if (parts[1]) app = { object: game.actors.get(parts[1]) };
                }
            }
        }
    }

    // Safety: If we still don't have an app, check for global "current" sheet if valid (Risky, but maybe last resort?)
    // No, better to fail safe.

    if (!app || !app.object || !(app.object instanceof Actor)) return;

    // 3. Inject Button
    // The menu html is <nav ...><menu class="context-items">...</menu></nav>
    // We need to append to .context-items
    if (html.find(".phils-token-studio-item").length > 0) return;

    const li = $(`<li class="context-item phils-token-studio-item">
        <i class="fas fa-user-pen fa-fw"></i>
        <span>Token Studio</span>
    </li>`);

    li.on("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        new QuickTokenStudio({ actor: app.object }).render(true);
        ui.context.close();
    });

    // In D&D 5e v3, the list is inside <menu class="context-items">
    const list = html.find("menu.context-items, ul.context-items").first();
    if (list.length) {
        list.prepend(li);
    } else {
        // Fallback for older systems
        html.prepend(li);
    }
});

Hooks.once('ready', async () => {
    // Start the Universal Injector
    const injector = new UniversalButtonInjector();
    injector.start();
});


/**
 * Universal Button Injector
 * Ensures button visibility on all systems.
 */
class UniversalButtonInjector {
    constructor() {
        this.observer = null;
        this.injectedApps = new WeakSet();
    }

    start() {
        console.log("Phils Token Studio | Universal Injector Started");

        // We bind to both standard hooks AND the observer for maximum coverage
        const hookHandler = (app, html) => this.attemptInjection(app, html);

        Hooks.on('renderActorSheet', hookHandler);
        
        // Observer for ShadowDOM / Delayed Rendering / AppV2 / Unique Sheets
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    // 1. D&D 5e Context Menu Detection (The hook doesn't fire for this one)
                    if (node.id === "context-menu" || node.classList.contains("dnd5e2")) {
                        this.handleDnD5eContextMenu(node);
                        continue;
                    }

                    if (node.classList.contains('window-app') || node.tagName === 'FVTT-APPLICATION' || node.classList.contains('application')) {
                        this.inspectNode(node);
                    } else {
                        const windows = node.querySelectorAll?.('.window-app, fvtt-application, .application');
                        if (windows?.length) windows.forEach(w => this.inspectNode(w));
                    }
                }
            }
        });
        
        // Observe body for new windows
        this.observer.observe(document.body, { childList: true, subtree: true });
        
        // Also run on currently open windows
        Object.values(ui.windows).forEach(w => {
            if (w.element) this.attemptInjection(w, w.element);
        });
    }

    /**
     * Special Handler for D&D 5e AppV2 Context Menu
     * This menu is not a standard Application and does not trigger renderContextMenu.
     */
    handleDnD5eContextMenu(node) {
        // Critical Fix: Do not treat the Sheet Form as a Context Menu
        if (node.tagName === "FORM") return;
        if (node.classList.contains("window-app")) return;

        const $menu = $(node);
        if (!$menu.hasClass("dnd5e2")) return;
        
        // Check if it's the "Toggle Controls" menu
        // We can check content for "Configure Sheet" or similar items
        const contextItems = $menu.find(".context-item");
        const itemTexts = contextItems.map((i, el) => el.innerText.trim()).get();
        const isSheetMenu = itemTexts.some(t => t.includes("Sheet") || t.includes("Token") || t.includes("Artwork") || t.includes("Configure")) ||
                            $menu.find(".fa-gear, .fa-circle-user, .fa-image, .fa-id-card").length > 0;

        if (!isSheetMenu) return;

        // Find the App - The menu is floating, but we can look at the active element or find the toggle button
        // In this case, `ui.context.menu` refers to this menu, but the `target` (button) is better found via DOM logic.
        // The D&D 5e menu is usually positioned near the button.
        
        // The menu popover API might give a clue, but let's try the "last clicked toggle" approach or similar?
        // STRATEGY: Find the sheet that owns the active context menu button
        // 1. Try document.activeElement (The user just clicked it)
        let activeToggle = document.activeElement && document.activeElement.closest(".header-control[data-action='toggleControls']") 
            ? document.activeElement.closest(".header-control") 
            : null;
            
        // 2. Fallback to selector if focus was lost
        if (!activeToggle) {
            activeToggle = document.querySelector(".header-control[data-action='toggleControls'][aria-expanded='true']");
        }
        
        // 3. Last resort: check for ANY toggle button that has the 'active' class (some themes use this)
        if (!activeToggle) {
             activeToggle = document.querySelector(".header-control[data-action='toggleControls'].active");
        }
        
        let app = null;

        if (activeToggle) {
            // Found the trigger button! Now find its parent sheet.
            const sheetEl = activeToggle.closest(".window-app, form, .application, fvtt-application");
            
            if (sheetEl) {
                // Try to find the App instance in ui.windows
                // 1. By ID match
                app = Object.values(ui.windows).find(w => w.id === sheetEl.id);
                
                // 2. By element reference
                if (!app) {
                    app = Object.values(ui.windows).find(w => w.element && w.element[0] === sheetEl);
                }
                
                // 3. Fallback: Parse ID for Actor UUID (Robust for unlinked tokens)
                if (!app && sheetEl.id) {
                     if (sheetEl.id.includes("Scene") && sheetEl.id.includes("Token")) {
                         // Unlinked Token Actor: Construct UUID
                         const parts = sheetEl.id.split("-");
                         const sceneIdx = parts.indexOf("Scene");
                         const tokenIdx = parts.indexOf("Token");
                         
                         if (sceneIdx !== -1 && tokenIdx !== -1) {
                             const sceneId = parts[sceneIdx + 1];
                             const tokenId = parts[tokenIdx + 1];
                             const scene = game.scenes.get(sceneId);
                             const token = scene?.tokens.get(tokenId);
                             if (token && token.actor) {
                                 app = { object: token.actor };
                             }
                         }
                     } else if (sheetEl.id.includes("Actor")) {
                         // Linked Actor
                         const parts = sheetEl.id.split("-");
                         const actorIdx = parts.indexOf("Actor");
                         if (actorIdx !== -1 && parts[actorIdx + 1]) {
                             app = { object: game.actors.get(parts[actorIdx + 1]) };
                         }
                     }
                }
            }
        }

        // FALLBACK STRATEGY: Top-most Actor Sheet
        if (!app) {
            const sheets = Object.values(ui.windows).filter(w => {
                const doc = w.document || w.object;
                return doc && (doc instanceof Actor || (doc.actor instanceof Actor));
            });
            
            // Sort by z-index (Highest first) using DOM COMPUTED STYLE for reliability
            sheets.sort((a, b) => {
                const elA = a.element && a.element[0] ? a.element[0] : null;
                const elB = b.element && b.element[0] ? b.element[0] : null;
                
                const zA = elA ? parseFloat(window.getComputedStyle(elA).zIndex) : (a.position?.zIndex || 0);
                const zB = elB ? parseFloat(window.getComputedStyle(elB).zIndex) : (b.position?.zIndex || 0);
                
                return (zB || 0) - (zA || 0);
            });
            
            // Only pick if we found valid sheets
            if (sheets.length > 0) app = sheets[0];
        }

        if (app && app.object) {
            this._injectMenuItem($menu, app.object);
        }
    }

    _injectMenuItem($menu, actor) {
        if ($menu.find(".phils-token-studio-item").length > 0) return;

        const li = $(`<li class="context-item phils-token-studio-item">
            <i class="fas fa-user-pen fa-fw"></i>
            <span>Token Studio</span>
        </li>`);

        li.on("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            new QuickTokenStudio({ actor: actor }).render(true);
            // Close menu? It usually closes on click.
            $menu.remove(); // D&D 5e re-creates it, so removing/hiding is effectively closing.
        });

        const list = $menu.find("menu.context-items");
        if (list.length) list.prepend(li);
        else $menu.prepend(li);
    }

    inspectNode(node) {
        // Direct Lookup (Standard Apps)
        const numericId = parseInt(node.id.split('-').pop());
        if (!isNaN(numericId) && ui.windows[numericId]) {
            this.attemptInjection(ui.windows[numericId], $(node));
            return;
        }

        const windows = Object.values(ui.windows);
        
        // Search by Element Reference
        let app = windows.find(w => w.element && w.element[0] === node);
        
        // Search by ID Match
        if (!app) app = windows.find(w => w.id === node.id);

        if (app) {
            this.attemptInjection(app, $(node));
            return;
        }

        // Fallback: Synthetic App for AppV2 / Unique Sheets (Critical for D&D 5e)
        let doc = null;

        // Pattern A: Owned Item (Actor-ID-Item-ID)
        const ownedItemMatch = node.id.match(/Actor-([a-zA-Z0-9]{16})-Item-([a-zA-Z0-9]{16})/);
        if (ownedItemMatch) {
            const actor = game.actors.get(ownedItemMatch[1]);
            if (actor) doc = actor.items.get(ownedItemMatch[2]);
        }

        // Pattern B: Generic ID (End of String)
        if (!doc) {
            const parts = node.id.split('-');
            const potentialId = parts.pop();
            // Try identifying as Actor
            doc = game.actors.get(potentialId);

            // Retry with second-to-last part if implicit suffix exists (common in some modules)
            if (!doc && parts.length > 0) {
                const altId = parts.pop();
                doc = game.actors.get(altId);
            }
        }

        if (doc) {
            // Create a synthetic app wrapper so attemptInjection works
            this.attemptInjection({
                id: node.id,
                document: doc,
                element: $(node),
                object: doc, // For compatibility
                constructor: { name: "Syntheticv2App: " + node.classList[0] }
            }, $(node));
            return;
        }
    }

    attemptInjection(app, html) {
        if (!app) return;
        // Validate target: Must be an Actor Sheet and user must be owner
        if (!app.document && !app.object) return;
        const doc = app.document || app.object;
        
        // Strict check: Only Actors
        if (!(doc instanceof Actor)) return;
        if (!doc.isOwner) return;

        // RULE: If D&D 5e, NEVER inject via this generic header method. 
        // We rely EXCLUSIVELY on the Context Menu hook/observer.
        if (game.system.id === 'dnd5e') return;

        // Prevent duplicates
        if (this.injectedApps.has(app)) return;

        // Find window element
        const $window = html.closest ? html.closest('.window-app') : $(html).parents('.window-app');
        const $target = $window.length ? $window : $(html);

        // --- STRATEGY: Profile Image Injection (Priority 1) ---
        // If this works, we prefer it over cluttering the header
        const profileSuccess = this.injectProfileButton($target, doc);
        
        // In PF2e, duplicate buttons are annoying because the profile button works perfectly.
        // In D&D 5e, the profile button might be technically injected but hidden/unusable, 
        // causing the header button to be skipped if we are too strict.
        
        // RULE: If D&D 5e, NEVER inject header (Profile is also disabled). We rely on Context Menu.
        if (game.system.id === 'dnd5e') return;

        // Solution: Only skip header injection if we are in PF2e and Profile succeeded.
        // For other systems, we risk the double button to ensure at least one works.
        if (profileSuccess && game.system.id === 'pf2e') return;

        // --- STRATEGY: Header Injection (Priority 2) ---
        let header = $target.find('.window-header').first();
        let controls = $target.find('.window-controls').first();

        // Inner Header for D&D 5e / Custom Sheets
        if (!header.length && !controls.length) {
            header = $target.find('.window-content .window-header').first();
        }

        let container = null;
        if (header.length) container = header;
        else if (controls.length) container = controls;

        if (container && container.length > 0) {
            // Check for existing button
            if (container.find('.phils-token-studio-header-btn').length === 0) {
                 this.injectButton(app, container);
            }
        } else {
             console.warn("Phils Token Studio | Could not find header/controls for", app);
        }
    }

    injectButton(app, container) {
        // ... (keep existing implementation)
        // Find sibling to clone classes for perfect alignment
        const closeBtn = container.find('.close, .header-button.close').first();
        let btnClasses = "header-button control phils-token-studio-header-btn"; 
        
        if (closeBtn.length) {
            const siblingClasses = closeBtn.attr('class') || "";
            // Replace 'close' with our class, keep others like 'header-button'
            btnClasses = siblingClasses.replace('close', '').trim() + " phils-token-studio-header-btn";
        }

        const btn = $(`<a class="${btnClasses}" title="Token Studio" style="margin-right: 6px;">
            <i class="fas fa-user-pen"></i>
        </a>`);

        btn.click((ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            new QuickTokenStudio({ actor: app.document || app.object }).render(true);
        });

        if (closeBtn.length > 0) {
            closeBtn.before(btn);
        } else {
            container.prepend(btn); // Fallback
        }

        this.injectedApps.add(app);
    }
    
    injectProfileButton(html, actor) {
        // PER REPORT: In D&D 5e, the profile button is not desired (must be in menu).
        if (game.system.id === 'dnd5e') return false;

        const candidates = [
            "img[data-edit='img']", ".sheet-profile", ".profile-img", 
            ".player-image", "img.profile", ".actor-image", 
            "[data-action='editImage']", ".portrait", ".sidebar-image",
            "img.char-token"
        ];
        
        let imageElement = null;
        for (const selector of candidates) {
            const el = html.find(selector);
            if (el.length > 0) {
                imageElement = el.first();
                break;
            }
        }
        
        if (!imageElement || imageElement.length === 0) return false;
        
        const parent = imageElement.parent();
        // If already injected, we consider it a success
        if (parent.find(".token-studio-profile-button").length > 0) return true;
        
        if (parent.css("position") === "static") {
            parent.addClass("token-studio-launch-target");
        }
        
        const btn = $(`<div class="token-studio-profile-button" title="Token Studio">
            <i class="fas fa-user-pen"></i>
        </div>`);
        
        btn.on("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            new QuickTokenStudio({ actor: actor }).render(true);
        });
        
        parent.append(btn);
        return true;
    }
}
