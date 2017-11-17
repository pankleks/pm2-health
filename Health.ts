import * as PM2 from "pm2";
import * as Pmx from "pmx";
import * as Fs from "fs";
import * as Mailer from "nodemailer";
import { hostname } from "os";
import { basename } from "path";

const PROBE_INTERVAL_M = 1;
const HOLD_PERIOD_M = 30;
const LOGS = ["pm_err_log_path", "pm_out_log_path"];

interface IConfig {
    smtp: {
        host: string;
        port: number;
        user: string;
        password: string;
    },
    mailTo: string;
    replyTo: string;
    events: string[];
    probeIntervalM: number;
}

interface IProbes {
    [key: string]: {
        target: number;
        fn: (v, t) => boolean;
        ifChanged?: boolean;
    }
}

export class Health {
    _template = "<p><!-- body --></p><p><!-- timeStamp --></p>";
    _probes: IProbes = {};
    _holdTill: Date = null;

    _history: {
        [pid: number]: number
    } = {};

    constructor(private _config: IConfig) {
        if (!this._config.smtp)
            throw new Error(`[smpt] not set`);
        if (!this._config.smtp.host)
            throw new Error(`[smtp.host] not set`);
        if (!this._config.smtp.port)
            throw new Error(`[smtp.port] not set`);
        if (!this._config.mailTo)
            throw new Error(`[mailTo] not set`);
        if (this._config.probeIntervalM == null)
            this._config.probeIntervalM = PROBE_INTERVAL_M;
    }

    go() {
        try {
            this._template = Fs.readFileSync("Template.html", "utf8");
        }
        catch {
            console.log(`Template.html not found`);
        }
        try {
            this._probes = require("./Probes.js");
        }
        catch {
            console.log(`Probes.js not found`);
        }

        console.log(`pm2-health is on`);

        PM2.connect((ex) => {
            stopIfEx(ex);

            PM2.launchBus((ex, bus) => {
                stopIfEx(ex);

                bus.on("process:event", (data) => {
                    if (data.manually)
                        return;

                    if (Array.isArray(this._config.events) && this._config.events.indexOf(data.event) === -1)
                        return;

                    this.mail(
                        `${data.process.name}:${data.process.pm_id} - ${data.event}`,
                        `<p>App: <b>${data.process.name}:${data.process.pm_id}</b></p><p>Event: <b>${data.event}</b></p><pre>${JSON.stringify(data, undefined, 4)}</pre>`,
                        LOGS.filter(e => data.process[e]).map(e => ({ filename: basename(data.process[e]), path: data.process[e] })));
                });
            });

            this.testProbes();
        });

        Pmx.action("hold", (reply) => {
            this._holdTill = new Date();
            this._holdTill.setTime(this._holdTill.getTime() + HOLD_PERIOD_M * 60000);
            reply(`hold mail till ${this._holdTill.toISOString()}`);
        });
    }

    private mail(subject: string, body: string, attachements = []) {
        let
            t = new Date();
        if (this._holdTill != null && t < this._holdTill)
            return; // skip

        let
            temp = {
                host: this._config.smtp.host,
                port: this._config.smtp.port,
                auth: null
            };

        if (this._config.smtp.user)
            temp.auth = {
                user: this._config.smtp.user,
                pass: this._config.smtp.password
            };

        let
            transport = Mailer.createTransport(temp);

        transport.sendMail({
            to: this._config.mailTo,
            from: this._config.smtp.user,
            replyTo: this._config.replyTo,
            subject: `pm2-health: ${hostname()}, ${subject}`,
            html: this._template.replace(/<!--\s*body\s*-->/, body).replace(/<!--\s*timeStamp\s*-->/, new Date().toISOString()),
            attachments: attachements
        }).then(() => {
            console.log(subject);
        }).catch(ex => {
            console.error(`can't send mail, ${ex.message || ex}`);
        });
    }

    private testProbes() {
        let
            alerts = [];

        PM2.list((ex, list) => {
            stopIfEx(ex);

            for (let e of list) {
                let
                    monit = e.pm2_env["axm_monitor"];
                if (!monit)
                    continue;

                for (let key of Object.keys(monit)) {
                    let
                        probe = this._probes[key];
                    if (!probe || probe.target == null)
                        continue;

                    let
                        v = parseFloat(monit[key].value);
                    if (isNaN(v))
                        continue;

                    if (probe.fn(v, probe.target) === true && (!probe.ifChanged || this._history[e.pid] !== v)) {
                        this._history[e.pid] = v;
                        alerts.push(`<tr><td>${e.name}:${e.pm_id}</td><td>${key}</td><td>${v}</td><td>${probe.target}</td></tr>`);
                    }
                }
            }

            if (alerts.length > 0)
                this.mail(
                    `${alerts.length} alert(s)`,
                    `<table>
                        <tr>
                            <th>App</th><th>Probe</th><th>Value</th><th>Target</th>
                        </tr>
                        ${alerts.join("")}
                    </table>`);

            setTimeout(
                () => { this.testProbes(); },
                1000 * 60 * this._config.probeIntervalM);
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