/// <reference path="../../libs/js/property-inspector.js" />
/// <reference path="../../libs/js/utils.js" />

$PI.onConnected((jsn) => {
    const {actionInfo, appInfo, connection, messageType, port, uuid} = jsn;
    const {payload, context} = actionInfo;
    const {settings} = payload;
    $PI.getGlobalSettings();
});

let form = document.querySelector('#property-inspector');

$PI.onDidReceiveGlobalSettings(({payload}) => {
    console.log('onDidReceiveGlobalSettings', payload);
    form.querySelector('#authKey').value = payload.settings.authkey;
})

document.querySelector('#authorize').addEventListener('click', () => {
    let authKey = Utils.getFormValue(form);
    $PI.setGlobalSettings(authKey);
    console.log('button clicked yo!', authKey);
});