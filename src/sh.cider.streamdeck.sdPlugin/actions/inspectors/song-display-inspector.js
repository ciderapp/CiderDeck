/// <reference path="../../libs/js/property-inspector.js" />
/// <reference path="../../libs/js/utils.js" />
/// <reference path="../../libs/js/base-inspector.js" />

// Create a temporary storage for unsaved settings
// This allows us to track changes between tabs without saving to Stream Deck
let tempSettings = {};

// Initialize UI event listeners for controls
initUI();

// Set initial color previews
updateColorPreviews();

// Initialize the base inspector with our settings
baseInspector.initialize({
    actionType: 'songDisplay',
    onActionSettingsReceived: handleSettingsUpdate,
    onGlobalSettingsReceived: handleGlobalSettingsUpdate,
    addGlobalSettingsTab: true
});
    
// Add custom tab switching to ensure settings persist across functional tabs
setupFunctionalTabSwitching();

// Handle action-specific settings from Stream Deck
$PI.onDidReceiveSettings((receivedData) => {
    console.log('Received action settings:', receivedData);
    baseInspector.loadActionSettings(receivedData);
    
    // Update our temp settings to keep UI state in sync
    tempSettings = JSON.parse(JSON.stringify(baseInspector.actionSettings));
    loadSettingsToUI(tempSettings);
});

/**
 * Handle settings updates from baseInspector
 * This is called when the action settings are received from Stream Deck
 * @param {Object} settings - The settings object from Stream Deck
 */
function handleSettingsUpdate(settings) {
    // Initialize the temporary settings with a deep copy of the received settings
    tempSettings = JSON.parse(JSON.stringify(baseInspector.actionSettings));
    
    // Load the settings into the UI
    loadSettingsToUI(tempSettings);
    
    // Update UI with received settings
    updateColorPreviews();
    updateDependentControls();
}

/**
 * Handle global settings updates
 * This ensures temporary settings stay in sync with global settings
 * @param {Object} globalSettings - The global settings object from Stream Deck
 */
function handleGlobalSettingsUpdate(globalSettings) {
    console.log('Global settings updated:', globalSettings);
    
    // If we have songDisplay settings in the global object, update our UI
    if (globalSettings.songDisplay) {
        // Synchronize the action settings with global songDisplay settings
        baseInspector.actionSettings = {...baseInspector.actionSettings, ...globalSettings.songDisplay};
        
        // Update our temporary settings to keep them in sync
        tempSettings = JSON.parse(JSON.stringify(baseInspector.actionSettings));
        
        // Load the temporary settings to the UI
        loadSettingsToUI(tempSettings);
        
        // Update UI
        updateColorPreviews();
        updateDependentControls();
    }
}

/**
 * Initialize UI event listeners and functionality
 * Sets up all event handlers for the property inspector UI
 */
function initUI() {
    // Update color previews when color inputs change
    document.getElementById('textColor').addEventListener('input', updateColorPreviews);
    document.getElementById('backgroundColor').addEventListener('input', updateColorPreviews);

    // Enable/disable icon size input based on showIcons checkbox
    document.getElementById('showIcons').addEventListener('change', function() {
        document.getElementById('iconSize').disabled = !this.checked;
        document.querySelectorAll('#icon-size-container .clickable').forEach(el => {
            el.style.opacity = this.checked ? 1 : 0.5;
        });
    });
    
    // Enable/disable marquee controls based on marqueeEnabled checkbox
    document.getElementById('marqueeEnabled').addEventListener('change', function() {
        document.getElementById('marqueeSpeed').disabled = !this.checked;
        document.getElementById('marqueePause').disabled = !this.checked;
        document.querySelectorAll('#marquee-speed-container .clickable, #marquee-pause-container .clickable').forEach(el => {
            el.style.opacity = this.checked ? 1 : 0.5;
        });
    });

    // Save button: Apply temporary settings to actual settings and save to Stream Deck
    document.getElementById('save-settings').addEventListener('click', (event) => {
        event.preventDefault();
        
        // First collect the current form values into tempSettings
        collectFormValues();
        
        // Apply temp settings to actual settings
        baseInspector.actionSettings = JSON.parse(JSON.stringify(tempSettings));
        
        // Sync with global settings
        baseInspector.syncActionToGlobalSettings();
        
        // Send the settings to Stream Deck
        baseInspector.sendSettings();
        
        // Show a success message
        const button = document.getElementById('save-settings');
        const originalText = button.innerText;
        button.innerText = "✓ Saved!";
        setTimeout(() => {
            button.innerText = originalText;
        }, 2000);
    });

    // Reset button: Restore default settings
    document.getElementById('reset-settings').addEventListener('click', (event) => {
        event.preventDefault();
        // Get default song display settings from the base inspector
        const defaultSettings = baseInspector.globalSettings.songDisplay;
        // Reset temp settings to defaults
        tempSettings = JSON.parse(JSON.stringify(defaultSettings));
        // Load default settings into the UI
        loadSettingsToUI(tempSettings);
        // Update UI
        updateColorPreviews();
        updateDependentControls();
    });

    // Handle range inputs with clickable spans for easier value selection
    document.querySelectorAll('.clickable').forEach(span => {
        span.addEventListener('click', function() {
            const value = this.getAttribute('value');
            const input = this.parentNode.querySelector('input[type="range"]');
            if (input && value) {
                input.value = value;
                // Trigger change event
                const event = new Event('change');
                input.dispatchEvent(event);
            }
        });
    });
}

