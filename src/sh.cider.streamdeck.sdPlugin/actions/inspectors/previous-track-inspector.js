/// <reference path="../../libs/js/property-inspector.js" />
/// <reference path="../../libs/js/utils.js" />
/// <reference path="../../libs/js/base-inspector.js" />

// Create a temporary storage for unsaved settings
let tempSettings = {};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI event listeners for controls
    initUI();
    
    // Add the playback section to baseInspector.globalSettings if it doesn't exist
    if (!baseInspector.globalSettings.playback) {
        baseInspector.globalSettings.playback = {
            alwaysGoToPrevious: false
        };
    }
    
    // Initialize the base inspector with our settings
    baseInspector.initialize({
        actionType: 'playback',
        onActionSettingsReceived: handleSettingsUpdate,
        onGlobalSettingsReceived: handleGlobalSettingsUpdate,
        addGlobalSettingsTab: true
    });
    
    // Add custom tab switching to ensure settings persist across tabs
    setupFunctionalTabSwitching();
});

/**
 * Handle settings updates from baseInspector
 * This is called when the action settings are received from Stream Deck
 * @param {Object} settings - The settings object from Stream Deck
 */
function handleSettingsUpdate(settings) {
    console.log('Previous Track action settings updated:', settings);
    
    // Initialize the temporary settings with a deep copy of the received settings
    tempSettings = JSON.parse(JSON.stringify(baseInspector.actionSettings));
    
    // Load the settings into the UI
    loadSettingsToUI(tempSettings);
}

/**
 * Handle global settings updates
 * This ensures temporary settings stay in sync with global settings
 * @param {Object} globalSettings - The global settings object from Stream Deck
 */
function handleGlobalSettingsUpdate(globalSettings) {
    console.log('Global settings updated:', globalSettings);
    
    // If we have playback settings in the global object, update our UI
    if (globalSettings.playback) {
        // Synchronize the action settings with global playback settings
        baseInspector.actionSettings = {...baseInspector.actionSettings, ...globalSettings.playback};
        
        // Update our temporary settings to keep them in sync
        tempSettings = JSON.parse(JSON.stringify(baseInspector.actionSettings));
        
        // Load the temporary settings to the UI
        loadSettingsToUI(tempSettings);
    }
}

/**
 * Initialize UI event listeners and functionality
 * Sets up all event handlers for the property inspector UI
 */
function initUI() {
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
        // Get default playback settings
        const defaultSettings = {
            alwaysGoToPrevious: false
        };
        // Reset temp settings to defaults
        tempSettings = JSON.parse(JSON.stringify(defaultSettings));
        // Load default settings into the UI
        loadSettingsToUI(tempSettings);
    });
}

/**
 * Setup functional tab switching with persistence between tabs
 * This allows users to switch tabs without losing unsaved changes
 */
function setupFunctionalTabSwitching() {
    // Add event listeners for the tab buttons
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
        } else if (element.tagName === 'SELECT' || element.type === 'text' || element.type === 'color') {
            tempSettings[settingName] = element.value;
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
        } else if (element.type === 'range' || element.type === 'number' || 
                  element.type === 'text' || element.type === 'color' || element.tagName === 'SELECT') {
            element.value = settings[settingName];
        }
    });
}
