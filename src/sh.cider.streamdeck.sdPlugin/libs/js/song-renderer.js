// ==========================================================================
//  Song Display Renderer
// ==========================================================================
//  This file contains the logic for rendering custom song displays on 
//  Stream Deck keys with more formatting options and better text handling.
// ==========================================================================

/**
 * SongRenderer - Handles custom rendering of song information on Stream Deck keys
 */
class SongRenderer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 144;
        this.canvas.height = 144;
        
        // Default configuration
        this.config = {
            fontSize: 16,
            fontFamily: 'Arial, sans-serif',
            textColor: '#FFFFFF',
            backgroundColor: '#000000',
            textAlign: 'center',
            scrollEnabled: true,
            scrollSpeed: 40,
            scrollPadding: 30,
            marqueePause: 2000,  // Pause duration in ms
            showArtist: true,
            showAlbum: false,
            maxLines: 2,
            lineHeight: 1.2
        };
        
        this.scrollPosition = 0;
        this.animationFrame = null;
        this.lastRenderTime = 0;
        this.isPaused = false;
        this.pauseStartTime = 0;
        this.songInfo = {
            title: '',
            artist: '',
            album: ''
        };
    }
    
    /**
     * Updates song information
     * @param {Object} songInfo Object containing title, artist, and album
     */
    updateSongInfo(songInfo) {
        this.songInfo = {
            title: songInfo.title || '',
            artist: songInfo.artist || '',
            album: songInfo.album || ''
        };
        
        // Reset scroll position when the song changes
        this.scrollPosition = 0;
        this.lastRenderTime = 0;
    }
    
    /**
     * Updates renderer configuration
     * @param {Object} config Configuration options
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    
    /**
     * Renders the song information to canvas
     * @returns {string} Data URL of the rendered canvas
     */
    render() {
        const { ctx, canvas, config, songInfo } = this;
        const { title, artist, album } = songInfo;
        const { 
            fontSize, fontFamily, textColor, backgroundColor,
            textAlign, scrollEnabled, showArtist, showAlbum,
            maxLines, lineHeight
        } = config;
        
        console.debug("[DEBUG] [SongRenderer] Rendering song:", title);
        
        // Clear the canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Setup text style
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = textAlign;
        ctx.textBaseline = 'middle';
        
        const centerX = canvas.width / 2;
        let startY = 50; // Start position for text
        
        // Prepare text lines
        let lines = [];
        
        if (title) {
            lines.push(title);
        }
        
        if (showArtist && artist) {
            lines.push(artist);
        }
        
        if (showAlbum && album) {
            lines.push(album);
        }
        
        // Fallback if no text to display
        if (lines.length === 0) {
            lines.push("No song playing");
        }
        
        console.debug("[DEBUG] [SongRenderer] Lines to render:", lines);
        
        // Limit to max lines
        lines = lines.slice(0, maxLines);
        
        // Calculate total height
        const totalHeight = fontSize * lineHeight * lines.length;
        startY = (canvas.height - totalHeight) / 2 + fontSize / 2;
        
        // Draw each line
        lines.forEach((line, index) => {
            const y = startY + index * fontSize * lineHeight;
            
            // If scrolling is enabled and text is too wide
            const textWidth = ctx.measureText(line).width;
            
            if (scrollEnabled && textWidth > canvas.width - 20) {
                // Handle scrolling text
                this.drawScrollingText(line, centerX, y, textWidth);
            } else {
                // Draw regular centered text
                ctx.fillText(line, centerX, y, canvas.width - 20);
            }
        });
        
        // Return the rendered image
        try {
            const dataUrl = canvas.toDataURL('image/png');
            console.debug("[DEBUG] [SongRenderer] Canvas rendered successfully");
            return dataUrl;
        } catch (error) {
            console.error("[ERROR] [SongRenderer] Failed to convert canvas to data URL:", error);
            return null;
        }
    }
    
    /**
     * Draws scrolling text animation
     * @param {string} text Text to scroll
     * @param {number} x X position
     * @param {number} y Y position
     * @param {number} textWidth Width of the text
     */
    drawScrollingText(text, x, y, textWidth) {
        const { ctx, canvas, config } = this;
        const { fontSize, scrollPadding = 30 } = config;
        
        // Only scroll if text is wider than canvas
        if (textWidth <= canvas.width - 20) {
            ctx.fillText(text, x, y, canvas.width - 20);
            return;
        }
        
        // Calculate scroll boundaries - make sure we have enough space for the full scroll
        const safeWidth = canvas.width - 20; // Visible area width with some padding
        const totalScrollWidth = textWidth + safeWidth + scrollPadding;
        const scrollOffset = this.scrollPosition % totalScrollWidth;
        
        // Draw the scrolling text
        ctx.save();
        
        // Create a clipping region to hide text outside the visible area
        ctx.beginPath();
        ctx.rect(10, y - fontSize, safeWidth, fontSize * 2);
        ctx.clip();
        
        // Position calculation:
        // Start at the right edge (safeWidth) minus the current scroll position
        const startPos = safeWidth - scrollOffset;
        
        // Draw the primary text instance
        ctx.fillText(text, startPos, y);
        
        // Draw a second instance of the text for seamless scrolling
        // When the first text starts to leave the screen, the second one follows
        if (startPos < safeWidth - textWidth) {
            ctx.fillText(text, startPos + textWidth + scrollPadding, y);
        }
        
        ctx.restore();
    }
    
    /**
     * Starts the rendering animation loop
     * @param {Function} callback Function to call with rendered image
     */
    startAnimation(callback) {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        const animate = (timestamp) => {
            // Update scroll position based on time delta and speed
            if (this.lastRenderTime === 0) {
                this.lastRenderTime = timestamp;
            }
            
            const delta = timestamp - this.lastRenderTime;
            this.scrollPosition += (delta / 1000) * this.config.scrollSpeed;
            this.lastRenderTime = timestamp;
            
            // Render and call callback with new image
            const image = this.render();
            if (callback && typeof callback === 'function') {
                callback(image);
            }
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        this.animationFrame = requestAnimationFrame(animate);
    }
    
    /**
     * Stops the animation loop
     */
    stopAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.lastRenderTime = 0;
    }
    
    /**
     * Creates a one-time rendering of the current song info
     * @returns {string} Data URL of the rendered image
     */
    createStillImage() {
        console.debug("[DEBUG] [SongRenderer] Creating still image");
        // Reset scroll position for still image
        this.scrollPosition = 0;
        
        // Create a simple test image if no song info is available
        if (!this.songInfo.title && !this.songInfo.artist && !this.songInfo.album) {
            console.debug("[DEBUG] [SongRenderer] No song info available, creating test image");
            this.ctx.fillStyle = this.config.backgroundColor || "#000000";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = this.config.textColor || "#FFFFFF";
            this.ctx.font = `${this.config.fontSize || 16}px ${this.config.fontFamily || "Arial"}`;
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText("Song Display", this.canvas.width / 2, this.canvas.height / 2);
            
            return this.canvas.toDataURL('image/png');
        }
        
        return this.render();
    }
}

// Create a global renderer instance
window.songRenderer = new SongRenderer();
