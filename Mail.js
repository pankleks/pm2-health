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
        this._authTypes = ['smtp', 'oauth2'];
        const _credentials = this._config.credentials;
        if (!_credentials)
            this._config.credentials = { disabled: true };
        if (_credentials.disabled === true)
            return; // don't analyze config if disabled
        if (!_credentials.type || _credentials.type === 'smtp|oauth2') {
            _credentials.type = "smtp";
        }
        if (!this._authTypes.includes(_credentials.type.trim().toLowerCase()))
            throw new Error(`[credentials.type] Authentication type not found ${_credentials.type.trim().toLowerCase()}`);
        _credentials.type = _credentials.type.trim().toLowerCase();
        if (!_credentials.host)
            throw new Error(`[credentials.host] not set`);
        if (!_credentials.port)
            throw new Error(`[credentials.port] not set`);
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
        if (this._config.credentials.disabled === true) {
            (0, Log_1.debug)("mail sending is disbled in config");
            return;
        }
        const temp = {
            host: this._config.credentials.host,
            port: this._config.credentials.port,
            tls: { rejectUnauthorized: false },
            secure: this._config.credentials.secure === true,
            auth: null,
            name: typeof this._config.credentials.clientHostName == "string" && this._config.credentials.clientHostName ? this._config.credentials.clientHostName : null
        };
        if (this._config.credentials.type === 'smtp' && this._config.credentials.user)
            temp.auth = {
                user: this._config.credentials.user,
                pass: this._config.credentials.password
            };
        if (this._config.credentials.type === 'oauth2')
            temp.auth = {
                type: 'OAuth2',
                user: this._config.credentials.user,
                clientId: this._config.credentials.clientId,
                clientSecret: this._config.credentials.clientSecret,
                accessToken: this._config.credentials.accessToken,
                refreshToken: this._config.credentials.refreshToken
            };
        const transport = Mailer.createTransport(temp), headers = {};
        if (message.priority)
            headers["importance"] = message.priority;
        await transport.sendMail({
            to: this._config.mailTo,
            from: this._config.credentials.from || this._config.credentials.user,
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