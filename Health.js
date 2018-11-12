"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PM2 = require("pm2");
const Pmx = require("pmx");
const Fs = require("fs");
const path_1 = require("path");
const Mail_1 = require("./Mail");
const Slack_1 = require("./Slack");
const Snapshot_1 = require("./Snapshot");
const planck_http_fetch_1 = require("planck-http-fetch");
const Log_1 = require("./Log");
const MERTIC_INTERVAL_S = 60, HOLD_PERIOD_M = 30, ALIVE_MAX_CONSECUTIVE_TESTS = 6, ALIVE_CONSECUTIVE_TIMEOUT_S = 600, LOGS = ["pm_err_log_path", "pm_out_log_path"], OP = {
    "<": (a, b, t) => a < b && Math.abs(a - b) > t,
    ">": (a, b, t) => a > b && Math.abs(a - b) > t,
    "=": (a, b, t) => a === b,
    "~": (a, b, t) => Math.abs(a - b) > t,
    "<=": (a, b, t) => a <= b,
    ">=": (a, b, t) => a >= b,
    "!=": (a, b, t) => a !== b,
    "!~": (a, b, t) => Math.abs(a - b) > t
}, CONFIG_KEYS = ["events", "metric", "exceptions", "messages", "messageExcludeExps", "appsExcluded", "metricIntervalS", "addLogs", "aliveTimeoutS"];
class Health {
    constructor(_config) {
        this._config = _config;
        this._holdTill = null;
        this._timeouts = new Map();
        if (this._config.metricIntervalS == null || this._config.metricIntervalS < MERTIC_INTERVAL_S) {
            Log_1.info(`setting default metric check interval ${MERTIC_INTERVAL_S} s.`);
            this._config.metricIntervalS = MERTIC_INTERVAL_S;
        }
        if (!this._config.metric)
            this._config.metric = {};
        this._mail = new Mail_1.Mail(_config);
        this._slack = new Slack_1.Slack(_config);
        this._snapshot = new Snapshot_1.Snapshot(this._config);
    }
    async fetchConfig() {
        try {
            Log_1.info(`fetching config from [${this._config.webConfig.url}]`);
            const fetch = new planck_http_fetch_1.Fetch(this._config.webConfig.url);
            if (this._config.webConfig.auth && this._config.webConfig.auth.user) // auth
                fetch.basicAuth(this._config.webConfig.auth.user, this._config.webConfig.auth.password);
            const json = await fetch.fetch(), config = JSON.parse(json);
            // map config keys
            for (const key of CONFIG_KEYS)
                if (config[key]) {
                    this._config[key] = config[key];
                    Log_1.info(`applying [${key}]`);
                }
            this.configChanged();
        }
        catch (ex) {
            Log_1.error(`failed to fetch config -> ${ex.message || ex}`);
        }
    }
    configChanged() {
        this._messageExcludeExps = [];
        if (Array.isArray(this._config.messageExcludeExps))
            this._messageExcludeExps = this._config.messageExcludeExps.map(e => new RegExp(e));
    }
    isAppExcluded(app) {
        return app === "pm2-health" || (Array.isArray(this._config.appsExcluded) && this._config.appsExcluded.indexOf(app) !== -1);
    }
    async go() {
        Log_1.info(`pm2-health is on`);
        this.configChanged();
        // fetch web config (if set)
        if (this._config.webConfig && this._config.webConfig.url) {
            await this.fetchConfig();
            if (this._config.webConfig.fetchIntervalM > 0)
                setInterval(() => {
                    this.fetchConfig();
                }, this._config.webConfig.fetchIntervalM * 60 * 1000);
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
                    this.mail(subject, `
                        <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>
                        <p>Event: <b>${data.event}</b></p>
                        <pre>${JSON.stringify(data, undefined, 4)}</pre>`, "high", LOGS.filter(e => this._config.addLogs === true && data.process[e]).map(e => ({ filename: path_1.basename(data.process[e]), path: data.process[e] })));
                    this.slack(subject, [{
                            title: `App: ${data.process.name}:${data.process.pm_id}`,
                            text: JSON.stringify(data, undefined, 4),
                            fields: [{ title: 'Event', value: data.event }],
                            color: Slack_1.Slack.COLORS.high,
                        }]);
                });
                if (this._config.exceptions)
                    bus.on("process:exception", (data) => {
                        if (this.isAppExcluded(data.process.name))
                            return;
                        const subject = `${data.process.name}:${data.process.pm_id} - exception`;
                        this.mail(subject, `
                            <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>                            
                            <pre>${JSON.stringify(data.data, undefined, 4)}</pre>`, "high");
                        this.slack(subject, [{
                                title: `App: ${data.process.name}:${data.process.pm_id}`,
                                text: JSON.stringify(data.data, undefined, 4),
                                color: Slack_1.Slack.COLORS.high,
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
                        this.mail(subject, `
                            <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>
                            <pre>${json}</pre>`);
                        this.slack(subject, [{
                                title: `App: ${data.process.name}:${data.process.pm_id}`,
                                text: json,
                            }]);
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
            Log_1.info(msg);
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
    aliveReset(process, timeoutS, count = 1) {
        clearTimeout(this._timeouts.get(process.name));
        this._timeouts.set(process.name, setTimeout(() => {
            Log_1.info(`death ${process.name}:${process.pm_id}, count ${count}`);
            const subject = `${process.name}:${process.pm_id} - is death!`;
            this.mail(subject, `
                    <p>App: <b>${process.name}:${process.pm_id}</b></p>
                    <p>This is <b>${count}/${ALIVE_MAX_CONSECUTIVE_TESTS}</b> consecutive notice.</p>`, "high");
            this.slack(subject, [{
                    title: `App: ${process.name}:${process.pm_id}`,
                    text: `This is ${Slack_1.Slack.format(count + '/' + ALIVE_MAX_CONSECUTIVE_TESTS)} consecutive notice.`,
                    color: Slack_1.Slack.COLORS.high,
                }]);
            if (count < ALIVE_MAX_CONSECUTIVE_TESTS)
                this.aliveReset(process, ALIVE_CONSECUTIVE_TIMEOUT_S, count + 1);
        }, timeoutS * 1000));
    }
    hold() {
        const t = new Date();
        if (this._holdTill != null && t < this._holdTill)
            return true; //skip
        return false;
    }
    async mail(subject, body, priority, attachements = []) {
        if (this.hold())
            return;
        try {
            await this._mail.send(subject, body, priority, attachements);
            Log_1.info(`mail [${subject}] sent`);
        }
        catch (ex) {
            Log_1.error(`mail failed -> ${ex.message || ex}`);
        }
    }
    async slack(subject, attachements = []) {
        if (this.hold())
            return;
        try {
            await this._slack.send(subject, attachements);
            Log_1.info(`slack [${subject}] sent`);
        }
        catch (ex) {
            Log_1.error(`slack failed -> ${ex.message || ex}`);
        }
    }
    testProbes() {
        const alerts = [];
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
                    let v = monit[key].value, bad;
                    if (!probe.direct) {
                        v = Number.parseFloat(v);
                        if (Number.isNaN(v)) {
                            Log_1.error(`monit [${app.name}.${key}] -> [${monit[key].value}] is not a number`);
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
                        });
                    const data = { v };
                    if (bad) // safe space by not storing false
                        data.bad = true;
                    this._snapshot.push(app.pm_id, app.name, key, !probe.noHistory, data);
                }
            }
            this._snapshot.inactivate();
            await this._snapshot.send();
            if (alerts.length > 0) {
                const subject = `${alerts.length} alert(s)`;
                this.mail(subject, `
                    <table>
                        <tr>
                            <th>App</th><th>Metric</th><th>Value</th><th>Prev. Value</th><th>Target</th>
                        </tr>
                        ${alerts
                    .map(alert => `<tr><td>${alert.name}:${alert.id}</td><td>${alert.key}</td><td>${alert.v}</td><td>${alert.lastV}</td><td>${alert.targetV}</td></tr>`)
                    .join("")}
                    </table>`, "high");
                this.slack(subject, alerts.map((alert) => {
                    return {
                        title: `App: ${alert.name}:${alert.id}`,
                        fields: [{ title: 'Metric', value: alert.key }, { title: 'Value', value: alert.v }, { title: 'Prev. Value', value: alert.lastV }, { title: 'Target Value', value: alert.targetV }],
                        color: Slack_1.Slack.COLORS.high,
                    };
                }));
            }
            setTimeout(() => { this.testProbes(); }, 1000 * this._config.metricIntervalS);
        });
    }
}
exports.Health = Health;
function stopIfEx(ex) {
    if (ex) {
        console.error(ex.message || ex);
        PM2.disconnect();
        process.exit(1);
    }
}
exports.stopIfEx = stopIfEx;
//# sourceMappingURL=Health.js.map