/// <reference path="./property-inspector.js" />
/// <reference path="./utils.js" />

/**
 * Base Inspector class that provides common functionality for all inspectors
 * To use this class, include it in your inspector.html before your specific inspector JS
 * and call BaseInspector.initialize() in your inspector's initialization code.
 */

class BaseInspector {
    constructor() {
        this.actionSettings = {};
        this.actionType = null;
        this.actionId = null;
        this.globalSettings = {
            global: {
                authorization: {
                    rpcKey: ''
                }
            },
            dial: {
                rotationAction: 'volume',
                volumeStep: 1,
                pressBehavior: 'togglePlay',
                tapBehavior: 'addToLibrary',
                marquee: {
                    enabled: true,
                    speed: 200,
                    length: 15,
                    delay: 2000
                },
                showIcons: true,
                showArtworkOnDial: true
            },
            songDisplay: {
                fontSize: 16,
                fontFamily: 'Figtree',
                textColor: '#FFFFFF',
                backgroundColor: '#000000',
                textAlign: 'center',
                showArtist: true,
                showAlbum: false,
                maxLines: 2,
                lineHeight: 1.2,
                alignment: 'center',
                showIcons: false,
                useShadow: true,
                iconSize: 24,
                textStyle: 'normal',
                verticalPosition: 'center',
                lineSpacing: 13,
                textPrefix: '',
                customFormat: '',
                marquee: {
                    enabled: true,
                    speed: 40,
                    pause: 2000
                }
            }
        };

        // Bind methods to this instance
        this.initialize = this.initialize.bind(this);
        this.loadGlobalSettings = this.loadGlobalSettings.bind(this);
        this.saveGlobalSettings = this.saveGlobalSettings.bind(this);
        this.loadActionSettings = this.loadActionSettings.bind(this);
        this.saveActionSettings = this.saveActionSettings.bind(this);
        this.addGlobalSettingsTab = this.addGlobalSettingsTab.bind(this);
        this.setupGlobalSettingsEvents = this.setupGlobalSettingsEvents.bind(this);
        this.setupTabSwitching = this.setupTabSwitching.bind(this);
    }

    /**
     * Initialize the inspector with both action-specific and global settings
     * @param {Object} options - Configuration options
     * @param {String} options.actionType - The type of action (e.g., 'dial', 'songDisplay', etc.)
     * @param {Function} options.onActionSettingsReceived - Callback when action settings are received
     * @param {Function} options.onGlobalSettingsReceived - Callback when global settings are received
     */
    initialize(options = {}) {
        this.actionType = options.actionType || null;
        this.onActionSettingsReceived = options.onActionSettingsReceived;
        this.onGlobalSettingsReceived = options.onGlobalSettingsReceived;

        console.log(`Initializing inspector for action type: ${this.actionType}`);

        // Connect to Stream Deck
        $PI.onConnected((jsn) => {
            console.log('Inspector connected:', jsn);
            this.actionId = jsn.uuid;

            // Register for action-specific settings
            $PI.getSettings();

            // Register for global settings
            $PI.getGlobalSettings();
        });

        // Handle action-specific settings
        $PI.onDidReceiveSettings((receivedData) => {
            console.log('Received action settings:', receivedData);
            this.loadActionSettings(receivedData);
        });

        // Handle global settings
        $PI.onDidReceiveGlobalSettings(({payload}) => {
            console.log('Received global settings:', payload.settings);
            this.loadGlobalSettings(payload.settings);
        });

        // Setup tab switching if the UI has tabs
        this.setupTabSwitching();

        // Add global settings tab if needed
        if (options.addGlobalSettingsTab) {
            this.addGlobalSettingsTab();
        }

        // Setup event handlers for global settings
        this.setupGlobalSettingsEvents();
    }

