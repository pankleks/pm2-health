"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@slack/client");
class Slack {
    constructor(_config) {
        this._config = _config;
        if (!this._config.slack)
            this._config.slack = { disabled: true };
        if (this._config.slack.disabled === true)
            return;
        if (!this._config.slack.username)
            this._config.slack.username = 'pm2-health';
        if (!this._config.slack.channel)
            throw new Error('[slack.channel] not set');
        if (!this._config.slack.webhook)
            throw new Error('[slack.webhook] not set');
        this._webhook = new client_1.IncomingWebhook(this._config.slack.webhook);
    }
    async send(subject, attachments = []) {
        if (this._config.slack.disabled === true)
            return;
        const paylaod = {
            channel: this._config.slack.channel,
            username: this._config.slack.username,
            text: subject,
            icon_emoji: ':bar_chart:',
            attachments,
        };
        await this._webhook.send(paylaod);
    }
    /**
     * Format function for message building, default formatting is Bold
     */
    static format(txt, { code = false, bold = false, italics = false, strikethrough = false, } = { bold: true }) {
        if (code)
            txt = `\`${txt}\``;
        if (bold)
            txt = `*${txt}*`;
        if (italics)
            txt = `_${txt}_`;
        if (strikethrough)
            txt = `~${txt}~`;
        return txt;
    }
    static formatUrl(url, text) {
        return `<${url}|${text}>`;
    }
    ;
}
Slack.COLORS = {
    "high": "danger",
    "low": "warning",
};
exports.Slack = Slack;
//# sourceMappingURL=Slack.js.map