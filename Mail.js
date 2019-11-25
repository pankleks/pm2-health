"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Mailer = require("nodemailer");
const Fs = require("fs");
const os_1 = require("os");
const Log_1 = require("./Log");
class Mail {
    constructor(_config) {
        this._config = _config;
        this._template = "<p><!-- body --></p><p><!-- timeStamp --></p>";
        if (!this._config.smtp)
            this._config.smtp = { disabled: true };
        if (this._config.smtp.disabled === true)
            return; // don't analyze config if disabled
        if (!this._config.smtp)
            throw new Error(`[smtp] not set`);
        if (!this._config.smtp.host)
            throw new Error(`[smtp.host] not set`);
        if (!this._config.smtp)
            throw new Error(`[smtp.port] not set`);
        if (!this._config.mailTo)
            throw new Error(`[mailTo] not set`);
        try {
            this._template = Fs.readFileSync("Template.html", "utf8");
        }
        catch (_a) {
            Log_1.info(`Template.html not found`);
        }
    }
    async send(message) {
        if (this._config.smtp.disabled === true) {
            Log_1.debug("mail sending is disbled in config");
            return;
        }
        const temp = {
            host: this._config.smtp.host,
            port: this._config.smtp.port,
            tls: { rejectUnauthorized: false },
            secure: this._config.smtp.secure === true,
            auth: null
        };
        if (this._config.smtp.user)
            temp.auth = {
                user: this._config.smtp.user,
                pass: this._config.smtp.password
            };
        const transport = Mailer.createTransport(temp), headers = {};
        if (message.priority)
            headers["importance"] = message.priority;
        await transport.sendMail({
            to: this._config.mailTo,
            from: this._config.smtp.from || this._config.smtp.user,
            replyTo: this._config.replyTo,
            subject: `pm2-health: ${os_1.hostname()}, ${message.subject}`,
            html: this._template
                .replace(/<!--\s*body\s*-->/, message.body)
                .replace(/<!--\s*timeStamp\s*-->/, new Date().toISOString()),
            attachments: message.attachements,
            headers
        });
    }
}
exports.Mail = Mail;
class Notify {
    constructor(_config) {
        this._config = _config;
        this._holdTill = null;
        this._messages = [];
        this._lastBatchT = new Date().getTime();
        this._mail = new Mail(this._config);
    }
    hold(till) {
        this._holdTill = till;
    }
    async send(message) {
        const t = new Date();
        if (this._holdTill != null && t < this._holdTill)
            return; // skip
        if (this._config.batchPeriodM > 0 && message.priority !== "high") {
            this._messages.push(message);
            if (t.getTime() - this._lastBatchT > this._config.batchPeriodM * 1000 * 60 ||
                (this._config.batchMaxMessages > 0 && this._messages.length > this._config.batchMaxMessages)) {
                const temp = {
                    subject: this._messages[0].subject + (this._messages.length > 1 ? ` +(${this._messages.length})` : ""),
                    body: this._messages.map(e => e.body).join("<hr/>"),
                    attachements: this._messages.filter(e => e.attachements != null).map(e => e.attachements).reduce((p, c) => p.concat(c), [])
                };
                try {
                    await this._mail.send(temp);
                    this._messages = [];
                    this._lastBatchT = t.getTime();
                }
                catch (ex) {
                    Log_1.error(`can't send batch mail -> ${ex.message || ex}`);
                }
            }
        }
        else {
            try {
                this._mail.send(message);
            }
            catch (ex) {
                Log_1.error(`can't send mail -> ${ex.message || ex}`);
            }
        }
    }
}
exports.Notify = Notify;
//# sourceMappingURL=Mail.js.map