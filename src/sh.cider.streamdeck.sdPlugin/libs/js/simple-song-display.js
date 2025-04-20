// ==========================================================================
//  Simple Song Display Renderer
// ==========================================================================
//  A more direct approach to rendering song information as images
//  that works reliably with the Stream Deck SDK.
// ==========================================================================

// Create module-specific logger
const rendererLogger = window.CiderDeckLogger?.createLogger('SongRenderer') || {
    info: console.log,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
    category: () => ({
        info: console.log,
        debug: console.debug,
        warn: console.warn,
        error: console.error
    })
};

// Create subcategory loggers
const canvasLogger = rendererLogger.category('Canvas');
const animationLogger = rendererLogger.category('Animation');
const iconLogger = rendererLogger.category('Icons');

/**
 * SongDisplayRenderer - Creates images with song information for Stream Deck keys
 */
class SongDisplayRenderer {
    constructor() {
        rendererLogger.debug("Initializing simple song renderer");
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size to match Stream Deck key
        this.canvas.width = 144;
        this.canvas.height = 144;
        
        // Default settings
        this.settings = {
            fontSize: 16,
            fontFamily: 'Figtree',
            textColor: '#FFFFFF',
            backgroundColor: '#000000',
            showArtist: true,
            showAlbum: false,
            maxLines: 2,
            alignment: 'center',
            showIcons: true,
            useShadow: true,
            iconSize: 20,
            textStyle: 'normal',
            verticalPosition: 'center',
            marqueeEnabled: true,
            marqueeSpeed: 40,
            marqueePause: 2000
        };
        
        this.songInfo = {
            title: '',
            artist: '',
            album: ''
        };
        
        // Marquee animation properties
        this.marqueePosition = 0;
        this.animationFrame = null;
        this.lastRenderTime = 0;
        this.isPaused = false;
        this.pauseStartTime = 0;
        this.pauseDuration = 2000; // ms to pause at each end
        
        // Cache for loaded icons
        this.iconCache = {};
    }
    
    /**
     * Updates song information
     */
    updateSongInfo(songInfo) {
        rendererLogger.debug(`Updating song info: ${JSON.stringify(songInfo)}`);
        this.songInfo = {
            title: songInfo.title || '',
            artist: songInfo.artist || '',
            album: songInfo.album || ''
        };
        
        // Reset marquee position when song changes
        this.marqueePosition = 0;
        this.lastRenderTime = 0;
        this.isPaused = false;
    }
    
    /**
     * Updates display settings
     */
    updateSettings(settings) {
        rendererLogger.debug(`Updating settings: ${JSON.stringify(settings)}`);
        this.settings = {
            ...this.settings,
            ...settings
        };
    }
    
