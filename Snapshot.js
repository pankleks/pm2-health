"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Fs = require("fs");
const os_1 = require("os");
const planck_http_fetch_1 = require("planck-http-fetch");
const Log_1 = require("./Log");
const INACTIVE_AFTER_M = 5;
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
        if (this._config.snapshot.inactiveAfterM == null)
            this._config.snapshot.inactiveAfterM = INACTIVE_AFTER_M;
    }
    push(appId, app, key, history, v) {
        if (!this._data.app[appId])
            this._data.app[appId] = { name: app, metric: {}, inactive: false };
        this._data.app[appId].timeStamp = new Date().getTime();
        this._data.app[appId].metric[key] = { history, v };
    }
    last(appId, key) {
        if (!this._data.app[appId] || !this._data.app[appId].metric[key])
            return undefined;
        return this._data.app[appId].metric[key].v.v;
    }
    dump() {
        this._data.timeStamp = new Date().getTime();
        Fs.writeFile(`./History_${new Date().toISOString()}.json`, JSON.stringify(this._data), (ex) => {
            if (ex)
                Log_1.error(`can't dump history -> ${ex.message || ex}`);
        });
    }
    async send() {
        if (!this._config.snapshot.url || !this._config.snapshot.token || this._config.snapshot.disabled === true)
            return;
        try {
            this._data.timeStamp = new Date().getTime();
            const fetch = new planck_http_fetch_1.Fetch(this._config.snapshot.url);
            if (this._config.snapshot.auth && this._config.snapshot.auth.user) // auth
                fetch.basicAuth(this._config.snapshot.auth.user, this._config.snapshot.auth.password);
            await fetch.fetch(JSON.stringify(this._data));
        }
        catch (ex) {
            Log_1.error(`snapshot push failed -> ${ex.message || ex}`);
        }
    }
    inactivate() {
        const t = new Date().getTime();
        for (const id of Object.keys(this._data.app)) {
            const app = this._data.app[id], dt = (t - app.timeStamp) / 60000;
            console.log(`id: ${id}, app: ${app.name}, dt: ${dt} minutes`);
            app.inactive = dt > this._config.snapshot.inactiveAfterM;
        }
    }
}
exports.Snapshot = Snapshot;
//# sourceMappingURL=Snapshot.js.map