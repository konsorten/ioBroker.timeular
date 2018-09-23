/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils =       require(__dirname + '/lib/utils'); // Get common adapter utils
const adapter =     new utils.Adapter('timeular');

const axios =       require('axios');

let connected = false;
let token = null;

let timer;

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        clearInterval(timer);
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});



// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

async function error(message) {
    connected = false;
    token = null;
    adapter.setState("connected", { val: true });
    adapter.setState("error", { val: message });
}

async function update() {
    try {

        const response = await axios.get("https://api.timeular.com/api/v2/tracking", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if(!response || !response.data)
            return;

        if(response.data.currentTracking === null) {
            adapter.setState("tracking", { val: false });
        } else {
            adapter.setState("tracking", { val: true });
        }

        ["currentTracking.startedAt", "currentTracking.activity.id", "currentTracking.activity.name", "currentTracking.activity.color", "currentTracking.note.text"].forEach(key => {
            let val = key.split(".").reduce((obj, nextKey)=>obj && obj[nextKey] ? obj[nextKey] : null, response.data);
            adapter.setState(key, { val });
        });

    } catch(ex) {

            throw ex;

    }
}

async function main() {

    let { apiKey, apiSecret } = adapter.config;

    if(!apiKey || !apiSecret) 
        return error("You must provide both apiKey and apiSecret");

    if(!apiKey.match(/^(?:[a-zA-Z0-9+\/]{4})*(?:|(?:[a-zA-Z0-9+\/]{3}=)|(?:[a-zA-Z0-9+\/]{2}==)|(?:[a-zA-Z0-9+\/]{1}===))$/))
        return error("API key did not match the required format");

    if(!apiSecret.match(/^(?:[a-zA-Z0-9+\/]{4})*(?:|(?:[a-zA-Z0-9+\/]{3}=)|(?:[a-zA-Z0-9+\/]{2}==)|(?:[a-zA-Z0-9+\/]{1}===))$/))
        return error("API secret did not match the required format");

    try {

        const response = await axios.post("https://api.timeular.com/api/v2//developer/sign-in", {
            apiKey: adapter.config.apiKey,
            apiSecret: adapter.config.apiSecret
        });

        if(!response || !response.data || !response.data.token)
            return error("Cannot get api token");

        if(!response.data.token.match(/[A-Za-z0-9\-\._~\+\/]+=*/))
            return error("Got an invalid api token");

        connected = true;
        token = response.data.token;

        adapter.setState('connected', { val: true });

    } catch(ex) {

        if (ex && ex.response && ex.response.data && ex.response.data.message) {
            return error(ex.response.data.message);
        } else {
            throw ex;
        }

    }

    update();

    timer = setInterval(() => {
        update();
    }, parseInt(adapter.config.updateInterval) * 1000 || 60 * 1000);



}