    /**
     * Loads an icon for use in the renderer
     * @param {string} iconPath Path to the icon
     * @returns {Promise<HTMLImageElement>} Promise resolving to the loaded image
     */
    async loadIcon(iconPath) {
        // Check if icon is already cached
        if (this.iconCache[iconPath]) {
            iconLogger.debug(`Using cached icon: ${iconPath}`);
            return this.iconCache[iconPath];
        }
        
        iconLogger.debug(`Loading icon: ${iconPath}`);
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                iconLogger.debug(`Icon loaded successfully: ${iconPath}`);
                this.iconCache[iconPath] = img;
                resolve(img);
            };
            img.onerror = (err) => {
                iconLogger.error(`Failed to load icon: ${iconPath} - ${err}`);
                reject(err);
            };
            img.src = iconPath;
        });
    }
    
    /**
     * Renders song information to an image
     * @returns {string} Data URL of the rendered image
     */
    renderImage() {
        canvasLogger.debug("Rendering image");
        
        const { ctx, canvas, settings, songInfo } = this;
        const { 
            fontSize, fontFamily, textColor, backgroundColor, 
            showArtist, showAlbum, maxLines, alignment, 
            showIcons, useShadow, textStyle, verticalPosition,
            iconSize
        } = settings;
        
        // Clear canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Set text style
        ctx.fillStyle = textColor;
        ctx.textAlign = alignment;
        ctx.textBaseline = 'middle';
        
        // Apply text shadows if enabled
        if (useShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
        }
        
        // Prepare text lines
        let lines = [];
        if (songInfo.title) {
            lines.push({ text: songInfo.title, type: 'title' });
        }
        if (showArtist && songInfo.artist) {
            lines.push({ text: songInfo.artist, type: 'artist' });
        }
        if (showAlbum && songInfo.album) {
            lines.push({ text: songInfo.album, type: 'album' });
        }
        
        // Limit to max lines
        lines = lines.slice(0, maxLines);
        
        // If no text to display
        if (lines.length === 0) {
            ctx.font = `${fontSize}px ${fontFamily}`;
            ctx.fillText('No song playing', canvas.width / 2, canvas.height / 2);
            
            // Try to draw a music icon
            if (showIcons) {
                this.drawMusicIcon(canvas.width / 2, canvas.height / 2 - 30, 24);
            }
            
            return canvas.toDataURL('image/png');
        }
        
        // Add music icon if enabled
        if (showIcons) {
            this.drawMusicIcon(canvas.width / 2, 25, iconSize);
        }
        
        // Calculate line height based on number of lines and vertical position
        const lineHeight = Math.min(fontSize * 1.3, canvas.height / (lines.length + 1));
        
        // Calculate vertical starting position
        let startY;
        if (verticalPosition === 'top') {
            startY = showIcons ? 50 : 30; // Start from top with padding
        } else if (verticalPosition === 'bottom') {
            startY = canvas.height - (lineHeight * lines.length) - 20;
        } else { // center
            startY = (canvas.height - (lineHeight * lines.length)) / 2;
        }
        
        // Calculate the x position based on alignment
        const xPos = alignment === 'left' ? 10 : 
                   alignment === 'right' ? canvas.width - 10 : 
                   canvas.width / 2;
        
        // Render each line
        lines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            
            // Set font size and style based on line type
            let lineSize = fontSize;
            if (line.type === 'title') {
                // Make title larger
                lineSize = Math.min(fontSize * 1.5, 22);
                ctx.font = `${textStyle} ${lineSize}px ${fontFamily}`;
            } else {
                // Make secondary info smaller
                lineSize = Math.max(fontSize * 0.85, 12);
                ctx.font = `${textStyle === 'bold' ? 'normal' : textStyle} ${lineSize}px ${fontFamily}`;
            }
            
            // Measure text to see if we need to truncate
            let text = line.text;
            let textWidth = ctx.measureText(text).width;
            const maxWidth = canvas.width - 20;
            
            // If text is too long, truncate it with ellipsis
            if (textWidth > maxWidth) {
                text = this.truncateText(text, maxWidth);
            }
            
            // Draw text with shadow
            ctx.fillText(text, xPos, y, maxWidth);
        });
        
        // Reset shadow
        if (useShadow) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        
        try {
            const imageData = canvas.toDataURL('image/png');
            canvasLogger.debug("Image rendered successfully");
            return imageData;
        } catch (error) {
            canvasLogger.error(`Failed to convert canvas to image: ${error}`);
            return null;
        }
    }
    
    /**
     * Renders song information with marquee effect
     * @returns {string} Data URL of the rendered image
     */
    renderImageWithMarquee() {
        animationLogger.debug("Rendering marquee frame");
        
        // If marquee is disabled, just use standard rendering
        if (!this.settings.marqueeEnabled) {
            return this.renderImage();
        }
        
        const { ctx, canvas, settings, songInfo } = this;
        const { 
            fontSize, fontFamily, textColor, backgroundColor, 
            showArtist, showAlbum, maxLines, alignment, 
            showIcons, useShadow, textStyle, verticalPosition,
            iconSize
        } = settings;
        
        // Clear canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Set text style
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left'; // Always use left alignment for marquee
        ctx.textBaseline = 'middle';
        
        // Apply text shadows if enabled
        if (useShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
        }
        
        // Prepare text lines
        let lines = [];
        if (songInfo.title) {
            lines.push({ text: songInfo.title, type: 'title' });
        }
        if (showArtist && songInfo.artist) {
            lines.push({ text: songInfo.artist, type: 'artist' });
        }
        if (showAlbum && songInfo.album) {
            lines.push({ text: songInfo.album, type: 'album' });
        }
        
        // Limit to max lines
        lines = lines.slice(0, maxLines);
        
        // If no text to display
        if (lines.length === 0) {
            ctx.textAlign = 'center';
            ctx.font = `${fontSize}px ${fontFamily}`;
            ctx.fillText('No song playing', canvas.width / 2, canvas.height / 2);
            if (showIcons) {
                this.drawMusicIcon(canvas.width / 2, canvas.height / 2 - 30, 24);
            }
            return canvas.toDataURL('image/png');
        }
        
        // Add music icon if enabled
        if (showIcons) {
            ctx.save();
            ctx.textAlign = 'center';
            this.drawMusicIcon(canvas.width / 2, 25, iconSize);
            ctx.restore();
        }
        
        // Calculate line height based on number of lines
        const lineHeight = Math.min(fontSize * 1.3, canvas.height / (lines.length + 1));
        
        // Calculate vertical starting position
        let startY;
        if (verticalPosition === 'top') {
            startY = showIcons ? 50 : 30; // Start from top with padding
        } else if (verticalPosition === 'bottom') {
            startY = canvas.height - (lineHeight * lines.length) - 20;
        } else { // center
            startY = (canvas.height - (lineHeight * lines.length)) / 2;
        }
        
        // Render each line
        lines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            
            // Set font size and style based on line type
            let lineSize = fontSize;
            if (line.type === 'title') {
                lineSize = Math.min(fontSize * 1.5, 22);
                ctx.font = `${textStyle} ${lineSize}px ${fontFamily}`;
            } else {
                lineSize = Math.max(fontSize * 0.85, 12);
                ctx.font = `${textStyle === 'bold' ? 'normal' : textStyle} ${lineSize}px ${fontFamily}`;
            }
            
            // Measure text width
            let text = line.text;
            let textWidth = ctx.measureText(text).width;
            
            // Only apply marquee for text that won't fit
            if (textWidth > canvas.width - 20) {
                // Draw the scrolling text with clipping
                this.drawScrollingLine(text, y, lineSize, textWidth);
            } else {
                // For text that fits, just center it
                ctx.save();
                ctx.textAlign = alignment;
                const xPos = alignment === 'left' ? 10 : 
                            alignment === 'right' ? canvas.width - 10 : 
                            canvas.width / 2;
                ctx.fillText(text, xPos, y, canvas.width - 20);
                ctx.restore();
            }
        });
        
        // Reset shadow
        if (useShadow) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        
        try {
            const imageData = canvas.toDataURL('image/png');
            return imageData;
        } catch (error) {
            animationLogger.error(`Failed to convert canvas to image: ${error}`);
            return this.renderImage(); // Fallback to normal rendering
        }
    }
    
    /**
     * Draw a scrolling line of text with clipping
     * @param {string} text The text to scroll
     * @param {number} y The y-position to draw at
     * @param {number} fontSize The font size
     * @param {number} textWidth Width of the text
     */
    drawScrollingLine(text, y, fontSize, textWidth) {
        const { ctx, canvas, marqueePosition } = this;
        
        // Debug the scroll position
        animationLogger.debug(`Marquee position: ${marqueePosition}, Text width: ${textWidth}`);
        
        // Use clipping to show only part of the text
        ctx.save();
        
        // Create clipping region for text visibility
        const clipPadding = 10;
        const clipWidth = canvas.width - (clipPadding * 2);
        
        ctx.beginPath();
        ctx.rect(clipPadding, y - fontSize, clipWidth, fontSize * 2);
        ctx.clip();
        
        // Make the text scroll from right to left
        // Calculate starting position that's fully off-screen to the right
        // Then move it leftward based on marquee position
        const spacing = canvas.width * 0.5; // Space between repeating text 
        const fullWidth = textWidth + spacing;
        
        // Calculate the scroll offset - this creates a continuous rightToLeft scroll
        // We use modulo to create a loop
        const offset = marqueePosition % fullWidth;
        
        // Start position - begin at right edge and scroll left
        const startX = canvas.width + spacing - offset;
        
        // Draw the scrolling text - the main copy that moves across
        ctx.fillText(text, startX, y);
        
        // Draw additional copies for continuous scrolling
        // Draw text to the left of the main copy
        ctx.fillText(text, startX - fullWidth, y);
        
        // Draw text to the right of the main copy
        ctx.fillText(text, startX + fullWidth, y);
        
        // Restore context
        ctx.restore();
    }
    
    /**
     * Start the marquee animation
     * @param {Function} callback Function to call on each animation frame with new image
     */
    startMarqueeAnimation(callback) {
        if (this.animationFrame) {
            this.stopMarqueeAnimation();
        }
        
        animationLogger.info("Starting marquee animation");
        
        // Reset animation state
        this.marqueePosition = 0;
        this.lastRenderTime = 0;
        this.isPaused = false;
        
        const animate = (timestamp) => {
            // Initialize last render time if needed
            if (this.lastRenderTime === 0) {
                this.lastRenderTime = timestamp;
                this.pauseStartTime = timestamp;
            }
            
            const delta = timestamp - this.lastRenderTime;
            this.lastRenderTime = timestamp;
            
            // Update scroll position based on elapsed time and speed
            const speed = this.settings.marqueeSpeed || 40;
            
            // Only move if not in a pause state
            if (!this.isPaused) {
                this.marqueePosition += (delta / 1000) * speed;
                
                // Check if we should pause at the end of this scroll
                // We'll pause after every ~1000 pixels of scrolling
                if (Math.floor(this.marqueePosition / 1000) > 
                    Math.floor((this.marqueePosition - (delta / 1000) * speed) / 1000)) {
                    this.isPaused = true;
                    this.pauseStartTime = timestamp;
                }
            } else {
                // Check if pause duration has elapsed
                const pauseDuration = this.settings.marqueePause || 2000;
                if (timestamp - this.pauseStartTime >= pauseDuration) {
                    this.isPaused = false;
                }
            }
            
            // Generate the image and pass to callback
            try {
                const image = this.renderImageWithMarquee();
                if (image && callback && typeof callback === 'function') {
                    callback(image);
                } else if (!image) {
                    animationLogger.error("Failed to generate marquee image");
                }
            } catch (error) {
                animationLogger.error(`Error in marquee animation: ${error}`);
                const fallbackImage = this.renderImage();
                if (fallbackImage && callback && typeof callback === 'function') {
                    callback(fallbackImage);
                }
            }
            
            // Continue animation
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        this.animationFrame = requestAnimationFrame(animate);
    }
    
    /**
     * Stop the marquee animation
     */
    stopMarqueeAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.lastRenderTime = 0;
        this.marqueePosition = 0;
        this.isPaused = false;
    }
    
    /**
     * Draws a music icon directly on the canvas
     * @param {number} x X position
     * @param {number} y Y position 
     * @param {number} size Icon size
     */
    drawMusicIcon(x, y, size) {
        iconLogger.debug(`Drawing music icon at (${x}, ${y}) with size ${size}`);
        
        const { ctx } = this;
        
        // Save the current context state
        ctx.save();
        
        // Draw music note icon
        ctx.fillStyle = this.settings.textColor;
        ctx.strokeStyle = this.settings.textColor;
        ctx.lineWidth = 2;
        
        // Draw note head
        const headRadius = size / 4;
        ctx.beginPath();
        ctx.ellipse(x - size/4, y + size/3, headRadius, headRadius * 0.7, Math.PI / 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw stem
        ctx.beginPath();
        ctx.moveTo(x - size/4 + headRadius * 0.7, y + size/3);
        ctx.lineTo(x - size/4 + headRadius * 0.7, y - size/3);
        ctx.stroke();
        
        // Draw flag
        ctx.beginPath();
        ctx.moveTo(x - size/4 + headRadius * 0.7, y - size/3);
        ctx.quadraticCurveTo(
            x + size/4, y - size/3,
            x + size/4, y - size/6
        );
        ctx.stroke();
        
        // Restore context
        ctx.restore();
    }
    
    /**
     * A better text truncation method that preserves important parts
     * @param {string} text The text to truncate 
     * @param {number} maxWidth Maximum width in pixels
     * @returns {string} Truncated text
     */
    truncateText(text, maxWidth) {
        const { ctx } = this;
        
        // If text already fits, return it unchanged
        if (ctx.measureText(text).width <= maxWidth) {
            return text;
        }
        
        // Add ellipsis
        const ellipsis = '…';
        const ellipsisWidth = ctx.measureText(ellipsis).width;
        
        // For very short available widths, just return ellipsis
        if (maxWidth <= ellipsisWidth * 2) {
            return ellipsis;
        }
        
        // For song titles, try to keep more from the beginning
        const availableWidth = maxWidth - ellipsisWidth;
        let fitText = '';
        
        // For song titles with " - " format, try to preserve the most important part
        if (text.includes(' - ')) {
            const parts = text.split(' - ');
            const firstPart = parts[0];
            // If just the first part fits with ellipsis, use that
            if (ctx.measureText(firstPart).width <= availableWidth) {
                return firstPart + ellipsis;
            }
        }
        
        // Otherwise, do character-by-character fitting from the beginning
        for (let i = 1; i < text.length; i++) {
            const testText = text.substring(0, i);
            if (ctx.measureText(testText).width > availableWidth) {
                // Return the largest substring that fits plus ellipsis
                return text.substring(0, i - 1) + ellipsis;
            }
        }
        
        // This shouldn't happen, but return something reasonable
        return text.substring(0, 5) + ellipsis;
    }
    
    /**
     * Renders a predefined icon on the canvas
     * @param {string} iconType Type of icon to render (play, pause, etc.)
     * @param {number} x X position
     * @param {number} y Y position
     * @param {number} size Size of the icon
     */
    renderIcon(iconType, x, y, size) {
        const { ctx } = this;
        const iconPath = this.getIconPath(iconType);
        
        // If icon is loaded in cache, draw it
        if (this.iconCache[iconPath]) {
            const icon = this.iconCache[iconPath];
            ctx.drawImage(icon, x - (size/2), y - (size/2), size, size);
        } else {
            // Load icon and then render
            this.loadIcon(iconPath).then(icon => {
                ctx.drawImage(icon, x - (size/2), y - (size/2), size, size);
            }).catch(() => {
                // If icon fails to load, draw a placeholder
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(x - (size/2), y - (size/2), size, size);
            });
        }
    }
    
    /**
     * Gets the path to an icon based on type
     * @param {string} iconType Type of icon
     * @returns {string} Path to the icon
     */
    getIconPath(iconType) {
        const basePath = 'actions/assets/buttons/';
        
        switch (iconType) {
            case 'music':
                return `${basePath}media-playlist.png`;
            case 'play':
                return `${basePath}media-play.png`;
            case 'pause':
                return `${basePath}media-pause.png`;
            case 'next':
                return `${basePath}media-next.png`;
            case 'previous':
                return `${basePath}media-previous.png`;
            case 'volume':
                return `${basePath}volume-up-1.png`;
            default:
                return `${basePath}icon.png`;
        }
    }
}

// Create global instance
window.songDisplayRenderer = new SongDisplayRenderer();
