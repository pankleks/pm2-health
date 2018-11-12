import * as PM2 from "pm2";
import * as Pmx from "pmx";
import * as Fs from "fs";
import { basename } from "path";
import { Mail, ISmtpConfig } from "./Mail";
import { Slack, ISlackConfig, SlackAttachement } from './Slack';
import { Snapshot, IShapshotConfig, IAuth } from "./Snapshot";
import { Fetch } from "planck-http-fetch";
import { info, error } from "./Log";

const
    MERTIC_INTERVAL_S = 60,
    HOLD_PERIOD_M = 30,
    ALIVE_MAX_CONSECUTIVE_TESTS = 6,
    ALIVE_CONSECUTIVE_TIMEOUT_S = 600,
    LOGS = ["pm_err_log_path", "pm_out_log_path"],
    OP = {
        "<": (a, b, t) => a < b && Math.abs(a - b) > t,
        ">": (a, b, t) => a > b && Math.abs(a - b) > t,
        "=": (a, b, t) => a === b,
        "~": (a, b, t) => Math.abs(a - b) > t,
        "<=": (a, b, t) => a <= b,
        ">=": (a, b, t) => a >= b,
        "!=": (a, b, t) => a !== b,
        "!~": (a, b, t) => Math.abs(a - b) > t
    },
    CONFIG_KEYS = ["events", "metric", "exceptions", "messages", "messageExcludeExps", "appsExcluded", "metricIntervalS", "addLogs", "aliveTimeoutS"];

interface IMonitConfig {
    events: string[];
    metric: {
        [key: string]: {
            target?: any;
            op?: "<" | ">" | "=" | "<=" | ">=" | "!=";
            ifChanged?: boolean;
            noHistory?: boolean;
            noNotify: boolean;
            exclude?: boolean;
            direct?: boolean;
            tolerance?: number;
        }
    },
    exceptions: boolean;
    messages: boolean;
    messageExcludeExps: string;
    appsExcluded: string[];
    metricIntervalS: number;
    addLogs: boolean;
    aliveTimeoutS: number;
}

interface IConfig extends IMonitConfig, ISmtpConfig, ISlackConfig, IShapshotConfig {
    webConfig: {
        url: string;
        auth?: IAuth;
        fetchIntervalM: number;
    }
}

export class Health {
    readonly _mail: Mail;
    readonly _slack: Slack;
    readonly _snapshot: Snapshot;
    _holdTill: Date = null;

    constructor(private _config: IConfig) {
        if (this._config.metricIntervalS == null || this._config.metricIntervalS < MERTIC_INTERVAL_S) {
            info(`setting default metric check interval ${MERTIC_INTERVAL_S} s.`);
            this._config.metricIntervalS = MERTIC_INTERVAL_S;
        }

        if (!this._config.metric)
            this._config.metric = {};

        this._mail = new Mail(_config);
        this._slack = new Slack(_config);
        this._snapshot = new Snapshot(this._config);
    }

    async fetchConfig() {
        try {
            info(`fetching config from [${this._config.webConfig.url}]`);

            const fetch = new Fetch(this._config.webConfig.url);
            if (this._config.webConfig.auth && this._config.webConfig.auth.user)  // auth
                fetch.basicAuth(this._config.webConfig.auth.user, this._config.webConfig.auth.password);
            const
                json = await fetch.fetch(),
                config = JSON.parse(json);

            // map config keys
            for (const key of CONFIG_KEYS)
                if (config[key]) {
                    this._config[key] = config[key];
                    info(`applying [${key}]`);
                }

            this.configChanged();
        }
        catch (ex) {
            error(`failed to fetch config -> ${ex.message || ex}`);
        }
    }

    _messageExcludeExps: RegExp[];

    configChanged() {
        this._messageExcludeExps = [];
        if (Array.isArray(this._config.messageExcludeExps))
            this._messageExcludeExps = this._config.messageExcludeExps.map(e => new RegExp(e));
    }

    isAppExcluded(app: string) {
        return app === "pm2-health" || (Array.isArray(this._config.appsExcluded) && this._config.appsExcluded.indexOf(app) !== -1);
    }

