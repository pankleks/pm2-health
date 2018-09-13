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
    async send(subject, body, priority, attachements = []) {
        if (this._config.smtp.disabled === true)
            return;
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
        if (priority)
            headers["importance"] = priority;
        await transport.sendMail({
            to: this._config.mailTo,
            from: this._config.smtp.from || this._config.smtp.user,
            replyTo: this._config.replyTo,
            subject: `pm2-health: ${os_1.hostname()}, ${subject}`,
            html: this._template
                .replace(/<!--\s*body\s*-->/, body)
                .replace(/<!--\s*timeStamp\s*-->/, new Date().toISOString()),
            attachments: attachements,
            headers
        });
    }
}
exports.Mail = Mail;
//# sourceMappingURL=Mail.js.map