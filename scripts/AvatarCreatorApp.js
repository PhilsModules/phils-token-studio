const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AvatarCreatorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor) {
    super({
        tag: 'form',
        id: 'phils-avatar-creator',
        classes: ['pac-avatar-creator'],
        position: {
          width: 900,
          height: 700,
          centered: true
        },
        window: {
          title: 'Avatar Creator',
          icon: 'fas fa-user-circle',
          resizable: true
        },
        actions: {
            'zoom-in': function() { this._adjustZoom(0.1); },
            'zoom-out': function() { this._adjustZoom(-0.1); },
            'reset-view': function() { this.viewport = { x:0, y:0, scale:1 }; this._draw(); },
            'upload-image': function() { this._triggerImageUpload(); },
            'save-avatar': function() { this._saveAvatar(); }
        }
    });
    this.actor = actor;
    
    // Canvas State
    this.canvas = null;
    this.ctx = null;
    this.viewport = { x: 0, y: 0, scale: 1 };
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };
    
    // Layers State
    this.layers = [
      { id: 'background', type: 'color', visible: true, color: '#ffffff', image: null, opacity: 0 }, // Transparent default
      { id: 'character', type: 'image', visible: true, image: null, x: 0, y: 0, scale: 1, opacity: 1 },
      { id: 'frame', type: 'image', visible: true, image: null, opacity: 1 }
    ];
    
    this.activeLayerId = 'character';
  }

  static PARTS = {
    form: {
      template: 'modules/phils-avatar-creator/templates/avatar-creator.hbs'
    }
  };

  static DEFAULT_OPTIONS = {};

  async _prepareContext(options) {
    const frames = [
        { id: 'circle', name: 'Golden Circle', src: 'modules/phils-avatar-creator/assets/frames/circle.svg' },
        { id: 'square', name: 'Silver Square', src: 'modules/phils-avatar-creator/assets/frames/square.svg' },
        { id: 'hex', name: 'Cyber Hex', src: 'modules/phils-avatar-creator/assets/frames/hex.svg' }
    ];

    return {
      actor: this.actor,
      layers: this.layers,
      activeLayer: this.activeLayerId,
      frames: frames,
      isFrameLayer: this.activeLayerId === 'frame'
    };
  }

  _onRender(context, options) {
    // Init Canvas
    this._initCanvas();
    
    // Default Frame
    if (!this.layers.find(l => l.id === 'frame').image) {
         this._loadImage('modules/phils-avatar-creator/assets/frames/circle.svg').then(img => {
            const frameLayer = this.layers.find(l => l.id === 'frame');
            frameLayer.image = img;
            this._draw();
         });
    }

    // Load initial actor image if present
    if (this.actor.img && !this.layers.find(l => l.id === 'character').image) {
        this._loadImage(this.actor.img).then(img => {
            const charLayer = this.layers.find(l => l.id === 'character');
            charLayer.image = img;
             // Auto-fit character to frame
            this._fitToFrame(img);
            this._draw();
        });
    }

    // Drag and Drop (Canvas)
    const wrapper = this.element.querySelector('#pac-canvas-wrapper');
    wrapper.addEventListener('wheel', this._onWheel.bind(this));
    wrapper.addEventListener('mousedown', this._onMouseDown.bind(this));
    window.addEventListener('mousemove', this._onMouseMove.bind(this));
    window.addEventListener('mouseup', this._onMouseUp.bind(this));
    
    // File Drop
    this.element.addEventListener('drop', this._onFileDrop.bind(this));
    this.element.addEventListener('dragover', e => e.preventDefault());
    
    // HTML Listeners
    this.element.querySelectorAll('.pac-layer-item').forEach(el => {
        el.addEventListener('click', (e) => {
            this.activeLayerId = e.currentTarget.dataset.layer;
            this.render(); // Re-render to update UI (properties panel)
        });
    });
    
    this.element.querySelectorAll('.pac-frame-select').forEach(el => {
        el.addEventListener('click', (e) => {
            const src = e.currentTarget.dataset.src;
            this._loadImage(src).then(img => {
                const layer = this.layers.find(l => l.id === 'frame');
                layer.image = img;
                this._draw();
            });
        });
    });
  }
  
  _fitToFrame(img) {
      // Basic logic to scale image to fit 512x512 roughly
      const scale = Math.min(512 / img.width, 512 / img.height);
      const layer = this.layers.find(l => l.id === 'character');
      layer.scale = scale;
  }

  _initCanvas() {
    const wrapper = this.element.querySelector('#pac-canvas-wrapper');
    if (!wrapper) return;
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512; // Internal resolution
    this.canvas.height = 512;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.objectFit = 'contain';
    
    wrapper.innerHTML = '';
    wrapper.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    this._draw();
  }

  _draw() {
    if (!this.ctx) return;
    
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    
    // Apply Viewport (Global Zoom/Pan for the "Camera")
    this.ctx.save();
    this.ctx.translate(width/2, height/2);
    this.ctx.scale(this.viewport.scale, this.viewport.scale);
    this.ctx.translate(-width/2 + this.viewport.x, -height/2 + this.viewport.y);

    // Draw Layers
    for (const layer of this.layers) {
        if (!layer.visible) continue;
        this.ctx.globalAlpha = layer.opacity;
        
        if (layer.type === 'color') {
            this.ctx.fillStyle = layer.color;
            this.ctx.fillRect(0, 0, width, height);
        } else if (layer.image) {
            this.ctx.save();
            // Per-layer transformations (e.g. moving the character inside the frame)
            if (layer.id === 'character') {
                 this.ctx.translate(width/2 + layer.x, height/2 + layer.y);
                 this.ctx.scale(layer.scale, layer.scale);
                 this.ctx.translate(-width/2, -height/2);
            }
            this.ctx.drawImage(layer.image, 0, 0, width, height);
            this.ctx.restore();
        }
    }
    
    this.ctx.restore();
  }

  /* --- Interaction Handlers --- */
  
  _onWheel(event) {
      event.preventDefault();
      // If holding shift/ctrl, maybe rotate? For now just scale viewport or active layer?
      // User requirement: "Zoom in and out bei dem Charakter artwork"
      // Let's decide: Wheel zooms the VIEW (working area), Ctrl+Wheel zooms the ACTIVE LAYER?
      // Or simple mode -> Wheel zooms View.
      
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      
      // If modifying character layer specifically
      if (this.activeLayerId === 'character') {
          const layer = this.layers.find(l => l.id === 'character');
          layer.scale *= delta;
      } else {
          this.viewport.scale *= delta;
      }
      this._draw();
  }

  _onMouseDown(event) {
      this.isDragging = true;
      this.lastMouse = { x: event.clientX, y: event.clientY };
  }

  _onMouseMove(event) {
      if (!this.isDragging) return;
      const dx = event.clientX - this.lastMouse.x;
      const dy = event.clientY - this.lastMouse.y;
      this.lastMouse = { x: event.clientX, y: event.clientY };

      // Move Active Layer or Viewport
      if (this.activeLayerId === 'character') {
          // Adjust for viewport scale to keep 1:1 mouse movement feel
          const layer = this.layers.find(l => l.id === 'character');
          layer.x += dx / this.viewport.scale;
          layer.y += dy / this.viewport.scale;
      } else {
           this.viewport.x += dx / this.viewport.scale;
           this.viewport.y += dy / this.viewport.scale;
      }
      this._draw();
  }

  _onMouseUp() {
      this.isDragging = false;
  }
  
  _adjustZoom(amount) {
      this.viewport.scale += amount;
      this._draw();
  }

  /* --- File / logic --- */

  _triggerImageUpload() {
      const fp = new FilePicker({
          type: "image",
          callback: (path) => {
              this._loadImage(path).then(img => {
                  const layer = this.layers.find(l => l.id === this.activeLayerId) || this.layers.find(l => l.id === 'character');
                  layer.image = img;
                  this._draw();
              });
          }
      });
      fp.browse();
  }
  
  async _onFileDrop(event) {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
           this._loadImage(e.target.result).then(img => {
               // Assign to character layer by default on drop
               const layer = this.layers.find(l => l.id === 'character');
               layer.image = img;
               this._draw();
           });
      };
      reader.readAsDataURL(file);
  }

  _loadImage(src) {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
      });
  }

  /* --- Save Logic --- */
  
  async _saveAvatar() {
      // 1. Render Scene to Blob
      // Reset viewport for the "Capture" to ensure we get exactly the 512x512 result (or simply draw to a temp canvas)
      // Actually, we want to save exactly what is INSIDE the canvas bounds (0,0 to width,height).
      // My _draw() function applies viewport transform globally. 
      // To save, we should temporarily reset viewport, draw, save, then restore.
      
      const originalViewport = { ...this.viewport };
      this.viewport = { x: 0, y: 0, scale: 1 };
      this._draw();
      
      this.canvas.toBlob(async (blob) => {
          // Restore View
          this.viewport = originalViewport;
          this._draw();
          
          if (!blob) return ui.notifications.error("Failed to generate image.");

          // 2. Upload to Server
          const fileName = `${this.actor.name.replace(/[^a-z0-9]/gi, '_')}_avatar.png`;
          const file = new File([blob], fileName, { type: 'image/png' });
          
          // Use FilePicker API to upload
          try {
             // Create 'avatars' folder if needed? Foundry's upload usually handles simple paths or we pick a dedicated one.
             // We'll upload to "avatars" folder at root.
             const path = "avatars"; 
             // Note: FilePicker.upload(source, path, file)
             // We need to know the origin source (usually 'data').
             await FilePicker.upload("data", path, file);
             
             const finalPath = `${path}/${fileName}`;
             
             // 3. Update Actor
             await this.actor.update({
                 img: finalPath,
                 "prototypeToken.texture.src": finalPath
             });
             
             ui.notifications.info(`Avatar saved and applied to ${this.actor.name}!`);
             this.close();
             
          } catch (err) {
              console.error(err);
              ui.notifications.error("Upload failed: " + err.message);
          }
          
      }, 'image/png');
  }
}
