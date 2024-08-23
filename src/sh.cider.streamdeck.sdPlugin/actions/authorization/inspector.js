/// <reference path="../../libs/js/property-inspector.js" />
/// <reference path="../../libs/js/utils.js" />

let globalSettings = {};

$PI.onConnected((jsn) => {
    const {actionInfo, appInfo, connection, messageType, port, uuid} = jsn;
    $PI.getGlobalSettings();
});

function loadSettings() {
    document.querySelectorAll('[data-setting]').forEach(element => {
        const settingName = element.dataset.setting;
        let value;

        if (settingName === 'useAdaptiveIcons') {
            value = globalSettings.iconSettings?.useAdaptiveIcons;
        } else if (['enableMarquee', 'marqueeSpeed', 'marqueeLength', 'marqueeDelay'].includes(settingName)) {
            value = globalSettings.marqueeSettings?.[settingName === 'enableMarquee' ? 'enabled' : settingName];
        } else if (settingName === 'authKey') {
            value = globalSettings.authorization?.rpcKey;
            console.log('authKey value:', value);
            console.log('globalSettings:', globalSettings);
        }

        if (element.type === 'checkbox') {
            element.checked = value ?? element.checked;
        } else if (element.type === 'number') {
            element.value = value ?? element.value;
        } else if (element.type === 'select-one') {
            element.value = value ?? element.value;
        } else if (element.type === 'range') {
            element.value = value ?? element.value;
        } else {
            element.value = value ?? '';
        }
    });
    
    updateMarqueeControls();
}

function saveSettings() {
    document.querySelectorAll('[data-setting]').forEach(element => {
        const settingName = element.dataset.setting;
        if (element.type === 'checkbox') {
            globalSettings[settingName] = element.checked;
        } else if (element.type === 'number') {
            globalSettings[settingName] = parseInt(element.value);
        } else {
            globalSettings[settingName] = element.value;
        }
    });

    const configJSON = {
        iconSettings: {
            useAdaptiveIcons: globalSettings.useAdaptiveIcons
        },
        marqueeSettings: {
            enabled: globalSettings.enableMarquee,
            speed: globalSettings.marqueeSpeed,
            length: globalSettings.marqueeLength,
            delay: globalSettings.marqueeDelay
        },
        tapSettings: {
            tapBehavior: globalSettings.tapBehavior
        },
        knobSettings: {
            pressBehavior: globalSettings.pressBehavior,
            volumeStep: globalSettings.volumeStep
        },
        authorization: {
            rpcKey: globalSettings.authKey
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
    
    const defaultSettings = {
        iconSettings: {
            useAdaptiveIcons: true,
        },
        marqueeSettings: {
            enabled: true,
            speed: 200,
            length: 15,
            delay: 2000,
        },
        tapSettings: {
            tapBehavior: "addToLibrary",
        },
        knobSettings: {
            pressBehavior: "togglePlay",
            volumeStep: 1,
        },
        authorization: {
            rpcKey: ""
        }
    };

    globalSettings = defaultSettings;
    loadSettings();
    saveSettings();
});

$PI.onDidReceiveGlobalSettings(({payload}) => {
    console.log('Received global settings:', payload.settings);
    globalSettings = payload.settings;
    loadSettings();
});