    async go() {
        info(`pm2-health is on`);

        this.configChanged();

        // fetch web config (if set)
        if (this._config.webConfig && this._config.webConfig.url) {
            await this.fetchConfig();

            if (this._config.webConfig.fetchIntervalM > 0)
                setInterval(
                    () => {
                        this.fetchConfig();
                    },
                    this._config.webConfig.fetchIntervalM * 60 * 1000);
        }

        PM2.connect((ex) => {
            stopIfEx(ex);

            PM2.launchBus((ex, bus) => {
                stopIfEx(ex);

                bus.on("process:event", (data) => {
                    if (data.manually || this.isAppExcluded(data.process.name))
                        return;

                    if (Array.isArray(this._config.events) && this._config.events.indexOf(data.event) === -1)
                        return;

                    const subject = `${data.process.name}:${data.process.pm_id} - ${data.event}`;

                    this.mail(
                        subject,
                        `
                        <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>
                        <p>Event: <b>${data.event}</b></p>
                        <pre>${JSON.stringify(data, undefined, 4)}</pre>`,
                        "high",
                        LOGS.filter(e => this._config.addLogs === true && data.process[e]).map(e => ({ filename: basename(data.process[e]), path: data.process[e] })));

                    this.slack(
                        subject,
                        [{
                            title: `App: ${data.process.name}:${data.process.pm_id}`,
                            text: JSON.stringify(data, undefined, 4),
                            fields: [{ title: 'Event', value: data.event }],
                            color: Slack.COLORS.high,
                            // TODO: read logs and send in slack msg
                        }]);
                });

                if (this._config.exceptions)
                    bus.on("process:exception", (data) => {
                        if (this.isAppExcluded(data.process.name))
                            return;

                        const subject = `${data.process.name}:${data.process.pm_id} - exception`;

                        this.mail(
                            subject,
                            `
                            <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>                            
                            <pre>${JSON.stringify(data.data, undefined, 4)}</pre>`,
                            "high");

                        this.slack(
                            subject,
                            [{
                                title: `App: ${data.process.name}:${data.process.pm_id}`,
                                text: JSON.stringify(data.data, undefined, 4),
                                color: Slack.COLORS.high,
                            }]);
                    });

                if (this._config.messages)
                    bus.on("process:msg", (data) => {
                        if (this.isAppExcluded(data.process.name))
                            return;

                        if (data.data === "alive") {
                            this.aliveReset(data.process, this._config.aliveTimeoutS);
                            return;
                        }

                        const json = JSON.stringify(data.data, undefined, 4);

                        if (this._messageExcludeExps.some(e => e.test(json)))
                            return; // exclude

                        const subject = `${data.process.name}:${data.process.pm_id} - message`;

                        this.mail(
                            subject,
                            `
                            <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>
                            <pre>${json}</pre>`);

                        this.slack(
                            subject,
                            [{
                                title: `App: ${data.process.name}:${data.process.pm_id}`,
                                text: json,
                            }])
                    });
            });

            this.testProbes();
        });

        Pmx.action("hold", (p, reply) => {
            let t = HOLD_PERIOD_M;
            if (p) {
                const n = Number.parseInt(p);
                if (!Number.isNaN(n))
                    t = n;
            }

            this._holdTill = new Date();
            this._holdTill.setTime(this._holdTill.getTime() + t * 60000);

            const msg = `mail/slack held for ${t} minutes, till ${this._holdTill.toISOString()}`;
            info(msg);
            reply(msg);
        });

        Pmx.action("unheld", (reply) => {
            this._holdTill = null;
            reply(`mail/slack unheld`);
        });

        Pmx.action("mail", async (reply) => {
            try {
                await this._mail.send("Test only", "This is test only.");
                reply(`mail send`);
            }
            catch (ex) {
                reply(`mail failed: ${ex.message || ex}`);
            }
        });

        Pmx.action("slack", async (reply) => {
            try {
                await this._slack.send("Test only", [{ title: "This is test only." }]);
                reply(`slack sent`);
            }
            catch (ex) {
                reply(`slack failed: ${ex.message || ex}`);
            }
        });

        Pmx.action("dump", (reply) => {
            this._snapshot.dump();
            reply(`dumping`);
        });

        // for dev. only
        Pmx.action("debug", reply => {
            PM2.list((ex, list) => {
                stopIfEx(ex);

                Fs.writeFileSync("pm2-health-debug.json", JSON.stringify(list));
                Fs.writeFileSync("pm2-health-config.json", JSON.stringify(this._config));

                reply(`dumping`);
            });
        });
    }

    private _timeouts = new Map<string, NodeJS.Timer>();

    private aliveReset(process: { name, pm_id }, timeoutS: number, count = 1) {
        clearTimeout(this._timeouts.get(process.name));

        this._timeouts.set(
            process.name,
            setTimeout(() => {
                info(`death ${process.name}:${process.pm_id}, count ${count}`);
                const subject = `${process.name}:${process.pm_id} - is death!`;

                this.mail(
                    subject,
                    `
                    <p>App: <b>${process.name}:${process.pm_id}</b></p>
                    <p>This is <b>${count}/${ALIVE_MAX_CONSECUTIVE_TESTS}</b> consecutive notice.</p>`,
                    "high");

                this.slack(
                    subject,
                    [{
                        title: `App: ${process.name}:${process.pm_id}`,
                        text: `This is ${Slack.format(count + '/' + ALIVE_MAX_CONSECUTIVE_TESTS)} consecutive notice.`,
                        color: Slack.COLORS.high,
                    }]);

                if (count < ALIVE_MAX_CONSECUTIVE_TESTS)
                    this.aliveReset(process, ALIVE_CONSECUTIVE_TIMEOUT_S, count + 1);
            }, timeoutS * 1000));
    }

