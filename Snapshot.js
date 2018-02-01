"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Fs = require("fs");
const os_1 = require("os");
const planck_http_fetch_1 = require("planck-http-fetch");
class Snapshot {
    constructor(_config) {
        this._config = _config;
        this._data = {
            host: os_1.hostname(),
            app: {}
        };
        if (!this._config.snapshot)
            this._config.snapshot = {};
        this._data.token = this._config.snapshot.token;
    }
    push(appId, app, key, history, v) {
        if (!this._data.app[appId])
            this._data.app[appId] = { name: app, metric: {} };
        this._data.app[appId].metric[key] = { history, v };
    }
    last(appId, key) {
        if (!this._data.app[appId] || !this._data.app[appId].metric[key])
            return undefined;
        return this._data.app[appId].metric[key].v.v;
    }
    dump() {
        this._data.timeStamp = new Date().getTime();
        Fs.writeFile(`History_${new Date().toISOString()}.json`, JSON.stringify(this._data), (ex) => {
            if (ex)
                console.error(`Can't dump history, ${ex.message || ex}`);
        });
    }
    async send() {
        if (!this._config.snapshot.url || !this._config.snapshot.token || this._config.snapshot.disabled === true)
            return;
        try {
            this._data.timeStamp = new Date().getTime();
            await new planck_http_fetch_1.Fetch(this._config.snapshot.url).fetch(JSON.stringify(this._data));
        }
        catch (ex) {
            console.error(`http push failed: ${ex.message || ex}`);
        }
    }
}
exports.Snapshot = Snapshot;
//# sourceMappingURL=Snapshot.js.map