    /**
     * Setup event handlers for tab switching
     */
    setupTabSwitching() {
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                // Deactivate all tabs
                document.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Activate selected tab
                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.classList.add('active');
                    
                    // Important: Force a re-apply of current settings when tab changes
                    // This fixes settings not persisting between tab switches
                    if (tabId === 'action-settings' && this.actionSettings) {
                        // Re-apply action settings when switching to action tab
                        this.applySettingsToUI(this.actionSettings, '[data-setting]');
                    } else if (tabId === 'global-settings' && this.globalSettings) {
                        // Re-apply global settings when switching to global tab
                        this.applySettingsToUI(this.globalSettings, '[data-global-setting]', true);
                    }
                }
            });
        });
    }

    /**
     * Add a global settings tab to the inspector
     */
    addGlobalSettingsTab() {
        // Check if the container exists
        const tabsContainer = document.querySelector('.settings-tabs');
        if (!tabsContainer) {
            console.error('No .settings-tabs container found. Cannot add global settings tab.');
            return;
        }

        // Check if the tab already exists
        if (document.getElementById('global-settings')) {
            return; // Already added
        }

        // Add tab button
        const tabButton = document.createElement('div');
        tabButton.className = 'tab-button';
        tabButton.setAttribute('data-tab', 'global-settings');
        tabButton.textContent = 'Cider Config';
        tabsContainer.appendChild(tabButton);

        // Create tab content
        const wrapper = document.querySelector('.sdpi-wrapper');
        if (!wrapper) {
            console.error('No .sdpi-wrapper found. Cannot add global settings content.');
            return;
        }

        // Add global settings tab content
        const tabContent = document.createElement('div');
        tabContent.id = 'global-settings';
        tabContent.className = 'tab-content';
        tabContent.innerHTML = `
            <div class="sdpi-item" id="auth-settings" type="group">
                <div class="sdpi-item-label">Authorization</div>
                <div class="sdpi-item-group">
                    <div class="sdpi-item">
                        <div class="sdpi-item-label">RPC Key</div>
                        <input id="authKey" type="password" data-global-setting="global.authorization.rpcKey" class="sdProperty sdpi-item-value" placeholder="Enter your RPC Key" required>
                    </div>
                </div>
            </div>
        `;

        // Find where to insert the tab content
        const form = document.querySelector('form');
        if (form) {
            // Find the save/reset buttons to insert before them
            const saveButton = form.querySelector('#save-settings');
            if (saveButton && saveButton.closest('.sdpi-item')) {
                // Insert before the save button's container
                form.insertBefore(tabContent, saveButton.closest('.sdpi-item'));
            } else {
                // Fallback: append to form if save button not found
                form.appendChild(tabContent);
            }
        } else {
            wrapper.appendChild(tabContent);
        }

        // Re-initialize tab switching
        this.setupTabSwitching();
    }

    /**
     * Setup event handlers for global settings
     */
    setupGlobalSettingsEvents() {
        // We'll integrate the global settings with the main save button
        // This allows us to save both action and global settings with one button
        const saveButton = document.getElementById('save-settings');
        if (saveButton) {
            const originalClickHandler = saveButton.onclick;
            saveButton.onclick = (event) => {
                event.preventDefault();
                // Save both action settings and global settings
                this.saveActionSettings();
                this.saveGlobalSettings();
            };
        }
    }

    /**
     * Apply settings to UI elements
     * @param {Object} settings - Settings to apply
     * @param {String} selector - CSS selector for elements to update
     * @param {Boolean} isGlobal - Whether these are global settings (requiring path parsing)
     */
    applySettingsToUI(settings, selector, isGlobal = false) {
        document.querySelectorAll(selector).forEach(element => {
            let value;
            
            if (isGlobal) {
                // For global settings, we need to parse the path
                const settingPath = element.dataset.globalSetting;
                if (!settingPath) return;
                
                // Parse the path to get nested settings
                const pathParts = settingPath.split('.');
                value = settings;
                
                // Navigate through the path
                for (const part of pathParts) {
                    value = value?.[part];
                    if (value === undefined) break;
                }
                
                // Special handling for RPC Key (try both old and new structure)
                if (settingPath === 'global.authorization.rpcKey' && value === undefined) {
                    value = settings.authorization?.rpcKey;
                }
            } else {
                // For action settings, just get the value directly
                const settingName = element.dataset.setting;
                if (!settingName) return;
                value = settings[settingName];
            }
            
            // Set the form field value based on its type
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else if (element.type === 'range' || element.type === 'number') {
                element.value = value !== undefined ? value : '';
            } else if (element.type === 'select-one') {
                element.value = value || '';
            } else if (element.type === 'color') {
                element.value = value || '#000000';
            } else {
                element.value = value || '';
            }
        });
    }
    
    /**
     * Load global settings into the UI
     * @param {Object} receivedSettings - Settings received from Stream Deck
     */
    loadGlobalSettings(receivedSettings) {
        // Merge received settings with defaults to ensure complete structure
        if (receivedSettings) {
            // Create a deep merged structure of received settings over defaults
            this.globalSettings = this.deepMerge(this.globalSettings, receivedSettings);
        }
        
        // Apply settings to UI using our helper method
        this.applySettingsToUI(this.globalSettings, '[data-global-setting]', true);
        
        // Call the provided callback if it exists
        if (typeof this.onGlobalSettingsReceived === 'function') {
            this.onGlobalSettingsReceived(this.globalSettings);
        }
    }

    /**
     * Save global settings back to Stream Deck
     */
    saveGlobalSettings() {
        // Create a new settings object with the current structure
        const newSettings = JSON.parse(JSON.stringify(this.globalSettings));
        
        // Update with values from the form
        document.querySelectorAll('[data-global-setting]').forEach(element => {
            const settingPath = element.dataset.globalSetting;
            if (!settingPath) return;
            
            // Parse the path to set nested settings
            const pathParts = settingPath.split('.');
            let target = newSettings;
            
            // Navigate to the correct object
            for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                if (target[part] === undefined) {
                    target[part] = {};
                }
                target = target[part];
            }
            
            // Set the value based on input type
            const finalKey = pathParts[pathParts.length - 1];
            if (element.type === 'checkbox') {
                target[finalKey] = element.checked;
            } else if (element.type === 'number') {
                const numValue = parseInt(element.value, 10);
                target[finalKey] = isNaN(numValue) ? 0 : numValue;
            } else if (element.type === 'color') {
                target[finalKey] = element.value;
            } else if (element.value.trim() !== '') {
                target[finalKey] = element.value.trim();
            }
        });
        
        // Save the updated settings
        this.globalSettings = newSettings;
        $PI.setGlobalSettings(newSettings);
        console.log('Global settings saved:', newSettings);
        
        // Notify the plugin that global settings have changed
        // This helps with hot reloading when settings change
        $PI.sendToPlugin({
            action: 'globalSettingsChanged',
            settings: newSettings
        });
        
        // Notify the plugin that global settings have changed
        // This helps with hot reloading when settings change
        $PI.sendToPlugin({
            action: 'globalSettingsChanged',
            settings: newSettings
        });
    }

    /**
     * Load action-specific settings into the UI
     * @param {Object} jsn - Settings received from Stream Deck
     */
    loadActionSettings(jsn) {
        let receivedSettings = {};
        
        // Handle different possible data structures
        if (jsn?.payload) {
            if (jsn.payload.settings) {
                receivedSettings = jsn.payload.settings;
            } else if (typeof jsn.payload === 'object') {
                receivedSettings = jsn.payload;
            }
        }
        
        // Validate and merge with defaults
        const validatedSettings = this.validateActionSettings(receivedSettings);
        
        // Update stored action settings
        this.actionSettings = validatedSettings;
        
        // Apply settings to UI using our helper method
        this.applySettingsToUI(this.actionSettings, '[data-setting]');
        
        // Call the provided callback if it exists
        if (typeof this.onActionSettingsReceived === 'function') {
            this.onActionSettingsReceived(this.actionSettings);
        }
    }

    /**
     * Save action-specific settings back to Stream Deck
     */
    saveActionSettings() {
        const newSettings = {};
        
        document.querySelectorAll('[data-setting]').forEach(element => {
            const settingName = element.dataset.setting;
            if (!settingName) return;
            
            if (element.type === 'checkbox') {
                newSettings[settingName] = element.checked;
            } else if (element.type === 'range' || element.type === 'number') {
                const numValue = parseInt(element.value, 10);
                newSettings[settingName] = isNaN(numValue) ? 0 : numValue;
            } else if (element.type === 'color') {
                newSettings[settingName] = element.value;
            } else if (element.value.trim() !== '') {
                newSettings[settingName] = element.value.trim();
            }
        });
        
        // Update stored settings
        this.actionSettings = {...this.actionSettings, ...newSettings};
        
        // Save to Stream Deck
        $PI.setSettings(this.actionSettings);
        console.log('Action settings saved:', this.actionSettings);

        // Synchronize with global settings if this is a special action type
        if (this.actionType) {
            // Sync action settings to global settings
            this.syncActionToGlobalSettings();
            
            // Also save the global settings to ensure consistency
            $PI.setGlobalSettings(this.globalSettings);
            console.log('Global settings updated with action settings');
            
            // Notify the plugin that specific action type settings have changed
            // This helps with hot reloading when settings change
            $PI.sendToPlugin({
                action: 'settingsChanged',
                actionType: this.actionType,
                settings: this.actionSettings
            });
        }
    }

    /**
     * Validate action-specific settings
     * @param {Object} settings - Settings to validate
     * @returns {Object} - Validated settings
     */
    validateActionSettings(settings) {
        // Start with the default settings for this action type
        const defaultSettings = this.actionType ? this.globalSettings[this.actionType] || {} : {};
        
        // Merge received settings with defaults, preferring received values
        return {...defaultSettings, ...settings};
    }
    
    /**
     * Synchronize action settings with global settings
     * This ensures that action settings are always updated in the global settings object
     */
    syncActionToGlobalSettings() {
        if (this.actionType && this.actionSettings) {
            // Update the global settings with the current action settings
            this.globalSettings[this.actionType] = {...this.actionSettings};
            console.log(`Synchronized ${this.actionType} settings to global settings`);
        }
    }

    /**
     * Recursively merge objects
     * @param {Object} target - Target object to merge into
     * @param {Object} source - Source object to merge from
     * @returns {Object} - Merged object
     */
    deepMerge(target, source) {
        const output = {...target};
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }
        
        return output;
    }

    /**
     * Check if value is an object (and not null)
     * @param {*} item - Value to check
     * @returns {boolean} - True if object
     */
    isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }
}

// Create a global instance
const baseInspector = new BaseInspector();
