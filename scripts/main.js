import { QuickTokenStudio } from "./token-studio.js";

const MODULE_ID = "phils-token-studio";

Hooks.once("init", () => {
    console.log("Phils Token Studio | Initializing");

    // storagePath (String): Default "phils-token-studio/user-tokens".
    game.settings.register(MODULE_ID, "storagePath", {
        name: "Storage Path",
        hint: "Where uploaded source images and generated tokens will be saved.",
        scope: "world",
        config: true,
        type: String,
        default: "phils-token-studio/user-tokens"
    });

    // outputResolution (Number): Choices {128, 256, 512, 1024, 2048}. Default 512.
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

    // defaultFrame (String): Path to a default ring image.
    game.settings.register(MODULE_ID, "defaultFrame", {
        name: "Default Frame",
        hint: "Path to the default token frame image.",
        scope: "world",
        config: true,
        type: String,
        filePicker: "image",
        default: `modules/${MODULE_ID}/assets/frames/circle.svg` // Adjust default path as needed
    });

    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });
});

/**
 * Add "Token Studio" button to Actor Sheet Header
 */
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
    // Only for actors
    if (!sheet.object || !(sheet.object instanceof Actor)) return;

    buttons.unshift({
        label: "Token Studio",
        class: "phils-token-studio",
        icon: "fas fa-user-circle",
        onclick: () => {
            new QuickTokenStudio({ actor: sheet.object }).render(true);
        }
    });
});

// Pro tip: Support Generic Applications ?
// If generic Application headers are needed, we'd hook 'getApplicationHeaderButtons'
// but usually Token Studio is contextual to an Actor. 
// We generally stick to ActorSheet for this specific requirement.
