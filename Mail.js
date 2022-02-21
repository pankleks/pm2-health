"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mail = void 0;
const Mailer = require("nodemailer");
const Fs = require("fs");
const os_1 = require("os");
const Log_1 = require("./Log");
class Mail {
    constructor(_config) {
        this._config = _config;
        this._template = "<p><!-- body --></p><p><!-- timeStamp --></p>";
        this._authTypes = ['plain', 'oauth2'];
        const _smtp = this._config.smtp;
        if (!_smtp)
            this._config.smtp = { disabled: true };
        if (_smtp.disabled === true)
            return; // don't analyze config if disabled
        if (!_smtp.type || _smtp.type === 'plain|oauth2') {
            _smtp.type = "plain";
        }
        if (!this._authTypes.includes(_smtp.type.trim().toLowerCase()))
            throw new Error(`[smtp.type] Authentication type not found ${_smtp.type.trim().toLowerCase()}`);
        _smtp.type = _smtp.type.trim().toLowerCase();
        if (!_smtp.host)
            throw new Error(`[smtp.host] not set`);
        if (!_smtp.port)
            throw new Error(`[smtp.port] not set`);
        try {
            this._template = Fs.readFileSync("Template.html", "utf8");
        }
        catch (_a) {
            (0, Log_1.info)(`Template.html not found`);
        }
    }
    configChanged() {
        if (!this._config.mailTo)
            throw new Error(`[mailTo] not set`);
    }
    async send(message) {
        if (this._config.smtp.disabled === true) {
            (0, Log_1.debug)("mail sending is disbled in config");
            return;
        }
        const temp = {
            host: this._config.smtp.host,
            port: this._config.smtp.port,
            tls: { rejectUnauthorized: false },
            secure: this._config.smtp.secure === true,
            auth: null,
            name: typeof this._config.smtp.clientHostName == "string" && this._config.smtp.clientHostName ? this._config.smtp.clientHostName : null
        };
        if (this._config.smtp.type === 'plain' && this._config.smtp.user)
            temp.auth = {
                user: this._config.smtp.user,
                pass: this._config.smtp.password
            };
        if (this._config.smtp.type === 'oauth2')
            temp.auth = {
                type: 'OAuth2',
                user: this._config.smtp.user,
                clientId: this._config.smtp.clientId,
                clientSecret: this._config.smtp.clientSecret,
                accessToken: this._config.smtp.accessToken,
                refreshToken: this._config.smtp.refreshToken
            };
        const transport = Mailer.createTransport(temp), headers = {};
        if (message.priority)
            headers["importance"] = message.priority;
        await transport.sendMail({
            to: this._config.mailTo,
            from: this._config.smtp.from || this._config.smtp.user,
            replyTo: this._config.replyTo,
            subject: `pm2-health: ${(0, os_1.hostname)()}, ${message.subject}`,
            html: this._template
                .replace(/<!--\s*body\s*-->/, message.body)
                .replace(/<!--\s*timeStamp\s*-->/, new Date().toISOString()),
            attachments: message.attachements,
            headers
        });
    }
}
exports.Mail = Mail;
//# sourceMappingURL=Mail.js.map