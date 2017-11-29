import * as Fs from "fs";
import { hostname } from "os";
import { httpFetch } from "./Http";

export interface IShapshotConfig {
    snapshot: {
        url?: string;
        token?: string;
        disabled?: boolean;
    }
}

interface IValue {
    v: any;
    bad?: boolean;
}

interface IPayload {
    token?: string;
    host: string,
    timeStamp?: number,
    snapshot: {
        [id: number]: {
            app: string;
            metric: {
                [key: string]: IValue;
            }
        }
    }
}

export class Snapshot {
    private _data: IPayload = {
        host: hostname(),
        snapshot: {}
    };

    constructor(private _config: IShapshotConfig) {
        if (!this._config.snapshot)
            this._config.snapshot = {};

        this._data.token = this._config.snapshot.token;
    }

    push(id: number, app: string, key: string, v: IValue) {
        if (!this._data.snapshot[id])
            this._data.snapshot[id] = { app: app, metric: {} };

        this._data.snapshot[id].metric[key] = v;
    }

    last(id: number, key: string) {
        if (!this._data.snapshot[id] || !this._data.snapshot[id].metric[key])
            return undefined;

        return this._data.snapshot[id].metric[key].v;
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
            await httpFetch(this._config.snapshot.url, JSON.stringify(this._data));
        }
        catch (ex) {
            console.error(`http push failed: ${ex.message || ex}`);
        }
    }
}