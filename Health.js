"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PM2 = require("pm2");
const Pmx = require("pmx");
const path_1 = require("path");
const Mail_1 = require("./Mail");
const Snapshot_1 = require("./Snapshot");
const PROBE_INTERVAL_S = 60, HOLD_PERIOD_M = 30, LOGS = ["pm_err_log_path", "pm_out_log_path"], OP = {
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
        if (this._config.probeIntervalS == null)
            this._config.probeIntervalS = PROBE_INTERVAL_S;
        this._mail = new Mail_1.Mail(_config);
        this._snapshot = new Snapshot_1.Snapshot(this._config);
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
            this._snapshot.dump();
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
                    let temp = parseFloat(monit[key].value), v = isNaN(temp) ? monit[key].value : temp, bad;
                    if (probe.op && probe.op in OP && probe.target != null)
                        bad = OP[probe.op](v, probe.target);
                    // test
                    if (probe.disabled !== true && bad === true && (probe.ifChanged !== true || this._snapshot.last(e.pm_id, key) !== v))
                        alerts.push(`<tr><td>${e.name}:${e.pm_id}</td><td>${key}</td><td>${v}</td><td>${this._snapshot.last(e.pm_id, key)}</td><td>${probe.target}</td></tr>`);
                    this._snapshot.push(e.pm_id, e.name, key, { v, bad });
                }
            }
            this._snapshot.send();
            if (alerts.length > 0)
                this.mail(`${alerts.length} alert(s)`, `
                    <table>
                        <tr>
                            <th>App</th><th>Metric</th><th>Value</th><th>Prev. Value</th><th>Target</th>
                        </tr>
                        ${alerts.join("")}
                    </table>`);
            setTimeout(() => { this.testProbes(); }, 1000 * this._config.probeIntervalS);
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