    private hold() {
        const t = new Date();
        if (this._holdTill != null && t < this._holdTill)
            return true; //skip
        return false;
    }

    private async mail(subject: string, body: string, priority?: "high" | "low", attachements = []) {
        if (this.hold()) return;

        try {
            await this._mail.send(subject, body, priority, attachements);
            info(`mail [${subject}] sent`);
        }
        catch (ex) {
            error(`mail failed -> ${ex.message || ex}`);
        }
    }

    private async slack(subject: string, attachements: SlackAttachement[] = []) {
        if (this.hold()) return;

        try {
            await this._slack.send(subject, attachements);
            info(`slack [${subject}] sent`);
        }
        catch (ex) {
            error(`slack failed -> ${ex.message || ex}`);
        }
    }

    private testProbes() {
        const alerts: {
            name: any,
            id: any,
            key: any,
            v: any,
            lastV: any,
            targetV: any,
        }[] = [];

        PM2.list(async (ex, list) => {
            stopIfEx(ex);

            for (const app of list) {
                if (this.isAppExcluded(app.name))
                    continue;

                let monit = app.pm2_env["axm_monitor"];
                if (!monit)
                    monit = {};

                // add memory + cpu metrics
                if (app.monit) {
                    monit["memory"] = { value: app.monit.memory / 1048576 };
                    monit["cpu"] = { value: app.monit.cpu };
                }

                if (app.pm2_env) {
                    if (app.pm2_env["_pm2_version"])
                        monit["pm2"] = { value: app.pm2_env["_pm2_version"], direct: true };

                    if (app.pm2_env["node_version"])
                        monit["node"] = { value: app.pm2_env["node_version"], direct: true };
                }

                for (const key of Object.keys(monit)) {
                    let probe = this._config.metric[key];
                    if (!probe)
                        probe = { noNotify: true, direct: monit[key].direct === true, noHistory: monit[key].direct === true };

                    if (probe.exclude === true)
                        continue;

                    let
                        v = monit[key].value,
                        bad: boolean;

                    if (!probe.direct) {
                        v = Number.parseFloat(v);
                        if (Number.isNaN(v)) {
                            error(`monit [${app.name}.${key}] -> [${monit[key].value}] is not a number`);
                            continue;
                        }
                    }

                    if (probe.op && probe.op in OP && probe.target != null)
                        bad = OP[probe.op](v, probe.target, probe.tolerance || 0);

                    // test
                    if (probe.noNotify !== true && bad === true && (probe.ifChanged !== true || this._snapshot.last(app.pm_id, key) !== v))
                        alerts.push({
                            name: app.name,
                            id: app.pm_id,
                            key,
                            v,
                            lastV: this._snapshot.last(app.pm_id, key),
                            targetV: probe.target,
                        })

                    const data: any = { v }
                    if (bad)    // safe space by not storing false
                        data.bad = true;

                    this._snapshot.push(app.pm_id, app.name, key, !probe.noHistory, data);
                }
            }

            this._snapshot.inactivate();
            await this._snapshot.send();

            if (alerts.length > 0) {
                const subject = `${alerts.length} alert(s)`;

                this.mail(subject,
                    `
                    <table>
                        <tr>
                            <th>App</th><th>Metric</th><th>Value</th><th>Prev. Value</th><th>Target</th>
                        </tr>
                        ${alerts
                        .map(alert => `<tr><td>${alert.name}:${alert.id}</td><td>${alert.key}</td><td>${alert.v}</td><td>${alert.lastV}</td><td>${alert.targetV}</td></tr>`)
                        .join("")}
                    </table>`,
                    "high");

                this.slack(subject,
                    alerts.map((alert) => {
                        return {
                            title: `App: ${alert.name}:${alert.id}`,
                            fields: [{ title: 'Metric', value: alert.key }, { title: 'Value', value: alert.v }, { title: 'Prev. Value', value: alert.lastV }, { title: 'Target Value', value: alert.targetV }],
                            color: Slack.COLORS.high,
                        };
                    }));
            }

            setTimeout(
                () => { this.testProbes(); },
                1000 * this._config.metricIntervalS);
        });
    }
}

export function stopIfEx(ex: Error) {
    if (ex) {
        console.error(ex.message || ex);
        PM2.disconnect();
        process.exit(1);
    }
}