"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopIfEx = exports.Health = void 0;
const PM2 = require("pm2");
const Pmx = require("pmx");
const Fs = require("fs");
const path_1 = require("path");
const Snapshot_1 = require("./Snapshot");
const planck_http_fetch_1 = require("planck-http-fetch");
const Log_1 = require("./Log");
const Notify_1 = require("./Notify");
const MERTIC_INTERVAL_S = 60, HOLD_PERIOD_M = 30, ALIVE_MAX_CONSECUTIVE_TESTS = 6, ALIVE_CONSECUTIVE_TIMEOUT_S = 600, LOGS = ["pm_err_log_path", "pm_out_log_path"], OP = {
    "<": (a, b, t) => a < b && Math.abs(a - b) > t,
    ">": (a, b, t) => a > b && Math.abs(a - b) > t,
    "=": (a, b, t) => a === b,
    "~": (a, b, t) => Math.abs(a - b) > t,
    "<=": (a, b, t) => a <= b,
    ">=": (a, b, t) => a >= b,
    "!=": (a, b, t) => a !== b,
    "!~": (a, b, t) => Math.abs(a - b) > t
};
// keys that can be updated by web config
const CONFIG_KEYS = ["events", "metric", "exceptions", "messages", "messageExcludeExps", "appsExcluded", "metricIntervalS", "addLogs", "aliveTimeoutS", "batchPeriodM", "batchMaxMessages", "mailTo", "replyTo"];
class Health {
    constructor(_config) {
        this._config = _config;
        this._timeouts = new Map();
        if (this._config.debugLogEnabled === true)
            Log_1.enableDebugLog();
        Log_1.debug(JSON.stringify(this._config, undefined, 2));
        if (this._config.metricIntervalS == null || this._config.metricIntervalS < MERTIC_INTERVAL_S) {
            Log_1.info(`setting default metric check interval ${MERTIC_INTERVAL_S} s.`);
            this._config.metricIntervalS = MERTIC_INTERVAL_S;
        }
        if (!this._config.metric)
            this._config.metric = {};
        this._notify = new Notify_1.Notify(_config);
        this._snapshot = new Snapshot_1.Snapshot(this._config);
    }
    async fetchConfig() {
        // todo: what if web config contains invalid data, changes should be reversed
        try {
            Log_1.info(`fetching config from [${this._config.webConfig.url}]`);
            const fetch = new planck_http_fetch_1.Fetch(this._config.webConfig.url);
            if (this._config.webConfig.auth && this._config.webConfig.auth.user) // auth
                fetch.basicAuth(this._config.webConfig.auth.user, this._config.webConfig.auth.password);
            const json = await fetch.fetch(), config = JSON.parse(json);
            // map config keys
            for (const key of CONFIG_KEYS)
                if (config[key] != null) {
                    this._config[key] = config[key];
                    Log_1.info(`applying [${key}] = ${config[key]}`);
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
        this._notify.configChanged();
    }
    isAppIncluded(app) {
        if (app === "pm2-health")
            return false;
        if (Array.isArray(this._config.appsIncluded))
            return this._config.appsIncluded.includes(app);
        if (Array.isArray(this._config.appsExcluded))
            return !this._config.appsExcluded.includes(app);
        return false;
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
                    if (data.manually || !this.isAppIncluded(data.process.name))
                        return;
                    if (Array.isArray(this._config.events) && this._config.events.indexOf(data.event) === -1)
                        return;
                    this._notify.send({
                        subject: `${data.process.name}:${data.process.pm_id} - ${data.event}`,
                        body: `
                        <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>
                        <p>Event: <b>${data.event}</b></p>
                        <pre>${JSON.stringify(data, undefined, 4)}</pre>`,
                        priority: "high",
                        attachements: LOGS.filter(e => this._config.addLogs === true && data.process[e]).map(e => ({ filename: path_1.basename(data.process[e]), path: data.process[e] }))
                    });
                });
                if (this._config.exceptions)
                    bus.on("process:exception", (data) => {
                        if (!this.isAppIncluded(data.process.name))
                            return;
                        this._notify.send({
                            subject: `${data.process.name}:${data.process.pm_id} - exception`,
                            body: `
                            <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>                            
                            <pre>${JSON.stringify(data.data, undefined, 4)}</pre>`,
                            priority: "high"
                        });
                    });
                if (this._config.messages)
                    bus.on("process:msg", (data) => {
                        if (!this.isAppIncluded(data.process.name))
                            return;
                        if (data.data === "alive") {
                            this.aliveReset(data.process, this._config.aliveTimeoutS);
                            return;
                        }
                        const json = JSON.stringify(data.data, undefined, 4);
                        if (this._messageExcludeExps.some(e => e.test(json)))
                            return; // exclude
                        this._notify.send({
                            subject: `${data.process.name}:${data.process.pm_id} - message`,
                            body: `
                            <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>
                            <pre>${json}</pre>`
                        });
                    });
            });
            this.testProbes();
        });
        Pmx.action("hold", undefined, (p, reply) => {
            let t = HOLD_PERIOD_M;
            if (p) {
                const n = Number.parseInt(p);
                if (!Number.isNaN(n))
                    t = n;
            }
            const holdTill = new Date();
            holdTill.setTime(holdTill.getTime() + t * 60000);
            this._notify.hold(holdTill);
            const msg = `mail held for ${t} minutes, till ${holdTill.toISOString()}`;
            Log_1.info(msg);
            reply(msg);
        });
        Pmx.action("unheld", undefined, (reply) => {
            this._notify.hold(null);
            Log_1.info("mail unheld");
            reply("mail unheld");
        });
        Pmx.action("mail", undefined, async (reply) => {
            try {
                await this._notify.send({ subject: "Test only", body: "This is test only.", priority: "high" }); // high -> to bypass batching
                Log_1.info("mail send");
                reply("mail send");
            }
            catch (ex) {
                reply(`mail failed: ${ex.message || ex}`);
            }
        });
        Pmx.action("dump", undefined, (reply) => {
            this._snapshot.dump();
            reply(`dumping`);
        });
        // for dev. only
        Pmx.action("debug", undefined, (reply) => {
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
            this._notify.send({
                subject: `${process.name}:${process.pm_id} - is death!`,
                body: `
                    <p>App: <b>${process.name}:${process.pm_id}</b></p>
                    <p>This is <b>${count}/${ALIVE_MAX_CONSECUTIVE_TESTS}</b> consecutive notice.</p>`,
                priority: "high"
            });
            if (count < ALIVE_MAX_CONSECUTIVE_TESTS)
                this.aliveReset(process, ALIVE_CONSECUTIVE_TIMEOUT_S, count + 1);
        }, timeoutS * 1000));
    }
    testProbes() {
        Log_1.debug("testing probes");
        const alerts = [];
        PM2.list(async (ex, list) => {
            stopIfEx(ex);
            for (const app of list) {
                if (!this.isAppIncluded(app.name))
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
                        alerts.push(`<tr><td>${app.name}:${app.pm_id}</td><td>${key}</td><td>${v}</td><td>${this._snapshot.last(app.pm_id, key)}</td><td>${probe.target}</td></tr>`);
                    const data = { v };
                    if (bad) // safe space by not storing false
                        data.bad = true;
                    this._snapshot.push(app.pm_id, app.name, key, !probe.noHistory, data);
                }
            }
            this._snapshot.inactivate();
            await this._snapshot.send();
            if (alerts.length > 0)
                this._notify.send({
                    subject: `${alerts.length} alert(s)`,
                    body: `
                    <table>
                        <tr>
                            <th>App</th><th>Metric</th><th>Value</th><th>Prev. Value</th><th>Target</th>
                        </tr>
                        ${alerts.join("")}
                    </table>`,
                    priority: "high"
                });
            setTimeout(() => { this.testProbes(); }, 1000 * this._config.metricIntervalS);
        });
    }
}
exports.Health = Health;
function stopIfEx(ex) {
    if (ex) {
        Log_1.error(ex.message || ex);
        PM2.disconnect();
        process.exit(1);
    }
}
exports.stopIfEx = stopIfEx;
//# sourceMappingURL=Health.js.map