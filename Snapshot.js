"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Fs = require("fs");
const os_1 = require("os");
const Http_1 = require("./Http");
class Snapshot {
    constructor(_config) {
        this._config = _config;
        this._data = {
            host: os_1.hostname(),
            snapshot: {}
        };
        if (!this._config.snapshot)
            this._config.snapshot = {
                intervalS: 600,
                disabled: true
            };
        if (this._config.snapshot.url && this._config.snapshot.token && this._config.snapshot.disabled !== true) {
            this._data.token = this._config.snapshot.token;
            this.send();
        }
    }
    push(pid, app, key, v) {
        if (!this._data.snapshot[pid])
            this._data.snapshot[pid] = { app: app, metric: {} };
        this._data.snapshot[pid].metric[key] = v;
    }
    last(pid, key) {
        if (!this._data.snapshot[pid] || !this._data.snapshot[pid].metric[key])
            return undefined;
        return this._data.snapshot[pid].metric[key].v;
    }
    dump() {
        this._data.timeStamp = new Date().getTime();
        Fs.writeFile(`History_${new Date().toISOString()}.json`, JSON.stringify(this._data), (ex) => {
            if (ex)
                console.error(`Can't dump history, ${ex.message || ex}`);
        });
    }
    async send() {
        try {
            this._data.timeStamp = new Date().getTime();
            await Http_1.httpFetch(this._config.snapshot.url, JSON.stringify(this._data));
        }
        catch (ex) {
            console.error(`http push failed: ${ex.message || ex}`);
        }
        finally {
            setTimeout(() => {
                this.send();
            }, this._config.snapshot.intervalS * 1000);
        }
    }
}
exports.Snapshot = Snapshot;
//# sourceMappingURL=Snapshot.js.map