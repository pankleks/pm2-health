import * as Fs from "fs";
import { hostname } from "os";
import { Fetch } from "planck-http-fetch";
import { error } from "./Log";

export interface IAuth {
    user: string;
    password: string;
}

export interface IShapshotConfig {
    snapshot: {
        url?: string;
        auth?: IAuth,
        token?: string;
        disabled?: boolean;
    }
}

interface IValue {
    v: any;
    bad?: boolean;
}

export interface IPayload {
    token?: string;
    host: string,
    timeStamp?: number,
    app: {
        [appId: number]: {
            name: string;
            metric: {
                [key: string]: {
                    history: boolean;
                    v: IValue;
                };
            }
        }
    }
}

export class Snapshot {
    private _data: IPayload = {
        host: hostname(),
        app: {}
    };

    constructor(private _config: IShapshotConfig) {
        if (!this._config.snapshot)
            this._config.snapshot = {};

        this._data.token = this._config.snapshot.token;
    }

    push(appId: number, app: string, key: string, history: boolean, v: IValue) {
        if (!this._data.app[appId])
            this._data.app[appId] = { name: app, metric: {} };

        this._data.app[appId].metric[key] = { history, v };
    }

    last(appId: number, key: string) {
        if (!this._data.app[appId] || !this._data.app[appId].metric[key])
            return undefined;

        return this._data.app[appId].metric[key].v.v;
    }

    dump() {
        this._data.timeStamp = new Date().getTime();
        Fs.writeFile(`./History_${new Date().toISOString()}.json`, JSON.stringify(this._data), (ex) => {
            if (ex)
                error(`can't dump history -> ${ex.message || ex}`);
        });
    }

    async send() {
        if (!this._config.snapshot.url || !this._config.snapshot.token || this._config.snapshot.disabled === true)
            return;

        try {
            this._data.timeStamp = new Date().getTime();

            const fetch = new Fetch(this._config.snapshot.url);

            if (this._config.snapshot.auth && this._config.snapshot.auth.user)  // auth
                fetch.basicAuth(this._config.snapshot.auth.user, this._config.snapshot.auth.password);

            await fetch.fetch(JSON.stringify(this._data));
        }
        catch (ex) {
            error(`snapshot push failed -> ${ex.message || ex}`);
        }
    }
}