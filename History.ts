import * as Fs from "fs";
import { httpFetch } from "./Http";

export interface IHistoryConfig {
    history: {
        url?: string;
        intervalS: number;
        maxSamples: number;
        disabled: boolean;
    }
}

export class History {
    private _history: {
        [pid: number]: {
            [key: string]: any[]
        }
    } = {};

    constructor(private _config: IHistoryConfig) {
        if (this._config.history)
            this._config.history = {
                intervalS: 600,
                maxSamples: 1,
                disabled: true
            };

        if (this._config.history.url && !this._config.history.disabled)
            this.send();
    }

    push(pid: number, key: string, value: any) {
        if (!this._history[pid])
            this._history[pid] = {};
        if (!this._history[pid][key])
            this._history[pid][key] = [];

        let
            h = this._history[pid][key];

        h.push(value);
        if (h.length > this._config.history.maxSamples)
            h.shift();
    }

    last(pid: number, key: string) {
        if (!this._history[pid] || !this._history[pid][key])
            return undefined;

        let
            h = this._history[pid][key];
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
            await httpFetch(this._config.history.url, JSON.stringify(this._history));
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