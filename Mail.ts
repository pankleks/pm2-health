import * as Mailer from "nodemailer";
import * as Fs from "fs";
import { hostname } from "os";
import { info, debug, error } from "./Log";

export interface ISmtpConfig {
    smtp: {
        type?: string,
        host?: string;
        port?: number;
        user?: string;
        password?: string;
        clientId?: string,
        clientSecret?: string,
        accessToken?: string,
        refreshToken?: string,
        secure?: boolean;
        from?: string;
        disabled: boolean;
        clientHostName?: string;
    },
    mailTo: string;
    replyTo: string;
    batchPeriodM?: number;
    batchMaxMessages?: number;
}

export interface IMessage {
    subject: string;
    body: string;
    priority?: "high" | "low";
    attachements?: any[];
    on?: Date
}

export class Mail {
    private _template = "<p><!-- body --></p><p><!-- timeStamp --></p>";
    private _authTypes = ['plain', 'oauth2'];

    constructor(private _config: ISmtpConfig) {
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
        catch {
            info(`Template.html not found`);
        }
    }

    configChanged() {
        if (!this._config.mailTo)
            throw new Error(`[mailTo] not set`);
    }

    async send(message: IMessage) {
        if (this._config.smtp.disabled === true) {
            debug("mail sending is disbled in config");
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
            }

        const
            transport = Mailer.createTransport(temp),
            headers = {};

        if (message.priority)
            headers["importance"] = message.priority;

        await transport.sendMail({
            to: this._config.mailTo,
            from: this._config.smtp.from || this._config.smtp.user, // use from, if not set -> user
            replyTo: this._config.replyTo,
            subject: `pm2-health: ${hostname()}, ${message.subject}`,
            html: this._template
                .replace(/<!--\s*body\s*-->/, message.body)
                .replace(/<!--\s*timeStamp\s*-->/, new Date().toISOString()),
            attachments: message.attachements,
            headers
        });
    }
}
