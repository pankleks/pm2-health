import * as Mailer from "nodemailer";
import * as Fs from "fs";
import { hostname } from "os";
import { info, debug, error } from "./Log";

export interface ISmtpConfig {
    smtp: {
        host?: string;
        port?: number;
        user?: string;
        password?: string;
        secure?: boolean;
        from?: string;
        disabled: boolean;
    },
    mailTo: string;
    replyTo: string;
    batchPeriodM?: number;
    batchMaxMessages?: number;
}

interface IMessage {
    subject: string;
    body: string;
    priority?: "high" | "low";
    attachements?: any[];
}

export class Mail {
    private _template = "<p><!-- body --></p><p><!-- timeStamp --></p>";

    constructor(private _config: ISmtpConfig) {
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
        catch {
            info(`Template.html not found`);
        }
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
            auth: null
        };

        if (this._config.smtp.user)
            temp.auth = {
                user: this._config.smtp.user,
                pass: this._config.smtp.password
            };

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

export class Notify {
    private _mail: Mail;
    private _holdTill: Date = null;
    private _messages: IMessage[] = [];
    private _lastBatchT = new Date().getTime();

    constructor(private _config: ISmtpConfig) {
        this._mail = new Mail(this._config);
    }

    hold(till: Date) {
        this._holdTill = till;
    }

    async send(message: IMessage) {
        const t = new Date();

        if (this._holdTill != null && t < this._holdTill)
            return; // skip

        if (this._config.batchPeriodM > 0 && message.priority !== "high") {
            this._messages.push(message);

            if (t.getTime() - this._lastBatchT > this._config.batchPeriodM * 1000 * 60 ||
                (this._config.batchMaxMessages > 0 && this._messages.length > this._config.batchMaxMessages)) {
                const temp: IMessage = {
                    subject: this._messages[0].subject + (this._messages.length > 1 ? ` +(${this._messages.length})` : ""),
                    body: this._messages.map(e => e.body).join("<hr/>"),
                    attachements: this._messages.filter(e => e.attachements != null).map(e => e.attachements).reduce((p, c) => p.concat(c), [])
                }

                try {
                    await this._mail.send(temp);

                    this._messages = [];
                    this._lastBatchT = t.getTime();
                }
                catch (ex) {
                    error(`can't send batch mail -> ${ex.message || ex}`);
                }
            }
        }
        else {
            try {
                this._mail.send(message);
            }
            catch (ex) {
                error(`can't send mail -> ${ex.message || ex}`);
            }
        }
    }
}