/**
 * Setup functional tab switching with persistence between tabs
 * This allows users to switch tabs without losing unsaved changes
 */
function setupFunctionalTabSwitching() {
    // Add event listeners for the functional tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            // First, save current tab values to temporary storage
            collectFormValues();
            
            // Handle visual tab switching
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Activate selected tab
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            // Restore saved values to the newly activated tab
            loadSettingsToUI(tempSettings);
            
            // Update dependent controls and refresh previews
            updateDependentControls();
            updateColorPreviews();
        });
    });
}

/**
 * Collect all form values into the temporary settings object
 * This captures the current state of all form elements with data-setting attributes
 */
function collectFormValues() {
    // Get all form elements with data-setting attributes
    document.querySelectorAll('[data-setting]').forEach(element => {
        const settingName = element.dataset.setting;
        if (!settingName) return;
        
        // Update the setting in tempSettings based on element type
        if (element.type === 'checkbox') {
            tempSettings[settingName] = element.checked;
        } else if (element.type === 'range' || element.type === 'number') {
            const numValue = parseInt(element.value, 10);
            tempSettings[settingName] = isNaN(numValue) ? 0 : numValue;
        } else if (element.type === 'color') {
            tempSettings[settingName] = element.value;
        } else if (element.value.trim() !== '') {
            tempSettings[settingName] = element.value.trim();
        }
    });
}

/**
 * Load settings from a settings object to the UI controls
 * This applies stored settings to all form elements with data-setting attributes
 * @param {Object} settings - The settings object to load into the UI
 */
function loadSettingsToUI(settings) {
    // Get all form elements with data-setting attributes
    document.querySelectorAll('[data-setting]').forEach(element => {
        const settingName = element.dataset.setting;
        if (!settingName || settings[settingName] === undefined) return;
        
        // Update the UI element based on its type
        if (element.type === 'checkbox') {
            element.checked = settings[settingName];
        } else if (element.type === 'range' || element.type === 'number' || element.type === 'text' || element.type === 'color' || element.tagName === 'SELECT') {
            element.value = settings[settingName];
        }
    });
}

/**
 * Update color previews when values change
 * Shows the selected colors in visual preview elements
 */
function updateColorPreviews() {
    document.getElementById('textColorPreview').style.backgroundColor = document.getElementById('textColor').value;
    document.getElementById('bgColorPreview').style.backgroundColor = document.getElementById('backgroundColor').value;
}

/**
 * Update UI state for dependent elements
 * Enables/disables and adjusts opacity of UI elements based on their parent controls
 */
function updateDependentControls() {
    // Update icon size control state
    const showIcons = document.getElementById('showIcons').checked;
    document.getElementById('iconSize').disabled = !showIcons;
    document.querySelectorAll('#icon-size-container .clickable').forEach(el => {
        el.style.opacity = showIcons ? 1 : 0.5;
    });
    
    // Update marquee controls state
    const marqueeEnabled = document.getElementById('marqueeEnabled').checked;
    document.getElementById('marqueeSpeed').disabled = !marqueeEnabled;
    document.getElementById('marqueePause').disabled = !marqueeEnabled;
    document.querySelectorAll('#marquee-speed-container .clickable, #marquee-pause-container .clickable').forEach(el => {
        el.style.opacity = marqueeEnabled ? 1 : 0.5;
    });
}
