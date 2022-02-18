import * as Mailer from "nodemailer";
import * as Fs from "fs";
import { hostname } from "os";
import { info, debug, error } from "./Log";

export interface ISmtpConfig {
    credentials: {
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
    private _authTypes = ['smtp', 'oauth2'];

    constructor(private _config: ISmtpConfig) {
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
        catch {
            info(`Template.html not found`);
        }
    }

    configChanged() {
        if (!this._config.mailTo)
            throw new Error(`[mailTo] not set`);
    }

    async send(message: IMessage) {
        if (this._config.credentials.disabled === true) {
            debug("mail sending is disbled in config");
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
            }

        const
            transport = Mailer.createTransport(temp),
            headers = {};

        if (message.priority)
            headers["importance"] = message.priority;

        await transport.sendMail({
            to: this._config.mailTo,
            from: this._config.credentials.from || this._config.credentials.user, // use from, if not set -> user
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
