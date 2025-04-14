/// <reference path="../../libs/js/property-inspector.js" />
/// <reference path="../../libs/js/utils.js" />

let globalSettings = {};

$PI.onConnected(() => {
    $PI.getGlobalSettings();
});

function loadSettings() {
    // Define defaults for all settings
    const defaults = {
        enableMarquee: true,
        marqueeSpeed: 200,
        marqueeLength: 15,
        marqueeDelay: 2000,
        tapBehavior: 'default',
        pressBehavior: 'default',
        volumeStep: 5,
        authKey: ''
    };    document.querySelectorAll('[data-setting]').forEach(element => {
        const settingName = element.dataset.setting;
        if (!settingName) return; // Skip elements without data-setting attribute
        
        let value;

        // Extract value from nested settings objects
        if (['enableMarquee', 'marqueeSpeed', 'marqueeLength', 'marqueeDelay'].includes(settingName)) {
            value = globalSettings.marqueeSettings?.[settingName === 'enableMarquee' ? 'enabled' : settingName];
        } else if (settingName === 'authKey') {
            value = globalSettings.authorization?.rpcKey;
        } else if (settingName === 'tapBehavior') {
            value = globalSettings.tapSettings?.tapBehavior;
        } else if (settingName === 'pressBehavior') {
            value = globalSettings.knobSettings?.pressBehavior;
        } else if (settingName === 'volumeStep') {
            value = globalSettings.knobSettings?.volumeStep;
        }

        // Apply defaults if value is undefined or null
        value = value ?? defaults[settingName];

        // Set the form field value based on its type
        if (element.type === 'checkbox') {
            element.checked = Boolean(value);
        } else if (element.type === 'number') {
            element.value = typeof value === 'number' ? value : defaults[settingName];
        } else if (element.type === 'select-one') {
            element.value = value || defaults[settingName];
        } else if (element.type === 'range') {
            element.value = typeof value === 'number' ? value : defaults[settingName];
        } else {
            element.value = value || defaults[settingName];
        }
    });
    
    updateMarqueeControls();
}

function saveSettings() {
    // Clear existing settings to avoid stale values
    const tempSettings = {};

    document.querySelectorAll('[data-setting]').forEach(element => {
        const settingName = element.dataset.setting;
        if (!settingName) return; // Skip elements without a data-setting attribute
        
        if (element.type === 'checkbox') {
            // Checkboxes always have a valid state
            tempSettings[settingName] = element.checked;
        } else if (element.type === 'number') {
            // For number inputs, use default if empty or NaN
            const numValue = parseInt(element.value);
            if (!isNaN(numValue)) {
                tempSettings[settingName] = numValue;
            }
        } else if (element.type === 'select-one') {
            // Select elements always have a value
            tempSettings[settingName] = element.value;
        } else if (element.value.trim() !== '') {
            // For other inputs, only save if non-empty after trimming
            tempSettings[settingName] = element.value.trim();
        }
    });

    // Update globalSettings with validated values
    Object.assign(globalSettings, tempSettings);    const configJSON = {
        marqueeSettings: {
            enabled: globalSettings.enableMarquee || false,
            speed: globalSettings.marqueeSpeed || 200,
            length: globalSettings.marqueeLength || 15,
            delay: globalSettings.marqueeDelay || 2000
        },
        tapSettings: {
            tapBehavior: globalSettings.tapBehavior || 'default'
        },
        knobSettings: {
            pressBehavior: globalSettings.pressBehavior || 'default',
            volumeStep: globalSettings.volumeStep || 5
        },
        authorization: {
            rpcKey: globalSettings.authKey || ''
        }
    };

    $PI.setGlobalSettings(configJSON);
    console.log('Global settings saved:', JSON.stringify(configJSON));
    console.log('Config JSON:', configJSON);
}

function updateMarqueeControls() {
    const enabled = document.getElementById('enable-marquee').checked;
    document.getElementById('marquee-speed').disabled = !enabled;
    document.getElementById('marquee-length').disabled = !enabled;
    document.getElementById('marquee-delay').disabled = !enabled;
}

document.getElementById('property-inspector').addEventListener('change', (event) => {
    if (event.target.id === 'enable-marquee') {
        updateMarqueeControls();
    }
});

document.getElementById('save-settings').addEventListener('click', (event) => {
    event.preventDefault();
    saveSettings();
});

document.getElementById('reset-settings').addEventListener('click', (event) => {
    event.preventDefault();
      // Define default settings - preserving your original preferred defaults
    const defaultSettings = {
        marqueeSettings: {
            enabled: true,
            speed: 200,
            length: 15,
            delay: 2000
        },
        tapSettings: {
            tapBehavior: "addToLibrary"
        },
        knobSettings: {
            pressBehavior: "togglePlay",
            volumeStep: 1
        },
        authorization: {
            rpcKey: ""
        }
    };
    
    // Properly reset global settings to defaults
    globalSettings = JSON.parse(JSON.stringify(defaultSettings));
    
    // Update UI to reflect default values
    loadSettings();
    
    // Save to Stream Deck
    $PI.setGlobalSettings(defaultSettings);
    
    console.log('Settings reset to defaults:', defaultSettings);
});

$PI.onDidReceiveGlobalSettings(({payload}) => {
    console.log('Received global settings:', payload.settings);
    
    // Ensure we have a proper structure by providing defaults for missing values
    const receivedSettings = payload.settings || {};
      // Create a properly structured settings object with defaults for missing values
    const validatedSettings = {
        marqueeSettings: {
            enabled: receivedSettings.marqueeSettings?.enabled ?? true,
            speed: receivedSettings.marqueeSettings?.speed ?? 200,
            length: receivedSettings.marqueeSettings?.length ?? 15,
            delay: receivedSettings.marqueeSettings?.delay ?? 2000
        },
        tapSettings: {
            tapBehavior: receivedSettings.tapSettings?.tapBehavior ?? "addToLibrary"
        },
        knobSettings: {
            pressBehavior: receivedSettings.knobSettings?.pressBehavior ?? "togglePlay",
            volumeStep: receivedSettings.knobSettings?.volumeStep ?? 1
        },
        authorization: {
            rpcKey: receivedSettings.authorization?.rpcKey ?? ""
        }
    };
    
    // Update global settings with validated structure
    globalSettings = validatedSettings;
    
    // Load settings into form
    loadSettings();
});