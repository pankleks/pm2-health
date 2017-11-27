"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PM2 = require("pm2");
const Pmx = require("pmx");
const path_1 = require("path");
const Mail_1 = require("./Mail");
const History_1 = require("./History");
const PROBE_INTERVAL_M = 1, HOLD_PERIOD_M = 30, LOGS = ["pm_err_log_path", "pm_out_log_path"], OP = {
    "<": (a, b) => a < b,
    ">": (a, b) => a > b,
    "=": (a, b) => a === b,
    "<=": (a, b) => a <= b,
    ">=": (a, b) => a >= b,
    "!=": (a, b) => a != b
};
class Health {
    constructor(_config) {
        this._config = _config;
        this._holdTill = null;
        if (this._config.probeIntervalM == null)
            this._config.probeIntervalM = PROBE_INTERVAL_M;
        this._mail = new Mail_1.Mail(_config);
        this._history = new History_1.History(this._config);
    }
    isAppExcluded(app) {
        return app === "pm2-health" || (Array.isArray(this._config.appsExcluded) && this._config.appsExcluded.indexOf(app) !== -1);
    }
    go() {
        console.log(`pm2-health is on`);
        let exps = [];
        if (Array.isArray(this._config.messageExcludeExps))
            exps = this._config.messageExcludeExps.map(e => new RegExp(e));
        PM2.connect((ex) => {
            stopIfEx(ex);
            PM2.launchBus((ex, bus) => {
                stopIfEx(ex);
                bus.on("process:event", (data) => {
                    if (data.manually || this.isAppExcluded(data.process.name))
                        return;
                    if (Array.isArray(this._config.events) && this._config.events.indexOf(data.event) === -1)
                        return;
                    this.mail(`${data.process.name}:${data.process.pm_id} - ${data.event}`, `
                        <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>
                        <p>Event: <b>${data.event}</b></p>
                        <pre>${JSON.stringify(data, undefined, 4)}</pre>`, LOGS.filter(e => this._config.addLogs === true && data.process[e]).map(e => ({ filename: path_1.basename(data.process[e]), path: data.process[e] })));
                });
                if (this._config.exceptions)
                    bus.on("process:exception", (data) => {
                        if (this.isAppExcluded(data.process.name))
                            return;
                        this.mail(`${data.process.name}:${data.process.pm_id} - exception`, `
                            <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>                            
                            <pre>${JSON.stringify(data.data, undefined, 4)}</pre>`);
                    });
                if (this._config.messages)
                    bus.on("process:msg", (data) => {
                        if (this.isAppExcluded(data.process.name))
                            return;
                        let json = JSON.stringify(data.data, undefined, 4);
                        if (exps.some(e => e.test(json)))
                            return; // exclude
                        this.mail(`${data.process.name}:${data.process.pm_id} - message`, `
                            <p>App: <b>${data.process.name}:${data.process.pm_id}</b></p>
                            <pre>${json}</pre>`);
                    });
            });
            this.testProbes();
        });
        Pmx.action("hold", (reply) => {
            this._holdTill = new Date();
            this._holdTill.setTime(this._holdTill.getTime() + HOLD_PERIOD_M * 60000);
            reply(`mail held till ${this._holdTill.toISOString()}`);
        });
        Pmx.action("unhold", (reply) => {
            this._holdTill = null;
            reply(`mail unheld`);
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
        Pmx.action("dump", (reply) => {
            this._history.dump();
            reply(`dumping`);
        });
    }
    async mail(subject, body, attachements = []) {
        let t = new Date();
        if (this._holdTill != null && t < this._holdTill)
            return; // skip
        try {
            await this._mail.send(subject, body, attachements);
            console.log(`mail send: ${subject}`);
        }
        catch (ex) {
            console.error(`mail failed: ${ex.message || ex}`);
        }
    }
    testProbes() {
        let alerts = [];
        PM2.list((ex, list) => {
            stopIfEx(ex);
            for (let e of list) {
                if (this.isAppExcluded(e.name))
                    continue;
                let monit = e.pm2_env["axm_monitor"];
                if (!monit)
                    continue;
                for (let key of Object.keys(monit)) {
                    let probe = this._config.probes[key];
                    if (!probe)
                        continue;
                    let temp = parseFloat(monit[key].value), v = isNaN(temp) ? monit[key].value : temp;
                    // test
                    if (!probe.disabled && !isNaN(probe.target) && !isNaN(v)) {
                        let fn = OP[probe.op];
                        if (fn && fn(v, probe.target) === true && (probe.ifChanged !== true || this._history.last(e.pid, key) !== v))
                            alerts.push(`<tr><td>${e.name}:${e.pm_id}</td><td>${key}</td><td>${v}</td><td>${this._history.last(e.pid, key)}</td><td>${probe.target}</td></tr>`);
                    }
                    this._history.push(e.pid, e.name, key, v);
                }
            }
            if (alerts.length > 0)
                this.mail(`${alerts.length} alert(s)`, `
                    <table>
                        <tr>
                            <th>App</th><th>Metric</th><th>Value</th><th>Prev. Value</th><th>Target</th>
                        </tr>
                        ${alerts.join("")}
                    </table>`);
            setTimeout(() => { this.testProbes(); }, 1000 * 60 * this._config.probeIntervalM);
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