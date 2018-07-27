import * as Fs from "fs";
import { hostname } from "os";
import { Fetch } from "planck-http-fetch";
import { error } from "./Log";

const INACTIVE_AFTER_M = 5;

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
        inactiveAfterM?: number;
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
            };
            timeStamp?: number;
            inactive: boolean;
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

        if (this._config.snapshot.inactiveAfterM == null)
            this._config.snapshot.inactiveAfterM = INACTIVE_AFTER_M;
    }

    push(appId: number, app: string, key: string, history: boolean, v: IValue) {
        if (!this._data.app[appId])
            this._data.app[appId] = { name: app, metric: {}, inactive: false };

        this._data.app[appId].timeStamp = new Date().getTime();
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

    inactivate() {
        const t = new Date().getTime();

        for (const id of Object.keys(this._data.app)) {
            const
                app = this._data.app[<any>id],
                dt = (t - app.timeStamp) / 60000;

            console.log(`id: ${id}, app: ${app.name}, dt: ${dt} minutes`);

            app.inactive = dt > this._config.snapshot.inactiveAfterM;
        }
    }
}