/* 
 * Font Loader for Stream Deck Plugin
 * Loads custom fonts for use in the song display renderer
 */

(function() {
    // Create a style element for font-face declarations
    const style = document.createElement('style');
    
    // Add @font-face rules for Figtree
    style.textContent = `
        @font-face {
	        font-family: 'Figtree';
            font-style: normal;
            font-display: swap;
            src: url('https://cdn.cider.sh/Figtree-VariableFont_wght.ttf') format('truetype');
            font-weight: 45 920;
        }
    `;
    
    // Append the style element to the head
    document.head.appendChild(style);
    
    // Create a hidden div to preload the font
    const preloadDiv = document.createElement('div');
    preloadDiv.style.fontFamily = 'Figtree';
    preloadDiv.style.visibility = 'hidden';
    preloadDiv.style.position = 'absolute';
    preloadDiv.style.top = '-9999px';
    preloadDiv.style.left = '-9999px';
    preloadDiv.textContent = 'Font Preload';
    document.body.appendChild(preloadDiv);
    
    console.debug('[DEBUG] [Fonts] Custom fonts initialized');
})();
