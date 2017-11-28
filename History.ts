import * as Fs from "fs";
import { hostname } from "os";
import { httpFetch } from "./Http";

export interface IHistoryConfig {
    history: {
        url?: string;
        token?: string;
        intervalS: number;
        maxSamples: number;
        disabled: boolean;
    }
}

interface IPayload {
    token?: string;
    host: string,
    timeStamp?: number,
    history: {
        [pid: number]: {
            app: string;
            metric: {
                [key: string]: any[];
            }
        }
    }
}

export class History {
    private _data: IPayload = {
        host: hostname(),
        history: {}
    };

    constructor(private _config: IHistoryConfig) {
        if (!this._config.history)
            this._config.history = {
                intervalS: 600,
                maxSamples: 1,
                disabled: true
            };

        if (this._config.history.url && this._config.history.token && this._config.history.disabled !== true) {
            this._data.token = this._config.history.token;
            this.send();
        }
    }

    push(pid: number, app: string, key: string, value: any) {
        if (!this._data.history[pid])
            this._data.history[pid] = { app: app, metric: {} };
        if (!this._data.history[pid].metric[key])
            this._data.history[pid].metric[key] = [];

        let
            h = this._data.history[pid].metric[key];

        h.push(value);
        if (h.length > this._config.history.maxSamples)
            h.shift();
    }

    last(pid: number, key: string) {
        if (!this._data.history[pid] || !this._data.history[pid].metric[key])
            return undefined;

        let
            h = this._data.history[pid].metric[key];
        return h[h.length - 1];
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
            await httpFetch(this._config.history.url, JSON.stringify(this._data));
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