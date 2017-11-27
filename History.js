"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Fs = require("fs");
const os_1 = require("os");
const Http_1 = require("./Http");
class History {
    constructor(_config) {
        this._config = _config;
        this._data = {
            host: os_1.hostname(),
            history: {}
        };
        if (this._config.history)
            this._config.history = {
                intervalS: 600,
                maxSamples: 1,
                disabled: true
            };
        if (this._config.history.url && !this._config.history.disabled)
            this.send();
    }
    push(pid, app, key, value) {
        if (!this._data.history[pid])
            this._data.history[pid] = { app: app, metric: {} };
        if (!this._data.history[pid].metric[key])
            this._data.history[pid].metric[key] = [];
        let h = this._data.history[pid].metric[key];
        h.push(value);
        if (h.length > this._config.history.maxSamples)
            h.shift();
    }
    last(pid, key) {
        if (!this._data.history[pid] || !this._data.history[pid].metric[key])
            return undefined;
        let h = this._data.history[pid].metric[key];
        return h[h.length - 1];
    }
    dump() {
        Fs.writeFile(`History_${new Date().toISOString()}.json`, JSON.stringify(this._data), (ex) => {
            if (ex)
                console.error(`Can't dump history, ${ex.message || ex}`);
        });
    }
    async send() {
        try {
            this._data.timeStamp = new Date().getTime();
            await Http_1.httpFetch(this._config.history.url, JSON.stringify(this._data));
        }
        catch (ex) {
            console.error(`http push failed: ${ex.message || ex}`);
        }
        finally {
            setTimeout(() => {
                this.send();
            }, this._config.history.intervalS * 1000);
        }
    }
}
exports.History = History;
//# sourceMappingURL=History.js.map