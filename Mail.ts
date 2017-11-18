import * as Mailer from "nodemailer";
import * as Fs from "fs";
import { hostname } from "os";

export interface ISmtp {
    smtp: {
        host: string;
        port: number;
        user: string;
        password: string;
    },
    mailTo: string;
    replyTo: string;
}

export class Mail {
    private _template = "<p><!-- body --></p><p><!-- timeStamp --></p>";

    constructor(private _config: ISmtp) {
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
            console.log(`Template.html not found`);
        }
    }

    async send(subject: string, body: string, attachements = []) {
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

        await transport.sendMail({
            to: this._config.mailTo,
            from: this._config.smtp.user,
            replyTo: this._config.replyTo,
            subject: `pm2-health: ${hostname()}, ${subject}`,
            html: this._template
                .replace(/<!--\s*body\s*-->/, body)
                .replace(/<!--\s*timeStamp\s*-->/, new Date().toISOString()),
            attachments: attachements
        });
    }
}