"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Fs = require("fs");
const Http_1 = require("./Http");
class History {
    constructor(_config) {
        this._config = _config;
        this._history = {};
        if (this._config.history)
            this._config.history = {
                intervalS: 600,
                maxSamples: 1,
                disabled: true
            };
        if (this._config.history.url && !this._config.history.disabled)
            this.send();
    }
    push(pid, key, value) {
        if (!this._history[pid])
            this._history[pid] = {};
        if (!this._history[pid][key])
            this._history[pid][key] = [];
        let h = this._history[pid][key];
        h.push(value);
        if (h.length > this._config.history.maxSamples)
            h.shift();
    }
    last(pid, key) {
        if (!this._history[pid] || !this._history[pid][key])
            return undefined;
        let h = this._history[pid][key];
        return h[h.length - 1];
    }
    dump() {
        Fs.writeFile(`History_${new Date().toISOString()}.json`, JSON.stringify(this._history), (ex) => {
            if (ex)
                console.error(`Can't dump history, ${ex.message || ex}`);
        });
    }
    async send() {
        try {
            await Http_1.httpFetch(this._config.history.url, JSON.stringify(this._history));
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