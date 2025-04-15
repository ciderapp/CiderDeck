/// <reference path="../../libs/js/property-inspector.js" />
/// <reference path="../../libs/js/utils.js" />
/// <reference path="../../libs/js/base-inspector.js" />

// Create a temporary storage for unsaved settings
let tempSettings = {};

// Initialize the base inspector
document.addEventListener('DOMContentLoaded', function() {
    // Initialize base inspector with proper options
    baseInspector.initialize({
        actionType: 'global', // Using 'global' as a type for the main inspector
        onActionSettingsReceived: handleActionSettingsUpdate,
        onGlobalSettingsReceived: handleGlobalSettingsUpdate,
        addGlobalSettingsTab: false
    });

    // Set up event listeners
    initUI();
});

/**
 * Handle global settings updates
 * @param {Object} globalSettings - The global settings object from Stream Deck
 */
function handleGlobalSettingsUpdate(globalSettings) {
    console.log('Global settings updated:', globalSettings);
    
    // Store the validated settings in our temporary storage
    tempSettings = JSON.parse(JSON.stringify(globalSettings));
    
    // Load settings into the UI
    loadSettingsToUI();
}

/**
 * Handle action settings updates 
 * @param {Object} settings - The action settings object from Stream Deck
 */
function handleActionSettingsUpdate(settings) {
    console.log('Action settings updated:', settings);
    // This inspector primarily deals with global settings, so nothing to do here
}

// Get global settings on startup
$PI.onConnected(() => {
    $PI.getGlobalSettings();
});

// Handle global settings changes
$PI.onDidReceiveGlobalSettings(({payload}) => {
    console.log('Received global settings:', payload.settings);
    // Store the validated settings
    tempSettings = validateGlobalSettings(payload.settings || {});
    // Load settings into the UI
    loadSettingsToUI();
});

// Handle action-specific settings
$PI.onDidReceiveSettings((receivedData) => {
    console.log('Received action settings:', receivedData);
    baseInspector.loadActionSettings(receivedData);
});

/**
 * Initialize UI event listeners and functionality
 */
function initUI() {
    // Save button: Apply settings and save to Stream Deck
    document.getElementById('save-settings').addEventListener('click', (event) => {
        event.preventDefault();
        saveSettings();
    });

    // Reset button: Restore default settings
    document.getElementById('reset-settings').addEventListener('click', (event) => {
        event.preventDefault();
        resetSettings();
    });
}

/**
 * Load settings from the temporary storage into the UI
 */
function loadSettingsToUI() {
    // Only load the authorization settings
    const authKey = document.getElementById('authKey');
    if (authKey) {
        // Use the new hierarchical structure with fallback to old structure
        authKey.value = tempSettings.global?.authorization?.rpcKey || 
                         tempSettings.authorization?.rpcKey || '';
    }
}

/**
 * Save settings from the UI to Stream Deck
 */
function saveSettings() {
    // Collect the RPC key from the input
    collectFormValues();
    
    // Apply temp settings to actual settings in baseInspector
    baseInspector.globalSettings = JSON.parse(JSON.stringify(tempSettings));
    
    // Send the settings to Stream Deck using baseInspector
    baseInspector.saveGlobalSettings();
    
    // Show a success message
    const button = document.getElementById('save-settings');
    const originalText = button.innerText;
    button.innerText = "✓ Saved!";
    setTimeout(() => {
        button.innerText = originalText;
    }, 2000);
    
    console.log('Global settings saved:', tempSettings);
}

/**
 * Reset settings to defaults
 */
function resetSettings() {
    // Reset just the RPC key while preserving other settings
    if (!tempSettings.global) tempSettings.global = {};
    if (!tempSettings.global.authorization) tempSettings.global.authorization = {};
    tempSettings.global.authorization.rpcKey = "";
    
    // Also reset the legacy path for backward compatibility
    if (!tempSettings.authorization) tempSettings.authorization = {};
    tempSettings.authorization.rpcKey = "";
    
    // Update UI
    loadSettingsToUI();
    
    // Show a message indicating reset was successful
    const button = document.getElementById('reset-settings');
    const originalText = button.innerText;
    button.innerText = "✓ Reset!";
    setTimeout(() => {
        button.innerText = originalText;
    }, 2000);
    
    console.log('Authorization settings reset to defaults');
}

/**
 * Validate global settings and fill in any missing values with defaults
 * @param {Object} settings - The settings object from Stream Deck
 * @returns {Object} - A validated settings object with all required properties
 */
function validateGlobalSettings(settings) {
    // Create a validated settings object with defaults for missing values
    const validatedSettings = {
        // Preserve any existing settings
        ...settings,
        
        // Ensure legacy settings structure exists with defaults
        marqueeSettings: {
            enabled: settings.marqueeSettings?.enabled ?? true,
            speed: settings.marqueeSettings?.speed ?? 200,
            length: settings.marqueeSettings?.length ?? 15,
            delay: settings.marqueeSettings?.delay ?? 2000
        },
        tapSettings: {
            tapBehavior: settings.tapSettings?.tapBehavior ?? "addToLibrary"
        },
        knobSettings: {
            pressBehavior: settings.knobSettings?.pressBehavior ?? "togglePlay",
            volumeStep: settings.knobSettings?.volumeStep ?? 1
        },
        authorization: {
            rpcKey: settings.authorization?.rpcKey ?? ""
        },
        
        // Ensure new hierarchical settings structure exists with defaults
        global: {
            ...(settings.global || {}),
            authorization: {
                ...(settings.global?.authorization || {}),
                rpcKey: settings.global?.authorization?.rpcKey ?? settings.authorization?.rpcKey ?? ""
            }
        }
    };
    
    return validatedSettings;
}

/**
 * Collect form values into the temporary settings object
 */
function collectFormValues() {
    const rpcKey = document.getElementById('authKey').value.trim();
    
    // Update the temporary settings with the RPC key
    // Ensure we maintain both the new hierarchical structure and legacy structure
    if (!tempSettings.global) tempSettings.global = {};
    if (!tempSettings.global.authorization) tempSettings.global.authorization = {};
    tempSettings.global.authorization.rpcKey = rpcKey;
    
    // Also update the legacy path for backward compatibility
    if (!tempSettings.authorization) tempSettings.authorization = {};
    tempSettings.authorization.rpcKey = rpcKey;
}